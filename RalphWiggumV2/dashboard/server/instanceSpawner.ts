/**
 * Instance Spawner - Spawns and manages dashboard backend instances
 * Each instance runs on its own ports and manages a specific project
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import type { LauncherInstance } from '../src/types/index.js';
import { PortManager, type PortPair } from './portManager.js';
import { TemplateManager } from './templateManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ManagedInstance extends LauncherInstance {
  process: ChildProcess;
  portPair: PortPair;
}

export class InstanceSpawner extends EventEmitter {
  private instances: Map<string, ManagedInstance> = new Map();
  private portManager: PortManager;
  private templateManager: TemplateManager;
  private ralphPath: string;
  // Mutex to prevent concurrent spawn operations
  private spawnMutex: Map<string, Promise<LauncherInstance>> = new Map();

  constructor(ralphPath: string) {
    super();
    this.ralphPath = ralphPath;
    this.portManager = new PortManager();
    this.templateManager = new TemplateManager();
  }

  /**
   * Spawn a new dashboard instance for a project
   * Uses a mutex to prevent concurrent spawns for the same project
   */
  async spawnInstance(projectId: string, projectPath: string): Promise<LauncherInstance> {
    // Check if already running
    if (this.instances.has(projectId)) {
      throw new Error('Instance already running for this project');
    }

    // Check if a spawn is already in progress for this project
    const existingSpawn = this.spawnMutex.get(projectId);
    if (existingSpawn) {
      console.log(`[Instance ${projectId}] Spawn already in progress, waiting...`);
      return existingSpawn;
    }

    // Create a new spawn promise and store it in the mutex
    const spawnPromise = this._doSpawnInstance(projectId, projectPath);
    this.spawnMutex.set(projectId, spawnPromise);

    try {
      const result = await spawnPromise;
      return result;
    } finally {
      // Remove from mutex when done (success or failure)
      this.spawnMutex.delete(projectId);
    }
  }

  /**
   * Internal method that performs the actual spawn operation
   */
  private async _doSpawnInstance(projectId: string, projectPath: string): Promise<LauncherInstance> {
    // Double-check after acquiring mutex
    if (this.instances.has(projectId)) {
      throw new Error('Instance already running for this project');
    }

    // Auto-initialize project if missing Ralph files (AGENTS.md or CLAUDE.md)
    const needsInit = await this.templateManager.needsInitialization(projectPath);
    if (needsInit) {
      console.log(`[Instance ${projectId}] Project missing Ralph files, auto-initializing...`);
      const initResult = await this.templateManager.initializeProject(projectPath);
      if (initResult.created.length > 0) {
        console.log(`[Instance ${projectId}] Created files: ${initResult.created.join(', ')}`);
        this.emit('initialized', { projectId, created: initResult.created });
      }
    }

    // Allocate ports
    const portPair = await this.portManager.allocate();

    try {
      // Spawn the dashboard server using tsx for TypeScript
      const serverScript = path.join(__dirname, 'index.ts');
      const dashboardDir = path.join(this.ralphPath, 'dashboard');

      // Use npx tsx to run TypeScript - cross-platform compatible
      const isWindows = process.platform === 'win32';
      const npxCmd = isWindows ? 'npx.cmd' : 'npx';

      const childProcess = spawn(npxCmd, ['tsx', serverScript], {
        cwd: dashboardDir,
        env: {
          ...process.env,
          PORT: portPair.backendPort.toString(),
          PROJECT_PATH: projectPath,
          // Disable auto-opening browser for spawned instances
          BROWSER: 'none',
        },
        detached: !isWindows,
        stdio: ['ignore', 'pipe', 'pipe'],
        // On Windows, .cmd files require shell: true to execute properly
        shell: isWindows,
      });

      if (!childProcess.pid) {
        console.error(`[Instance ${projectId}] Failed to spawn process:`);
        console.error(`  Command: ${npxCmd} tsx ${serverScript}`);
        console.error(`  CWD: ${dashboardDir}`);
        console.error(`  Ports: backend=${portPair.backendPort}, frontend=${portPair.frontendPort}`);
        throw new Error(`Failed to start dashboard process for project ${projectId}`);
      }

      console.log(`[Instance ${projectId}] Spawning process:`);
      console.log(`  Command: ${npxCmd} tsx ${serverScript}`);
      console.log(`  CWD: ${dashboardDir}`);
      console.log(`  PID: ${childProcess.pid}`);
      console.log(`  Ports: backend=${portPair.backendPort}, frontend=${portPair.frontendPort}`);

      const instance: ManagedInstance = {
        projectId,
        backendPort: portPair.backendPort,
        frontendPort: portPair.frontendPort,
        pid: childProcess.pid,
        startedAt: new Date().toISOString(),
        process: childProcess,
        portPair,
      };

      // Wait for server to be ready before marking as started
      const STARTUP_TIMEOUT_MS = 45000; // 45 seconds timeout (increased from 30)
      const serverReady = await this.waitForServerReady(childProcess, projectId, portPair.backendPort, STARTUP_TIMEOUT_MS);

      if (!serverReady) {
        console.error(`[Instance ${projectId}] Server failed to start within ${STARTUP_TIMEOUT_MS}ms`);
        console.error(`[Instance ${projectId}] Ports allocated: backend=${portPair.backendPort}, frontend=${portPair.frontendPort}`);
        console.error(`[Instance ${projectId}] Process PID: ${childProcess.pid}`);
        console.error(`[Instance ${projectId}] Process alive: ${!childProcess.killed}`);
        
        // Clean up process and ports
        try {
          if (!childProcess.killed) {
            childProcess.kill();
            // Wait a bit for process to exit
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (killErr) {
          console.error(`[Instance ${projectId}] Error killing process: ${killErr instanceof Error ? killErr.message : String(killErr)}`);
        }
        this.portManager.release(portPair.backendPort, portPair.frontendPort);
        throw new Error(`Server failed to start within timeout for project ${projectId}. Check logs for details.`);
      }

      console.log(`[Instance ${projectId}] Server is ready and responding`);

      // Set up process event handlers for monitoring after startup
      childProcess.stdout?.on('data', (data) => {
        console.log(`[Instance ${projectId}] ${data.toString().trim()}`);
      });

      childProcess.stderr?.on('data', (data) => {
        console.error(`[Instance ${projectId}] ${data.toString().trim()}`);
      });

      childProcess.on('close', (code) => {
        console.log(`[Instance ${projectId}] Process exited with code ${code}`);
        this.handleInstanceExit(projectId, code);
      });

      childProcess.on('error', (err) => {
        console.error(`[Instance ${projectId}] Process error: ${err.message}`);
        if ('code' in err) {
          console.error(`  Error code: ${(err as NodeJS.ErrnoException).code}`);
        }
        console.error(`  Stack: ${err.stack}`);
        this.handleInstanceError(projectId, err);
      });

      this.instances.set(projectId, instance);

      // Return the public instance info (without internal details)
      return {
        projectId: instance.projectId,
        backendPort: instance.backendPort,
        frontendPort: instance.frontendPort,
        pid: instance.pid,
        startedAt: instance.startedAt,
      };
    } catch (err) {
      // Enhanced error logging for spawn failures
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[Instance ${projectId}] Spawn failed with error: ${errorMessage}`);
      console.error(`  Project path: ${projectPath}`);
      console.error(`  Ralph path: ${this.ralphPath}`);

      // Release ports on failure
      this.portManager.release(portPair.backendPort, portPair.frontendPort);
      throw err;
    }
  }

  /**
   * Wait for the server to be ready by monitoring stdout for the ready message
   * or making HTTP health check requests
   */
  private waitForServerReady(
    childProcess: ChildProcess,
    projectId: string,
    port: number,
    timeoutMs: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;
      const stdoutBuffer: string[] = [];
      const stderrBuffer: string[] = [];

      // Method 1: Monitor stdout for the "server running" message
      const onStdoutData = (data: Buffer) => {
        const output = data.toString();
        stdoutBuffer.push(output);
        console.log(`[Instance ${projectId}] ${output.trim()}`);

        // Check for various server ready messages
        if (output.includes('server running on port') || 
            output.includes('Ralph Dashboard server running') ||
            output.includes(`running on port ${port}`)) {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve(true);
          }
        }
      };

      // Capture stderr for error logging
      const onStderrData = (data: Buffer) => {
        const output = data.toString();
        stderrBuffer.push(output);
        console.error(`[Instance ${projectId}] STDERR: ${output.trim()}`);
      };

      // Method 2: Handle early exit (process crashed)
      const onClose = (code: number | null) => {
        if (!resolved) {
          resolved = true;
          console.error(`[Instance ${projectId}] Process exited during startup with code ${code}`);
          console.error(`[Instance ${projectId}] STDOUT captured:`, stdoutBuffer.join(''));
          console.error(`[Instance ${projectId}] STDERR captured:`, stderrBuffer.join(''));
          cleanup();
          resolve(false);
        }
      };

      const onError = (err: Error) => {
        if (!resolved) {
          resolved = true;
          console.error(`[Instance ${projectId}] Process error during startup: ${err.message}`);
          console.error(`[Instance ${projectId}] STDOUT captured:`, stdoutBuffer.join(''));
          console.error(`[Instance ${projectId}] STDERR captured:`, stderrBuffer.join(''));
          cleanup();
          resolve(false);
        }
      };

      // Method 3: HTTP health check (fallback if stdout detection fails)
      let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
      const startHealthCheck = () => {
        // Start health checks after 2 seconds
        setTimeout(() => {
          if (resolved) return;
          
          healthCheckInterval = setInterval(async () => {
            if (resolved) return;
            
            try {
              const response = await fetch(`http://localhost:${port}/api/status`, {
                signal: AbortSignal.timeout(2000),
              });
              if (response.ok) {
                if (!resolved) {
                  resolved = true;
                  console.log(`[Instance ${projectId}] Health check passed`);
                  cleanup();
                  resolve(true);
                }
              }
            } catch {
              // Health check failed, continue waiting
            }
          }, 1000);
        }, 2000);
      };

      // Cleanup listeners
      const cleanup = () => {
        childProcess.stdout?.off('data', onStdoutData);
        childProcess.stderr?.off('data', onStderrData);
        childProcess.off('close', onClose);
        childProcess.off('error', onError);
        if (healthCheckInterval) {
          clearInterval(healthCheckInterval);
        }
        clearTimeout(timeoutTimer);
      };

      // Timeout fallback
      const timeoutTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.error(`[Instance ${projectId}] Startup timeout after ${timeoutMs}ms`);
          console.error(`[Instance ${projectId}] STDOUT captured:`, stdoutBuffer.join(''));
          console.error(`[Instance ${projectId}] STDERR captured:`, stderrBuffer.join(''));
          cleanup();
          resolve(false);
        }
      }, timeoutMs);

      // Attach listeners
      childProcess.stdout?.on('data', onStdoutData);
      childProcess.stderr?.on('data', onStderrData);
      childProcess.on('close', onClose);
      childProcess.on('error', onError);
      
      // Start health check fallback
      startHealthCheck();
    });
  }

  /**
   * Stop a running instance
   */
  async stopInstance(projectId: string): Promise<void> {
    const instance = this.instances.get(projectId);
    if (!instance) {
      throw new Error('Instance not running');
    }

    const { process: childProcess, portPair } = instance;
    const pid = childProcess.pid;

    const isWindows = process.platform === 'win32';

    return new Promise((resolve) => {
      const cleanup = () => {
        this.portManager.release(portPair.backendPort, portPair.frontendPort);
        this.instances.delete(projectId);
        this.emit('stopped', { projectId });
        resolve();
      };

      if (isWindows && pid) {
        // On Windows, use taskkill to kill the process tree
        exec(`taskkill /pid ${pid} /T /F`, (err) => {
          if (err) {
            console.warn(`[Instance ${projectId}] Failed to kill process tree: ${err.message}`);
            // Fallback to regular kill
            childProcess.kill();
          }
          // Give it a moment to clean up
          setTimeout(cleanup, 500);
        });
      } else {
        // On Unix, send SIGTERM for graceful shutdown
        childProcess.kill('SIGTERM');

        // Force kill after 3 seconds if still running
        const forceKillTimer = setTimeout(() => {
          if (this.instances.has(projectId)) {
            childProcess.kill('SIGKILL');
          }
        }, 3000);

        childProcess.once('close', () => {
          clearTimeout(forceKillTimer);
          cleanup();
        });
      }
    });
  }

  /**
   * Handle instance process exit
   */
  private handleInstanceExit(projectId: string, code: number | null): void {
    const instance = this.instances.get(projectId);
    if (!instance) return;

    this.portManager.release(instance.portPair.backendPort, instance.portPair.frontendPort);
    this.instances.delete(projectId);

    if (code !== 0 && code !== null) {
      this.emit('crashed', { projectId, error: `Process exited with code ${code}` });
    } else {
      this.emit('stopped', { projectId });
    }
  }

  /**
   * Handle instance process error
   */
  private handleInstanceError(projectId: string, error: Error): void {
    const instance = this.instances.get(projectId);
    if (!instance) return;

    this.portManager.release(instance.portPair.backendPort, instance.portPair.frontendPort);
    this.instances.delete(projectId);

    this.emit('crashed', { projectId, error: error.message });
  }

  /**
   * List all running instances
   */
  listInstances(): LauncherInstance[] {
    return Array.from(this.instances.values()).map(instance => ({
      projectId: instance.projectId,
      backendPort: instance.backendPort,
      frontendPort: instance.frontendPort,
      pid: instance.pid,
      startedAt: instance.startedAt,
      loopStatus: instance.loopStatus,
    }));
  }

  /**
   * Check if an instance is running for a project
   */
  isRunning(projectId: string): boolean {
    return this.instances.has(projectId);
  }

  /**
   * Get instance info for a project
   */
  getInstance(projectId: string): LauncherInstance | null {
    const instance = this.instances.get(projectId);
    if (!instance) return null;

    return {
      projectId: instance.projectId,
      backendPort: instance.backendPort,
      frontendPort: instance.frontendPort,
      pid: instance.pid,
      startedAt: instance.startedAt,
      loopStatus: instance.loopStatus,
    };
  }

  /**
   * Stop all running instances
   */
  async stopAll(): Promise<void> {
    const promises = Array.from(this.instances.keys()).map(projectId =>
      this.stopInstance(projectId).catch(err =>
        console.error(`Failed to stop instance ${projectId}: ${err.message}`)
      )
    );
    await Promise.all(promises);
  }

  /**
   * Get the URL for a running instance's dashboard
   */
  getDashboardUrl(projectId: string): string | null {
    const instance = this.instances.get(projectId);
    if (!instance) return null;

    // The frontend runs on a different port
    // For now, we'll use the backend port as the entry point
    // The actual frontend URL depends on how Vite is configured
    return `http://localhost:${instance.backendPort}`;
  }
}

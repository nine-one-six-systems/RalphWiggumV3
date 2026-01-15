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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ManagedInstance extends LauncherInstance {
  process: ChildProcess;
  portPair: PortPair;
}

export class InstanceSpawner extends EventEmitter {
  private instances: Map<string, ManagedInstance> = new Map();
  private portManager: PortManager;
  private ralphPath: string;

  constructor(ralphPath: string) {
    super();
    this.ralphPath = ralphPath;
    this.portManager = new PortManager();
  }

  /**
   * Spawn a new dashboard instance for a project
   */
  async spawnInstance(projectId: string, projectPath: string): Promise<LauncherInstance> {
    // Check if already running
    if (this.instances.has(projectId)) {
      throw new Error('Instance already running for this project');
    }

    // Allocate ports
    const portPair = await this.portManager.allocate();

    try {
      // Spawn the dashboard server
      const serverScript = path.join(__dirname, 'index.js');

      // Use ts-node for development or node for production
      const isWindows = process.platform === 'win32';
      const nodeCmd = process.execPath; // Use the same Node that's running us

      const childProcess = spawn(nodeCmd, [serverScript], {
        cwd: path.join(this.ralphPath, 'dashboard'),
        env: {
          ...process.env,
          PORT: portPair.backendPort.toString(),
          PROJECT_PATH: projectPath,
          // Disable auto-opening browser for spawned instances
          BROWSER: 'none',
        },
        detached: !isWindows,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (!childProcess.pid) {
        throw new Error('Failed to start dashboard process');
      }

      const instance: ManagedInstance = {
        projectId,
        backendPort: portPair.backendPort,
        frontendPort: portPair.frontendPort,
        pid: childProcess.pid,
        startedAt: new Date().toISOString(),
        process: childProcess,
        portPair,
      };

      // Set up process event handlers
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
      // Release ports on failure
      this.portManager.release(portPair.backendPort, portPair.frontendPort);
      throw err;
    }
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

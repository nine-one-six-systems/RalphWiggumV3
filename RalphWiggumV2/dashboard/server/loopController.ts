import { EventEmitter } from 'events';
import { spawn, ChildProcess, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import type { LoopStatus, LoopMode, LogEntry } from '../src/types';
import { getSessionRepository, type ActiveSession } from './database/repositories/SessionRepository.js';
import { getExecutionHistoryRepository } from './database/repositories/ExecutionHistoryRepository.js';

// Heartbeat interval in milliseconds
const HEARTBEAT_INTERVAL_MS = 5000;

// Find bash executable on Windows
function findBashOnWindows(): string | null {
  const possiblePaths = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    'C:\\Git\\bin\\bash.exe',
    process.env.PROGRAMFILES + '\\Git\\bin\\bash.exe',
    process.env['PROGRAMFILES(X86)'] + '\\Git\\bin\\bash.exe',
  ];

  for (const bashPath of possiblePaths) {
    if (bashPath && fs.existsSync(bashPath)) {
      return bashPath;
    }
  }
  return null;
}

export interface LoopControllerOptions {
  projectId?: string;
  maxRuntimeSeconds?: number;
  costLimit?: number;
  completionPromise?: string;
}

export class LoopController extends EventEmitter {
  private projectPath: string; // Target project to run in
  private ralphPath: string; // RalphWiggumV2 directory (for loop.sh)
  private projectId: string | null = null;
  private process: ChildProcess | null = null;
  private sessionId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private status: LoopStatus = {
    running: false,
    mode: null,
    iteration: 0,
    maxIterations: 0,
  };

  constructor(projectPath: string, ralphPath?: string) {
    super();
    this.projectPath = projectPath;
    this.ralphPath = ralphPath || projectPath;
  }

  /**
   * Set the project ID for session tracking
   */
  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  getStatus(): LoopStatus {
    return { ...this.status };
  }

  /**
   * Get the current active session from the database
   */
  getActiveSession(): ActiveSession | null {
    if (!this.sessionId) return null;
    const sessionRepo = getSessionRepository();
    return sessionRepo.getSession(this.sessionId);
  }

  /**
   * Recover an existing session (e.g., after browser refresh)
   */
  recoverSession(session: ActiveSession): void {
    this.sessionId = session.id;
    this.projectId = session.projectId;
    this.status = {
      running: session.state === 'running' || session.state === 'paused',
      mode: session.mode,
      iteration: session.currentIteration,
      maxIterations: session.maxIterations || 0,
      workScope: session.workScope ?? undefined,
      startedAt: new Date(session.startedAt),
      pid: session.pid,
    };

    // Start heartbeat for recovered session
    this.startHeartbeat();

    this.emit('status', this.status);
  }

  start(options: { mode: LoopMode; maxIterations?: number; workScope?: string } & LoopControllerOptions) {
    if (this.process) {
      this.emitLog('Loop already running', 'warning');
      return;
    }

    const { mode, maxIterations, workScope, maxRuntimeSeconds, costLimit, completionPromise } = options;
    // Use loop.sh from Ralph's directory, not the target project
    const loopScript = path.join(this.ralphPath, 'loop.sh');

    // Build command arguments
    const args: string[] = [];

    switch (mode) {
      case 'plan':
        args.push('plan');
        if (maxIterations) args.push(maxIterations.toString());
        break;
      case 'plan-slc':
        args.push('plan-slc');
        if (maxIterations) args.push(maxIterations.toString());
        break;
      case 'plan-work':
        args.push('plan-work');
        if (workScope) args.push(workScope);
        break;
      case 'build':
        if (maxIterations) {
          args.push(maxIterations.toString());
        }
        break;
    }

    this.emitLog(
      `Starting loop: ${mode}${maxIterations ? ` (max ${maxIterations} iterations)` : ''}`,
      'info'
    );
    if (this.ralphPath !== this.projectPath) {
      this.emitLog(`Target project: ${this.projectPath}`, 'info');
      this.emitLog(`Ralph directory: ${this.ralphPath}`, 'info');
    }

    // Determine how to run bash on this platform
    const isWindows = process.platform === 'win32';
    let bashCmd = 'bash';

    if (isWindows) {
      const gitBash = findBashOnWindows();
      if (gitBash) {
        bashCmd = gitBash;
        this.emitLog(`Using Git Bash: ${gitBash}`, 'info');
      } else {
        this.emitLog(
          'Error: Git Bash not found. Please install Git for Windows to run the loop.',
          'error'
        );
        this.emitLog('Download from: https://git-scm.com/download/win', 'error');
        return;
      }
    }

    // Run in target project directory, but set RALPH_DIR so loop.sh can find its files
    this.process = spawn(bashCmd, [loopScript, ...args], {
      cwd: this.projectPath,
      env: {
        ...process.env,
        WORK_SCOPE: workScope || '',
        RALPH_DIR: this.ralphPath, // Tell loop.sh where to find prompt files
      },
    });

    const pid = this.process.pid;

    // Create session in database for browser refresh resilience
    if (this.projectId && pid) {
      try {
        const sessionRepo = getSessionRepository();
        const session = sessionRepo.createSession({
          projectId: this.projectId,
          pid,
          mode,
          maxIterations,
          maxRuntimeSeconds,
          costLimit,
          workScope,
          completionPromise: completionPromise || 'ALL_TASKS_COMPLETE',
        });
        this.sessionId = session.id;
        this.emitLog(`Session created: ${session.id}`, 'info');

        // Start heartbeat
        this.startHeartbeat();
      } catch (err) {
        this.emitLog(`Failed to create session: ${(err as Error).message}`, 'warning');
      }
    }

    this.status = {
      running: true,
      mode,
      iteration: 0,
      maxIterations: maxIterations || 0,
      workScope,
      startedAt: new Date(),
      pid,
    };

    this.emit('status', this.status);

    // Handle stdout
    this.process.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((l: string) => l.trim());
      lines.forEach((line: string) => {
        // Detect iteration markers
        const iterMatch = line.match(/LOOP\s+(\d+)/i);
        if (iterMatch) {
          const newIteration = parseInt(iterMatch[1], 10);
          this.status.iteration = newIteration;

          // Update session iteration in database
          if (this.sessionId) {
            try {
              const sessionRepo = getSessionRepository();
              sessionRepo.updateIteration(this.sessionId, newIteration);
            } catch {
              // Ignore errors updating iteration
            }
          }

          this.emit('status', this.status);
        }

        // Detect token usage (if loop.sh outputs it)
        const tokenMatch = line.match(/tokens:\s*(\d+)\s*input,?\s*(\d+)\s*output/i);
        if (tokenMatch && this.sessionId) {
          try {
            const sessionRepo = getSessionRepository();
            sessionRepo.updateTokenUsage(
              this.sessionId,
              parseInt(tokenMatch[1], 10),
              parseInt(tokenMatch[2], 10)
            );
          } catch {
            // Ignore errors updating tokens
          }
        }

        // Detect cost updates (if loop.sh outputs it)
        const costMatch = line.match(/cost:\s*\$?([\d.]+)/i);
        if (costMatch && this.sessionId) {
          try {
            const sessionRepo = getSessionRepository();
            sessionRepo.updateCost(this.sessionId, parseFloat(costMatch[1]));
          } catch {
            // Ignore errors updating cost
          }
        }

        this.emitLog(line, 'info');
      });
    });

    // Handle stderr
    this.process.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((l: string) => l.trim());
      lines.forEach((line: string) => {
        this.emitLog(line, 'error');
      });
    });

    // Handle process exit
    this.process.on('close', (code) => {
      this.emitLog(`Loop exited with code ${code}`, code === 0 ? 'success' : 'error');

      // Stop heartbeat
      this.stopHeartbeat();

      // Record execution history and mark session complete
      if (this.sessionId && this.projectId) {
        try {
          const sessionRepo = getSessionRepository();
          const historyRepo = getExecutionHistoryRepository();
          const session = sessionRepo.getSession(this.sessionId);

          if (session) {
            // Record in execution history
            historyRepo.recordExecution({
              projectId: this.projectId,
              sessionId: this.sessionId,
              mode: this.status.mode || 'build',
              iteration: this.status.iteration,
              startedAt: session.startedAt,
              endedAt: new Date().toISOString(),
              success: code === 0,
              exitReason: code === 0 ? 'completed' : 'error',
              tokensInput: session.tokensInputTotal,
              tokensOutput: session.tokensOutputTotal,
              costUsd: session.costSpent,
              errorMessage: code !== 0 ? `Process exited with code ${code}` : undefined,
            });

            // Mark session as completed
            sessionRepo.markSessionCompleted(this.sessionId, code === 0 ? 'completed' : 'error');
          }
        } catch (err) {
          this.emitLog(`Failed to record execution: ${(err as Error).message}`, 'warning');
        }
      }

      this.process = null;
      this.sessionId = null;
      this.status = {
        ...this.status,
        running: false,
        pid: undefined,
      };
      this.emit('status', this.status);
    });

    this.process.on('error', (err) => {
      this.emitLog(`Loop error: ${err.message}`, 'error');

      // Stop heartbeat
      this.stopHeartbeat();

      // Mark session as crashed
      if (this.sessionId) {
        try {
          const sessionRepo = getSessionRepository();
          sessionRepo.markSessionCrashed(this.sessionId);
        } catch {
          // Ignore errors
        }
      }

      this.process = null;
      this.sessionId = null;
      this.status = {
        ...this.status,
        running: false,
        pid: undefined,
      };
      this.emit('status', this.status);
    });
  }

  stop() {
    if (!this.process) {
      this.emitLog('No loop running', 'warning');
      return;
    }

    const pid = this.process.pid;
    this.emitLog('Stopping loop...', 'info');

    // Mark session as stopping
    if (this.sessionId) {
      try {
        const sessionRepo = getSessionRepository();
        sessionRepo.updateSessionState(this.sessionId, 'stopping');
      } catch {
        // Ignore errors
      }
    }

    const isWindows = process.platform === 'win32';

    if (isWindows && pid) {
      // On Windows, use taskkill to kill the process tree (includes child processes)
      // This is more reliable than signals for Git Bash processes
      exec(`taskkill /pid ${pid} /T /F`, (err: Error | null) => {
        if (err) {
          this.emitLog(`Failed to kill process tree: ${err.message}`, 'warning');
          // Fallback to regular kill
          if (this.process) {
            this.process.kill();
          }
        } else {
          this.emitLog('Process tree terminated', 'info');
        }
      });
    } else {
      // On Unix, send SIGINT for graceful shutdown
      this.process.kill('SIGINT');

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (this.process) {
          this.emitLog('Force killing loop...', 'warning');
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  /**
   * Pause the current session
   */
  pause(): void {
    if (this.sessionId) {
      try {
        const sessionRepo = getSessionRepository();
        sessionRepo.updateSessionState(this.sessionId, 'paused');
        this.emitLog('Session paused', 'info');
      } catch (err) {
        this.emitLog(`Failed to pause session: ${(err as Error).message}`, 'warning');
      }
    }
  }

  /**
   * Resume a paused session
   */
  resume(): void {
    if (this.sessionId) {
      try {
        const sessionRepo = getSessionRepository();
        sessionRepo.updateSessionState(this.sessionId, 'running');
        this.emitLog('Session resumed', 'info');
      } catch (err) {
        this.emitLog(`Failed to resume session: ${(err as Error).message}`, 'warning');
      }
    }
  }

  /**
   * Start the heartbeat interval
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.sessionId) {
        try {
          const sessionRepo = getSessionRepository();
          sessionRepo.updateHeartbeat(this.sessionId);
        } catch {
          // Ignore heartbeat errors
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop the heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private emitLog(content: string, type: LogEntry['type']) {
    const entry: LogEntry = {
      id: `loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      content,
      type,
    };
    this.emit('log', entry);
  }
}

import { EventEmitter } from 'events';
import { spawn, ChildProcess, exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

export type ReviewMode = 'review' | 'review-quick' | 'review-spec';

interface ReviewGeneratorStatus {
  generating: boolean;
  mode: ReviewMode | null;
  startedAt: Date | null;
}

const PROMPT_FILES: Record<ReviewMode, string> = {
  review: 'PROMPT_review.md',
  'review-quick': 'PROMPT_review.md',  // Uses same prompt with different instructions
  'review-spec': 'PROMPT_review.md',   // Uses same prompt with spec focus
};

export class ReviewGenerator extends EventEmitter {
  private projectPath: string;
  private ralphPath: string;
  private process: ChildProcess | null = null;
  private status: ReviewGeneratorStatus = {
    generating: false,
    mode: null,
    startedAt: null,
  };
  private accumulatedOutput: string = '';
  private accumulatedReport: string = '';

  constructor(projectPath: string, ralphPath?: string) {
    super();
    this.projectPath = projectPath;
    this.ralphPath = ralphPath || projectPath;
  }

  getStatus(): ReviewGeneratorStatus {
    return { ...this.status };
  }

  async generateReview(options: {
    mode: ReviewMode;
    focusArea?: string;     // e.g., "Feature Set 5" or "authentication"
    specFile?: string;      // For review-spec mode: specific spec to verify
  }): Promise<void> {
    if (this.status.generating) {
      throw new Error('Review generation already in progress');
    }

    this.status = {
      generating: true,
      mode: options.mode,
      startedAt: new Date(),
    };
    this.accumulatedOutput = '';
    this.accumulatedReport = '';
    this.emit('status', this.status);

    try {
      // Read the base prompt template
      const promptFile = PROMPT_FILES[options.mode];
      let basePrompt: string;

      try {
        // Try ralphPath first (where prompt files are located)
        basePrompt = await fs.readFile(
          path.join(this.ralphPath, promptFile),
          'utf-8'
        );
      } catch {
        try {
          // Fallback to projectPath
          basePrompt = await fs.readFile(
            path.join(this.projectPath, promptFile),
            'utf-8'
          );
        } catch {
          // Use default prompt if file doesn't exist
          basePrompt = this.getDefaultPrompt(options.mode);
        }
      }

      // Build mode-specific prompt modifications
      let fullPrompt = basePrompt;

      if (options.mode === 'review-quick') {
        fullPrompt = this.getQuickScanPrompt();
      } else if (options.mode === 'review-spec' && options.specFile) {
        fullPrompt = basePrompt.replace(
          'For each spec in `specs/*`:',
          `Focus ONLY on spec file: specs/${options.specFile}\nFor this specific spec:`
        );
      }

      // Add focus area if specified
      if (options.focusArea) {
        fullPrompt = `FOCUS AREA: ${options.focusArea}\n\nOnly analyze code and tasks related to this focus area.\n\n${fullPrompt}`;
      }

      // Build CLI arguments - make --model conditional for cross-platform compatibility
      const claudeArgs = [
        '-p',
        '--output-format=stream-json',
        '--verbose',
        '--dangerously-skip-permissions'
      ];

      // Add --model flag on Windows (confirmed working) or if explicitly enabled
      const isWindows = process.platform === 'win32';
      if (isWindows || process.env.CLAUDE_MODEL_FLAG === 'true') {
        claudeArgs.push('--model', 'opus');
      }

      // Spawn Claude CLI
      console.log(`Starting review generation in directory: ${this.projectPath}`);
      this.process = spawn('claude', claudeArgs, {
        cwd: this.projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,  // Required for Windows to find claude.cmd
      });

      // Write prompt to stdin
      this.process.stdin?.write(fullPrompt);
      this.process.stdin?.end();

      // Parse streaming JSON output
      if (this.process.stdout) {
        const rl = readline.createInterface({
          input: this.process.stdout,
          crlfDelay: Infinity,
        });

        rl.on('line', (line) => {
          this.handleOutputLine(line);
        });
      }

      // Handle stderr
      this.process.stderr?.on('data', (data) => {
        const text = data.toString();
        this.emit('error', text);
      });

      // Handle process close
      this.process.on('close', (code) => {
        this.status = {
          generating: false,
          mode: null,
          startedAt: null,
        };
        this.process = null;

        if (code === 0) {
          this.emit('complete', {
            report: this.accumulatedReport,
            output: this.accumulatedOutput,
          });
        } else {
          this.emit('error', `Process exited with code ${code}`);
        }
        this.emit('status', this.status);
      });

      // Handle process error
      this.process.on('error', (err) => {
        this.status = {
          generating: false,
          mode: null,
          startedAt: null,
        };
        this.process = null;
        this.emit('error', err.message);
        this.emit('status', this.status);
      });

    } catch (err) {
      this.status = {
        generating: false,
        mode: null,
        startedAt: null,
      };
      this.emit('error', err instanceof Error ? err.message : 'Unknown error');
      this.emit('status', this.status);
    }
  }

  private handleOutputLine(line: string): void {
    try {
      const json = JSON.parse(line);

      // Handle different message types from stream-json format
      if (json.type === 'text' || json.type === 'content_block_delta') {
        const text = json.text || json.delta?.text || '';
        if (text) {
          this.accumulatedOutput += text;
          this.accumulatedReport += text;
          this.emit('output', text);
        }
      } else if (json.type === 'message_start' || json.type === 'content_block_start') {
        // Message starting, could emit status update
      } else if (json.type === 'message_stop' || json.type === 'content_block_stop') {
        // Message complete
      } else if (json.type === 'assistant') {
        // Assistant response - extract text content
        if (json.message?.content) {
          for (const block of json.message.content) {
            if (block.type === 'text') {
              this.accumulatedOutput += block.text;
              this.accumulatedReport += block.text;
              this.emit('output', block.text);
            }
          }
        }
      }
    } catch {
      // Non-JSON line - might be verbose output or logs
      if (line.trim()) {
        this.accumulatedOutput += line + '\n';
        this.emit('log', line);
      }
    }
  }

  cancel(): void {
    if (this.process) {
      const pid = this.process.pid;
      const isWindows = process.platform === 'win32';

      if (isWindows && pid) {
        // On Windows, use taskkill to kill the process tree
        exec(`taskkill /pid ${pid} /T /F`, () => {
          // Ignore errors, process may already be dead
        });
      } else {
        this.process.kill('SIGTERM');
      }

      this.status = {
        generating: false,
        mode: null,
        startedAt: null,
      };
      this.emit('cancelled');
      this.emit('status', this.status);
    }
  }

  private getQuickScanPrompt(): string {
    return `# Quick Scan Mode

Perform a fast scan of the codebase for technical debt indicators.

Search the entire codebase for:
- TODO comments
- FIXME comments
- HACK comments
- XXX comments
- Empty function bodies or throw-not-implemented patterns
- Skipped tests (@skip, .skip, xit, xdescribe)
- Console.log statements that should be removed
- Commented-out code blocks

OUTPUT: Create @REVIEW_REPORT.md with ONLY the Technical Debt section:

\`\`\`markdown
# Quick Scan Report

**Generated**: [ISO timestamp]
**Mode**: Quick Scan

## Technical Debt Found

| Severity | File | Line | Type | Issue |
|----------|------|------|------|-------|
| ... | ... | ... | TODO/FIXME/etc. | ... |

## Summary

- Total issues found: X
- High severity: Y
- Medium severity: Z
- Low severity: W
\`\`\`

IMPORTANT: Quick scan only. Do NOT analyze specs or verify task completion.
Focus ONLY on finding technical debt markers in the code.`;
  }

  private getDefaultPrompt(mode: ReviewMode): string {
    if (mode === 'review-quick') {
      return this.getQuickScanPrompt();
    }

    // Default full review prompt
    return `0a. Study \`specs/*\` to learn CLAIMED functionality.
0b. Study @IMPLEMENTATION_PLAN.md to understand CLAIMED completion status.
0c. Study @AGENTS.md for build/test commands.
0d. For reference, the application source code is in \`src/*\`.

1. VERIFICATION PHASE: For each item marked complete in @IMPLEMENTATION_PLAN.md, search \`src/*\` and verify:
   - Does the implementation exist?
   - Is it a placeholder/stub or real implementation?
   - Does it match the acceptance criteria in specs?
   - Are there TODO/FIXME comments suggesting incompleteness?

2. DISCOVERY PHASE: Search the entire codebase for:
   - TODO, FIXME, HACK, XXX comments
   - Empty function bodies or throw-not-implemented patterns
   - Skipped tests (@skip, .skip, xit, xdescribe)
   - Dead code (unused exports, unreachable branches)

3. OUTPUT: Create @REVIEW_REPORT.md with findings.

IMPORTANT: Review only. Do NOT fix anything.`;
  }
}

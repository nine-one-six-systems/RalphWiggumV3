/**
 * ReviewRunner - LLM-as-Judge for quality gates
 *
 * Uses Claude CLI to evaluate artifacts against criteria.
 * Supports both text and image (screenshot) evaluation.
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess, exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

export interface ReviewConfig {
  criteria: string;      // What to evaluate (behavioral, observable)
  artifact: string;      // Text content OR image path (.png, .jpg, .jpeg)
  artifactPath?: string; // Optional path context for image artifacts
}

export interface ReviewResult {
  pass: boolean;
  feedback?: string;     // Only present when pass=false
  criteria: string;
  reviewedAt: string;
}

interface ReviewRunnerStatus {
  running: boolean;
  startedAt: Date | null;
}

export class ReviewRunner extends EventEmitter {
  private projectPath: string;
  private process: ChildProcess | null = null;
  private status: ReviewRunnerStatus = {
    running: false,
    startedAt: null,
  };
  private accumulatedOutput: string = '';

  constructor(projectPath: string) {
    super();
    this.projectPath = projectPath;
  }

  getStatus(): ReviewRunnerStatus {
    return { ...this.status };
  }

  /**
   * Run a review using Claude CLI
   */
  async runReview(config: ReviewConfig): Promise<void> {
    if (this.status.running) {
      throw new Error('Review already in progress');
    }

    this.status = {
      running: true,
      startedAt: new Date(),
    };
    this.accumulatedOutput = '';
    this.emit('status', this.status);

    try {
      const { criteria, artifact, artifactPath } = config;

      // Detect if artifact is an image path
      const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(artifact);

      // Build the review prompt
      let prompt: string;
      if (isImage) {
        // For images, read the file and include it as base64 or just reference the path
        // Claude CLI can handle image paths with the --image flag, but for simplicity
        // we'll describe what we want evaluated
        const fullImagePath = artifactPath
          ? path.resolve(this.projectPath, artifactPath, artifact)
          : path.resolve(this.projectPath, artifact);

        // Check if image exists
        try {
          await fs.access(fullImagePath);
        } catch {
          throw new Error(`Image not found: ${fullImagePath}`);
        }

        prompt = `You are a quality reviewer evaluating a visual artifact.

CRITERIA: ${criteria}

IMPORTANT: You must return ONLY a valid JSON object with exactly this structure:
{"pass": true} or {"pass": false, "feedback": "specific actionable feedback"}

Rules:
- If the criteria is met, return {"pass": true}
- If not met, return {"pass": false, "feedback": "explanation of what needs improvement"}
- Return ONLY the JSON, no other text before or after

The image to evaluate is located at: ${fullImagePath}

Evaluate and respond with JSON only.`;
      } else {
        // Text artifact
        prompt = `You are a quality reviewer evaluating text content.

CRITERIA: ${criteria}

ARTIFACT TO REVIEW:
---
${artifact}
---

IMPORTANT: You must return ONLY a valid JSON object with exactly this structure:
{"pass": true} or {"pass": false, "feedback": "specific actionable feedback"}

Rules:
- If the criteria is met, return {"pass": true}
- If not met, return {"pass": false, "feedback": "explanation of what needs improvement"}
- Return ONLY the JSON, no other text before or after

Evaluate and respond with JSON only.`;
      }

      // Build CLI arguments
      const claudeArgs = [
        '-p',
        '--output-format=stream-json',
        '--dangerously-skip-permissions'
      ];

      // Add --model flag on Windows or if explicitly enabled
      // Use haiku for fast reviews (can change to opus for complex reviews)
      const isWindows = process.platform === 'win32';
      if (isWindows || process.env.CLAUDE_MODEL_FLAG === 'true') {
        claudeArgs.push('--model', 'haiku');
      }

      // Spawn Claude CLI
      console.log(`Starting review in directory: ${this.projectPath}`);
      console.log(`Review criteria: ${criteria.substring(0, 100)}...`);

      this.process = spawn('claude', claudeArgs, {
        cwd: this.projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,  // Required for Windows
      });

      // Write prompt to stdin
      this.process.stdin?.write(prompt);
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
        console.error('Review stderr:', text);
      });

      // Handle process close
      this.process.on('close', (code) => {
        this.status = {
          running: false,
          startedAt: null,
        };
        this.process = null;

        if (code === 0) {
          // Parse the result from accumulated output
          const result = this.parseReviewResult(this.accumulatedOutput, criteria);
          this.emit('complete', result);
        } else {
          this.emit('error', `Review process exited with code ${code}`);
        }
        this.emit('status', this.status);
      });

      // Handle process error
      this.process.on('error', (err) => {
        this.status = {
          running: false,
          startedAt: null,
        };
        this.process = null;
        this.emit('error', err.message);
        this.emit('status', this.status);
      });

    } catch (err) {
      this.status = {
        running: false,
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
          this.emit('output', text);
        }
      } else if (json.type === 'assistant') {
        // Assistant response - extract text content
        if (json.message?.content) {
          for (const block of json.message.content) {
            if (block.type === 'text') {
              this.accumulatedOutput += block.text;
              this.emit('output', block.text);
            }
          }
        }
      }
    } catch {
      // Non-JSON line - accumulate anyway
      if (line.trim()) {
        this.accumulatedOutput += line + '\n';
      }
    }
  }

  private parseReviewResult(output: string, criteria: string): ReviewResult {
    // Try to extract JSON from the output
    const jsonMatch = output.match(/\{[^{}]*"pass"\s*:\s*(true|false)[^{}]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          pass: parsed.pass === true,
          feedback: parsed.feedback || undefined,
          criteria,
          reviewedAt: new Date().toISOString(),
        };
      } catch {
        // Fall through to default
      }
    }

    // If we can't parse JSON, check for common patterns
    if (output.toLowerCase().includes('"pass": true') ||
        output.toLowerCase().includes('"pass":true')) {
      return {
        pass: true,
        criteria,
        reviewedAt: new Date().toISOString(),
      };
    }

    // Default to fail if we can't determine
    return {
      pass: false,
      feedback: 'Could not parse review result. Raw output: ' + output.substring(0, 500),
      criteria,
      reviewedAt: new Date().toISOString(),
    };
  }

  cancel(): void {
    if (this.process) {
      const pid = this.process.pid;
      const isWindows = process.platform === 'win32';

      if (isWindows && pid) {
        exec(`taskkill /pid ${pid} /T /F`, () => {
          // Ignore errors
        });
      } else {
        this.process.kill('SIGTERM');
      }

      this.status = {
        running: false,
        startedAt: null,
      };
      this.emit('cancelled');
      this.emit('status', this.status);
    }
  }
}

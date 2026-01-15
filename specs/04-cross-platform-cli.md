# Cross-Platform Claude CLI Compatibility

## User Story

**As a** developer on macOS or Linux
**I want** Ralph to work without "--model" flag errors
**So that** I can use Ralph Wiggum on my preferred platform

## Problem Statement

The `--model opus` flag works on Windows but causes an error on macOS:
```
Error: The Claude CLI doesn't support --model
```

Different Claude CLI versions or platform builds may have different flag support.

## Acceptance Criteria

### AC-1: Platform Detection
- [ ] Windows uses `--model opus` flag (confirmed working)
- [ ] macOS omits flag by default
- [ ] Linux omits flag by default

### AC-2: Environment Variable Override
- [ ] `CLAUDE_MODEL_FLAG=true` forces flag on any platform
- [ ] Useful for macOS/Linux users with newer CLI versions

### AC-3: Consistent Behavior
- [ ] PRD generation works on all platforms
- [ ] Plan generation works on all platforms
- [ ] Build loop (loop.sh) works on all platforms

## Implementation Details

### Files to Modify

| File | Changes |
|------|---------|
| `dashboard/server/planGenerator.ts` | Conditional --model flag |
| `dashboard/server/prdGenerator.ts` | Conditional --model flag |
| `loop.sh` | Conditional --model flag |

### planGenerator.ts / prdGenerator.ts

```typescript
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

this.process = spawn('claude', claudeArgs, {
  cwd: this.projectPath,
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
});
```

### loop.sh

```bash
# Detect if --model flag is supported (Windows or explicitly enabled)
MODEL_FLAG=""
if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "cygwin"* ]] || [[ "$OSTYPE" == "mingw"* ]] || [[ "$CLAUDE_MODEL_FLAG" == "true" ]]; then
  MODEL_FLAG="--model opus"
fi

# Use $MODEL_FLAG in the claude command:
cat "$PROMPT_FILE_PATH" | claude -p \
    --dangerously-skip-permissions \
    --output-format=stream-json \
    $MODEL_FLAG \
    --verbose \
    2>&1 | tee -a "$OUTPUT_LOG"
```

## Behavior Summary

| Platform | Default Behavior | With CLAUDE_MODEL_FLAG=true |
|----------|------------------|----------------------------|
| Windows | Uses --model opus | Uses --model opus |
| macOS | Omits --model flag | Uses --model opus |
| Linux | Omits --model flag | Uses --model opus |

## Required Tests

1. **Windows Test**
   - Run PRD generation → succeeds with model flag
   - Run Plan generation → succeeds with model flag
   - Run loop.sh → succeeds with model flag

2. **macOS Test (or simulated)**
   - Run PRD generation → succeeds without model flag
   - Run Plan generation → succeeds without model flag

3. **Override Test**
   - Set `CLAUDE_MODEL_FLAG=true`
   - Run on non-Windows → uses model flag

## Environment Variable Usage

```bash
# macOS/Linux users with newer Claude CLI can opt-in:
export CLAUDE_MODEL_FLAG=true
npm run dev

# Or inline:
CLAUDE_MODEL_FLAG=true npm run dev
```

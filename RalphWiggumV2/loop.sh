#!/bin/bash
set -euo pipefail

# Usage:
#   ./loop.sh [build] [max_iterations]       # Build mode on current branch
#   ./loop.sh plan [max_iterations]          # Standard planning mode
#   ./loop.sh plan-slc [max_iterations]      # SLC-oriented planning mode
#   ./loop.sh plan-work "work description"   # Work-scoped planning on current branch
# Examples:
#   ./loop.sh                               # Build mode, unlimited
#   ./loop.sh 20                            # Build mode, max 20 iterations
#   ./loop.sh plan 5                        # Standard planning, max 5 iterations
#   ./loop.sh plan-slc                      # SLC planning, unlimited
#   ./loop.sh plan-work "user auth"         # Scoped planning for work branch

# Support running from a different directory (embedded mode)
# RALPH_DIR points to RalphWiggumV2's directory for prompt files
# When not set, defaults to the script's own directory
RALPH_DIR="${RALPH_DIR:-$(dirname "$0")}"

# Parse arguments
MODE="build"
PROMPT_FILE="PROMPT_build.md"
MAX_ITERATIONS=0
WORK_SCOPE=""

if [ "$1" = "plan" ]; then
    # Standard planning mode
    MODE="plan"
    PROMPT_FILE="PROMPT_plan.md"
    MAX_ITERATIONS=${2:-0}
elif [ "$1" = "plan-slc" ]; then
    # SLC-oriented planning mode
    MODE="plan-slc"
    PROMPT_FILE="PROMPT_plan_slc.md"
    MAX_ITERATIONS=${2:-0}
elif [ "$1" = "plan-work" ]; then
    # Work-scoped planning mode
    if [ -z "${2:-}" ]; then
        echo "Error: plan-work requires a work description"
        echo "Usage: ./loop.sh plan-work \"description of the work\""
        exit 1
    fi
    MODE="plan-work"
    WORK_SCOPE="$2"
    PROMPT_FILE="PROMPT_plan_work.md"
    MAX_ITERATIONS=${3:-5}  # Default 5 for work planning
elif [[ "${1:-}" =~ ^[0-9]+$ ]]; then
    # Build mode with max iterations
    MAX_ITERATIONS=$1
elif [ "${1:-}" = "build" ]; then
    # Explicit build mode
    MODE="build"
    PROMPT_FILE="PROMPT_build.md"
    MAX_ITERATIONS=${2:-0}
else
    # Build mode, unlimited (no arguments or invalid input)
    MAX_ITERATIONS=0
fi

ITERATION=0
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")

# Validate branch for plan-work mode
if [ "$MODE" = "plan-work" ]; then
    if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
        echo "Error: plan-work should be run on a work branch, not main/master"
        echo "Create a work branch first: git checkout -b ralph/your-work"
        exit 1
    fi

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Mode:    plan-work"
    echo "Branch:  $CURRENT_BRANCH"
    echo "Work:    $WORK_SCOPE"
    echo "Prompt:  $PROMPT_FILE"
    echo "Plan:    Will create scoped IMPLEMENTATION_PLAN.md"
    [ "$MAX_ITERATIONS" -gt 0 ] && echo "Max:     $MAX_ITERATIONS iterations"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Warn about uncommitted changes to IMPLEMENTATION_PLAN.md
    if [ -f "IMPLEMENTATION_PLAN.md" ] && ! git diff --quiet IMPLEMENTATION_PLAN.md 2>/dev/null; then
        echo "Warning: IMPLEMENTATION_PLAN.md has uncommitted changes that will be overwritten"
        read -p "Continue? [y/N] " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
    fi

    # Export work description for PROMPT_plan_work.md
    export WORK_SCOPE="$WORK_SCOPE"
else
    # Normal plan/build mode
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Mode:   $MODE"
    echo "Branch: $CURRENT_BRANCH"
    echo "Prompt: $PROMPT_FILE"
    echo "Plan:   IMPLEMENTATION_PLAN.md"
    [ $MAX_ITERATIONS -gt 0 ] && echo "Max:    $MAX_ITERATIONS iterations"
    # Show embedded mode info if running from different directory
    if [ "$RALPH_DIR" != "$(pwd)" ] && [ "$RALPH_DIR" != "." ]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Embedded mode:"
        echo "  Target: $(pwd)"
        echo "  Ralph:  $RALPH_DIR"
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

# Build full path to prompt file using RALPH_DIR
PROMPT_FILE_PATH="$RALPH_DIR/$PROMPT_FILE"

# Verify prompt file exists
if [ ! -f "$PROMPT_FILE_PATH" ]; then
    echo "Error: $PROMPT_FILE_PATH not found"
    exit 1
fi

# Verify claude CLI is available
if ! command -v claude &> /dev/null; then
    echo "Error: claude CLI not found. Install Claude Code first."
    exit 1
fi

# Detect if --model flag is supported (Windows/MSYS or explicitly enabled)
# macOS may have older CLI versions that don't support this flag
MODEL_FLAG=""
if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "cygwin"* ]] || [[ "$OSTYPE" == "mingw"* ]] || [[ "${CLAUDE_MODEL_FLAG:-}" == "true" ]]; then
    MODEL_FLAG="--model opus"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Health Monitoring Functions (based on snarktank/ralph & ghuntley/how-to-ralph)
# ═══════════════════════════════════════════════════════════════════════════════

HEALTH_LOG="ralph-health.log"
CONSECUTIVE_FAILURES=0
LAST_TASK_COUNT=0
NO_PROGRESS_ITERATIONS=0

# Check if AGENTS.md has real validation commands (not placeholders)
check_agents_config() {
    local agents_file="AGENTS.md"

    if [ ! -f "$agents_file" ]; then
        echo "⚠️  Warning: AGENTS.md not found"
        echo "   Create AGENTS.md with validation commands for backpressure"
        return 1
    fi

    # Check for placeholder patterns
    if grep -q '\[your.*command\]' "$agents_file" 2>/dev/null; then
        echo "⚠️  Warning: AGENTS.md contains placeholder commands"
        echo "   Replace [your ...] placeholders with real commands:"
        echo "   - Typecheck: npx tsc --noEmit"
        echo "   - Lint: npm run lint"
        echo "   - Tests: npm test"
        echo ""
        read -p "Continue anyway? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Exiting. Configure AGENTS.md first."
            exit 1
        fi
        return 1
    fi

    # Check for validation section
    if ! grep -q "## Validation" "$agents_file" 2>/dev/null; then
        echo "⚠️  Warning: AGENTS.md missing ## Validation section"
        return 1
    fi

    echo "✓ AGENTS.md validation commands configured"
    return 0
}

# Parse last iteration's output for error patterns
check_iteration_health() {
    local log_file="${1:-ralph.log}"
    local error_count=0

    if [ ! -f "$log_file" ]; then
        return 0
    fi

    # Get last 500 lines of log for this iteration's analysis
    local recent_output
    recent_output=$(tail -500 "$log_file" 2>/dev/null || cat "$log_file")

    # Count error patterns
    local ts_errors build_errors test_failures general_errors

    # TypeScript errors (TS followed by digits)
    ts_errors=$(echo "$recent_output" | grep -cE "TS[0-9]+:" 2>/dev/null || echo 0)

    # Build/compile errors
    build_errors=$(echo "$recent_output" | grep -ciE "(error:|Error:|ERROR|ENOENT|Cannot find|Module not found)" 2>/dev/null || echo 0)

    # Test failures
    test_failures=$(echo "$recent_output" | grep -ciE "(FAIL|failed|✗|✖)" 2>/dev/null || echo 0)

    # General errors (excluding false positives)
    general_errors=$(echo "$recent_output" | grep -ciE "^error" 2>/dev/null || echo 0)

    error_count=$((ts_errors + build_errors + test_failures + general_errors))

    if [ "$error_count" -gt 5 ]; then
        echo "⚠️  High error count detected: ~$error_count errors"
        if [ "$ts_errors" -gt 0 ]; then
            echo "   - TypeScript errors: $ts_errors"
        fi
        if [ "$test_failures" -gt 0 ]; then
            echo "   - Test failures: $test_failures"
        fi
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        return 1
    else
        CONSECUTIVE_FAILURES=0
        return 0
    fi
}

# Count completed tasks in IMPLEMENTATION_PLAN.md
count_completed_tasks() {
    local plan_file="IMPLEMENTATION_PLAN.md"

    if [ ! -f "$plan_file" ]; then
        echo 0
        return
    fi

    # Count checked boxes [x] and completed emoji markers
    local count
    count=$(grep -cE "^\s*-\s*\[x\]|^\s*-\s*\[X\]" "$plan_file" 2>/dev/null || echo 0)
    echo "$count"
}

# Count incomplete tasks in IMPLEMENTATION_PLAN.md
count_incomplete_tasks() {
    local plan_file="IMPLEMENTATION_PLAN.md"

    if [ ! -f "$plan_file" ]; then
        echo 0
        return
    fi

    # Count unchecked boxes [ ]
    local count
    count=$(grep -cE "^\s*-\s*\[ \]" "$plan_file" 2>/dev/null || echo 0)
    echo "$count"
}

# Check if truly all tasks are complete
all_tasks_complete() {
    local incomplete
    incomplete=$(count_incomplete_tasks)

    if [ "$incomplete" -eq 0 ]; then
        return 0  # True - all complete
    else
        return 1  # False - tasks remain
    fi
}

# Detect stuck loops (no progress over multiple iterations)
detect_stuck_loop() {
    local current_tasks
    current_tasks=$(count_completed_tasks)

    if [ "$current_tasks" -eq "$LAST_TASK_COUNT" ]; then
        NO_PROGRESS_ITERATIONS=$((NO_PROGRESS_ITERATIONS + 1))
    else
        NO_PROGRESS_ITERATIONS=0
        LAST_TASK_COUNT=$current_tasks
    fi

    # Warning at 3 iterations with no progress
    if [ "$NO_PROGRESS_ITERATIONS" -ge 3 ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "⚠️  STUCK LOOP DETECTED"
        echo "   No task completions in $NO_PROGRESS_ITERATIONS iterations"
        echo "   Completed tasks: $current_tasks"
        echo ""
        echo "   Suggestions:"
        echo "   - Check ralph.log for repeating errors"
        echo "   - Consider regenerating the plan: ./loop.sh plan"
        echo "   - Review IMPLEMENTATION_PLAN.md for unclear tasks"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    fi

    # Critical at 5 consecutive failures
    if [ "$CONSECUTIVE_FAILURES" -ge 5 ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🛑 CRITICAL: 5+ consecutive failures"
        echo "   Consider pausing to investigate"
        echo ""
        read -p "Continue? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Paused. Review ralph.log and IMPLEMENTATION_PLAN.md"
            exit 1
        fi
        CONSECUTIVE_FAILURES=0  # Reset after user acknowledgment
    fi
}

# Log health metrics for this iteration
log_health_metrics() {
    local iteration=$1
    local duration=$2
    local start_tasks=$3
    local end_tasks=$4

    local timestamp
    timestamp=$(date -Iseconds 2>/dev/null || date "+%Y-%m-%dT%H:%M:%S")

    local tasks_completed=$((end_tasks - start_tasks))

    # Append to health log
    cat >> "$HEALTH_LOG" << EOF
---
[$timestamp] Iteration $iteration
- Duration: ${duration}s
- Tasks at start: $start_tasks
- Tasks at end: $end_tasks
- Tasks completed: $tasks_completed
- Consecutive failures: $CONSECUTIVE_FAILURES
- No-progress streak: $NO_PROGRESS_ITERATIONS
---
EOF
}

# ═══════════════════════════════════════════════════════════════════════════════
# Pre-flight Checks
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "Running pre-flight checks..."
check_agents_config
LAST_TASK_COUNT=$(count_completed_tasks)
REMAINING_TASKS=$(count_incomplete_tasks)
echo "✓ Starting with $LAST_TASK_COUNT completed tasks, $REMAINING_TASKS remaining"
echo ""

# Check if already complete
if [ "$REMAINING_TASKS" -eq 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ All tasks already complete! Nothing to do."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
fi

# Main loop
while true; do
    if [ $MAX_ITERATIONS -gt 0 ] && [ $ITERATION -ge $MAX_ITERATIONS ]; then
        echo "Reached max iterations: $MAX_ITERATIONS"

        if [ "$MODE" = "plan-work" ]; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "Scoped plan created: $WORK_SCOPE"
            echo "To build, run:"
            echo "  ./loop.sh 20"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        fi
        break
    fi

    # Track timing and task count for health metrics
    ITERATION_START=$(date +%s 2>/dev/null || echo 0)
    TASKS_AT_START=$(count_completed_tasks)

    # Run Ralph iteration with selected prompt
    # -p: Headless mode (non-interactive, reads from stdin)
    # --dangerously-skip-permissions: Auto-approve all tool calls (YOLO mode)
    # --output-format=stream-json: Structured output for logging/monitoring
    # --model opus: Primary agent uses Opus for complex reasoning (task selection, prioritization)
    #               Can use 'sonnet' in build mode for speed if plan is clear and tasks well-defined
    # --verbose: Detailed execution logging
    OUTPUT_LOG="ralph.log"

    # For plan-work mode, substitute ${WORK_SCOPE} in prompt before piping
    if [ "$MODE" = "plan-work" ]; then
        if command -v envsubst &> /dev/null; then
            envsubst < "$PROMPT_FILE_PATH" | claude -p \
                --dangerously-skip-permissions \
                --output-format=stream-json \
                $MODEL_FLAG \
                --verbose \
                2>&1 | tee -a "$OUTPUT_LOG"
        else
            # Fallback: use sed if envsubst not available
            sed "s|\${WORK_SCOPE}|$WORK_SCOPE|g" "$PROMPT_FILE_PATH" | claude -p \
                --dangerously-skip-permissions \
                --output-format=stream-json \
                $MODEL_FLAG \
                --verbose \
                2>&1 | tee -a "$OUTPUT_LOG"
        fi
    else
        cat "$PROMPT_FILE_PATH" | claude -p \
            --dangerously-skip-permissions \
            --output-format=stream-json \
            $MODEL_FLAG \
            --verbose \
            2>&1 | tee -a "$OUTPUT_LOG"
    fi

    # ═══════════════════════════════════════════════════════════════════════════
    # Post-iteration health checks
    # ═══════════════════════════════════════════════════════════════════════════
    ITERATION_END=$(date +%s 2>/dev/null || echo 0)
    ITERATION_DURATION=$((ITERATION_END - ITERATION_START))
    TASKS_AT_END=$(count_completed_tasks)

    # Run health checks
    check_iteration_health "$OUTPUT_LOG"
    detect_stuck_loop

    # Log metrics
    log_health_metrics "$ITERATION" "$ITERATION_DURATION" "$TASKS_AT_START" "$TASKS_AT_END"

    # ═══════════════════════════════════════════════════════════════════════════
    # Optional post-task review (LLM-as-Judge quality gate)
    # Set ENABLE_REVIEW=true to enable review prompts after task completion
    # ═══════════════════════════════════════════════════════════════════════════
    TASKS_COMPLETED_THIS_ITERATION=$((TASKS_AT_END - TASKS_AT_START))
    if [ "${ENABLE_REVIEW:-false}" = "true" ] && [ "$TASKS_COMPLETED_THIS_ITERATION" -gt 0 ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "📋 Post-task Review"
        echo "   Tasks completed this iteration: $TASKS_COMPLETED_THIS_ITERATION"
        echo ""
        echo "   Review can be run via the dashboard ReviewPanel"
        echo "   or using src/lib/llm-review.ts patterns"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Optional: Run review script if REVIEW_SCRIPT is set
        if [ -n "${REVIEW_SCRIPT:-}" ] && [ -f "$REVIEW_SCRIPT" ]; then
            echo "Running review script: $REVIEW_SCRIPT"
            bash "$REVIEW_SCRIPT" "$OUTPUT_LOG" || true
        fi
    fi

    # Check for completion - verify BOTH signal AND actual task counts
    INCOMPLETE_TASKS=$(count_incomplete_tasks)
    COMPLETED_TASKS=$(count_completed_tasks)

    if grep -q "ALL_TASKS_COMPLETE" "$OUTPUT_LOG" 2>/dev/null; then
        if [ "$INCOMPLETE_TASKS" -eq 0 ]; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "✅ Implementation complete!"
            echo "   Completed: $COMPLETED_TASKS tasks"
            echo "   Remaining: 0 tasks"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            break
        else
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "⚠️  Premature completion signal detected!"
            echo "   Claude said ALL_TASKS_COMPLETE but:"
            echo "   - Completed: $COMPLETED_TASKS tasks"
            echo "   - Remaining: $INCOMPLETE_TASKS tasks"
            echo "   Continuing to next iteration..."
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            # Clear the log to avoid re-detecting the premature signal
            > "$OUTPUT_LOG"
        fi
    fi

    # Also check if all tasks are done even without signal
    if all_tasks_complete; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "✅ All tasks verified complete!"
        echo "   Completed: $COMPLETED_TASKS tasks"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        break
    fi

    # Push to current branch
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        git push origin "$CURRENT_BRANCH" 2>/dev/null || {
            echo "Failed to push. Creating remote branch..."
            git push -u origin "$CURRENT_BRANCH" 2>/dev/null || true
        }
    fi

    ITERATION=$((ITERATION + 1))
    echo -e "\n\n======================== LOOP $ITERATION ========================\n"
done

if [ $ITERATION -eq $MAX_ITERATIONS ] && [ $MAX_ITERATIONS -gt 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  Reached max iterations: $MAX_ITERATIONS"
    echo "Check IMPLEMENTATION_PLAN.md for status"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
elif [ $ITERATION -gt 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Completed after $ITERATION iterations"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

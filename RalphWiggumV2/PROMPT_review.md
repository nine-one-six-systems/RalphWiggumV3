0a. Study `specs/*` with up to 500 parallel Sonnet subagents to learn CLAIMED functionality.
0b. Study @IMPLEMENTATION_PLAN.md to understand CLAIMED completion status.
0c. Study @AGENTS.md for build/test commands.
0d. For reference, the application source code is in `src/*`.

1. VERIFICATION PHASE: For each item marked complete in @IMPLEMENTATION_PLAN.md, use up to 500 Sonnet subagents to search `src/*` and verify:
   - Does the implementation exist?
   - Is it a placeholder/stub or real implementation?
   - Does it match the acceptance criteria in specs?
   - Are there TODO/FIXME comments suggesting incompleteness?

2. DISCOVERY PHASE: Search the entire codebase for:
   - TODO, FIXME, HACK, XXX comments
   - Empty function bodies or throw-not-implemented patterns
   - Skipped tests (@skip, .skip, xit, xdescribe)
   - Dead code (unused exports, unreachable branches)
   - Missing error handling in critical paths

3. SPEC COMPLIANCE: For each spec in `specs/*`:
   - List acceptance criteria
   - Check if tests exist for each criterion
   - Verify tests pass (run if possible using commands from @AGENTS.md)
   - Flag any criteria without coverage

4. OUTPUT: Create/update @REVIEW_REPORT.md with the following structure:

```markdown
# Review Report

**Generated**: [ISO timestamp]
**Mode**: [Full Review | Quick Scan | Spec Focus]
**Duration**: [X iterations]

## Executive Summary

| Metric | Count |
|--------|-------|
| Tasks claimed complete | X |
| Actually verified complete | Y |
| Incomplete/broken | Z |
| Technical debt items | N |
| Missing test coverage | M |

## Health Score: Y/X (percentage%)

---

## Verified Complete

- [x] Task N: [description] - Evidence: [test passes / code exists / etc.]

## Incomplete Despite Being Marked Done

- [ ] Task N: [description] - ISSUE_TYPE
  - Details of what's missing or broken
  - File: [path:line]

## Technical Debt Discovered

| Severity | File | Line | Issue |
|----------|------|------|-------|
| High/Medium/Low | path | N | TODO/FIXME/etc. text |

## Missing Test Coverage

| Spec | Criterion | Status |
|------|-----------|--------|
| spec-file.md | acceptance criterion | No test found |

---

## Recommendations

1. **Critical**: [action items]
2. **High**: [action items]
3. **Medium**: [action items]
```

IMPORTANT: Review only. Do NOT fix anything. Do NOT modify code. Output findings ONLY to @REVIEW_REPORT.md.

If validation commands exist in @AGENTS.md, run them and include results in the report:
- Build status (pass/fail)
- Test results (pass/fail count)
- TypeScript errors (count and summary)
- Lint errors (count and summary)

Use an Opus subagent with ultrathink for final analysis and recommendations synthesis.

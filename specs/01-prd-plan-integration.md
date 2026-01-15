# PRD→Plan Integration

## User Story

**As a** developer using Ralph Wiggum
**I want to** use my generated PRD documents as context for plan generation
**So that** my implementation plan is informed by the product requirements

## Problem Statement

After generating PRD.md and AUDIENCE_JTBD.md, users cannot easily use them as context for generating implementation plans. The Plan Generator doesn't have an option to include PRD context, and file save verification is unclear.

## Acceptance Criteria

### AC-1: "Use PRD Documents" Toggle
- [ ] Plan Generator has a checkbox to include PRD.md and AUDIENCE_JTBD.md
- [ ] When enabled, PRD content is prepended to the generation prompt
- [ ] Toggle is disabled during generation
- [ ] Clear visual indication of what the toggle does

### AC-2: File Save Confirmation
- [ ] When files are inserted, dashboard shows confirmation message
- [ ] config:saved WebSocket message is handled
- [ ] Confirmation auto-clears after 3 seconds
- [ ] Files are saved to TARGET_PROJECT_PATH (not Ralph path)

### AC-3: Generate Button Logic
- [ ] Generate button enabled when PRD docs selected (even without goal text)
- [ ] Work-scoped mode still requires workScope
- [ ] Button disabled during generation

## Implementation Details

### Files to Modify

| File | Changes |
|------|---------|
| `dashboard/src/hooks/useWebSocket.ts` | Add config:saved handler, savedFiles state |
| `dashboard/src/components/PlanGenerator.tsx` | Add usePrdDocs checkbox, update disabled logic |
| `dashboard/src/types/index.ts` | Add usePrdContext to GeneratePlanCommand |
| `dashboard/server/index.ts` | Read PRD files when usePrdContext is true |
| `dashboard/server/planGenerator.ts` | Accept prdContext, prepend to prompt |

### Key Code Changes

**useWebSocket.ts - Add saved files state:**
```typescript
const [savedFiles, setSavedFiles] = useState<Set<string>>(new Set());

case 'config:saved':
  setSavedFiles(prev => new Set([...prev, message.payload.file]));
  setTimeout(() => {
    setSavedFiles(prev => {
      const next = new Set(prev);
      next.delete(message.payload.file);
      return next;
    });
  }, 3000);
  break;
```

**PlanGenerator.tsx - Update button disabled logic:**
```typescript
// Before:
disabled={!goal.trim() || (mode === 'plan-work' && !workScope.trim())}

// After:
disabled={(!goal.trim() && !usePrdDocs) || (mode === 'plan-work' && !workScope.trim())}
```

## Required Tests

1. **PRD Context Toggle Test**
   - Generate plan with PRD toggle off → prompt doesn't include PRD content
   - Generate plan with PRD toggle on → prompt includes PRD.md and AUDIENCE_JTBD.md content

2. **File Save Verification Test**
   - Insert PRD files → verify files exist in TARGET_PROJECT_PATH
   - Verify confirmation message appears
   - Verify message clears after 3 seconds

3. **Button State Test**
   - No goal, no PRD toggle → button disabled
   - No goal, PRD toggle on → button enabled
   - Goal entered, PRD toggle off → button enabled
   - Work-scoped mode without workScope → button disabled

## Dependencies

- Requires PRD.md and AUDIENCE_JTBD.md to exist in project (generate first)
- Requires projectConfig.readFile() method (already exists)

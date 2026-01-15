# Implementation Plan

## Overview

Enhance RalphWiggumV2 dashboard with 8 feature sets covering PRD→Plan integration, task parsing, cross-platform support, agent management, and more.

**Status**: 0/31 tasks complete (0%)

---

## Release 1: Core Dashboard Fixes

### Feature Set 1: PRD→Plan Integration (spec: 01-prd-plan-integration.md)

- [ ] Task 18: Add config:saved handler to useWebSocket.ts
- [ ] Task 19: Add "Use PRD Documents" toggle to PlanGenerator.tsx
- [ ] Task 20: Update GeneratePlanCommand type in types/index.ts
- [ ] Task 21: Update server handler to read PRD files in index.ts
- [ ] Task 22: Update planGenerator.ts to accept prdContext
- [ ] Task 24: Wire up props from Dashboard.tsx
- [ ] Task 25: Fix Generate button disabled logic for PRD context

### Feature Set 2: Implementation Plan Parser (spec: 02-implementation-plan-parser.md)

- [ ] Task 26: Enhance parseTasks() in fileWatcher.ts for checkbox format
- [ ] Task 27: Add User Story (US-XXX) pattern recognition
- [ ] Task 28: Add numbered checkbox pattern recognition
- [ ] Task 29: Add emoji status marker pattern recognition
- [ ] Task 30: Test with mixed format IMPLEMENTATION_PLAN.md

### Feature Set 3: File Write Safety (spec: 03-file-write-safety.md)

- [ ] Task 31: Add "File Writing Rules" section to CLAUDE.md template
- [ ] Task 32: Update PROMPT_build.md with file operation safety instructions

### Feature Set 4: Cross-Platform CLI (spec: 04-cross-platform-cli.md)

- [ ] Task 33: Make --model flag conditional in planGenerator.ts
- [ ] Task 34: Make --model flag conditional in prdGenerator.ts
- [ ] Task 35: Make --model flag conditional in loop.sh
- [ ] Task 36: Document CLAUDE_MODEL_FLAG environment variable

---

## Release 2: Agent Management

### Feature Set 5: Agent Installation (spec: 05-agent-installation.md)

- [ ] Task 37: Create react-typescript-expert.md agent file
- [ ] Task 38: Create accessibility-expert.md agent file
- [ ] Task 39: Create qol-ux-expert.md agent file
- [ ] Task 40: Create golang-backend-expert.md agent file
- [ ] Task 41: Add installAgentGlobal method to projectConfig.ts
- [ ] Task 42: Add installAgentProject method to projectConfig.ts
- [ ] Task 43: Add listRepoAgents method to projectConfig.ts
- [ ] Task 44: Add WebSocket handlers for agent installation in index.ts
- [ ] Task 45: Add agent installation types to types/index.ts
- [ ] Task 46: Add agent installation state/callbacks to useWebSocket.ts
- [ ] Task 47: Update SpecialistAgentsConfig.tsx with install buttons
- [ ] Task 48: Wire up agent props in Dashboard.tsx

---

## Release 3: Setup & Dependencies

### Feature Set 6: Dependency Checker (spec: 06-dependency-checker.md)

- [ ] Task 49: Create dependencyChecker.ts with check functions
- [ ] Task 50: Create DependencyChecker.tsx UI component
- [ ] Task 51: Add dependencies:check WebSocket handler
- [ ] Task 52: Add DependencyCheckResult type
- [ ] Task 53: Add dependency state to useWebSocket.ts
- [ ] Task 54: Add Dependencies tab to SetupWizard.tsx

### Feature Set 7: Config Saved Handler (spec: 07-config-saved-handler.md)

- [ ] Task 55: Add savedFiles state to useWebSocket.ts
- [ ] Task 56: Handle config:saved message in useWebSocket.ts
- [ ] Task 57: Show save confirmation in PRDGenerator.tsx

### Feature Set 8: Existing Docs Viewer (spec: 08-existing-docs-viewer.md)

- [ ] Task 58: Create ExistingDocsViewer.tsx component
- [ ] Task 59: Create DocumentPreview.tsx modal component
- [ ] Task 60: Add configPreviewDoc state to useWebSocket.ts
- [ ] Task 61: Add hasPRD/hasAudienceJTBD to projectConfig.ts
- [ ] Task 62: Place ExistingDocsViewer in Dashboard.tsx

---

## Verification Checklist

After each release, verify:

- [ ] All tests pass: `npm test`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] No lint errors: `npm run lint`
- [ ] Manual testing complete per spec
- [ ] Git commit with descriptive message
- [ ] Git push to remote

---

## Notes

- Tasks are numbered 18-62 to continue from previous work
- Each task references its spec file for detailed implementation
- Checkbox format enables dashboard task tracking
- SLC releases can be shipped independently

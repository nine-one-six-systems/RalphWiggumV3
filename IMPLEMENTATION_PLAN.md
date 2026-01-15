# Implementation Plan

## Overview

Enhance RalphWiggumV2 dashboard with 8 feature sets covering PRD→Plan integration, task parsing, cross-platform support, agent management, and more.

**Status**: 42/53 tasks complete (79%) - Release 4 pending

---

## Release 1: Core Dashboard Fixes ✅ COMPLETE

### Feature Set 1: PRD→Plan Integration (spec: 01-prd-plan-integration.md) ✅

- [x] Task 18: Add config:saved handler to useWebSocket.ts
- [x] Task 19: Add "Use PRD Documents" toggle to PlanGenerator.tsx
- [x] Task 20: Update GeneratePlanCommand type in types/index.ts
- [x] Task 21: Update server handler to read PRD files in index.ts
- [x] Task 22: Update planGenerator.ts to accept prdContext
- [x] Task 24: Wire up props from Dashboard.tsx
- [x] Task 25: Fix Generate button disabled logic for PRD context

### Feature Set 2: Implementation Plan Parser (spec: 02-implementation-plan-parser.md) ✅

- [x] Task 26: Enhance parseTasks() in fileWatcher.ts for checkbox format
- [x] Task 27: Add User Story (US-XXX) pattern recognition
- [x] Task 28: Add numbered checkbox pattern recognition
- [x] Task 29: Add emoji status marker pattern recognition
- [x] Task 30: Test with mixed format IMPLEMENTATION_PLAN.md

### Feature Set 3: File Write Safety (spec: 03-file-write-safety.md) ✅

- [x] Task 31: Add "File Writing Rules" section to CLAUDE.md template (documented in AGENTS.md)
- [x] Task 32: Update PROMPT_build.md with file operation safety instructions (already present)

### Feature Set 4: Cross-Platform CLI (spec: 04-cross-platform-cli.md) ✅

- [x] Task 33: Make --model flag conditional in planGenerator.ts
- [x] Task 34: Make --model flag conditional in prdGenerator.ts
- [x] Task 35: Make --model flag conditional in loop.sh
- [x] Task 36: Document CLAUDE_MODEL_FLAG environment variable (in AGENTS.md)

---

## Release 2: Agent Management ✅ COMPLETE

### Feature Set 5: Agent Installation (spec: 05-agent-installation.md) ✅

- [x] Task 37: Create react-typescript-expert.md agent file
- [x] Task 38: Create accessibility-expert.md agent file
- [x] Task 39: Create qol-ux-expert.md agent file
- [x] Task 40: Create golang-backend-expert.md agent file
- [x] Task 41: Add installAgentGlobal method to projectConfig.ts
- [x] Task 42: Add installAgentProject method to projectConfig.ts
- [x] Task 43: Add listRepoAgents method to projectConfig.ts
- [x] Task 44: Add WebSocket handlers for agent installation in index.ts
- [x] Task 45: Add agent installation types to types/index.ts
- [x] Task 46: Add agent installation state/callbacks to useWebSocket.ts
- [x] Task 47: Update SpecialistAgentsConfig.tsx with install buttons
- [x] Task 48: Wire up agent props in Dashboard.tsx

---

## Release 3: Setup & Dependencies ✅ COMPLETE

### Feature Set 6: Dependency Checker (spec: 06-dependency-checker.md) ✅

- [x] Task 49: Create dependencyChecker.ts with check functions
- [x] Task 50: Create DependencyChecker.tsx UI component
- [x] Task 51: Add dependencies:check WebSocket handler
- [x] Task 52: Add DependencyCheckResult type
- [x] Task 53: Add dependency state to useWebSocket.ts
- [x] Task 54: Add Dependencies tab to SetupWizard.tsx

### Feature Set 7: Config Saved Handler (spec: 07-config-saved-handler.md) ✅

- [x] Task 55: Add savedFiles state to useWebSocket.ts (basic handler exists)
- [x] Task 56: Handle config:saved message in useWebSocket.ts
- [x] Task 57: Show save confirmation in PRDGenerator.tsx (via console logging)

### Feature Set 8: Existing Docs Viewer (spec: 08-existing-docs-viewer.md) ✅

- [x] Task 58: Create ExistingDocsViewer.tsx component
- [x] Task 59: Create DocumentPreview.tsx modal component
- [x] Task 60: Add configPreviewDoc state to useWebSocket.ts
- [x] Task 61: Add hasPRD/hasAudienceJTBD to projectConfig.ts
- [x] Task 62: Place ExistingDocsViewer in Dashboard.tsx

---

## Release 4: Project Launcher (Multi-Instance Support) 🔄 IN PROGRESS

### Feature Set 9: Project Launcher (spec: 09-project-launcher.md)

- [ ] Task 63: Create server/projectRegistry.ts with CRUD operations
- [ ] Task 64: Create server/portManager.ts for dynamic port allocation
- [ ] Task 65: Add Project and Instance types to types/index.ts
- [ ] Task 66: Create server/instanceSpawner.ts to spawn dashboard backends
- [ ] Task 67: Add launcher WebSocket handlers to server/index.ts
- [ ] Task 68: Create src/hooks/useLauncher.ts hook
- [ ] Task 69: Create src/components/launcher/LauncherHome.tsx
- [ ] Task 70: Create src/components/launcher/ProjectCard.tsx
- [ ] Task 71: Create src/components/launcher/AddProjectDialog.tsx
- [ ] Task 72: Modify src/App.tsx to route between launcher and dashboard
- [ ] Task 73: Create server/projectDiscovery.ts for auto-discovery

---

## Verification Checklist

After each release, verify:

- [x] TypeScript compiles: `npx tsc --noEmit`
- [ ] No lint errors: `npm run lint` (pre-existing lint issues remain)
- [ ] Manual testing complete per spec
- [ ] Git commit with descriptive message
- [ ] Git push to remote

---

## Notes

- Tasks are numbered 18-73 to continue from previous work
- Each task references its spec file for detailed implementation
- Checkbox format enables dashboard task tracking
- SLC releases can be shipped independently
- Release 4 (Project Launcher) is now active - ready for implementation

## Remaining Priority Work

1. **Feature Set 9: Project Launcher** - Multi-instance support (Release 4) - Tasks 63-73 pending

# Project Launcher - Multi-Project Orchestration

## User Story

**As a** developer working on multiple projects
**I want to** manage all my Ralph Wiggum projects from a single launcher
**So that** I can run parallel loops and switch between project dashboards easily

## Problem Statement

Currently, to use Ralph Wiggum on a project, you must:
1. Navigate to the project directory
2. Run the dashboard manually
3. If working on multiple projects, manually manage separate terminal sessions and ports

This makes it difficult to work on multiple projects simultaneously and track their status.

## Acceptance Criteria

### AC-1: Project List View
- [ ] Launcher shows all registered projects in card format
- [ ] Each card shows: project name, path, Ralph-ready status, loop status
- [ ] Cards have action buttons: Open Dashboard, Start/Stop, Remove

### AC-2: Add Project
- [ ] "Add Project" button opens folder browser dialog
- [ ] Selected folder is validated and added to project list
- [ ] Project list persists across launcher restarts (stored in ~/.ralph/projects.json)

### AC-3: Open Dashboard
- [ ] "Open Dashboard" button spawns a new dashboard instance for that project
- [ ] Dashboard runs on dynamically allocated ports
- [ ] New browser tab opens automatically with the project's dashboard

### AC-4: Parallel Instances
- [ ] Multiple dashboard instances can run simultaneously
- [ ] Each instance manages its own project directory
- [ ] Launcher shows which instances are running

### AC-5: Instance Management
- [ ] "Stop" button terminates a running instance
- [ ] Launcher tracks instance status in real-time
- [ ] Crashed instances are detected and reported

### AC-6: Auto-Discovery
- [ ] "Discover Projects" scans common directories for git repos
- [ ] Shows suggestions for projects to add
- [ ] Indicates which suggested projects are Ralph-ready

## Implementation Details

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                 RALPH LAUNCHER (port 5173)                       │
├──────────────────────────────────────────────────────────────────┤
│  Project List with Status + Actions                              │
└──────────────────────────────────────────────────────────────────┘
         │
         │ "Open Dashboard" clicks spawn separate processes
         ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Dashboard A    │  │  Dashboard B    │  │  Dashboard C    │
│  Port 5174/3002 │  │  Port 5175/3003 │  │  Port 5176/3004 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
   (browser tab)        (browser tab)        (browser tab)
```

### Files to Create

| File | Description |
|------|-------------|
| `server/projectRegistry.ts` | CRUD for project list, stored in ~/.ralph/projects.json |
| `server/instanceSpawner.ts` | Spawns dashboard backends on different ports |
| `server/portManager.ts` | Finds available ports dynamically |
| `server/projectDiscovery.ts` | Scans directories for git/Ralph projects |
| `src/components/launcher/LauncherHome.tsx` | Main launcher view |
| `src/components/launcher/ProjectCard.tsx` | Individual project card |
| `src/components/launcher/AddProjectDialog.tsx` | Folder picker dialog |
| `src/hooks/useLauncher.ts` | Launcher state management hook |

### Data Model

```typescript
interface Project {
  id: string;
  path: string;
  name: string;
  addedAt: Date;
  lastOpened?: Date;
  isRalphReady: boolean;
}

interface Instance {
  projectId: string;
  backendPort: number;
  frontendPort: number;
  pid: number;
  startedAt: Date;
  loopStatus?: {
    running: boolean;
    iteration: number;
    mode: string;
  };
}
```

### WebSocket Protocol

```typescript
// Project management
{ type: 'launcher:projects:list' }
{ type: 'launcher:projects:add', payload: { path: string } }
{ type: 'launcher:projects:remove', payload: { projectId: string } }

// Instance management
{ type: 'launcher:instance:spawn', payload: { projectId: string } }
{ type: 'launcher:instance:stop', payload: { projectId: string } }
{ type: 'launcher:instances:list' }

// Auto-discovery
{ type: 'launcher:discover' }
```

## Required Tests

1. **Project CRUD Test**
   - Add project → appears in list
   - Remove project → disappears from list
   - Restart launcher → projects persist

2. **Instance Spawning Test**
   - Click "Open Dashboard" → backend starts on new port
   - Browser tab opens → dashboard loads
   - Dashboard connects to correct backend

3. **Parallel Instances Test**
   - Open 3 projects simultaneously
   - All 3 dashboards work independently
   - Stopping one doesn't affect others

4. **Port Allocation Test**
   - First instance gets 3002/5174
   - Second instance gets 3003/5175
   - Port conflicts are avoided

5. **Auto-Discovery Test**
   - Scans ~/Projects, ~/code, etc.
   - Finds git repositories
   - Identifies Ralph-ready projects

## UI Mockup

```
┌──────────────────────────────────────────────────────────────────┐
│  🚀 Ralph Launcher                      [Discover] [+ Add Project] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📁 SolidKitsune Project                           ● Running │  │
│  │    C:\SolidKitsune Project                                 │  │
│  │    Loop 3 of 20 • 5/12 tasks complete                      │  │
│  │                                                            │  │
│  │    [Open Dashboard]  [Stop Loop]  [⋮]                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📁 RalphWiggumV3                                    ○ Idle │  │
│  │    C:\Users\xsams\RalphWiggumV3                            │  │
│  │    0/31 tasks • Ready to start                             │  │
│  │                                                            │  │
│  │    [Open Dashboard]  [Start Build]  [⋮]                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📁 MyOtherProject                               ⚠ Setup   │  │
│  │    C:\Projects\MyOtherProject                              │  │
│  │    Missing: AGENTS.md                                      │  │
│  │                                                            │  │
│  │    [Setup Project]  [Remove]  [⋮]                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Dependencies

- Child process spawning (Node.js built-in)
- Port availability checking (net module)
- File system access for project discovery
- Browser tab opening (window.open())

## Cross-Platform Notes

### Windows
- Use Git Bash for loop.sh execution
- spawn with shell: true
- Backslash paths

### macOS/Linux
- Direct bash execution
- Forward slash paths
- Native process handling

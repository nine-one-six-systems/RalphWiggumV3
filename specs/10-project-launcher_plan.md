Ralph Launcher - Project Orchestrator
Target: C:\Users\xsams\RalphWiggumV3

Vision
A launcher application that lets you:

Pick a folder on your PC or Mac
Start a new dashboard instance for that project
Run the Ralph Wiggum loop in that directory
Toggle between different running instances via browser tabs
Architecture
┌──────────────────────────────────────────────────────────────────┐
│                 RALPH LAUNCHER (port 5173)                       │
│                 Single "home base" application                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Your Projects                              [+ Add Project]      │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📁 SolidKitsune Project                                    │  │
│  │    C:\SolidKitsune Project                                 │  │
│  │    ● Running - Loop 3 - 5/12 tasks                         │  │
│  │                                [Open Dashboard] [Stop]      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📁 RalphWiggumV3                                           │  │
│  │    C:\Users\xsams\RalphWiggumV3                            │  │
│  │    ○ Idle - 0/31 tasks                                     │  │
│  │                                [Open Dashboard] [Start]     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 📁 MyMacProject                                            │  │
│  │    /Users/me/Projects/MyMacProject                         │  │
│  │    ⚠ Not configured - needs AGENTS.md                      │  │
│  │                                       [Setup] [Remove]      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

         │                    │                    │
         │ Click "Open        │ Click "Open        │ Click "Start"
         │ Dashboard"         │ Dashboard"         │
         ▼                    ▼                    ▼

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Dashboard A    │  │  Dashboard B    │  │  Dashboard C    │
│  Port 5174      │  │  Port 5175      │  │  Port 5176      │
│  Backend 3002   │  │  Backend 3003   │  │  Backend 3004   │
│                 │  │                 │  │                 │
│  SolidKitsune   │  │  RalphWiggumV3  │  │  MyMacProject   │
│  Project        │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
   (browser tab)        (browser tab)        (browser tab)
User Flow
Open Launcher at localhost:5173
See all your projects with status indicators
Click "Add Project" → Browse to select folder → Project added to list
Click "Open Dashboard" → Spawns new backend + opens new browser tab
Work in that tab → Full dashboard experience for that project
Return to Launcher → See status of all projects, open more tabs
Technical Flow
User clicks "Open Dashboard" for Project A
    │
    ▼
Launcher Backend (port 3001)
    │
    ├── 1. Find next available ports (e.g., 3002/5174)
    │
    ├── 2. Spawn child process:
    │       node dashboard/server/index.ts
    │       with env: PORT=3002, VITE_PORT=5174, TARGET_PROJECT=C:\ProjectA
    │
    ├── 3. Wait for backend ready signal
    │
    ├── 4. Return URL to frontend
    │
    └── 5. Frontend opens: window.open('http://localhost:5174')
Components
1. Launcher Home View
File: src/components/launcher/LauncherHome.tsx

export function LauncherHome() {
  const { projects, instances, addProject, openDashboard, stopInstance } = useLauncher();

  return (
    <div className="container mx-auto p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Ralph Launcher</h1>
        <AddProjectDialog onAdd={addProject} />
      </header>

      <div className="space-y-4">
        {projects.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            instance={instances.find(i => i.projectId === project.id)}
            onOpenDashboard={() => openDashboard(project.id)}
            onStop={() => stopInstance(project.id)}
          />
        ))}
      </div>
    </div>
  );
}
2. Project Card
File: src/components/launcher/ProjectCard.tsx

Shows:

Project name and path
Ralph-ready status (has AGENTS.md, IMPLEMENTATION_PLAN.md)
Loop status if running (iteration, tasks completed)
Actions: Open Dashboard, Start Loop, Stop, Remove
3. Instance Spawner
File: server/instanceSpawner.ts

import { spawn, ChildProcess } from 'child_process';

interface RunningInstance {
  projectId: string;
  backendPort: number;
  frontendPort: number;
  process: ChildProcess;
  startedAt: Date;
}

export class InstanceSpawner {
  private instances: Map<string, RunningInstance> = new Map();
  private nextBackendPort = 3002;
  private nextFrontendPort = 5174;

  async spawnInstance(projectPath: string, projectId: string): Promise<RunningInstance> {
    const backendPort = this.nextBackendPort++;
    const frontendPort = this.nextFrontendPort++;

    // Spawn the dashboard server for this project
    const proc = spawn('node', ['server/index.ts'], {
      cwd: __dirname, // Ralph dashboard directory
      env: {
        ...process.env,
        PORT: String(backendPort),
        VITE_PORT: String(frontendPort),
        VITE_WS_PORT: String(backendPort),
        TARGET_PROJECT_PATH: projectPath,
        RALPH_INSTANCE_MODE: 'spawned',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const instance: RunningInstance = {
      projectId,
      backendPort,
      frontendPort,
      process: proc,
      startedAt: new Date(),
    };

    this.instances.set(projectId, instance);

    // Wait for ready signal
    await this.waitForReady(backendPort);

    return instance;
  }

  stopInstance(projectId: string): void {
    const instance = this.instances.get(projectId);
    if (instance) {
      instance.process.kill();
      this.instances.delete(projectId);
    }
  }

  getInstances(): RunningInstance[] {
    return Array.from(this.instances.values());
  }
}
4. Port Manager
File: server/portManager.ts

import net from 'net';

export async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
    if (port > startPort + 100) {
      throw new Error('No available ports found');
    }
  }
  return port;
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}
5. Project Registry
File: server/projectRegistry.ts

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface Project {
  id: string;
  path: string;
  name: string;
  addedAt: Date;
  lastOpened?: Date;
  isRalphReady: boolean;
}

export class ProjectRegistry {
  private configPath = path.join(os.homedir(), '.ralph', 'projects.json');
  private projects: Project[] = [];

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.projects = JSON.parse(data).projects || [];
    } catch {
      this.projects = [];
    }
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify({ projects: this.projects }, null, 2));
  }

  async addProject(projectPath: string): Promise<Project> {
    const name = path.basename(projectPath);
    const isRalphReady = await this.checkRalphReady(projectPath);

    const project: Project = {
      id: crypto.randomUUID(),
      path: projectPath,
      name,
      addedAt: new Date(),
      isRalphReady,
    };

    this.projects.push(project);
    await this.save();
    return project;
  }

  private async checkRalphReady(projectPath: string): Promise<boolean> {
    try {
      await fs.access(path.join(projectPath, 'AGENTS.md'));
      return true;
    } catch {
      return false;
    }
  }

  getProjects(): Project[] {
    return this.projects;
  }
}
6. Auto-Discovery
File: server/projectDiscovery.ts

export async function discoverProjects(): Promise<string[]> {
  const candidates: string[] = [];

  // Common project directories
  const searchPaths = [
    path.join(os.homedir(), 'Projects'),
    path.join(os.homedir(), 'repos'),
    path.join(os.homedir(), 'code'),
    path.join(os.homedir(), 'dev'),
    // Windows
    'C:\\Projects',
    'C:\\dev',
    // Mac
    '/Users/*/Projects',
  ];

  for (const searchPath of searchPaths) {
    try {
      const entries = await fs.readdir(searchPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(searchPath, entry.name);
          // Check for .git or Ralph indicators
          const hasGit = await fileExists(path.join(fullPath, '.git'));
          const hasAgents = await fileExists(path.join(fullPath, 'AGENTS.md'));
          if (hasGit || hasAgents) {
            candidates.push(fullPath);
          }
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  return candidates;
}
Data Model
interface Project {
  id: string;
  path: string;
  name: string;
  addedAt: Date;
  lastOpened?: Date;
  isRalphReady: boolean;  // Has AGENTS.md, IMPLEMENTATION_PLAN.md
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

interface LauncherState {
  projects: Project[];
  instances: Instance[];
  discoveredProjects: string[];  // Suggested projects from auto-discovery
}
WebSocket Protocol (Launcher)
// List registered projects
{ type: 'launcher:projects:list' }
{ type: 'launcher:projects:result', payload: Project[] }

// Add a project
{ type: 'launcher:projects:add', payload: { path: string } }
{ type: 'launcher:projects:added', payload: Project }

// Remove a project
{ type: 'launcher:projects:remove', payload: { projectId: string } }

// Spawn dashboard instance
{ type: 'launcher:instance:spawn', payload: { projectId: string } }
{ type: 'launcher:instance:ready', payload: { projectId, frontendUrl, backendPort } }

// Stop instance
{ type: 'launcher:instance:stop', payload: { projectId: string } }
{ type: 'launcher:instance:stopped', payload: { projectId: string } }

// Get all running instances
{ type: 'launcher:instances:list' }
{ type: 'launcher:instances:result', payload: Instance[] }

// Discover projects
{ type: 'launcher:discover' }
{ type: 'launcher:discover:result', payload: string[] }

// Instance status update (broadcast)
{ type: 'launcher:instance:status', payload: { projectId, loopStatus } }
Routing
The app will have two modes:

Launcher mode (default at /) - Shows project list
Dashboard mode (at /dashboard) - Shows single project dashboard
// App.tsx
function App() {
  const isSpawnedInstance = import.meta.env.VITE_SPAWNED_INSTANCE === 'true';

  if (isSpawnedInstance) {
    return <Dashboard />;  // Normal dashboard for spawned instances
  }

  return <LauncherHome />;  // Launcher view
}
Files to Create/Modify
| File | Type | Description |

|------|------|-------------|

| server/instanceSpawner.ts | NEW | Spawns dashboard instances |

| server/portManager.ts | NEW | Finds available ports |

| server/projectRegistry.ts | NEW | CRUD for project list |

| server/projectDiscovery.ts | NEW | Auto-discovers projects |

| src/components/launcher/LauncherHome.tsx | NEW | Main launcher view |

| src/components/launcher/ProjectCard.tsx | NEW | Project card component |

| src/components/launcher/AddProjectDialog.tsx | NEW | Add project modal |

| src/hooks/useLauncher.ts | NEW | Launcher state hook |

| src/types/index.ts | MODIFY | Add Project, Instance types |

| server/index.ts | MODIFY | Add launcher WebSocket handlers |

| src/App.tsx | MODIFY | Add launcher/dashboard routing |

Implementation Phases
Phase 1: Core Infrastructure
Create projectRegistry.ts for project storage
Create portManager.ts for port allocation
Add Project and Instance types
Phase 2: Instance Spawning
Create instanceSpawner.ts
Modify server/index.ts to support spawned mode
Test spawning a dashboard for a project
Phase 3: Launcher UI
Create LauncherHome.tsx
Create ProjectCard.tsx
Create AddProjectDialog.tsx
Add routing between launcher and dashboard
Phase 4: WebSocket Integration
Add launcher WebSocket handlers
Create useLauncher.ts hook
Connect UI to backend
Phase 5: Auto-Discovery
Create projectDiscovery.ts
Add "Discover Projects" feature
Show suggested projects
Phase 6: Polish
Status synchronization across instances
Handle instance crashes gracefully
Add "Open All" / "Stop All" actions
Cross-Platform Considerations
Windows
Use spawn with shell: true for process management
Paths use backslashes
Git Bash for loop.sh execution
macOS/Linux
Native process spawning
Forward slashes in paths
Direct bash execution
Resource Management
Max concurrent instances: Configurable (default: 5)
Auto-cleanup: Stop instances idle for >1 hour
Port range: 3002-3100 for backends, 5174-5273 for frontends
Process monitoring: Restart crashed instances 
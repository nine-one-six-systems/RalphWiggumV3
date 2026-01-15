import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { FileWatcher } from './fileWatcher.js';
import { LoopController } from './loopController.js';
import { ProjectConfigManager } from './projectConfig.js';
import { PlanGenerator } from './planGenerator.js';
import { PRDGenerator } from './prdGenerator.js';
import { ProjectScanner } from './projectScanner.js';
import { detectProjectRoot, formatProjectInfo, type ProjectRootResult } from './projectRootDetector.js';
import { checkAllDependencies } from './dependencyChecker.js';
import { ProjectRegistry } from './projectRegistry.js';
import { InstanceSpawner } from './instanceSpawner.js';
import { ProjectDiscovery } from './projectDiscovery.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect project root (async initialization)
const RALPH_DEFAULT_PATH = path.resolve(__dirname, '../..');

// Browse directory helper - returns directory entries with metadata
interface BrowseEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isGitRepo: boolean;
  isRalphReady: boolean;
}

async function browseDirectory(dirPath: string): Promise<BrowseEntry[]> {
  const entries: BrowseEntry[] = [];

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      // Skip hidden files/folders (starting with .)
      if (item.name.startsWith('.')) continue;

      // Only include directories (Task 88: Filter to show only directories)
      if (!item.isDirectory()) continue;

      const fullPath = path.join(dirPath, item.name);

      // Check if it's a git repo
      let isGitRepo = false;
      try {
        await fs.access(path.join(fullPath, '.git'));
        isGitRepo = true;
      } catch {
        // Not a git repo
      }

      // Check if it's Ralph-ready (has AGENTS.md and/or CLAUDE.md)
      let isRalphReady = false;
      try {
        const [hasAgents, hasClaude] = await Promise.all([
          fs.access(path.join(fullPath, 'AGENTS.md')).then(() => true).catch(() => false),
          fs.access(path.join(fullPath, 'CLAUDE.md')).then(() => true).catch(() => false),
        ]);
        isRalphReady = hasAgents || hasClaude;
      } catch {
        // Error checking, not Ralph-ready
      }

      entries.push({
        name: item.name,
        path: fullPath,
        isDirectory: true,
        isGitRepo,
        isRalphReady,
      });
    }

    // Sort: Ralph-ready first, then git repos, then alphabetically
    entries.sort((a, b) => {
      if (a.isRalphReady !== b.isRalphReady) return a.isRalphReady ? -1 : 1;
      if (a.isGitRepo !== b.isGitRepo) return a.isGitRepo ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  } catch (err) {
    console.error(`Error reading directory ${dirPath}:`, err);
    throw err;
  }

  return entries;
}

// Initialize project detection and return paths
async function initializeProjectPaths(): Promise<ProjectRootResult> {
  // Allow explicit override via environment
  if (process.env.PROJECT_PATH) {
    return {
      targetProjectPath: process.env.PROJECT_PATH,
      ralphPath: RALPH_DEFAULT_PATH,
      mode: 'embedded',
      detectionReason: 'Explicitly set via PROJECT_PATH environment variable',
    };
  }
  return detectProjectRoot(RALPH_DEFAULT_PATH);
}

// Start server after initialization
async function startServer() {
  const projectRoot = await initializeProjectPaths();
  const TARGET_PROJECT_PATH = projectRoot.targetProjectPath;
  const RALPH_PATH = projectRoot.ralphPath;

  console.log('\n' + formatProjectInfo(projectRoot) + '\n');

  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  app.use(cors());
  app.use(express.json());

  // Initialize services with appropriate paths
  const projectConfig = new ProjectConfigManager(TARGET_PROJECT_PATH, RALPH_PATH);
  const fileWatcher = new FileWatcher(TARGET_PROJECT_PATH);
  const loopController = new LoopController(TARGET_PROJECT_PATH, RALPH_PATH);
  const planGenerator = new PlanGenerator(TARGET_PROJECT_PATH, RALPH_PATH);
  const prdGenerator = new PRDGenerator(TARGET_PROJECT_PATH, RALPH_PATH);
  const projectScanner = new ProjectScanner(TARGET_PROJECT_PATH);

  // Initialize launcher services
  const projectRegistry = new ProjectRegistry();
  const instanceSpawner = new InstanceSpawner(RALPH_PATH);
  const projectDiscovery = new ProjectDiscovery();

  // Track connected clients
  const clients = new Set<WebSocket>();

  // Broadcast to all connected clients
  function broadcast(message: object) {
    const data = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  // WebSocket connection handler
  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected. Total clients:', clients.size);

    // Send initial state
    ws.send(JSON.stringify({ type: 'loop:status', payload: loopController.getStatus() }));
    ws.send(JSON.stringify({ type: 'tasks:update', payload: fileWatcher.getTasks() }));
    ws.send(JSON.stringify({ type: 'git:update', payload: fileWatcher.getGitStatus() }));
    ws.send(JSON.stringify({ type: 'config:update', payload: projectConfig.getConfig() }));
    ws.send(JSON.stringify({ type: 'project:info', payload: projectRoot }));

    // Handle messages from client
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'loop:start':
            loopController.start(message.payload);
            break;
          case 'loop:stop':
            loopController.stop();
            break;
          case 'config:read':
            const content = await projectConfig.readFile(message.payload.file);
            ws.send(JSON.stringify({ type: 'config:content', payload: { file: message.payload.file, content } }));
            break;
          case 'config:write':
            await projectConfig.writeFile(message.payload.file, message.payload.content);
            ws.send(JSON.stringify({ type: 'config:saved', payload: { file: message.payload.file } }));
            // Refresh config if PRD.md or AUDIENCE_JTBD.md was written
            if (message.payload.file === 'PRD.md' || message.payload.file === 'AUDIENCE_JTBD.md') {
              const updatedConfig = await projectConfig.refresh();
              broadcast({ type: 'config:update', payload: updatedConfig });
            }
            break;
          case 'config:refresh':
            try {
              const updatedConfig = await projectConfig.refresh();
              broadcast({ type: 'config:update', payload: updatedConfig });
              ws.send(JSON.stringify({ type: 'config:refreshed' }));
            } catch (err) {
              ws.send(JSON.stringify({ type: 'config:error', payload: { error: 'Failed to refresh config' } }));
            }
            break;
          case 'agents:toggle':
            await projectConfig.toggleAgent(message.payload.agentId, message.payload.enabled);
            const enabledAgents = projectConfig.getEnabledAgents();
            broadcast({ type: 'agents:update', payload: { enabledAgents } });
            break;
          case 'plan:generate':
            try {
              // Read PRD context if requested
              let prdContext = '';
              if (message.payload.usePrdContext) {
                try {
                  const prdContent = await projectConfig.readFile('PRD.md');
                  const audienceContent = await projectConfig.readFile('AUDIENCE_JTBD.md');
                  prdContext = `
## Context: PRD.md
${prdContent}

## Context: AUDIENCE_JTBD.md
${audienceContent}
`;
                } catch (err) {
                  console.warn('Could not read PRD files:', err);
                }
              }
              await planGenerator.generatePlan({ ...message.payload, prdContext });
            } catch (err) {
              console.error('Error generating plan:', err);
              ws.send(JSON.stringify({ 
                type: 'plan:error', 
                payload: { error: err instanceof Error ? err.message : 'Failed to start plan generation' } 
              }));
            }
            break;
          case 'plan:cancel':
            planGenerator.cancel();
            break;
          case 'prd:generate':
            prdGenerator.generatePRD(message.payload);
            break;
          case 'prd:cancel':
            prdGenerator.cancel();
            break;
          case 'project:scan':
            const scanResult = await projectScanner.scan();
            ws.send(JSON.stringify({ type: 'project:scan-result', payload: scanResult }));
            break;
          case 'project:info':
            ws.send(JSON.stringify({ type: 'project:info', payload: projectRoot }));
            break;
          case 'agents:list':
            const agents = await projectConfig.listAvailableAgents();
            ws.send(JSON.stringify({ type: 'agents:list-result', payload: agents }));
            break;
          case 'rules:list':
            const rules = await projectConfig.listCursorRulesDetailed();
            ws.send(JSON.stringify({ type: 'rules:list-result', payload: rules }));
            break;
          case 'rules:toggle':
            const updatedRules = await projectConfig.toggleCursorRule(message.payload.ruleId, message.payload.enabled);
            broadcast({ type: 'rules:update', payload: updatedRules });
            break;
          case 'docs:read':
            try {
              const docPath = message.payload.docPath;
              // Validate path to prevent directory traversal
              const normalizedPath = path.normalize(docPath);
              if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
                ws.send(JSON.stringify({ type: 'docs:error', payload: { error: 'Invalid path' } }));
                break;
              }
              const fullPath = path.join(TARGET_PROJECT_PATH, normalizedPath);
              const docContent = await fs.readFile(fullPath, 'utf-8');
              ws.send(JSON.stringify({ type: 'docs:content', payload: { path: docPath, content: docContent } }));
            } catch (err) {
              ws.send(JSON.stringify({ type: 'docs:error', payload: { error: 'Failed to read document' } }));
            }
            break;
          case 'claude:list':
            try {
              const claudeFiles = await projectConfig.listClaudeMdFiles();
              ws.send(JSON.stringify({ type: 'claude:list-result', payload: claudeFiles }));
            } catch (err) {
              ws.send(JSON.stringify({ type: 'claude:error', payload: { error: 'Failed to list CLAUDE.md files' } }));
            }
            break;
          case 'claude:read':
            try {
              const claudeContent = await projectConfig.readClaudeMdFile(message.payload.path);
              ws.send(JSON.stringify({ type: 'claude:content', payload: { path: message.payload.path, content: claudeContent } }));
            } catch (err) {
              ws.send(JSON.stringify({ type: 'claude:error', payload: { error: 'Failed to read CLAUDE.md' } }));
            }
            break;
          case 'claude:apply':
            try {
              await projectConfig.applyRalphClaudeMd();
              ws.send(JSON.stringify({ type: 'claude:applied' }));
              // Refresh and broadcast config update
              const updatedConfig = await projectConfig.refresh();
              broadcast({ type: 'config:update', payload: updatedConfig });
            } catch (err) {
              ws.send(JSON.stringify({ type: 'claude:error', payload: { error: 'Failed to apply CLAUDE.md' } }));
            }
            break;
          case 'dependencies:check':
            try {
              const depResults = await checkAllDependencies();
              ws.send(JSON.stringify({ type: 'dependencies:result', payload: depResults }));
            } catch (err) {
              ws.send(JSON.stringify({ type: 'dependencies:error', payload: { error: 'Failed to check dependencies' } }));
            }
            break;
          case 'agents:list-repo':
            try {
              const repoAgents = await projectConfig.listRepoAgents();
              ws.send(JSON.stringify({ type: 'agents:repo-result', payload: repoAgents }));
            } catch (err) {
              ws.send(JSON.stringify({ type: 'agents:error', payload: { error: 'Failed to list repo agents' } }));
            }
            break;
          case 'agents:install-global':
            try {
              await projectConfig.installAgentGlobal(message.payload.agentId);
              ws.send(JSON.stringify({ type: 'agents:installed', payload: { agentId: message.payload.agentId, scope: 'global' } }));
              // Send updated repo agents list
              const updatedRepoAgents = await projectConfig.listRepoAgents();
              ws.send(JSON.stringify({ type: 'agents:repo-result', payload: updatedRepoAgents }));
            } catch (err) {
              ws.send(JSON.stringify({ type: 'agents:error', payload: { error: `Failed to install agent globally: ${err instanceof Error ? err.message : 'Unknown error'}` } }));
            }
            break;
          case 'agents:install-project':
            try {
              await projectConfig.installAgentProject(message.payload.agentId);
              ws.send(JSON.stringify({ type: 'agents:installed', payload: { agentId: message.payload.agentId, scope: 'project' } }));
              // Send updated repo agents list
              const updatedRepoAgentsAfterProject = await projectConfig.listRepoAgents();
              ws.send(JSON.stringify({ type: 'agents:repo-result', payload: updatedRepoAgentsAfterProject }));
            } catch (err) {
              ws.send(JSON.stringify({ type: 'agents:error', payload: { error: `Failed to install agent to project: ${err instanceof Error ? err.message : 'Unknown error'}` } }));
            }
            break;
          case 'agents:install-all-global':
            try {
              await projectConfig.installAllAgentsGlobal();
              ws.send(JSON.stringify({ type: 'agents:installed', payload: { agentId: 'all', scope: 'global' } }));
              // Send updated repo agents list
              const updatedRepoAgentsAll = await projectConfig.listRepoAgents();
              ws.send(JSON.stringify({ type: 'agents:repo-result', payload: updatedRepoAgentsAll }));
            } catch (err) {
              ws.send(JSON.stringify({ type: 'agents:error', payload: { error: `Failed to install all agents: ${err instanceof Error ? err.message : 'Unknown error'}` } }));
            }
            break;

          // ============================================
          // Launcher WebSocket Handlers
          // ============================================
          case 'launcher:projects:list':
            try {
              const projects = await projectRegistry.listProjects();
              ws.send(JSON.stringify({ type: 'launcher:projects:list', payload: projects }));
            } catch (err) {
              ws.send(JSON.stringify({ type: 'launcher:error', payload: { error: `Failed to list projects: ${err instanceof Error ? err.message : 'Unknown error'}` } }));
            }
            break;

          case 'launcher:projects:add':
            try {
              const newProject = await projectRegistry.addProject(message.payload.path);
              ws.send(JSON.stringify({ type: 'launcher:project:added', payload: newProject }));
              // Broadcast updated list to all clients
              const updatedProjects = await projectRegistry.listProjects();
              broadcast({ type: 'launcher:projects:list', payload: updatedProjects });
            } catch (err) {
              ws.send(JSON.stringify({ type: 'launcher:error', payload: { error: `Failed to add project: ${err instanceof Error ? err.message : 'Unknown error'}` } }));
            }
            break;

          case 'launcher:projects:remove':
            try {
              // Stop instance if running
              if (instanceSpawner.isRunning(message.payload.projectId)) {
                await instanceSpawner.stopInstance(message.payload.projectId);
              }
              await projectRegistry.removeProject(message.payload.projectId);
              ws.send(JSON.stringify({ type: 'launcher:project:removed', payload: { projectId: message.payload.projectId } }));
              // Broadcast updated list to all clients
              const projectsAfterRemove = await projectRegistry.listProjects();
              broadcast({ type: 'launcher:projects:list', payload: projectsAfterRemove });
            } catch (err) {
              ws.send(JSON.stringify({ type: 'launcher:error', payload: { error: `Failed to remove project: ${err instanceof Error ? err.message : 'Unknown error'}` } }));
            }
            break;

          case 'launcher:instance:spawn':
            try {
              const project = await projectRegistry.getProject(message.payload.projectId);
              if (!project) {
                throw new Error('Project not found');
              }
              const instance = await instanceSpawner.spawnInstance(project.id, project.path);
              await projectRegistry.updateLastOpened(project.id);
              ws.send(JSON.stringify({ type: 'launcher:instance:spawned', payload: instance }));
              // Broadcast updated instances list to all clients
              const instances = instanceSpawner.listInstances();
              broadcast({ type: 'launcher:instances:list', payload: instances });
            } catch (err) {
              ws.send(JSON.stringify({ type: 'launcher:error', payload: { error: `Failed to spawn instance: ${err instanceof Error ? err.message : 'Unknown error'}` } }));
            }
            break;

          case 'launcher:instance:stop':
            try {
              await instanceSpawner.stopInstance(message.payload.projectId);
              ws.send(JSON.stringify({ type: 'launcher:instance:stopped', payload: { projectId: message.payload.projectId } }));
              // Broadcast updated instances list to all clients
              const instancesAfterStop = instanceSpawner.listInstances();
              broadcast({ type: 'launcher:instances:list', payload: instancesAfterStop });
            } catch (err) {
              ws.send(JSON.stringify({ type: 'launcher:error', payload: { error: `Failed to stop instance: ${err instanceof Error ? err.message : 'Unknown error'}` } }));
            }
            break;

          case 'launcher:instances:list':
            try {
              const runningInstances = instanceSpawner.listInstances();
              ws.send(JSON.stringify({ type: 'launcher:instances:list', payload: runningInstances }));
            } catch (err) {
              ws.send(JSON.stringify({ type: 'launcher:error', payload: { error: `Failed to list instances: ${err instanceof Error ? err.message : 'Unknown error'}` } }));
            }
            break;

          case 'launcher:discover':
            try {
              // Update discovery with current registered projects
              const registeredProjects = await projectRegistry.listProjects();
              projectDiscovery.updateRegistered(registeredProjects);
              const discoveredProjects = await projectDiscovery.discover();
              ws.send(JSON.stringify({ type: 'launcher:discover:result', payload: discoveredProjects }));
            } catch (err) {
              ws.send(JSON.stringify({ type: 'launcher:error', payload: { error: `Failed to discover projects: ${err instanceof Error ? err.message : 'Unknown error'}` } }));
            }
            break;

          case 'launcher:browse':
            try {
              const requestedPath = message.payload?.path || '';
              const isWindows = process.platform === 'win32';

              // Handle root/drives listing for Windows
              if (requestedPath === '' || requestedPath === '/' || requestedPath === '\\') {
                if (isWindows) {
                  // On Windows, list available drives
                  const drives: string[] = [];
                  // Check common drive letters
                  for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
                    const drivePath = `${letter}:\\`;
                    try {
                      await fs.access(drivePath);
                      drives.push(drivePath);
                    } catch {
                      // Drive not available
                    }
                  }
                  ws.send(JSON.stringify({
                    type: 'launcher:browse:result',
                    payload: {
                      currentPath: '',
                      parentPath: null,
                      entries: [],
                      drives,
                    }
                  }));
                } else {
                  // On Unix, browse root
                  const entries = await browseDirectory('/');
                  ws.send(JSON.stringify({
                    type: 'launcher:browse:result',
                    payload: {
                      currentPath: '/',
                      parentPath: null,
                      entries,
                    }
                  }));
                }
              } else {
                // Browse the specified directory
                const normalizedPath = path.normalize(requestedPath);
                const entries = await browseDirectory(normalizedPath);

                // Calculate parent path
                let parentPath: string | null = path.dirname(normalizedPath);
                if (isWindows) {
                  // On Windows, check if we're at drive root (e.g., C:\)
                  if (normalizedPath.match(/^[A-Z]:\\$/i)) {
                    parentPath = '';  // Go back to drives list
                  } else if (parentPath === normalizedPath) {
                    parentPath = null;
                  }
                } else {
                  if (parentPath === normalizedPath || normalizedPath === '/') {
                    parentPath = null;
                  }
                }

                ws.send(JSON.stringify({
                  type: 'launcher:browse:result',
                  payload: {
                    currentPath: normalizedPath,
                    parentPath,
                    entries,
                  }
                }));
              }
            } catch (err) {
              ws.send(JSON.stringify({ type: 'launcher:error', payload: { error: `Failed to browse directory: ${err instanceof Error ? err.message : 'Unknown error'}` } }));
            }
            break;
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected. Total clients:', clients.size);
    });
  });

  // File watcher events
  fileWatcher.on('tasks', (tasks) => {
    broadcast({ type: 'tasks:update', payload: tasks });
  });

  fileWatcher.on('log', (entry) => {
    broadcast({ type: 'loop:log', payload: entry });
  });

  fileWatcher.on('git', (status) => {
    broadcast({ type: 'git:update', payload: status });
  });

  // File watcher config refresh events (when PRD.md or AUDIENCE_JTBD.md change)
  fileWatcher.on('config:refresh', async () => {
    try {
      const updatedConfig = await projectConfig.refresh();
      broadcast({ type: 'config:update', payload: updatedConfig });
    } catch (err) {
      console.error('Error refreshing config:', err);
    }
  });

  // Loop controller events
  loopController.on('status', (status) => {
    broadcast({ type: 'loop:status', payload: status });
  });

  loopController.on('log', (entry) => {
    broadcast({ type: 'loop:log', payload: entry });
  });

  // Plan generator events
  planGenerator.on('status', (status) => {
    broadcast({ type: 'plan:status', payload: status });
  });

  planGenerator.on('output', (text) => {
    broadcast({ type: 'plan:output', payload: { text } });
  });

  planGenerator.on('log', (text) => {
    broadcast({ type: 'plan:log', payload: { text } });
  });

  planGenerator.on('complete', (result) => {
    broadcast({ type: 'plan:complete', payload: result });
  });

  planGenerator.on('error', (error) => {
    broadcast({ type: 'plan:error', payload: { error } });
  });

  planGenerator.on('cancelled', () => {
    broadcast({ type: 'plan:error', payload: { error: 'Plan generation cancelled' } });
  });

  // PRD generator events
  prdGenerator.on('status', (status) => {
    broadcast({ type: 'prd:status', payload: status });
  });

  prdGenerator.on('output', (text) => {
    broadcast({ type: 'prd:output', payload: { text } });
  });

  prdGenerator.on('log', (text) => {
    broadcast({ type: 'prd:log', payload: { text } });
  });

  prdGenerator.on('complete', (result) => {
    broadcast({ type: 'prd:complete', payload: result });
  });

  prdGenerator.on('error', (error) => {
    broadcast({ type: 'prd:error', payload: { error } });
  });

  prdGenerator.on('cancelled', () => {
    broadcast({ type: 'prd:error', payload: { error: 'PRD generation cancelled' } });
  });

  // Instance spawner events
  instanceSpawner.on('stopped', (data: { projectId: string }) => {
    broadcast({ type: 'launcher:instance:stopped', payload: data });
    const instances = instanceSpawner.listInstances();
    broadcast({ type: 'launcher:instances:list', payload: instances });
  });

  instanceSpawner.on('crashed', (data: { projectId: string; error: string }) => {
    broadcast({ type: 'launcher:instance:crashed', payload: data });
    const instances = instanceSpawner.listInstances();
    broadcast({ type: 'launcher:instances:list', payload: instances });
  });

  // REST API endpoints
  app.get('/api/status', (req, res) => {
    res.json({
      loop: loopController.getStatus(),
      tasks: fileWatcher.getTasks(),
      git: fileWatcher.getGitStatus(),
      config: projectConfig.getConfig(),
    });
  });

  // New endpoint to get project info
  app.get('/api/project-info', (req, res) => {
    res.json(projectRoot);
  });

  app.get('/api/config/:file', async (req, res) => {
    try {
      const content = await projectConfig.readFile(req.params.file);
      res.json({ content });
    } catch (err) {
      res.status(404).json({ error: 'File not found' });
    }
  });

  app.post('/api/config/:file', async (req, res) => {
    try {
      await projectConfig.writeFile(req.params.file, req.body.content);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save file' });
    }
  });

  app.post('/api/loop/start', (req, res) => {
    loopController.start(req.body);
    res.json({ success: true });
  });

  app.post('/api/loop/stop', (req, res) => {
    loopController.stop();
    res.json({ success: true });
  });

  // Start file watchers
  fileWatcher.start();

  // Start server
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Ralph Dashboard server running on port ${PORT}`);
    console.log(`Target project: ${TARGET_PROJECT_PATH}`);
    if (projectRoot.mode === 'embedded') {
      console.log(`Ralph directory: ${RALPH_PATH}`);
    }
  });

  // Cleanup on exit
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    fileWatcher.stop();
    loopController.stop();
    // Stop all spawned instances
    await instanceSpawner.stopAll();
    server.close();
    process.exit(0);
  });
}

// Start the server
startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

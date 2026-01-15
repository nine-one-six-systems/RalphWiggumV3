/**
 * LauncherHome - Main launcher view for managing multiple projects
 * Displays project cards and provides actions for managing projects/instances
 */

import { useState, useRef, useEffect } from 'react';
import { useLauncher } from '@/hooks/useLauncher';
import { ProjectCard } from './ProjectCard';
import { AddProjectDialog } from './AddProjectDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Rocket,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
  FolderOpen,
  Loader2,
  LayoutDashboard,
  CheckCircle,
  X,
} from 'lucide-react';

export function LauncherHome() {
  const {
    connected,
    projects,
    projectsLoading,
    instances,
    discoveredProjects,
    discovering,
    browseResult,
    browsing,
    lastInitResult,
    error,
    listProjects,
    addProject,
    removeProject,
    initializeProject,
    spawnInstance,
    stopInstance,
    discoverProjects,
    browseDirectory,
    clearError,
    clearInitResult,
    getInstanceForProject,
    isInstanceRunning,
  } = useLauncher();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [spawningProjectId, setSpawningProjectId] = useState<string | null>(null);
  const [initializingProjectId, setInitializingProjectId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Track spawning state per project to prevent double-spawns
  const spawningRef = useRef<Set<string>>(new Set());

  // Handle init result
  useEffect(() => {
    if (lastInitResult && lastInitResult.created.length > 0) {
      const project = projects.find(p => p.id === lastInitResult.projectId);
      const projectName = project?.name || 'Project';
      setSuccessMessage(`Created ${lastInitResult.created.join(', ')} in ${projectName}`);
      setInitializingProjectId(null);
      clearInitResult();
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastInitResult, projects, clearInitResult]);

  const handleOpenDashboard = async (projectId: string) => {
    // Prevent double-spawns
    if (spawningRef.current.has(projectId) || isInstanceRunning(projectId)) {
      return;
    }

    spawningRef.current.add(projectId);
    setSpawningProjectId(projectId);
    
    try {
      spawnInstance(projectId);
      // The instance spawner will open the browser tab when ready
      // We wait a bit and then clear the spawning state
      setTimeout(() => {
        setSpawningProjectId(null);
        spawningRef.current.delete(projectId);
        const instance = getInstanceForProject(projectId);
        if (instance) {
          window.open(`http://localhost:${instance.backendPort}`, '_blank');
        }
      }, 3000);
    } catch (err) {
      spawningRef.current.delete(projectId);
      setSpawningProjectId(null);
    }
  };

  const handleStartInstance = async (projectId: string) => {
    // Prevent double-spawns - check if already spawning or running
    if (spawningRef.current.has(projectId) || isInstanceRunning(projectId)) {
      console.log(`[Launcher] Skipping spawn for ${projectId} - already spawning or running`);
      return;
    }

    spawningRef.current.add(projectId);
    setSpawningProjectId(projectId);
    
    try {
      spawnInstance(projectId);
      // Clear spawning state after a delay (will be cleared earlier if instance spawns successfully)
      setTimeout(() => {
        setSpawningProjectId(null);
        spawningRef.current.delete(projectId);
      }, 5000);
    } catch (err) {
      spawningRef.current.delete(projectId);
      setSpawningProjectId(null);
    }
  };

  const handleStopInstance = (projectId: string) => {
    stopInstance(projectId);
  };

  const handleRemoveProject = (projectId: string) => {
    if (confirm('Are you sure you want to remove this project from the launcher?')) {
      removeProject(projectId);
    }
  };

  const handleAddProject = (path: string) => {
    addProject(path);
    setIsAddDialogOpen(false);
  };

  const handleInitialize = (projectId: string) => {
    setInitializingProjectId(projectId);
    initializeProject(projectId);
  };

  const runningCount = instances.length;
  const totalCount = projects.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Rocket className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Ralph Launcher</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your Ralph Wiggum projects
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/'}
                className="gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>

              <Badge variant={connected ? 'success' : 'destructive'}>
                {connected ? (
                  <><Wifi className="h-3 w-3 mr-1" /> Connected</>
                ) : (
                  <><WifiOff className="h-3 w-3 mr-1" /> Disconnected</>
                )}
              </Badge>

              {runningCount > 0 && (
                <Badge variant="secondary">
                  {runningCount} Running
                </Badge>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={listProjects}
                disabled={projectsLoading}
              >
                {projectsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>

              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-destructive/15 border-b border-destructive/30">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Banner (for init results) */}
      {successMessage && (
        <div className="bg-green-500/15 border-b border-green-500/30">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">{successMessage}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSuccessMessage(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {totalCount === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Projects Yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Add your first project to start managing Ralph Wiggum loops across
              multiple codebases.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Project
            </Button>
          </div>
        ) : (
          /* Project Grid */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => {
              const instance = getInstanceForProject(project.id);
              const isSpawning = spawningProjectId === project.id;
              const isProjectInitializing = initializingProjectId === project.id;

              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  instance={instance}
                  isSpawning={isSpawning}
                  isInitializing={isProjectInitializing}
                  onOpenDashboard={handleOpenDashboard}
                  onStartInstance={handleStartInstance}
                  onStopInstance={handleStopInstance}
                  onRemoveProject={handleRemoveProject}
                  onInitialize={handleInitialize}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Add Project Dialog */}
      <AddProjectDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAddProject={handleAddProject}
        discoveredProjects={discoveredProjects}
        isDiscovering={discovering}
        onDiscover={discoverProjects}
        browseResult={browseResult}
        isBrowsing={browsing}
        onBrowse={browseDirectory}
      />
    </div>
  );
}

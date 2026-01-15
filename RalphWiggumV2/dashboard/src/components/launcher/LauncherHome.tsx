/**
 * LauncherHome - Main launcher view for managing multiple projects
 * Displays project cards and provides actions for managing projects/instances
 */

import { useState } from 'react';
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
} from 'lucide-react';

export function LauncherHome() {
  const {
    connected,
    projects,
    projectsLoading,
    instances,
    instancesLoading,
    discoveredProjects,
    discovering,
    browseResult,
    browsing,
    error,
    listProjects,
    addProject,
    removeProject,
    spawnInstance,
    stopInstance,
    discoverProjects,
    browseDirectory,
    clearError,
    getInstanceForProject,
  } = useLauncher();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [spawningProjectId, setSpawningProjectId] = useState<string | null>(null);

  const handleOpenDashboard = async (projectId: string) => {
    setSpawningProjectId(projectId);
    spawnInstance(projectId);
    // The instance spawner will open the browser tab when ready
    // We wait a bit and then clear the spawning state
    setTimeout(() => {
      setSpawningProjectId(null);
      const instance = getInstanceForProject(projectId);
      if (instance) {
        window.open(`http://localhost:${instance.backendPort}`, '_blank');
      }
    }, 3000);
  };

  const handleStartInstance = async (projectId: string) => {
    setSpawningProjectId(projectId);
    spawnInstance(projectId);
    setTimeout(() => setSpawningProjectId(null), 3000);
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
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                instance={getInstanceForProject(project.id)}
                isSpawning={spawningProjectId === project.id || instancesLoading}
                onOpenDashboard={handleOpenDashboard}
                onStartInstance={handleStartInstance}
                onStopInstance={handleStopInstance}
                onRemoveProject={handleRemoveProject}
              />
            ))}
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

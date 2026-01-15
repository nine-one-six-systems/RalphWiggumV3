/**
 * ProjectCard - Individual project card for the launcher
 * Displays project info and provides actions (Open Dashboard, Start/Stop, Remove)
 */

import type { LauncherProject, LauncherInstance } from '@/types';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FolderOpen,
  Play,
  Square,
  Trash2,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Settings,
} from 'lucide-react';

interface ProjectCardProps {
  project: LauncherProject;
  instance?: LauncherInstance;
  isSpawning: boolean;
  isInitializing?: boolean;
  onOpenDashboard: (projectId: string) => void;
  onStartInstance: (projectId: string) => void;
  onStopInstance: (projectId: string) => void;
  onRemoveProject: (projectId: string) => void;
  onInitialize?: (projectId: string) => void;
}

export function ProjectCard({
  project,
  instance,
  isSpawning,
  isInitializing,
  onOpenDashboard,
  onStartInstance,
  onStopInstance,
  onRemoveProject,
  onInitialize,
}: ProjectCardProps) {
  const isRunning = !!instance;

  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Running
        </Badge>
      );
    }
    if (!project.isRalphReady) {
      return (
        <Badge variant="warning" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Setup Required
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        Idle
      </Badge>
    );
  };

  const getStatusDetail = () => {
    if (isRunning && instance) {
      const loopInfo = instance.loopStatus;
      if (loopInfo?.running) {
        return `Loop ${loopInfo.iteration} - ${loopInfo.mode}`;
      }
      return `Port ${instance.backendPort}`;
    }
    if (!project.isRalphReady) {
      return 'Missing AGENTS.md or CLAUDE.md';
    }
    return project.lastOpened
      ? `Last opened: ${new Date(project.lastOpened).toLocaleDateString()}`
      : 'Never opened';
  };

  const handleOpenDashboard = () => {
    if (isRunning && instance) {
      // Open the dashboard using the instance's actual ports
      // frontendPort is the Vite dev server, backendPort is the Express/WebSocket server
      const frontendPort = instance.frontendPort || 5173;
      window.open(`http://localhost:${frontendPort}?backend=${instance.backendPort}`, '_blank');
    } else {
      onOpenDashboard(project.id);
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-lg">{project.name}</h3>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={project.path}>
                {project.path}
              </p>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="flex-grow pb-3">
        <p className="text-sm text-muted-foreground">
          {getStatusDetail()}
        </p>
      </CardContent>

      <CardFooter className="pt-0 gap-2 flex-wrap">
        {isRunning ? (
          <>
            <Button
              variant="default"
              size="sm"
              onClick={handleOpenDashboard}
              className="flex items-center gap-1"
            >
              <ExternalLink className="h-4 w-4" />
              Open Dashboard
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onStopInstance(project.id)}
              disabled={isSpawning}
              className="flex items-center gap-1"
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="default"
              size="sm"
              onClick={() => onStartInstance(project.id)}
              disabled={isSpawning || isInitializing}
              className="flex items-center gap-1"
            >
              {isSpawning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isSpawning ? 'Starting...' : 'Start'}
            </Button>
            {!project.isRalphReady && onInitialize && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onInitialize(project.id)}
                disabled={isSpawning || isInitializing}
                className="flex items-center gap-1"
              >
                {isInitializing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Settings className="h-4 w-4" />
                )}
                {isInitializing ? 'Setting up...' : 'Setup'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemoveProject(project.id)}
              disabled={isSpawning || isInitializing}
              className="flex items-center gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

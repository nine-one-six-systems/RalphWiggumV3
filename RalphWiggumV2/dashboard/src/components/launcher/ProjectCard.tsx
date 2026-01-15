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
} from 'lucide-react';

interface ProjectCardProps {
  project: LauncherProject;
  instance?: LauncherInstance;
  isSpawning: boolean;
  onOpenDashboard: (projectId: string) => void;
  onStartInstance: (projectId: string) => void;
  onStopInstance: (projectId: string) => void;
  onRemoveProject: (projectId: string) => void;
}

export function ProjectCard({
  project,
  instance,
  isSpawning,
  onOpenDashboard,
  onStartInstance,
  onStopInstance,
  onRemoveProject,
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
      // Open the dashboard frontend with the backend port as a query param
      // The frontend will connect to the specified backend WebSocket port
      window.open(`http://localhost:5173?backend=${instance.backendPort}`, '_blank');
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
              disabled={isSpawning}
              className="flex items-center gap-1"
            >
              {isSpawning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isSpawning ? 'Starting...' : 'Start'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemoveProject(project.id)}
              disabled={isSpawning}
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

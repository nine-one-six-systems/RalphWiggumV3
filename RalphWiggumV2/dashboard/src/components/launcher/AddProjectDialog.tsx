/**
 * AddProjectDialog - Dialog for adding a new project to the launcher
 * Allows users to enter a project path manually or use discovered projects
 */

import { useState } from 'react';
import type { DiscoveredProject } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  X,
  FolderPlus,
  Search,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FolderOpen,
} from 'lucide-react';

interface AddProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProject: (path: string) => void;
  discoveredProjects: DiscoveredProject[];
  isDiscovering: boolean;
  onDiscover: () => void;
}

export function AddProjectDialog({
  isOpen,
  onClose,
  onAddProject,
  discoveredProjects,
  isDiscovering,
  onDiscover,
}: AddProjectDialogProps) {
  const [manualPath, setManualPath] = useState('');

  if (!isOpen) return null;

  const handleAddManualPath = () => {
    if (manualPath.trim()) {
      onAddProject(manualPath.trim());
      setManualPath('');
      onClose();
    }
  };

  const handleAddDiscoveredProject = (path: string) => {
    onAddProject(path);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Filter out already registered projects
  const availableProjects = discoveredProjects.filter(p => !p.alreadyRegistered);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Add Project
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4 space-y-6">
          {/* Manual Path Input */}
          <div className="space-y-2">
            <Label htmlFor="projectPath">Project Path</Label>
            <div className="flex gap-2">
              <Input
                id="projectPath"
                placeholder="Enter full path to project directory..."
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddManualPath()}
              />
              <Button onClick={handleAddManualPath} disabled={!manualPath.trim()}>
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the full path to a project directory (e.g., C:\Projects\MyApp)
            </p>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or discover projects
              </span>
            </div>
          </div>

          {/* Project Discovery */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Discovered Projects</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={onDiscover}
                disabled={isDiscovering}
              >
                {isDiscovering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Scan for Projects
                  </>
                )}
              </Button>
            </div>

            {discoveredProjects.length > 0 ? (
              <ScrollArea className="h-[250px] rounded-md border p-2">
                <div className="space-y-2">
                  {discoveredProjects.map((project) => (
                    <div
                      key={project.path}
                      className={`flex items-center justify-between p-3 rounded-md border ${
                        project.alreadyRegistered ? 'bg-muted opacity-50' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{project.name}</span>
                            {project.isRalphReady ? (
                              <Badge variant="success" className="shrink-0">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Ralph Ready
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="shrink-0">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Needs Setup
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate" title={project.path}>
                            {project.path}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddDiscoveredProject(project.path)}
                        disabled={project.alreadyRegistered}
                        className="shrink-0 ml-2"
                      >
                        {project.alreadyRegistered ? 'Added' : 'Add'}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-[250px] rounded-md border flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Click "Scan for Projects" to discover projects</p>
                  <p className="text-xs mt-1">
                    Searches common directories like ~/Projects, ~/Code, etc.
                  </p>
                </div>
              </div>
            )}

            {availableProjects.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Found {availableProjects.length} new project{availableProjects.length !== 1 ? 's' : ''} to add
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

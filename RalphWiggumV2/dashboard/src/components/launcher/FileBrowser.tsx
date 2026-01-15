/**
 * FileBrowser - Component for browsing file system directories
 * Supports Windows drive letters and breadcrumb navigation
 * Highlights git repos and Ralph-ready directories
 */

import { useEffect, useCallback } from 'react';
import type { BrowseResult, BrowseEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Folder,
  FolderGit,
  ChevronRight,
  HardDrive,
  Loader2,
  ArrowUp,
  CheckCircle,
  Home,
} from 'lucide-react';

interface FileBrowserProps {
  browseResult: BrowseResult | null;
  browsing: boolean;
  onBrowse: (path: string) => void;
  onSelect: (path: string) => void;
}

export function FileBrowser({
  browseResult,
  browsing,
  onBrowse,
  onSelect,
}: FileBrowserProps) {
  // Start at drives/root on mount
  useEffect(() => {
    if (!browseResult && !browsing) {
      onBrowse('');
    }
  }, [browseResult, browsing, onBrowse]);

  // Navigate to a directory
  const handleNavigate = useCallback((path: string) => {
    onBrowse(path);
  }, [onBrowse]);

  // Select a directory as project path
  const handleSelect = useCallback((path: string) => {
    onSelect(path);
  }, [onSelect]);

  // Go up to parent directory
  const handleGoUp = useCallback(() => {
    if (browseResult?.parentPath !== null && browseResult?.parentPath !== undefined) {
      onBrowse(browseResult.parentPath);
    }
  }, [browseResult, onBrowse]);

  // Build breadcrumb segments from current path
  const getBreadcrumbs = useCallback(() => {
    if (!browseResult?.currentPath) return [];

    const segments: Array<{ name: string; path: string }> = [];
    const path = browseResult.currentPath;

    // Handle Windows paths (e.g., C:\Users\foo)
    const isWindows = /^[A-Z]:\\/i.test(path);

    if (isWindows) {
      const parts = path.split('\\').filter(Boolean);
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        if (i === 0) {
          // Drive letter (e.g., C:)
          currentPath = parts[i] + '\\';
          segments.push({ name: parts[i], path: currentPath });
        } else {
          currentPath = currentPath + parts[i] + (i < parts.length - 1 ? '\\' : '');
          segments.push({ name: parts[i], path: currentPath });
        }
      }
    } else {
      // Unix paths
      const parts = path.split('/').filter(Boolean);
      let currentPath = '';

      for (const part of parts) {
        currentPath = currentPath + '/' + part;
        segments.push({ name: part, path: currentPath });
      }
    }

    return segments;
  }, [browseResult]);

  // Get icon for entry
  const getEntryIcon = (entry: BrowseEntry) => {
    if (entry.isRalphReady) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (entry.isGitRepo) {
      return <FolderGit className="h-4 w-4 text-orange-500" />;
    }
    return <Folder className="h-4 w-4 text-muted-foreground" />;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="space-y-3">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1 text-sm overflow-x-auto pb-1">
        {/* Home/Drives button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 shrink-0"
          onClick={() => handleNavigate('')}
          disabled={browsing}
        >
          <Home className="h-4 w-4" />
        </Button>

        {breadcrumbs.map((segment, index) => (
          <div key={segment.path} className="flex items-center shrink-0">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 max-w-[150px]"
              onClick={() => handleNavigate(segment.path)}
              disabled={browsing || index === breadcrumbs.length - 1}
            >
              <span className="truncate">{segment.name}</span>
            </Button>
          </div>
        ))}

        {browsing && (
          <Loader2 className="h-4 w-4 animate-spin ml-2" />
        )}
      </div>

      {/* Directory Contents */}
      <ScrollArea className="h-[200px] rounded-md border">
        <div className="p-2">
          {/* Show drives on Windows at root */}
          {browseResult?.drives && browseResult.drives.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground px-2 py-1">Drives</p>
              {browseResult.drives.map((drive) => (
                <button
                  key={drive}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted text-left"
                  onClick={() => handleNavigate(drive)}
                  disabled={browsing}
                >
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{drive}</span>
                </button>
              ))}
            </div>
          )}

          {/* Go up button */}
          {browseResult?.parentPath !== null && browseResult?.parentPath !== undefined && (
            <button
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted text-left text-muted-foreground"
              onClick={handleGoUp}
              disabled={browsing}
            >
              <ArrowUp className="h-4 w-4" />
              <span>..</span>
            </button>
          )}

          {/* Directory entries */}
          {browseResult?.entries && browseResult.entries.length > 0 && (
            <div className="space-y-1">
              {browseResult.entries.map((entry) => (
                <div
                  key={entry.path}
                  className={`flex items-center justify-between gap-2 px-2 py-2 rounded-md hover:bg-muted ${
                    entry.isRalphReady ? 'bg-green-500/5' : entry.isGitRepo ? 'bg-orange-500/5' : ''
                  }`}
                >
                  <button
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    onClick={() => handleNavigate(entry.path)}
                    disabled={browsing}
                  >
                    {getEntryIcon(entry)}
                    <span className="truncate">{entry.name}</span>
                    {entry.isRalphReady && (
                      <Badge variant="success" className="shrink-0 text-xs">
                        Ralph Ready
                      </Badge>
                    )}
                    {!entry.isRalphReady && entry.isGitRepo && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        Git
                      </Badge>
                    )}
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-7"
                    onClick={() => handleSelect(entry.path)}
                    disabled={browsing}
                  >
                    Select
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {browseResult && !browseResult.drives?.length && !browseResult.entries?.length && (
            <div className="flex items-center justify-center h-[150px] text-muted-foreground">
              <p className="text-sm">No folders found</p>
            </div>
          )}

          {/* Loading state */}
          {!browseResult && browsing && (
            <div className="flex items-center justify-center h-[150px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Current path display */}
      {browseResult?.currentPath && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate flex-1" title={browseResult.currentPath}>
            {browseResult.currentPath}
          </p>
          <Button
            variant="default"
            size="sm"
            onClick={() => handleSelect(browseResult.currentPath)}
            disabled={browsing || !browseResult.currentPath}
          >
            Select Current
          </Button>
        </div>
      )}
    </div>
  );
}

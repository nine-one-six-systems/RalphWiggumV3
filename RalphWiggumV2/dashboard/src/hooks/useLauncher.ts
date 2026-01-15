/**
 * useLauncher Hook - State management for Project Launcher
 * Manages projects, instances, and discovery operations
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  LauncherProject,
  LauncherInstance,
  DiscoveredProject,
  BrowseResult,
} from '@/types';

interface ProjectInitResult {
  projectId: string;
  created: string[];
  skipped: string[];
}

interface UseLauncherReturn {
  connected: boolean;
  // Project state
  projects: LauncherProject[];
  projectsLoading: boolean;
  // Instance state
  instances: LauncherInstance[];
  instancesLoading: boolean;
  // Discovery state
  discoveredProjects: DiscoveredProject[];
  discovering: boolean;
  // Browse state
  browseResult: BrowseResult | null;
  browsing: boolean;
  // Init state
  lastInitResult: ProjectInitResult | null;
  initializing: boolean;
  // Error state
  error: string | null;
  // Project operations
  listProjects: () => void;
  addProject: (path: string) => void;
  removeProject: (projectId: string) => void;
  initializeProject: (projectId: string, templates?: string[]) => void;
  // Instance operations
  listInstances: () => void;
  spawnInstance: (projectId: string) => void;
  stopInstance: (projectId: string) => void;
  // Discovery operations
  discoverProjects: () => void;
  // Browse operations
  browseDirectory: (path: string) => void;
  // Error handling
  clearError: () => void;
  clearInitResult: () => void;
  // Utility functions
  getInstanceForProject: (projectId: string) => LauncherInstance | undefined;
  isInstanceRunning: (projectId: string) => boolean;
}

const DEFAULT_WS_PORT = import.meta.env.VITE_WS_PORT || '3001';

export function useLauncher(url: string = `ws://localhost:${DEFAULT_WS_PORT}/ws`): UseLauncherReturn {
  // Connection state
  const [connected, setConnected] = useState(false);

  // Project state
  const [projects, setProjects] = useState<LauncherProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Instance state
  const [instances, setInstances] = useState<LauncherInstance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(false);

  // Discovery state
  const [discoveredProjects, setDiscoveredProjects] = useState<DiscoveredProject[]>([]);
  const [discovering, setDiscovering] = useState(false);

  // Browse state
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [browsing, setBrowsing] = useState(false);

  // Init state
  const [lastInitResult, setLastInitResult] = useState<ProjectInitResult | null>(null);
  const [initializing, setInitializing] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCleaningUpRef = useRef(false);

  const connect = useCallback(() => {
    if (isCleaningUpRef.current) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Close existing connection if it exists
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(url);

    ws.onopen = () => {
      if (!isCleaningUpRef.current) {
        setConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        // Request initial data
        ws.send(JSON.stringify({ type: 'launcher:projects:list' }));
        ws.send(JSON.stringify({ type: 'launcher:instances:list' }));
      }
    };

    ws.onclose = () => {
      if (!isCleaningUpRef.current) {
        setConnected(false);
        // Attempt to reconnect after 2 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isCleaningUpRef.current) {
            connect();
          }
        }, 2000);
      }
    };

    ws.onerror = (wsError) => {
      if (!isCleaningUpRef.current && ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
        console.error('WebSocket error:', wsError);
      }
      if (!isCleaningUpRef.current) {
        ws.close();
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'launcher:projects:list':
            setProjects(message.payload);
            setProjectsLoading(false);
            break;

          case 'launcher:project:added':
            // Project added, will receive full list via broadcast
            setProjectsLoading(false);
            break;

          case 'launcher:project:removed':
            // Project removed, will receive full list via broadcast
            setProjectsLoading(false);
            break;

          case 'launcher:instances:list':
            setInstances(message.payload);
            setInstancesLoading(false);
            break;

          case 'launcher:instance:spawned':
            // Instance spawned, will receive full list via broadcast
            setInstancesLoading(false);
            break;

          case 'launcher:instance:stopped':
            // Instance stopped, will receive full list via broadcast
            setInstancesLoading(false);
            break;

          case 'launcher:instance:crashed':
            setError(`Instance crashed: ${message.payload.error}`);
            setInstancesLoading(false);
            break;

          case 'launcher:discover:result':
            setDiscoveredProjects(message.payload);
            setDiscovering(false);
            break;

          case 'launcher:browse:result':
            setBrowseResult(message.payload);
            setBrowsing(false);
            break;

          case 'launcher:error':
            setError(message.payload.error);
            setProjectsLoading(false);
            setInstancesLoading(false);
            setDiscovering(false);
            setBrowsing(false);
            setInitializing(false);
            break;

          case 'project:init:result':
            setLastInitResult(message.payload);
            setInitializing(false);
            break;

          case 'project:init:error':
            setError(message.payload.error);
            setInitializing(false);
            break;
        }
      } catch {
        console.error('Failed to parse WebSocket message');
      }
    };

    wsRef.current = ws;
  }, [url]);

  useEffect(() => {
    isCleaningUpRef.current = false;
    connect();

    return () => {
      isCleaningUpRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Project operations
  const listProjects = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setProjectsLoading(true);
      wsRef.current.send(JSON.stringify({ type: 'launcher:projects:list' }));
    }
  }, []);

  const addProject = useCallback((path: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setProjectsLoading(true);
      setError(null);
      wsRef.current.send(JSON.stringify({
        type: 'launcher:projects:add',
        payload: { path }
      }));
    }
  }, []);

  const removeProject = useCallback((projectId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setProjectsLoading(true);
      setError(null);
      wsRef.current.send(JSON.stringify({
        type: 'launcher:projects:remove',
        payload: { projectId }
      }));
    }
  }, []);

  // Instance operations
  const listInstances = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setInstancesLoading(true);
      wsRef.current.send(JSON.stringify({ type: 'launcher:instances:list' }));
    }
  }, []);

  const spawnInstance = useCallback((projectId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setInstancesLoading(true);
      setError(null);
      wsRef.current.send(JSON.stringify({
        type: 'launcher:instance:spawn',
        payload: { projectId }
      }));
    }
  }, []);

  const stopInstance = useCallback((projectId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setInstancesLoading(true);
      setError(null);
      wsRef.current.send(JSON.stringify({
        type: 'launcher:instance:stop',
        payload: { projectId }
      }));
    }
  }, []);

  // Discovery operations
  const discoverProjects = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setDiscovering(true);
      setError(null);
      wsRef.current.send(JSON.stringify({ type: 'launcher:discover' }));
    }
  }, []);

  // Browse operations
  const browseDirectory = useCallback((path: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setBrowsing(true);
      setError(null);
      wsRef.current.send(JSON.stringify({
        type: 'launcher:browse',
        payload: { path }
      }));
    }
  }, []);

  // Initialize project with Ralph files
  const initializeProject = useCallback((projectId: string, templates?: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setInitializing(true);
      setError(null);
      wsRef.current.send(JSON.stringify({
        type: 'project:init',
        payload: { projectId, templates }
      }));
    }
  }, []);

  // Error handling
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearInitResult = useCallback(() => {
    setLastInitResult(null);
  }, []);

  // Utility functions
  const getInstanceForProject = useCallback((projectId: string) => {
    return instances.find(i => i.projectId === projectId);
  }, [instances]);

  const isInstanceRunning = useCallback((projectId: string) => {
    return instances.some(i => i.projectId === projectId);
  }, [instances]);

  return {
    connected,
    projects,
    projectsLoading,
    instances,
    instancesLoading,
    discoveredProjects,
    discovering,
    browseResult,
    browsing,
    lastInitResult,
    initializing,
    error,
    listProjects,
    addProject,
    removeProject,
    initializeProject,
    listInstances,
    spawnInstance,
    stopInstance,
    discoverProjects,
    browseDirectory,
    clearError,
    clearInitResult,
    getInstanceForProject,
    isInstanceRunning,
  };
}

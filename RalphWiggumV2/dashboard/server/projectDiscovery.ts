/**
 * Project Discovery - Scans directories for potential projects to add
 * Looks for git repositories and Ralph-ready projects
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { DiscoveredProject, LauncherProject } from '../src/types/index.js';

// Common directories where developers keep projects
const COMMON_PROJECT_DIRS = [
  'Projects',
  'projects',
  'Code',
  'code',
  'Development',
  'development',
  'dev',
  'Dev',
  'work',
  'Work',
  'repos',
  'Repos',
  'src',
  'GitHub',
  'github',
];

export class ProjectDiscovery {
  private registeredPaths: Set<string>;

  constructor(registeredProjects: LauncherProject[] = []) {
    // Pre-populate registered paths for quick lookup
    this.registeredPaths = new Set(
      registeredProjects.map(p => path.resolve(p.path).toLowerCase())
    );
  }

  /**
   * Update the list of registered projects
   */
  updateRegistered(registeredProjects: LauncherProject[]): void {
    this.registeredPaths = new Set(
      registeredProjects.map(p => path.resolve(p.path).toLowerCase())
    );
  }

  /**
   * Discover projects in common directories
   */
  async discover(): Promise<DiscoveredProject[]> {
    const homeDir = os.homedir();
    const discovered: DiscoveredProject[] = [];

    // Scan each common directory
    for (const dir of COMMON_PROJECT_DIRS) {
      const fullPath = path.join(homeDir, dir);
      try {
        const projects = await this.scanDirectory(fullPath);
        discovered.push(...projects);
      } catch {
        // Directory doesn't exist or isn't readable - skip it
      }
    }

    // Also scan root of common drive locations on Windows
    if (process.platform === 'win32') {
      const windowsDirs = ['C:\\Projects', 'C:\\Code', 'D:\\Projects', 'D:\\Code'];
      for (const dir of windowsDirs) {
        try {
          const projects = await this.scanDirectory(dir);
          discovered.push(...projects);
        } catch {
          // Skip inaccessible directories
        }
      }
    }

    // Deduplicate by path
    const seen = new Set<string>();
    return discovered.filter(project => {
      const normalizedPath = path.resolve(project.path).toLowerCase();
      if (seen.has(normalizedPath)) {
        return false;
      }
      seen.add(normalizedPath);
      return true;
    });
  }

  /**
   * Scan a specific directory for projects
   */
  async scanDirectory(dirPath: string): Promise<DiscoveredProject[]> {
    const discovered: DiscoveredProject[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Skip hidden directories and common non-project directories
        if (entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === '__pycache__' ||
            entry.name === 'venv' ||
            entry.name === '.venv') {
          continue;
        }

        const projectPath = path.join(dirPath, entry.name);
        const project = await this.analyzeProject(projectPath);

        if (project) {
          discovered.push(project);
        }
      }
    } catch {
      // Directory not accessible
    }

    return discovered;
  }

  /**
   * Analyze a single directory to determine if it's a project
   */
  private async analyzeProject(projectPath: string): Promise<DiscoveredProject | null> {
    const normalizedPath = path.resolve(projectPath).toLowerCase();
    const name = path.basename(projectPath);

    // Check if it's a git repo
    const isGitRepo = await this.hasDirectory(projectPath, '.git');

    // Only consider git repos as projects
    if (!isGitRepo) {
      return null;
    }

    // Check if Ralph-ready
    const isRalphReady = await this.checkRalphReady(projectPath);

    // Check if already registered
    const alreadyRegistered = this.registeredPaths.has(normalizedPath);

    return {
      path: projectPath,
      name,
      isGitRepo,
      isRalphReady,
      alreadyRegistered,
    };
  }

  /**
   * Check if a project is Ralph-ready
   */
  private async checkRalphReady(projectPath: string): Promise<boolean> {
    const checks = await Promise.all([
      this.hasFile(projectPath, 'AGENTS.md'),
      this.hasFile(projectPath, 'CLAUDE.md'),
      this.hasFile(projectPath, 'IMPLEMENTATION_PLAN.md'),
    ]);

    return checks.some(exists => exists);
  }

  /**
   * Check if a file exists in a directory
   */
  private async hasFile(dir: string, filename: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path.join(dir, filename));
      return stat.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Check if a subdirectory exists
   */
  private async hasDirectory(dir: string, subdir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path.join(dir, subdir));
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Scan a custom path provided by the user
   */
  async scanCustomPath(customPath: string): Promise<DiscoveredProject[]> {
    const discovered: DiscoveredProject[] = [];

    try {
      const stat = await fs.stat(customPath);

      if (stat.isDirectory()) {
        // Check if the path itself is a project
        const project = await this.analyzeProject(customPath);
        if (project) {
          discovered.push(project);
        }

        // Also scan subdirectories
        const subProjects = await this.scanDirectory(customPath);
        discovered.push(...subProjects);
      }
    } catch {
      // Path not accessible
    }

    return discovered;
  }
}

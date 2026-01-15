/**
 * Project Registry - CRUD operations for managing registered projects
 * Persists project list to ~/.ralph/projects.json
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import type { LauncherProject } from '../src/types/index.js';

const RALPH_DIR = path.join(os.homedir(), '.ralph');
const PROJECTS_FILE = path.join(RALPH_DIR, 'projects.json');

interface ProjectsData {
  version: number;
  projects: LauncherProject[];
}

export class ProjectRegistry {
  private projects: LauncherProject[] = [];
  private initialized = false;

  /**
   * Initialize the registry by loading from disk
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(RALPH_DIR, { recursive: true });
      const data = await fs.readFile(PROJECTS_FILE, 'utf-8');
      const parsed: ProjectsData = JSON.parse(data);
      this.projects = parsed.projects || [];
    } catch {
      // File doesn't exist or is invalid - start with empty list
      this.projects = [];
    }

    this.initialized = true;
  }

  /**
   * Save current project list to disk
   */
  private async save(): Promise<void> {
    const data: ProjectsData = {
      version: 1,
      projects: this.projects,
    };
    await fs.writeFile(PROJECTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Get all registered projects
   */
  async listProjects(): Promise<LauncherProject[]> {
    await this.init();
    return [...this.projects];
  }

  /**
   * Add a new project
   */
  async addProject(projectPath: string): Promise<LauncherProject> {
    await this.init();

    // Normalize the path
    const normalizedPath = path.resolve(projectPath);

    // Check if already registered
    const existing = this.projects.find(p => path.resolve(p.path) === normalizedPath);
    if (existing) {
      throw new Error(`Project already registered: ${existing.name}`);
    }

    // Verify the path exists
    try {
      const stat = await fs.stat(normalizedPath);
      if (!stat.isDirectory()) {
        throw new Error('Path is not a directory');
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('Directory does not exist');
      }
      throw err;
    }

    // Check if Ralph-ready (has AGENTS.md or CLAUDE.md)
    const isRalphReady = await this.checkRalphReady(normalizedPath);

    // Extract project name from path
    const name = path.basename(normalizedPath);

    const project: LauncherProject = {
      id: randomUUID(),
      path: normalizedPath,
      name,
      addedAt: new Date().toISOString(),
      isRalphReady,
    };

    this.projects.push(project);
    await this.save();

    return project;
  }

  /**
   * Remove a project by ID
   */
  async removeProject(projectId: string): Promise<void> {
    await this.init();

    const index = this.projects.findIndex(p => p.id === projectId);
    if (index === -1) {
      throw new Error('Project not found');
    }

    this.projects.splice(index, 1);
    await this.save();
  }

  /**
   * Get a single project by ID
   */
  async getProject(projectId: string): Promise<LauncherProject | null> {
    await this.init();
    return this.projects.find(p => p.id === projectId) || null;
  }

  /**
   * Update a project's lastOpened timestamp
   */
  async updateLastOpened(projectId: string): Promise<void> {
    await this.init();

    const project = this.projects.find(p => p.id === projectId);
    if (project) {
      project.lastOpened = new Date().toISOString();
      await this.save();
    }
  }

  /**
   * Re-check and update Ralph-ready status for a project
   */
  async refreshRalphStatus(projectId: string): Promise<boolean> {
    await this.init();

    const project = this.projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const isReady = await this.checkRalphReady(project.path);
    project.isRalphReady = isReady;
    await this.save();

    return isReady;
  }

  /**
   * Check if a project path is Ralph-ready
   * A project is Ralph-ready if it has AGENTS.md or CLAUDE.md
   */
  private async checkRalphReady(projectPath: string): Promise<boolean> {
    const checks = await Promise.all([
      this.fileExists(path.join(projectPath, 'AGENTS.md')),
      this.fileExists(path.join(projectPath, 'CLAUDE.md')),
      this.fileExists(path.join(projectPath, 'IMPLEMENTATION_PLAN.md')),
    ]);

    // Ralph-ready if at least one of these exists
    return checks.some(exists => exists);
  }

  /**
   * Helper to check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

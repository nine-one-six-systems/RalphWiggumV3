/**
 * Project Registry - CRUD operations for managing registered projects
 *
 * This is now a thin wrapper around ProjectRepository for backwards compatibility.
 * The actual data is stored in SQLite (~/.ralph/ralph.db).
 */

import { getProjectRepository, ProjectRepository } from './database/repositories/ProjectRepository.js';
import type { LauncherProject } from '../src/types/index.js';

export class ProjectRegistry {
  private repository: ProjectRepository;
  private initialized = false;

  constructor() {
    this.repository = getProjectRepository();
  }

  /**
   * Initialize the registry
   * This is now a no-op since SQLite handles initialization automatically,
   * but kept for backwards compatibility.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }

  /**
   * Get all registered projects
   */
  async listProjects(): Promise<LauncherProject[]> {
    await this.init();
    return this.repository.listProjects();
  }

  /**
   * Add a new project
   */
  async addProject(projectPath: string): Promise<LauncherProject> {
    await this.init();
    return this.repository.addProject(projectPath);
  }

  /**
   * Remove a project by ID
   */
  async removeProject(projectId: string): Promise<void> {
    await this.init();
    this.repository.removeProject(projectId);
  }

  /**
   * Get a single project by ID
   */
  async getProject(projectId: string): Promise<LauncherProject | null> {
    await this.init();
    return this.repository.getProject(projectId);
  }

  /**
   * Update a project's lastOpened timestamp
   */
  async updateLastOpened(projectId: string): Promise<void> {
    await this.init();
    this.repository.updateLastOpened(projectId);
  }

  /**
   * Re-check and update Ralph-ready status for a project
   */
  async refreshRalphStatus(projectId: string): Promise<boolean> {
    await this.init();
    return this.repository.refreshRalphStatus(projectId);
  }
}

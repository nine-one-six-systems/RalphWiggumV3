/**
 * Port Manager - Dynamic port allocation for dashboard instances
 * Manages port ranges and checks availability
 */

import net from 'net';

// Port ranges for different services
// Launcher uses 3001/5173 (default dashboard ports)
// Instances start from 3002/5174 and increment
const BACKEND_PORT_START = 3002;
const FRONTEND_PORT_START = 5174;
const MAX_INSTANCES = 20;  // Maximum concurrent instances

export interface PortPair {
  backendPort: number;
  frontendPort: number;
}

export class PortManager {
  // Track allocated ports
  private allocatedBackendPorts: Set<number> = new Set();
  private allocatedFrontendPorts: Set<number> = new Set();

  /**
   * Allocate a new port pair for an instance
   * Returns the next available backend/frontend port pair
   */
  async allocate(): Promise<PortPair> {
    for (let i = 0; i < MAX_INSTANCES; i++) {
      const backendPort = BACKEND_PORT_START + i;
      const frontendPort = FRONTEND_PORT_START + i;

      // Skip if already allocated by us
      if (this.allocatedBackendPorts.has(backendPort) ||
          this.allocatedFrontendPorts.has(frontendPort)) {
        continue;
      }

      // Check if ports are actually available on the system
      const backendAvailable = await this.isPortAvailable(backendPort);
      const frontendAvailable = await this.isPortAvailable(frontendPort);

      if (backendAvailable && frontendAvailable) {
        this.allocatedBackendPorts.add(backendPort);
        this.allocatedFrontendPorts.add(frontendPort);
        return { backendPort, frontendPort };
      }
    }

    throw new Error('No available ports. Maximum concurrent instances reached.');
  }

  /**
   * Release a port pair when an instance is stopped
   */
  release(backendPort: number, frontendPort: number): void {
    this.allocatedBackendPorts.delete(backendPort);
    this.allocatedFrontendPorts.delete(frontendPort);
  }

  /**
   * Check if a specific port is available
   */
  async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false);
      });

      server.once('listening', () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Get count of currently allocated instances
   */
  getAllocatedCount(): number {
    return this.allocatedBackendPorts.size;
  }

  /**
   * Check if we can allocate more instances
   */
  hasCapacity(): boolean {
    return this.allocatedBackendPorts.size < MAX_INSTANCES;
  }
}

import './index.css'
import { Dashboard } from './components/Dashboard'
import { LauncherHome } from './components/launcher/LauncherHome'

/**
 * App - Main entry point that routes between Launcher and Dashboard views
 *
 * The app can run in two modes:
 * 1. Launcher mode (?mode=launcher) - Shows the project launcher
 * 2. Dashboard mode (default) - Shows the project dashboard
 *
 * When running as a launcher, clicking "Open Dashboard" spawns separate
 * dashboard instances on different ports.
 */
function App() {
  // Check URL params for launcher mode and backend port
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  const backendPort = urlParams.get('backend');

  // Show launcher if mode=launcher, otherwise show dashboard
  if (mode === 'launcher') {
    return <LauncherHome />
  }

  // Pass custom backend port if specified (for multi-instance support)
  return <Dashboard backendPort={backendPort ? parseInt(backendPort, 10) : undefined} />
}

export default App

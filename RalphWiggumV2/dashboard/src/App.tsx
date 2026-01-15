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
  // Check URL params for launcher mode
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');

  // Show launcher if mode=launcher, otherwise show dashboard
  if (mode === 'launcher') {
    return <LauncherHome />
  }

  return <Dashboard />
}

export default App

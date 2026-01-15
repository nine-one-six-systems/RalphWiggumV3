# Dependency Checker

## User Story

**As a** developer setting up Ralph Wiggum
**I want to** verify all required dependencies are installed
**So that** I can fix any issues before running the build loop

## Problem Statement

New users may not have all required tools installed:
- Claude CLI (required for Ralph loops)
- Node.js (required for dashboard)
- npm (required for package management)
- git (required for version control)

Currently there's no way to check these from the dashboard.

## Acceptance Criteria

### AC-1: Dependencies Tab in Setup
- [ ] New "Dependencies" tab in Setup section
- [ ] Auto-checks dependencies when tab opens
- [ ] Refresh button to re-check

### AC-2: Claude CLI Check
- [ ] Shows if Claude CLI is installed
- [ ] Shows version if available
- [ ] Shows path to executable
- [ ] Links to installation instructions if missing

### AC-3: Node.js Check
- [ ] Shows Node.js version
- [ ] Shows path to executable
- [ ] Warns if version is too old

### AC-4: npm Check
- [ ] Shows npm version
- [ ] Shows path to executable

### AC-5: git Check
- [ ] Shows git version
- [ ] Shows path to executable

### AC-6: Visual Status
- [ ] Green checkmark for available tools
- [ ] Red X for missing tools
- [ ] Version and path displayed
- [ ] Installation links for missing tools

## Implementation Details

### Files to Create/Modify

| File | Changes |
|------|---------|
| `dashboard/server/dependencyChecker.ts` | NEW - Dependency checking logic |
| `dashboard/src/components/setup/DependencyChecker.tsx` | NEW - UI component |
| `dashboard/server/index.ts` | Add dependencies:check handler |
| `dashboard/src/types/index.ts` | Add DependencyCheckResult type |
| `dashboard/src/hooks/useWebSocket.ts` | Add dependency state |
| `dashboard/src/components/setup/SetupWizard.tsx` | Add Dependencies tab |
| `dashboard/src/components/Dashboard.tsx` | Pass dependency props |

### dependencyChecker.ts

```typescript
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface DependencyStatus {
  name: string;
  available: boolean;
  version?: string;
  path?: string;
  installUrl?: string;
}

export interface DependencyCheckResult {
  claude: DependencyStatus;
  node: DependencyStatus;
  npm: DependencyStatus;
  git: DependencyStatus;
  checkedAt: Date;
}

export async function checkDependencies(): Promise<DependencyCheckResult> {
  const [claude, node, npm, git] = await Promise.all([
    checkClaude(),
    checkNode(),
    checkNpm(),
    checkGit(),
  ]);

  return { claude, node, npm, git, checkedAt: new Date() };
}

async function checkClaude(): Promise<DependencyStatus> {
  try {
    const { stdout } = await execAsync('claude --version');
    const version = stdout.trim();
    const { stdout: pathOut } = await execAsync(
      process.platform === 'win32' ? 'where claude' : 'which claude'
    );
    return {
      name: 'Claude CLI',
      available: true,
      version,
      path: pathOut.trim().split('\n')[0],
    };
  } catch {
    return {
      name: 'Claude CLI',
      available: false,
      installUrl: 'https://docs.anthropic.com/claude-code/getting-started',
    };
  }
}

// Similar functions for node, npm, git...
```

### DependencyChecker.tsx

```tsx
export function DependencyChecker({ result, onRefresh, loading }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>System Dependencies</CardTitle>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {result ? (
          <div className="space-y-4">
            <DependencyRow dep={result.claude} />
            <DependencyRow dep={result.node} />
            <DependencyRow dep={result.npm} />
            <DependencyRow dep={result.git} />
          </div>
        ) : (
          <p className="text-muted-foreground">Checking dependencies...</p>
        )}
      </CardContent>
    </Card>
  );
}

function DependencyRow({ dep }: { dep: DependencyStatus }) {
  return (
    <div className="flex items-center justify-between p-3 rounded border">
      <div className="flex items-center gap-3">
        {dep.available ? (
          <CheckCircle className="text-green-500" />
        ) : (
          <XCircle className="text-red-500" />
        )}
        <div>
          <p className="font-medium">{dep.name}</p>
          {dep.version && <p className="text-sm text-muted-foreground">{dep.version}</p>}
          {dep.path && <p className="text-xs text-muted-foreground font-mono">{dep.path}</p>}
        </div>
      </div>
      {!dep.available && dep.installUrl && (
        <Button variant="outline" size="sm" asChild>
          <a href={dep.installUrl} target="_blank" rel="noopener noreferrer">
            Install
          </a>
        </Button>
      )}
    </div>
  );
}
```

## Required Tests

1. **All Dependencies Available**
   - Start dashboard with all tools installed
   - Verify all show green checkmarks
   - Verify versions and paths displayed

2. **Missing Dependency**
   - Simulate missing Claude CLI (rename temporarily)
   - Verify shows red X
   - Verify "Install" button links to correct URL

3. **Refresh Button**
   - Click refresh
   - Verify re-checks all dependencies
   - Verify loading state shown

4. **Auto-Check on Tab Open**
   - Navigate to Dependencies tab
   - Verify check runs automatically

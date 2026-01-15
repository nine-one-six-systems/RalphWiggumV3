# Agent Installation from Dashboard

## User Story

**As a** developer using Ralph Wiggum
**I want to** install specialist agents from the dashboard with one click
**So that** Claude can delegate to specialized agents during the build loop

## Problem Statement

Users need to:
1. Create agent definition files in the repo so they're committed to GitHub
2. Install agents globally (~/.claude/agents/) with a button click
3. Install agents to project (.claude/agents/) with a button click
4. Have agents ready to use after cloning the repo

Currently, there's no UI for agent installation and no agent files exist in the repo.

## Acceptance Criteria

### AC-1: Agent Definition Files
- [ ] At least 4 agent files exist in RalphWiggumV2/.claude/agents/
- [ ] Each file has YAML frontmatter with name and description
- [ ] Files are committed to git
- [ ] Agents cover: React/TS, Accessibility, QoL UX, Go Backend

### AC-2: List Repo Agents
- [ ] Dashboard shows agents available in Ralph repo
- [ ] "Available for Installation" section distinct from installed agents
- [ ] Shows agent name, description, and source badge

### AC-3: Install to Global
- [ ] "Global" button installs agent to ~/.claude/agents/
- [ ] Button shows loading state during installation
- [ ] Button disabled after successful install
- [ ] Available agents list refreshes after install

### AC-4: Install to Project
- [ ] "Project" button installs agent to .claude/agents/
- [ ] Creates directory if it doesn't exist
- [ ] Button shows loading state during installation
- [ ] Available agents list refreshes after install

### AC-5: Install All
- [ ] "Install All Global" button in header
- [ ] Installs all repo agents to global location
- [ ] Shows loading state during operation

## Implementation Details

### Agent Files to Create

`RalphWiggumV2/.claude/agents/react-typescript-expert.md`:
```markdown
---
name: React TypeScript Expert
description: React architecture, hooks, state, TypeScript types, code reviews, performance optimization
---

## Role
You are a React and TypeScript expert specializing in modern React patterns.

## Responsibilities
- Review React component architecture
- Optimize hooks usage and state management
- Ensure TypeScript types are properly defined
- Identify performance bottlenecks
- Suggest best practices for React 18+ features
```

Similar files for:
- `accessibility-expert.md`
- `qol-ux-expert.md`
- `golang-backend-expert.md`

### Files to Modify

| File | Changes |
|------|---------|
| `dashboard/server/projectConfig.ts` | Add installAgentGlobal, installAgentProject, listRepoAgents methods |
| `dashboard/server/index.ts` | Add WebSocket handlers for install commands |
| `dashboard/src/types/index.ts` | Add AgentInfo 'repo' source, command types |
| `dashboard/src/hooks/useWebSocket.ts` | Add state and callbacks for installation |
| `dashboard/src/components/setup/SpecialistAgentsConfig.tsx` | Add install buttons, repo agents section |
| `dashboard/src/components/Dashboard.tsx` | Wire up new props |

### Key Methods in projectConfig.ts

```typescript
async installAgentGlobal(agentId: string): Promise<void> {
  const sourcePath = path.join(this.ralphPath, '.claude', 'agents', `${agentId}.md`);
  const globalDir = path.join(os.homedir(), '.claude', 'agents');
  const destPath = path.join(globalDir, `${agentId}.md`);
  
  await fs.mkdir(globalDir, { recursive: true });
  const content = await fs.readFile(sourcePath, 'utf-8');
  await fs.writeFile(destPath, content, 'utf-8');
}

async installAgentProject(agentId: string): Promise<void> {
  const sourcePath = path.join(this.ralphPath, '.claude', 'agents', `${agentId}.md`);
  const projectDir = path.join(this.projectPath, '.claude', 'agents');
  const destPath = path.join(projectDir, `${agentId}.md`);
  
  await fs.mkdir(projectDir, { recursive: true });
  const content = await fs.readFile(sourcePath, 'utf-8');
  await fs.writeFile(destPath, content, 'utf-8');
}

async listRepoAgents(): Promise<AgentInfo[]> {
  const agentsDir = path.join(this.ralphPath, '.claude', 'agents');
  // Parse each .md file and return AgentInfo array
}
```

## UI Mockup

```
┌─────────────────────────────────────────────────────────────────┐
│ Specialist Agents                              [Install All Global] │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌─ Available for Installation ─────────────────────────────────┐ │
│ │  from RalphWiggumV2/.claude/agents/                          │ │
│ │                                                               │ │
│ │  [Icon] React TypeScript Expert           [Global] [Project] │ │
│ │         React architecture, hooks...      (buttons)          │ │
│ │                                                               │ │
│ │  [Icon] Accessibility Expert              [Installed] [Project] │
│ │         WCAG 2.2 compliance...            (disabled)         │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─ Global Agents ──────────────────────────────────────────────┐ │
│ │  ~/.claude/agents/                                           │ │
│ │                                                               │ │
│ │  [Icon] Accessibility Expert     [Global] [Enabled]  [Toggle] │ │
│ └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Required Tests

1. **Agent Files Exist Test**
   - Verify 4 agent files in RalphWiggumV2/.claude/agents/
   - Each has valid YAML frontmatter
   - Files are tracked by git

2. **Install Global Test**
   - Click "Global" button for an agent
   - Verify file appears in ~/.claude/agents/
   - Verify agent moves to "Global Agents" section

3. **Install Project Test**
   - Click "Project" button for an agent
   - Verify file appears in .claude/agents/
   - Verify directory created if needed

4. **Install All Test**
   - Click "Install All Global"
   - Verify all repo agents copied to global location

5. **Clone Workflow Test**
   - Clone repo to new location
   - Open dashboard
   - Verify repo agents appear in "Available for Installation"

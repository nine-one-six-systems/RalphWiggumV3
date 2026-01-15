import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Bot, Code, Eye, Sparkles, Globe, FolderCode, Server, Download, CheckCircle } from 'lucide-react';
import type { AgentInfo, RepoAgentInfo } from '@/types';

interface SpecialistAgentsConfigProps {
  availableAgents: AgentInfo[];
  agentsLoading: boolean;
  onListAgents: () => void;
  onToggleAgent: (agentId: string, enabled: boolean) => void;
  // Repo agent installation props
  repoAgents: RepoAgentInfo[];
  repoAgentsLoading: boolean;
  agentInstalling: string | null;
  onListRepoAgents: () => void;
  onInstallAgentGlobal: (agentId: string) => void;
  onInstallAgentProject: (agentId: string) => void;
  onInstallAllAgentsGlobal: () => void;
}

const agentIcons: Record<string, typeof Bot> = {
  'react-typescript-expert': Code,
  'accessibility-expert': Eye,
  'qol-ux-expert': Sparkles,
  'golang-backend-expert': Server,
};

export function SpecialistAgentsConfig({
  availableAgents,
  agentsLoading,
  onListAgents,
  onToggleAgent,
  repoAgents,
  repoAgentsLoading,
  agentInstalling,
  onListRepoAgents,
  onInstallAgentGlobal,
  onInstallAgentProject,
  onInstallAllAgentsGlobal,
}: SpecialistAgentsConfigProps) {
  // Fetch agents on mount
  useEffect(() => {
    onListAgents();
    onListRepoAgents();
  }, [onListAgents, onListRepoAgents]);

  // Group agents by source
  const globalAgents = availableAgents.filter((a) => a.source === 'global');
  const projectAgents = availableAgents.filter((a) => a.source === 'project');

  // Check if any repo agents are not yet installed
  const uninstalledRepoAgents = repoAgents.filter((a) => !a.installedGlobal);
  const hasUninstalledAgents = uninstalledRepoAgents.length > 0;

  const renderAgent = (agent: AgentInfo) => {
    const Icon = agentIcons[agent.id] || Bot;
    return (
      <div
        key={agent.id}
        className="flex items-start gap-4 rounded-lg border p-4"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Label htmlFor={agent.id} className="font-semibold">
              {agent.name}
            </Label>
            <Badge variant={agent.source === 'global' ? 'outline' : 'secondary'} className="text-xs gap-1">
              {agent.source === 'global' ? (
                <><Globe className="h-3 w-3" /> Global</>
              ) : (
                <><FolderCode className="h-3 w-3" /> Project</>
              )}
            </Badge>
            <Badge variant={agent.enabled ? 'default' : 'secondary'} className="text-xs">
              {agent.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{agent.description}</p>
        </div>
        <Switch
          id={agent.id}
          checked={agent.enabled}
          onCheckedChange={(checked) => onToggleAgent(agent.id, checked)}
        />
      </div>
    );
  };

  const renderRepoAgent = (agent: RepoAgentInfo) => {
    const Icon = agentIcons[agent.id] || Bot;
    const isInstalling = agentInstalling === agent.id || agentInstalling === 'all';

    return (
      <div
        key={agent.id}
        className="flex items-start gap-4 rounded-lg border p-4"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Label className="font-semibold">{agent.name}</Label>
            {agent.installedGlobal && (
              <Badge variant="outline" className="text-xs gap-1">
                <CheckCircle className="h-3 w-3" /> Global
              </Badge>
            )}
            {agent.installedProject && (
              <Badge variant="secondary" className="text-xs gap-1">
                <CheckCircle className="h-3 w-3" /> Project
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{agent.description}</p>
        </div>
        <div className="flex gap-2">
          {!agent.installedGlobal && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onInstallAgentGlobal(agent.id)}
              disabled={isInstalling}
            >
              {isInstalling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <><Download className="h-4 w-4 mr-1" /> Global</>
              )}
            </Button>
          )}
          {!agent.installedProject && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onInstallAgentProject(agent.id)}
              disabled={isInstalling}
            >
              {isInstalling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <><Download className="h-4 w-4 mr-1" /> Project</>
              )}
            </Button>
          )}
          {agent.installedGlobal && agent.installedProject && (
            <Badge variant="success" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" /> Installed
            </Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Specialist Agents
        </CardTitle>
        <CardDescription>
          Enable or disable specialist agents that provide code review and quality checks during
          implementation. Agents from ~/.claude/agents/ are available globally, while project
          agents in .claude/agents/ are project-specific.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Repo Agents Available for Installation */}
        {repoAgentsLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading available agents...</span>
          </div>
        ) : repoAgents.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Download className="h-4 w-4" />
                Available Agents from Ralph
              </h3>
              {hasUninstalledAgents && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onInstallAllAgentsGlobal}
                  disabled={agentInstalling !== null}
                >
                  {agentInstalling === 'all' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
                  )}
                  Install All Globally
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {repoAgents.map(renderRepoAgent)}
            </div>
          </div>
        )}

        {agentsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading installed agents...</span>
          </div>
        ) : availableAgents.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Bot className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-4 font-semibold">No Installed Agents</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No agent files found in ~/.claude/agents/ or .claude/agents/.
              {repoAgents.length > 0 && " Install agents from the list above to get started."}
            </p>
          </div>
        ) : (
          <>
            {/* Global Agents Section */}
            {globalAgents.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  Installed Global Agents
                  <span className="text-xs">~/.claude/agents/</span>
                </h3>
                <div className="space-y-3">
                  {globalAgents.map(renderAgent)}
                </div>
              </div>
            )}

            {/* Project Agents Section */}
            {projectAgents.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FolderCode className="h-4 w-4" />
                  Installed Project Agents
                  <span className="text-xs">.claude/agents/</span>
                </h3>
                <div className="space-y-3">
                  {projectAgents.map(renderAgent)}
                </div>
              </div>
            )}

            {/* Empty project agents placeholder */}
            {projectAgents.length === 0 && globalAgents.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FolderCode className="h-4 w-4" />
                  Project Agents
                </h3>
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No project-specific agents installed. Install agents to project scope to override global settings.
                </div>
              </div>
            )}
          </>
        )}

        <div className="rounded-lg bg-muted/50 p-4">
          <h4 className="mb-2 font-medium">How Specialist Agents Work</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Specialist agents are invoked through the Task tool when implementing complex
              features. They are defined as Markdown files with YAML frontmatter:
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong>Global agents</strong> (~/.claude/agents/): Available in all projects
              </li>
              <li>
                <strong>Project agents</strong> (.claude/agents/): Override global or add project-specific agents
              </li>
            </ul>
            <p className="mt-3">
              Toggle agents on/off to control which specialists Claude can delegate to.
              Install new agents from Ralph to expand capabilities.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

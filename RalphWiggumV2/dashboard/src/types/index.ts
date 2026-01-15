export type LoopMode = 'plan' | 'plan-slc' | 'plan-work' | 'build' | 'review';

export interface LoopStatus {
  running: boolean;
  mode: LoopMode | null;
  iteration: number;
  maxIterations: number;
  workScope?: string;
  startedAt?: Date;
  pid?: number;
}

export interface Task {
  id: string;
  content: string;
  completed: boolean;
  priority?: number;
}

export interface TasksState {
  tasks: Task[];
  completed: number;
  total: number;
  lastUpdated?: Date;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: Date;
}

export interface GitStatus {
  branch: string;
  uncommittedCount: number;
  commits: GitCommit[];
  lastUpdated?: Date;
  remoteUrl?: string;
  repoName?: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  content: string;
  type: 'info' | 'error' | 'warning' | 'success';
}

export interface ProjectConfig {
  projectPath: string;
  hasAgentsMd: boolean;
  hasClaudeMd: boolean;
  hasImplementationPlan: boolean;
  hasPRD: boolean;
  hasAudienceJTBD: boolean;
  hasSpecs: boolean;
  hasCursorRules: boolean;
  hasLoopSh: boolean;
  enabledAgents: string[];
}

export interface AgentsConfig {
  buildCommand: string;
  runCommand: string;
  devCommand: string;
  testCommand: string;
  typecheckCommand: string;
  lintCommand: string;
  operationalNotes: string;
  codebasePatterns: string;
}

export interface SpecialistAgent {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export const SPECIALIST_AGENTS: SpecialistAgent[] = [
  {
    id: 'react-typescript-expert',
    name: 'React TypeScript Expert',
    description: 'React architecture, hooks, state, TypeScript types, code reviews, performance optimization',
    enabled: true,
  },
  {
    id: 'accessibility-expert',
    name: 'Accessibility Expert',
    description: 'WCAG 2.2 compliance, ARIA patterns, keyboard navigation, screen reader support, focus management',
    enabled: true,
  },
  {
    id: 'qol-ux-expert',
    name: 'QoL UX Expert',
    description: 'Loading states, toasts, forms UX, dark mode, animations, responsive patterns',
    enabled: true,
  },
];

// Dynamic agent info from file system
export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  source: 'global' | 'project';
  enabled: boolean;
  filePath: string;
}

// Cursor rule info from .cursor/rules/
export interface CursorRuleInfo {
  id: string;
  name: string;
  description: string;
  globs: string[];
  enabled: boolean;
  filePath: string;
}

// WebSocket message types
export interface WSMessage {
  type: string;
  payload: unknown;
}

export interface LoopStatusMessage extends WSMessage {
  type: 'loop:status';
  payload: LoopStatus;
}

export interface LogMessage extends WSMessage {
  type: 'loop:log';
  payload: LogEntry;
}

export interface TasksMessage extends WSMessage {
  type: 'tasks:update';
  payload: TasksState;
}

export interface GitMessage extends WSMessage {
  type: 'git:update';
  payload: GitStatus;
}

export interface ConfigMessage extends WSMessage {
  type: 'config:update';
  payload: ProjectConfig;
}

export interface ConfigSavedMessage extends WSMessage {
  type: 'config:saved';
  payload: {
    file: string;
  };
}

export interface ConfigContentMessage extends WSMessage {
  type: 'config:content';
  payload: {
    file: string;
    content: string;
  };
}

export interface AgentsUpdateMessage extends WSMessage {
  type: 'agents:update';
  payload: {
    enabledAgents: string[];
  };
}

// Plan generation messages
export interface PlanGeneratorStatus {
  generating: boolean;
  mode: 'plan' | 'plan-slc' | 'plan-work' | null;
  startedAt: Date | null;
}

export interface PlanStatusMessage extends WSMessage {
  type: 'plan:status';
  payload: PlanGeneratorStatus;
}

export interface PlanOutputMessage extends WSMessage {
  type: 'plan:output';
  payload: { text: string };
}

export interface PlanLogMessage extends WSMessage {
  type: 'plan:log';
  payload: { text: string };
}

export interface PlanCompleteMessage extends WSMessage {
  type: 'plan:complete';
  payload: { plan: string; output: string };
}

export interface PlanErrorMessage extends WSMessage {
  type: 'plan:error';
  payload: { error: string };
}

// PRD generation messages
export interface PRDGeneratorStatus {
  generating: boolean;
  startedAt: Date | null;
}

export interface PRDStatusMessage extends WSMessage {
  type: 'prd:status';
  payload: PRDGeneratorStatus;
}

export interface PRDOutputMessage extends WSMessage {
  type: 'prd:output';
  payload: { text: string };
}

export interface PRDCompleteMessage extends WSMessage {
  type: 'prd:complete';
  payload: { prd: string; audience: string };
}

export interface PRDErrorMessage extends WSMessage {
  type: 'prd:error';
  payload: { error: string };
}

// Document content messages (for PRD context)
export interface DocsContentMessage extends WSMessage {
  type: 'docs:content';
  payload: { path: string; content: string };
}

export interface DocsErrorMessage extends WSMessage {
  type: 'docs:error';
  payload: { error: string };
}

export type ServerMessage =
  | LoopStatusMessage
  | LogMessage
  | TasksMessage
  | GitMessage
  | ConfigMessage
  | ConfigSavedMessage
  | ConfigContentMessage
  | AgentsUpdateMessage
  | AgentsListResultMessage
  | RulesListResultMessage
  | RulesUpdateMessage
  | PlanStatusMessage
  | PlanOutputMessage
  | PlanLogMessage
  | PlanCompleteMessage
  | PlanErrorMessage
  | PRDStatusMessage
  | PRDOutputMessage
  | PRDCompleteMessage
  | PRDErrorMessage
  | DocsContentMessage
  | DocsErrorMessage
  | ProjectScanMessage
  | ProjectInfoMessage
  | ClaudeMdListResultMessage
  | ClaudeMdContentMessage
  | ClaudeMdAppliedMessage
  | ClaudeMdErrorMessage
  | DependenciesResultMessage
  | DependenciesErrorMessage
  | RepoAgentsResultMessage
  | AgentInstalledMessage
  | AgentErrorMessage
  | LauncherProjectsListMessage
  | LauncherProjectAddedMessage
  | LauncherProjectRemovedMessage
  | LauncherInstancesListMessage
  | LauncherInstanceSpawnedMessage
  | LauncherInstanceStoppedMessage
  | LauncherInstanceCrashedMessage
  | LauncherDiscoverResultMessage
  | LauncherErrorMessage
  | LauncherBrowseResultMessage
  | ReviewStatusMessage
  | ReviewOutputMessage
  | ReviewCompleteMessage
  | ReviewErrorMessage
  | ReviewGeneratorStatusMessage
  | ReviewGeneratorOutputMessage
  | ReviewGeneratorCompleteMessage
  | ReviewGeneratorErrorMessage;

// Client commands
export interface StartLoopCommand {
  type: 'loop:start';
  payload: {
    mode: LoopMode;
    maxIterations?: number;
    workScope?: string;
  };
}

export interface StopLoopCommand {
  type: 'loop:stop';
}

export interface ReadConfigCommand {
  type: 'config:read';
  payload: {
    file: string;
  };
}

export interface WriteConfigCommand {
  type: 'config:write';
  payload: {
    file: string;
    content: string;
  };
}

export interface RefreshConfigCommand {
  type: 'config:refresh';
}

export interface ToggleAgentCommand {
  type: 'agents:toggle';
  payload: {
    agentId: string;
    enabled: boolean;
  };
}

export interface GeneratePlanCommand {
  type: 'plan:generate';
  payload: {
    goal: string;
    mode: 'plan' | 'plan-slc' | 'plan-work';
    workScope?: string;
    usePrdContext?: boolean;  // Include PRD.md and AUDIENCE_JTBD.md as context
  };
}

export interface CancelPlanCommand {
  type: 'plan:cancel';
}

export interface ClearPlanOutputCommand {
  type: 'plan:clear';
}

export interface GeneratePRDCommand {
  type: 'prd:generate';
  payload: {
    productName: string;
    problemStatement: string;
    targetAudience: string;
    keyCapabilities: string[];
    contextDocs?: string[];  // Optional array of doc paths to include as context
    docsOnly?: boolean;      // If true, generate PRD from docs only without form fields
  };
}

export interface CancelPRDCommand {
  type: 'prd:cancel';
}

// Document reading command
export interface ReadDocCommand {
  type: 'docs:read';
  payload: {
    docPath: string;
  };
}

// Project info (from project root detector)
export interface ProjectInfo {
  targetProjectPath: string;
  ralphPath: string;
  mode: 'embedded' | 'standalone';
  detectionReason: string;
}

export interface ProjectInfoMessage extends WSMessage {
  type: 'project:info';
  payload: ProjectInfo;
}

// Subproject detected within a monorepo/multi-project structure
export interface SubProject {
  name: string;
  path: string;
  language: 'typescript' | 'javascript' | 'go' | 'python' | 'unknown';
  framework: string | null;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | null;
}

// Discovered markdown document for PRD context selection
export interface DiscoveredDoc {
  path: string;           // Relative path from project root
  name: string;           // File basename
  size: number;           // File size in bytes
  directory: string;      // Parent directory (for grouping in UI)
}

// Project scanning types
export interface ProjectScan {
  projectName: string;
  projectPath: string;
  scanMode: 'embedded' | 'standalone';
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | null;
  framework: string | null;
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'mixed' | 'unknown';
  detectedCommands: {
    build?: string;
    dev?: string;
    test?: string;
    lint?: string;
    typecheck?: string;
  };
  existingDocs: Array<{
    path: string;
    name: string;
    size: number;
  }>;
  // All discovered markdown files for PRD context selection
  allMarkdownFiles: DiscoveredDoc[];
  hasRalphConfig: {
    agentsMd: boolean;
    claudeMd: boolean;
    implementationPlan: boolean;
    loopSh: boolean;
    specsDir: boolean;
    cursorRules: boolean;
  };
  hasRalphSubdirectory: boolean;
  structure: Array<{
    path: string;
    type: 'dir' | 'file';
  }>;
  subprojects: SubProject[];
  isMonorepo: boolean;
}

export interface ProjectScanMessage extends WSMessage {
  type: 'project:scan-result';
  payload: ProjectScan;
}

export interface ScanProjectCommand {
  type: 'project:scan';
}

// Agent list messages
export interface AgentsListResultMessage extends WSMessage {
  type: 'agents:list-result';
  payload: AgentInfo[];
}

// Cursor rules messages
export interface RulesListResultMessage extends WSMessage {
  type: 'rules:list-result';
  payload: CursorRuleInfo[];
}

export interface RulesUpdateMessage extends WSMessage {
  type: 'rules:update';
  payload: CursorRuleInfo[];
}

// Agent list command
export interface ListAgentsCommand {
  type: 'agents:list';
}

// Cursor rules commands
export interface ListRulesCommand {
  type: 'rules:list';
}

export interface ToggleRuleCommand {
  type: 'rules:toggle';
  payload: {
    ruleId: string;
    enabled: boolean;
  };
}

// CLAUDE.md file info
export interface ClaudeMdFile {
  path: string;
  location: string;
  exists: boolean;
  lineCount: number;
}

// CLAUDE.md commands
export interface ListClaudeMdCommand {
  type: 'claude:list';
}

export interface ReadClaudeMdCommand {
  type: 'claude:read';
  payload: {
    path: string;
  };
}

export interface ApplyClaudeMdCommand {
  type: 'claude:apply';
}

// CLAUDE.md messages
export interface ClaudeMdListResultMessage extends WSMessage {
  type: 'claude:list-result';
  payload: ClaudeMdFile[];
}

export interface ClaudeMdContentMessage extends WSMessage {
  type: 'claude:content';
  payload: {
    path: string;
    content: string;
  };
}

export interface ClaudeMdAppliedMessage extends WSMessage {
  type: 'claude:applied';
}

export interface ClaudeMdErrorMessage extends WSMessage {
  type: 'claude:error';
  payload: {
    error: string;
  };
}

// Dependency check result
export interface DependencyCheckResult {
  id: string;
  name: string;
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}

// Dependency check commands
export interface CheckDependenciesCommand {
  type: 'dependencies:check';
}

// Dependency check messages
export interface DependenciesResultMessage extends WSMessage {
  type: 'dependencies:result';
  payload: DependencyCheckResult[];
}

export interface DependenciesErrorMessage extends WSMessage {
  type: 'dependencies:error';
  payload: {
    error: string;
  };
}

// Repo agent info (agents available in Ralph repo for installation)
export interface RepoAgentInfo {
  id: string;
  name: string;
  description: string;
  filePath: string;
  installedGlobal: boolean;
  installedProject: boolean;
}

// Agent installation commands
export interface ListRepoAgentsCommand {
  type: 'agents:list-repo';
}

export interface InstallAgentGlobalCommand {
  type: 'agents:install-global';
  payload: {
    agentId: string;
  };
}

export interface InstallAgentProjectCommand {
  type: 'agents:install-project';
  payload: {
    agentId: string;
  };
}

export interface InstallAllAgentsGlobalCommand {
  type: 'agents:install-all-global';
}

// Agent installation messages
export interface RepoAgentsResultMessage extends WSMessage {
  type: 'agents:repo-result';
  payload: RepoAgentInfo[];
}

export interface AgentInstalledMessage extends WSMessage {
  type: 'agents:installed';
  payload: {
    agentId: string;
    scope: 'global' | 'project';
  };
}

export interface AgentErrorMessage extends WSMessage {
  type: 'agents:error';
  payload: {
    error: string;
  };
}

export type ClientCommand =
  | StartLoopCommand
  | StopLoopCommand
  | ReadConfigCommand
  | WriteConfigCommand
  | RefreshConfigCommand
  | ToggleAgentCommand
  | ListAgentsCommand
  | ListRulesCommand
  | ToggleRuleCommand
  | GeneratePlanCommand
  | CancelPlanCommand
  | ClearPlanOutputCommand
  | GeneratePRDCommand
  | CancelPRDCommand
  | ReadDocCommand
  | ScanProjectCommand
  | ListClaudeMdCommand
  | ReadClaudeMdCommand
  | ApplyClaudeMdCommand
  | CheckDependenciesCommand
  | ListRepoAgentsCommand
  | InstallAgentGlobalCommand
  | InstallAgentProjectCommand
  | InstallAllAgentsGlobalCommand
  | LauncherListProjectsCommand
  | LauncherAddProjectCommand
  | LauncherRemoveProjectCommand
  | LauncherSpawnInstanceCommand
  | LauncherStopInstanceCommand
  | LauncherListInstancesCommand
  | LauncherDiscoverCommand
  | LauncherBrowseCommand
  | ReviewRunCommand
  | ReviewCancelCommand
  | GenerateReviewCommand
  | CancelReviewGeneratorCommand;

// ============================================================================
// Project Launcher Types (Feature Set 9)
// ============================================================================

// Project registered in the launcher
export interface LauncherProject {
  id: string;
  path: string;
  name: string;
  addedAt: string;  // ISO date string
  lastOpened?: string;  // ISO date string
  isRalphReady: boolean;
}

// Running dashboard instance
export interface LauncherInstance {
  projectId: string;
  backendPort: number;
  frontendPort: number;
  pid: number;
  startedAt: string;  // ISO date string
  loopStatus?: {
    running: boolean;
    iteration: number;
    mode: string;
  };
}

// Project discovered during auto-discovery scan
export interface DiscoveredProject {
  path: string;
  name: string;
  isGitRepo: boolean;
  isRalphReady: boolean;
  alreadyRegistered: boolean;
}

// Launcher WebSocket Commands
export interface LauncherListProjectsCommand {
  type: 'launcher:projects:list';
}

export interface LauncherAddProjectCommand {
  type: 'launcher:projects:add';
  payload: {
    path: string;
  };
}

export interface LauncherRemoveProjectCommand {
  type: 'launcher:projects:remove';
  payload: {
    projectId: string;
  };
}

export interface LauncherSpawnInstanceCommand {
  type: 'launcher:instance:spawn';
  payload: {
    projectId: string;
  };
}

export interface LauncherStopInstanceCommand {
  type: 'launcher:instance:stop';
  payload: {
    projectId: string;
  };
}

export interface LauncherListInstancesCommand {
  type: 'launcher:instances:list';
}

export interface LauncherDiscoverCommand {
  type: 'launcher:discover';
}

// Launcher WebSocket Server Messages
export interface LauncherProjectsListMessage extends WSMessage {
  type: 'launcher:projects:list';
  payload: LauncherProject[];
}

export interface LauncherProjectAddedMessage extends WSMessage {
  type: 'launcher:project:added';
  payload: LauncherProject;
}

export interface LauncherProjectRemovedMessage extends WSMessage {
  type: 'launcher:project:removed';
  payload: {
    projectId: string;
  };
}

export interface LauncherInstancesListMessage extends WSMessage {
  type: 'launcher:instances:list';
  payload: LauncherInstance[];
}

export interface LauncherInstanceSpawnedMessage extends WSMessage {
  type: 'launcher:instance:spawned';
  payload: LauncherInstance;
}

export interface LauncherInstanceStoppedMessage extends WSMessage {
  type: 'launcher:instance:stopped';
  payload: {
    projectId: string;
  };
}

export interface LauncherInstanceCrashedMessage extends WSMessage {
  type: 'launcher:instance:crashed';
  payload: {
    projectId: string;
    error: string;
  };
}

export interface LauncherDiscoverResultMessage extends WSMessage {
  type: 'launcher:discover:result';
  payload: DiscoveredProject[];
}

export interface LauncherErrorMessage extends WSMessage {
  type: 'launcher:error';
  payload: {
    error: string;
  };
}

// ============================================================================
// File Browser Types (Feature Set 12)
// ============================================================================

// Directory entry in file browser
export interface BrowseEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isGitRepo: boolean;
  isRalphReady: boolean;
}

// Result of browsing a directory
export interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  entries: BrowseEntry[];
  drives?: string[];  // Windows drive letters (C:, D:, etc.)
}

// File browser WebSocket command
export interface LauncherBrowseCommand {
  type: 'launcher:browse';
  payload: {
    path: string;  // Empty string or "/" for root/drives on Windows
  };
}

// File browser WebSocket message
export interface LauncherBrowseResultMessage extends WSMessage {
  type: 'launcher:browse:result';
  payload: BrowseResult;
}

// ============================================================================
// LLM-as-Judge Review Types (Feature Set 13)
// ============================================================================

// Configuration for running a review
export interface ReviewConfig {
  criteria: string;      // What to evaluate (behavioral, observable)
  artifact: string;      // Text content OR image path (.png, .jpg, .jpeg)
  artifactPath?: string; // Optional path context for image artifacts
}

// Result of a review
export interface ReviewResult {
  pass: boolean;
  feedback?: string;     // Only present when pass=false
  criteria: string;
  reviewedAt: string;    // ISO date string
}

// Review runner status
export interface ReviewRunnerStatus {
  running: boolean;
  startedAt: string | null;  // ISO date string
}

// Review WebSocket commands
export interface ReviewRunCommand {
  type: 'review:run';
  payload: ReviewConfig;
}

export interface ReviewCancelCommand {
  type: 'review:cancel';
}

// Review WebSocket messages
export interface ReviewStatusMessage extends WSMessage {
  type: 'review:status';
  payload: ReviewRunnerStatus;
}

export interface ReviewOutputMessage extends WSMessage {
  type: 'review:output';
  payload: { text: string };
}

export interface ReviewCompleteMessage extends WSMessage {
  type: 'review:complete';
  payload: ReviewResult;
}

export interface ReviewErrorMessage extends WSMessage {
  type: 'review:error';
  payload: { error: string };
}

// ============================================================================
// Code Review Generator Types (Feature Set 14 - Review Mode)
// ============================================================================

// Review Generator mode types
export type ReviewGeneratorMode = 'review' | 'review-quick' | 'review-spec';

// Status of review generation
export interface ReviewGeneratorStatus {
  generating: boolean;
  mode: ReviewGeneratorMode | null;
  startedAt: Date | null;
}

// Parsed review report data
export interface ReviewReportData {
  generatedAt: string;
  mode: string;
  duration: string;
  summary: {
    tasksClaimedComplete: number;
    actuallyVerifiedComplete: number;
    incompleteBroken: number;
    technicalDebtItems: number;
    missingTestCoverage: number;
  };
  healthScore: {
    completed: number;
    total: number;
    percentage: number;
  };
  verifiedComplete: Array<{
    taskId: string;
    description: string;
    evidence: string;
  }>;
  incompleteMarkedDone: Array<{
    taskId: string;
    description: string;
    issueType: string;
    details: string;
    file?: string;
  }>;
  technicalDebt: Array<{
    severity: 'High' | 'Medium' | 'Low';
    file: string;
    line: number;
    issue: string;
  }>;
  missingCoverage: Array<{
    spec: string;
    criterion: string;
    status: string;
  }>;
  recommendations: string[];
}

// Review Generator WebSocket Commands
export interface GenerateReviewCommand {
  type: 'review-generator:generate';
  payload: {
    mode: ReviewGeneratorMode;
    focusArea?: string;
    specFile?: string;
  };
}

export interface CancelReviewGeneratorCommand {
  type: 'review-generator:cancel';
}

// Review Generator WebSocket Messages
export interface ReviewGeneratorStatusMessage extends WSMessage {
  type: 'review-generator:status';
  payload: ReviewGeneratorStatus;
}

export interface ReviewGeneratorOutputMessage extends WSMessage {
  type: 'review-generator:output';
  payload: { text: string };
}

export interface ReviewGeneratorCompleteMessage extends WSMessage {
  type: 'review-generator:complete';
  payload: { report: string; output: string };
}

export interface ReviewGeneratorErrorMessage extends WSMessage {
  type: 'review-generator:error';
  payload: { error: string };
}

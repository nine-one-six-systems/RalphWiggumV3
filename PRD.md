# Product Requirements Document: RalphWiggumV2 Dashboard Enhancements

## Executive Summary

This PRD defines enhancements to the RalphWiggumV2 dashboard to improve the developer experience when using the Ralph Wiggum AI-assisted development methodology. The enhancements focus on workflow integration, progress visibility, cross-platform support, and agent management.

## Problem Statement

Developers using RalphWiggumV2 face several friction points:

1. **Disconnected Workflow**: PRD generation and plan generation are separate steps with no integration
2. **Poor Progress Visibility**: Implementation plan parser doesn't recognize common task formats
3. **Platform Limitations**: CLI flags work on Windows but fail on macOS/Linux
4. **Manual Agent Setup**: Installing specialist agents requires manual file copying
5. **Missing Feedback**: No confirmation when files are saved
6. **Dependency Blindspots**: No way to verify required tools are installed

## Goals

### Primary Goals
- Integrate PRD→Plan generation workflow
- Show accurate task progress for various plan formats
- Support all major platforms (Windows, macOS, Linux)
- Enable one-click agent installation

### Secondary Goals
- Provide dependency verification
- Improve file save feedback
- Add documentation viewer

## Target Audience

**Primary**: Software developers using Ralph Wiggum for AI-assisted development

**Characteristics**:
- Familiar with TypeScript/React/Node.js
- Uses VS Code or Cursor IDE
- Has Claude CLI installed
- May work on multiple projects simultaneously

See `AUDIENCE_JTBD.md` for detailed personas and jobs-to-be-done.

## Feature Requirements

### FR-1: PRD→Plan Integration

**Priority**: High

**Description**: Allow users to generate PRD.md and AUDIENCE_JTBD.md, then use them as context for implementation plan generation.

**Requirements**:
- Add "Use PRD Documents" toggle to Plan Generator
- Read PRD files and prepend to generation prompt
- Handle config:saved messages to confirm file saves
- Fix Generate button validation when PRD context selected

**Acceptance Criteria**: See `specs/01-prd-plan-integration.md`

### FR-2: Enhanced Task Parser

**Priority**: High

**Description**: Recognize multiple task formats in IMPLEMENTATION_PLAN.md for accurate progress tracking.

**Requirements**:
- Support checkbox format: `- [ ]` / `- [x]`
- Support user story format: `US-XXX` with status markers
- Support numbered checkboxes: `1. [ ]`
- Support emoji markers: `✅`, `⬜`, `🔲`
- Avoid duplicate counting

**Acceptance Criteria**: See `specs/02-implementation-plan-parser.md`

### FR-3: File Write Safety

**Priority**: High

**Description**: Prevent "File has not been read yet" errors in Claude Code.

**Requirements**:
- Add instructions to CLAUDE.md template
- Document read-before-write pattern
- Update PROMPT_build.md with safety instructions

**Acceptance Criteria**: See `specs/03-file-write-safety.md`

### FR-4: Cross-Platform CLI

**Priority**: High

**Description**: Support macOS and Linux in addition to Windows.

**Requirements**:
- Make `--model opus` flag conditional based on platform
- Default to including flag on Windows
- Default to omitting flag on macOS/Linux
- Allow override via CLAUDE_MODEL_FLAG environment variable

**Acceptance Criteria**: See `specs/04-cross-platform-cli.md`

### FR-5: Agent Installation

**Priority**: Medium

**Description**: Enable one-click installation of specialist agents.

**Requirements**:
- Create 4 agent definition files in repo
- Add methods to install agents globally or to project
- Add WebSocket handlers for installation commands
- Update UI with install buttons
- Support "Install All Global" action

**Acceptance Criteria**: See `specs/05-agent-installation.md`

### FR-6: Dependency Checker

**Priority**: Medium

**Description**: Verify required tools are installed before running Ralph.

**Requirements**:
- Check Claude CLI, Node.js, npm, git
- Show version and path for available tools
- Show installation links for missing tools
- Auto-check when Dependencies tab opens
- Provide refresh button

**Acceptance Criteria**: See `specs/06-dependency-checker.md`

### FR-7: Config Saved Handler

**Priority**: Low

**Description**: Provide visual feedback when files are saved.

**Requirements**:
- Handle config:saved WebSocket message
- Track recently saved files
- Show confirmation that auto-clears
- Integrate with PRD Generator

**Acceptance Criteria**: See `specs/07-config-saved-handler.md`

### FR-8: Existing Docs Viewer

**Priority**: Low

**Description**: View project documentation from within the dashboard.

**Requirements**:
- Show which key docs exist
- View button opens modal with content
- Generate button navigates to appropriate generator
- Support scrolling for large documents

**Acceptance Criteria**: See `specs/08-existing-docs-viewer.md`

## Technical Constraints

### Platform Support
- Windows 10/11 (primary)
- macOS 12+ (secondary)
- Linux (Ubuntu 22.04+) (secondary)

### Technology Stack
- Frontend: React 19, TypeScript, Vite
- Backend: Node.js, Express, WebSocket
- Styling: Tailwind CSS, Radix UI

### Dependencies
- Claude CLI (required)
- Node.js 18+ (required)
- npm 8+ (required)
- git 2.30+ (required)

## Success Metrics

### Quantitative
- Task recognition rate: 95%+ of valid task formats recognized
- Cross-platform success: PRD/Plan generation works on Windows, macOS, Linux
- Agent installation: <2 clicks to install all agents

### Qualitative
- Developers report smoother PRD→Plan workflow
- Progress visibility feels accurate and useful
- Agent management is intuitive

## Release Strategy

### SLC Release 1: Core Fixes
**Features**: FR-1, FR-2, FR-3, FR-4
**Value**: Dashboard becomes reliable for real projects

### SLC Release 2: Agent Management
**Features**: FR-5
**Value**: One-click specialist agent installation

### SLC Release 3: Setup & Polish
**Features**: FR-6, FR-7, FR-8
**Value**: Professional onboarding and feedback

## Out of Scope

- Mobile support
- Self-hosted deployment
- Multi-user collaboration
- Plugin marketplace
- Custom theme creation

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Claude CLI API changes | High | Low | Version check in dependency checker |
| Task format not recognized | Medium | Medium | Extensible parser with multiple patterns |
| Platform-specific issues | Medium | Medium | CI testing on multiple platforms |

## Appendix

### Related Documents
- `AUDIENCE_JTBD.md` - Detailed audience analysis
- `specs/*.md` - Feature specifications
- `IMPLEMENTATION_PLAN.md` - Task breakdown

### References
- [Ralph Wiggum Technique](https://github.com/ghuntley/how-to-ralph-wiggum)
- [RalphWiggumV2 Repository](https://github.com/nine-one-six-systems/RalphWiggumV2)
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)

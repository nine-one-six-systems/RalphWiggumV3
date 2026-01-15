# Audience & Jobs to Be Done

## Primary Audience

### Developer Using Ralph Wiggum

**Who they are:**
- Software developers using AI-assisted development with Claude Code
- May be working on multiple projects simultaneously
- Want to leverage Ralph Wiggum methodology for iterative, autonomous development
- Need visibility into what the AI agent is doing and progress being made

**Technical context:**
- Familiar with TypeScript, React, Node.js
- Uses VS Code or Cursor IDE
- Has Claude CLI installed
- May be on Windows, macOS, or Linux

**Pain points:**
- Lack of visibility into Ralph loop progress
- Difficulty managing multiple project instances
- No easy way to install/manage specialist agents
- PRD generation disconnected from plan generation
- Implementation plan parser doesn't recognize various task formats

---

## Jobs to Be Done

### JTBD 1: Generate Product Requirements and Create Implementation Plans

**When I** start a new feature or project
**I want to** generate a PRD and use it to create a detailed implementation plan
**So that** the Ralph build loop has clear, structured tasks to execute

**Success criteria:**
- Can generate PRD.md and AUDIENCE_JTBD.md from existing documentation or form input
- Can optionally include PRD documents as context for plan generation
- Plan generator creates checkbox-format tasks that the dashboard can track
- Files are saved to the correct project directory (not Ralph directory)

**Activities:**
- Generate PRD from docs or form
- Insert generated files to project
- Toggle "Use PRD Documents" in Plan Generator
- Generate implementation plan with PRD context

---

### JTBD 2: Monitor Task Progress Visually

**When I** run a Ralph build loop
**I want to** see real-time progress of completed vs pending tasks
**So that** I know how much work remains and can verify the agent is making progress

**Success criteria:**
- Implementation Plan card shows accurate task counts
- Parser recognizes checkbox format (`- [ ]` / `- [x]`)
- Parser recognizes user story format (US-XXX with status markers)
- Parser recognizes emoji status markers (✅, ⬜)
- Progress bar reflects actual completion percentage

**Activities:**
- View Implementation Plan status card
- See task breakdown by status
- Watch progress update in real-time as files change

---

### JTBD 3: Install and Manage Specialist Agents

**When I** want to use specialized Claude agents for specific tasks
**I want to** install agents from the Ralph repo to global or project locations
**So that** Claude can delegate to specialized agents during the build loop

**Success criteria:**
- Can see agents available in Ralph repo for installation
- Can install agents globally (~/.claude/agents/)
- Can install agents to project (.claude/agents/)
- Can install all agents at once
- Can toggle agents on/off in CLAUDE.md

**Activities:**
- View available repo agents
- Click to install globally or to project
- Toggle agent enablement
- View which agents are already installed

---

### JTBD 4: Run Multiple Dashboard Instances

**When I** work on multiple projects simultaneously
**I want to** run separate Ralph dashboard instances on different ports
**So that** I can monitor each project independently

**Success criteria:**
- Can configure frontend port via VITE_PORT environment variable
- Can configure backend port via PORT environment variable
- WebSocket URL is dynamic based on VITE_WS_PORT
- Convenience script available for alternate port configuration

**Activities:**
- Start first instance on default ports
- Start second instance with alternate ports
- Both instances operate independently

---

### JTBD 5: Verify System Dependencies

**When I** set up Ralph Wiggum on a new machine or project
**I want to** verify all required dependencies are installed
**So that** I can fix any issues before running the build loop

**Success criteria:**
- Dashboard shows Claude CLI availability and version
- Dashboard shows Node.js, npm, git versions
- Missing dependencies show installation instructions
- Can refresh dependency check

**Activities:**
- View Dependencies tab in Setup
- See status of each required tool
- Follow installation links if needed
- Refresh to verify after installation

---

### JTBD 6: Create Files Without "Read First" Errors

**When I** run the Ralph build loop that needs to create new files
**I want** file creation to succeed without "File has not been read yet" errors
**So that** the build loop doesn't fail unexpectedly

**Success criteria:**
- CLAUDE.md contains instructions to read before write
- Claude follows the pattern: Read (may fail) → Write (succeeds)
- New file creation works on first attempt

**Activities:**
- Build loop attempts to create new file
- Claude reads file first (gets "not found" - expected)
- Claude writes file (succeeds)

---

### JTBD 7: Run on Any Platform

**When I** use Ralph Wiggum on macOS or Linux (not just Windows)
**I want** the CLI commands to work without "--model" flag errors
**So that** I can use Ralph on my preferred platform

**Success criteria:**
- Model flag is conditional based on platform
- Windows uses --model opus (confirmed working)
- macOS/Linux omit flag by default
- Environment variable override available for newer CLI versions

**Activities:**
- Run PRD/Plan generation on macOS
- Commands succeed without flag errors
- Can opt-in to model flag via CLAUDE_MODEL_FLAG=true

---

## Audience Journey Map

```
Setup Phase:
  Verify Dependencies → Configure CLAUDE.md → Install Agents
                                    ↓
Planning Phase:
  Generate PRD → Insert Files → Generate Plan (with PRD context)
                                    ↓
Build Phase:
  Start Loop → Monitor Progress → View Learnings → Stop Loop
                                    ↓
Multi-Project:
  Start Instance 2 → Different Ports → Independent Monitoring
```

---

## SLC Release Recommendation

### Release 1: Core Dashboard Fixes (Simple, Lovable, Complete)

**Scope:** JTBDs 1, 2, 6, 7

**Why:** These are foundational fixes that make the existing dashboard reliable:
- PRD→Plan integration (connect the workflow)
- Task parser enhancements (see actual progress)
- File write safety (prevent build failures)
- Cross-platform support (work everywhere)

**Value:** Dashboard becomes usable for real projects without unexpected failures.

---

### Release 2: Agent Management

**Scope:** JTBD 3

**Why:** Specialist agents are a key Ralph feature but currently require manual file management.

**Value:** One-click agent installation democratizes advanced Claude patterns.

---

### Release 3: Multi-Instance & Dependencies

**Scope:** JTBDs 4, 5

**Why:** Power user features for managing multiple projects and onboarding.

**Value:** Professional workflow for developers managing multiple Ralph projects.

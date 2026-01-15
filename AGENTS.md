# RalphWiggumV2 Dashboard Enhancements - Operations Guide

## Project Overview

Enhancement project for RalphWiggumV2 dashboard:
- **Target**: RalphWiggumV2/dashboard
- **Frontend**: React 19 + Vite + TypeScript
- **Backend**: Node.js + Express + WebSocket
- **Styling**: Tailwind CSS + Radix UI

## Build & Run

### Development

```bash
cd RalphWiggumV2/dashboard

# Install dependencies
npm install

# Start dev server (frontend + backend)
npm run dev

# Or start separately:
npm run dev:client  # Frontend on port 5173
npm run dev:server  # Backend on port 3001
```

### Production Build

```bash
npm run build
npm run preview
```

## Validation

Run these after implementing to get immediate feedback:

```bash
# TypeScript check (npm run typecheck not defined)
npx tsc --noEmit

# Lint
npm run lint

# All checks
npx tsc --noEmit && npm run lint
```

## Project Structure

```
RalphWiggumV2/dashboard/
├── server/
│   ├── index.ts              # Express + WebSocket server
│   ├── projectConfig.ts      # Project configuration management
│   ├── fileWatcher.ts        # File watching + task parsing
│   ├── planGenerator.ts      # Plan generation with Claude
│   ├── prdGenerator.ts       # PRD generation with Claude
│   ├── loopController.ts     # Ralph loop management
│   └── dependencyChecker.ts  # NEW - Dependency checking
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx     # Main dashboard component
│   │   ├── PlanGenerator.tsx
│   │   ├── PRDGenerator.tsx
│   │   ├── setup/
│   │   │   ├── SetupWizard.tsx
│   │   │   ├── DependencyChecker.tsx  # NEW
│   │   │   └── SpecialistAgentsConfig.tsx
│   │   └── ui/               # Radix UI components
│   ├── hooks/
│   │   └── useWebSocket.ts   # WebSocket state management
│   └── types/
│       └── index.ts          # TypeScript types
├── package.json
└── vite.config.ts
```

## Key Patterns

### WebSocket Message Flow

```
Client → Server:
  { type: 'plan:generate', payload: { goal, mode, usePrdContext } }

Server → Client:
  { type: 'plan:status', payload: { generating, startedAt } }
  { type: 'plan:output', payload: { text } }
  { type: 'plan:complete', payload: { plan, output } }
```

### Adding New WebSocket Commands

1. Add type in `src/types/index.ts`
2. Add handler in `server/index.ts` switch statement
3. Add state and callback in `src/hooks/useWebSocket.ts`
4. Wire up in component

### File Writing Pattern (IMPORTANT)

When creating new files with Claude Code:
1. First READ the file (will get "not found" error - OK)
2. Then WRITE the file (will succeed)

This satisfies Claude Code's safety check.

## Environment Variables

```bash
# Backend port (default: 3001)
PORT=3001

# Frontend port (default: 5173)
VITE_PORT=5173

# WebSocket port for frontend (default: 3001)
VITE_WS_PORT=3001

# Force --model flag on non-Windows platforms
CLAUDE_MODEL_FLAG=true
```

## Codebase Patterns

- Agent files use YAML frontmatter for name/description extraction
- WebSocket pattern: Type -> Server Handler -> Hook State -> UI
- Pre-existing lint errors (unused vars in catch blocks) are not blockers

## Operational Learnings

- No test framework configured (`npm test` not available)
- TypeScript check: use `npx tsc --noEmit` (no typecheck script defined)
- No git remote configured - need `git remote add origin <url>` before push

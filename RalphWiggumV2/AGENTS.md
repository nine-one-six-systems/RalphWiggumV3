## Build & Run

- Build: `cd dashboard && npm run build`
- Dev server: `cd dashboard && npm run dev`
- Server only: `cd dashboard && npx tsx server/index.ts`

## Validation

Run these after implementing to get immediate feedback:

- Typecheck: `cd dashboard && npx tsc --noEmit`
- Lint: `cd dashboard && npm run lint`
- Build check: `cd dashboard && npm run build`

## Operational Notes

- Dashboard is a React+TypeScript frontend with Express/WebSocket backend
- Frontend runs on port 5173 (Vite dev server)
- Backend runs on port 3001 (WebSocket server)
- Use `?mode=launcher` URL param to access project launcher

### Codebase Patterns

- WebSocket messages follow pattern: `domain:action` (e.g., `loop:start`, `config:update`)
- Server handlers in `dashboard/server/index.ts`
- React hooks in `dashboard/src/hooks/`
- UI components use Radix UI primitives from `dashboard/src/components/ui/`

## Operational Learnings

- Pre-existing lint warnings exist (unused vars) but don't block functionality
- No git remote configured - push commands may fail but local commits work
- File watchers use chokidar for efficient filesystem monitoring

# Config Saved Handler

## User Story

**As a** developer inserting generated files
**I want to** see confirmation that files were saved
**So that** I know the operation succeeded

## Problem Statement

When users click "Insert Both Files" in the PRD Generator, files are written but there's no visual confirmation. The server sends `config:saved` messages but the client doesn't handle them.

## Acceptance Criteria

### AC-1: Handle config:saved Message
- [ ] WebSocket hook handles 'config:saved' message type
- [ ] Tracks which files have been saved recently
- [ ] Auto-clears saved status after 3 seconds

### AC-2: Visual Confirmation
- [ ] Shows success message after files saved
- [ ] Lists which files were saved
- [ ] Disappears automatically

### AC-3: PRD Generator Integration
- [ ] "Insert Both Files" button shows confirmation
- [ ] Can show "Files saved: PRD.md, AUDIENCE_JTBD.md"

## Implementation Details

### Files to Modify

| File | Changes |
|------|---------|
| `dashboard/src/hooks/useWebSocket.ts` | Add config:saved handler, savedFiles state |
| `dashboard/src/components/PRDGenerator.tsx` | Show save confirmation |

### useWebSocket.ts Changes

```typescript
// Add state
const [savedFiles, setSavedFiles] = useState<Set<string>>(new Set());

// Add message handler in switch statement
case 'config:saved':
  setSavedFiles(prev => new Set([...prev, message.payload.file]));
  // Auto-clear after 3 seconds
  setTimeout(() => {
    setSavedFiles(prev => {
      const next = new Set(prev);
      next.delete(message.payload.file);
      return next;
    });
  }, 3000);
  break;

// Add to return object
return {
  ...existing,
  savedFiles,
};
```

### PRDGenerator.tsx Changes

```tsx
// Show confirmation when files are saved
{savedFiles.has('PRD.md') && savedFiles.has('AUDIENCE_JTBD.md') && (
  <div className="flex items-center gap-2 text-sm text-green-600">
    <CheckCircle className="h-4 w-4" />
    Files saved: PRD.md, AUDIENCE_JTBD.md
  </div>
)}

// Or more general:
{savedFiles.size > 0 && (
  <div className="flex items-center gap-2 text-sm text-green-600">
    <CheckCircle className="h-4 w-4" />
    Saved: {Array.from(savedFiles).join(', ')}
  </div>
)}
```

### Server Already Sends config:saved

From index.ts, the handler already exists:
```typescript
case 'config:write':
  await projectConfig.writeFile(message.payload.file, message.payload.content);
  ws.send(JSON.stringify({ type: 'config:saved', payload: { file: message.payload.file } }));
  break;
```

## Required Tests

1. **Single File Save**
   - Write a file via config:write
   - Verify config:saved message received
   - Verify savedFiles state updated
   - Verify state clears after 3 seconds

2. **Multiple Files Save**
   - Write PRD.md and AUDIENCE_JTBD.md
   - Verify both appear in savedFiles
   - Verify confirmation shows both files

3. **Visual Confirmation**
   - Click "Insert Both Files" in PRD Generator
   - Verify success message appears
   - Verify message disappears after 3 seconds

## Type Definition

Add to `dashboard/src/types/index.ts` if not present:
```typescript
export interface ConfigSavedMessage extends WSMessage {
  type: 'config:saved';
  payload: { file: string };
}
```

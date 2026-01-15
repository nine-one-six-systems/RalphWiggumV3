# Existing Docs Viewer

## User Story

**As a** developer using Ralph Wiggum
**I want to** view my existing documentation files from the dashboard
**So that** I can quickly reference AGENTS.md, PRD.md, etc. without switching windows

## Problem Statement

Key documentation files (AGENTS.md, PRD.md, AUDIENCE_JTBD.md, IMPLEMENTATION_PLAN.md) are important for understanding the project state, but users have to navigate to them manually in their file system or editor.

## Acceptance Criteria

### AC-1: Documentation Overview Card
- [ ] Shows which key docs exist in the project
- [ ] Lists: AGENTS.md, PRD.md, AUDIENCE_JTBD.md, IMPLEMENTATION_PLAN.md
- [ ] Shows "exists" / "missing" status for each

### AC-2: View Document
- [ ] "View" button for existing documents
- [ ] Opens modal with document content
- [ ] Supports markdown rendering (or monospace display)
- [ ] Copy button to copy content

### AC-3: Generate Missing
- [ ] "Generate" button for missing documents
- [ ] Navigates to appropriate generator tab
- [ ] PRD.md/AUDIENCE_JTBD.md → PRD Generator tab
- [ ] IMPLEMENTATION_PLAN.md → Plan Generator tab

### AC-4: Scrollable Preview
- [ ] Large documents scroll within modal
- [ ] Modal doesn't exceed viewport
- [ ] Content area has proper overflow handling

## Implementation Details

### Files to Create/Modify

| File | Changes |
|------|---------|
| `dashboard/src/components/ExistingDocsViewer.tsx` | NEW - Main component |
| `dashboard/src/components/DocumentPreview.tsx` | NEW - Modal for viewing docs |
| `dashboard/src/hooks/useWebSocket.ts` | Add configPreviewDoc state, readConfigFile callback |
| `dashboard/server/projectConfig.ts` | readFile method (already exists) |
| `dashboard/src/types/index.ts` | Add hasPRD, hasAudienceJTBD to ProjectConfig |
| `dashboard/src/components/Dashboard.tsx` | Import and place ExistingDocsViewer |

### ExistingDocsViewer.tsx

```tsx
interface DocInfo {
  name: string;
  key: keyof ProjectConfig | 'hasPRD' | 'hasAudienceJTBD';
  exists: boolean;
  generateTab?: 'plan' | 'prd';
}

export function ExistingDocsViewer({ 
  projectConfig, 
  onViewDoc, 
  previewDoc,
  isLoadingPreview,
  onClosePreview,
  onNavigateToGenerate 
}: Props) {
  const docs: DocInfo[] = [
    { name: 'AGENTS.md', key: 'hasAgentsMd', exists: projectConfig.hasAgentsMd },
    { name: 'PRD.md', key: 'hasPRD', exists: projectConfig.hasPRD, generateTab: 'prd' },
    { name: 'AUDIENCE_JTBD.md', key: 'hasAudienceJTBD', exists: projectConfig.hasAudienceJTBD, generateTab: 'prd' },
    { name: 'IMPLEMENTATION_PLAN.md', key: 'hasImplementationPlan', exists: projectConfig.hasImplementationPlan, generateTab: 'plan' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Documentation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.name} className="flex items-center justify-between p-2 rounded border">
              <div className="flex items-center gap-2">
                {doc.exists ? <CheckCircle className="text-green-500" /> : <Circle className="text-muted" />}
                <span>{doc.name}</span>
              </div>
              {doc.exists ? (
                <Button variant="outline" size="sm" onClick={() => onViewDoc(doc.name)}>
                  View
                </Button>
              ) : doc.generateTab ? (
                <Button variant="outline" size="sm" onClick={() => onNavigateToGenerate(doc.generateTab!)}>
                  Generate
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>

      {/* Preview Modal */}
      {previewDoc && (
        <DocumentPreview
          file={previewDoc.file}
          content={previewDoc.content}
          isLoading={isLoadingPreview}
          onClose={onClosePreview}
        />
      )}
    </Card>
  );
}
```

### useWebSocket.ts Additions

```typescript
// State
const [configPreviewDoc, setConfigPreviewDoc] = useState<{ file: string; content: string } | null>(null);
const [configPreviewLoading, setConfigPreviewLoading] = useState(false);

// Message handler
case 'config:content':
  setConfigPreviewDoc({
    file: message.payload.file,
    content: message.payload.content,
  });
  setConfigPreviewLoading(false);
  break;

// Callbacks
const readConfigFile = useCallback((file: string) => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    setConfigPreviewLoading(true);
    setConfigPreviewDoc(null);
    wsRef.current.send(JSON.stringify({ type: 'config:read', payload: { file } }));
  }
}, []);

const closeConfigPreview = useCallback(() => {
  setConfigPreviewDoc(null);
  setConfigPreviewLoading(false);
}, []);
```

### projectConfig.ts Additions

Add to refresh() method:
```typescript
const checks = await Promise.all([
  this.fileExists('AGENTS.md'),
  this.fileExists('IMPLEMENTATION_PLAN.md'),
  this.dirExists('specs'),
  this.dirExists('.cursor/rules'),
  this.fileExists('loop.sh'),
  this.fileExists('PRD.md'),           // NEW
  this.fileExists('AUDIENCE_JTBD.md'), // NEW
]);

this.config = {
  // ... existing fields
  hasPRD: checks[5],
  hasAudienceJTBD: checks[6],
};
```

## Required Tests

1. **Documentation Status Display**
   - Create AGENTS.md, PRD.md in project
   - Verify they show as "exists" with checkmark
   - Verify missing files show circle icon

2. **View Document**
   - Click "View" on existing document
   - Verify modal opens with content
   - Verify content matches actual file
   - Verify scrolling works for large files

3. **Generate Navigation**
   - Click "Generate" on missing PRD.md
   - Verify navigates to PRD Generator tab
   - Click "Generate" on missing IMPLEMENTATION_PLAN.md
   - Verify navigates to Plan Generator tab

4. **Modal Scrolling**
   - View a large IMPLEMENTATION_PLAN.md
   - Verify content scrolls within modal
   - Verify modal doesn't exceed viewport

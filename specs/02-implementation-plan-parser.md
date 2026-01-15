# Implementation Plan Parser Enhancement

## User Story

**As a** developer monitoring Ralph progress
**I want** the Implementation Plan card to show accurate task counts
**So that** I can see real progress regardless of task format used

## Problem Statement

The Implementation Plan section shows "0/0" and "No tasks found" even when IMPLEMENTATION_PLAN.md exists with tasks. The parser only recognizes markdown checkbox format, but real plans use various formats including user stories (US-XXX), numbered lists, and emoji markers.

## Acceptance Criteria

### AC-1: Checkbox Format Support (Existing)
- [ ] Recognizes `- [ ] Task description` as incomplete
- [ ] Recognizes `- [x] Task description` as complete
- [ ] Case insensitive for X marker

### AC-2: User Story Format Support
- [ ] Recognizes US-XXX patterns in various contexts
- [ ] Detects completion via ✅, DONE, COMPLETE markers
- [ ] Avoids duplicate counting for same US mentioned multiple times
- [ ] Extracts description after US-XXX

### AC-3: Numbered Checkbox Support
- [ ] Recognizes `1. [ ] Task` format
- [ ] Recognizes `1. [x] Task` as complete

### AC-4: Emoji Status Markers
- [ ] Recognizes `- ✅ Task` as complete
- [ ] Recognizes `- ⬜ Task` as incomplete
- [ ] Recognizes `- 🔲 Task` as incomplete

### AC-5: Progress Display
- [ ] Total count reflects all recognized tasks
- [ ] Completed count reflects tasks with completion markers
- [ ] Progress bar percentage is accurate
- [ ] Updates in real-time when file changes

## Implementation Details

### File to Modify

`dashboard/server/fileWatcher.ts` - parseTasks() method

### Enhanced Parser Logic

```typescript
private async parseTasks() {
  const content = await fs.readFile(planPath, 'utf-8');
  const tasks: Task[] = [];
  const lines = content.split('\n');
  const seenUserStories = new Set<string>();

  lines.forEach((line, index) => {
    // Pattern 1: Markdown checkboxes - [ ] or - [x]
    const checkboxMatch = line.match(/^-\s*\[([ xX])\]\s*(.+)$/);
    if (checkboxMatch) {
      tasks.push({
        id: `task-${index}`,
        content: checkboxMatch[2].trim(),
        completed: checkboxMatch[1].toLowerCase() === 'x',
      });
      return;
    }

    // Pattern 2: User Stories (US-XXX format)
    const usMatch = line.match(/US-(\d+)/);
    if (usMatch) {
      const usId = usMatch[1];
      if (seenUserStories.has(usId)) return;
      seenUserStories.add(usId);

      const isComplete = /✅|DONE|COMPLETE|completed/i.test(line);
      let description = line
        .replace(/^[|\s-]*/, '')
        .replace(/US-\d+[:\s|]*/i, '')
        .replace(/[|].*$/, '')
        .replace(/✅|⬜|🔲|DONE|TODO|COMPLETE|PENDING/gi, '')
        .trim();

      if (description.length < 3) {
        description = `User Story ${usId}`;
      }

      tasks.push({
        id: `us-${usId}`,
        content: `US-${usId}: ${description}`,
        completed: isComplete,
      });
      return;
    }

    // Pattern 3: Numbered checkboxes
    const numberedMatch = line.match(/^\d+\.\s*\[([ xX])\]\s*(.+)$/);
    if (numberedMatch) {
      tasks.push({
        id: `task-${index}`,
        content: numberedMatch[2].trim(),
        completed: numberedMatch[1].toLowerCase() === 'x',
      });
      return;
    }

    // Pattern 4: Emoji status markers
    const emojiMatch = line.match(/^[-*]\s*(✅|⬜|🔲)\s*(.+)$/);
    if (emojiMatch) {
      tasks.push({
        id: `task-${index}`,
        content: emojiMatch[2].trim(),
        completed: emojiMatch[1] === '✅',
      });
    }
  });

  const completed = tasks.filter((t) => t.completed).length;
  this.tasks = { tasks, completed, total: tasks.length, lastUpdated: new Date() };
  this.emit('tasks', this.tasks);
}
```

## Required Tests

1. **Checkbox Format Test**
   - File with `- [ ] Task` → counts as incomplete
   - File with `- [x] Task` → counts as complete
   - File with `- [X] Task` → counts as complete (case insensitive)

2. **User Story Format Test**
   - File with `US-001: Description` → recognized as task
   - File with `US-001: Description ✅` → recognized as complete
   - Same US-XXX on multiple lines → counted only once

3. **Mixed Format Test**
   - File with checkboxes AND user stories → all recognized
   - Total count is sum of all patterns
   - No duplicates

4. **Real-time Update Test**
   - Modify IMPLEMENTATION_PLAN.md → dashboard updates immediately
   - Progress percentage updates correctly

## Test Data

```markdown
# Implementation Plan

- [x] US-001: Setup project structure
- [ ] US-002: Configure TypeScript
- ✅ Configure ESLint
- ⬜ Add testing framework

| US-003 | Add API client | TODO |
| US-004 | Implement caching | DONE |
```

Expected: 6 tasks total, 3 complete (50%)

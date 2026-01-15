# File Write Safety Instructions

## User Story

**As a** developer running Ralph build loops
**I want** file creation to succeed without "File has not been read yet" errors
**So that** my build loop doesn't fail unexpectedly when creating new files

## Problem Statement

When Claude Code attempts to create a new file using the Write tool, it fails with:
```
Error: File has not been read yet. Read it first before writing to it.
```

This is a Claude Code safety mechanism that requires reading a file before writing to prevent accidental overwrites. For new files that don't exist, this creates a chicken-and-egg problem.

## Acceptance Criteria

### AC-1: CLAUDE.md Instructions
- [ ] CLAUDE.md contains "File Writing Rules" section
- [ ] Instructions explain read-before-write pattern
- [ ] Example workflow for new files provided
- [ ] Example workflow for existing files provided

### AC-2: Build Loop Behavior
- [ ] Claude follows read→write pattern for all file operations
- [ ] New file creation succeeds on first loop iteration
- [ ] Existing file modifications see current content first

## Implementation Details

### File to Create/Modify

`{TARGET_PROJECT}/CLAUDE.md` - Add this section:

```markdown
## File Writing Rules

**CRITICAL: Always read before write**

Before using the Write tool to create or modify ANY file:
1. First use the Read tool to attempt reading the file
2. If the file doesn't exist, you'll get an error - that's OK
3. Then proceed with the Write tool

This is required because Claude Code tracks which files you've read to prevent accidental overwrites.

**Example workflow for creating a new file:**
1. Read `src/newFile.ts` → Error: file not found (expected)
2. Write `src/newFile.ts` → Success

**Example workflow for modifying an existing file:**
1. Read `src/existingFile.ts` → Returns file content
2. Write `src/existingFile.ts` → Success
```

### Alternative: Add to Ralph Prompts

Add to PROMPT_build.md:
```markdown
## File Operation Safety

When creating new files, ALWAYS attempt to read the file first using the Read tool, even if you know it doesn't exist. This satisfies Claude Code's safety check.

Pattern:
1. Read file (may fail if new)
2. Write file (will succeed)
```

## Required Tests

1. **New File Creation Test**
   - Start Ralph loop that needs to create a new file
   - Verify Claude reads first (gets "not found")
   - Verify Claude writes successfully
   - Verify file exists with correct content

2. **Existing File Modification Test**
   - Start Ralph loop that needs to modify an existing file
   - Verify Claude reads current content first
   - Verify Claude writes updated content
   - Verify changes are correct

## Why This Works

The Ralph Wiggum methodology emphasizes:
- **Self-correction**: Claude should handle errors gracefully
- **Incremental progress**: Each iteration makes progress and saves state
- **Clear completion criteria**: Know when a task is done

By adding the "read before write" rule:
- Claude learns the pattern and applies it consistently
- New file creation succeeds on first attempt
- Existing file modifications are safer (you see current content first)
- The build loop doesn't fail unexpectedly

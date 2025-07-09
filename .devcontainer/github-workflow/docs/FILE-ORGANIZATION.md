# File Organization System Documentation

## Overview

The Enhanced GitHub Workflow V3 includes a comprehensive file organization system that ensures all issue-related artifacts are properly stored, tracked, and cleaned up.

## Directory Structure

```
github-workflow/
├── issues/                    # All issue-specific directories
│   ├── issue-{number}/       # Individual issue directory
│   │   ├── metadata.json     # Issue metadata and file tracking
│   │   ├── claude-prompt.txt # Original Claude prompt
│   │   ├── execution.log     # Claude execution output
│   │   ├── SUMMARY.md        # Issue processing summary
│   │   └── ...              # Other issue-specific files
├── orphaned-files/           # Files without clear issue association
├── archive/                  # Completed issues moved here
├── .temp/                    # Temporary files (auto-cleaned)
└── *.js                      # System scripts

```

## Key Features

### 1. **Automatic Organization**
- All files created during issue processing are automatically stored in the appropriate issue directory
- Temporary files are tracked and cleaned up after processing
- Failed executions still have their cleanup performed

### 2. **Issue Directories**
Each issue gets its own directory containing:
- **metadata.json** - Tracks all files and processing details
- **claude-prompt.txt** - The exact prompt sent to Claude
- **execution.log** - Full output from Claude execution
- **SUMMARY.md** - Human-readable summary with links

### 3. **Cleanup Utilities**
- **cleanup-existing-files.js** - Organizes existing orphaned files
- **Automatic cleanup** - Removes temporary files older than configured time
- **Archive functionality** - Moves completed issues to archive

### 4. **GitHub Integration**
- Issue comments include links to the organized file directory
- Progress updates reference the current state of files
- Summary reports are automatically generated

## Usage

### Starting the System
```bash
# Start with initial cleanup
./start-enhanced-v3.sh --cleanup

# Start without cleanup
./start-enhanced-v3.sh
```

### Manual Cleanup
```bash
# Run cleanup utility
node cleanup-existing-files.js
```

### File Access
All issue files can be accessed via:
- Direct filesystem: `issues/issue-{number}/`
- GitHub web interface: Links provided in issue comments

## Configuration

The system uses the existing `config-enhanced.json` with no additional configuration needed.

## Benefits

1. **No More Orphaned Files** - Every file has a clear home
2. **Easy Navigation** - Find all files related to an issue in one place
3. **Automatic Cleanup** - Temporary files don't accumulate
4. **Transparency** - Clear reporting of what was created and where
5. **Error Recovery** - Cleanup happens even on failures

## Migration from Previous Versions

When upgrading from V2 to V3:
1. Run `cleanup-existing-files.js` to organize existing files
2. Review `orphaned-files/` directory for any uncategorized files
3. Update monitor script to use `monitor-enhanced-v3.js`
4. All new issues will automatically use the organized structure

---

*This system ensures a clean, organized repository with no files left in random places.*
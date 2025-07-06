# GitHub Workflow Cleanup and Consolidation Plan

## Current State Analysis

### Multiple Monitor Versions:
- `monitor-enhanced-v2.js` - The base enhanced monitor
- `monitor-enhanced-v3.js` - Added file organization
- `monitor-enhanced-v3-integrated.js` - Added MCP monitoring
- `monitor-enhanced-v3-mcp.js` (in issue-9) - Another MCP version

### Multiple Start Scripts:
- `start-enhanced-v2.sh` - For v2 monitor
- `start-enhanced-v3.sh` - For v3 monitor  
- `start-enhanced-v3-integrated.sh` - For integrated monitor
- `start-monitor-with-mcp.sh` (in issue-9) - Another MCP start script

### Features Scattered Across Files:
1. **Rate Limiting** - Added in v3-integrated
2. **MCP Monitoring** - In issue-9 and v3-integrated
3. **File Organization** - In v3 and file-organization-v3.js
4. **AI Attribution** - In issue-10

## Consolidation Plan

### 1. Single Monitor File: `monitor-enhanced.js`
Will include ALL features:
- GitHub issue/comment monitoring
- Rate limit protection (30s delays, 5min on limit)
- MCP server health monitoring
- Proper file organization
- AI attribution in commits/comments

### 2. Single Start Script: `start-enhanced-monitor.sh`
Options:
- `--organize-issues` - Organize existing issue files
- `--skip-mcp` - Skip MCP monitoring if not needed
- `--cleanup` - Run initial cleanup

### 3. Core Support Files:
- `automation-enhanced.js` - Main automation (with attribution)
- `file-organization.js` - Handles file placement
- `mcp-server-monitor.js` - MCP health checking
- `config.json` - Single configuration file

### 4. Archive Redundant Files:
Move to `archive/pre-cleanup/`:
- All v3 versions
- Duplicate file organizers
- Test files for specific versions

### 5. Extract Code from Issue Directories:
- Issue-9: MCP monitoring code → main directory
- Issue-10: Attribution system → integrate into automation
- Keep only docs/reports in issue directories

## Expected Final Structure:
```
.devcontainer/github-workflow/
├── monitor-enhanced.js          # Single monitor with all features
├── automation-enhanced.js       # Automation with AI attribution
├── start-enhanced-monitor.sh    # Single start script
├── file-organization.js         # File organization logic
├── mcp-server-monitor.js        # MCP health monitoring
├── config.json                  # Configuration
├── README.md                    # Clear documentation
├── issues/                      # Only docs/reports, no code
│   ├── issue-9/
│   │   └── *.md                # Documentation only
│   └── issue-10/
│       └── *.md                # Documentation only
├── tests/                       # All test files
├── logs/                        # Log files
└── archive/                     # Old versions for reference
    └── pre-cleanup/
        ├── *-v3.js
        └── *-v3.sh
```

## Implementation Steps:
1. Consolidate all monitor features into `monitor-enhanced.js`
2. Update `automation-enhanced.js` with attribution
3. Create single `start-enhanced-monitor.sh`
4. Move code from issue directories to main
5. Archive old versions
6. Update documentation
7. Test consolidated system
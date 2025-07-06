# File Usage Trace for start-enhanced-v3-integrated.sh

## Files Directly Used:

### 1. Entry Points:
- `start-enhanced-v3-integrated.sh` - Main startup script
- `monitor-enhanced-v3-integrated.js` - Main monitor that runs

### 2. Dependencies from monitor-enhanced-v3-integrated.js:
- `automation-enhanced-v3.js` - Required by monitor (line 13)
- `config-enhanced.json` - Loaded by monitor (line 506)
- `.last-check-enhanced-v3` - State file used by monitor

### 3. Dependencies from automation-enhanced-v3.js:
- Need to check what this file requires...

### 4. Optional/Conditional Files:
- `file-organization-v3.js` - Called if --organize-issue-9 flag is used
- `mcp-server-monitor.js` - MCP monitoring module (embedded in v3-integrated, but also exists separately)

### 5. Generated/Runtime Files:
- `logs/monitor-v3.log` - Log file
- `.temp/` directory - Temporary files
- `issues/` directory - Issue organization
- `archive/` directory - For archiving
- `tests/` directory - Test files
- `orphaned-files/` directory - Cleanup destination

## Files to Check Next:
1. What does automation-enhanced-v3.js require?
2. What config files are actually loaded?
3. Which test files are for v3-integrated?
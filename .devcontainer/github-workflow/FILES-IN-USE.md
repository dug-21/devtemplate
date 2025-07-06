# Files Currently In Use vs Not In Use

## ACTIVELY USED FILES:

### Core System:
- `start-enhanced-v3-integrated.sh` - Main entry point
- `monitor-enhanced-v3-integrated.js` - Active monitor
- `automation-enhanced-v3.js` - Active automation
- `file-organization.js` - Required by automation
- `config-enhanced.json` - Configuration file
- `.last-check-enhanced-v3` - State tracking

### Optional/Conditional:
- `file-organization-v3.js` - Used with --organize-issue-9 flag
- `mcp-server-monitor.js` - MCP monitoring (code duplicated in v3-integrated)

### Support Files:
- `CLAUDE.md` - Instructions for Claude
- `README*.md` - Documentation (need to consolidate)

## NOT IN USE (Can be archived/removed):

### Old Monitor Versions:
- `monitor-enhanced-v2.js`
- `monitor-enhanced-v3.js` 
- `monitor-enhanced.js`
- `monitor-coordinator.js`
- `monitor-ruv-swarm.js`
- `monitor.js`

### Old Automation Versions:
- `automation-enhanced-v2.js`
- `automation-enhanced.js`
- `automation-claude-integrated.js`
- `automation-coordinator.js`
- `automation-interactive.js`
- `automation-ruv-swarm.js`
- `automation-swarm-enhanced.js`
- `automation-task-based.js`
- `automation.js`

### Old Start Scripts:
- `start-enhanced-v2.sh`
- `start-enhanced-v3.sh`
- `start-enhanced-monitor.sh`
- `start-coordinator-monitor.sh`
- `start-ruv-swarm-monitor.sh`

### Test Files (need to check which are for v3):
- `test-enhanced-system.js` - For v2
- `test-v3-solution.js` - For v3-integrated (KEEP)
- `test-file-organization.js` - For file org (KEEP if needed)
- `test-claude-comment.js` - Old test
- `test-claude-integrated.js` - Old test
- `test-single-issue.js` - Old test

### Cleanup/Migration Scripts:
- `cleanup-ruv-swarm.js` - One-time cleanup
- `force-cleanup-ruv-swarm.sh` - One-time cleanup
- `reset-last-check.sh` - Utility
- `reset-ruv-swarm.sh` - One-time cleanup
- `execute-cleanup.sh` - One-time cleanup
- `cleanup-existing-files.js` - Referenced in v3 start script (CHECK)

### Demo/Example Files:
- `demo-issue-6.js`
- `example-issue-flow.md`
- `claude-integration-task.md`
- `test-prompt.txt`

### Other:
- `claude-github-post.js` - Standalone utility
- `issue-6-analysis.md` - Old analysis
- `config.json` - Old config (v3 uses config-enhanced.json)
- `.last-check-enhanced` - Old state file (v3 uses .last-check-enhanced-v3)
- `test-claude-github-simple.sh` - Old test

### Duplicate/Redundant:
- `file-organization-v3.js` - Similar to file-organization.js
- `mcp-server-monitor.js` - Code is embedded in v3-integrated

### Micromentor Directory:
- `micromentor/` - Appears to be from a different project (CHECK)

## NEEDS DECISION:
1. Multiple README files - consolidate into one?
2. `cleanup-existing-files.js` - Referenced in v3 start but may not exist
3. Batch files (.bat) and PowerShell (.ps1) - Keep for Windows users?
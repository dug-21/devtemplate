# Complete Flow Analysis: start-enhanced-monitor.sh

## Overview
The `start-enhanced-monitor.sh` script is the entry point for the Enhanced GitHub Monitor V3 system, which monitors GitHub issues and comments, processes them with AI (Claude), and manages file organization.

## Execution Flow

### 1. Script Initialization (`start-enhanced-monitor.sh`)

#### 1.1 Environment Setup
- Changes to script directory
- Checks for Node.js installation
- Validates GitHub token presence (`AGENT_TOKEN` or `GITHUB_TOKEN`)
- Warns if Claude CLI is not available

#### 1.2 Dependencies Installation
- Installs `@octokit/rest` npm package if not present

#### 1.3 Directory Structure Creation
```
issues/        # Issue-specific directories
archive/       # Archived content
.temp/         # Temporary files
orphaned-files/ # Files without clear ownership
logs/          # Log files
tests/         # Test files
```

#### 1.4 Optional File Organization
- If `--organize-issue-9` flag is passed, runs `file-organization-v3.js`

#### 1.5 MCP Server Status Check
- Checks if `ruv-swarm` MCP server is connected via Claude CLI
- Provides instructions if not connected

#### 1.6 Launch Main Monitor
- Executes `monitor-enhanced.js` as the main process

### 2. Main Monitor Process (`monitor-enhanced.js`)

#### 2.1 Class Structure
- `MCPServerMonitor`: Manages MCP server health checks and reconnection
- `EnhancedGitHubMonitorV3`: Main monitoring and processing logic

#### 2.2 Initialization
- Creates Octokit client with GitHub token
- Initializes `EnhancedGitHubAutomation` for issue processing
- Sets up file paths for tracking processed comments
- Configures MCP monitor with event handlers
- Loads processed comments from persistent storage

#### 2.3 Bot Identity
- Method: `getBotUsername()`
- Makes API call to get authenticated user
- Caches username for future use
- Used to identify bot's own comments

#### 2.4 Monitoring Loop
- Performs initial checks
- Sets up periodic checks (default: 60 seconds)
- Runs three main check types:
  1. New Issues
  2. New Comments
  3. Reprocess Requests

### 3. Issue Processing Flow

#### 3.1 New Issue Detection (`checkForNewIssues`)
- Queries GitHub API for open issues created after last check
- Filters based on:
  - Not a pull request
  - Created after last check time
  - Label filtering (ignore/require specific labels)
  - Not already completed

#### 3.2 Issue Processing (`processIssue` in `automation-enhanced.js`)
1. **Directory Creation**: Creates issue-specific directory
2. **Label Management**: Adds `in-progress` and `swarm-active` labels
3. **Initial Comment**: Posts processing start notification
4. **Claude Prompt Creation**: Generates comprehensive prompt
5. **Claude Execution**: Runs Claude with MCP configuration
6. **Progress Monitoring**: Updates issue with progress
7. **Summary Creation**: Generates final summary
8. **Completion Handling**: Updates labels, may auto-close

### 4. Comment Processing Flow

#### 4.1 Comment Detection (`checkForNewComments`)
- Queries all repository comments since last check (with 30s buffer)
- Checks against processed comments cache
- Filters bot comments and AI-generated responses

#### 4.2 Comment Types
1. **@claude mentions**: Always processed
2. **Directives**: Commands like `/process`, `@automation`
3. **Human follow-ups**: Comments on completed issues

#### 4.3 Comment Processing
- **Directives**: Trigger full issue reprocessing
- **Follow-ups**: Use Claude to generate contextual responses
- **Error Handling**: Retry logic with exponential backoff

### 5. File Organization System

#### 5.1 Directory Structure
```
issues/
  issue-{number}/
    metadata.json      # Issue metadata and file tracking
    claude-prompt.txt  # Generated prompt
    execution.log      # Claude execution output
    SUMMARY.md        # Final summary with links
    [artifacts]       # Any created files
```

#### 5.2 File Tracking
- **Modified Files**: Tracked but kept in original locations
- **Artifacts**: New files created for the issue
- **Temporary Files**: Cleaned up after processing

### 6. AI Attribution System

#### 6.1 Agent Types
- CLAUDE: Claude AI Assistant
- RUV_SWARM: Swarm coordination
- SWARM_RESEARCHER/CODER/ANALYST/COORDINATOR: Specialized agents
- AUTOMATION: System automation

#### 6.2 Comment Attribution
- Wraps AI responses with headers/footers
- Includes agent type, timestamp, session info
- Adds metadata tags for tracking

### 7. Security Features

#### 7.1 Token Protection
- Tokens passed via environment variables only
- Never written to configuration files
- MCP config sanitized before writing

#### 7.2 File Safety
- Security checks before writing files
- Content sanitization available
- Path validation

### 8. Error Handling & Recovery

#### 8.1 Rate Limiting
- Detects GitHub secondary rate limits
- Implements delays between API calls
- 5-minute wait on rate limit hit

#### 8.2 MCP Server Recovery
- Automatic reconnection attempts
- Exponential backoff
- Auto-configuration if not present
- GitHub issue creation on persistent failure

#### 8.3 Comment Processing Errors
- Retry logic with exponential backoff
- Specific error messages for users
- Prevents marking failed comments as processed

## Key Configuration Points

### From `config-enhanced.json`:
- `github.pollInterval`: Check frequency (default: 60000ms)
- `filtering.ignoreLabels`: Labels to skip processing
- `filtering.completionLabel`: Mark as complete (`swarm-processed`)
- `automation.processingDelay`: Delay between operations

## Critical Functions

1. **Bot Identity**: Uses GitHub API to identify bot username
2. **Comment Detection**: 30-second buffer to catch edge cases
3. **File Organization**: Separates artifacts from code modifications
4. **Progress Updates**: Real-time feedback during processing
5. **Completion Handling**: Different behavior for bugs vs features

## Integration Points

1. **GitHub API**: Via Octokit for all GitHub operations
2. **Claude CLI**: For AI processing with MCP support
3. **MCP Servers**: ruv-swarm and GitHub MCP servers
4. **File System**: Organized storage and cleanup
5. **Event System**: EventEmitter for component communication
# GitHub Automation with Claude Code Coordination

This implementation uses Claude Code's native GitHub MCP capabilities to analyze and respond to GitHub issues.

## Architecture

The system follows the principle: **"ruv-swarm coordinates, Claude Code creates"**

```
GitHub Issue → Monitor → Coordinator → Claude Code (with GitHub MCP) → GitHub Comments
```

## Key Components

### 1. **monitor-coordinator.js**
- Fetches new GitHub issues
- Filters based on labels and creation time
- Processes issues sequentially
- Manages state with `.last-check` file

### 2. **automation-coordinator.js**
- Creates coordination scripts for Claude
- Executes Claude with `--print` flag for non-interactive mode
- Ensures GitHub MCP is available to Claude
- Manages issue labels and error handling

### 3. **automation-task-based.js** (Alternative)
- Uses Claude's Task tool to spawn parallel agents
- Each agent is instructed to post directly to GitHub
- Follows batch operation principles from CLAUDE.md

## How It Works

1. **Issue Detection**: Monitor checks for new issues every 5 minutes
2. **Label Management**: Adds `swarm-in-progress` label to prevent duplicate processing
3. **Claude Invocation**: Calls Claude with a prompt that includes:
   - Issue details (number, title, body)
   - Instructions to use GitHub MCP tools
   - Specific posting requirements
4. **Direct Posting**: Claude uses `mcp__github__add_issue_comment` to post findings
5. **Completion**: Removes `swarm-in-progress` and adds `swarm-processed` label

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure GitHub Token
```bash
export AGENT_TOKEN=your_github_token_here
```

### 3. Configure Claude MCP
```bash
# Add GitHub MCP server to Claude
claude mcp add github "npx @modelcontextprotocol/server-github"
```

### 4. Update Configuration
Edit `config-enhanced.json`:
- Set your GitHub owner/repo
- Configure filtering labels
- Adjust processing limits

### 5. Run the Monitor
```bash
# One-time run
./start-coordinator-monitor.sh

# Or schedule with cron (every 5 minutes)
*/5 * * * * cd /path/to/github-workflow && ./start-coordinator-monitor.sh >> automation.log 2>&1
```

## Example Claude Prompt

The coordinator creates prompts like this for Claude:

```
You are coordinating the analysis of GitHub issue #123.

IMPORTANT: You have access to GitHub MCP tools. Use them to post updates directly to the issue.

Issue Details:
- Repository: owner/repo
- Issue Number: 123
- Title: Need help with authentication
- Body: I'm trying to implement JWT auth...

Your tasks:
1. First, use mcp__github__add_issue_comment to post that you're starting the analysis
2. Analyze the issue and identify key requirements
3. Use mcp__github__add_issue_comment to post your analysis findings
4. Determine recommended approach and next steps
5. Use mcp__github__add_issue_comment to post recommendations
6. If appropriate, suggest labels using mcp__github__update_issue

Remember to use the GitHub MCP tools throughout your analysis to keep the issue updated.
```

## Key Differences from Previous Approaches

1. **No Interactive Mode**: Uses `--print` flag for non-interactive execution
2. **Direct MCP Access**: Claude directly uses GitHub MCP tools
3. **No Agent Subprocess Issues**: Claude is invoked directly, not through ruv-swarm agents
4. **Simpler Architecture**: Removes complexity of agent-to-Claude communication

## Troubleshooting

### Issue: Claude doesn't post to GitHub
- Check that GitHub MCP is configured: `claude mcp list`
- Verify AGENT_TOKEN is set correctly
- Check Claude's output in automation.log

### Issue: Duplicate processing
- Ensure label filtering is working
- Check `.last-check` file is being updated
- Verify cron isn't running multiple instances

### Issue: Claude timeout
- Complex issues may take longer to analyze
- Consider increasing timeout in coordinator
- Check if Claude is stuck in interactive mode (shouldn't happen with --print)

## Label Management

The system uses these labels:
- `swarm-in-progress`: Issue is currently being processed
- `swarm-processed`: Issue has been analyzed
- `automation:ignore`: Skip this issue entirely

Configure these in `config-enhanced.json` under `filtering`.

## Monitoring

Check the logs:
- `automation.log`: Main execution log
- `monitor-*.log`: Individual run logs
- GitHub issue comments: Direct feedback from Claude

## Future Enhancements

1. **Parallel Processing**: Use Task tool for multi-agent analysis
2. **Memory Integration**: Store analysis results in ruv-swarm memory
3. **Learning**: Use neural patterns to improve analysis over time
4. **Webhooks**: Real-time processing instead of polling

## Environment Variables

The system uses these environment variables:
- `AGENT_TOKEN`: GitHub personal access token with repo permissions
- `CLAUDE_MCP_CONFIG`: (Optional) Override MCP configuration

## To Use

```bash
# Set up GitHub token
export AGENT_TOKEN=your_token_here

# Run the coordinator monitor
./start-coordinator-monitor.sh
```
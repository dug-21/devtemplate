# GitHub Automation with ruv-swarm MCP Orchestration

This implementation uses Claude with ruv-swarm MCP tools to orchestrate swarm-based analysis of GitHub issues.

## Correct Architecture

**Claude uses ruv-swarm MCP tools** → ruv-swarm spawns agents → Agents coordinate analysis → Results posted to GitHub

```
GitHub Issue 
    ↓
Monitor 
    ↓
Claude (with ruv-swarm MCP + GitHub MCP)
    ├── mcp__ruv-swarm__swarm_init
    ├── mcp__ruv-swarm__agent_spawn (multiple agents)
    ├── mcp__ruv-swarm__task_orchestrate
    ├── mcp__ruv-swarm__memory_usage
    └── mcp__github__add_issue_comment
```

## Key Difference from Task Tool Approach

❌ **WRONG**: Claude uses Task tool to spawn agents (bypasses ruv-swarm)
✅ **CORRECT**: Claude uses ruv-swarm MCP tools to spawn agents (leverages full swarm benefits)

## Benefits of Using ruv-swarm MCP

1. **Coordination Framework**: Swarm topology (mesh, hierarchical, ring, star)
2. **Memory Management**: Persistent memory across agents and sessions
3. **Neural Learning**: Pattern learning and optimization over time
4. **Performance Tracking**: Built-in metrics and monitoring
5. **Parallel Execution**: True swarm coordination, not just parallel tasks
6. **Hook Integration**: Pre/post operation hooks for automation
7. **Self-Healing**: Automatic error recovery and retry logic

## Implementation Details

### 1. **automation-ruv-swarm.js**
- Creates prompts for Claude to use ruv-swarm MCP tools
- Ensures both ruv-swarm and GitHub MCP servers are available
- Manages issue labels and error handling

### 2. **monitor-ruv-swarm.js**
- Fetches GitHub issues
- Filters based on labels and timestamps
- Processes issues sequentially using ruv-swarm orchestration

### 3. **start-ruv-swarm-monitor.sh**
- Configures BOTH MCP servers (ruv-swarm + GitHub)
- Verifies environment setup
- Runs the monitor

## Claude's Prompt Structure

The system instructs Claude to:

1. **Initialize Swarm** (using mcp__ruv-swarm__swarm_init)
2. **Spawn Agents** (using mcp__ruv-swarm__agent_spawn)
   - researcher - Analyzes issue context
   - analyst - Identifies requirements
   - architect - Designs solutions
   - coordinator - Manages GitHub updates
3. **Store Context** (using mcp__ruv-swarm__memory_usage)
4. **Orchestrate Tasks** (using mcp__ruv-swarm__task_orchestrate)
5. **Post Updates** (using mcp__github__add_issue_comment)

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
npm install -g ruv-swarm
```

### 2. Configure MCP Servers
```bash
# Add ruv-swarm MCP server
claude mcp add ruv-swarm "npx ruv-swarm mcp start"

# Add GitHub MCP server  
claude mcp add github "npx @modelcontextprotocol/server-github"
```

### 3. Set Environment
```bash
export AGENT_TOKEN=your_github_token_here
```

### 4. Run the Monitor
```bash
./start-ruv-swarm-monitor.sh
```

## Example Claude Execution

When Claude processes an issue, it executes commands like:

```javascript
// Single message with multiple MCP tool calls (BatchTool pattern)
[
  mcp__ruv-swarm__swarm_init({ topology: "hierarchical", maxAgents: 5 }),
  mcp__ruv-swarm__agent_spawn({ type: "researcher", name: "Issue Researcher" }),
  mcp__ruv-swarm__agent_spawn({ type: "analyst", name: "Requirements Analyst" }),
  mcp__ruv-swarm__agent_spawn({ type: "architect", name: "Solution Designer" }),
  mcp__ruv-swarm__agent_spawn({ type: "coordinator", name: "GitHub Coordinator" }),
  mcp__ruv-swarm__memory_usage({ action: "store", key: "issue/123/context", value: {...} }),
  mcp__github__add_issue_comment({ issue_number: 123, body: "🐝 Swarm initialized..." })
]
```

## How ruv-swarm Agents Work

1. **Agents are Coordinators**: They don't directly execute code
2. **Memory Sharing**: Agents communicate through ruv-swarm memory
3. **Hook Integration**: Agents use hooks for coordination
4. **Neural Patterns**: Agents leverage learned patterns
5. **Parallel Execution**: True swarm behavior, not just parallel tasks

## Monitoring and Debugging

### Check Logs
```bash
tail -f automation.log
```

### Verify MCP Configuration
```bash
claude mcp list
```

### Test Single Issue
```bash
node test-single-issue.js 1
```

### Reset Processing
```bash
./reset-last-check.sh
```

## Key Advantages Over Direct Task Tool

1. **Swarm Benefits**: Full coordination framework, not just parallel execution
2. **Memory Persistence**: Cross-session learning and context
3. **Neural Optimization**: Performance improvements over time
4. **Hook Automation**: Pre/post operation automation
5. **Topology Control**: Different swarm structures for different tasks
6. **Performance Metrics**: Built-in monitoring and analysis

## Troubleshooting

### Issue: No swarm activity
- Check both MCP servers are configured: `claude mcp list`
- Verify ruv-swarm is installed: `npx ruv-swarm version`
- Check AGENT_TOKEN is set: `echo $AGENT_TOKEN`

### Issue: Agents not coordinating
- Ensure Claude is using BatchTool pattern (multiple tools in one message)
- Check memory is being used for coordination
- Verify hooks are configured in `.claude/settings.json`

### Issue: No GitHub posts
- Verify GitHub MCP server is configured
- Check token has appropriate permissions
- Look for errors in automation.log

## Future Enhancements

1. **Advanced Topologies**: Use different swarm structures based on issue type
2. **Neural Training**: Implement continuous learning from successful analyses
3. **Performance Optimization**: Use ruv-swarm benchmarking tools
4. **Advanced Memory**: Implement cross-issue learning patterns
5. **Hook Customization**: Issue-specific hook configurations
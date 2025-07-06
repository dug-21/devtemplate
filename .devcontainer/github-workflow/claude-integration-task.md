# Claude Code Task Template for GitHub Issues

This file demonstrates how ruv-swarm coordinates Claude Code to process GitHub issues.

## Task Structure for Claude Code

When the automation triggers, it creates a context file and invokes Claude with:

```bash
npx ruv-swarm claude-invoke "Process GitHub issue #X (phase). Context at .swarm-context-X.json. [Instructions]"
```

## What Claude Code Should Do:

1. **Read the context file** with issue details
2. **Use ruv-swarm MCP tools** for coordination:
   - `mcp__ruv-swarm__memory_usage` to access shared context
   - `mcp__ruv-swarm__agent_spawn` if more agents needed
   - `mcp__ruv-swarm__task_orchestrate` to break down complex tasks

3. **Process according to phase**:
   - **Idea**: Analyze feasibility, research similar solutions
   - **Research**: Find best practices, create comparisons
   - **Planning**: Design architecture, create task breakdown
   - **Implementation**: Provide code examples, testing approach

4. **Post results to GitHub** using the API with the token

## Example Claude Code Workflow:

```javascript
// 1. Read context
const context = Read(".swarm-context-123.json");

// 2. Use MCP tools for coordination
mcp__ruv-swarm__memory_usage({ action: "retrieve", key: "issue/123/context" });

// 3. Process with native tools
const research = WebSearch("best practices for " + context.issue.title);
const analysis = Read("similar-implementations.md");

// 4. Post results
const comment = `## Research Results\n\n${findings}`;
Bash(`curl -X POST -H "Authorization: token $GITHUB_TOKEN" ...`);
```

## Key Points:

- **ruv-swarm coordinates**, Claude Code executes
- Use **parallel processing** with BatchTool when possible
- Store progress in **ruv-swarm memory** for agent coordination
- Always **post results back to GitHub**
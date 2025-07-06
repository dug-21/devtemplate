/**
 * GitHub Automation using ruv-swarm MCP
 * Claude uses ruv-swarm MCP tools to spawn and coordinate agents
 */

const { Octokit } = require('@octokit/rest');
const { execSync, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class RuvSwarmGitHubAutomation {
    constructor(config) {
        this.config = config;
        this.octokit = new Octokit({
            auth: config.github.token
        });
        this.logFile = path.join(__dirname, 'automation.log');
    }

    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}\n`;
        console.log(logEntry.trim());
        await fs.appendFile(this.logFile, logEntry);
    }

    async processIssue(issue) {
        try {
            await this.log(`Processing issue #${issue.number}: ${issue.title}`);
            
            // Add in-progress label
            await this.addLabel(issue.number, this.config.filtering.inProgressLabel);
            
            // Post initial message
            await this.postComment(issue.number, `🐝 **Swarm Orchestration Starting**

I'm using ruv-swarm MCP tools to orchestrate a comprehensive analysis of this issue.

**Status**: Initializing swarm coordination framework...

I'll provide updates as the swarm progresses through the analysis.`);

            // Create a prompt for Claude to use ruv-swarm MCP tools
            const swarmPrompt = await this.createSwarmPrompt(issue);
            
            // Execute Claude with ruv-swarm MCP access
            await this.executeClaudeWithSwarm(swarmPrompt, issue);
            
            // Mark as processed
            await this.removeLabel(issue.number, this.config.filtering.inProgressLabel);
            await this.addLabel(issue.number, this.config.filtering.completionLabel);
            
            return { success: true };
            
        } catch (error) {
            await this.log(`Error processing issue #${issue.number}: ${error.message}`, 'ERROR');
            
            // Post error message
            await this.postComment(issue.number, `❌ **Swarm Orchestration Error**

An error occurred during swarm orchestration:
\`\`\`
${error.message}
\`\`\`

Please check the logs for more details.`);
            
            // Clean up labels
            await this.removeLabel(issue.number, this.config.filtering.inProgressLabel);
            
            return { success: false, error: error.message };
        }
    }

    async createSwarmPrompt(issue) {
        // Create a prompt that instructs Claude to use ruv-swarm MCP tools
        const prompt = `You need to analyze GitHub issue #${issue.number} using ruv-swarm MCP tools for orchestration.

IMPORTANT: You have access to BOTH ruv-swarm MCP tools AND GitHub MCP tools. Use them together for maximum effectiveness.

Issue Details:
- Repository: ${this.config.github.owner}/${this.config.github.repo}
- Issue Number: ${issue.number}
- Title: ${issue.title}
- Body: ${issue.body || 'No description provided'}
- Labels: ${issue.labels.map(l => l.name).join(', ')}

MANDATORY WORKFLOW - Use BatchTool pattern (single message, multiple tools):

1. Initialize swarm and spawn ALL agents in ONE message:
   - mcp__ruv-swarm__swarm_init { topology: "hierarchical", maxAgents: 5 }
   - mcp__ruv-swarm__agent_spawn { type: "researcher", name: "Issue Researcher" }
   - mcp__ruv-swarm__agent_spawn { type: "analyst", name: "Requirements Analyst" }
   - mcp__ruv-swarm__agent_spawn { type: "architect", name: "Solution Designer" }
   - mcp__ruv-swarm__agent_spawn { type: "coordinator", name: "GitHub Coordinator" }
   - mcp__github__add_issue_comment to post "🐝 Swarm initialized with 4 specialized agents"

2. Store issue context in memory:
   - mcp__ruv-swarm__memory_usage { action: "store", key: "issue/${issue.number}/context", value: {issue details} }

3. Orchestrate the analysis:
   - mcp__ruv-swarm__task_orchestrate { task: "Analyze GitHub issue #${issue.number}", strategy: "parallel" }
   - Monitor with mcp__ruv-swarm__swarm_monitor

4. As agents complete their analysis, use memory and post updates:
   - mcp__ruv-swarm__memory_usage { action: "retrieve", key: "swarm-*/agent-*/findings" }
   - mcp__github__add_issue_comment with findings from each agent

5. Synthesize results:
   - mcp__ruv-swarm__task_status to check completion
   - mcp__ruv-swarm__task_results to get comprehensive results
   - mcp__github__add_issue_comment with final synthesis

Remember:
- Use BatchTool pattern - multiple operations in single messages
- ruv-swarm provides coordination, memory, and neural learning benefits
- Post updates to GitHub throughout the process
- Leverage swarm memory for cross-agent coordination`;

        return prompt;
    }

    async executeClaudeWithSwarm(prompt, issue) {
        await this.log(`Executing Claude with ruv-swarm MCP for issue #${issue.number}`);
        
        // Create a script that ensures both MCP servers are available
        const scriptContent = `#!/bin/bash
set -e

# Ensure ruv-swarm MCP is configured
echo "🔧 Configuring MCP servers..."
claude mcp add ruv-swarm "npx ruv-swarm mcp start" || true
claude mcp add github "npx @modelcontextprotocol/server-github" || true

# Create prompt file to avoid shell escaping
PROMPT_FILE=$(mktemp)
cat > "$PROMPT_FILE" << 'EOF'
${prompt}
EOF

# Execute Claude with both MCP servers available
echo "🤖 Executing Claude with ruv-swarm and GitHub MCP..."
claude --print --dangerously-skip-permissions < "$PROMPT_FILE"

# Clean up
rm -f "$PROMPT_FILE"
`;

        const scriptPath = path.join(__dirname, `swarm-${issue.number}-${Date.now()}.sh`);
        await fs.writeFile(scriptPath, scriptContent, { mode: 0o755 });
        
        try {
            const result = execSync(`bash ${scriptPath}`, {
                encoding: 'utf8',
                maxBuffer: 10 * 1024 * 1024,
                env: {
                    ...process.env,
                    AGENT_TOKEN: this.config.github.token
                }
            });
            
            await this.log(`Claude execution completed successfully`);
            
        } catch (error) {
            await this.log(`Claude execution error: ${error.toString()}`, 'ERROR');
            throw error;
        } finally {
            // Clean up script
            await fs.unlink(scriptPath).catch(() => {});
        }
    }

    async postComment(issueNumber, comment) {
        try {
            await this.octokit.issues.createComment({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                issue_number: issueNumber,
                body: comment
            });
            await this.log(`Posted comment to issue #${issueNumber}`);
        } catch (error) {
            await this.log(`Failed to post comment: ${error.message}`, 'ERROR');
        }
    }

    async addLabel(issueNumber, label) {
        try {
            await this.octokit.issues.addLabels({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                issue_number: issueNumber,
                labels: [label]
            });
            await this.log(`Added label '${label}' to issue #${issueNumber}`);
        } catch (error) {
            await this.log(`Failed to add label: ${error.message}`, 'ERROR');
        }
    }

    async removeLabel(issueNumber, label) {
        try {
            await this.octokit.issues.removeLabel({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                issue_number: issueNumber,
                name: label
            });
            await this.log(`Removed label '${label}' from issue #${issueNumber}`);
        } catch (error) {
            // Label might not exist, which is fine
            await this.log(`Failed to remove label: ${error.message}`, 'WARN');
        }
    }
}

module.exports = RuvSwarmGitHubAutomation;
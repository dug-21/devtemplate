/**
 * GitHub Automation with Claude Integration
 * This version ensures Claude is properly invoked to analyze and post to GitHub
 */

const { Octokit } = require('@octokit/rest');
const { execSync, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class ClaudeIntegratedAutomation {
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
            await this.postComment(issue.number, `🐝 **Analysis Starting with Claude + ruv-swarm**

I'm using Claude with ruv-swarm coordination to analyze this issue.

**Approach**: Claude will use ruv-swarm MCP tools to coordinate the analysis and post updates directly to this issue.

**Status**: Invoking Claude with analysis instructions...`);

            // Create a comprehensive prompt for Claude
            const claudePrompt = this.createClaudePrompt(issue);
            
            // Execute Claude directly with the prompt
            await this.executeClaudeAnalysis(claudePrompt, issue);
            
            // Mark as processed
            await this.removeLabel(issue.number, this.config.filtering.inProgressLabel);
            await this.addLabel(issue.number, this.config.filtering.completionLabel);
            
            return { success: true };
            
        } catch (error) {
            await this.log(`Error processing issue #${issue.number}: ${error.message}`, 'ERROR');
            
            // Post error message
            await this.postComment(issue.number, `❌ **Analysis Error**

An error occurred during analysis:
\`\`\`
${error.message}
\`\`\`

Please check the logs for more details.`);
            
            // Clean up labels
            await this.removeLabel(issue.number, this.config.filtering.inProgressLabel);
            
            return { success: false, error: error.message };
        }
    }

    createClaudePrompt(issue) {
        return `You need to analyze GitHub issue #${issue.number} and post your findings directly to the issue.

IMPORTANT: You have access to both ruv-swarm MCP tools AND GitHub MCP tools. Your job is to:
1. Use ruv-swarm tools to coordinate a multi-perspective analysis
2. Use GitHub MCP tools to post updates as you progress

Issue Details:
- Repository: ${this.config.github.owner}/${this.config.github.repo}
- Issue Number: ${issue.number}
- Title: ${issue.title}
- Body: ${issue.body || 'No description provided'}
- Labels: ${issue.labels.map(l => l.name).join(', ')}

STEP-BY-STEP INSTRUCTIONS:

1. First, post that you're starting the analysis:
   mcp__github__add_issue_comment({
     owner: "${this.config.github.owner}",
     repo: "${this.config.github.repo}",
     issue_number: ${issue.number},
     body: "🔍 **Starting Detailed Analysis**\\n\\nI'm now analyzing your issue from multiple perspectives..."
   })

2. Initialize ruv-swarm for coordination (use BatchTool - single message):
   - mcp__ruv-swarm__swarm_init({ topology: "hierarchical", maxAgents: 4 })
   - mcp__ruv-swarm__agent_spawn({ type: "researcher", name: "Context Researcher" })
   - mcp__ruv-swarm__agent_spawn({ type: "analyst", name: "Requirements Analyst" })
   - mcp__ruv-swarm__agent_spawn({ type: "architect", name: "Solution Designer" })
   - mcp__ruv-swarm__agent_spawn({ type: "coordinator", name: "Synthesis Coordinator" })

3. Store the issue context in memory:
   mcp__ruv-swarm__memory_usage({
     action: "store",
     key: "issue/${issue.number}/context",
     value: { title: "${issue.title}", body: "${issue.body || ''}", labels: ${JSON.stringify(issue.labels.map(l => l.name))} }
   })

4. Orchestrate the analysis:
   mcp__ruv-swarm__task_orchestrate({
     task: "Analyze GitHub issue #${issue.number}: ${issue.title}",
     strategy: "adaptive"
   })

5. For this specific issue about "${issue.title}", provide:
   - Understanding of the core request
   - Key requirements or goals
   - Recommended approach or solution
   - Potential challenges or considerations
   - Clear next steps

6. Post your analysis findings using GitHub MCP:
   mcp__github__add_issue_comment({
     owner: "${this.config.github.owner}",
     repo: "${this.config.github.repo}",
     issue_number: ${issue.number},
     body: "📊 **Analysis Results**\\n\\n[Your detailed findings here]"
   })

7. If appropriate, suggest labels for the issue:
   mcp__github__update_issue({
     owner: "${this.config.github.owner}",
     repo: "${this.config.github.repo}",
     issue_number: ${issue.number},
     labels: [existing labels + any new suggestions]
   })

Remember: Post multiple updates as you analyze different aspects. Don't wait until the end to post everything.`;
    }

    async executeClaudeAnalysis(prompt, issue) {
        await this.log(`Executing Claude analysis for issue #${issue.number}`);
        
        // Create a temporary file for the prompt to avoid shell escaping issues
        const promptFile = path.join(__dirname, `prompt-${issue.number}-${Date.now()}.txt`);
        await fs.writeFile(promptFile, prompt);
        
        try {
            // Create MCP config file to ensure Claude loads both servers
            const mcpConfigPath = path.join(__dirname, `mcp-config-${issue.number}.json`);
            const mcpConfig = {
                mcpServers: {
                    "ruv-swarm": {
                        command: "npx",
                        args: ["ruv-swarm", "mcp", "start"]
                    },
                    github: {
                        command: "npx",
                        args: ["@modelcontextprotocol/server-github"],
                        env: {
                            AGENT_TOKEN: this.config.github.token
                        }
                    }
                }
            };
            await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
            
            // Execute Claude with MCP config
            const command = `claude --print --dangerously-skip-permissions --mcp-config "${mcpConfigPath}" < "${promptFile}"`;
            
            const result = execSync(command, {
                encoding: 'utf8',
                maxBuffer: 10 * 1024 * 1024,
                env: {
                    ...process.env,
                    AGENT_TOKEN: this.config.github.token
                }
            });
            
            // Clean up MCP config file
            await fs.unlink(mcpConfigPath).catch(() => {});
            
            await this.log(`Claude analysis completed successfully`);
            await this.log(`Result preview: ${result.substring(0, 500)}...`);
            
        } catch (error) {
            await this.log(`Claude execution error: ${error.toString()}`, 'ERROR');
            throw error;
        } finally {
            // Clean up prompt file
            await fs.unlink(promptFile).catch(() => {});
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

module.exports = ClaudeIntegratedAutomation;
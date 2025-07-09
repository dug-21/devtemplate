/**
 * Task-based GitHub Automation
 * Uses Claude's Task tool to spawn agents that can post to GitHub
 */

const { Octokit } = require('@octokit/rest');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class TaskBasedGitHubAutomation {
    constructor(config) {
        this.config = config;
        this.octokit = new Octokit({
            auth: config.github.token
        });
        this.logFile = path.join(__dirname, 'automation.log');
        this.tempDir = path.join(__dirname, 'temp');
    }

    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}\n`;
        console.log(logEntry.trim());
        await fs.appendFile(this.logFile, logEntry);
    }

    async ensureTempDir() {
        await fs.mkdir(this.tempDir, { recursive: true });
    }

    async processIssue(issue) {
        try {
            await this.log(`Processing issue #${issue.number}: ${issue.title}`);
            await this.ensureTempDir();
            
            // Add in-progress label
            await this.addLabel(issue.number, this.config.filtering.inProgressLabel);
            
            // Post initial message
            await this.postComment(issue.number, `🐝 **Task-based Analysis Starting**

I'm using Claude's Task tool to spawn specialized agents for analyzing this issue.

**Status**: Creating analysis tasks...

Updates will be posted as each agent completes their analysis.`);

            // Create a comprehensive prompt for Claude to use Task tool
            const taskPrompt = await this.createTaskPrompt(issue);
            
            // Execute Claude with the task prompt
            await this.executeClaudeWithTasks(taskPrompt, issue);
            
            // Mark as processed
            await this.removeLabel(issue.number, this.config.filtering.inProgressLabel);
            await this.addLabel(issue.number, this.config.filtering.completionLabel);
            
            return { success: true };
            
        } catch (error) {
            await this.log(`Error processing issue #${issue.number}: ${error.message}`, 'ERROR');
            
            // Post error message
            await this.postComment(issue.number, `❌ **Task Execution Error**

An error occurred during task-based analysis:
\`\`\`
${error.message}
\`\`\`

Please check the logs for more details.`);
            
            // Clean up labels
            await this.removeLabel(issue.number, this.config.filtering.inProgressLabel);
            
            return { success: false, error: error.message };
        }
    }

    async createTaskPrompt(issue) {
        // Create a prompt that instructs Claude to use Task tool with GitHub posting
        const prompt = `You need to analyze GitHub issue #${issue.number} using the Task tool to spawn specialized agents.

IMPORTANT: You have access to both Task tool and GitHub MCP tools. Each agent you spawn should be instructed to post their findings to GitHub.

Issue Details:
- Repository: ${this.config.github.owner}/${this.config.github.repo}
- Issue Number: ${issue.number}
- Title: ${issue.title}
- Body: ${issue.body || 'No description provided'}
- Labels: ${issue.labels.map(l => l.name).join(', ')}

Instructions:
1. Use the Task tool to spawn multiple agents in PARALLEL (single message with multiple Task calls)
2. Each agent MUST be instructed to use mcp__github__add_issue_comment to post findings
3. Spawn these agents:
   - "Issue Analyzer" - Analyze requirements and post summary
   - "Solution Designer" - Design approach and post recommendations
   - "Implementation Planner" - Create implementation steps and post plan
   - "Risk Assessor" - Identify risks/challenges and post assessment

Example agent prompt:
Task("Issue Analyzer", "Analyze GitHub issue #${issue.number} in repo ${this.config.github.owner}/${this.config.github.repo}. Focus on understanding the core requirements and user needs. After analysis, use mcp__github__add_issue_comment to post your findings directly to issue ${issue.number}. Start your comment with '🔍 **Issue Analysis**'")

Remember: 
- Spawn ALL agents in ONE message using multiple Task tool calls
- Each agent MUST post to GitHub using mcp__github__add_issue_comment
- Agents should work in parallel, not sequentially`;

        return prompt;
    }

    async executeClaudeWithTasks(prompt, issue) {
        await this.log(`Executing Claude with task-based approach for issue #${issue.number}`);
        
        // Write prompt to file to avoid shell escaping issues
        const promptFile = path.join(this.tempDir, `prompt-${issue.number}-${Date.now()}.txt`);
        await fs.writeFile(promptFile, prompt);
        
        try {
            // Execute Claude with the prompt
            const command = `claude --print --dangerously-skip-permissions < "${promptFile}"`;
            
            const result = execSync(command, {
                encoding: 'utf8',
                maxBuffer: 10 * 1024 * 1024,
                env: {
                    ...process.env,
                    AGENT_TOKEN: this.config.github.token,
                    // Ensure GitHub MCP is available
                    CLAUDE_MCP_CONFIG: JSON.stringify({
                        github: {
                            command: "npx",
                            args: ["@modelcontextprotocol/server-github"],
                            env: {
                                AGENT_TOKEN: this.config.github.token
                            }
                        }
                    })
                }
            });
            
            await this.log(`Claude task execution completed`);
            
            // Wait a bit for agents to complete their work
            await this.waitForAgents(30000); // 30 seconds
            
        } catch (error) {
            await this.log(`Claude execution error: ${error.toString()}`, 'ERROR');
            throw error;
        } finally {
            // Clean up prompt file
            await fs.unlink(promptFile).catch(() => {});
        }
    }

    async waitForAgents(duration) {
        await this.log(`Waiting ${duration/1000} seconds for agents to complete...`);
        await new Promise(resolve => setTimeout(resolve, duration));
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

module.exports = TaskBasedGitHubAutomation;
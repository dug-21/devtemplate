/**
 * GitHub Automation Coordinator
 * Uses ruv-swarm for coordination and Claude Code for execution
 */

const { Octokit } = require('@octokit/rest');
const { execSync, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class GitHubAutomationCoordinator {
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
            await this.postComment(issue.number, `🐝 **Swarm Coordination Initiated**

I'm starting an analysis of this issue using ruv-swarm coordination with Claude Code.

**Status**: Setting up coordination framework...

I'll provide step-by-step updates as the analysis progresses.`);

            // Create a coordination script that uses Claude Code with GitHub MCP
            const coordinationScript = await this.createCoordinationScript(issue);
            
            // Execute the coordination script
            await this.executeCoordination(coordinationScript, issue);
            
            // Mark as processed
            await this.removeLabel(issue.number, this.config.filtering.inProgressLabel);
            await this.addLabel(issue.number, this.config.filtering.completionLabel);
            
            return { success: true };
            
        } catch (error) {
            await this.log(`Error processing issue #${issue.number}: ${error.message}`, 'ERROR');
            
            // Post error message
            await this.postComment(issue.number, `❌ **Error in Coordination**

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

    async createCoordinationScript(issue) {
        // Create a script that uses Claude Code's GitHub MCP capabilities
        const scriptContent = `#!/bin/bash
set -e

# GitHub issue details
ISSUE_NUMBER="${issue.number}"
REPO_OWNER="${this.config.github.owner}"
REPO_NAME="${this.config.github.repo}"
ISSUE_TITLE="${issue.title.replace(/"/g, '\\"')}"
ISSUE_BODY="${(issue.body || 'No description').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"

echo "🐝 Starting coordination for issue #$ISSUE_NUMBER"

# Initialize swarm for coordination
echo "📊 Initializing swarm..."
npx ruv-swarm init hierarchical 5 --force

# Create the main coordination prompt for Claude
PROMPT="You are coordinating the analysis of GitHub issue #$ISSUE_NUMBER.

IMPORTANT: You have access to GitHub MCP tools. Use them to post updates directly to the issue.

Issue Details:
- Repository: $REPO_OWNER/$REPO_NAME
- Issue Number: $ISSUE_NUMBER
- Title: $ISSUE_TITLE
- Body: $ISSUE_BODY

Your tasks:
1. First, use mcp__github__add_issue_comment to post that you're starting the analysis
2. Analyze the issue and identify key requirements
3. Use mcp__github__add_issue_comment to post your analysis findings
4. Determine recommended approach and next steps
5. Use mcp__github__add_issue_comment to post recommendations
6. If appropriate, suggest labels using mcp__github__update_issue

Remember to use the GitHub MCP tools throughout your analysis to keep the issue updated."

# Execute Claude with GitHub MCP access
echo "🤖 Invoking Claude with GitHub MCP access..."
claude "$PROMPT" --print --dangerously-skip-permissions

echo "✅ Coordination complete"
`;

        const scriptPath = path.join(__dirname, `coord-${issue.number}-${Date.now()}.sh`);
        await fs.writeFile(scriptPath, scriptContent, { mode: 0o755 });
        
        return scriptPath;
    }

    async executeCoordination(scriptPath, issue) {
        await this.log(`Executing coordination script for issue #${issue.number}`);
        
        return new Promise((resolve, reject) => {
            const env = {
                ...process.env,
                AGENT_TOKEN: this.config.github.token,
                // Ensure Claude can access GitHub MCP
                CLAUDE_MCP_CONFIG: JSON.stringify({
                    github: {
                        command: "npx",
                        args: ["@modelcontextprotocol/server-github"],
                        env: {
                            AGENT_TOKEN: this.config.github.token
                        }
                    }
                })
            };

            const proc = spawn('bash', [scriptPath], {
                env,
                stdio: ['inherit', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                console.log(output);
            });

            proc.stderr.on('data', (data) => {
                const error = data.toString();
                stderr += error;
                console.error(error);
            });

            proc.on('close', async (code) => {
                // Clean up script
                await fs.unlink(scriptPath).catch(() => {});
                
                if (code === 0) {
                    await this.log(`Coordination completed successfully for issue #${issue.number}`);
                    resolve();
                } else {
                    await this.log(`Coordination failed with code ${code}`, 'ERROR');
                    reject(new Error(`Coordination failed with exit code ${code}`));
                }
            });

            proc.on('error', (err) => {
                reject(err);
            });

            // Timeout after 10 minutes
            setTimeout(() => {
                proc.kill('SIGTERM');
                reject(new Error('Coordination timeout'));
            }, 600000);
        });
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

module.exports = GitHubAutomationCoordinator;
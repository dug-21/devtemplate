/**
 * Enhanced GitHub Automation with ruv-swarm
 * Uses Claude's --print mode for non-interactive execution
 */

const { Octokit } = require('@octokit/rest');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class SwarmGitHubAutomation {
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
            
            // Initialize swarm for this issue
            const swarmId = `issue-${issue.number}-${Date.now()}`;
            await this.initializeSwarm(swarmId);
            
            // Post initial message
            await this.postComment(issue.number, `🐝 **Swarm Analysis Initiated**

I'm starting a comprehensive analysis of this issue using ruv-swarm coordination.

**Swarm ID**: \`${swarmId}\`
**Status**: Initializing agents...

I'll provide updates as the analysis progresses.`);

            // Spawn coordinator agent with GitHub posting capability
            await this.spawnCoordinator(swarmId, issue);
            
            // Execute analysis with periodic updates
            await this.executeAnalysis(swarmId, issue);
            
            // Mark as processed
            await this.removeLabel(issue.number, this.config.filtering.inProgressLabel);
            await this.addLabel(issue.number, this.config.filtering.completionLabel);
            
            return { success: true, swarmId };
            
        } catch (error) {
            await this.log(`Error processing issue #${issue.number}: ${error.message}`, 'ERROR');
            
            // Post error message
            await this.postComment(issue.number, `❌ **Error in Swarm Analysis**

I encountered an error while analyzing this issue:
\`\`\`
${error.message}
\`\`\`

Please check the logs for more details.`);
            
            // Clean up labels
            await this.removeLabel(issue.number, this.config.filtering.inProgressLabel);
            
            return { success: false, error: error.message };
        }
    }

    async initializeSwarm(swarmId) {
        await this.log(`Initializing swarm ${swarmId}`);
        try {
            execSync(`npx ruv-swarm init hierarchical 5 --force`, { 
                stdio: 'inherit',
                env: { ...process.env, SWARM_ID: swarmId }
            });
        } catch (error) {
            await this.log(`Swarm init output: ${error.toString()}`, 'WARN');
        }
    }

    async spawnCoordinator(swarmId, issue) {
        await this.log(`Spawning coordinator for issue #${issue.number}`);
        
        // Create a Claude invocation script for the coordinator
        const coordinatorScript = `#!/bin/bash
# Coordinator script for issue #${issue.number}

# Step 1: Analyze the issue
echo "📊 Analyzing issue #${issue.number}..."
ANALYSIS=$(npx ruv-swarm claude-invoke "Analyze GitHub issue #${issue.number}: ${issue.title}. Body: ${issue.body?.replace(/"/g, '\\"') || 'No description'}" --print)

# Step 2: Post analysis to GitHub
echo "📝 Posting analysis to GitHub..."
npx ruv-swarm claude-invoke "Use the GitHub MCP tool mcp__github__add_issue_comment to post this analysis to issue ${issue.number} in repository ${this.config.github.owner}/${this.config.github.repo}. Analysis: $ANALYSIS" --print

# Step 3: Spawn specialized agents based on issue type
echo "🤖 Spawning specialized agents..."
npx ruv-swarm spawn researcher "Issue Researcher"
npx ruv-swarm spawn analyst "Issue Analyst"

# Step 4: Orchestrate detailed analysis
echo "🔄 Orchestrating detailed analysis..."
DETAILED=$(npx ruv-swarm orchestrate "Perform detailed analysis of issue #${issue.number}: ${issue.title}" --parallel)

# Step 5: Post findings
echo "📊 Posting findings..."
npx ruv-swarm claude-invoke "Use mcp__github__add_issue_comment to post the detailed findings to issue ${issue.number}. Findings: $DETAILED" --print
`;

        // Write and execute the coordinator script
        const scriptPath = path.join(__dirname, `coordinator-${swarmId}.sh`);
        await fs.writeFile(scriptPath, coordinatorScript, { mode: 0o755 });
        
        try {
            execSync(`bash ${scriptPath}`, {
                stdio: 'inherit',
                env: {
                    ...process.env,
                    SWARM_ID: swarmId,
                    AGENT_TOKEN: this.config.github.token
                }
            });
        } catch (error) {
            await this.log(`Coordinator execution error: ${error.toString()}`, 'ERROR');
        } finally {
            // Clean up script
            await fs.unlink(scriptPath).catch(() => {});
        }
    }

    async executeAnalysis(swarmId, issue) {
        await this.log(`Executing analysis for issue #${issue.number}`);
        
        // Create a comprehensive analysis prompt
        const analysisPrompt = `
You are analyzing GitHub issue #${issue.number}.

Title: ${issue.title}
Body: ${issue.body || 'No description provided'}
Labels: ${issue.labels.map(l => l.name).join(', ')}

Please provide:
1. A summary of the issue
2. Key requirements or problems to solve
3. Recommended approach
4. Potential challenges
5. Next steps

After analysis, use the GitHub MCP tool (mcp__github__add_issue_comment) to post your findings directly to the issue.
Repository: ${this.config.github.owner}/${this.config.github.repo}
Issue Number: ${issue.number}
`;

        // Execute Claude with --print mode for non-interactive execution
        const claudeCommand = `npx ruv-swarm claude-invoke "${analysisPrompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" --print --dangerously-skip-permissions`;
        
        try {
            const result = execSync(claudeCommand, {
                encoding: 'utf8',
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                env: {
                    ...process.env,
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
            
            await this.log(`Claude analysis completed: ${result.substring(0, 200)}...`);
            
            // If Claude didn't post directly, post the result
            if (result && !result.includes('Posted comment to issue')) {
                await this.postComment(issue.number, `🔍 **Swarm Analysis Results**

${result}

---
*Analysis completed by ruv-swarm with Claude integration*`);
            }
            
        } catch (error) {
            await this.log(`Claude execution error: ${error.toString()}`, 'ERROR');
            throw error;
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

module.exports = SwarmGitHubAutomation;
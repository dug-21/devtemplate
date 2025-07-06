#!/usr/bin/env node

/**
 * Enhanced GitHub Monitor V2
 * Features:
 * - Monitors for new issues and comments
 * - Triggers enhanced automation with progress tracking
 * - Handles human responses to bot comments
 * - Supports concurrent issue processing
 */

const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');
const EnhancedGitHubAutomation = require('./automation-enhanced-v2');

class EnhancedGitHubMonitor {
    constructor(config) {
        this.config = config;
        this.octokit = new Octokit({
            auth: config.github.token || process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN
        });
        this.automation = new EnhancedGitHubAutomation(config);
        this.lastCheckFile = path.join(__dirname, '.last-check-enhanced');
        this.processedComments = new Set();
        this.botUsername = null; // Will be fetched
    }

    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    async getBotUsername() {
        if (!this.botUsername) {
            const { data: user } = await this.octokit.users.getAuthenticated();
            this.botUsername = user.login;
            await this.log(`Bot username: ${this.botUsername}`);
        }
        return this.botUsername;
    }

    async getLastCheckTime() {
        try {
            const content = await fs.readFile(this.lastCheckFile, 'utf8');
            return new Date(content.trim());
        } catch (error) {
            // If file doesn't exist, return 24 hours ago
            return new Date(Date.now() - 24 * 60 * 60 * 1000);
        }
    }

    async updateLastCheckTime() {
        await fs.writeFile(this.lastCheckFile, new Date().toISOString());
    }

    async checkForNewIssues() {
        const lastCheck = await this.getLastCheckTime();
        await this.log(`Checking for issues created after ${lastCheck.toISOString()}`);

        try {
            const { data: issues } = await this.octokit.issues.listForRepo({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                state: 'open',
                sort: 'created',
                direction: 'desc',
                since: lastCheck.toISOString(),
                per_page: 100
            });

            const newIssues = issues.filter(issue => {
                // Skip pull requests
                if (issue.pull_request) return false;
                
                // Skip if created before last check
                if (new Date(issue.created_at) <= lastCheck) return false;
                
                // Check ignore labels
                const labels = issue.labels.map(l => l.name);
                if (this.config.filtering.ignoreLabels.some(l => labels.includes(l))) {
                    return false;
                }
                
                // Skip if already processed (has swarm-processed label)
                if (labels.includes(this.config.filtering.completionLabel)) {
                    return false;
                }
                
                // Check required labels
                if (this.config.filtering.requireLabels.length > 0) {
                    if (!this.config.filtering.requireLabels.some(l => labels.includes(l))) {
                        return false;
                    }
                }
                
                return true;
            });

            if (newIssues.length > 0) {
                await this.log(`Found ${newIssues.length} new issues to process`);
                
                // Process issues (up to 3 concurrently)
                await this.automation.handleConcurrentIssues(newIssues);
            } else {
                await this.log('No new issues found');
            }

        } catch (error) {
            await this.log(`Error checking for issues: ${error.message}`, 'ERROR');
        }
    }

    async checkForHumanResponses() {
        const lastCheck = await this.getLastCheckTime();
        const botUsername = await this.getBotUsername();
        
        await this.log(`Checking for human responses to bot comments`);

        try {
            // Get recent comments
            const { data: comments } = await this.octokit.issues.listCommentsForRepo({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                sort: 'created',
                direction: 'desc',
                since: lastCheck.toISOString(),
                per_page: 100
            });

            // Filter for human comments on issues with bot activity
            for (const comment of comments) {
                // Skip if already processed
                if (this.processedComments.has(comment.id)) continue;
                
                // Skip bot's own comments
                if (comment.user.login === botUsername) continue;
                
                // Check if this issue has bot comments
                const { data: issueComments } = await this.octokit.issues.listComments({
                    owner: this.config.github.owner,
                    repo: this.config.github.repo,
                    issue_number: comment.issue_url.split('/').pop()
                });
                
                const hasBotComment = issueComments.some(c => c.user.login === botUsername);
                
                if (hasBotComment && this.isQuestionOrRequest(comment.body)) {
                    await this.handleHumanResponse(comment);
                    this.processedComments.add(comment.id);
                }
            }

        } catch (error) {
            await this.log(`Error checking for human responses: ${error.message}`, 'ERROR');
        }
    }

    isQuestionOrRequest(text) {
        const patterns = [
            /\?$/,
            /can you/i,
            /could you/i,
            /please/i,
            /help/i,
            /update/i,
            /change/i,
            /fix/i,
            /add/i,
            /modify/i,
            /@\w+/  // Mentions
        ];
        
        return patterns.some(pattern => pattern.test(text));
    }

    async handleHumanResponse(comment) {
        const issueNumber = comment.issue_url.split('/').pop();
        await this.log(`Handling human response on issue #${issueNumber}`);
        
        try {
            // Get issue details
            const { data: issue } = await this.octokit.issues.get({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                issue_number: issueNumber
            });
            
            // Check if this is a swarm-processed issue getting new instructions
            const labels = issue.labels.map(l => l.name);
            const isProcessedIssue = labels.includes(this.config.filtering.completionLabel);
            
            if (isProcessedIssue && this.isQuestionOrRequest(comment.body)) {
                await this.log(`Reprocessing issue #${issueNumber} based on new human instructions`);
                // Remove swarm-processed label to allow reprocessing
                await this.octokit.issues.removeLabel({
                    owner: this.config.github.owner,
                    repo: this.config.github.repo,
                    issue_number: issueNumber,
                    name: this.config.filtering.completionLabel
                }).catch(() => {}); // Ignore if label doesn't exist
                
                // Process the issue with the new context
                await this.automation.processIssue(issue);
                return;
            }
            
            // Create Claude prompt for response
            const prompt = `A human has responded to your work on GitHub issue #${issueNumber}.

Human comment:
"${comment.body}"

Context:
- Issue Title: ${issue.title}
- Issue State: ${issue.state}
- Your previous work: Check issue comments

Please respond appropriately:
1. If they're asking a question, provide a helpful answer
2. If they're requesting changes, acknowledge and implement if reasonable
3. If they're reporting an issue, investigate and provide a solution

Use GitHub MCP tools to post your response.`;
            
            // Execute Claude to handle the response
            const promptFile = path.join(__dirname, `response-${issueNumber}-${Date.now()}.txt`);
            await fs.writeFile(promptFile, prompt);
            
            const mcpConfigPath = path.join(__dirname, `mcp-config-response-${issueNumber}.json`);
            const mcpConfig = {
                mcpServers: {
                    github: {
                        command: "npx",
                        args: ["@modelcontextprotocol/server-github"],
                        env: {
                            AGENT_TOKEN: this.config.github.token || process.env.AGENT_TOKEN
                        }
                    }
                }
            };
            await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
            
            const command = `claude --print --dangerously-skip-permissions --mcp-config "${mcpConfigPath}" < "${promptFile}"`;
            
            require('child_process').execSync(command, {
                encoding: 'utf8',
                env: {
                    ...process.env,
                    AGENT_TOKEN: this.config.github.token || process.env.AGENT_TOKEN
                }
            });
            
            // Clean up
            await fs.unlink(mcpConfigPath).catch(() => {});
            await fs.unlink(promptFile).catch(() => {});
            
        } catch (error) {
            await this.log(`Error handling human response: ${error.message}`, 'ERROR');
        }
    }

    async run() {
        await this.log('🚀 Enhanced GitHub Monitor V2 starting...');
        
        // Initial check
        await this.checkForNewIssues();
        await this.checkForHumanResponses();
        await this.updateLastCheckTime();
        
        // Set up interval
        const interval = this.config.github.pollInterval || 300000; // 5 minutes default
        
        setInterval(async () => {
            await this.checkForNewIssues();
            await this.checkForHumanResponses();
            await this.updateLastCheckTime();
        }, interval);
        
        await this.log(`Monitor running, checking every ${interval / 1000} seconds`);
    }
}

// Run if called directly
if (require.main === module) {
    const config = require('./config.json');
    const monitor = new EnhancedGitHubMonitor(config);
    
    monitor.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = EnhancedGitHubMonitor;
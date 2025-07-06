#!/usr/bin/env node

/**
 * Enhanced GitHub Monitor V3 with MCP Integration
 * Combines GitHub monitoring with MCP server health checks
 */

const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');
const { spawn, exec, execSync } = require('child_process');
const EventEmitter = require('events');
const EnhancedGitHubAutomation = require('./automation-enhanced');

class MCPServerMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            serverName: 'ruv-swarm',
            checkInterval: 60000, // Check every 60 seconds
            reconnectDelay: 5000, // Wait 5 seconds before reconnecting
            maxReconnectAttempts: 5,
            healthCheckTimeout: 10000, // 10 second timeout for health checks
            ...config
        };
        
        this.isHealthy = false;
        this.reconnectAttempts = 0;
        this.lastHealthCheck = null;
        this.metrics = {
            totalDisconnects: 0,
            totalReconnects: 0,
            lastDisconnect: null,
            lastReconnect: null,
            uptime: 0,
            startTime: Date.now()
        };
    }

    async checkHealth() {
        try {
            // Try to list MCP servers
            const result = await this.executeCommand('claude mcp list', this.config.healthCheckTimeout);
            
            // Check if our server is in the list
            const hasServer = result.includes(this.config.serverName);
            const wasHealthy = this.isHealthy;
            
            this.isHealthy = hasServer;
            this.lastHealthCheck = new Date();
            
            if (!wasHealthy && hasServer) {
                this.emit('reconnected');
                this.metrics.totalReconnects++;
                this.metrics.lastReconnect = new Date();
                this.reconnectAttempts = 0;
            } else if (wasHealthy && !hasServer) {
                this.emit('disconnected');
                this.metrics.totalDisconnects++;
                this.metrics.lastDisconnect = new Date();
            }
            
            return hasServer;
        } catch (error) {
            this.isHealthy = false;
            this.emit('error', error);
            return false;
        }
    }

    async executeCommand(command, timeout) {
        return new Promise((resolve, reject) => {
            exec(command, { timeout }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    async reconnect() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            this.emit('max-reconnects-reached');
            return false;
        }

        this.reconnectAttempts++;
        this.emit('reconnecting', this.reconnectAttempts);

        try {
            // Try to restart the MCP server
            await this.executeCommand(
                `claude mcp restart ${this.config.serverName}`,
                this.config.healthCheckTimeout
            );
            
            // Wait before checking health
            await this.delay(this.config.reconnectDelay);
            
            // Check if reconnection was successful
            const healthy = await this.checkHealth();
            if (healthy) {
                return true;
            }
        } catch (error) {
            this.emit('reconnect-failed', error);
        }

        // Exponential backoff
        const backoffDelay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        await this.delay(backoffDelay);
        
        return false;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getMetrics() {
        const uptime = Date.now() - this.metrics.startTime;
        return {
            ...this.metrics,
            uptime: Math.floor(uptime / 1000), // seconds
            isHealthy: this.isHealthy,
            lastHealthCheck: this.lastHealthCheck
        };
    }
}

class EnhancedGitHubMonitorV3 {
    constructor(config) {
        this.config = config;
        this.octokit = new Octokit({
            auth: config.github.token || process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN
        });
        this.automation = new EnhancedGitHubAutomation(config);
        this.lastCheckFile = path.join(__dirname, '.last-check-enhanced-v3');
        this.processedCommentsFile = path.join(__dirname, '.processed-comments-v3.json');
        this.processedComments = new Set();
        this.botUsername = null;
        this.logFile = path.join(__dirname, 'logs', 'monitor-v3.log');
        
        // Initialize MCP monitor
        this.mcpMonitor = new MCPServerMonitor({
            checkInterval: 60000 // Check MCP health every minute
        });
        
        this.setupMCPHandlers();
    }

    setupMCPHandlers() {
        this.mcpMonitor.on('disconnected', async () => {
            await this.log('⚠️ MCP server disconnected! Attempting to reconnect...', 'WARN');
            const reconnected = await this.mcpMonitor.reconnect();
            if (!reconnected) {
                await this.log('❌ Failed to reconnect MCP server', 'ERROR');
                await this.createMCPIssue('MCP Server Connection Lost');
            }
        });

        this.mcpMonitor.on('reconnected', async () => {
            await this.log('✅ MCP server reconnected successfully', 'INFO');
        });

        this.mcpMonitor.on('max-reconnects-reached', async () => {
            await this.log('❌ Max MCP reconnection attempts reached', 'ERROR');
        });

        this.mcpMonitor.on('error', async (error) => {
            await this.log(`MCP Error: ${error.message}`, 'ERROR');
        });
    }

    async createMCPIssue(title) {
        try {
            const metrics = this.mcpMonitor.getMetrics();
            const body = `## MCP Server Issue Detected

The MCP server (ruv-swarm) has encountered a critical issue and requires attention.

### Details
- **Last Disconnect:** ${metrics.lastDisconnect || 'N/A'}
- **Total Disconnects:** ${metrics.totalDisconnects}
- **Reconnection Attempts:** ${this.mcpMonitor.reconnectAttempts}
- **Server Uptime:** ${metrics.uptime} seconds

### Action Required
Please check the MCP server logs and restart if necessary.

\`\`\`bash
# Check MCP status
claude mcp list

# Restart MCP server
claude mcp restart ruv-swarm
\`\`\`

---
*This issue was automatically created by the Enhanced Monitor V3*`;

            await this.octokit.issues.create({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                title: `[MCP Alert] ${title}`,
                body: body,
                labels: ['mcp-issue', 'automation', 'high-priority']
            });

            await this.log('Created GitHub issue for MCP failure', 'INFO');
        } catch (error) {
            await this.log(`Failed to create MCP issue: ${error.message}`, 'ERROR');
        }
    }

    async initialize() {
        // Ensure log directory exists
        await fs.mkdir(path.dirname(this.logFile), { recursive: true });
        
        // Initialize processed comments file if it doesn't exist
        try {
            await fs.access(this.processedCommentsFile);
        } catch {
            await fs.writeFile(this.processedCommentsFile, '[]');
            await this.log('Created new processed comments file');
        }
        
        // Load processed comments from file
        await this.loadProcessedComments();
        
        await this.automation.initialize();
        await this.log('Monitor V3 initialized with file organization and MCP monitoring');
    }

    async loadProcessedComments() {
        try {
            const data = await fs.readFile(this.processedCommentsFile, 'utf8');
            const comments = JSON.parse(data);
            this.processedComments = new Set(comments);
            await this.log(`Loaded ${this.processedComments.size} processed comments from cache`);
        } catch (error) {
            // File doesn't exist, start fresh
            this.processedComments = new Set();
        }
    }

    async saveProcessedComments() {
        try {
            const comments = Array.from(this.processedComments);
            // Keep only the last 1000 comments to prevent unbounded growth
            const recentComments = comments.slice(-1000);
            await fs.writeFile(this.processedCommentsFile, JSON.stringify(recentComments, null, 2));
        } catch (error) {
            await this.log(`Failed to save processed comments: ${error.message}`, 'WARN');
        }
    }

    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}\n`;
        
        console.log(logEntry.trim());
        
        try {
            await fs.appendFile(this.logFile, logEntry);
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
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
            const date = new Date(content.trim());
            // Check if date is valid
            if (isNaN(date.getTime())) {
                await this.log(`Invalid date in last check file, using default`, 'WARN');
                return new Date(Date.now() - 24 * 60 * 60 * 1000);
            }
            return date;
        } catch (error) {
            // File doesn't exist, return 24 hours ago
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
                if (issue.pull_request) return false;
                if (new Date(issue.created_at) <= lastCheck) return false;
                
                const labels = issue.labels.map(l => l.name);
                if (this.config.filtering.ignoreLabels.some(l => labels.includes(l))) {
                    return false;
                }
                
                if (labels.includes(this.config.filtering.completionLabel)) {
                    return false;
                }
                
                if (this.config.filtering.requireLabels.length > 0) {
                    if (!this.config.filtering.requireLabels.some(l => labels.includes(l))) {
                        return false;
                    }
                }
                
                return true;
            });

            if (newIssues.length > 0) {
                await this.log(`Found ${newIssues.length} new issues to process`);
                
                for (const issue of newIssues) {
                    await this.log(`Processing issue #${issue.number}: ${issue.title}`);
                    
                    try {
                        await this.automation.processIssue(issue);
                        await this.log(`✅ Successfully processed issue #${issue.number}`);
                    } catch (error) {
                        await this.log(`❌ Failed to process issue #${issue.number}: ${error.message}`, 'ERROR');
                    }
                }
            }

        } catch (error) {
            await this.log(`Error checking for new issues: ${error.message}`, 'ERROR');
            if (error.message?.includes('secondary rate limit')) {
                throw error; // Re-throw to handle in performChecks
            }
        }
    }

    async checkForNewComments() {
        // Get the actual last check time but add a buffer to catch edge cases
        const lastCheck = await this.getLastCheckTime();
        // Add 30 second buffer to ensure we don't miss any comments
        const checkTime = new Date(lastCheck.getTime() - 30000);
        const botUsername = await this.getBotUsername();
        
        await this.log(`Checking for new comments since ${checkTime.toISOString()} (with 30s buffer)`);
        await this.log(`Processed comments cache has ${this.processedComments.size} entries`);

        try {
            const { data: comments } = await this.octokit.issues.listCommentsForRepo({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                sort: 'created',
                direction: 'desc',
                since: checkTime.toISOString(),
                per_page: 100
            });

            await this.log(`Found ${comments.length} comments to check`);
            
            for (const comment of comments) {
                // Skip if already processed
                if (this.processedComments.has(comment.id)) {
                    continue;
                }
                
                // Skip bot's own comments
                if (comment.user.login === botUsername) {
                    this.processedComments.add(comment.id);
                    continue;
                }
                
                const issueNumber = parseInt(comment.issue_url.split('/').pop());
                
                await this.log(`Checking comment ${comment.id} by @${comment.user.login} on issue #${issueNumber}`);
                
                // Get issue details first to check its status
                const { data: issue } = await this.octokit.issues.get({
                    owner: this.config.github.owner,
                    repo: this.config.github.repo,
                    issue_number: issueNumber
                });
                
                const labels = issue.labels.map(l => l.name);
                const isSwarmProcessed = labels.includes('swarm-processed') || labels.includes('completed');
                const isClaude = this.isMentioningClaude(comment.body);
                const isDirective = this.isDirective(comment.body);
                const isHumanComment = comment.user.type === 'User' && !comment.user.login.includes('[bot]');
                
                // Log detection results
                await this.log(`  - Human: ${isHumanComment}, Processed: ${isSwarmProcessed}, @claude: ${isClaude}, Directive: ${isDirective}`);
                
                // Process comment if:
                // 1. It's a @claude mention (always process)
                // 2. It's a directive on any issue
                // 3. It's ANY human comment on a swarm-processed issue
                if (isHumanComment && (isClaude || isDirective || isSwarmProcessed)) {
                    await this.log(`✅ Processing comment ${comment.id} on issue #${issueNumber}`);
                    
                    try {
                        if (isSwarmProcessed && !isDirective) {
                            // Handle as a follow-up on completed issue
                            await this.handleHumanFollowUp(issue, comment);
                        } else {
                            // Handle as a directive on active issue
                            await this.handleDirective(comment);
                        }
                    } catch (error) {
                        await this.log(`Error processing comment ${comment.id}: ${error.message}`, 'ERROR');
                    }
                }
                
                // Always mark as processed to avoid reprocessing
                this.processedComments.add(comment.id);
            }
            
            // Save processed comments after each check
            await this.saveProcessedComments();

        } catch (error) {
            await this.log(`Error checking for new comments: ${error.message}`, 'ERROR');
            if (error.message?.includes('secondary rate limit')) {
                throw error; // Re-throw to handle in performChecks
            }
        }
    }

    async checkForReprocessRequests() {
        await this.log('Checking for reprocess requests...');
        
        try {
            const { data: issues } = await this.octokit.issues.listForRepo({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                state: 'open',
                labels: 'reprocess',
                per_page: 100
            });

            for (const issue of issues) {
                await this.log(`Reprocessing issue #${issue.number}`);
                
                await this.octokit.issues.removeLabel({
                    owner: this.config.github.owner,
                    repo: this.config.github.repo,
                    issue_number: issue.number,
                    name: 'reprocess'
                }).catch(() => {});
                
                await this.automation.processIssue(issue);
            }

        } catch (error) {
            await this.log(`Error checking reprocess requests: ${error.message}`, 'ERROR');
            if (error.message?.includes('secondary rate limit')) {
                throw error; // Re-throw to handle in performChecks
            }
        }
    }

    isDirective(text) {
        const patterns = [
            /^\/\w+/, // Commands starting with /
            /@automation/i,
            /please\s+(re)?process/i,
            /run\s+automation/i
        ];
        
        return patterns.some(pattern => pattern.test(text));
    }

    isMentioningClaude(text) {
        // Check for @claude mentions (case-insensitive)
        // Use word boundary to avoid matching email addresses
        return /\B@claude\b/i.test(text);
    }

    async handleDirective(comment) {
        const issueNumber = comment.issue_url.split('/').pop();
        await this.log(`Handling directive on issue #${issueNumber}`);
        
        // Check if this is a @claude mention
        const isClaude = this.isMentioningClaude(comment.body);
        
        if (isClaude) {
            await this.postComment(issueNumber, 
                `🤖 **Claude Response**\n\nHello @${comment.user.login}! I've received your message and I'm analyzing the issue...`
            );
        } else {
            await this.postComment(issueNumber, 
                `Processing directive from @${comment.user.login}...`
            );
        }
        
        const { data: issue } = await this.octokit.issues.get({
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            issue_number: issueNumber
        });
        
        // For @claude mentions on completed issues, create a special context
        const labels = issue.labels.map(l => l.name);
        const isCompleted = labels.includes('swarm-processed') || labels.includes('completed');
        
        if (isClaude && isCompleted) {
            // Process as a follow-up request
            await this.handleClaudeFollowUp(issue, comment);
        } else {
            // Normal processing
            await this.automation.processIssue(issue);
        }
    }

    async handleHumanFollowUp(issue, comment) {
        const isClaude = this.isMentioningClaude(comment.body);
        await this.log(`Processing human follow-up on completed issue #${issue.number} (@claude: ${isClaude})`);
        
        try {
            // Get all comments for context
            const { data: allComments } = await this.octokit.issues.listComments({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                issue_number: issue.number,
                per_page: 100
            });
            
            // Create appropriate prompt based on whether it's a @claude mention
            const promptIntro = isClaude 
                ? `You have been mentioned by @${comment.user.login} on a completed GitHub issue.`
                : `A human has commented on a completed GitHub issue that you previously worked on.`;
            
            const claudePrompt = `${promptIntro}

IMPORTANT: This is a follow-up comment on an already completed issue. The implementation has been done.

Issue #${issue.number}: ${issue.title}
Status: COMPLETED (with label: swarm-processed)

Original Issue Description:
${issue.body || 'No description'}

Recent Human Comment:
${comment.body}

Previous Implementation Context:
${allComments.slice(0, -1).map(c => `[${c.user.login}]: ${c.body.substring(0, 200)}...`).join('\n')}

INSTRUCTIONS:
1. Analyze the human's follow-up comment
2. If they're asking for modifications, implement them
3. If they're asking questions, provide clear answers
4. If they're just providing feedback, acknowledge it appropriately
5. Reference the existing implementation when relevant
6. Be helpful and responsive to their specific needs

${isClaude ? 'This is a direct @claude mention, so provide a more detailed and personalized response.' : 'This is a general comment, so be helpful but concise.'}

Remember: The issue was already processed, so this is about refinements, answers, or acknowledgments, not starting from scratch.`;

            // Store the prompt temporarily
            const promptPath = path.join(
                this.automation.fileOrg.getTempPath(issue.number, 'human-followup', 'txt')
            );
            await fs.writeFile(promptPath, claudePrompt);
            
            // Execute Claude with the follow-up context
            const command = `claude --print --dangerously-skip-permissions < "${promptPath}"`;
            const result = execSync(command, {
                encoding: 'utf8',
                maxBuffer: 10 * 1024 * 1024,
                env: process.env
            });
            
            // Post Claude's response with appropriate header
            const responseHeader = isClaude 
                ? `🤖 **Claude's Response to @${comment.user.login}**`
                : `🤖 **Follow-up Response**`;
                
            const responseFooter = isClaude
                ? '*This response was generated based on your @claude mention.*'
                : '*This response was generated based on your comment on this completed issue.*';
            
            await this.postComment(issue.number, `${responseHeader}

${result}

---
${responseFooter}`);
            
            // Clean up temp file
            await fs.unlink(promptPath).catch(() => {});
            
        } catch (error) {
            await this.log(`Error handling human follow-up: ${error.message}`, 'ERROR');
            const errorHeader = isClaude ? '❌ **Error Processing @claude Request**' : '❌ **Error Processing Follow-up Comment**';
            await this.postComment(issue.number, `${errorHeader}

I encountered an error while processing your ${isClaude ? 'request' : 'comment'}: ${error.message}

Please try again or contact support if the issue persists.`);
        }
    }

    async handleClaudeFollowUp(issue, comment) {
        // This method is now deprecated in favor of handleHumanFollowUp
        // which handles both @claude mentions and general comments
        return this.handleHumanFollowUp(issue, comment);
    }

    async postComment(issueNumber, body) {
        await this.octokit.issues.createComment({
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            issue_number: issueNumber,
            body: body
        });
    }

    async monitor() {
        await this.log('🚀 Starting Enhanced GitHub Monitor V3...');
        await this.log(`Repository: ${this.config.github.owner}/${this.config.github.repo}`);
        
        // Use pollInterval from config, default to 1 minute for faster response
        const checkInterval = this.config.github?.pollInterval || 60000;
        await this.log(`Check interval: ${checkInterval / 1000} seconds`);
        await this.log('File organization: ENABLED');
        await this.log('MCP monitoring: ENABLED');
        await this.log('Comment detection: ENHANCED with buffer and broader detection');
        
        // Start MCP health checks
        setInterval(async () => {
            await this.mcpMonitor.checkHealth();
        }, this.mcpMonitor.config.checkInterval);
        
        // Initial checks
        await this.performChecks();
        
        // Set up periodic checks with overlap protection
        let checking = false;
        setInterval(async () => {
            if (!checking) {
                checking = true;
                try {
                    await this.performChecks();
                } finally {
                    checking = false;
                }
            }
        }, checkInterval);
        
        // Log MCP metrics every hour
        setInterval(async () => {
            const metrics = this.mcpMonitor.getMetrics();
            await this.log(`MCP Metrics - Uptime: ${metrics.uptime}s, Disconnects: ${metrics.totalDisconnects}, Health: ${metrics.isHealthy}`);
        }, 60 * 60 * 1000);
        
        await this.log('Monitor is running. Press Ctrl+C to stop.');
    }
    
    async performChecks() {
        try {
            // Record the check start time BEFORE any operations
            const checkStartTime = new Date();
            
            // Check MCP health first
            const mcpHealthy = await this.mcpMonitor.checkHealth();
            if (!mcpHealthy) {
                await this.log('⚠️ MCP server is unhealthy, some features may be limited', 'WARN');
            }
            
            // Add delays between API calls to avoid rate limiting
            await this.checkForNewIssues();
            await this.delay(2000); // Reduced to 2 second delay for faster response
            
            await this.checkForNewComments();
            await this.delay(2000); // Reduced to 2 second delay
            
            await this.checkForReprocessRequests();
            
            // Update last check time to the start of this check cycle
            // This ensures we don't miss any comments added during the check
            await fs.writeFile(this.lastCheckFile, checkStartTime.toISOString());
            
        } catch (error) {
            if (error.message?.includes('secondary rate limit')) {
                await this.log('Rate limit hit, waiting 5 minutes before retry...', 'WARN');
                await this.delay(300000); // Wait 5 minutes
            } else {
                await this.log(`Error during checks: ${error.message}`, 'ERROR');
            }
        }
    }
    
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Load configuration
async function loadConfig() {
    const configPath = path.join(__dirname, 'config-enhanced.json');
    try {
        const configData = await fs.readFile(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('Failed to load config:', error.message);
        process.exit(1);
    }
}

// Main execution
if (require.main === module) {
    loadConfig().then(async config => {
        const monitor = new EnhancedGitHubMonitorV3(config);
        await monitor.initialize();
        await monitor.monitor();
    }).catch(console.error);
}

module.exports = EnhancedGitHubMonitorV3;
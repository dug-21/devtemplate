#!/usr/bin/env node

/**
 * Enhanced GitHub Monitor V3 with MCP Integration
 * Combines GitHub monitoring with MCP server health checks
 */

const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const EventEmitter = require('events');
const EnhancedGitHubAutomationV3 = require('./automation-enhanced-v3');

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
        this.automation = new EnhancedGitHubAutomationV3(config);
        this.lastCheckFile = path.join(__dirname, '.last-check-enhanced-v3');
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
        
        await this.automation.initialize();
        await this.log('Monitor V3 initialized with file organization and MCP monitoring');
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
        const lastCheck = await this.getLastCheckTime();
        const botUsername = await this.getBotUsername();
        
        await this.log(`Checking for new comments since ${lastCheck.toISOString()}`);

        try {
            const { data: comments } = await this.octokit.issues.listCommentsForRepo({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                sort: 'created',
                direction: 'desc',
                since: lastCheck.toISOString(),
                per_page: 100
            });

            for (const comment of comments) {
                if (this.processedComments.has(comment.id)) continue;
                if (comment.user.login === botUsername) continue;
                
                const { data: issueComments } = await this.octokit.issues.listComments({
                    owner: this.config.github.owner,
                    repo: this.config.github.repo,
                    issue_number: comment.issue_url.split('/').pop()
                });
                
                const hasBotComment = issueComments.some(c => c.user.login === botUsername);
                
                if (hasBotComment && this.isDirective(comment.body)) {
                    await this.handleDirective(comment);
                    this.processedComments.add(comment.id);
                }
            }

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

    async handleDirective(comment) {
        const issueNumber = comment.issue_url.split('/').pop();
        await this.log(`Handling directive on issue #${issueNumber}`);
        
        await this.postComment(issueNumber, 
            `Processing directive from @${comment.user.login}...`
        );
        
        const { data: issue } = await this.octokit.issues.get({
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            issue_number: issueNumber
        });
        
        await this.automation.processIssue(issue);
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
        
        // Use pollInterval from config, default to 5 minutes if not set
        const checkInterval = this.config.github?.pollInterval || 300000;
        await this.log(`Check interval: ${checkInterval / 1000} seconds`);
        await this.log('File organization: ENABLED');
        await this.log('MCP monitoring: ENABLED');
        
        // Start MCP health checks
        setInterval(async () => {
            await this.mcpMonitor.checkHealth();
        }, this.mcpMonitor.config.checkInterval);
        
        // Initial checks
        await this.performChecks();
        
        // Set up periodic checks
        setInterval(async () => {
            await this.performChecks();
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
            // Check MCP health first
            const mcpHealthy = await this.mcpMonitor.checkHealth();
            if (!mcpHealthy) {
                await this.log('⚠️ MCP server is unhealthy, some features may be limited', 'WARN');
            }
            
            // Add delays between API calls to avoid rate limiting
            await this.checkForNewIssues();
            await this.delay(30000); // 30 second delay
            
            await this.checkForNewComments();
            await this.delay(30000); // 30 second delay
            
            await this.checkForReprocessRequests();
            await this.delay(30000); // 30 second delay
            
            await this.updateLastCheckTime();
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
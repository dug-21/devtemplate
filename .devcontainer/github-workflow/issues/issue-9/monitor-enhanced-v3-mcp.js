#!/usr/bin/env node

/**
 * Enhanced GitHub Monitor V3 with MCP Server Monitoring
 * Extends the base monitor with ruv-swarm MCP server health monitoring
 */

const EnhancedGitHubMonitorV3 = require('../../monitor-enhanced-v3');
const MCPServerMonitor = require('./mcp-server-monitor');
const path = require('path');
const fs = require('fs').promises;

class EnhancedGitHubMonitorV3WithMCP extends EnhancedGitHubMonitorV3 {
    constructor(config) {
        super(config);
        
        // Initialize MCP monitor with custom config
        this.mcpMonitor = new MCPServerMonitor({
            checkInterval: 30000, // Check every 30 seconds
            reconnectDelay: 5000,
            maxReconnectAttempts: 5,
            healthCheckTimeout: 10000,
            logFile: path.join(__dirname, 'logs', 'mcp-monitor.log')
        });
        
        this.mcpHealthStatus = {
            isHealthy: false,
            lastCheck: null,
            disconnectCount: 0,
            lastDisconnect: null
        };
        
        this.setupMCPEventHandlers();
    }

    async initialize() {
        await super.initialize();
        
        // Initialize MCP monitoring
        await this.log('Initializing MCP server monitoring...');
        await this.mcpMonitor.initialize();
        
        await this.log('Enhanced Monitor V3 with MCP monitoring initialized');
    }

    setupMCPEventHandlers() {
        // Handle MCP connection events
        this.mcpMonitor.on('connected', async () => {
            this.mcpHealthStatus.isHealthy = true;
            this.mcpHealthStatus.lastCheck = Date.now();
            await this.log('✅ MCP server connected and healthy');
            
            // Notify about successful connection
            await this.notifyMCPStatus('connected');
        });

        this.mcpMonitor.on('disconnected', async () => {
            this.mcpHealthStatus.isHealthy = false;
            this.mcpHealthStatus.disconnectCount++;
            this.mcpHealthStatus.lastDisconnect = Date.now();
            await this.log('🔴 MCP server disconnected!', 'ERROR');
            
            // Notify about disconnection
            await this.notifyMCPStatus('disconnected');
        });

        this.mcpMonitor.on('reconnected', async () => {
            this.mcpHealthStatus.isHealthy = true;
            this.mcpHealthStatus.lastCheck = Date.now();
            await this.log('🟢 MCP server successfully reconnected');
            
            // Notify about reconnection
            await this.notifyMCPStatus('reconnected');
        });

        this.mcpMonitor.on('max-reconnects-reached', async () => {
            await this.log('❌ MCP server max reconnection attempts reached', 'ERROR');
            
            // Create critical alert
            await this.createMCPIssue();
        });
    }

    async notifyMCPStatus(status) {
        // Create status file for tracking
        const statusFile = path.join(__dirname, 'logs', 'mcp-status.json');
        const statusData = {
            status,
            timestamp: new Date().toISOString(),
            metrics: await this.mcpMonitor.getMetrics(),
            healthStatus: this.mcpHealthStatus
        };
        
        try {
            await fs.mkdir(path.dirname(statusFile), { recursive: true });
            await fs.writeFile(statusFile, JSON.stringify(statusData, null, 2));
        } catch (error) {
            await this.log(`Failed to write MCP status: ${error.message}`, 'ERROR');
        }
    }

    async createMCPIssue() {
        try {
            // Check if we already created an issue recently
            const recentIssueFile = path.join(__dirname, '.mcp-issue-created');
            try {
                const content = await fs.readFile(recentIssueFile, 'utf8');
                const lastCreated = new Date(content);
                if (Date.now() - lastCreated.getTime() < 3600000) { // 1 hour
                    await this.log('MCP issue already created recently, skipping');
                    return;
                }
            } catch (error) {
                // File doesn't exist, continue
            }

            const metrics = await this.mcpMonitor.getMetrics();
            
            const issueBody = `## ruv-swarm MCP Server Critical Failure

The ruv-swarm MCP server has failed to reconnect after multiple attempts and requires manual intervention.

### Failure Details
- **Total Disconnections:** ${metrics.totalDisconnects}
- **Last Disconnect:** ${metrics.lastDisconnect ? new Date(metrics.lastDisconnect).toISOString() : 'Unknown'}
- **Reconnection Attempts:** ${this.mcpMonitor.config.maxReconnectAttempts}
- **Uptime Before Failure:** ${metrics.uptime}

### Recommended Actions
1. Check the MCP server logs in \`issues/issue-9/logs/\`
2. Manually restart the ruv-swarm MCP server
3. Review the Claude Code settings for any configuration issues
4. Check system resources (memory, CPU)

### Logs
Check the following log files for more details:
- \`issues/issue-9/logs/mcp-monitor.log\`
- \`issues/issue-9/logs/mcp-status.json\`

---
*This issue was automatically created by the MCP monitoring system*`;

            const { data: issue } = await this.octokit.issues.create({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                title: '[CRITICAL] ruv-swarm MCP Server Connection Failed',
                body: issueBody,
                labels: ['bug', 'critical', 'mcp-monitor', 'automation']
            });

            await this.log(`Created critical issue #${issue.number} for MCP failure`);
            
            // Mark that we created an issue
            await fs.writeFile(recentIssueFile, new Date().toISOString());
            
        } catch (error) {
            await this.log(`Failed to create MCP issue: ${error.message}`, 'ERROR');
        }
    }

    async checkMCPHealth() {
        const metrics = await this.mcpMonitor.getMetrics();
        const status = this.mcpHealthStatus.isHealthy ? '✅ Healthy' : '🔴 Unhealthy';
        
        await this.log(`MCP Status: ${status} | Disconnects: ${metrics.totalDisconnects} | Uptime: ${metrics.uptime}`);
        
        // If unhealthy for too long, escalate
        if (!this.mcpHealthStatus.isHealthy && this.mcpHealthStatus.lastDisconnect) {
            const downtime = Date.now() - this.mcpHealthStatus.lastDisconnect;
            if (downtime > 600000) { // 10 minutes
                await this.log('MCP server has been down for over 10 minutes!', 'ERROR');
            }
        }
    }

    async monitor() {
        await this.log('🚀 Starting Enhanced GitHub Monitor V3 with MCP Monitoring...');
        await this.log(`Repository: ${this.config.github.owner}/${this.config.github.repo}`);
        await this.log(`Check interval: ${this.config.checkInterval / 1000} seconds`);
        await this.log('File organization: ENABLED');
        await this.log('MCP monitoring: ENABLED');
        
        // Initial check
        await this.checkForNewIssues();
        await this.checkForNewComments();
        await this.checkForReprocessRequests();
        await this.checkMCPHealth();
        await this.updateLastCheckTime();
        
        // Set up periodic checks
        setInterval(async () => {
            await this.checkForNewIssues();
            await this.checkForNewComments();
            await this.checkForReprocessRequests();
            await this.checkMCPHealth();
            await this.updateLastCheckTime();
        }, this.config.checkInterval);
        
        // Run cleanup every hour
        setInterval(async () => {
            await this.runCleanup();
        }, 60 * 60 * 1000);
        
        // Check MCP health more frequently
        setInterval(async () => {
            await this.checkMCPHealth();
        }, 60000); // Every minute
        
        await this.log('Monitor with MCP support is running. Press Ctrl+C to stop.');
    }

    async stopMonitoring() {
        await this.log('Stopping monitors...');
        await this.mcpMonitor.stopMonitoring();
        process.exit(0);
    }
}

// Main execution
if (require.main === module) {
    const loadConfig = async () => {
        const configPath = path.join(__dirname, '..', '..', 'config-enhanced.json');
        try {
            const configData = await fs.readFile(configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            console.error('Failed to load config:', error.message);
            process.exit(1);
        }
    };

    loadConfig().then(async config => {
        const monitor = new EnhancedGitHubMonitorV3WithMCP(config);
        
        // Handle shutdown gracefully
        process.on('SIGINT', async () => {
            console.log('\nShutting down...');
            await monitor.stopMonitoring();
        });
        
        await monitor.initialize();
        await monitor.monitor();
    }).catch(console.error);
}

module.exports = EnhancedGitHubMonitorV3WithMCP;
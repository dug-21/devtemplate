#!/usr/bin/env node

/**
 * MCP Server Monitor for ruv-swarm
 * Monitors the health of MCP server connections and automatically reconnects when needed
 */

const { spawn, exec } = require('child_process');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class MCPServerMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            serverName: 'ruv-swarm',
            checkInterval: 30000, // Check every 30 seconds
            reconnectDelay: 5000, // Wait 5 seconds before reconnecting
            maxReconnectAttempts: 5,
            healthCheckTimeout: 10000, // 10 second timeout for health checks
            logFile: path.join(__dirname, 'logs', 'mcp-monitor.log'),
            ...config
        };
        
        this.mcpProcess = null;
        this.isHealthy = false;
        this.reconnectAttempts = 0;
        this.lastHealthCheck = null;
        this.monitorInterval = null;
        this.metrics = {
            totalDisconnects: 0,
            totalReconnects: 0,
            lastDisconnect: null,
            lastReconnect: null,
            uptime: 0,
            startTime: Date.now()
        };
    }

    async initialize() {
        // Ensure log directory exists
        const logDir = path.dirname(this.config.logFile);
        await fs.mkdir(logDir, { recursive: true });
        
        await this.log('MCP Server Monitor initializing...');
        await this.startMonitoring();
    }

    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] [MCP-Monitor] ${message}\n`;
        
        console.log(logEntry.trim());
        
        try {
            await fs.appendFile(this.config.logFile, logEntry);
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    async checkMCPServerHealth() {
        try {
            // Method 1: Check if the MCP server process is responsive
            const healthCheckStart = Date.now();
            
            // Try to get MCP server status using ruv-swarm CLI
            const statusCheck = await this.executeCommand('npx ruv-swarm mcp status', this.config.healthCheckTimeout);
            
            if (statusCheck.success) {
                const responseTime = Date.now() - healthCheckStart;
                this.lastHealthCheck = Date.now();
                
                // Check if response time is reasonable
                if (responseTime < this.config.healthCheckTimeout * 0.8) {
                    await this.log(`Health check passed (${responseTime}ms response time)`);
                    return true;
                } else {
                    await this.log(`Health check slow response (${responseTime}ms)`, 'WARN');
                    return false;
                }
            }
            
            // Method 2: Check Claude Code's MCP server connection
            const connectionCheck = await this.checkClaudeConnection();
            if (!connectionCheck) {
                await this.log('Claude Code connection check failed', 'WARN');
                return false;
            }
            
            return false;
            
        } catch (error) {
            await this.log(`Health check failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async checkClaudeConnection() {
        try {
            // Check if Claude Code can communicate with the MCP server
            // This uses a simple test command through the MCP protocol
            const testCommand = 'npx ruv-swarm hook test-connection --timeout 5000';
            const result = await this.executeCommand(testCommand, 5000);
            
            return result.success;
        } catch (error) {
            return false;
        }
    }

    async executeCommand(command, timeout = 10000) {
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                resolve({ success: false, error: 'Command timeout' });
            }, timeout);

            exec(command, { timeout }, (error, stdout, stderr) => {
                clearTimeout(timeoutId);
                
                if (error) {
                    resolve({ success: false, error: error.message, stderr });
                } else {
                    resolve({ success: true, stdout, stderr });
                }
            });
        });
    }

    async startMCPServer() {
        try {
            await this.log('Starting ruv-swarm MCP server...');
            
            // Kill any existing ruv-swarm processes
            await this.executeCommand('pkill -f "ruv-swarm mcp"', 2000);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Start the MCP server using the same command as in Claude settings
            this.mcpProcess = spawn('npx', ['ruv-swarm', 'mcp', 'start'], {
                env: {
                    ...process.env,
                    RUV_SWARM_HOOKS_ENABLED: 'false',
                    RUV_SWARM_TELEMETRY_ENABLED: 'true',
                    RUV_SWARM_REMOTE_READY: 'true',
                    RUV_SWARM_AUTO_RECONNECT: 'true'
                },
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.mcpProcess.stdout.on('data', (data) => {
                this.log(`MCP stdout: ${data.toString().trim()}`, 'DEBUG');
            });

            this.mcpProcess.stderr.on('data', (data) => {
                this.log(`MCP stderr: ${data.toString().trim()}`, 'DEBUG');
            });

            this.mcpProcess.on('error', (error) => {
                this.log(`MCP process error: ${error.message}`, 'ERROR');
                this.isHealthy = false;
            });

            this.mcpProcess.on('exit', (code, signal) => {
                this.log(`MCP process exited with code ${code}, signal ${signal}`, 'WARN');
                this.isHealthy = false;
                this.mcpProcess = null;
            });

            // Wait for server to initialize
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Verify it's running
            const isHealthy = await this.checkMCPServerHealth();
            if (isHealthy) {
                this.isHealthy = true;
                this.reconnectAttempts = 0;
                this.metrics.lastReconnect = Date.now();
                this.metrics.totalReconnects++;
                await this.log('✅ MCP server started successfully');
                this.emit('connected');
                return true;
            } else {
                await this.log('❌ MCP server failed to start properly', 'ERROR');
                return false;
            }
            
        } catch (error) {
            await this.log(`Failed to start MCP server: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async reconnectMCPServer() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            await this.log(`Max reconnection attempts (${this.config.maxReconnectAttempts}) reached`, 'ERROR');
            this.emit('max-reconnects-reached');
            return false;
        }

        this.reconnectAttempts++;
        await this.log(`Attempting reconnection (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);
        
        // Kill existing process if any
        if (this.mcpProcess) {
            try {
                this.mcpProcess.kill('SIGTERM');
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.mcpProcess.kill('SIGKILL');
            } catch (error) {
                // Process might already be dead
            }
            this.mcpProcess = null;
        }

        // Wait before reconnecting
        await new Promise(resolve => setTimeout(resolve, this.config.reconnectDelay));
        
        // Try to restart
        const success = await this.startMCPServer();
        
        if (!success && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            // Exponential backoff
            this.config.reconnectDelay = Math.min(this.config.reconnectDelay * 1.5, 30000);
            return this.reconnectMCPServer();
        }
        
        return success;
    }

    async performHealthCheck() {
        const wasHealthy = this.isHealthy;
        this.isHealthy = await this.checkMCPServerHealth();
        
        if (wasHealthy && !this.isHealthy) {
            // Connection lost
            this.metrics.totalDisconnects++;
            this.metrics.lastDisconnect = Date.now();
            await this.log('🔴 MCP server connection lost!', 'ERROR');
            this.emit('disconnected');
            
            // Attempt reconnection
            await this.reconnectMCPServer();
            
        } else if (!wasHealthy && this.isHealthy) {
            // Connection restored
            await this.log('🟢 MCP server connection restored');
            this.emit('reconnected');
            
        } else if (this.isHealthy) {
            // Still healthy
            const uptime = Math.floor((Date.now() - this.metrics.startTime) / 1000);
            if (uptime % 300 === 0) { // Log every 5 minutes
                await this.log(`MCP server healthy (uptime: ${this.formatUptime(uptime)})`);
            }
        }
    }

    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}h ${minutes}m ${secs}s`;
    }

    async startMonitoring() {
        await this.log('Starting MCP server monitoring...');
        
        // Initial health check and start if needed
        const isHealthy = await this.checkMCPServerHealth();
        if (!isHealthy) {
            await this.log('MCP server not running, starting it...');
            await this.startMCPServer();
        } else {
            this.isHealthy = true;
            await this.log('MCP server is already running and healthy');
        }
        
        // Set up periodic health checks
        this.monitorInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, this.config.checkInterval);
        
        await this.log(`Monitoring started (checking every ${this.config.checkInterval / 1000}s)`);
    }

    async stopMonitoring() {
        await this.log('Stopping MCP server monitoring...');
        
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        
        if (this.mcpProcess) {
            this.mcpProcess.kill('SIGTERM');
            this.mcpProcess = null;
        }
        
        await this.log('Monitoring stopped');
    }

    async getMetrics() {
        const uptime = Date.now() - this.metrics.startTime;
        return {
            ...this.metrics,
            uptime: this.formatUptime(Math.floor(uptime / 1000)),
            currentStatus: this.isHealthy ? 'healthy' : 'unhealthy',
            lastHealthCheck: this.lastHealthCheck ? new Date(this.lastHealthCheck).toISOString() : 'never'
        };
    }
}

// Export for use in other modules
module.exports = MCPServerMonitor;

// Run as standalone if executed directly
if (require.main === module) {
    const monitor = new MCPServerMonitor({
        checkInterval: 30000, // Check every 30 seconds
        reconnectDelay: 5000,
        maxReconnectAttempts: 5
    });

    // Set up event handlers
    monitor.on('connected', () => {
        console.log('✅ MCP server connected');
    });

    monitor.on('disconnected', () => {
        console.log('🔴 MCP server disconnected');
    });

    monitor.on('reconnected', () => {
        console.log('🟢 MCP server reconnected');
    });

    monitor.on('max-reconnects-reached', () => {
        console.error('❌ Maximum reconnection attempts reached. Manual intervention required.');
    });

    // Handle shutdown gracefully
    process.on('SIGINT', async () => {
        console.log('\nShutting down MCP monitor...');
        await monitor.stopMonitoring();
        process.exit(0);
    });

    // Initialize and start monitoring
    monitor.initialize().catch(console.error);
}
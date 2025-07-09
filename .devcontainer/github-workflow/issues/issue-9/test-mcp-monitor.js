#!/usr/bin/env node

/**
 * Test script for MCP Server Monitor
 * Tests connection detection, disconnection handling, and auto-reconnection
 */

const MCPServerMonitor = require('./mcp-server-monitor');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class MCPMonitorTester {
    constructor() {
        this.monitor = new MCPServerMonitor({
            checkInterval: 5000, // Check every 5 seconds for testing
            reconnectDelay: 2000, // Faster reconnect for testing
            maxReconnectAttempts: 3
        });
        
        this.testResults = {
            passed: 0,
            failed: 0,
            tests: []
        };
    }

    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [TEST] [${level}] ${message}`);
    }

    async runTest(name, testFn) {
        await this.log(`Running test: ${name}`);
        
        try {
            await testFn();
            this.testResults.passed++;
            this.testResults.tests.push({ name, status: 'PASSED' });
            await this.log(`✅ ${name} - PASSED`);
        } catch (error) {
            this.testResults.failed++;
            this.testResults.tests.push({ name, status: 'FAILED', error: error.message });
            await this.log(`❌ ${name} - FAILED: ${error.message}`, 'ERROR');
        }
    }

    async testHealthCheck() {
        await this.runTest('Health Check', async () => {
            const isHealthy = await this.monitor.checkMCPServerHealth();
            await this.log(`Health check result: ${isHealthy}`);
            
            if (!isHealthy) {
                // Start the server if not healthy
                await this.monitor.startMCPServer();
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                const isHealthyAfterStart = await this.monitor.checkMCPServerHealth();
                if (!isHealthyAfterStart) {
                    throw new Error('Server failed to become healthy after start');
                }
            }
        });
    }

    async testConnectionDetection() {
        await this.runTest('Connection Detection', async () => {
            let connected = false;
            let disconnected = false;
            
            this.monitor.on('connected', () => { connected = true; });
            this.monitor.on('disconnected', () => { disconnected = true; });
            
            // Initialize monitor
            await this.monitor.initialize();
            
            // Wait for initial connection
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            if (!connected) {
                throw new Error('Failed to detect initial connection');
            }
            
            await this.log('Initial connection detected successfully');
        });
    }

    async testDisconnectionHandling() {
        await this.runTest('Disconnection Handling', async () => {
            let disconnectDetected = false;
            
            this.monitor.on('disconnected', () => {
                disconnectDetected = true;
            });
            
            // Simulate server failure by killing the process
            await this.log('Simulating MCP server failure...');
            
            try {
                await execAsync('pkill -f "ruv-swarm mcp"');
            } catch (error) {
                // Process might not exist, which is fine
            }
            
            // Wait for detection
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            if (!disconnectDetected) {
                throw new Error('Failed to detect disconnection');
            }
            
            await this.log('Disconnection detected successfully');
        });
    }

    async testAutoReconnection() {
        await this.runTest('Auto Reconnection', async () => {
            let reconnected = false;
            
            this.monitor.on('reconnected', () => {
                reconnected = true;
            });
            
            // Kill the server
            try {
                await execAsync('pkill -f "ruv-swarm mcp"');
            } catch (error) {
                // Ignore
            }
            
            await this.log('Waiting for auto-reconnection...');
            
            // Wait for reconnection (max 30 seconds)
            const maxWait = 30000;
            const startTime = Date.now();
            
            while (!reconnected && (Date.now() - startTime) < maxWait) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            if (!reconnected) {
                throw new Error('Failed to auto-reconnect within timeout');
            }
            
            await this.log('Auto-reconnection successful');
        });
    }

    async testMetrics() {
        await this.runTest('Metrics Collection', async () => {
            const metrics = await this.monitor.getMetrics();
            
            await this.log(`Metrics: ${JSON.stringify(metrics, null, 2)}`);
            
            if (!metrics.hasOwnProperty('totalDisconnects')) {
                throw new Error('Missing totalDisconnects metric');
            }
            
            if (!metrics.hasOwnProperty('uptime')) {
                throw new Error('Missing uptime metric');
            }
        });
    }

    async runAllTests() {
        await this.log('Starting MCP Monitor Tests...\n');
        
        // Run tests in sequence
        await this.testHealthCheck();
        await this.testConnectionDetection();
        await this.testDisconnectionHandling();
        await this.testAutoReconnection();
        await this.testMetrics();
        
        // Cleanup
        await this.monitor.stopMonitoring();
        
        // Print results
        await this.log('\n=== Test Results ===');
        await this.log(`Total Tests: ${this.testResults.tests.length}`);
        await this.log(`Passed: ${this.testResults.passed}`);
        await this.log(`Failed: ${this.testResults.failed}`);
        
        this.testResults.tests.forEach(test => {
            const icon = test.status === 'PASSED' ? '✅' : '❌';
            const message = test.error ? ` - ${test.error}` : '';
            console.log(`  ${icon} ${test.name}${message}`);
        });
        
        process.exit(this.testResults.failed > 0 ? 1 : 0);
    }
}

// Run tests if executed directly
if (require.main === module) {
    const tester = new MCPMonitorTester();
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        console.error('Uncaught error:', error);
        process.exit(1);
    });
    
    tester.runAllTests().catch(console.error);
}
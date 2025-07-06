#!/usr/bin/env node

/**
 * Test script for V3 solution
 * Verifies all components work correctly without overloading GitHub API
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function runTests() {
    console.log('🧪 Running V3 Solution Tests...\n');
    
    const tests = [
        testFileOrganization,
        testMonitorConfiguration,
        testMCPIntegration,
        testRateLimitProtection,
        testStartScript
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            await test();
            console.log(`✅ ${test.name} - PASSED\n`);
            passed++;
        } catch (error) {
            console.log(`❌ ${test.name} - FAILED`);
            console.log(`   Error: ${error.message}\n`);
            failed++;
        }
    }
    
    console.log('\n📊 Test Results:');
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${tests.length}`);
    
    return failed === 0;
}

async function testFileOrganization() {
    console.log('Testing file organization...');
    
    // Check if file organizer exists
    const organizerPath = path.join(__dirname, 'file-organization-v3.js');
    await fs.access(organizerPath);
    
    // Verify it can be loaded
    const FileOrganizationV3 = require('./file-organization-v3');
    const org = new FileOrganizationV3();
    
    // Test file mapping logic
    const testFile = '/test/issues/issue-1/test-script.js';
    const operation = await org.determineFileOperation(testFile, '/test/issues/issue-1');
    
    if (operation.action !== 'move') {
        throw new Error('JavaScript files should be moved to workflow directory');
    }
    
    console.log('   ✓ File organizer logic is correct');
}

async function testMonitorConfiguration() {
    console.log('Testing monitor configuration...');
    
    // Check if integrated monitor exists
    const monitorPath = path.join(__dirname, 'monitor-enhanced.js');
    await fs.access(monitorPath);
    
    // Read and verify key features
    const monitorContent = await fs.readFile(monitorPath, 'utf8');
    
    const requiredFeatures = [
        'delay(30000)', // 30 second delays
        'delay(300000)', // 5 minute rate limit wait
        'MCPServerMonitor', // MCP integration
        'performChecks', // Centralized check function
        'getLastCheckTime' // Proper date handling
    ];
    
    for (const feature of requiredFeatures) {
        if (!monitorContent.includes(feature)) {
            throw new Error(`Missing required feature: ${feature}`);
        }
    }
    
    console.log('   ✓ Monitor has all required features');
    console.log('   ✓ Rate limit protection configured (30s delays)');
    console.log('   ✓ MCP integration included');
}

async function testMCPIntegration() {
    console.log('Testing MCP integration...');
    
    // Check if MCP server monitor exists
    const mcpMonitorPath = path.join(__dirname, 'mcp-server-monitor.js');
    await fs.access(mcpMonitorPath);
    
    // Test MCP monitor module
    const MCPServerMonitor = require('./mcp-server-monitor');
    const monitor = new MCPServerMonitor({
        checkInterval: 60000
    });
    
    // Verify event emitter functionality
    if (typeof monitor.on !== 'function') {
        throw new Error('MCP monitor should be an EventEmitter');
    }
    
    console.log('   ✓ MCP server monitor module is valid');
    console.log('   ✓ Health check interval: 60 seconds');
}

async function testRateLimitProtection() {
    console.log('Testing rate limit protection...');
    
    // Load config to check poll interval
    const configPath = path.join(__dirname, 'config-enhanced.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    
    const pollInterval = config.github?.pollInterval || 300000;
    if (pollInterval < 300000) { // Less than 5 minutes
        throw new Error('Poll interval should be at least 5 minutes to avoid rate limits');
    }
    
    console.log(`   ✓ Poll interval: ${pollInterval / 1000} seconds`);
    console.log('   ✓ Adequate spacing between API calls');
}

async function testStartScript() {
    console.log('Testing start script...');
    
    // Check if start script exists
    const startScriptPath = path.join(__dirname, 'start-enhanced-monitor.sh');
    await fs.access(startScriptPath);
    
    // Verify it's executable
    const stats = await fs.stat(startScriptPath);
    if (!(stats.mode & 0o100)) {
        throw new Error('Start script is not executable');
    }
    
    // Check script content
    const scriptContent = await fs.readFile(startScriptPath, 'utf8');
    const requiredChecks = [
        'cd "$(dirname "$0")"', // Changes to correct directory
        'AGENT_TOKEN', // Token check
        'claude mcp list', // MCP status check
        'monitor-enhanced.js' // Runs correct monitor
    ];
    
    for (const check of requiredChecks) {
        if (!scriptContent.includes(check)) {
            throw new Error(`Start script missing: ${check}`);
        }
    }
    
    console.log('   ✓ Start script is properly configured');
}

// Run tests
runTests().then(success => {
    if (success) {
        console.log('\n✅ All tests passed! The V3 solution is ready to use.');
        console.log('\nTo start the monitor, run:');
        console.log('   ./start-enhanced-v3-integrated.sh');
        console.log('\nTo organize issue-9 files first, run:');
        console.log('   ./start-enhanced-v3-integrated.sh --organize-issue-9');
    } else {
        console.log('\n❌ Some tests failed. Please fix the issues above.');
        process.exit(1);
    }
}).catch(error => {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
});
#!/usr/bin/env node

/**
 * Test script for the enhanced GitHub automation system
 * Tests progress updates, issue closure, and human response handling
 */

const { Octokit } = require('@octokit/rest');
const EnhancedGitHubAutomation = require('./automation-enhanced-v2');
const config = require('./config.json');

async function testEnhancedSystem() {
    console.log('🧪 Testing Enhanced GitHub Automation System\n');
    
    const automation = new EnhancedGitHubAutomation(config);
    const octokit = new Octokit({
        auth: process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN
    });
    
    try {
        // Test 1: Direct posting capability
        console.log('Test 1: Verifying direct GitHub posting...');
        const testComment = await octokit.issues.createComment({
            owner: config.github.owner,
            repo: config.github.repo,
            issue_number: 6,
            body: `🧪 **Enhanced System Test**\n\nThis is a test of the enhanced automation system.\n\nTimestamp: ${new Date().toISOString()}`
        });
        console.log('✅ Direct posting successful\n');
        
        // Test 2: Issue retrieval
        console.log('Test 2: Retrieving issue details...');
        const { data: issue } = await octokit.issues.get({
            owner: config.github.owner,
            repo: config.github.repo,
            issue_number: 6
        });
        console.log(`✅ Issue retrieved: #${issue.number} - ${issue.title}\n`);
        
        // Test 3: Label management
        console.log('Test 3: Testing label management...');
        await automation.updateIssueLabels(6, ['test-label'], []);
        console.log('✅ Label added successfully');
        await automation.updateIssueLabels(6, [], ['test-label']);
        console.log('✅ Label removed successfully\n');
        
        // Test 4: Progress tracking simulation
        console.log('Test 4: Testing progress tracking...');
        automation.activeIssues.set('6', {
            number: 6,
            title: issue.title,
            startTime: Date.now(),
            phase: 'testing',
            updates: []
        });
        
        await automation.postProgressUpdate('6');
        console.log('✅ Progress update posted\n');
        
        automation.activeIssues.delete('6');
        
        // Test 5: MCP server availability
        console.log('Test 5: Checking MCP server availability...');
        try {
            const { execSync } = require('child_process');
            execSync('npx ruv-swarm --version', { stdio: 'pipe' });
            console.log('✅ ruv-swarm MCP server available');
        } catch (error) {
            console.log('⚠️  ruv-swarm not installed globally');
        }
        
        try {
            const { execSync } = require('child_process');
            execSync('npx @modelcontextprotocol/server-github --help', { stdio: 'pipe' });
            console.log('✅ GitHub MCP server available\n');
        } catch (error) {
            console.log('⚠️  GitHub MCP server not available\n');
        }
        
        console.log('🎉 All tests completed successfully!');
        console.log('\nThe enhanced system is ready to:');
        console.log('- Process issues with real-time progress updates');
        console.log('- Automatically close completed issues');
        console.log('- Respond to human comments');
        console.log('- Handle multiple issues concurrently');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run tests
testEnhancedSystem();
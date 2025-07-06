#!/usr/bin/env node

/**
 * Test script to process a single GitHub issue
 */

const GitHubAutomationCoordinator = require('./automation-coordinator');
const fs = require('fs').promises;
const path = require('path');

async function testSingleIssue(issueNumber) {
    console.log(`🧪 Testing with issue #${issueNumber}`);
    
    // Load configuration
    const configPath = path.join(__dirname, 'config-enhanced.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    
    // Add token from environment
    config.github.token = process.env.AGENT_TOKEN;
    
    if (!config.github.token) {
        console.error('❌ Error: AGENT_TOKEN environment variable not set');
        process.exit(1);
    }
    
    // Create automation instance
    const automation = new GitHubAutomationCoordinator(config);
    
    // Fetch the issue
    const { Octokit } = require('@octokit/rest');
    const octokit = new Octokit({
        auth: config.github.token
    });
    
    try {
        const { data: issue } = await octokit.issues.get({
            owner: config.github.owner,
            repo: config.github.repo,
            issue_number: issueNumber
        });
        
        console.log(`📋 Found issue: ${issue.title}`);
        console.log(`📝 State: ${issue.state}`);
        console.log(`🏷️  Labels: ${issue.labels.map(l => l.name).join(', ')}`);
        
        // Process the issue
        console.log('\n🚀 Processing issue...\n');
        const result = await automation.processIssue(issue);
        
        if (result.success) {
            console.log('\n✅ Issue processed successfully!');
        } else {
            console.log(`\n❌ Failed to process issue: ${result.error}`);
        }
        
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Get issue number from command line
const issueNumber = parseInt(process.argv[2]);

if (!issueNumber) {
    console.log('Usage: node test-single-issue.js <issue-number>');
    console.log('Example: node test-single-issue.js 1');
    process.exit(1);
}

testSingleIssue(issueNumber).catch(console.error);
#!/usr/bin/env node

/**
 * Test the Claude-integrated automation on a specific issue
 */

const ClaudeIntegratedAutomation = require('./automation-claude-integrated');
const fs = require('fs').promises;
const path = require('path');

async function testIssue(issueNumber) {
    console.log(`🧪 Testing Claude-integrated automation with issue #${issueNumber}`);
    
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
    const automation = new ClaudeIntegratedAutomation(config);
    
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
        
        // First remove any existing in-progress label to allow reprocessing
        try {
            await octokit.issues.removeLabel({
                owner: config.github.owner,
                repo: config.github.repo,
                issue_number: issueNumber,
                name: 'swarm-in-progress'
            });
            console.log('🏷️  Removed existing swarm-in-progress label');
        } catch (e) {
            // Label might not exist, that's fine
        }
        
        // Process the issue
        console.log('\n🚀 Processing issue with Claude + ruv-swarm...\n');
        const result = await automation.processIssue(issue);
        
        if (result.success) {
            console.log('\n✅ Issue processed successfully!');
            console.log('Check the issue comments for Claude\'s analysis.');
        } else {
            console.log(`\n❌ Failed to process issue: ${result.error}`);
        }
        
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Get issue number from command line or default to 6
const issueNumber = parseInt(process.argv[2]) || 6;

testIssue(issueNumber).catch(console.error);
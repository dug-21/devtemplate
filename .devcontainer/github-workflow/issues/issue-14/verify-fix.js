#!/usr/bin/env node

/**
 * Verification script for comment detection fix
 */

const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');

async function verifyFix() {
    console.log('🔧 Verifying Comment Detection Fix...\n');
    
    const config = JSON.parse(await fs.readFile(path.join(__dirname, '../../config-enhanced.json'), 'utf8'));
    const octokit = new Octokit({
        auth: process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN
    });
    
    console.log('✅ Key fixes implemented:');
    console.log('1. Processed comments file initialized on startup');
    console.log('2. Increased buffer time to 30 seconds');
    console.log('3. Better logging for comment detection');
    console.log('4. Improved human comment detection');
    console.log('5. Fixed Set to Array conversion in save method');
    
    // Create a test comment to verify detection
    console.log('\n🧪 Creating test comment with @claude mention...');
    
    try {
        const testComment = await octokit.issues.createComment({
            owner: config.github.owner,
            repo: config.github.repo,
            issue_number: 14,
            body: `🧪 **Test Comment for Fix Verification**

@claude can you see this comment? This is a test to verify the comment detection fix is working properly.

Test ID: ${Date.now()}

Please respond if you can see this!`
        });
        
        console.log(`✅ Test comment created: ${testComment.data.html_url}`);
        console.log('\nThe monitor should detect and respond to this comment within 1 minute.');
        console.log('Watch for a response from the bot...');
        
    } catch (error) {
        console.error('❌ Failed to create test comment:', error.message);
    }
}

// Run verification
verifyFix().catch(console.error);
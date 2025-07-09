#!/usr/bin/env node

// Test which token the monitor will use
const { Octokit } = require('@octokit/rest');

// Simulate the token priority from monitor-enhanced.js
const config = { github: {} }; // No token in config
const selectedToken = config.github.token || 
                     process.env.GITHUB_BOT_TOKEN || 
                     process.env.GITHUB_PERSONAL_ACCESS_TOKEN || 
                     process.env.AGENT_TOKEN || 
                     process.env.GITHUB_TOKEN;

console.log('🔍 Token selection test:');
console.log('config.github.token:', config.github.token || 'Not set');
console.log('GITHUB_BOT_TOKEN:', process.env.GITHUB_BOT_TOKEN ? 'Set' : 'Not set');
console.log('GITHUB_PERSONAL_ACCESS_TOKEN:', process.env.GITHUB_PERSONAL_ACCESS_TOKEN ? 'Set' : 'Not set');
console.log('AGENT_TOKEN:', process.env.AGENT_TOKEN ? 'Set' : 'Not set');
console.log('GITHUB_TOKEN:', process.env.GITHUB_TOKEN ? 'Set' : 'Not set');
console.log('');
console.log('Selected token:', selectedToken ? 'Set' : 'None selected');

if (selectedToken) {
    console.log('Testing selected token...');
    
    const octokit = new Octokit({ auth: selectedToken });
    
    octokit.users.getAuthenticated().then(response => {
        console.log('✅ Token belongs to:', response.data.login);
        console.log('   User ID:', response.data.id);
        console.log('   User type:', response.data.type);
    }).catch(error => {
        console.log('❌ Token test failed:', error.message);
    });
} else {
    console.log('❌ No token available');
}
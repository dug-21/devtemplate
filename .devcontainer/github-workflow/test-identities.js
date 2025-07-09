#!/usr/bin/env node

const { Octokit } = require('@octokit/rest');

async function testIdentity(tokenName, token) {
    if (!token) {
        console.log(`❌ ${tokenName}: Not set`);
        return;
    }
    
    try {
        const octokit = new Octokit({ auth: token });
        const { data: user } = await octokit.users.getAuthenticated();
        console.log(`✅ ${tokenName}: @${user.login} (${user.type})`);
    } catch (error) {
        console.log(`❌ ${tokenName}: Invalid token - ${error.message}`);
    }
}

async function main() {
    console.log('🔍 Testing GitHub Token Identities\n');
    
    // Test each token
    await testIdentity('GITHUB_TOKEN', process.env.GITHUB_TOKEN);
    await testIdentity('BOT_GITHUB_TOKEN', process.env.BOT_GITHUB_TOKEN);
    await testIdentity('MY_GITHUB_TOKEN', process.env.MY_GITHUB_TOKEN);
    await testIdentity('AGENT_TOKEN', process.env.AGENT_TOKEN);
    
    console.log('\n📋 Recommendations:');
    console.log('- BOT_GITHUB_TOKEN should be your bot account');
    console.log('- MY_GITHUB_TOKEN should be your personal account');
    console.log('- Configure your IDE to use MY_GITHUB_TOKEN');
    console.log('- The monitor will use BOT_GITHUB_TOKEN');
}

main().catch(console.error);
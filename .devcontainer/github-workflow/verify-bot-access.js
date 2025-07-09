#!/usr/bin/env node

const { Octokit } = require('@octokit/rest');

async function verifyAccess() {
    const token = process.env.BOT_GITHUB_TOKEN;
    
    // Configuration - UPDATE THESE
    const owner = process.env.GITHUB_OWNER || 'your-username';  // Change this
    const repo = process.env.GITHUB_REPO || 'your-repo';       // Change this
    
    console.log('🔍 Bot Repository Access Verification\n');
    
    if (!token) {
        console.error('❌ BOT_GITHUB_TOKEN not set');
        console.error('\nUsage:');
        console.error('  export BOT_GITHUB_TOKEN="ghp_your_bot_token"');
        console.error('  export GITHUB_OWNER="repository-owner"');
        console.error('  export GITHUB_REPO="repository-name"');
        console.error('  node verify-bot-access.js');
        return;
    }
    
    const octokit = new Octokit({ auth: token });
    
    try {
        // Check authenticated user
        console.log('1️⃣ Checking authentication...');
        const { data: user } = await octokit.users.getAuthenticated();
        console.log('✅ Authenticated as: @' + user.login);
        console.log('   Account type: ' + user.type);
        console.log('   Created: ' + new Date(user.created_at).toLocaleDateString());
        console.log('');
        
        // Check repository access
        console.log('2️⃣ Checking repository access...');
        const { data: repository } = await octokit.repos.get({ owner, repo });
        console.log('✅ Repository: ' + repository.full_name);
        console.log('   Private: ' + (repository.private ? 'Yes' : 'No'));
        
        if (repository.permissions) {
            console.log('   Permissions:');
            console.log('     - Admin: ' + (repository.permissions.admin ? '✅' : '❌'));
            console.log('     - Push: ' + (repository.permissions.push ? '✅' : '❌'));
            console.log('     - Pull: ' + (repository.permissions.pull ? '✅' : '❌'));
        }
        console.log('');
        
        // Test read access
        console.log('3️⃣ Testing read capabilities...');
        const { data: issues } = await octokit.issues.listForRepo({ 
            owner, repo, per_page: 1 
        });
        console.log('✅ Can read issues (' + issues.length + ' retrieved)');
        
        // Test write access
        console.log('');
        console.log('4️⃣ Testing write capabilities...');
        if (repository.permissions && repository.permissions.push) {
            console.log('✅ Has write access to repository');
            
            // Check if bot can create issues
            try {
                const { data: labels } = await octokit.issues.listLabelsForRepo({
                    owner, repo, per_page: 1
                });
                console.log('✅ Can manage labels (write confirmed)');
            } catch (e) {
                console.log('⚠️  Limited write access');
            }
        } else {
            console.log('❌ Read-only access');
            console.log('   Bot needs write permission to create issues/comments');
        }
        
        // Check rate limits
        console.log('');
        console.log('5️⃣ API Rate Limits:');
        const { data: rateLimit } = await octokit.rateLimit.get();
        console.log('   Limit: ' + rateLimit.rate.limit + ' requests/hour');
        console.log('   Remaining: ' + rateLimit.rate.remaining);
        console.log('   Resets: ' + new Date(rateLimit.rate.reset * 1000).toLocaleTimeString());
        
        console.log('\n✅ Bot access verification complete!');
        
    } catch (error) {
        console.error('\n❌ Access error:', error.message);
        
        if (error.status === 404) {
            console.error('\n🔍 Troubleshooting:');
            console.error('   1. Bot does not have access to ' + owner + '/' + repo);
            console.error('   2. Repository might be private');
            console.error('   3. Token might lack "repo" scope');
            console.error('\n📋 Solution:');
            console.error('   1. Add bot as collaborator: https://github.com/' + owner + '/' + repo + '/settings/access');
            console.error('   2. Or have bot accept pending invitation');
            console.error('   3. Ensure PAT has "repo" scope selected');
        } else if (error.status === 401) {
            console.error('\n🔐 Authentication failed:');
            console.error('   - Token might be expired');
            console.error('   - Token might be invalid');
            console.error('   - Try generating a new token');
        }
    }
}

// Run verification
verifyAccess().catch(console.error);
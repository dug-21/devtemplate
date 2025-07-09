# Bot Account Repository Access Guide

## Overview
This guide explains how to give your bot account access to repositories it doesn't own and generate a PAT that can access them.

## Steps to Grant Bot Access

### Option 1: Add Bot as Collaborator (Recommended)
**From your main account (repo owner):**

1. **Go to Repository Settings**
   - Navigate to your repository (e.g., `https://github.com/yourusername/yourrepo`)
   - Click on "Settings" tab
   - Select "Collaborators and teams" from left sidebar

2. **Add Bot as Collaborator**
   - Click "Add people" button
   - Search for your bot account username (e.g., `yourname-bot`)
   - Click "Add [bot-username] to this repository"
   - Select permission level:
     - **Write** (recommended) - Can read, clone, push, and create issues/PRs
     - **Admin** - Full control (only if bot needs to manage settings)
   - Click "Add [bot-username] to [repository]"

3. **Bot Accepts Invitation**
   - Log into your bot account
   - Check email or go to `https://github.com/notifications`
   - Accept the repository invitation

### Option 2: Organization-Based Access
If the repo is in an organization:

1. **Create a Team**
   - Go to Organization → Teams → New Team
   - Name it something like "Automation Bots"
   - Add your bot account to the team

2. **Grant Team Access**
   - Go to Repository → Settings → Collaborators and teams
   - Add the team with appropriate permissions

### Option 3: Fork-Based Access (Limited)
If you can't add collaborator:

1. **Fork the Repository**
   - Log into bot account
   - Fork the main repository
   - Work on the fork and create PRs to main repo

## Generate PAT for Bot Account

1. **Log into Bot Account**
   ```
   https://github.com/login
   ```

2. **Navigate to Token Settings**
   ```
   Settings → Developer settings → Personal access tokens → Tokens (classic)
   ```

3. **Generate New Token**
   - Click "Generate new token (classic)"
   - Note: Give it a descriptive name like "Monitor Bot - YourRepo"
   - Expiration: 90 days (or custom)
   
4. **Select Scopes**
   Required scopes for automation:
   - ✅ **repo** (Full control of private repositories)
     - ✅ repo:status
     - ✅ repo_deployment
     - ✅ public_repo
     - ✅ repo:invite
   - ✅ **workflow** (if modifying GitHub Actions)
   - ✅ **write:discussion** (if commenting on discussions)
   
   Optional scopes:
   - ⬜ admin:org (only if managing org settings)
   - ⬜ delete_repo (usually not needed for bots)

5. **Generate and Save Token**
   - Click "Generate token"
   - **IMPORTANT**: Copy the token immediately (starts with `ghp_`)
   - You won't be able to see it again!

## Quick Verification Script

Create `verify-bot-access.js`:
```javascript
#!/usr/bin/env node
const { Octokit } = require('@octokit/rest');

async function verifyAccess() {
    const token = process.env.GITHUB_BOT_TOKEN;
    const owner = 'your-username';  // Change this
    const repo = 'your-repo';       // Change this
    
    if (!token) {
        console.error('❌ GITHUB_BOT_TOKEN not set');
        return;
    }
    
    const octokit = new Octokit({ auth: token });
    
    try {
        // Check authenticated user
        const { data: user } = await octokit.users.getAuthenticated();
        console.log('✅ Authenticated as:', user.login);
        
        // Check repository access
        const { data: repository } = await octokit.repos.get({ owner, repo });
        console.log('✅ Repository access:', repository.full_name);
        console.log('   Permissions:', repository.permissions);
        
        // Try to list issues (read test)
        const { data: issues } = await octokit.issues.listForRepo({ 
            owner, repo, per_page: 1 
        });
        console.log('✅ Can read issues');
        
        // Check if can create issues (write test)
        if (repository.permissions.push) {
            console.log('✅ Can write to repository');
        } else {
            console.log('⚠️  Read-only access');
        }
        
    } catch (error) {
        console.error('❌ Access error:', error.message);
        if (error.status === 404) {
            console.error('   Bot does not have access to this repository');
        }
    }
}

verifyAccess();
```

Run with:
```bash
export GITHUB_BOT_TOKEN="ghp_your_bot_token"
node verify-bot-access.js
```

## Security Best Practices

1. **Minimum Required Permissions**
   - Only grant "Write" access, not "Admin"
   - Only select required PAT scopes

2. **Token Rotation**
   - Set expiration dates on tokens
   - Rotate tokens every 90 days
   - Use GitHub's token expiration reminders

3. **Access Audit**
   - Regularly review Settings → Collaborators
   - Check Settings → Security → Security log
   - Remove bot access when no longer needed

4. **Separate Tokens per Repository**
   - Consider creating different PATs for different repos
   - Easier to revoke access to specific repos
   - Better security isolation

## Troubleshooting

### "Repository not found" error?
- Bot doesn't have access - check collaborator status
- Repository is private and bot lacks permission
- Token doesn't have `repo` scope

### "Resource not accessible by integration"?
- Bot has read-only access, needs write permission
- Token is missing required scopes
- Repository has branch protection preventing bot pushes

### Can't add bot as collaborator?
- You need admin access to the repository
- Organization settings might restrict outside collaborators
- Contact repository owner/admin for access

## Common Permission Levels

| Action | Read | Triage | Write | Maintain | Admin |
|--------|------|--------|-------|----------|--------|
| View code | ✅ | ✅ | ✅ | ✅ | ✅ |
| View issues | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create issues | ❌ | ✅ | ✅ | ✅ | ✅ |
| Comment | ❌ | ✅ | ✅ | ✅ | ✅ |
| Push code | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage issues | ❌ | ❌ | ✅ | ✅ | ✅ |
| Delete issues | ❌ | ❌ | ❌ | ✅ | ✅ |
| Settings | ❌ | ❌ | ❌ | ❌ | ✅ |

For automation bots, **Write** permission is typically sufficient.
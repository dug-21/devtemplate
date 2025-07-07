# Machine User Setup for Automation

## Creating a Dedicated Bot Account

### 1. Create New GitHub Account
1. Sign out of your main GitHub account
2. Create a new account (e.g., `dug-21-bot` or `dug-automation`)
3. Verify the email address

### 2. Add Bot as Collaborator
1. From your main account, go to repository Settings > Collaborators
2. Invite the bot account with "Write" permissions
3. Accept the invitation from the bot account

### 3. Generate Bot Token
1. From the bot account, go to Settings > Developer settings > Personal access tokens
2. Generate a new token with permissions:
   - `repo` (full repository access)
   - `write:discussion` (if using discussions)

### 4. Update Environment
Replace your current token with the bot's token:

```bash
# Use bot token instead of personal token
export GITHUB_TOKEN="ghp_bot_token_here"
# or
export AGENT_TOKEN="ghp_bot_token_here"
```

### 5. Benefits
- ✅ Clear separation between human and bot comments
- ✅ Easy to identify automation actions
- ✅ Can be added/removed from repositories independently
- ✅ Simpler than GitHub Apps for basic use cases

### 6. Updating the Monitor
The current code will automatically use the new bot account's identity, and your human comments will be processed while bot comments are properly skipped.
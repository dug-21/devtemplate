# GitHub Bot Identity Setup Guide

## 1. Create Bot Account
- Create a new GitHub account (e.g., `yourname-bot`)
- Generate a Personal Access Token with repo permissions
- Save this token as `BOT_GITHUB_TOKEN`

## 2. Configure GitHub MCP Server
The GitHub MCP server needs to use the bot token. You can:

### Option A: Reconfigure MCP with Bot Token
```bash
# Remove current GitHub MCP
claude mcp remove github

# Re-add with bot token environment
BOT_GITHUB_TOKEN=ghp_your_bot_token_here claude mcp add github "npx @modelcontextprotocol/server-github"
```

### Option B: Use Environment Variable
If the GitHub MCP server respects GITHUB_TOKEN, you can:
1. Keep your personal token as `MY_GITHUB_TOKEN`
2. Set `GITHUB_TOKEN` to the bot token for MCP
3. Configure your IDE to use `MY_GITHUB_TOKEN`

## 3. Update Monitor Script
Modify the monitor to use the bot token:

```javascript
// In monitor-enhanced.js, line 175
this.octokit = new Octokit({
    auth: process.env.BOT_GITHUB_TOKEN || process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN
});
```

## 4. Update Automation Script
Modify automation-enhanced.js similarly:

```javascript
// In automation-enhanced.js
const token = process.env.BOT_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
```

## 5. Environment Setup
In your `.env` or shell profile:
```bash
# Your personal token for IDE work
export MY_GITHUB_TOKEN="ghp_your_personal_token"

# Bot token for automation
export BOT_GITHUB_TOKEN="ghp_your_bot_token"

# If MCP uses GITHUB_TOKEN, set it to bot token
export GITHUB_TOKEN="$BOT_GITHUB_TOKEN"

# Configure git to use your personal token
git config --global credential.helper store
git config --global url."https://${MY_GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"
```

## Result:
- ✅ Your IDE commits → Your personal account
- ✅ Monitor comments → Bot account  
- ✅ Claude's GitHub operations → Bot account
- ✅ Clear separation of human vs bot activity
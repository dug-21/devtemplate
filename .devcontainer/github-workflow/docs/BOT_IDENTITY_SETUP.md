# Bot Identity Setup Guide

## Overview
This guide helps you set up a separate bot identity for GitHub automation, ensuring clear separation between human and bot activities.

## Quick Start

### 1. Create Bot Account
1. Go to https://github.com/signup
2. Create a new account (e.g., `yourname-bot`)
3. Generate a Personal Access Token:
   - Go to Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Select scopes: `repo` (full control)
   - Copy the token (starts with `ghp_`)

### 2. Configure Environment

#### For Bot Operations (Monitor/Automation):
```bash
export BOT_GITHUB_TOKEN="ghp_your_bot_token_here"
./start-enhanced-monitor.sh
```

#### For Personal Development:
```bash
export GITHUB_TOKEN="ghp_your_personal_token"
# Normal git/IDE operations will use your account
```

### 3. Test Your Setup
```bash
# Test current configuration
node test-identities.js

# Expected output:
# ✅ GITHUB_TOKEN: @your-username (User)
# ✅ BOT_GITHUB_TOKEN: @your-bot (User)
```

## How It Works

When you run with `BOT_GITHUB_TOKEN` set, the enhanced monitor script:
1. Sets `GITHUB_PERSONAL_ACCESS_TOKEN` for GitHub MCP server
2. Sets `GITHUB_TOKEN` for monitor and automation scripts
3. Verifies the bot identity before starting
4. All comments and actions appear as the bot account

When you run without `BOT_GITHUB_TOKEN`:
- Uses your personal token (normal development mode)
- All actions appear as your personal account

## Benefits

✅ **Clear Separation**: Bot comments are visibly different from human comments
✅ **No Code Changes**: Works with existing monitor and automation
✅ **Flexible**: Easy to switch between bot and personal modes
✅ **MCP Compatible**: GitHub MCP server uses bot identity when configured

## Advanced Configuration

### Persistent Bot Mode
Add to your `.bashrc` or `.zshrc`:
```bash
alias monitor-bot='BOT_GITHUB_TOKEN="ghp_your_bot_token" ./start-enhanced-monitor.sh'
```

### Separate Git Configuration
Keep your commits under your personal account:
```bash
git config --global url."https://YOUR_PERSONAL_TOKEN@github.com/".insteadOf "https://github.com/"
```

## Troubleshooting

### Bot token not working?
- Ensure the token has `repo` scope
- Check if the bot account has access to your repository
- Verify with: `node test-identities.js`

### MCP using wrong identity?
The GitHub MCP server uses `GITHUB_PERSONAL_ACCESS_TOKEN`, which is automatically set to the bot token when running in bot mode.

### Want to switch back to personal mode?
Simply run without setting `BOT_GITHUB_TOKEN`:
```bash
./start-enhanced-monitor.sh
```
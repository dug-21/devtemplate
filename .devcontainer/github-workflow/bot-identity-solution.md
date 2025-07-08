# Bot Identity Solution for GitHub MCP

## The Issue
The GitHub MCP server only accepts `GITHUB_PERSONAL_ACCESS_TOKEN` (line 28-29 of utils.js).

## Solutions

### Option 1: Environment Variable Wrapper (Recommended)
Create a wrapper script that sets the right token for MCP:

```bash
#!/bin/bash
# mcp-with-bot.sh
export GITHUB_PERSONAL_ACCESS_TOKEN="$BOT_GITHUB_TOKEN"
claude "$@"
```

Then use: `./mcp-with-bot.sh` instead of `claude` when you want bot identity.

### Option 2: Reconfigure MCP Server
Remove and re-add the GitHub MCP server with the bot token:

```bash
# Remove current configuration
claude mcp remove github

# Set bot token as the personal access token
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_your_bot_token"

# Re-add the server
claude mcp add github "npx @modelcontextprotocol/server-github"
```

### Option 3: Dual MCP Servers
Add a second GitHub MCP instance specifically for bot operations:

```bash
# Keep existing github server for personal use
# Add github-bot server with bot token
GITHUB_PERSONAL_ACCESS_TOKEN="ghp_bot_token" claude mcp add github-bot "npx @modelcontextprotocol/server-github"
```

### Option 4: Modified Environment Launch
Create an alias or script:

```bash
# In your .bashrc or .zshrc
alias claude-bot='GITHUB_PERSONAL_ACCESS_TOKEN="$BOT_GITHUB_TOKEN" claude'
```

## Recommended Approach

1. **For Development**: Use your personal token normally
   ```bash
   export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_your_personal_token"
   export GITHUB_TOKEN="ghp_your_personal_token"  # For other tools
   ```

2. **For Bot Operations**: Launch with bot token
   ```bash
   # Create start-bot-monitor.sh
   #!/bin/bash
   export BOT_GITHUB_TOKEN="ghp_your_bot_token"
   export GITHUB_PERSONAL_ACCESS_TOKEN="$BOT_GITHUB_TOKEN"
   export GITHUB_TOKEN="$BOT_GITHUB_TOKEN"  # For monitor/automation
   
   # Start the monitor
   ./start-enhanced-monitor.sh
   ```

3. **For IDE/Git**: Use personal token
   ```bash
   git config --global credential.helper store
   git config --global url."https://YOUR_PERSONAL_TOKEN@github.com/".insteadOf "https://github.com/"
   ```

This way:
- Your normal Claude usage → Your account
- Monitor + MCP operations → Bot account
- Git commits → Your account
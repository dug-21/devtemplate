# Using Claude with Subscription (No API Key Required)

## Overview

If you have a Claude subscription (claude.ai Pro or Claude desktop app), you don't need an API key. The automation will work through your locally authenticated Claude instance.

## Setup Steps

### 1. Authenticate Claude Locally

#### Option A: Claude Desktop App
```bash
# Install Claude desktop app from: https://claude.ai/download
# Sign in with your subscription account
# The app will handle authentication automatically
```

#### Option B: Claude CLI with Subscription
```bash
# Authenticate once with your subscription
claude auth login
# Follow the prompts to authenticate with your claude.ai account
```

### 2. Skip API Key Configuration

Since you're using the subscription model:

```bash
# DON'T set CLAUDE_API_KEY in GitHub secrets
# The workflows will use your local Claude authentication
```

### 3. Update Workflow Files (Optional)

The workflows will work as-is, but you can remove API key references:

```yaml
# In your workflow files, this section can be removed:
env:
  CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}  # Not needed
```

### 4. How It Works

1. **GitHub Actions runs on GitHub's servers** - Can't access your local Claude
2. **For testing locally** - Your authenticated Claude works perfectly
3. **For production** - You'll need either:
   - An API key for server-side execution, OR
   - Run the automation locally where Claude is authenticated

## Local Development with Claude Subscription

For local testing and development:

```bash
# Your Claude is already authenticated
# Run action scripts locally for testing
node actions/process-issue.js

# Or use GitHub CLI to trigger workflows that you'll process locally
gh workflow run manual-automation.yml
```

## Important Notes

1. **GitHub Actions Limitation**: Since Actions run on GitHub's servers, they can't access your locally authenticated Claude
2. **Local-First Development**: Perfect for development and testing
3. **Production Options**:
   - Get an API key for production use
   - Run a self-hosted GitHub Actions runner with Claude authenticated
   - Use the manual workflow triggers and process locally

## Hybrid Approach

Many users use this hybrid approach:
- **Development**: Claude subscription (no API key)
- **Production**: Claude API key for automated server-side execution

This gives you the best of both worlds - free development with your subscription and automated production workflows.
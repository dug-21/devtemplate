# GitHub Product Development Automation Solution

## Table of Contents
- [Project Overview](#project-overview)
- [Prerequisites](#prerequisites)
- [Installation Steps](#installation-steps)
- [GitHub Actions Configuration](#github-actions-configuration)
- [Repository Setup](#repository-setup)
- [Environment Variables](#environment-variables)
- [Quick Start Guide](#quick-start-guide)
- [Testing the Installation](#testing-the-installation)
- [Next Steps](#next-steps)

## Project Overview

The GitHub Product Development Automation Solution is a GitHub Actions-based workflow automation system that uses event-driven automation to streamline product development. This solution provides:

- **Event-Driven Issue Processing**: GitHub Actions workflows triggered by issue and comment events
- **AI-Powered Analysis**: Integration with Claude CLI and RUV-swarm for intelligent automation
- **8-Phase EPIC Workflow**: Comprehensive project lifecycle management (Inception → Operations)
- **No Infrastructure Required**: Runs entirely on GitHub Actions - no servers or apps needed
- **Label-Based State Management**: Automatic label application for tracking workflow state

**Setup Time**: Approximately 15-30 minutes for basic configuration

## Prerequisites

Before setting up the solution, ensure you have:

### GitHub Requirements
- **GitHub Repository**: Where you'll add the workflow files
- **Repository Admin Access**: To configure secrets and settings
- **Bot Personal Access Token (PAT)**: A fine-grained PAT with these permissions:
  - Actions: Read & Write
  - Contents: Read
  - Issues: Read & Write
  - Pull requests: Read & Write
  - Metadata: Read

### Optional Requirements
- **Claude Access**: Either:
  - Claude API Key from Anthropic (for API access), OR
  - Claude subscription (claude.ai or desktop app) - authenticate locally once
- **Node.js 18+**: Only needed if running action scripts locally for testing

## Installation Steps

### 1. Copy Workflow Files

Copy the GitHub Actions workflow files to your repository:

```bash
# Create the workflows directory in your repository
mkdir -p .github/workflows

# Copy the workflow files
cp workflows/*.yml .github/workflows/

# Copy the action scripts and libraries
mkdir -p .github/actions
cp -r actions/* .github/actions/
cp -r library/* .github/actions/library/
```

### 2. Create Required Labels

The system uses these labels for state management:

```bash
# Using GitHub CLI (recommended)
gh label create "in-progress" --color "0E8A16" --description "Issue is being processed"
gh label create "swarm-active" --color "FBCA04" --description "RUV-swarm is processing"
gh label create "swarm-processed" --color "0E8A16" --description "Processed by swarm"
gh label create "phase:inception" --color "C5DEF5" --description "EPIC Phase 0"
gh label create "phase:discovery" --color "C5DEF5" --description "EPIC Phase 1"
gh label create "phase:design" --color "C5DEF5" --description "EPIC Phase 2"
gh label create "phase:architecture" --color "C5DEF5" --description "EPIC Phase 3"
gh label create "phase:implementation" --color "C5DEF5" --description "EPIC Phase 4"
gh label create "phase:testing" --color "C5DEF5" --description "EPIC Phase 5"
gh label create "phase:deployment" --color "C5DEF5" --description "EPIC Phase 6"
gh label create "phase:operations" --color "C5DEF5" --description "EPIC Phase 7"
gh label create "epic" --color "7057FF" --description "Epic issue for multi-phase work"
```

## GitHub Actions Configuration

### 1. Create a Bot Personal Access Token (PAT)

1. Go to GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Click "Generate new token"
3. Configure the token:
   - **Token name**: `github-workflow-bot`
   - **Expiration**: 90 days (or custom)
   - **Repository access**: Select your specific repository
   - **Permissions**:
     - Actions: Read & Write
     - Contents: Read
     - Issues: Read & Write
     - Pull requests: Read & Write
     - Metadata: Read

4. Copy the generated token immediately (you won't see it again!)

### 2. Configure Repository Secrets

Add the PAT and other secrets to your repository:

```bash
# Using GitHub CLI
gh secret set GITHUB_TOKEN --body "your-bot-pat-token"

# Optional: Only if using Claude API (not needed for subscription users)
gh secret set CLAUDE_API_KEY --body "your-claude-api-key"

# Or manually: Settings → Secrets and variables → Actions → New repository secret
```

## Repository Setup

### 1. Enable GitHub Actions

Ensure GitHub Actions is enabled for your repository:

1. Go to **Settings** → **Actions** → **General**
2. Under "Actions permissions", select "Allow all actions and reusable workflows"
3. Save your changes

### 2. Configure Workflow Permissions

Grant workflows permission to create issues and comments:

1. In **Settings** → **Actions** → **General**
2. Under "Workflow permissions", select:
   - ✅ Read and write permissions
   - ✅ Allow GitHub Actions to create and approve pull requests
3. Save your changes

### 3. Set Up Branch Protection (Optional)

For production repositories, configure branch protection:

1. Go to **Settings** → **Branches**
2. Add rule for `main` branch:
   - ✅ Require pull request reviews
   - ✅ Require status checks to pass

## Environment Variables

The workflows use these environment variables (set in workflow files):

```yaml
env:
  # Set in workflow files - no .env file needed!
  GITHUB_REPOSITORY: ${{ github.repository }}
  ISSUE_NUMBER: ${{ github.event.issue.number }}
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}  # Your Bot PAT
  
  # Optional: Claude API (not needed if using Claude subscription)
  CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
  
  # Configuration
  PROCESSING_TIMEOUT: "300000"  # 5 minutes
  MAX_RETRIES: "3"
  MIN_RESPONSE_TIME: "5000"  # 5 seconds
```

**Note**: No .env file is needed! All configuration is done through GitHub Secrets and workflow files.

## Quick Start Guide

### 1. Test the Setup

After completing the installation, test by creating a new issue:

```bash
# Using GitHub CLI
gh issue create --title "Test automation setup" --body "This is a test issue to verify the automation is working correctly." --label "test"

# Or create manually in the GitHub UI
```

### 2. Monitor Workflow Execution

Watch the automation in action:

```bash
# View running workflows
gh run list

# Watch a specific workflow run
gh run watch

# Or check the Actions tab in your repository
```

### 3. Test @Mentions

Add a comment to your test issue:

```markdown
@claude Can you analyze this issue and suggest next steps?
```

### 4. Test EPIC Workflow

Create an EPIC issue:

```bash
gh issue create --title "[EPIC] New Feature Development" --body "This is an epic issue that will go through all 8 phases." --label "epic"
```

## Testing the Installation

### 1. Verify Workflows Are Active

```bash
# List all workflows
gh workflow list

# Should show:
# NAME                      STATE   ID
# Comment Automation        active  comment-automation.yml
# EPIC Phase Transition     active  epic-phase-transition.yml
# Issue Automation          active  issue-automation.yml
# Manual Automation         active  manual-automation.yml
```

### 2. Check Recent Runs

```bash
# View recent workflow runs
gh run list --limit 5

# View details of a specific run
gh run view <run-id>
```

### 3. Test Manual Trigger

```bash
# Trigger manual automation
gh workflow run manual-automation.yml \
  -f action_type="reprocess-issue" \
  -f issue_number="1" \
  -f parameters='{"force": true}'
```

### 4. Common Issues

- **Workflows not triggering**: Check that Actions are enabled and permissions are set
- **Authentication errors**: Verify your Bot PAT has the correct permissions
- **Label errors**: Ensure all required labels exist in your repository

## Next Steps

### 1. Customize Workflows

Edit the workflow files in `.github/workflows/` to customize triggers and conditions:

```yaml
# Example: Add custom trigger conditions
on:
  issues:
    types: [opened, edited]
  issue_comment:
    types: [created]
  workflow_dispatch:  # Allow manual triggers
```

### 2. Add Custom Labels

Create additional labels for your workflow:

```bash
gh label create "needs-review" --color "D93F0B"
gh label create "ai-suggested" --color "0075CA"
gh label create "blocked" --color "B60205"
```

### 3. Configure AI Responses

Customize AI prompts in the action scripts:
- `actions/process-issue.js` - Modify issue analysis prompts
- `actions/process-comment.js` - Customize @mention responses

### 4. Monitor Usage

Track your automation usage:
- Check Actions minutes: Settings → Billing → Actions
- Review workflow runs: Actions tab
- Monitor API rate limits in workflow logs

### 5. Advanced Features

- **Custom Phase Criteria**: Edit `library/phase-manager.js`
- **New Action Types**: Add to `actions/manual-trigger.js`
- **Webhook Integration**: Extend workflows with webhook triggers

---

## Troubleshooting

Common issues and solutions:

1. **Workflows not running**: Ensure Actions are enabled in repository settings
2. **Permission errors**: Verify Bot PAT has all required permissions
3. **Rate limits**: Check API usage and implement caching if needed
4. **Missing labels**: Run the label creation script from Installation Step 2

For detailed troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
# GitHub Issue Automation Research: Simplest Approaches

## Executive Summary

After extensive research, the swarm has identified the 4 simplest approaches for GitHub issue automation with a Claude subscription (no API key). Ranked by simplicity and ease of setup.

## Comparison Table

| Approach | Setup Time | Complexity | Reliability | Best For |
|----------|------------|------------|-------------|----------|
| **1. GitHub CLI Watch** | 5 minutes | ⭐ (Simplest) | High | Single-user, immediate response |
| **2. Issue Comment Commands** | 10 minutes | ⭐⭐ | Very High | Team collaboration, async processing |
| **3. Self-Hosted Runner** | 20 minutes | ⭐⭐⭐ | High | Full automation, private repos |
| **4. Local Git Hooks** | 15 minutes | ⭐⭐ | Medium | Developer-centric workflows |

## Detailed Analysis

### 1. GitHub CLI Watch Mode (RECOMMENDED - Simplest)

**Setup Steps:**
```bash
# Install GitHub CLI
brew install gh  # or your package manager

# Authenticate
gh auth login

# Create simple watch script
#!/bin/bash
gh issue list --json number,title,body,labels --watch | while read -r line; do
  # Process with Claude via MCP
  echo "$line" | claude process
done
```

**Pros:**
- ✅ 5-minute setup
- ✅ No GitHub Actions needed
- ✅ Works with Claude subscription
- ✅ Real-time updates
- ✅ No infrastructure

**Cons:**
- ❌ Requires terminal always open
- ❌ Single machine dependency
- ❌ No built-in retry logic

**Perfect for:** Individual developers wanting immediate automation

---

### 2. Issue Comment Commands (RECOMMENDED - Most Flexible)

**Concept:** Use issue comments as commands, process manually when convenient

**Setup Steps:**
```bash
# Create command processor script
#!/bin/bash
# process-commands.sh

# Get recent comments with commands
gh api /repos/{owner}/{repo}/issues/comments \
  --jq '.[] | select(.body | startswith("/")) | {issue_url, body}'

# Process each command locally with Claude
```

**Example Commands:**
```
/analyze       # Trigger Claude analysis
/summarize     # Create summary
/suggest       # Get suggestions
```

**Pros:**
- ✅ 10-minute setup
- ✅ Human-in-the-loop control
- ✅ Works offline (process when online)
- ✅ Natural GitHub workflow
- ✅ Team-friendly

**Cons:**
- ❌ Not fully automated
- ❌ Requires manual trigger

**Perfect for:** Teams wanting controlled automation

---

### 3. Self-Hosted GitHub Actions Runner

**Setup Steps:**
```bash
# Download runner
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz

# Configure
./config.sh --url https://github.com/{owner}/{repo} --token {token}

# Run
./run.sh
```

**Workflow Example:**
```yaml
name: Process Issues Locally
on:
  issues:
    types: [opened, edited]
runs-on: self-hosted

jobs:
  process:
    steps:
      - name: Process with Claude
        run: |
          echo "${{ toJSON(github.event.issue) }}" | claude process
```

**Pros:**
- ✅ Full GitHub Actions features
- ✅ Runs on your machine
- ✅ Access to local Claude
- ✅ Automatic triggers

**Cons:**
- ❌ More complex setup
- ❌ Runner maintenance
- ❌ Security considerations

**Perfect for:** Organizations wanting full automation

---

### 4. Git Hooks + Issue Sync

**Innovative Approach:** Sync issues to local files, use git hooks

**Setup Steps:**
```bash
# Install issue sync tool
npm install -g github-issue-sync

# Create post-merge hook
cat > .git/hooks/post-merge << 'EOF'
#!/bin/bash
# Sync issues to local files
github-issue-sync pull

# Process new issues with Claude
find issues/ -name "*.md" -newer .last-sync | while read issue; do
  claude process < "$issue" > "$issue.response"
  gh issue comment $(basename $issue .md) --body-file "$issue.response"
done

touch .last-sync
EOF

chmod +x .git/hooks/post-merge
```

**Pros:**
- ✅ Works offline
- ✅ Version control for issues
- ✅ Batch processing
- ✅ Git-native workflow

**Cons:**
- ❌ Requires manual git pull
- ❌ Delayed processing
- ❌ Additional tooling

**Perfect for:** Developers who live in git

---

## The Swarm's Innovation: "Claude Commander"

The simplest possible approach - a single command that does everything:

```bash
# One-line setup
curl -sL https://claude-commander.sh | bash

# Usage
claude-commander watch {owner}/{repo}
```

**What it does:**
1. Watches for issue updates using `gh issue list --watch`
2. Detects `/claude` commands in comments
3. Processes with local Claude
4. Posts responses back

**Why it's the simplest:**
- Single command installation
- Zero configuration
- Works with Claude subscription
- No GitHub tokens needed (uses gh auth)

---

## Recommendation Matrix

| If you want... | Use this approach |
|----------------|-------------------|
| Absolute simplest setup | GitHub CLI Watch |
| Team collaboration | Issue Comment Commands |
| Full automation | Self-Hosted Runner |
| Offline capability | Git Hooks + Sync |
| One-command solution | Claude Commander |

## Setup Time Comparison

```
GitHub CLI Watch:        █████ 5 min
Issue Commands:          ██████████ 10 min
Claude Commander:        ███████ 7 min
Git Hooks:              ███████████████ 15 min
Self-Hosted Runner:     ████████████████████ 20 min

Traditional Approaches (for comparison):
GitHub App:             ████████████████████████████████████████ 40 min
Webhook Server:         ██████████████████████████████ 30 min
Probot Framework:       ██████████████████████████████████████████████ 45 min
```

## Final Verdict

For maximum simplicity with a Claude subscription:

1. **Start with GitHub CLI Watch** - Get running in 5 minutes
2. **Evolve to Issue Commands** - When you need team features
3. **Graduate to Self-Hosted Runner** - For production automation

The key insight: You don't need complex infrastructure. GitHub CLI + Claude MCP/CLI is sufficient for most automation needs.
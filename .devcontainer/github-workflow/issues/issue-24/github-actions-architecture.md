# GitHub Actions Architecture Design

## Overview

Event-driven architecture using GitHub Actions workflows to process all automation triggers within 5 seconds.

## Workflow Structure

### 1. Primary Event Workflows

#### `/.github/workflows/issue-automation.yml`
```yaml
name: Issue Automation
on:
  issues:
    types: [opened, reopened, edited]

jobs:
  process-issue:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: |
          cd .devcontainer/github-workflow
          npm ci
          
      - name: Process issue event
        env:
          GITHUB_TOKEN: ${{ secrets.BOT_PAT }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
          ISSUE_TITLE: ${{ github.event.issue.title }}
          ISSUE_BODY: ${{ github.event.issue.body }}
        run: |
          cd .devcontainer/github-workflow
          node actions/process-issue.js
```

#### `/.github/workflows/comment-automation.yml`
```yaml
name: Comment Automation
on:
  issue_comment:
    types: [created]

jobs:
  process-comment:
    runs-on: ubuntu-latest
    if: |
      github.event.issue.state == 'open' && 
      github.event.comment.user.type != 'Bot'
    steps:
      - uses: actions/checkout@v4
      
      - name: Check for mentions
        id: check-mentions
        run: |
          if [[ "${{ github.event.comment.body }}" =~ @claude ]]; then
            echo "has_claude_mention=true" >> $GITHUB_OUTPUT
          fi
          
      - name: Process comment
        env:
          GITHUB_TOKEN: ${{ secrets.BOT_PAT }}
          COMMENT_ID: ${{ github.event.comment.id }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
          HAS_CLAUDE: ${{ steps.check-mentions.outputs.has_claude_mention }}
        run: |
          cd .devcontainer/github-workflow
          node actions/process-comment.js
```

### 2. Phase Management Workflows

#### `/.github/workflows/epic-phase-transition.yml`
```yaml
name: EPIC Phase Transition
on:
  workflow_dispatch:
    inputs:
      issue_number:
        description: 'Issue number'
        required: true
      next_phase:
        description: 'Target phase'
        required: true
        type: choice
        options:
          - inception
          - discovery
          - design
          - architecture
          - implementation
          - testing
          - deployment
          - operations

jobs:
  transition-phase:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Validate phase transition
        run: |
          cd .devcontainer/github-workflow
          node actions/validate-phase-transition.js \
            --issue ${{ inputs.issue_number }} \
            --phase ${{ inputs.next_phase }}
            
      - name: Update issue phase
        if: success()
        run: |
          cd .devcontainer/github-workflow
          node actions/update-phase.js \
            --issue ${{ inputs.issue_number }} \
            --phase ${{ inputs.next_phase }}
```

### 3. Manual Trigger Workflow

#### `/.github/workflows/manual-automation.yml`
```yaml
name: Manual Automation Trigger
on:
  workflow_dispatch:
    inputs:
      action:
        description: 'Action to perform'
        required: true
        type: choice
        options:
          - reprocess-issue
          - run-ruv-swarm
          - generate-subtasks
          - update-documentation
      target:
        description: 'Target issue number'
        required: true

jobs:
  execute-manual:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Execute action
        env:
          GITHUB_TOKEN: ${{ secrets.BOT_PAT }}
        run: |
          cd .devcontainer/github-workflow
          node actions/manual-trigger.js \
            --action ${{ inputs.action }} \
            --target ${{ inputs.target }}
```

## Action Scripts Structure

### Directory Layout
```
.devcontainer/github-workflow/
├── actions/
│   ├── process-issue.js         # New issue handler
│   ├── process-comment.js       # Comment handler
│   ├── validate-phase-transition.js
│   ├── update-phase.js
│   ├── manual-trigger.js
│   └── lib/
│       ├── github-client.js     # GitHub API wrapper
│       ├── ruv-swarm-client.js  # ruv-swarm integration
│       ├── claude-client.js     # Claude CLI wrapper
│       ├── phase-manager.js     # EPIC phase logic
│       └── template-engine.js   # Template selection
```

## Integration Points

### 1. ruv-swarm Integration
- Reuse connection patterns from `monitor-enhanced-fixed.js`
- Spawn agents based on issue complexity
- Orchestrate multi-step workflows

### 2. Claude Integration
- Execute via CLI for @mentions
- Generate phase-specific content
- Handle AI-assisted responses

### 3. GitHub API
- Use Octokit with Bot-PAT
- Batch API calls to avoid rate limits
- Handle pagination for large responses

## Security Architecture

### 1. Secrets Management
```yaml
secrets:
  BOT_PAT: ${{ secrets.BOT_PAT }}
  CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
  MCP_CONFIG: ${{ secrets.MCP_CONFIG }}
```

### 2. Permission Validation
- Check bot permissions before operations
- Validate user permissions for manual triggers
- Audit all automated actions

## Performance Optimizations

### 1. Parallel Processing
- Run independent checks concurrently
- Batch API operations
- Cache frequently accessed data

### 2. Conditional Execution
- Skip unnecessary steps
- Use GitHub Actions conditions
- Early exit on validation failures

### 3. Resource Management
- Limit concurrent workflows
- Set appropriate timeouts
- Monitor resource usage

## Monitoring & Logging

### 1. Workflow Artifacts
- Store execution logs
- Save processing metrics
- Archive error reports

### 2. Status Reporting
- Update issue with progress
- Add execution summary comments
- Track performance metrics

## Deployment Strategy

### 1. Gradual Rollout
- Deploy to test repository first
- Monitor for 24 hours
- Roll out to production

### 2. Rollback Plan
- Keep previous version tagged
- Quick revert procedure
- Fallback to manual processing
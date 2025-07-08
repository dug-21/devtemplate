# New Architecture Design: Local Processing with GitHub Actions Event Capture

## 1. Architecture Overview

The new architecture follows a clear separation of concerns where GitHub Actions serves only as an event capture mechanism, while all processing happens locally on your development machine.

### Simple Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          GitHub Cloud                            │
│                                                                  │
│  ┌─────────────────┐     ┌──────────────────┐                  │
│  │  GitHub Events  │────▶│ GitHub Actions   │                  │
│  │  (Issues, PRs)  │     │ (Event Capture)  │                  │
│  └─────────────────┘     └────────┬─────────┘                  │
│                                   │                              │
│                          ┌────────▼─────────┐                   │
│                          │   Event Queue    │                   │
│                          │  (GitHub Issues) │                   │
│                          └────────┬─────────┘                   │
└───────────────────────────────────┼─────────────────────────────┘
                                    │ Poll/Watch
┌───────────────────────────────────┼─────────────────────────────┐
│                          Local Machine                           │
│                                   │                              │
│                          ┌────────▼─────────┐                   │
│                          │ Local Processing │                   │
│                          │     Service      │                   │
│                          └────────┬─────────┘                   │
│                                   │                              │
│              ┌────────────────────┼────────────────────┐        │
│              │                    │                     │        │
│     ┌────────▼─────────┐ ┌───────▼──────┐  ┌─────────▼──────┐ │
│     │   Claude Code    │ │  ruv-swarm   │  │ GitHub Client  │ │
│     │   (Local CLI)    │ │ (MCP Service)│  │   (gh CLI)     │ │
│     └──────────────────┘ └──────────────┘  └────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **GitHub Actions as Event Catchers Only**: Workflows capture events and create queue entries
2. **Local Processing**: All AI processing, automation, and complex logic runs locally
3. **Event Queue via Issues**: Special issues serve as an event queue
4. **No Direct Cloud-to-Local Communication**: GitHub Actions cannot access local services

## 2. GitHub Actions Workflows - Minimal Event Capture

### 2.1 Issue Event Capture Workflow

**File**: `.github/workflows/capture-issue-events.yml`

```yaml
name: Capture Issue Events
on:
  issues:
    types: [opened, edited, closed, reopened, labeled, unlabeled]

jobs:
  capture-event:
    runs-on: ubuntu-latest
    steps:
      - name: Create Event Queue Entry
        uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const eventData = {
              type: 'issue',
              action: context.payload.action,
              issue: {
                number: context.issue.number,
                title: context.payload.issue.title,
                body: context.payload.issue.body,
                labels: context.payload.issue.labels.map(l => l.name),
                state: context.payload.issue.state,
                user: context.payload.issue.user.login
              },
              timestamp: new Date().toISOString(),
              repository: context.repo.repo,
              owner: context.repo.owner
            };
            
            // Create a queue entry as an issue with special label
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `[EVENT-QUEUE] Issue ${context.payload.action} - #${context.issue.number}`,
              body: `\`\`\`json\n${JSON.stringify(eventData, null, 2)}\n\`\`\``,
              labels: ['event-queue', 'pending']
            });
```

### 2.2 Comment Event Capture Workflow

**File**: `.github/workflows/capture-comment-events.yml`

```yaml
name: Capture Comment Events
on:
  issue_comment:
    types: [created, edited, deleted]

jobs:
  capture-event:
    runs-on: ubuntu-latest
    steps:
      - name: Create Event Queue Entry
        uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const eventData = {
              type: 'comment',
              action: context.payload.action,
              issue: {
                number: context.issue.number
              },
              comment: {
                id: context.payload.comment.id,
                body: context.payload.comment.body,
                user: context.payload.comment.user.login
              },
              timestamp: new Date().toISOString(),
              repository: context.repo.repo,
              owner: context.repo.owner
            };
            
            // Check for @claude mentions
            const hasClaude = context.payload.comment.body.includes('@claude');
            
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `[EVENT-QUEUE] Comment ${context.payload.action} - Issue #${context.issue.number}`,
              body: `\`\`\`json\n${JSON.stringify(eventData, null, 2)}\n\`\`\``,
              labels: ['event-queue', 'pending', hasClaude ? 'claude-mention' : null].filter(Boolean)
            });
```

### 2.3 Pull Request Event Capture Workflow

**File**: `.github/workflows/capture-pr-events.yml`

```yaml
name: Capture PR Events
on:
  pull_request:
    types: [opened, edited, closed, reopened, synchronize]

jobs:
  capture-event:
    runs-on: ubuntu-latest
    steps:
      - name: Create Event Queue Entry
        uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const eventData = {
              type: 'pull_request',
              action: context.payload.action,
              pr: {
                number: context.payload.pull_request.number,
                title: context.payload.pull_request.title,
                body: context.payload.pull_request.body,
                state: context.payload.pull_request.state,
                user: context.payload.pull_request.user.login,
                base: context.payload.pull_request.base.ref,
                head: context.payload.pull_request.head.ref
              },
              timestamp: new Date().toISOString(),
              repository: context.repo.repo,
              owner: context.repo.owner
            };
            
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `[EVENT-QUEUE] PR ${context.payload.action} - #${context.payload.pull_request.number}`,
              body: `\`\`\`json\n${JSON.stringify(eventData, null, 2)}\n\`\`\``,
              labels: ['event-queue', 'pending']
            });
```

## 3. Local Processing Service Design

### 3.1 Event Queue Monitor

**File**: `local-event-processor.js`

```javascript
const { Octokit } = require('@octokit/rest');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class LocalEventProcessor {
  constructor(config) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.githubToken
    });
    this.processing = new Set();
  }

  async start() {
    console.log('Starting local event processor...');
    
    // Poll for new events every 5 seconds
    setInterval(() => this.checkEventQueue(), 5000);
    
    // Initial check
    await this.checkEventQueue();
  }

  async checkEventQueue() {
    try {
      // Get pending event queue items
      const { data: issues } = await this.octokit.issues.listForRepo({
        owner: this.config.owner,
        repo: this.config.repo,
        labels: 'event-queue,pending',
        state: 'open',
        sort: 'created',
        direction: 'asc'
      });

      for (const issue of issues) {
        if (!this.processing.has(issue.number)) {
          this.processing.add(issue.number);
          this.processEvent(issue).catch(err => {
            console.error(`Error processing event ${issue.number}:`, err);
            this.processing.delete(issue.number);
          });
        }
      }
    } catch (error) {
      console.error('Error checking event queue:', error);
    }
  }

  async processEvent(eventIssue) {
    try {
      console.log(`Processing event: ${eventIssue.title}`);
      
      // Parse event data from issue body
      const eventData = this.parseEventData(eventIssue.body);
      
      // Mark as processing
      await this.updateEventStatus(eventIssue.number, 'processing');
      
      // Route to appropriate handler
      switch (eventData.type) {
        case 'issue':
          await this.handleIssueEvent(eventData);
          break;
        case 'comment':
          await this.handleCommentEvent(eventData);
          break;
        case 'pull_request':
          await this.handlePREvent(eventData);
          break;
        default:
          console.log(`Unknown event type: ${eventData.type}`);
      }
      
      // Mark as completed and close
      await this.updateEventStatus(eventIssue.number, 'completed');
      await this.octokit.issues.update({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: eventIssue.number,
        state: 'closed'
      });
      
    } finally {
      this.processing.delete(eventIssue.number);
    }
  }

  parseEventData(body) {
    const match = body.match(/```json\n([\s\S]*?)\n```/);
    if (match) {
      return JSON.parse(match[1]);
    }
    throw new Error('Could not parse event data');
  }

  async updateEventStatus(issueNumber, status) {
    await this.octokit.issues.removeLabel({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueNumber,
      name: 'pending'
    }).catch(() => {}); // Ignore if label doesn't exist
    
    await this.octokit.issues.addLabels({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueNumber,
      labels: [status]
    });
  }

  async handleIssueEvent(eventData) {
    console.log(`Handling issue event: ${eventData.action} on #${eventData.issue.number}`);
    
    if (eventData.action === 'opened') {
      // Check if it needs processing
      if (eventData.issue.labels.includes('epic') || 
          eventData.issue.labels.includes('enhancement') ||
          eventData.issue.labels.includes('bug')) {
        
        // Create processing directory
        const issueDir = path.join(this.config.workDir, 'issues', `issue-${eventData.issue.number}`);
        await fs.mkdir(issueDir, { recursive: true });
        
        // Save issue metadata
        await fs.writeFile(
          path.join(issueDir, 'metadata.json'),
          JSON.stringify(eventData, null, 2)
        );
        
        // Run Claude processing
        await this.runClaudeProcessing(eventData.issue);
      }
    }
  }

  async handleCommentEvent(eventData) {
    console.log(`Handling comment event: ${eventData.action} on issue #${eventData.issue.number}`);
    
    // Check for @claude mention
    if (eventData.comment.body.includes('@claude')) {
      // Prepare Claude prompt
      const prompt = `
        User ${eventData.comment.user} commented on issue #${eventData.issue.number}:
        
        ${eventData.comment.body}
        
        Please provide a helpful response.
      `;
      
      // Run Claude and post response
      const response = await this.runClaude(prompt);
      
      await this.octokit.issues.createComment({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: eventData.issue.number,
        body: response
      });
    }
  }

  async handlePREvent(eventData) {
    console.log(`Handling PR event: ${eventData.action} on #${eventData.pr.number}`);
    
    // Add your PR processing logic here
    if (eventData.action === 'opened') {
      // Example: Run automated checks
      await this.runPRChecks(eventData.pr);
    }
  }

  async runClaudeProcessing(issue) {
    const prompt = `
      Process this GitHub issue:
      
      Title: ${issue.title}
      Body: ${issue.body}
      Labels: ${issue.labels.join(', ')}
      
      Provide analysis and next steps.
    `;
    
    const response = await this.runClaude(prompt);
    
    // Post response as comment
    await this.octokit.issues.createComment({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issue.number,
      body: response
    });
  }

  async runClaude(prompt) {
    // Save prompt to temporary file
    const promptFile = path.join(this.config.workDir, 'tmp', `prompt-${Date.now()}.txt`);
    await fs.mkdir(path.dirname(promptFile), { recursive: true });
    await fs.writeFile(promptFile, prompt);
    
    try {
      // Run Claude CLI
      const output = execSync(`claude -f "${promptFile}"`, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      return output;
    } catch (error) {
      console.error('Claude execution failed:', error);
      return 'Error: Failed to process with Claude. Please check logs.';
    } finally {
      // Clean up prompt file
      await fs.unlink(promptFile).catch(() => {});
    }
  }

  async runPRChecks(pr) {
    // Implementation for PR checks
    console.log(`Running checks for PR #${pr.number}`);
  }
}

// Main execution
if (require.main === module) {
  const config = require('./config.json');
  const processor = new LocalEventProcessor(config);
  processor.start();
}

module.exports = LocalEventProcessor;
```

## 4. Event Queue Design

### 4.1 Queue Structure

Events are stored as GitHub issues with specific labels:

- **Label**: `event-queue` - Identifies queue entries
- **Label**: `pending` - Unprocessed events
- **Label**: `processing` - Currently being processed
- **Label**: `completed` - Processed successfully
- **Label**: `failed` - Processing failed

### 4.2 Event Data Format

```json
{
  "type": "issue|comment|pull_request",
  "action": "opened|edited|closed|etc",
  "timestamp": "2025-01-01T12:00:00Z",
  "repository": "repo-name",
  "owner": "owner-name",
  "issue": {
    "number": 123,
    "title": "Issue title",
    "body": "Issue body",
    "labels": ["bug", "enhancement"],
    "state": "open",
    "user": "username"
  }
}
```

### 4.3 Queue Management

- **Retention**: Completed events are closed immediately
- **Failed Events**: Kept open with `failed` label for manual review
- **Ordering**: FIFO based on creation time
- **Concurrency**: Local processor handles multiple events in parallel

## 5. Implementation Details

### 5.1 Configuration File

**File**: `config.json`

```json
{
  "owner": "your-github-username",
  "repo": "your-repo-name",
  "githubToken": "ghp_your_token_here",
  "workDir": ".devcontainer/github-workflow",
  "claudeApiKey": "your-claude-api-key",
  "processing": {
    "pollInterval": 5000,
    "maxConcurrent": 3,
    "timeout": 300000
  },
  "features": {
    "autoProcess": true,
    "claudeMentions": true,
    "epicTracking": true
  }
}
```

### 5.2 ruv-swarm Integration

**File**: `lib/ruv-swarm-integration.js`

```javascript
const { spawn } = require('child_process');
const path = require('path');

class RuvSwarmIntegration {
  constructor(config) {
    this.config = config;
  }

  async runSwarm(task, agents = 3) {
    return new Promise((resolve, reject) => {
      const swarmScript = path.join(this.config.workDir, 'ruv-swarm.sh');
      const args = [
        '-t', task,
        '-a', agents.toString(),
        '-o', path.join(this.config.workDir, 'issues', `swarm-${Date.now()}`)
      ];
      
      const swarm = spawn(swarmScript, args, {
        cwd: this.config.workDir,
        env: {
          ...process.env,
          CLAUDE_API_KEY: this.config.claudeApiKey
        }
      });
      
      let output = '';
      
      swarm.stdout.on('data', (data) => {
        output += data.toString();
        console.log('Swarm:', data.toString());
      });
      
      swarm.stderr.on('data', (data) => {
        console.error('Swarm error:', data.toString());
      });
      
      swarm.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Swarm exited with code ${code}`));
        }
      });
    });
  }
}

module.exports = RuvSwarmIntegration;
```

### 5.3 GitHub Client Enhancement

**File**: `lib/github-enhanced.js`

```javascript
const { Octokit } = require('@octokit/rest');
const { throttling } = require('@octokit/plugin-throttling');

const MyOctokit = Octokit.plugin(throttling);

class GitHubEnhanced {
  constructor(config) {
    this.octokit = new MyOctokit({
      auth: config.githubToken,
      throttle: {
        onRateLimit: (retryAfter, options) => {
          console.warn(`Rate limit hit, retrying after ${retryAfter} seconds`);
          return true;
        },
        onSecondaryRateLimit: (retryAfter, options) => {
          console.warn(`Secondary rate limit hit, retrying after ${retryAfter} seconds`);
          return true;
        }
      }
    });
    this.config = config;
  }

  async updateIssuePhase(issueNumber, phase) {
    // Update issue with phase information
    const issue = await this.octokit.issues.get({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: issueNumber
    });
    
    // Parse current body to extract phase info
    const body = issue.data.body;
    const phaseRegex = /<!-- PHASE: (\w+) -->/;
    const currentPhase = body.match(phaseRegex)?.[1];
    
    if (currentPhase !== phase) {
      const newBody = body.replace(
        phaseRegex,
        `<!-- PHASE: ${phase} -->`
      ) || `${body}\n\n<!-- PHASE: ${phase} -->`;
      
      await this.octokit.issues.update({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
        body: newBody
      });
      
      // Add phase label
      await this.octokit.issues.addLabels({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
        labels: [`phase:${phase}`]
      });
    }
  }

  async createSubtask(parentIssue, title, body) {
    const issue = await this.octokit.issues.create({
      owner: this.config.owner,
      repo: this.config.repo,
      title: `[Subtask of #${parentIssue}] ${title}`,
      body: `Parent issue: #${parentIssue}\n\n${body}`,
      labels: ['subtask']
    });
    
    return issue.data;
  }
}

module.exports = GitHubEnhanced;
```

## 6. Setup Instructions

### Step 1: Install Dependencies

```bash
# Navigate to the github-workflow directory
cd .devcontainer/github-workflow

# Install Node.js dependencies
npm install

# Ensure Claude CLI is installed
# Follow instructions at: https://claude.ai/cli

# Ensure gh CLI is installed and authenticated
gh auth login
```

### Step 2: Configure GitHub Actions

1. Create a new GitHub Personal Access Token:
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Create a token with `repo`, `workflow` permissions
   - Save as `GITHUB_TOKEN` in repository secrets

2. Copy workflow files to your repository:
   ```bash
   cp -r workflows/* ../../.github/workflows/
   ```

### Step 3: Configure Local Service

1. Copy and edit configuration:
   ```bash
   cp config.example.json config.json
   # Edit config.json with your settings
   ```

2. Test the configuration:
   ```bash
   node local-event-processor.js --test
   ```

### Step 4: Start Local Processing

```bash
# Start the local processor
npm start

# Or run with PM2 for production
pm2 start local-event-processor.js --name github-processor
```

### Step 5: Verify Setup

1. Create a test issue in your repository
2. Check that an event queue entry is created
3. Verify local processor picks it up
4. Confirm processing completes successfully

## 7. Migration Plan

### Phase 1: Preparation (Week 1)

1. **Backup Current System**
   ```bash
   cp -r .devcontainer/github-workflow .devcontainer/github-workflow.backup
   ```

2. **Document Current Workflows**
   - List all active automations
   - Note custom configurations
   - Identify critical processes

3. **Setup Test Repository**
   - Create test repo for migration testing
   - Configure with minimal workflows

### Phase 2: Parallel Running (Week 2)

1. **Deploy New Workflows**
   - Add event capture workflows to `.github/workflows/`
   - Keep existing system running

2. **Configure Event Queue**
   - Add `event-queue` label to repository
   - Set up queue monitoring

3. **Test Local Processor**
   - Run local processor in test mode
   - Verify event capture and processing

### Phase 3: Gradual Migration (Week 3-4)

1. **Migrate by Feature**
   - Start with low-risk features (documentation)
   - Move to medium-risk (bug tracking)
   - Finally migrate critical features (deployments)

2. **Monitor Both Systems**
   - Compare outputs
   - Track performance metrics
   - Log any discrepancies

### Phase 4: Cutover (Week 5)

1. **Disable Old System**
   ```bash
   # Stop old monitoring service
   ./stop-local.sh
   
   # Disable old workflows
   mv .github/workflows/old-*.yml .github/workflows/disabled/
   ```

2. **Full Testing**
   - Run comprehensive test suite
   - Verify all automations work
   - Check error handling

3. **Update Documentation**
   - Update README with new architecture
   - Document new procedures
   - Train team members

### Phase 5: Cleanup (Week 6)

1. **Remove Old Components**
   ```bash
   # After confirming stability
   rm -rf .devcontainer/github-workflow.backup
   rm -rf .github/workflows/disabled/
   ```

2. **Optimize New System**
   - Tune polling intervals
   - Adjust concurrency limits
   - Optimize event processing

### Rollback Plan

If issues arise during migration:

1. **Immediate Rollback**
   ```bash
   # Stop new processor
   pm2 stop github-processor
   
   # Restore old workflows
   cp .devcontainer/github-workflow.backup/workflows/* .github/workflows/
   
   # Restart old system
   ./start-local.sh
   ```

2. **Data Recovery**
   - Event queue preserves all events
   - Can reprocess failed events
   - No data loss during transition

### Success Criteria

- [ ] All events captured within 5 seconds
- [ ] Local processor handles 100% of events
- [ ] No missed automations for 48 hours
- [ ] Team comfortable with new system
- [ ] Documentation complete and accurate

## Appendix: Troubleshooting

### Common Issues

1. **Events Not Being Captured**
   - Check GitHub Actions are enabled
   - Verify workflow permissions
   - Check repository secrets

2. **Local Processor Not Starting**
   - Verify config.json is valid
   - Check GitHub token permissions
   - Ensure Claude CLI is configured

3. **Processing Failures**
   - Check logs in `logs/` directory
   - Verify API rate limits
   - Check network connectivity

### Debug Commands

```bash
# Check event queue
gh issue list --label event-queue

# Test GitHub connection
gh api user

# Test Claude CLI
echo "Hello" | claude

# Check processor logs
tail -f logs/processor.log
```

### Support

For issues with the new architecture:
1. Check the troubleshooting guide
2. Review logs for error messages
3. Create an issue with the `architecture-help` label
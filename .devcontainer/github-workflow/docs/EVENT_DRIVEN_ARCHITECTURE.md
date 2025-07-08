# Event-Driven Architecture: Zero Polling Design

## Overview

This architecture eliminates all polling by using GitHub Actions as event broadcasters that trigger local processing through file system events and repository state changes.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          GitHub Cloud                                │
│                                                                      │
│  ┌─────────────────┐     ┌────────────────────┐                    │
│  │  GitHub Events  │────▶│  GitHub Actions    │                    │
│  │  (Issues, PRs)  │     │  (Event Trigger)   │                    │
│  └─────────────────┘     └─────────┬──────────┘                    │
│                                    │                                │
│                          ┌─────────▼──────────┐                     │
│                          │ 1. Create artifact │                     │
│                          │ 2. Update branch   │                     │
│                          │ 3. Create issue    │                     │
│                          └─────────┬──────────┘                     │
└────────────────────────────────────┼────────────────────────────────┘
                                     │ Git Pull/File Watch
┌────────────────────────────────────┼────────────────────────────────┐
│                          Local Machine                               │
│                                    │                                │
│                          ┌─────────▼──────────┐                     │
│                          │   File Watcher/    │                     │
│                          │   Git Hook         │                     │
│                          └─────────┬──────────┘                     │
│                                    │ Triggers                       │
│                          ┌─────────▼──────────┐                     │
│                          │  Event Processor   │                     │
│                          │  (Local Service)   │                     │
│                          └─────────┬──────────┘                     │
│                                    │                                │
│              ┌─────────────────────┼─────────────────────┐          │
│              │                     │                      │          │
│     ┌────────▼──────┐    ┌────────▼──────┐    ┌────────▼──────┐   │
│     │  Claude CLI   │    │   gh CLI      │    │  GitHub MCP   │   │
│     │  (via MCP)    │    │  (commands)   │    │  (via Claude) │   │
│     └───────────────┘    └───────────────┘    └───────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. GitHub Actions (Event Broadcaster)

**Minimal workflow that creates artifacts for local consumption:**

```yaml
name: Broadcast Issue Event
on:
  issues:
    types: [opened, edited, labeled, unlabeled]

jobs:
  broadcast:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Create Event File
        run: |
          mkdir -p .events
          cat > .events/issue-${{ github.event.issue.number }}-${{ github.run_id }}.json << EOF
          {
            "type": "issue",
            "action": "${{ github.event.action }}",
            "number": ${{ github.event.issue.number }},
            "title": "${{ github.event.issue.title }}",
            "body": $(echo '${{ github.event.issue.body }}' | jq -Rs .),
            "labels": ${{ toJSON(github.event.issue.labels) }},
            "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
            "run_id": "${{ github.run_id }}"
          }
          EOF
          
      - name: Commit Event
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .events/
          git commit -m "Event: Issue ${{ github.event.action }} #${{ github.event.issue.number }}"
          git push origin HEAD:refs/heads/events/pending
```

### 2. Local Event Processor (File Watcher)

**Local service that watches for events:**

```javascript
// local-event-processor.js
import { watch } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

class EventProcessor {
  constructor() {
    this.repoPath = process.env.REPO_PATH || '.';
    this.eventsDir = path.join(this.repoPath, '.events');
  }

  start() {
    // Set up git hook for instant notifications
    this.setupGitHooks();
    
    // Watch events directory
    watch(this.eventsDir, { recursive: true }, (eventType, filename) => {
      if (eventType === 'rename' && filename.endsWith('.json')) {
        this.processEvent(path.join(this.eventsDir, filename));
      }
    });

    // Initial pull to catch any pending events
    this.pullEvents();
    
    console.log('Event processor started. Watching for events...');
  }

  setupGitHooks() {
    // Create post-merge hook
    const hookContent = `#!/bin/sh
    # Trigger event processing after pull
    node ${__filename} --process-new-events
    `;
    
    fs.writeFileSync('.git/hooks/post-merge', hookContent, { mode: 0o755 });
  }

  pullEvents() {
    try {
      // Pull events branch
      execSync('git fetch origin events/pending:events/pending', { 
        cwd: this.repoPath 
      });
      execSync('git checkout events/pending -- .events/', { 
        cwd: this.repoPath 
      });
    } catch (error) {
      // No events branch yet
    }
  }

  async processEvent(eventFile) {
    const event = JSON.parse(fs.readFileSync(eventFile, 'utf8'));
    console.log(`Processing ${event.type} event for #${event.number}`);

    try {
      // Process based on event type
      switch (event.type) {
        case 'issue':
          await this.handleIssueEvent(event);
          break;
        case 'comment':
          await this.handleCommentEvent(event);
          break;
        case 'pr':
          await this.handlePREvent(event);
          break;
      }

      // Mark as processed
      fs.renameSync(eventFile, eventFile.replace('.json', '.processed'));
      
    } catch (error) {
      console.error('Error processing event:', error);
      fs.renameSync(eventFile, eventFile.replace('.json', '.failed'));
    }
  }

  async handleIssueEvent(event) {
    // Use Claude via MCP to analyze the issue
    const analysis = await this.analyzeWithClaude(event);
    
    // Use gh CLI to update the issue
    execSync(`gh issue comment ${event.number} --body "${analysis.response}"`, {
      cwd: this.repoPath
    });

    // Apply labels if suggested
    if (analysis.labels) {
      execSync(`gh issue edit ${event.number} --add-label "${analysis.labels.join(',')}"`, {
        cwd: this.repoPath
      });
    }
  }

  async analyzeWithClaude(event) {
    // Use GitHub MCP through Claude
    const prompt = `
      Analyze this GitHub issue and provide a response:
      Title: ${event.title}
      Body: ${event.body}
      Labels: ${event.labels.map(l => l.name).join(', ')}
      
      Provide a helpful response and suggest any additional labels.
    `;

    // This would use Claude's MCP integration
    // For now, return a mock response
    return {
      response: "I've analyzed this issue. Here's my assessment...",
      labels: ['needs-investigation', 'ai-reviewed']
    };
  }
}

// Auto-start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  new EventProcessor().start();
}
```

### 3. GitHub MCP Integration (Through Claude)

**Claude can use the GitHub MCP to interact with issues:**

```javascript
// This runs within Claude's context when processing
async function respondToIssue(issueNumber, analysis) {
  // Claude uses its GitHub MCP integration
  await mcp.github.issues.createComment({
    issue_number: issueNumber,
    body: analysis
  });
  
  await mcp.github.issues.update({
    issue_number: issueNumber,
    labels: ['ai-processed']
  });
}
```

### 4. Alternative: Repository Dispatch Events

**For more immediate notifications:**

```yaml
name: Dispatch Event
on:
  issues:
    types: [opened]

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Repository Dispatch
        uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            await github.rest.repos.createDispatchEvent({
              owner: context.repo.owner,
              repo: context.repo.repo,
              event_type: 'issue-opened',
              client_payload: {
                issue: context.payload.issue
              }
            });
```

## Event Flow

1. **GitHub Event** → Triggers GitHub Action
2. **GitHub Action** → Creates event file in `.events/` directory
3. **Git Push** → Pushes to `events/pending` branch
4. **Local Git Pull** → Automated or manual pull of events branch
5. **File Watcher** → Detects new event files
6. **Event Processor** → Processes event with Claude
7. **gh CLI / MCP** → Updates issue/PR with response

## Setup Instructions

### 1. Configure GitHub Repository

```bash
# Create events branch
git checkout -b events/pending
git push origin events/pending

# Set up GitHub Actions
cp workflows/*.yml .github/workflows/
git add .github/workflows/
git commit -m "Add event broadcast workflows"
git push
```

### 2. Set Up Local Environment

```bash
# Install dependencies
npm install fs-watch

# Configure environment
export REPO_PATH=/path/to/your/repo
export GITHUB_TOKEN=your-pat-token

# Start event processor
node local-event-processor.js
```

### 3. Configure Auto-Pull (Optional)

```bash
# Add to crontab for automatic pulls
*/1 * * * * cd /path/to/repo && git pull origin events/pending
```

Or use a Git hook:

```bash
# .git/hooks/post-commit
#!/bin/sh
git pull origin events/pending --no-edit
```

## Advantages

1. **True Event-Driven**: No polling loops
2. **Immediate Response**: File watchers react instantly
3. **Works Offline**: Events queue up until connection restored
4. **Simple GitHub Actions**: Minimal workflows that just broadcast
5. **Local Control**: All processing happens where Claude is available

## Alternative Approaches

### 1. Using GitHub CLI Watch

```bash
# Watch for new issues
gh issue list --state open --json number,title,body --watch
```

### 2. Using Webhooks to Local Tunnel

```bash
# Use ngrok or similar to expose local endpoint
ngrok http 3000

# Configure GitHub webhook to ngrok URL
```

### 3. Using GitHub API Streaming

```javascript
// Use GitHub API's event stream
const eventSource = new EventSource('https://api.github.com/events');
eventSource.onmessage = (event) => {
  processEvent(JSON.parse(event.data));
};
```

## Migration from Polling

1. **Week 1**: Set up event broadcast workflows
2. **Week 2**: Deploy local event processor  
3. **Week 3**: Test with subset of events
4. **Week 4**: Full cutover
5. **Week 5**: Remove polling code

This architecture achieves true event-driven processing without any polling, using GitHub Actions purely as event broadcasters while keeping all intelligence in the local environment where Claude is available.
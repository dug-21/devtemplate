# GitHub Actions Event Handling Limitations

## Overview

While GitHub Actions is powerful for CI/CD, it has significant limitations for general event-driven architectures compared to direct webhook handlers.

## Key Limitations

### 1. Event Source Restrictions

**GitHub Actions can ONLY respond to:**
- Events within the repository where the workflow exists
- Events from authorized forks (with restrictions)
- Manual dispatches via API

**GitHub Actions CANNOT:**
- Receive webhooks from external services
- Process events from multiple repositories in one workflow
- Handle custom event types not defined by GitHub

### 2. Execution Constraints

```yaml
# Maximum limits in GitHub Actions
job:
  timeout-minutes: 360  # 6 hours max
workflow:
  timeout-minutes: 4320 # 72 hours max
api-calls:
  per-hour: 1000       # Rate limited
concurrent-jobs:
  free-tier: 20        # Parallel job limit
  paid-tier: 180-500   # Depends on plan
```

### 3. Private Repository Limitations

| Feature | Free | Pro | Team | Enterprise |
|---------|------|-----|------|------------|
| Minutes/month | 2,000 | 3,000 | 3,000 | 50,000 |
| Concurrent jobs | 20 | 40 | 60 | 180+ |
| Log retention | 90 days | 90 days | 90 days | 400 days |
| Artifact retention | 90 days | 90 days | 90 days | 400 days |

### 4. Event Filtering Limitations

GitHub Actions has basic event filtering:
```yaml
on:
  issues:
    types: [opened, edited]
  pull_request:
    types: [opened, synchronize]
    paths:
      - '**.js'
```

But CANNOT:
- Filter by issue labels dynamically
- Filter by comment content patterns
- Combine complex conditions
- Access previous event state

### 5. Workflow Dispatch Limitations

```yaml
on:
  workflow_dispatch:
    inputs:
      # Limited to 10 inputs
      # Only string, choice, boolean types
      # No complex objects
      # No file uploads
      # 1KB max per input
```

## Webhook Handler Advantages

### 1. Unrestricted Event Sources
```javascript
// Can receive events from anywhere
app.post('/webhook', (req, res) => {
  const source = req.headers['x-webhook-source'];
  
  switch(source) {
    case 'github':
      handleGitHub(req.body);
      break;
    case 'slack':
      handleSlack(req.body);
      break;
    case 'custom':
      handleCustom(req.body);
      break;
  }
});
```

### 2. Complex Event Processing
```javascript
// Full programmatic control
async function processEvent(event) {
  // Access external databases
  const userPrefs = await db.getUserPreferences(event.user.id);
  
  // Complex business logic
  if (shouldProcess(event, userPrefs)) {
    // Multiple repository operations
    await processAcrossRepos(event);
    
    // External integrations
    await notifyExternalSystems(event);
  }
}
```

### 3. Performance Characteristics

| Aspect | GitHub Actions | Direct Webhooks |
|--------|----------------|-----------------|
| Cold start | 10-30 seconds | 0-100ms (serverless) |
| Warm performance | 1-5 seconds | 10-50ms |
| Scaling | Limited by plan | Unlimited |
| Cost model | Per-minute | Per-execution |
| Resource limits | Fixed | Configurable |

## When to Use Each

### Use GitHub Actions for Events When:
- Building CI/CD pipelines
- Automation stays within single repository
- Using GitHub's runners is advantageous
- Team already uses Actions
- Simple event -> action mappings

### Use Direct Webhooks When:
- Need sub-second response times
- Processing events from multiple sources
- Complex business logic required
- External system integration needed
- Cost optimization important
- Scaling beyond GitHub's limits

## Specific Examples

### Example 1: Issue Auto-Response

**GitHub Actions Approach:**
```yaml
name: Auto-respond to issues
on:
  issues:
    types: [opened]
jobs:
  respond:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: 'Thanks for opening this issue!'
            })
```

**Limitations:**
- 10-30 second delay before response
- Consumes workflow minutes
- Only works in this repository

**Webhook Approach:**
```javascript
app.post('/webhook/github', async (req, res) => {
  if (req.headers['x-github-event'] === 'issues' && 
      req.body.action === 'opened') {
    
    // Immediate response
    await octokit.issues.createComment({
      owner: req.body.repository.owner.login,
      repo: req.body.repository.name,
      issue_number: req.body.issue.number,
      body: await generateResponse(req.body.issue)
    });
  }
  
  res.status(200).send('OK');
});
```

**Advantages:**
- <1 second response time
- No workflow minutes consumed
- Can handle multiple repositories
- Can integrate with AI for dynamic responses

### Example 2: Cross-Repository Operations

**GitHub Actions Limitation:**
Cannot easily coordinate across repositories

**Webhook Solution:**
```javascript
async function handlePRMerged(payload) {
  const { repository, pull_request } = payload;
  
  // Update documentation repo
  await updateDocsRepo(repository.name, pull_request);
  
  // Update deployment repo
  await triggerDeployment(repository.name, pull_request);
  
  // Update metrics database
  await recordMetrics(repository.name, pull_request);
  
  // Notify external systems
  await notifySlack(repository.name, pull_request);
}
```

## Conclusion

GitHub Actions excels at CI/CD but has fundamental limitations for general event-driven architectures:

1. **Limited to repository scope** - Cannot handle multi-repo or external events
2. **Performance overhead** - 10-30 second cold starts unacceptable for user-facing features  
3. **Cost model** - Per-minute billing expensive for high-volume events
4. **Flexibility constraints** - YAML configuration limits complex logic

For true event-driven architectures handling GitHub events, direct webhook handlers are superior in every measurable way except initial setup complexity.
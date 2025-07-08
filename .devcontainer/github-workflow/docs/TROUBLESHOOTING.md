# GitHub Workflow Automation - Troubleshooting Guide

## Table of Contents

1. [Common Issues](#1-common-issues)
2. [Error Codes Reference](#2-error-codes-reference)
3. [Debugging Techniques](#3-debugging-techniques)
4. [Performance Issues](#4-performance-issues)
5. [Integration Problems](#5-integration-problems)
6. [Recovery Procedures](#6-recovery-procedures)
7. [Health Checks](#7-health-checks)
8. [Support Resources](#8-support-resources)

---

## 1. Common Issues

### 1.1 Workflow Not Triggering

**Symptoms:**
- New issues are created but automation doesn't start
- Comments with @mentions are ignored
- No activity in GitHub Actions tab

**Causes:**
- Incorrect workflow file syntax
- Missing or invalid Bot PAT token
- Workflow disabled in repository settings
- Label filtering preventing execution

**Solutions:**

1. **Verify workflow syntax:**
   ```bash
   # Check workflow syntax
   gh workflow view issue-automation.yml
   
   # List all workflows
   gh workflow list
   
   # Check workflow status
   gh workflow view issue-automation.yml --ref main
   ```

2. **Validate Bot PAT token:**
   ```bash
   # Test token permissions
   gh auth status
   
   # Check specific permissions
   gh api user --header "Authorization: token $BOT_PAT"
   ```

3. **Enable workflow:**
   ```bash
   # Enable specific workflow
   gh workflow enable issue-automation.yml
   
   # Check repository settings
   gh api repos/:owner/:repo/actions/permissions
   ```

### 1.2 MCP Server Connection Issues

**Symptoms:**
- "MCP server not found" errors
- ruv-swarm commands failing
- Claude CLI not responding to MCP commands

**Causes:**
- MCP server not running
- Configuration file missing or invalid
- Port conflicts
- Environment variables not set

**Solutions:**

1. **Check MCP server status:**
   ```bash
   # List configured MCP servers
   claude mcp list
   
   # Check if ruv-swarm is running
   ps aux | grep ruv-swarm
   
   # Check port availability
   lsof -i :3000  # Default ruv-swarm port
   ```

2. **Restart MCP server:**
   ```bash
   # Kill existing processes
   pkill -f ruv-swarm
   
   # Start fresh
   cd .devcontainer/github-workflow
   ./start-services.sh
   ```

3. **Verify configuration:**
   ```bash
   # Check MCP config file
   cat ~/.config/claude/mcp_settings.json
   
   # Validate JSON syntax
   jq . ~/.config/claude/mcp_settings.json
   ```

### 1.3 Label Management Problems

**Symptoms:**
- Labels not being applied automatically
- Wrong labels on issues
- Label-based filtering not working

**Causes:**
- Insufficient permissions
- Label doesn't exist in repository
- Race conditions with multiple workflows

**Solutions:**

1. **Create missing labels:**
   ```bash
   # List existing labels
   gh label list
   
   # Create required labels
   gh label create "in-progress" --color "0052CC" --description "Issue being processed"
   gh label create "swarm-active" --color "FBCA04" --description "AI processing active"
   gh label create "swarm-processed" --color "0E8A16" --description "Processing complete"
   ```

2. **Fix permission issues:**
   ```bash
   # Check bot permissions
   gh api repos/:owner/:repo/collaborators/:bot_username/permission
   
   # Grant write access if needed
   gh api -X PUT repos/:owner/:repo/collaborators/:bot_username \
     --field permission=write
   ```

---

## 2. Error Codes Reference

### GitHub API Errors

| Error Code | Meaning | Fix |
|------------|---------|-----|
| 401 | Unauthorized | Check Bot PAT token validity and permissions |
| 403 | Forbidden | Verify repository permissions for bot account |
| 404 | Not Found | Check repository name, issue number, or API endpoint |
| 422 | Validation Failed | Review request payload, often missing required fields |
| 429 | Rate Limited | Implement backoff strategy, check rate limit status |
| 502 | Bad Gateway | GitHub server issue, retry with exponential backoff |

**Check rate limits:**
```bash
# Check current rate limit status
gh api rate_limit

# Check specific API endpoint limits
gh api -H "Accept: application/vnd.github.v3+json" /rate_limit
```

### Workflow Execution Errors

| Error Pattern | Meaning | Fix |
|---------------|---------|-----|
| `Error: .github#L1` | Workflow syntax error | Validate YAML syntax |
| `Error: Resource not accessible by integration` | Permission issue | Check token scopes |
| `Error: Workflow does not exist` | Missing workflow file | Ensure file is in correct location |
| `Error: The process '/usr/bin/git' failed with exit code 128` | Git authentication issue | Configure git credentials |

### MCP/Claude Errors

| Error Pattern | Meaning | Fix |
|---------------|---------|-----|
| `ECONNREFUSED` | MCP server not running | Start MCP services |
| `ETIMEDOUT` | Connection timeout | Check network/firewall settings |
| `Invalid MCP response` | Protocol mismatch | Update MCP server/client versions |
| `Agent spawn failed` | Resource limits | Check system resources |

---

## 3. Debugging Techniques

### 3.1 Enable Debug Logging

**GitHub Actions Debug Mode:**
```yaml
# In workflow file
env:
  ACTIONS_RUNNER_DEBUG: true
  ACTIONS_STEP_DEBUG: true
```

**Or via repository secrets:**
```bash
# Add debug secrets
gh secret set ACTIONS_RUNNER_DEBUG --body "true"
gh secret set ACTIONS_STEP_DEBUG --body "true"
```

### 3.2 Local Testing

**Test workflow locally with act:**
```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run specific workflow
act -W .github/workflows/issue-automation.yml \
    --secret-file .env.local \
    --env-file .env.test

# Run with specific event
act issues -e test-events/issue-opened.json
```

**Create test event file:**
```json
// test-events/issue-opened.json
{
  "action": "opened",
  "issue": {
    "number": 1,
    "title": "Test Issue",
    "body": "Test issue body",
    "user": {
      "login": "testuser",
      "type": "User"
    },
    "labels": []
  }
}
```

### 3.3 Workflow Logs Analysis

**Download workflow logs:**
```bash
# List recent workflow runs
gh run list --workflow=issue-automation.yml

# Download logs for specific run
gh run download <run-id>

# View logs in terminal
gh run view <run-id> --log
```

**Parse logs for errors:**
```bash
# Find all errors in logs
gh run view <run-id> --log | grep -i "error\|fail\|exception"

# Extract timestamps and errors
gh run view <run-id> --log | awk '/[0-9]{4}-[0-9]{2}-[0-9]{2}.*error/i'
```

### 3.4 MCP Server Debugging

**Enable verbose logging:**
```bash
# Start with debug logging
RUV_SWARM_DEBUG=true ./start-services.sh

# Monitor MCP server logs
tail -f logs/ruv-swarm.log

# Check Claude CLI debug output
CLAUDE_DEBUG=true claude mcp list
```

---

## 4. Performance Issues

### 4.1 Slow Processing

**Symptoms:**
- Issues taking >5 minutes to start processing
- Timeouts in workflow execution
- Delayed responses to comments

**Diagnosis:**
```bash
# Check workflow execution time
gh run list --workflow=issue-automation.yml --json databaseId,status,conclusion,createdAt,updatedAt \
  | jq '.[] | {id: .databaseId, duration: (.updatedAt - .createdAt)}'

# Monitor API rate limits
watch -n 60 'gh api rate_limit | jq .rate'

# Check system resources
docker stats  # If using containers
htop         # System resources
```

**Solutions:**

1. **Optimize API calls:**
   ```javascript
   // Use conditional requests with ETags
   const response = await octokit.issues.get({
     owner,
     repo,
     issue_number,
     headers: {
       'If-None-Match': lastEtag
     }
   });
   ```

2. **Implement caching:**
   ```bash
   # Cache dependencies in workflows
   - uses: actions/cache@v3
     with:
       path: ~/.npm
       key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
   ```

### 4.2 Timeout Issues

**Common timeout points:**
- GitHub Actions (6 hours max per job)
- API requests (60 seconds default)
- MCP operations (varies by operation)

**Solutions:**

1. **Increase timeouts appropriately:**
   ```yaml
   # In workflow
   jobs:
     process:
       timeout-minutes: 30  # Increase from default
   ```

2. **Implement progress reporting:**
   ```javascript
   // Report progress to prevent timeout
   setInterval(() => {
     core.info(`Still processing... ${processedItems}/${totalItems}`);
   }, 30000);
   ```

### 4.3 Rate Limit Management

**Monitor rate limits:**
```bash
# Create rate limit monitoring script
cat > check-rate-limits.sh << 'EOF'
#!/bin/bash
while true; do
  echo "=== GitHub API Rate Limits - $(date) ==="
  gh api rate_limit | jq '{
    core: .resources.core,
    search: .resources.search,
    graphql: .resources.graphql
  }'
  sleep 300  # Check every 5 minutes
done
EOF

chmod +x check-rate-limits.sh
./check-rate-limits.sh
```

**Implement backoff strategy:**
```javascript
async function githubApiCall(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) {
        const retryAfter = error.headers['retry-after'] || 60;
        console.log(`Rate limited. Waiting ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      } else if (i === maxRetries - 1) {
        throw error;
      } else {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
}
```

---

## 5. Integration Problems

### 5.1 Claude CLI Integration Issues

**Symptoms:**
- Claude commands failing
- "Command not found" errors
- Authentication failures

**Diagnosis:**
```bash
# Check Claude CLI installation
which claude
claude --version

# Test basic functionality
claude "Hello, are you working?"

# Check environment
env | grep CLAUDE
```

**Solutions:**

1. **Reinstall Claude CLI:**
   ```bash
   # Backup configuration
   cp -r ~/.config/claude ~/.config/claude.backup
   
   # Reinstall
   curl -fsSL https://raw.githubusercontent.com/anthropics/claude-cli/main/install.sh | sh
   
   # Restore configuration
   cp ~/.config/claude.backup/mcp_settings.json ~/.config/claude/
   ```

2. **Fix authentication:**
   ```bash
   # Re-authenticate
   claude auth login
   
   # Verify authentication
   claude auth status
   ```

### 5.2 RUV-Swarm Integration Problems

**Symptoms:**
- Agents not spawning
- Coordination failures
- MCP communication errors

**Diagnosis:**
```bash
# Check RUV-swarm process
ps aux | grep ruv-swarm

# Check logs
tail -f logs/ruv-swarm.log

# Test MCP connection
claude mcp call ruv-swarm get_agents
```

**Solutions:**

1. **Reset RUV-swarm:**
   ```bash
   # Stop all services
   ./stop-services.sh
   
   # Clear state
   rm -rf .devcontainer/github-workflow/issues/*/ruv-swarm-state.json
   
   # Restart
   ./start-services.sh
   ```

2. **Validate configuration:**
   ```bash
   # Check config syntax
   jq . config/ruv-swarm-config.json
   
   # Test configuration
   node -e "console.log(JSON.stringify(require('./config/ruv-swarm-config.json'), null, 2))"
   ```

### 5.3 GitHub API Integration

**Symptoms:**
- API calls failing intermittently
- Webhook events not received
- Permission errors on operations

**Solutions:**

1. **Verify webhook configuration:**
   ```bash
   # List webhooks
   gh api repos/:owner/:repo/hooks
   
   # Test webhook
   gh api repos/:owner/:repo/hooks/:hook_id/test
   ```

2. **Update Bot PAT permissions:**
   ```bash
   # Required scopes:
   # - repo (full control)
   # - workflow (update workflows)
   # - write:packages (if using packages)
   # - read:org (for organization repos)
   ```

---

## 6. Recovery Procedures

### 6.1 Stuck Issues Recovery

**Symptoms:**
- Issue has "in-progress" label but no activity
- Workflow appears frozen
- No updates for extended period

**Recovery steps:**

1. **Identify stuck issues:**
   ```bash
   # Find issues with old in-progress labels
   gh issue list --label "in-progress" --json number,title,updatedAt \
     | jq '.[] | select(.updatedAt < (now - 3600))'
   ```

2. **Manual intervention:**
   ```bash
   # Remove stuck labels
   gh issue edit <number> --remove-label "in-progress,swarm-active"
   
   # Add manual trigger comment
   gh issue comment <number> --body "@claude Please reprocess this issue"
   
   # Or trigger workflow manually
   gh workflow run manual-automation.yml \
     -f action=reprocess-issue \
     -f target=<issue-number>
   ```

### 6.2 Failed Workflow Recovery

**Identify failed workflows:**
```bash
# List failed runs
gh run list --workflow=issue-automation.yml --status=failure

# Get failure details
gh run view <run-id> --log | grep -A 10 -B 10 "Error:"
```

**Retry mechanisms:**
```bash
# Rerun failed workflow
gh run rerun <run-id>

# Rerun only failed jobs
gh run rerun <run-id> --failed
```

### 6.3 Data Recovery

**Backup critical data:**
```bash
# Create backup script
cat > backup-automation-data.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup issues data
gh issue list --state all --limit 1000 --json number,title,body,labels > "$BACKUP_DIR/issues.json"

# Backup configuration
cp -r config "$BACKUP_DIR/"
cp -r .devcontainer/github-workflow/issues "$BACKUP_DIR/"

# Create restore script
cat > "$BACKUP_DIR/restore.sh" << 'RESTORE'
#!/bin/bash
# Restore configuration
cp -r config/* ../../config/
# Restore issue data
cp -r issues/* ../../.devcontainer/github-workflow/issues/
RESTORE

chmod +x "$BACKUP_DIR/restore.sh"
echo "Backup created in $BACKUP_DIR"
EOF

chmod +x backup-automation-data.sh
```

---

## 7. Health Checks

### 7.1 System Diagnostics Script

**Create comprehensive health check:**
```bash
cat > system-health-check.sh << 'EOF'
#!/bin/bash

echo "=== GitHub Workflow Automation Health Check ==="
echo "Timestamp: $(date)"
echo

# Check GitHub connectivity
echo "1. GitHub API Status:"
if gh api rate_limit > /dev/null 2>&1; then
  echo "   ✓ GitHub API accessible"
  gh api rate_limit | jq '.rate | {limit, used, remaining, reset: (.reset | strftime("%Y-%m-%d %H:%M:%S"))}'
else
  echo "   ✗ GitHub API not accessible"
fi
echo

# Check workflows
echo "2. Workflow Status:"
for workflow in issue-automation.yml comment-automation.yml epic-phase-transition.yml; do
  if gh workflow view "$workflow" > /dev/null 2>&1; then
    echo "   ✓ $workflow exists"
    gh run list --workflow="$workflow" --limit=1 --json status,conclusion,createdAt \
      | jq -r '.[] | "     Last run: \(.status) - \(.conclusion // "running") at \(.createdAt)"'
  else
    echo "   ✗ $workflow missing"
  fi
done
echo

# Check MCP services
echo "3. MCP Services:"
if command -v claude > /dev/null 2>&1; then
  echo "   ✓ Claude CLI installed"
  if claude mcp list | grep -q "ruv-swarm"; then
    echo "   ✓ ruv-swarm configured"
  else
    echo "   ✗ ruv-swarm not configured"
  fi
else
  echo "   ✗ Claude CLI not installed"
fi
echo

# Check required secrets
echo "4. Required Secrets:"
for secret in BOT_PAT CLAUDE_API_KEY; do
  if gh secret list | grep -q "$secret"; then
    echo "   ✓ $secret configured"
  else
    echo "   ✗ $secret missing"
  fi
done
echo

# Check labels
echo "5. Required Labels:"
for label in in-progress swarm-active swarm-processed; do
  if gh label list | grep -q "$label"; then
    echo "   ✓ $label exists"
  else
    echo "   ✗ $label missing"
  fi
done
echo

# System resources
echo "6. System Resources:"
echo "   CPU Load: $(uptime | awk -F'load average:' '{print $2}')"
echo "   Memory: $(free -h | awk '/^Mem:/ {print "Used: " $3 " / Total: " $2}')"
echo "   Disk: $(df -h . | awk 'NR==2 {print "Used: " $3 " / Total: " $2 " (" $5 " full)"}')"
echo

echo "=== Health Check Complete ==="
EOF

chmod +x system-health-check.sh
```

### 7.2 Continuous Monitoring

**Setup monitoring cron job:**
```bash
# Add to crontab
(crontab -l 2>/dev/null; echo "*/15 * * * * /path/to/system-health-check.sh >> /path/to/logs/health-check.log 2>&1") | crontab -
```

**Create alerting script:**
```bash
cat > monitor-alerts.sh << 'EOF'
#!/bin/bash

# Run health check
./system-health-check.sh > health-check-output.txt

# Check for failures
if grep -q "✗" health-check-output.txt; then
  # Create GitHub issue for failures
  FAILURES=$(grep "✗" health-check-output.txt)
  gh issue create \
    --title "System Health Check Failures Detected" \
    --body "The following health check failures were detected:

\`\`\`
$FAILURES
\`\`\`

Full health check output:
\`\`\`
$(cat health-check-output.txt)
\`\`\`" \
    --label "bug,automation"
fi
EOF

chmod +x monitor-alerts.sh
```

### 7.3 Performance Metrics

**Create metrics collection script:**
```bash
cat > collect-metrics.sh << 'EOF'
#!/bin/bash

METRICS_FILE="metrics/$(date +%Y%m%d).json"
mkdir -p metrics

# Collect workflow metrics
WORKFLOW_METRICS=$(gh run list --limit=100 --json workflowName,status,conclusion,createdAt,updatedAt \
  | jq '[.[] | {
    workflow: .workflowName,
    status: .status,
    conclusion: .conclusion,
    duration: ((.updatedAt | fromdate) - (.createdAt | fromdate))
  }] | group_by(.workflow) | map({
    workflow: .[0].workflow,
    total: length,
    success: [.[] | select(.conclusion == "success")] | length,
    failure: [.[] | select(.conclusion == "failure")] | length,
    avg_duration: ([.[] | .duration] | add / length)
  })')

# Collect API metrics
API_METRICS=$(gh api rate_limit | jq '{
  timestamp: now | strftime("%Y-%m-%d %H:%M:%S"),
  core: .resources.core,
  search: .resources.search,
  graphql: .resources.graphql
}')

# Combine metrics
jq -n --argjson workflow "$WORKFLOW_METRICS" --argjson api "$API_METRICS" '{
  timestamp: ($api.timestamp),
  workflows: $workflow,
  api_limits: $api
}' >> "$METRICS_FILE"

echo "Metrics collected in $METRICS_FILE"
EOF

chmod +x collect-metrics.sh
```

---

## 8. Support Resources

### 8.1 Log Collection for Support

**Automated log collection script:**
```bash
cat > collect-support-logs.sh << 'EOF'
#!/bin/bash

SUPPORT_DIR="support-logs-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$SUPPORT_DIR"

echo "Collecting support logs..."

# System information
echo "=== System Information ===" > "$SUPPORT_DIR/system-info.txt"
uname -a >> "$SUPPORT_DIR/system-info.txt"
echo -e "\n=== Environment Variables ===" >> "$SUPPORT_DIR/system-info.txt"
env | grep -E "(GITHUB|CLAUDE|MCP|PATH)" | sort >> "$SUPPORT_DIR/system-info.txt"

# GitHub configuration
echo "=== GitHub Configuration ===" > "$SUPPORT_DIR/github-config.txt"
gh auth status >> "$SUPPORT_DIR/github-config.txt" 2>&1
echo -e "\n=== Repository Settings ===" >> "$SUPPORT_DIR/github-config.txt"
gh api repos/:owner/:repo | jq '{
  name, full_name, private, 
  permissions: .permissions,
  has_issues: .has_issues,
  has_projects: .has_projects,
  has_wiki: .has_wiki
}' >> "$SUPPORT_DIR/github-config.txt" 2>&1

# Recent workflow runs
echo "Collecting workflow logs..."
gh run list --limit=10 --json databaseId,displayTitle,status,conclusion,createdAt \
  > "$SUPPORT_DIR/recent-workflows.json"

# Collect last failed workflow log
LAST_FAILED=$(gh run list --status=failure --limit=1 --json databaseId -q '.[0].databaseId')
if [ -n "$LAST_FAILED" ]; then
  gh run view "$LAST_FAILED" --log > "$SUPPORT_DIR/last-failed-workflow.log" 2>&1
fi

# MCP/Claude logs
if [ -f ~/.config/claude/mcp_settings.json ]; then
  cp ~/.config/claude/mcp_settings.json "$SUPPORT_DIR/mcp-config.json"
fi

# Application logs
if [ -d logs ]; then
  cp -r logs "$SUPPORT_DIR/"
fi

# Health check
./system-health-check.sh > "$SUPPORT_DIR/health-check.txt" 2>&1

# Create archive
tar -czf "$SUPPORT_DIR.tar.gz" "$SUPPORT_DIR"
rm -rf "$SUPPORT_DIR"

echo "Support logs collected in $SUPPORT_DIR.tar.gz"
echo "Please attach this file when requesting support."
EOF

chmod +x collect-support-logs.sh
```

### 8.2 Contact Information

**Primary Support Channels:**

1. **GitHub Issues:**
   - Create issue in repository with `bug` or `help-wanted` label
   - Include output from `collect-support-logs.sh`
   - Describe steps to reproduce

2. **Emergency Contacts:**
   - System Administrator: (configured in repository secrets)
   - On-call Developer: (rotation schedule in wiki)

3. **Documentation:**
   - Setup Guide: `/docs/SETUP.md`
   - Architecture: `/docs/ARCHITECTURE.md`
   - API Reference: `/docs/API.md`

### 8.3 Escalation Procedures

**Level 1 - Self-Service:**
1. Run `system-health-check.sh`
2. Check this troubleshooting guide
3. Review recent workflow logs

**Level 2 - Team Support:**
1. Create GitHub issue with details
2. Run `collect-support-logs.sh`
3. Tag team members for review

**Level 3 - Critical Issues:**
1. Page on-call developer
2. Create P0 issue with `critical` label
3. Initiate emergency response procedure

**Emergency Response Checklist:**
- [ ] Stop affected workflows
- [ ] Notify stakeholders
- [ ] Collect diagnostic data
- [ ] Implement temporary workaround
- [ ] Document root cause
- [ ] Create permanent fix
- [ ] Update runbooks

---

## Quick Reference Card

```bash
# Most common fixes
gh workflow enable issue-automation.yml          # Enable workflow
./start-services.sh                              # Restart MCP services
gh issue edit <num> --remove-label "in-progress" # Unstick issue
gh run rerun <run-id> --failed                   # Retry failed jobs
./system-health-check.sh                         # Check system health
./collect-support-logs.sh                        # Gather support data

# Debug commands
export ACTIONS_RUNNER_DEBUG=true                 # Enable GitHub Actions debug
export CLAUDE_DEBUG=true                         # Enable Claude debug
tail -f logs/ruv-swarm.log                      # Monitor RUV-swarm logs
gh run view <run-id> --log | grep -i error      # Find workflow errors
```

---

*Last Updated: January 2025*
*Version: 1.0*
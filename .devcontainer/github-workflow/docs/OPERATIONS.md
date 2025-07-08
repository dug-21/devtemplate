# GitHub Workflow System - Operations Manual

## Table of Contents
1. [Daily Operations](#1-daily-operations)
2. [Issue Processing Workflow](#2-issue-processing-workflow)
3. [EPIC Management](#3-epic-management)
4. [@Mention Handling](#4-mention-handling)
5. [Manual Interventions](#5-manual-interventions)
6. [Monitoring & Metrics](#6-monitoring-metrics)
7. [Maintenance Tasks](#7-maintenance-tasks)
8. [Backup & Recovery](#8-backup-recovery)
9. [Performance Optimization](#9-performance-optimization)

## 1. Daily Operations

### Morning Checks (Start of Day)

#### System Health Verification
```bash
# Check service status
systemctl status github-workflow.service
docker ps | grep github-workflow
curl http://localhost:3000/health

# Check MCP server health
curl http://localhost:8080/mcp/health

# Review overnight logs
tail -n 1000 /workspaces/devtemplate/.devcontainer/github-workflow/logs/monitor-v3.log | grep ERROR
```

#### Active Issues Review
```bash
# Check processed issues status
cat .processed-issues.json | jq '.'

# List in-progress issues
ls -la issues/ | grep -E "issue-[0-9]+" 

# Check for stuck issues (older than 24 hours)
find issues/ -name "metadata.json" -mtime +1 -exec dirname {} \; | while read dir; do
  echo "Potentially stuck: $dir"
  cat "$dir/metadata.json" | jq '.status'
done
```

#### Swarm Status Check
```bash
# Check ruv-swarm status
./ruv-swarm status

# Check MCP tools connectivity
tail -n 100 logs/mcp-tools.log | grep -E "(connected|disconnected|error)"

# Monitor active agents
ps aux | grep -E "(claude|ruv-swarm|mcp)" | grep -v grep
```

### Hourly Monitoring

#### Performance Metrics
```bash
# Check API rate limits
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit | jq '.rate'

# Monitor memory usage
ps aux | grep -E "(monitor-enhanced|webhook-server)" | awk '{print $2, $4, $11}'

# Check response times
grep "Processing time:" logs/monitor-v3.log | tail -20
```

#### Queue Status
```bash
# Check event queue
grep "Queue size:" logs/monitor-v3.log | tail -10

# Look for processing delays
grep -E "(delayed|timeout|slow)" logs/monitor-v3.log | tail -20
```

### End of Day Procedures

#### Daily Summary
```bash
# Generate daily report
echo "=== Daily Summary $(date) ===" > daily-report.txt
echo "Issues Processed:" >> daily-report.txt
find issues/ -name "metadata.json" -mtime -1 | wc -l >> daily-report.txt

echo "Errors Encountered:" >> daily-report.txt
grep ERROR logs/monitor-v3.log | grep "$(date +%Y-%m-%d)" | wc -l >> daily-report.txt

echo "MCP Disconnections:" >> daily-report.txt
grep "MCP disconnected" logs/mcp-tools.log | grep "$(date +%Y-%m-%d)" | wc -l >> daily-report.txt
```

#### Cleanup Tasks
```bash
# Clean temporary files
find tmp/ -type f -mtime +1 -delete

# Archive old logs
tar -czf "logs/archive/logs-$(date +%Y%m%d).tar.gz" logs/*.log
truncate -s 0 logs/monitor-v3.log
```

## 2. Issue Processing Workflow

### Issue Lifecycle

#### 1. Detection Phase
- System polls GitHub API every 30 seconds (configurable)
- New issues are detected and added to processing queue
- Duplicate check performed using issue number + repository

#### 2. Initial Processing
```bash
# Monitor issue detection
tail -f logs/monitor-v3.log | grep "New issue detected"

# Check if issue is being processed
ls issues/issue-{NUMBER}/metadata.json
```

#### 3. Label Management
Labels are automatically applied throughout the lifecycle:
- `ai-processing` - Issue is being processed by Claude
- `in-progress` - Active work ongoing
- `completed` - Processing finished successfully
- `error` - Processing failed
- `needs-human` - Requires manual intervention
- `epic` - Multi-phase EPIC issue

#### 4. Processing States
Monitor issue state transitions:
```bash
# Check current state
cat issues/issue-123/metadata.json | jq '.status'

# View state history
grep "State change" issues/issue-123/execution.log
```

### Troubleshooting Issue Processing

#### Issue Stuck in Processing
```bash
# 1. Check issue metadata
cat issues/issue-{NUMBER}/metadata.json

# 2. Review execution log
tail -100 issues/issue-{NUMBER}/execution.log

# 3. Check for Claude API errors
grep -i "claude" issues/issue-{NUMBER}/execution.log | grep -i error

# 4. Manually retry processing
node process-issue.js --issue {NUMBER} --repo {OWNER/REPO}
```

#### Missing Issue Directory
```bash
# Recreate issue structure
mkdir -p issues/issue-{NUMBER}
echo '{"status": "pending", "created": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > issues/issue-{NUMBER}/metadata.json

# Trigger reprocessing
touch .reprocess-issue-{NUMBER}
```

## 3. EPIC Management

### 8-Phase EPIC Workflow

EPICs follow a structured 8-phase lifecycle:

1. **Inception** - Initial idea and feasibility assessment
2. **Discovery** - Requirements gathering and analysis
3. **Design** - Solution design and mockups
4. **Architecture** - Technical architecture definition
5. **Implementation** - Code development
6. **Testing** - Quality assurance and validation
7. **Deployment** - Release to production
8. **Operations** - Handoff and maintenance

### Phase Transition Management

#### Checking Current Phase
```bash
# Extract phase from issue
grep "Current Phase:" issues/issue-{NUMBER}/SUMMARY.md

# Check phase requirements
node -e "
const pm = require('./library/phase-manager.js');
console.log(pm.getPhaseRequirements('design'));
"
```

#### Manual Phase Transition
```bash
# Update phase via GitHub Actions
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/{OWNER}/{REPO}/dispatches \
  -d '{
    "event_type": "phase-transition",
    "client_payload": {
      "issue_number": 123,
      "target_phase": "implementation"
    }
  }'
```

### EPIC Tracking Dashboard

Create a simple tracking script:
```bash
#!/bin/bash
# epic-dashboard.sh
echo "=== EPIC Status Dashboard ==="
for issue in issues/issue-*/metadata.json; do
  if grep -q '"epic": true' "$issue"; then
    dir=$(dirname "$issue")
    number=$(basename "$dir" | sed 's/issue-//')
    phase=$(grep "Current Phase:" "$dir/SUMMARY.md" 2>/dev/null | cut -d: -f2 | xargs)
    echo "Issue #$number - Phase: ${phase:-unknown}"
  fi
done
```

## 4. @Mention Handling

### Mention Types and Processing

#### @claude Mentions
- Triggers AI-powered response
- Processes natural language requests
- Can generate code, documentation, or analysis

```bash
# Monitor @claude mentions
grep "@claude" logs/monitor-v3.log | tail -20

# Check Claude API usage
grep "Claude API call" logs/monitor-v3.log | wc -l
```

#### @swarm Mentions
- Activates swarm intelligence mode
- Coordinates multiple AI agents
- Used for complex, multi-faceted tasks

```bash
# Monitor swarm activations
grep "@swarm" logs/monitor-v3.log | tail -20

# Check active swarm processes
ps aux | grep "ruv-swarm" | grep -v grep
```

#### @ai Mentions
- Generic AI assistance request
- Routes to appropriate AI service
- Fallback for when specific mention unclear

### Mention Processing Errors

```bash
# Check for failed mention processing
grep -E "(@claude|@swarm|@ai).*failed" logs/monitor-v3.log

# Retry failed mention
# 1. Find the comment ID
grep "Comment.*@claude" logs/monitor-v3.log | tail -1

# 2. Manually trigger processing
node process-comment.js --comment-id {ID} --repo {OWNER/REPO}
```

## 5. Manual Interventions

### Using Manual Automation Workflow

The manual automation workflow allows operators to trigger specific actions:

#### Triggering Manual Actions
```bash
# Via GitHub UI:
# 1. Go to Actions tab
# 2. Select "Manual Automation Workflow"
# 3. Click "Run workflow"
# 4. Fill in parameters

# Via CLI:
gh workflow run manual-automation.yml \
  -f action="reprocess" \
  -f issue_number="123" \
  -f repository="owner/repo"
```

#### Common Manual Interventions

##### 1. Reprocess Failed Issue
```bash
# Clear error state
rm issues/issue-{NUMBER}/.error

# Update metadata
jq '.status = "pending"' issues/issue-{NUMBER}/metadata.json > tmp.json && \
  mv tmp.json issues/issue-{NUMBER}/metadata.json

# Trigger reprocess
touch .reprocess-issue-{NUMBER}
```

##### 2. Force Phase Transition
```bash
# Update issue body with new phase
gh issue edit {NUMBER} --body "$(gh issue view {NUMBER} --json body -q .body | \
  sed 's/## Current Phase: .*/## Current Phase: implementation/')"
```

##### 3. Clear Stuck Queue
```bash
# Stop services
./stop-local.sh

# Clear queue files
rm -f .queue-* .processing-*

# Restart services
./start-local.sh
```

### Emergency Procedures

#### Service Hung/Unresponsive
```bash
# 1. Get process ID
ps aux | grep monitor-enhanced | grep -v grep | awk '{print $2}'

# 2. Send graceful shutdown
kill -TERM {PID}

# 3. Wait 30 seconds, then force kill if needed
sleep 30
kill -9 {PID}

# 4. Restart service
./start-monitor.sh
```

#### API Rate Limit Exceeded
```bash
# Check current limits
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit | jq '.'

# Pause processing
touch .pause-processing

# Resume when limits reset
rm .pause-processing
```

## 6. Monitoring & Metrics

### Key Metrics to Track

#### System Health Metrics
- **Uptime**: Service availability percentage
- **Response Time**: Average processing time per issue
- **Error Rate**: Errors per 1000 operations
- **Queue Length**: Pending items in processing queue

#### Business Metrics
- **Issues Processed**: Daily/weekly/monthly counts
- **Average Resolution Time**: Time from creation to completion
- **EPIC Progress**: Phases completed vs. total
- **AI Usage**: Claude API calls and costs

### Monitoring Commands

#### Real-time Monitoring
```bash
# Create monitoring dashboard
watch -n 5 '
echo "=== System Status ==="
echo "Services:"
ps aux | grep -E "(monitor|webhook)" | grep -v grep | wc -l
echo ""
echo "Queue:"
ls -1 .queue-* 2>/dev/null | wc -l
echo ""
echo "Recent Errors:"
grep ERROR logs/monitor-v3.log | tail -5
echo ""
echo "Processing Rate:"
grep "Processed issue" logs/monitor-v3.log | grep "$(date +%H:)" | wc -l
'
```

#### Metrics Collection Script
```bash
#!/bin/bash
# collect-metrics.sh
DATE=$(date +%Y-%m-%d)
HOUR=$(date +%H)

# Collect hourly metrics
echo "$DATE,$HOUR,issues_processed,$(find issues/ -name "metadata.json" -mmin -60 | wc -l)" >> metrics/hourly.csv
echo "$DATE,$HOUR,errors,$(grep ERROR logs/monitor-v3.log | grep "$(date +%Y-%m-%d\ %H:)" | wc -l)" >> metrics/hourly.csv
echo "$DATE,$HOUR,api_calls,$(grep "GitHub API call" logs/monitor-v3.log | grep "$(date +%Y-%m-%d\ %H:)" | wc -l)" >> metrics/hourly.csv
```

### Alerting Setup

#### Critical Alerts
```bash
# Check for critical conditions every 5 minutes
*/5 * * * * /path/to/check-critical.sh

# check-critical.sh
#!/bin/bash
# Service down
if ! pgrep -f monitor-enhanced > /dev/null; then
  echo "CRITICAL: Monitor service is down" | mail -s "GitHub Workflow Alert" ops@example.com
fi

# High error rate
ERROR_COUNT=$(grep ERROR logs/monitor-v3.log | grep "$(date +%Y-%m-%d\ %H:)" | wc -l)
if [ $ERROR_COUNT -gt 50 ]; then
  echo "CRITICAL: High error rate: $ERROR_COUNT errors in last hour" | mail -s "GitHub Workflow Alert" ops@example.com
fi
```

## 7. Maintenance Tasks

### Daily Maintenance

#### Log Rotation
```bash
# Rotate logs daily
logrotate -f /etc/logrotate.d/github-workflow

# Manual rotation
mv logs/monitor-v3.log logs/monitor-v3.log.$(date +%Y%m%d)
touch logs/monitor-v3.log
kill -USR1 $(pgrep -f monitor-enhanced)
```

#### Temporary File Cleanup
```bash
# Clean files older than 24 hours
find tmp/ -type f -mtime +1 -delete
find /tmp -name "prompt-*" -mtime +1 -delete

# Clean orphaned issue directories
for dir in issues/issue-*/; do
  if [ ! -f "$dir/metadata.json" ]; then
    echo "Orphaned directory: $dir"
    # rm -rf "$dir"  # Uncomment to delete
  fi
done
```

### Weekly Maintenance

#### Archive Completed Issues
```bash
# Archive issues completed more than 7 days ago
mkdir -p archive/$(date +%Y/%m)
find issues/ -name "metadata.json" -mtime +7 -exec grep -l '"status": "completed"' {} \; | while read meta; do
  dir=$(dirname "$meta")
  issue=$(basename "$dir")
  tar -czf "archive/$(date +%Y/%m)/$issue.tar.gz" "$dir"
  rm -rf "$dir"
done
```

#### Database Optimization
```bash
# Compact JSON state files
for file in .processed-issues.json .queue-state.json; do
  if [ -f "$file" ]; then
    jq -c '.' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  fi
done
```

### Monthly Maintenance

#### Dependency Updates
```bash
# Update Node.js dependencies
cd /workspaces/devtemplate/.devcontainer/github-workflow
npm update
npm audit fix

# Update GitHub Actions
gh extension upgrade --all
```

#### Performance Review
```bash
# Generate monthly performance report
echo "=== Monthly Performance Report ===" > monthly-report.txt
echo "Total Issues Processed: $(find archive/ issues/ -name "metadata.json" | wc -l)" >> monthly-report.txt
echo "Average Processing Time: $(grep "Processing time:" logs/monitor-v3.log.* | awk '{sum+=$3; count++} END {print sum/count " seconds"}')" >> monthly-report.txt
echo "Error Rate: $(grep ERROR logs/monitor-v3.log.* | wc -l) errors" >> monthly-report.txt
```

## 8. Backup & Recovery

### Backup Procedures

#### Daily Backups
```bash
#!/bin/bash
# daily-backup.sh
BACKUP_DIR="/backup/github-workflow/$(date +%Y/%m/%d)"
mkdir -p "$BACKUP_DIR"

# Backup configuration
cp config.json "$BACKUP_DIR/"
cp -r workflows/ "$BACKUP_DIR/"

# Backup state files
cp .processed-issues.json "$BACKUP_DIR/"
cp .queue-state.json "$BACKUP_DIR/" 2>/dev/null || true

# Backup active issues
tar -czf "$BACKUP_DIR/active-issues.tar.gz" issues/

# Backup logs
tar -czf "$BACKUP_DIR/logs.tar.gz" logs/

# Upload to remote storage
aws s3 sync "$BACKUP_DIR" "s3://backup-bucket/github-workflow/$(date +%Y/%m/%d)/"
```

#### Configuration Backup
```bash
# Version control for configuration
git add config.json workflows/
git commit -m "Configuration backup $(date +%Y-%m-%d)"
git push origin config-backup
```

### Recovery Procedures

#### Service Recovery
```bash
# 1. Stop all services
./stop-local.sh

# 2. Restore from backup
RESTORE_DATE="2024-01-15"
BACKUP_DIR="/backup/github-workflow/$RESTORE_DATE"

cp "$BACKUP_DIR/config.json" .
cp "$BACKUP_DIR/.processed-issues.json" .
tar -xzf "$BACKUP_DIR/active-issues.tar.gz"

# 3. Restart services
./start-local.sh
```

#### Disaster Recovery Plan

##### Complete System Failure
1. **Provision new environment**
   ```bash
   git clone https://github.com/org/github-workflow
   cd github-workflow
   npm install
   ```

2. **Restore configuration**
   ```bash
   aws s3 cp s3://backup-bucket/github-workflow/latest/config.json .
   ```

3. **Restore state**
   ```bash
   aws s3 cp s3://backup-bucket/github-workflow/latest/.processed-issues.json .
   aws s3 cp s3://backup-bucket/github-workflow/latest/active-issues.tar.gz .
   tar -xzf active-issues.tar.gz
   ```

4. **Verify and start**
   ```bash
   npm test
   ./start-local.sh
   ```

#### Data Recovery
```bash
# Recover deleted issue
ISSUE_NUMBER=123
BACKUP_DATE=$(date -d "yesterday" +%Y/%m/%d)
aws s3 cp "s3://backup-bucket/github-workflow/$BACKUP_DATE/active-issues.tar.gz" /tmp/
tar -xzf /tmp/active-issues.tar.gz "issues/issue-$ISSUE_NUMBER"
```

## 9. Performance Optimization

### System Tuning

#### API Rate Limit Optimization
```bash
# Adjust polling intervals based on activity
# config.json
{
  "polling": {
    "interval": 30,
    "backoff": {
      "enabled": true,
      "maxInterval": 300,
      "factor": 2
    }
  }
}
```

#### Memory Optimization
```bash
# Monitor memory usage
while true; do
  ps aux | grep monitor-enhanced | awk '{print strftime("%Y-%m-%d %H:%M:%S"), $2, $4"%", $6"KB"}'
  sleep 60
done > memory-usage.log

# Set memory limits
node --max-old-space-size=2048 monitor-enhanced.js
```

### Query Optimization

#### GitHub API Efficiency
```bash
# Use conditional requests
# Saves API calls by checking ETags
curl -H "Authorization: token $GITHUB_TOKEN" \
     -H "If-None-Match: \"$ETAG\"" \
     https://api.github.com/repos/owner/repo/issues
```

#### Batch Processing
```javascript
// Process multiple issues in parallel
const BATCH_SIZE = 5;
const promises = [];
for (let i = 0; i < issues.length; i += BATCH_SIZE) {
  const batch = issues.slice(i, i + BATCH_SIZE);
  promises.push(processBatch(batch));
}
await Promise.all(promises);
```

### Caching Strategies

#### In-Memory Caching
```bash
# Enable caching in config
{
  "cache": {
    "enabled": true,
    "ttl": 300,
    "maxSize": 1000
  }
}
```

#### File System Caching
```bash
# Clear old cache files
find .cache/ -type f -mtime +1 -delete

# Monitor cache hit rate
grep -E "(cache hit|cache miss)" logs/monitor-v3.log | \
  awk '{if ($0 ~ /hit/) hit++; else miss++} END {print "Hit rate:", hit/(hit+miss)*100"%"}'
```

### Performance Monitoring

#### Response Time Tracking
```bash
# Extract processing times
grep "Processing time:" logs/monitor-v3.log | \
  awk '{print $3}' | \
  awk '{sum+=$1; count++} END {
    print "Average:", sum/count, "seconds";
    print "Total processed:", count
  }'
```

#### Bottleneck Identification
```bash
# Find slow operations
grep -E "took [0-9]+ seconds" logs/monitor-v3.log | \
  awk '$3 > 10 {print}' | \
  sort -k3 -nr | \
  head -20
```

### Scaling Strategies

#### Horizontal Scaling
```bash
# Run multiple monitors for different repos
# monitor-repo1.sh
REPO_FILTER="owner/repo1" node monitor-enhanced.js &

# monitor-repo2.sh  
REPO_FILTER="owner/repo2" node monitor-enhanced.js &
```

#### Load Distribution
```bash
# Use round-robin for API tokens
TOKENS=("token1" "token2" "token3")
TOKEN_INDEX=$(($(date +%s) % ${#TOKENS[@]}))
export GITHUB_TOKEN=${TOKENS[$TOKEN_INDEX]}
```

## Appendix: Quick Reference

### Common Commands
```bash
# Start system
./start-local.sh

# Stop system
./stop-local.sh

# Check status
systemctl status github-workflow

# View logs
tail -f logs/monitor-v3.log

# Process specific issue
node process-issue.js --issue 123 --repo owner/repo

# Trigger manual workflow
gh workflow run manual-automation.yml -f issue_number=123

# Check health
curl http://localhost:3000/health

# View metrics
curl http://localhost:3000/metrics
```

### Emergency Contacts
- **System Admin**: ops@example.com
- **On-Call**: +1-555-0123
- **Escalation**: manager@example.com

### Useful Resources
- [System Architecture](./SYSTEM-ARCHITECTURE.md)
- [Features Guide](./FEATURES-AND-FUNCTIONS.md)
- [API Documentation](../library/README.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
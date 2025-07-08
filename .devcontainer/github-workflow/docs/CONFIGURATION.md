# GitHub Workflow Automation Configuration Reference

This document provides a comprehensive reference for all configuration options available in the GitHub Workflow Automation System. Each section includes descriptions, defaults, examples, and best practices.

## Table of Contents

1. [Environment Variables](#1-environment-variables)
2. [Workflow Configuration](#2-workflow-configuration)
3. [Label Configuration](#3-label-configuration)
4. [Phase Configuration](#4-phase-configuration)
5. [Template Configuration](#5-template-configuration)
6. [Integration Configuration](#6-integration-configuration)
7. [Security Configuration](#7-security-configuration)
8. [Advanced Configuration](#8-advanced-configuration)

---

## 1. Environment Variables

Environment variables control the core behavior of the automation system. These are typically set in GitHub Actions secrets or workflow files.

### Core Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `GITHUB_TOKEN` | GitHub authentication token | Required | `${{ secrets.GITHUB_TOKEN }}` |
| `BOT_PAT` | Bot Personal Access Token for automation | Required | `${{ secrets.BOT_PAT }}` |
| `CLAUDE_API_KEY` | Claude API key for AI processing | Required | `${{ secrets.CLAUDE_API_KEY }}` |
| `REPOSITORY_OWNER` | GitHub repository owner | Auto-detected | `myorg` |
| `REPOSITORY_NAME` | GitHub repository name | Auto-detected | `myrepo` |

### Processing Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PROCESSING_TIMEOUT` | Maximum processing time per issue (ms) | `600000` | `300000` |
| `RETRY_ATTEMPTS` | Number of retry attempts for failed operations | `3` | `5` |
| `RETRY_DELAY` | Initial retry delay (ms) | `1000` | `2000` |
| `CONCURRENT_AGENTS` | Max concurrent AI agents | `15` | `10` |
| `BATCH_SIZE` | Number of issues to process in parallel | `5` | `3` |

### Feature Flags

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `ENABLE_AUTO_CLOSE` | Auto-close completed issues | `true` | `false` |
| `ENABLE_PROGRESS_UPDATES` | Post progress updates to issues | `true` | `false` |
| `ENABLE_AI_PROCESSING` | Enable AI agent processing | `true` | `false` |
| `ENABLE_EPIC_PHASES` | Enable EPIC phase workflow | `true` | `false` |
| `DEBUG_MODE` | Enable debug logging | `false` | `true` |

### Example `.env` Configuration

```bash
# Authentication
GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}
BOT_PAT=${{ secrets.BOT_PAT }}
CLAUDE_API_KEY=${{ secrets.CLAUDE_API_KEY }}

# Processing
PROCESSING_TIMEOUT=300000
RETRY_ATTEMPTS=3
CONCURRENT_AGENTS=10

# Features
ENABLE_AUTO_CLOSE=true
ENABLE_PROGRESS_UPDATES=true
DEBUG_MODE=false
```

### Best Practices

1. **Never commit sensitive tokens** - Always use GitHub Secrets
2. **Use descriptive names** - Prefix custom variables with your project name
3. **Document custom variables** - Add comments explaining non-standard variables
4. **Validate required variables** - Check for required variables at startup
5. **Use sensible defaults** - Provide defaults for optional configuration

---

## 2. Workflow Configuration

GitHub Actions workflows define when and how automation is triggered.

### Workflow Triggers

#### Issue Events
```yaml
name: Issue Automation
on:
  issues:
    types: [opened, reopened, edited, labeled, unlabeled]
  issue_comment:
    types: [created]
```

#### Manual Triggers
```yaml
name: Manual Automation
on:
  workflow_dispatch:
    inputs:
      issue_number:
        description: 'Issue number to process'
        required: true
      force_reprocess:
        description: 'Force reprocessing even if already processed'
        type: boolean
        default: false
```

#### Scheduled Triggers
```yaml
name: Scheduled Cleanup
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
```

### Workflow Conditions

#### Skip Conditions
```yaml
jobs:
  process-issue:
    runs-on: ubuntu-latest
    if: |
      github.event.sender.type != 'Bot' &&
      !contains(github.event.issue.labels.*.name, 'automation:ignore') &&
      github.event.issue.state == 'open'
```

#### Label-Based Conditions
```yaml
if: |
  contains(github.event.issue.labels.*.name, 'epic') ||
  contains(github.event.issue.labels.*.name, 'enhancement') ||
  contains(github.event.issue.labels.*.name, 'bug')
```

### Workflow Matrix Strategy

```yaml
strategy:
  matrix:
    phase: [inception, discovery, design, architecture, implementation]
  max-parallel: 2
```

### Best Practices

1. **Use specific event types** - Only trigger on needed events
2. **Add sender filters** - Prevent bot loops
3. **Implement timeout controls** - Set job timeouts
4. **Use concurrency controls** - Prevent duplicate runs
5. **Add error handling** - Always include failure steps

---

## 3. Label Configuration

Labels control automation behavior and provide visual status indicators.

### System Labels

#### Processing State Labels
| Label | Description | Auto-Applied | Auto-Removed |
|-------|-------------|--------------|--------------|
| `in-progress` | Issue is being processed | Yes | Yes |
| `swarm-active` | AI agents are working | Yes | Yes |
| `swarm-processed` | Processing complete | Yes | No |
| `automation:failed` | Processing failed | Yes | No |

#### Control Labels
| Label | Description | Effect |
|-------|-------------|--------|
| `automation:ignore` | Skip all automation | Prevents processing |
| `auto-close-on-complete` | Auto-close when done | Closes after 60s |
| `keep-open` | Keep issue open | Prevents auto-close |
| `priority:high` | High priority | Processes first |
| `priority:critical` | Critical priority | Immediate processing |

#### Phase Labels (EPIC Workflow)
| Label | Description | Entry Criteria |
|-------|-------------|----------------|
| `phase:0-inception` | Initial idea | Issue created |
| `phase:1-discovery` | Research phase | Inception complete |
| `phase:2-design` | Solution design | Requirements validated |
| `phase:3-architecture` | Technical design | Design approved |
| `phase:4-implementation` | Development | Architecture complete |
| `phase:5-testing` | Quality assurance | Code complete |
| `phase:6-deployment` | Release prep | Tests passing |
| `phase:7-operations` | Post-deployment | Deployed |

### Custom Label Rules

#### Label Rule Configuration
```json
{
  "labelRules": [
    {
      "name": "bug-priority",
      "condition": "title.includes('[CRITICAL]') || body.includes('production down')",
      "apply": ["priority:critical", "bug"],
      "remove": ["priority:low"]
    },
    {
      "name": "epic-detection",
      "condition": "title.startsWith('[EPIC]') || labels.includes('epic')",
      "apply": ["phase:0-inception", "epic"],
      "workflow": "epic-phase-workflow"
    }
  ]
}
```

### Label Color Scheme

```yaml
# Status Labels
in-progress: "#0366d6"        # Blue
swarm-active: "#28a745"       # Green
swarm-processed: "#6f42c1"    # Purple
automation:failed: "#d73a49"  # Red

# Priority Labels
priority:critical: "#b60205"  # Dark Red
priority:high: "#d93f0b"      # Orange
priority:medium: "#fbca04"    # Yellow
priority:low: "#0e8a16"       # Green

# Phase Labels
phase:*: "#1d76db"           # Consistent blue for all phases
```

### Best Practices

1. **Use consistent naming** - Follow `category:value` pattern
2. **Document label meanings** - Maintain a label glossary
3. **Automate label application** - Reduce manual labeling
4. **Use colors meaningfully** - Group related labels by color
5. **Clean up stale labels** - Remove outdated labels regularly

---

## 4. Phase Configuration

The EPIC phase workflow provides structured progression through development stages.

### Phase Definitions

#### Phase 0: Inception
```yaml
phase:
  id: 0
  name: "Inception"
  description: "Initial idea capture and validation"
  entryActions:
    - apply_label: "phase:0-inception"
    - create_comment: "Starting inception phase..."
  completionCriteria:
    - has_section: "Problem Statement"
    - has_section: "Proposed Solution"
    - has_approval: true
  exitActions:
    - update_epic_document
    - transition_to: "phase:1-discovery"
```

#### Phase 1: Discovery
```yaml
phase:
  id: 1
  name: "Discovery"
  description: "Research and requirement gathering"
  templates:
    - research_checklist
    - competitor_analysis
  aiPrompts:
    - "Research existing solutions for {problem_statement}"
    - "Identify technical requirements and constraints"
  completionCriteria:
    - has_section: "Requirements"
    - has_section: "Constraints"
    - research_complete: true
```

### Phase Transition Rules

```yaml
transitions:
  - from: "phase:0-inception"
    to: "phase:1-discovery"
    conditions:
      - all_criteria_met: true
      - human_approval: true
    actions:
      - archive_phase_artifacts
      - notify_stakeholders
      
  - from: "phase:3-architecture"
    to: "phase:4-implementation"
    conditions:
      - architecture_reviewed: true
      - security_approved: true
    actions:
      - create_implementation_tasks
      - setup_development_branch
```

### Phase-Specific AI Agents

```yaml
phaseAgents:
  inception:
    - product_analyst
    - market_researcher
  discovery:
    - requirements_analyst
    - technical_researcher
    - competitor_analyst
  design:
    - solution_architect
    - ux_designer
  architecture:
    - system_architect
    - security_architect
    - infrastructure_engineer
  implementation:
    - full_stack_developer
    - test_engineer
    - code_reviewer
```

### Customizing Entry/Exit Criteria

```javascript
// Custom criteria checker
const customCriteria = {
  'has_test_plan': async (issue) => {
    const body = issue.body || '';
    return body.includes('## Test Plan') && 
           body.includes('- [ ]') &&
           body.match(/- \[.\]/g).length >= 3;
  },
  
  'performance_baseline': async (issue) => {
    const comments = await getIssueComments(issue.number);
    return comments.some(c => 
      c.body.includes('Performance baseline:') &&
      c.body.includes('ms')
    );
  }
};
```

### Best Practices

1. **Define clear criteria** - Make phase transitions objective
2. **Require human approval** - Keep humans in the loop
3. **Document phase artifacts** - Capture work products
4. **Use phase templates** - Standardize phase activities
5. **Track phase metrics** - Measure phase duration and success

---

## 5. Template Configuration

Templates ensure consistent issue structure and provide AI agents with necessary context.

### Template Structure

```yaml
name: "Feature Development"
description: "Template for new feature requests"
title: "[FEATURE]: "
labels: ["enhancement", "feature"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        ## Feature Development Request
        
  - type: textarea
    id: summary
    attributes:
      label: Feature Summary
      description: Brief overview of the feature
      placeholder: "Add user authentication..."
    validations:
      required: true
      
  - type: dropdown
    id: complexity
    attributes:
      label: Estimated Complexity
      options:
        - Small (1-2 days)
        - Medium (3-5 days)
        - Large (1-2 weeks)
        - Extra Large (2+ weeks)
    validations:
      required: true
```

### Template Selection Logic

```javascript
const templateSelector = {
  rules: [
    {
      condition: (title, body) => title.includes('[EPIC]'),
      template: 'epic-feature.yml'
    },
    {
      condition: (title, body) => title.includes('[BUG]'),
      template: 'bug-report.yml'
    },
    {
      condition: (title, body) => body.includes('performance'),
      template: 'performance-optimization.yml'
    }
  ],
  default: 'general-task.yml'
};
```

### Dynamic Template Variables

```yaml
variables:
  - name: current_date
    value: "{{ date.now | date('YYYY-MM-DD') }}"
  - name: sprint_number
    value: "{{ env.CURRENT_SPRINT }}"
  - name: team_members
    value: "{{ team.developers | join(', ') }}"
```

### Comment Templates

```yaml
# Progress update template
progress_update:
  template: |
    ## Progress Update - {{ phase_name }}
    
    **Status**: {{ status_emoji }} {{ status_text }}
    **Progress**: {{ progress_percentage }}%
    **Phase**: {{ current_phase }} → {{ next_phase }}
    
    ### Completed
    {{ completed_tasks | markdown_list }}
    
    ### In Progress
    {{ active_tasks | markdown_list }}
    
    ### Next Steps
    {{ next_steps | markdown_list }}
    
    ---
    *Updated: {{ timestamp }}*
```

### Best Practices

1. **Keep templates focused** - One template per use case
2. **Provide examples** - Include placeholder text
3. **Validate required fields** - Ensure critical info is captured
4. **Version templates** - Track template changes
5. **Test with AI agents** - Ensure templates provide sufficient context

---

## 6. Integration Configuration

Configure external service integrations and AI agent settings.

### Claude Integration

```yaml
claude:
  api_key: ${CLAUDE_API_KEY}
  model: "claude-3-opus-20240229"
  max_tokens: 4000
  temperature: 0.7
  system_prompt: |
    You are an AI assistant helping with software development tasks.
    Follow the EPIC phase workflow and provide structured responses.
    Always cite sources and explain your reasoning.
  retry_config:
    max_attempts: 3
    backoff_multiplier: 2
    initial_delay: 1000
```

### RUV-Swarm Configuration

```yaml
ruv_swarm:
  mcp_endpoint: "http://localhost:8080"
  coordination:
    max_agents: 15
    batch_size: 5
    parallel_execution: true
  agent_types:
    - name: requirements_analyst
      capabilities: ["research", "documentation"]
      max_iterations: 10
    - name: solution_architect
      capabilities: ["design", "review"]
      max_iterations: 5
  monitoring:
    health_check_interval: 30000
    restart_on_failure: true
    max_restart_attempts: 3
```

### GitHub API Configuration

```yaml
github:
  api_version: "v3"
  base_url: "https://api.github.com"
  auth_type: "pat"
  rate_limit:
    requests_per_hour: 5000
    burst_size: 100
  pagination:
    per_page: 100
    max_pages: 10
  webhooks:
    secret: ${WEBHOOK_SECRET}
    events: ["issues", "issue_comment", "pull_request"]
```

### External Service Webhooks

```yaml
webhooks:
  slack:
    url: ${SLACK_WEBHOOK_URL}
    events: ["phase_complete", "critical_error"]
    format: "slack_blocks"
    
  custom_api:
    url: "https://api.example.com/webhook"
    auth: "Bearer ${API_TOKEN}"
    events: ["issue_created", "issue_closed"]
    retry: true
```

### Best Practices

1. **Use environment variables** - Never hardcode credentials
2. **Implement circuit breakers** - Prevent cascade failures
3. **Monitor API limits** - Track usage and throttle
4. **Version API calls** - Specify API versions explicitly
5. **Log integration events** - Maintain audit trail

---

## 7. Security Configuration

Security settings for authentication, authorization, and access control.

### Authentication Configuration

```yaml
authentication:
  bot_account:
    type: "personal_access_token"
    token: ${BOT_PAT}
    scopes:
      - repo
      - write:issues
      - write:pull_requests
      - write:actions
  token_rotation:
    enabled: true
    interval_days: 90
    notification_days_before: 7
```

### Permission Requirements

```yaml
permissions:
  repository:
    issues: write
    pull_requests: write
    contents: write
    actions: write
    metadata: read
  organization:
    members: read
    teams: read
```

### Rate Limiting

```yaml
rate_limits:
  global:
    requests_per_minute: 60
    burst_size: 10
  per_user:
    requests_per_minute: 20
    concurrent_requests: 5
  ai_requests:
    requests_per_minute: 10
    token_limit_per_day: 100000
```

### Access Control

```yaml
access_control:
  admin_users:
    - "admin-user-1"
    - "admin-user-2"
  
  restricted_operations:
    delete_issue:
      allowed_users: ["admin-user-1"]
      require_approval: true
    
    force_close:
      allowed_roles: ["admin", "maintainer"]
      log_action: true
  
  label_permissions:
    "priority:critical":
      can_apply: ["admin", "maintainer"]
      can_remove: ["admin"]
```

### Audit Configuration

```yaml
audit:
  enabled: true
  log_level: "info"
  retention_days: 90
  events_to_log:
    - authentication_attempts
    - permission_changes
    - critical_operations
    - ai_requests
  storage:
    type: "file"
    path: "./logs/audit"
    rotate_size: "100MB"
```

### Best Practices

1. **Use least privilege** - Grant minimum required permissions
2. **Rotate credentials** - Implement regular rotation
3. **Audit everything** - Log all security events
4. **Encrypt sensitive data** - Use encryption at rest
5. **Implement rate limiting** - Prevent abuse and DoS

---

## 8. Advanced Configuration

Advanced settings for custom actions, hooks, and extensions.

### Custom Actions

```yaml
custom_actions:
  - name: "code_security_scan"
    trigger: "on_implementation_complete"
    action: |
      npm audit
      ./scripts/security-scan.sh
    on_failure: "create_security_issue"
    
  - name: "performance_benchmark"
    trigger: "on_pr_created"
    action: |
      npm run benchmark
      ./scripts/compare-performance.sh
    threshold: "5%"
```

### Event Hooks

```javascript
// hooks/pre-process.js
module.exports = {
  beforeProcess: async (issue) => {
    // Custom validation
    if (issue.title.length < 10) {
      throw new Error('Issue title too short');
    }
    
    // Enrich issue data
    issue.metadata = {
      priority: calculatePriority(issue),
      estimatedEffort: estimateEffort(issue),
      suggestedAssignees: findAssignees(issue)
    };
    
    return issue;
  }
};

// hooks/post-process.js
module.exports = {
  afterProcess: async (issue, result) => {
    // Send notifications
    await notifyStakeholders(issue, result);
    
    // Update metrics
    await updateMetrics({
      issueId: issue.number,
      processingTime: result.duration,
      agentsUsed: result.agents.length
    });
  }
};
```

### Plugin System

```yaml
plugins:
  - name: "jira-sync"
    enabled: true
    config:
      jira_url: "https://company.atlassian.net"
      project_key: "PROJ"
      sync_interval: 300000
      
  - name: "metrics-collector"
    enabled: true
    config:
      prometheus_endpoint: "http://localhost:9090"
      metrics_prefix: "github_automation_"
```

### Custom Workflow Extensions

```yaml
workflow_extensions:
  custom_phases:
    - id: 8
      name: "Security Review"
      after: "phase:3-architecture"
      required_for: ["critical", "security"]
      
  custom_transitions:
    - name: "emergency_rollback"
      from: "phase:6-deployment"
      to: "phase:4-implementation"
      conditions:
        - "deployment_failed"
        - "critical_bug_found"
```

### Performance Tuning

```yaml
performance:
  caching:
    enabled: true
    ttl: 3600
    max_size: "1GB"
    
  connection_pooling:
    github_api:
      max_connections: 20
      timeout: 30000
    ai_service:
      max_connections: 10
      timeout: 60000
      
  batch_processing:
    chunk_size: 10
    parallel_chunks: 3
    retry_failed_chunks: true
```

### Best Practices

1. **Test custom code** - Thoroughly test all customizations
2. **Version control hooks** - Track hook changes in git
3. **Monitor performance** - Watch for performance impacts
4. **Document customizations** - Maintain clear documentation
5. **Plan for upgrades** - Ensure compatibility with updates

---

## Configuration Best Practices Summary

1. **Environment-Specific Configs**
   - Separate configs for dev/staging/prod
   - Use environment variables for secrets
   - Validate configuration on startup

2. **Configuration as Code**
   - Version control all configuration
   - Use schema validation
   - Implement configuration tests

3. **Monitoring and Alerts**
   - Monitor configuration changes
   - Alert on configuration errors
   - Track configuration metrics

4. **Documentation**
   - Document all custom settings
   - Provide configuration examples
   - Maintain change log

5. **Security First**
   - Encrypt sensitive configuration
   - Implement access controls
   - Audit configuration access

---

*Configuration Reference Version: 1.0*  
*Last Updated: January 2025*
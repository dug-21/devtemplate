# Practical Example: GitHub Workflow Bot Implementation

This example demonstrates how to use the phase templates for implementing a GitHub workflow automation bot.

## 📋 Project Overview
Building a GitHub bot that automatically manages issue workflows, assigns reviewers, and updates project boards.

---

## Phase 1: Research & Discovery

### 📥 Initial Inputs
```yaml
inputs:
  problem_statement: "Manual GitHub workflow management is time-consuming and error-prone"
  initial_requirements: 
    - "Automate issue triaging"
    - "Auto-assign reviewers based on expertise"
    - "Update project boards automatically"
  constraints:
    - "Must use GitHub API rate limits efficiently"
    - "Cannot store sensitive data"
    - "Must complete in 6 weeks"
  stakeholders:
    - "Development team (primary users)"
    - "Project managers (workflow design)"
    - "Security team (compliance)"
```

### 📤 Research Outputs → Architecture Inputs

#### Requirements Document
```markdown
# GitHub Workflow Bot Requirements

## Functional Requirements
1. [REQ-001] Bot must respond to issue creation within 30 seconds
2. [REQ-002] Bot must assign reviewers based on CODEOWNERS file
3. [REQ-003] Bot must update project boards when issues change state
4. [REQ-004] Bot must add labels based on issue content analysis

## Non-Functional Requirements
1. [NFR-001] Performance: Process events < 5s
2. [NFR-002] Security: Use GitHub App authentication
3. [NFR-003] Reliability: 99.9% uptime
4. [NFR-004] Scalability: Handle 1000 events/hour

## Constraints
1. Must work within GitHub API rate limits (5000/hour)
2. Cannot store user data beyond 24 hours
3. Must use webhook events (not polling)
```

#### Technology Assessment
```markdown
# Technology Assessment

## Recommended Stack
- Runtime: Node.js 18+ (native GitHub SDK support)
- Framework: Express.js (simple webhook handling)
- Bot Framework: Probot (GitHub-specific features)
- Database: PostgreSQL (event tracking only)
- Hosting: AWS Lambda (event-driven, scalable)

## Alternatives Considered
| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Python/Flask | Good libraries | Slower webhook processing | Rejected |
| Go | Fast, efficient | Less GitHub SDK maturity | Rejected |
| Deno | Modern, secure | Limited ecosystem | Rejected |
| Node.js/Probot | Purpose-built, mature | JS limitations | **Selected** |
```

#### Risk Matrix
```markdown
# Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| API rate limit exceeded | Medium | High | Implement caching, batch operations |
| Webhook delivery failures | Low | Medium | Add retry queue, monitoring |
| Malicious webhook payloads | Low | High | Validate signatures, sanitize input |
| Bot permission errors | Medium | Medium | Comprehensive testing, gradual rollout |
```

### ✅ Phase 1 Gate Review
- [x] Requirements approved by dev team and PMs
- [x] Probot/Node.js stack approved by tech lead
- [x] 6-week timeline confirmed feasible
- [x] Risk mitigations accepted by security team

---

## Phase 2: Architecture & Planning

### 📥 Inputs from Research
- Complete requirements (REQ-001 through REQ-004)
- Approved tech stack (Node.js, Probot, PostgreSQL)
- Risk mitigations defined
- 6-week timeline constraint

### 📤 Architecture Outputs → Setup Inputs

#### System Architecture
```markdown
# GitHub Bot Architecture

## Overview
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   GitHub    │────▶│  API Gateway │────▶│   Lambda    │
│  Webhooks   │     │   (HTTPS)    │     │  (Probot)   │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                    ┌──────────────┐     ┌───────▼───────┐
                    │     SQS      │◀────│   DynamoDB    │
                    │   (Retry)    │     │  (State/Cache)│
                    └──────────────┘     └───────────────┘
```

## Components

### Webhook Handler (Lambda)
- Purpose: Receive and validate GitHub webhooks
- Technology: Node.js 18, Probot framework
- Interfaces: HTTP POST /webhooks
- Dependencies: GitHub API, DynamoDB

### Event Processor
- Purpose: Process events and determine actions
- Technology: Node.js, Probot
- Interfaces: Internal function calls
- Dependencies: Rules engine, GitHub API

### State Manager
- Purpose: Track processed events, cache data
- Technology: DynamoDB
- Interfaces: Key-value store API
- Dependencies: None

## Security Architecture
- Authentication: GitHub App private key
- Webhook validation: HMAC signature verification
- API calls: JWT tokens with 10-minute expiry
- Secrets: AWS Secrets Manager
```

#### Implementation Plan
```markdown
# Implementation Plan

## Phase 1: Foundation (Week 1)
- [x] Setup Probot project structure
- [x] Configure GitHub App
- [x] Implement webhook signature validation
- [x] Setup Lambda deployment

## Phase 2: Core Features (Week 2-3)
- [ ] Issue event handler
- [ ] Label management logic
- [ ] Reviewer assignment algorithm
- [ ] Project board integration

## Phase 3: Advanced Features (Week 4)
- [ ] CODEOWNERS parser
- [ ] Smart label suggestions
- [ ] Custom workflow rules
- [ ] Performance optimization

## Phase 4: Testing & Refinement (Week 5)
- [ ] Integration testing
- [ ] Load testing
- [ ] Security audit
- [ ] Documentation

## Dependencies
- GitHub App creation requires admin access
- DynamoDB setup needs AWS account
- CODEOWNERS logic depends on file parser
```

### ✅ Phase 2 Gate Review
- [x] Architecture approved (serverless approach accepted)
- [x] All components have clear interfaces
- [x] 5-week implementation plan fits 6-week constraint
- [x] Test strategy covers webhook scenarios

---

## Phase 3: Development Setup

### 📥 Inputs from Architecture
- Serverless architecture design
- Probot framework decision
- 5-week implementation timeline
- Component specifications

### 📤 Setup Outputs → Implementation Inputs

#### Development Environment
```markdown
# Development Environment Setup

## Quick Start
```bash
# Clone and setup
git clone https://github.com/team/github-workflow-bot
cd github-workflow-bot
npm install

# Configure environment
cp .env.example .env
# Edit .env with your GitHub App credentials

# Run locally with webhook proxy
npm run dev

# In another terminal, start webhook tunnel
npx smee -u https://smee.io/YOUR_CHANNEL -t http://localhost:3000/webhooks
```

## Local Testing Setup
1. Create test GitHub App
2. Install on test repository
3. Use smee.io for webhook forwarding
4. Use localstack for AWS services
```

#### CI/CD Configuration
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run lint
      - run: npm run type-check
      
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm audit
      - uses: github/super-linter@v4
      
  deploy:
    needs: [test, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm run build
      - run: npm run deploy:lambda
```

### ✅ Phase 3 Gate Review
- [x] All developers can run bot locally
- [x] CI/CD pipeline passes on main branch
- [x] Webhook testing setup documented
- [x] AWS Lambda deployment automated

---

## Phase 4: Implementation

### 📥 Inputs from Setup
- Working local environment with webhook proxy
- CI/CD pipeline running
- Probot project structure
- Test GitHub App configured

### 📤 Implementation Outputs → Testing Inputs

#### Feature: Issue Auto-Labeling
```markdown
# Feature Implementation: Auto-Labeling

## Branch: feature/auto-labeling
## PR: #23

### Implementation Details
```javascript
// src/handlers/issues.js
module.exports = (app) => {
  app.on('issues.opened', async (context) => {
    const { issue, repository } = context.payload;
    
    // Analyze issue content
    const labels = await analyzeContent(issue.title, issue.body);
    
    // Add labels
    if (labels.length > 0) {
      await context.octokit.issues.addLabels({
        owner: repository.owner.login,
        repo: repository.name,
        issue_number: issue.number,
        labels
      });
    }
  });
};
```

### Tests: 8 unit, 3 integration
- ✓ Correctly identifies bug reports
- ✓ Handles missing issue body
- ✓ Respects rate limits
- ✓ Logs all actions

### Documentation
- API: [/docs/handlers/issues.md]
- Config: [/docs/configuration.md#labels]
```

#### Test Coverage Report
```markdown
# Coverage Report

## Overall Coverage: 92%

| Module | Coverage | Critical Paths |
|--------|----------|----------------|
| handlers/issues | 95% | ✓ All covered |
| handlers/pulls | 90% | ✓ All covered |
| lib/analyzer | 88% | ✓ All covered |
| lib/github | 94% | ✓ All covered |
```

### ✅ Phase 4 Gate Review
- [x] All features implemented and tested
- [x] Code coverage exceeds 90% target
- [x] No outstanding PR comments
- [x] API documentation complete

---

## Phase 5: Testing & QA

### 📥 Inputs from Implementation
- Completed bot features
- 92% code coverage
- Integration with test repository
- Load testing tools ready

### 📤 Testing Outputs → Deployment Inputs

#### Test Results Summary
```markdown
# QA Test Results

## Functional Testing
- Total Test Cases: 47
- Passed: 47 (100%)
- Failed: 0
- Blocked: 0

## Performance Testing
| Scenario | Target | Actual | Status |
|----------|--------|--------|---------|
| Webhook processing | <5s | 1.2s | ✓ Pass |
| Concurrent webhooks | 100/min | 150/min | ✓ Pass |
| Memory usage | <512MB | 256MB | ✓ Pass |

## Security Testing
- [x] Webhook signatures validated
- [x] No sensitive data logged
- [x] Rate limiting implemented
- [x] Input sanitization verified

## UAT Sign-offs
- Dev Team Lead: ✓ 2024-01-15
- Project Manager: ✓ 2024-01-15
- Security Lead: ✓ 2024-01-16
```

### ✅ Phase 5 Gate Review
- [x] All functional tests passing
- [x] Performance exceeds targets
- [x] Security scan clean
- [x] UAT completed successfully

---

## Phase 6: Deployment

### 📥 Inputs from Testing
- All tests passed
- Deployment package ready
- Lambda function tested
- Rollback plan prepared

### 📤 Deployment Outputs → Maintenance Inputs

#### Deployment Report
```markdown
# Production Deployment

## Deployment Details
- Date/Time: 2024-01-17 14:00 UTC
- Version: 1.0.0
- Duration: 12 minutes
- Issues: None

## Verification Checklist
- [x] Lambda function deployed
- [x] Environment variables set
- [x] Webhook endpoint responding
- [x] Test webhook processed successfully
- [x] CloudWatch logs streaming
- [x] Alarms configured

## Gradual Rollout
- Day 1: 1 repository (success)
- Day 2: 10 repositories (success)
- Day 3: 50 repositories (success)
- Day 7: All repositories ✓
```

#### Operations Guide
```markdown
# GitHub Bot Operations

## Production Access
- AWS Console: https://console.aws.amazon.com
- CloudWatch Logs: [Direct link]
- Lambda Function: github-bot-prod

## Common Operations

### View Recent Logs
```bash
aws logs tail /aws/lambda/github-bot-prod --follow
```

### Update Configuration
```bash
aws lambda update-function-configuration \
  --function-name github-bot-prod \
  --environment Variables={KEY=value}
```

### Emergency Shutdown
```bash
# Disable webhook endpoint
aws lambda put-function-concurrency \
  --function-name github-bot-prod \
  --reserved-concurrent-executions 0
```
```

### ✅ Phase 6 Gate Review
- [x] Successfully running for 48 hours
- [x] No critical incidents
- [x] Operations guide published
- [x] Team trained on procedures

---

## Phase 7: Maintenance & Operations

### 📥 Inputs from Deployment
- Bot running in production
- Operations documentation
- Monitoring configured
- Support team ready

### 📤 Ongoing Outputs

#### Monthly Report (Month 1)
```markdown
# GitHub Bot Monthly Report - January 2024

## System Metrics
- Uptime: 99.98% (5 minutes downtime)
- Webhooks Processed: 12,847
- Avg Response Time: 1.1s
- Error Rate: 0.02%

## Feature Usage
| Feature | Usage Count | Success Rate |
|---------|-------------|--------------|
| Auto-label | 3,421 | 99.9% |
| Assign reviewer | 2,156 | 98.5% |
| Update board | 4,532 | 99.7% |

## Incidents
| Date | Issue | Impact | Resolution |
|------|-------|--------|------------|
| Jan 23 | Rate limit hit | 5 min delay | Added caching |

## Improvements
- Implemented: Response time optimization (-200ms)
- Planned: Multi-language label support
```

---

## 🎯 Key Takeaways from This Example

1. **Clear Input/Output Chain**: Each phase's outputs directly feed the next phase's inputs
2. **Concrete Templates**: Filled-out examples show exactly what's expected
3. **Gate Reviews**: Specific checkboxes ensure readiness before proceeding
4. **Real Metrics**: Actual numbers and targets make success measurable
5. **Practical Details**: Code snippets and commands provide actionable guidance

This example demonstrates how the phase templates ensure nothing falls through the cracks and create a clear path from idea to production system.
# Architecture Redesign Problem Statement

## Current Situation

A GitHub workflow automation system was built with a fundamental architectural flaw: it attempts to perform intelligent processing within GitHub Actions workflows, which requires API keys and external services that aren't available in the GitHub Actions environment.

## The Core Problem

1. **GitHub Actions runs on GitHub's servers**, not locally
2. **Claude authentication** is done locally via subscription (no API key)
3. **Current implementation** tries to process intelligence in Actions (wrong!)
4. **Result**: The system cannot function as designed

## Key Constraints

1. **No Claude API Key** - User has Claude subscription, authenticated locally
2. **GitHub Actions Limitations** - Runs on GitHub servers, no access to local resources
3. **Bot PAT Available** - Can authenticate GitHub API calls
4. **Local Development Environment** - Where Claude is authenticated and available
5. **Event-Driven Requirement** - Must respond to GitHub issue/comment events

## What Was Built (Incorrectly)

```
GitHub Events → GitHub Actions → [Process with Claude] → Update Issues
                                  ^^^^^^^^^^^^^^^^^ FAILS (no Claude access)
```

## What Should Be Built

```
GitHub Events → GitHub Actions → Save Event Data → Local Process → Update Issues
                                                    ^^^^^^^^^^^^^ Claude available here
```

## Design Requirements

1. **GitHub Actions as Event Receivers Only**
   - Capture issue/comment events
   - Store event data (artifacts, files, or commits)
   - NO processing logic

2. **Local Processing Service**
   - Watch for new events from GitHub
   - Process with locally authenticated Claude
   - Update issues via GitHub API

3. **Event Queue Mechanism**
   - Reliable event capture and storage
   - Polling or webhook to local environment
   - Handle offline/online scenarios

4. **Minimal GitHub Infrastructure**
   - Simple, maintainable workflows
   - No complex logic in Actions
   - All intelligence runs locally

## Success Criteria

1. GitHub Actions workflows contain < 50 lines each
2. No API keys stored in GitHub
3. All intelligent processing happens locally
4. System can handle being offline gracefully
5. Easy to understand and maintain

## Deliverables Needed

1. New GitHub Actions workflows (minimal event capture)
2. Local processing service/script
3. Event queue design
4. Setup documentation
5. Migration plan from current architecture
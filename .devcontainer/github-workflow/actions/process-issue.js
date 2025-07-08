#!/usr/bin/env node

import { readFileSync } from 'fs';
import { setTimeout } from 'timers/promises';
import { GitHubAPI } from '../library/github-api.js';
import { ClaudeClient } from '../library/claude-client.js';
import { RuvSwarmManager } from '../library/ruv-swarm-manager.js';
import { Logger } from '../library/logger.js';
import { validateIssue } from '../library/validators.js';
import { ExponentialBackoff } from '../library/retry-utils.js';

// Initialize logger for GitHub Actions
const logger = new Logger('process-issue');

// Configuration
const CONFIG = {
  responseTimeout: 5000, // 5 seconds
  maxRetries: 3,
  initialRetryDelay: 1000,
  maxRetryDelay: 10000,
  backoffMultiplier: 2
};

// Label definitions
const LABELS = {
  EPIC: 'epic',
  BUG: 'bug',
  FEATURE: 'feature',
  ENHANCEMENT: 'enhancement',
  DOCUMENTATION: 'documentation',
  QUESTION: 'question',
  INVALID: 'invalid',
  PROCESSING: 'processing',
  PROCESSED: 'processed',
  FAILED: 'failed-processing'
};

/**
 * Main process function
 */
async function processIssue() {
  const startTime = Date.now();
  
  try {
    // Get GitHub context from environment
    const githubToken = process.env.GITHUB_TOKEN;
    const repository = process.env.GITHUB_REPOSITORY;
    const issueNumber = process.env.ISSUE_NUMBER;
    const eventPath = process.env.GITHUB_EVENT_PATH;
    
    if (!githubToken || !repository || !issueNumber || !eventPath) {
      throw new Error('Missing required environment variables');
    }
    
    logger.info(`Processing issue #${issueNumber} in ${repository}`);
    
    // Read issue data from event file
    const eventData = JSON.parse(readFileSync(eventPath, 'utf8'));
    const issue = eventData.issue;
    
    if (!issue) {
      throw new Error('No issue data found in event payload');
    }
    
    // Initialize GitHub API
    const github = new GitHubAPI(githubToken, repository);
    
    // Add processing label immediately
    await github.addLabels(issueNumber, [LABELS.PROCESSING]);
    logger.info('Added processing label');
    
    // Validate issue content
    const validation = validateIssue(issue);
    if (!validation.isValid) {
      logger.warn(`Issue validation failed: ${validation.errors.join(', ')}`);
      await github.addLabels(issueNumber, [LABELS.INVALID]);
      await github.createComment(issueNumber, 
        `⚠️ Issue validation failed:\n${validation.errors.map(e => `- ${e}`).join('\n')}`
      );
      return exitWithCode(1);
    }
    
    // Determine issue type and apply labels
    const labels = determineLabels(issue);
    await github.addLabels(issueNumber, labels);
    logger.info(`Applied labels: ${labels.join(', ')}`);
    
    // Check if this is an EPIC issue
    const isEpic = labels.includes(LABELS.EPIC) || 
                   issue.title.toLowerCase().includes('[epic]') ||
                   issue.body.toLowerCase().includes('#epic');
    
    // Process based on issue type
    let result;
    if (isEpic) {
      logger.info('Processing as EPIC issue with ruv-swarm');
      result = await processWithRuvSwarm(issue, github);
    } else {
      logger.info('Processing as regular issue with Claude');
      result = await processWithClaude(issue, github);
    }
    
    // Ensure we meet 5-second response requirement
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime < CONFIG.responseTimeout) {
      await setTimeout(CONFIG.responseTimeout - elapsedTime);
    }
    
    // Update labels based on result
    await github.removeLabels(issueNumber, [LABELS.PROCESSING]);
    await github.addLabels(issueNumber, [result.success ? LABELS.PROCESSED : LABELS.FAILED]);
    
    // Post result comment
    await github.createComment(issueNumber, result.message);
    
    logger.info(`Issue processing completed in ${Date.now() - startTime}ms`);
    return exitWithCode(result.success ? 0 : 1);
    
  } catch (error) {
    logger.error('Fatal error processing issue:', error);
    
    // Try to update issue with error status
    try {
      const github = new GitHubAPI(process.env.GITHUB_TOKEN, process.env.GITHUB_REPOSITORY);
      const issueNumber = process.env.ISSUE_NUMBER;
      
      if (github && issueNumber) {
        await github.removeLabels(issueNumber, [LABELS.PROCESSING]);
        await github.addLabels(issueNumber, [LABELS.FAILED]);
        await github.createComment(issueNumber, 
          `❌ Failed to process issue: ${error.message}\n\nPlease check the workflow logs for more details.`
        );
      }
    } catch (updateError) {
      logger.error('Failed to update issue status:', updateError);
    }
    
    return exitWithCode(1);
  }
}

/**
 * Process issue with ruv-swarm for EPICs
 */
async function processWithRuvSwarm(issue, github) {
  const backoff = new ExponentialBackoff(CONFIG);
  
  return await backoff.execute(async () => {
    try {
      const swarmManager = new RuvSwarmManager();
      
      // Initialize swarm for EPIC processing
      await swarmManager.initialize({
        topology: 'hierarchical',
        strategy: 'specialized',
        maxAgents: 10
      });
      
      // Create task for EPIC breakdown
      const task = {
        type: 'epic_breakdown',
        title: issue.title,
        body: issue.body,
        labels: issue.labels.map(l => l.name),
        milestone: issue.milestone?.title
      };
      
      // Orchestrate task across swarm
      const result = await swarmManager.orchestrateTask(task, {
        priority: 'high',
        strategy: 'adaptive'
      });
      
      // Generate structured response
      const breakdown = result.output;
      const message = formatEpicBreakdown(breakdown);
      
      // Create sub-issues if specified
      if (breakdown.subIssues && breakdown.subIssues.length > 0) {
        for (const subIssue of breakdown.subIssues) {
          await github.createIssue({
            title: subIssue.title,
            body: subIssue.body,
            labels: subIssue.labels || [],
            milestone: issue.milestone?.number
          });
        }
      }
      
      return {
        success: true,
        message
      };
      
    } catch (error) {
      logger.error('Ruv-swarm processing error:', error);
      throw error;
    }
  });
}

/**
 * Process regular issue with Claude
 */
async function processWithClaude(issue, github) {
  const backoff = new ExponentialBackoff(CONFIG);
  
  return await backoff.execute(async () => {
    try {
      const claude = new ClaudeClient();
      
      // Prepare context for Claude
      const context = {
        issue: {
          number: issue.number,
          title: issue.title,
          body: issue.body,
          labels: issue.labels.map(l => l.name),
          author: issue.user.login,
          created_at: issue.created_at
        },
        repository: process.env.GITHUB_REPOSITORY,
        guidelines: await loadGuidelines()
      };
      
      // Get Claude's analysis
      const analysis = await claude.analyzeIssue(context);
      
      // Format response message
      const message = formatClaudeResponse(analysis);
      
      // Apply suggested labels
      if (analysis.suggestedLabels && analysis.suggestedLabels.length > 0) {
        await github.addLabels(issue.number, analysis.suggestedLabels);
      }
      
      // Create project card if needed
      if (analysis.projectRecommendation) {
        await github.createProjectCard(issue.number, analysis.projectRecommendation);
      }
      
      return {
        success: true,
        message
      };
      
    } catch (error) {
      logger.error('Claude processing error:', error);
      throw error;
    }
  });
}

/**
 * Determine labels based on issue content
 */
function determineLabels(issue) {
  const labels = [];
  const titleLower = issue.title.toLowerCase();
  const bodyLower = issue.body.toLowerCase();
  const combined = `${titleLower} ${bodyLower}`;
  
  // Check for EPIC
  if (combined.includes('[epic]') || combined.includes('#epic')) {
    labels.push(LABELS.EPIC);
  }
  
  // Check for bug indicators
  if (combined.match(/\b(bug|error|issue|problem|broken|fix)\b/)) {
    labels.push(LABELS.BUG);
  }
  
  // Check for feature indicators
  if (combined.match(/\b(feature|add|implement|new)\b/)) {
    labels.push(LABELS.FEATURE);
  }
  
  // Check for enhancement indicators
  if (combined.match(/\b(enhance|improve|optimize|update)\b/)) {
    labels.push(LABELS.ENHANCEMENT);
  }
  
  // Check for documentation indicators
  if (combined.match(/\b(docs?|documentation|readme|guide)\b/)) {
    labels.push(LABELS.DOCUMENTATION);
  }
  
  // Check for question indicators
  if (combined.match(/\?|how to|question|help/)) {
    labels.push(LABELS.QUESTION);
  }
  
  return labels;
}

/**
 * Format EPIC breakdown response
 */
function formatEpicBreakdown(breakdown) {
  let message = '## 🚀 EPIC Breakdown\n\n';
  
  if (breakdown.summary) {
    message += `### Summary\n${breakdown.summary}\n\n`;
  }
  
  if (breakdown.objectives) {
    message += '### Objectives\n';
    breakdown.objectives.forEach(obj => {
      message += `- ${obj}\n`;
    });
    message += '\n';
  }
  
  if (breakdown.phases) {
    message += '### Implementation Phases\n';
    breakdown.phases.forEach((phase, index) => {
      message += `\n**Phase ${index + 1}: ${phase.name}**\n`;
      message += `Duration: ${phase.duration}\n`;
      phase.tasks.forEach(task => {
        message += `- [ ] ${task}\n`;
      });
    });
    message += '\n';
  }
  
  if (breakdown.subIssues) {
    message += `### Sub-Issues Created\n`;
    message += `Created ${breakdown.subIssues.length} sub-issues for tracking individual components.\n\n`;
  }
  
  if (breakdown.risks) {
    message += '### Identified Risks\n';
    breakdown.risks.forEach(risk => {
      message += `- ⚠️ ${risk}\n`;
    });
    message += '\n';
  }
  
  message += '---\n';
  message += '*Processed by ruv-swarm autonomous agent system*';
  
  return message;
}

/**
 * Format Claude analysis response
 */
function formatClaudeResponse(analysis) {
  let message = '## 🤖 Issue Analysis\n\n';
  
  if (analysis.summary) {
    message += `### Summary\n${analysis.summary}\n\n`;
  }
  
  if (analysis.classification) {
    message += `**Classification:** ${analysis.classification}\n`;
    message += `**Priority:** ${analysis.priority || 'Medium'}\n`;
    message += `**Complexity:** ${analysis.complexity || 'Medium'}\n\n`;
  }
  
  if (analysis.suggestions) {
    message += '### Suggestions\n';
    analysis.suggestions.forEach(suggestion => {
      message += `- ${suggestion}\n`;
    });
    message += '\n';
  }
  
  if (analysis.relatedIssues && analysis.relatedIssues.length > 0) {
    message += '### Related Issues\n';
    analysis.relatedIssues.forEach(issue => {
      message += `- #${issue.number}: ${issue.title}\n`;
    });
    message += '\n';
  }
  
  if (analysis.nextSteps) {
    message += '### Next Steps\n';
    analysis.nextSteps.forEach((step, index) => {
      message += `${index + 1}. ${step}\n`;
    });
    message += '\n';
  }
  
  message += '---\n';
  message += '*Analyzed by Claude AI assistant*';
  
  return message;
}

/**
 * Load processing guidelines
 */
async function loadGuidelines() {
  try {
    const guidelinesPath = '../config/issue-guidelines.json';
    const guidelines = JSON.parse(readFileSync(guidelinesPath, 'utf8'));
    return guidelines;
  } catch (error) {
    logger.warn('Failed to load guidelines, using defaults');
    return {
      priorities: ['critical', 'high', 'medium', 'low'],
      categories: ['bug', 'feature', 'enhancement', 'documentation'],
      responseTemplates: {}
    };
  }
}

/**
 * Exit with proper code
 */
function exitWithCode(code) {
  process.exit(code);
}

// Run the process
processIssue().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
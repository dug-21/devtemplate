#!/usr/bin/env node

/**
 * Process Comment Action
 * Handles comment processing and @mentions for GitHub workflow automation
 */

import { GitHubClient } from './lib/github-client.js';
import { RuvSwarmClient } from './lib/ruv-swarm-client.js';
import { ClaudeClient } from './lib/claude-client.js';
import { PhaseManager } from './lib/phase-manager.js';

// Exponential backoff implementation
async function withExponentialBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 30000,
        factor = 2
    } = options;
    
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxRetries) {
                throw error;
            }
            
            const delay = Math.min(initialDelay * Math.pow(factor, attempt), maxDelay);
            console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

// Ensure minimum response time
async function ensureMinimumResponseTime(startTime, minTime = 5000) {
    const elapsed = Date.now() - startTime;
    if (elapsed < minTime) {
        await new Promise(resolve => setTimeout(resolve, minTime - elapsed));
    }
}

// Action context from environment
const context = {
    issueNumber: parseInt(process.env.ISSUE_NUMBER),
    commentId: parseInt(process.env.COMMENT_ID),
    commentBody: process.env.COMMENT_BODY || '',
    repository: process.env.GITHUB_REPOSITORY,
    actor: process.env.GITHUB_ACTOR,
    hasClaude: process.env.HAS_CLAUDE === 'true'
};

// Initialize clients
const github = new GitHubClient();
const ruvSwarm = new RuvSwarmClient();
const claude = new ClaudeClient();
const phaseManager = new PhaseManager();

/**
 * Main processing function
 */
async function processComment() {
    console.log(`Processing comment on issue #${context.issueNumber}`);
    
    try {
        // Get issue details with exponential backoff
        const issue = await withExponentialBackoff(() => github.getIssue(context.issueNumber));
        
        // Check if we should process this comment
        if (!shouldProcessComment(issue)) {
            console.log('Comment should not be processed');
            return;
        }
        
        // Determine comment type and process accordingly
        const mentionType = detectMentionType(context.commentBody);
        if (mentionType) {
            await processMention(issue, mentionType);
        } else if (isPhaseTransitionRequest(context.commentBody)) {
            await processPhaseTransition(issue);
        } else if (isQuestionOrRequest(context.commentBody)) {
            await processGeneralRequest(issue);
        } else {
            console.log('No specific action required for this comment');
        }
        
    } catch (error) {
        console.error('Error processing comment:', error);
        
        // Post error reply
        await github.createComment(context.issueNumber,
            `❌ **Error Processing Comment**\n\n` +
            `@${context.actor}, I encountered an error while processing your comment:\n` +
            `\`\`\`\n${error.message}\n\`\`\`\n\n` +
            `Please try again or contact an administrator if the issue persists.`
        ).catch(console.error);
        
        process.exit(1);
    }
}

/**
 * Detect mention type in comment
 */
function detectMentionType(comment) {
    if (comment.includes('@claude')) return 'claude';
    if (comment.includes('@swarm')) return 'swarm';
    if (comment.includes('@ai')) return 'ai';
    return null;
}

/**
 * Process @mention based on type
 */
async function processMention(issue, mentionType) {
    console.log(`Processing @${mentionType} mention`);
    const startTime = Date.now();
    
    // Add processing label based on mention type
    const processingLabel = `${mentionType}-processing`;
    await withExponentialBackoff(() => github.addLabels(context.issueNumber, [processingLabel]));
    
    // Post acknowledgment
    await withExponentialBackoff(() => github.createComment(context.issueNumber,
        `👋 Hello @${context.actor}! I'm processing your request with ${mentionType.toUpperCase()} now...`
    ));
    
    try {
        let response = null;
        let responseSource = '';
        
        // Process based on mention type
        if (mentionType === 'claude' || mentionType === 'ai') {
            // Try Claude first for @claude or @ai mentions
            const claudeAvailable = await withExponentialBackoff(() => claude.isAvailable());
            
            if (claudeAvailable || context.hasClaude) {
                // Process with Claude
                response = await withExponentialBackoff(() => claude.processMention(context.commentBody, {
                    number: context.issueNumber,
                    title: issue.title,
                    body: issue.body
                }));
                responseSource = 'Claude';
            } else if (mentionType === 'ai') {
                // For @ai, fallback to ruv-swarm if Claude is not available
                console.log('Claude not available for @ai mention, trying ruv-swarm');
                mentionType = 'swarm'; // Redirect to swarm processing
            }
        }
        
        // Process with ruv-swarm for @swarm or as fallback
        if (mentionType === 'swarm' && !response) {
            const ruvAvailable = await withExponentialBackoff(() => ruvSwarm.isAvailable());
            
            if (ruvAvailable) {
                await withExponentialBackoff(() => ruvSwarm.initializeSwarm());
                
                const task = `Respond to this comment on GitHub issue #${context.issueNumber}:\n\n` +
                    `Issue Title: ${issue.title}\n` +
                    `Comment: ${context.commentBody}\n\n` +
                    `Provide a helpful and informative response.`;
                
                const result = await withExponentialBackoff(() => ruvSwarm.orchestrateTask(task, {
                    priority: 'high',
                    maxAgents: 2
                }));
                
                response = result.summary || result;
                responseSource = 'AI Swarm';
            }
        }
        
        // Ensure minimum response time
        await ensureMinimumResponseTime(startTime);
        
        // Post response or error message
        if (response) {
            await withExponentialBackoff(() => github.createComment(context.issueNumber,
                `🤖 **${responseSource} Response**\n\n${response}\n\n---\n*Generated by ${responseSource} via GitHub Workflow Automation*`
            ));
        } else {
            await withExponentialBackoff(() => github.createComment(context.issueNumber,
                `⚠️ **AI Services Unavailable**\n\n` +
                `@${context.actor}, I'm unable to process your request as the requested AI service is currently unavailable.\n\n` +
                `Please try again later or contact an administrator.`
            ));
        }
    } catch (error) {
        console.error(`Error processing ${mentionType} mention:`, error);
        
        // Ensure minimum response time even on error
        await ensureMinimumResponseTime(startTime);
        
        // Post error message
        await withExponentialBackoff(() => github.createComment(context.issueNumber,
            `❌ **Error Processing ${mentionType.toUpperCase()} Request**\n\n` +
            `@${context.actor}, I encountered an error while processing your request:\n` +
            `\`\`\`\n${error.message}\n\`\`\`\n\n` +
            `Please try again or contact an administrator if the issue persists.`
        )).catch(console.error);
        
        throw error;
    } finally {
        // Remove processing label
        await github.removeLabel(context.issueNumber, processingLabel).catch(() => {});
    }
}

/**
 * Process phase transition request
 */
async function processPhaseTransition(issue) {
    console.log('Processing phase transition request');
    
    // Parse phase transition request
    const transitionMatch = context.commentBody.match(/transition to (\w+) phase/i);
    if (!transitionMatch) {
        return;
    }
    
    const targetPhase = transitionMatch[1].toLowerCase();
    const currentPhase = phaseManager.parseCurrentPhase(issue.body);
    
    // Validate transition
    const validation = phaseManager.validateTransition(currentPhase, targetPhase);
    
    if (!validation.valid) {
        await withExponentialBackoff(() => github.createComment(context.issueNumber,
            `❌ **Invalid Phase Transition**\n\n` +
            `Cannot transition from **${currentPhase}** to **${targetPhase}**.\n\n` +
            `**Reason:** ${validation.error}\n\n` +
            validation.requiresApproval ? 
            `This transition requires explicit approval from a maintainer.` :
            `Please complete the current phase before advancing.`
        ));
        return;
    }
    
    // Check exit criteria
    const exitCriteria = await phaseManager.checkExitCriteria(currentPhase, issue.body);
    
    if (!exitCriteria.met) {
        await withExponentialBackoff(() => github.createComment(context.issueNumber,
            `⚠️ **Exit Criteria Not Met**\n\n` +
            `Cannot transition to **${targetPhase}** phase. The following exit criteria are not met:\n\n` +
            exitCriteria.missing.map(c => `- ❌ ${c.replace(/_/g, ' ')}`).join('\n') +
            `\n\nPlease complete these items before transitioning.`
        ));
        return;
    }
    
    // Post transition comment
    await withExponentialBackoff(() => github.createComment(context.issueNumber,
        phaseManager.generateTransitionComment(currentPhase, targetPhase, {
            duration: 'N/A',
            tasksCompleted: 1,
            agentsUsed: 0,
            exitCriteria: exitCriteria.missing
        })
    ));
    
    // Trigger phase transition workflow
    console.log(`Phase transition approved: ${currentPhase} -> ${targetPhase}`);
    console.log('Use manual workflow trigger to complete transition');
}

/**
 * Process general question or request
 */
async function processGeneralRequest(issue) {
    console.log('Processing general request');
    
    // Check if this is a status request
    if (context.commentBody.toLowerCase().includes('status')) {
        const progress = phaseManager.calculateProgress(issue.body);
        
        await withExponentialBackoff(() => github.createComment(context.issueNumber,
            `📊 **Current Status**\n\n` +
            `**Progress:** ${progress.percentage}%\n` +
            `**Current Phase:** ${phaseManager.capitalizeFirst(progress.current)}\n` +
            `**Completed Phases:** ${progress.completed.map(p => phaseManager.capitalizeFirst(p)).join(', ') || 'None'}\n` +
            `**Remaining Phases:** ${progress.remaining.map(p => phaseManager.capitalizeFirst(p)).join(', ')}\n\n` +
            `**Labels:** ${issue.labels.map(l => `\`${l.name}\``).join(', ')}`
        ));
        return;
    }
    
    // Check if this is a help request
    if (context.commentBody.toLowerCase().includes('help')) {
        await withExponentialBackoff(() => github.createComment(context.issueNumber,
            `ℹ️ **Available Commands**\n\n` +
            `Here are the commands you can use:\n\n` +
            `- **@claude [question]** - Ask Claude for assistance\n` +
            `- **@swarm [question]** - Ask AI Swarm for assistance\n` +
            `- **@ai [question]** - Ask any available AI (Claude preferred, falls back to Swarm)\n` +
            `- **status** - Get current issue status\n` +
            `- **transition to [phase] phase** - Request phase transition (EPIC only)\n` +
            `- **help** - Show this help message\n\n` +
            `**Labels you can add:**\n` +
            `- \`priority:high\` - Mark as high priority\n` +
            `- \`auto-close-on-complete\` - Auto-close when done\n` +
            `- \`keep-open\` - Prevent auto-closure\n` +
            `- \`automation:ignore\` - Skip automation\n\n` +
            `For more complex requests, mention @claude or use the manual workflow triggers.`
        ));
        return;
    }
    
    // For other requests, suggest using @claude
    if (isComplexRequest(context.commentBody)) {
        await withExponentialBackoff(() => github.createComment(context.issueNumber,
            `💡 **Suggestion**\n\n` +
            `@${context.actor}, your comment appears to contain a request or question. ` +
            `Try mentioning @claude for AI assistance:\n\n` +
            `\`\`\`\n@claude ${context.commentBody}\n\`\`\``
        ));
    }
}

/**
 * Check if we should process this comment
 */
function shouldProcessComment(issue) {
    // Don't process if issue has ignore label
    if (issue.labels.some(l => l.name === 'automation:ignore')) {
        return false;
    }
    
    // Don't process bot comments
    if (context.actor.includes('[bot]')) {
        return false;
    }
    
    return true;
}

/**
 * Check if comment is requesting phase transition
 */
function isPhaseTransitionRequest(comment) {
    return /transition to \w+ phase/i.test(comment);
}

/**
 * Check if comment is a question or request
 */
function isQuestionOrRequest(comment) {
    const keywords = ['?', 'please', 'can you', 'could you', 'help', 'status', 'update', 'what', 'how', 'why', 'when'];
    const lowerComment = comment.toLowerCase();
    
    return keywords.some(keyword => lowerComment.includes(keyword));
}

/**
 * Check if request is complex enough to warrant AI assistance
 */
function isComplexRequest(comment) {
    // Simple heuristic: comments with questions or multiple sentences
    const sentences = comment.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const hasQuestion = comment.includes('?');
    const wordCount = comment.split(/\s+/).length;
    
    return hasQuestion || sentences.length > 1 || wordCount > 20;
}

// Run the action
processComment().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
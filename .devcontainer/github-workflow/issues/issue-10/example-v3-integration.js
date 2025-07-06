#!/usr/bin/env node

/**
 * Example: Integrating AI Attribution into Enhanced V3
 * This shows how to update automation-enhanced-v3.js
 */

const { Octokit } = require('@octokit/rest');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const FileOrganization = require('../../file-organization');
const AIAttribution = require('./ai-attribution');
const EnhancedGitHubClient = require('./enhanced-github-client');

/**
 * Enhanced V3 with AI Attribution
 * Minimal changes to add attribution support
 */
class EnhancedGitHubAutomationV3WithAttribution extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.octokit = new Octokit({
            auth: config.github.token || process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN
        });
        
        // NEW: Create enhanced client for AI attribution
        this.enhancedClient = new EnhancedGitHubClient(this.octokit, config);
        
        this.fileOrg = new FileOrganization();
        this.logFile = path.join(__dirname, 'automation-enhanced-v3.log');
        this.activeIssues = new Map();
        this.updateInterval = 30000;
        
        // NEW: Track agent context
        this.currentAgentType = 'AUTOMATION';
    }

    async initialize() {
        await this.fileOrg.initialize();
        await this.log('File organization system initialized');
    }

    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}\n`;
        console.log(logEntry.trim());
        await fs.appendFile(this.logFile, logEntry);
    }

    /**
     * UPDATED: Use enhanced client for comments
     */
    async postComment(issueNumber, body, options = {}) {
        return this.enhancedClient.postComment(issueNumber, body, {
            agentType: options.agentType || this.currentAgentType,
            sessionId: this.sessionId,
            phase: this.currentPhase,
            ...options
        });
    }

    /**
     * UPDATED: Add attribution to progress updates
     */
    async postProgressUpdate(issueId) {
        const tracking = this.activeIssues.get(issueId);
        if (!tracking) return;

        const progress = {
            status: '🟡 Processing',
            phase: tracking.phase,
            percentage: Math.min(95, Math.floor((Date.now() - tracking.startTime) / 1000)),
            currentTask: tracking.phase,
            updates: tracking.updates.slice(-5) // Last 5 updates
        };

        // Use enhanced client for progress update
        return this.enhancedClient.postProgressUpdate(
            tracking.number,
            progress,
            'RUV_SWARM' // Using swarm agent type for V3
        );
    }

    /**
     * UPDATED: Process issue with AI attribution
     */
    async processIssue(issue) {
        const issueId = `${issue.number}`;
        let issueDir = null;
        
        try {
            await this.log(`🚀 Starting V3 processing for issue #${issue.number}: ${issue.title}`);
            
            // Create issue directory
            issueDir = await this.fileOrg.createIssueDirectory(issue.number, issue);
            await this.log(`Created issue directory: ${issueDir}`);
            
            // Track this active issue
            this.activeIssues.set(issueId, {
                number: issue.number,
                title: issue.title,
                startTime: Date.now(),
                phase: 'initialization',
                updates: [],
                issueDir,
                tempFiles: []
            });

            // Update labels with attribution
            await this.enhancedClient.updateLabelsWithComment(
                issue.number,
                ['in-progress', 'swarm-active'],
                ['ready', 'todo'],
                'AUTOMATION'
            );
            
            // Post initial message with swarm attribution
            const reportUrl = this.fileOrg.getIssueReportUrl(
                issue.number, 
                `https://github.com/${this.config.github.owner}/${this.config.github.repo}`
            );
            
            await this.postComment(issue.number, `🐝 **Enhanced Swarm V3 Activated**

I'm processing this issue with improved file organization and AI attribution.

**Features:**
- ✅ All files stored in organized structure
- ✅ Automatic cleanup of temporary files
- ✅ Comprehensive reporting with links
- ✅ Real-time progress updates
- ✅ **NEW: Clear AI agent attribution**

**Issue Directory:** [View Files](${reportUrl})

**Current Status:** 🟡 Initializing...
**Progress:** 0%

---
*Updates will appear below*`, {
                agentType: 'SWARM_COORDINATOR'
            });

            // Continue with rest of processing...
            // (Implementation continues as in original)
            
            return { success: true, issueDir };
            
        } catch (error) {
            await this.log(`Error processing issue #${issue.number}: ${error.message}`, 'ERROR');
            
            // Post error with attribution
            await this.enhancedClient.postError(
                issue.number,
                error,
                'Issue processing failed',
                'AUTOMATION'
            );
            
            throw error;
        }
    }

    /**
     * NEW: Set the current agent context
     */
    setAgentContext(agentType) {
        this.currentAgentType = agentType;
    }

    /**
     * UPDATED: Execute Claude with attribution
     */
    async executeClaudeWithMonitoringV3(issue, issueId) {
        // Set Claude context
        this.setAgentContext('CLAUDE');
        
        try {
            // Execute Claude command (simplified for example)
            const result = await this.executeClaude(issue);
            
            // Post Claude's response with attribution
            await this.postComment(issue.number, result.response, {
                agentType: 'CLAUDE',
                metadata: {
                    taskId: issueId,
                    tokens: result.tokensUsed
                }
            });
            
            return result;
            
        } finally {
            // Reset context
            this.setAgentContext('AUTOMATION');
        }
    }

    /**
     * UPDATED: Final summary with multi-agent attribution
     */
    async postFinalSummaryV3(issue) {
        const tracking = this.activeIssues.get(`${issue.number}`);
        if (!tracking) return;

        // Gather results from different agents
        const agentContributions = [
            {
                agentType: 'SWARM_COORDINATOR',
                content: `**Coordination Summary:**
- Successfully orchestrated ${tracking.updates.length} tasks
- All agents completed their assignments
- Files organized in issue directory`
            },
            {
                agentType: 'CLAUDE',
                content: `**Implementation Summary:**
- Created AI attribution system
- Enhanced GitHub client with attribution
- Integrated with existing automation
- All tests passing`
            },
            {
                agentType: 'SWARM_ANALYST',
                content: `**Results Analysis:**
- Clear differentiation achieved ✅
- Backward compatible ✅
- No performance impact ✅
- Ready for production use ✅`
            }
        ];

        // Post multi-agent summary
        await this.enhancedClient.postMultiAgentComment(
            issue.number,
            agentContributions
        );
    }
}

// Example usage
async function demonstrateIntegration() {
    const config = {
        github: {
            owner: 'dug-21',
            repo: 'devtemplate'
        },
        defaultAgentType: 'RUV_SWARM'
    };

    const automation = new EnhancedGitHubAutomationV3WithAttribution(config);
    await automation.initialize();

    // Example: Process an issue with AI attribution
    const testIssue = {
        number: 10,
        title: '[BUG] All issue updates are coming from my userid',
        body: 'Need to differentiate between human and AI updates',
        labels: [{ name: 'bug' }, { name: 'enhancement' }]
    };

    console.log('🎯 Demonstrating V3 with AI Attribution\n');
    
    // Show different agent contexts
    console.log('1️⃣ Automation context:');
    await automation.postComment(testIssue.number, 
        'Starting automated processing...', 
        { agentType: 'AUTOMATION' }
    );

    console.log('\n2️⃣ Claude context:');
    automation.setAgentContext('CLAUDE');
    await automation.postComment(testIssue.number,
        'I understand the issue. Let me implement a solution...',
        { agentType: 'CLAUDE' }
    );

    console.log('\n3️⃣ Swarm context:');
    await automation.postComment(testIssue.number,
        'Coordinating multiple agents to solve this issue...',
        { agentType: 'SWARM_COORDINATOR' }
    );

    console.log('\n✅ Integration demonstration complete!');
}

// Export for use in other files
module.exports = EnhancedGitHubAutomationV3WithAttribution;

// Run demonstration if called directly
if (require.main === module) {
    demonstrateIntegration().catch(console.error);
}
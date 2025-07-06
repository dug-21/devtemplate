#!/usr/bin/env node

/**
 * Enhanced GitHub Monitor V3 with File Organization
 * Features:
 * - Triggers V3 automation with proper file organization
 * - Monitors for new issues and comments
 * - Handles cleanup and organization
 */

const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');
const EnhancedGitHubAutomationV3 = require('./automation-enhanced-v3');

class EnhancedGitHubMonitorV3 {
    constructor(config) {
        this.config = config;
        this.octokit = new Octokit({
            auth: config.github.token || process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN
        });
        this.automation = new EnhancedGitHubAutomationV3(config);
        this.lastCheckFile = path.join(__dirname, '.last-check-enhanced-v3');
        this.processedComments = new Set();
        this.botUsername = null;
    }

    async initialize() {
        await this.automation.initialize();
        await this.log('Monitor V3 initialized with file organization');
    }

    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    async getBotUsername() {
        if (!this.botUsername) {
            const { data: user } = await this.octokit.users.getAuthenticated();
            this.botUsername = user.login;
            await this.log(`Bot username: ${this.botUsername}`);
        }
        return this.botUsername;
    }

    async getLastCheckTime() {
        try {
            const content = await fs.readFile(this.lastCheckFile, 'utf8');
            const date = new Date(content.trim());
            // Check if date is valid
            if (isNaN(date.getTime())) {
                await this.log(`Invalid date in last check file, using default`, 'WARN');
                return new Date(Date.now() - 24 * 60 * 60 * 1000);
            }
            return date;
        } catch (error) {
            // File doesn't exist, return 24 hours ago
            return new Date(Date.now() - 24 * 60 * 60 * 1000);
        }
    }

    async updateLastCheckTime() {
        await fs.writeFile(this.lastCheckFile, new Date().toISOString());
    }

    async checkForNewIssues() {
        const lastCheck = await this.getLastCheckTime();
        await this.log(`Checking for issues created after ${lastCheck.toISOString()}`);

        try {
            const { data: issues } = await this.octokit.issues.listForRepo({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                state: 'open',
                sort: 'created',
                direction: 'desc',
                since: lastCheck.toISOString(),
                per_page: 100
            });

            const newIssues = issues.filter(issue => {
                if (issue.pull_request) return false;
                if (new Date(issue.created_at) <= lastCheck) return false;
                
                const labels = issue.labels.map(l => l.name);
                if (this.config.filtering.ignoreLabels.some(l => labels.includes(l))) {
                    return false;
                }
                
                if (labels.includes(this.config.filtering.completionLabel)) {
                    return false;
                }
                
                if (this.config.filtering.requireLabels.length > 0) {
                    if (!this.config.filtering.requireLabels.some(l => labels.includes(l))) {
                        return false;
                    }
                }
                
                return true;
            });

            if (newIssues.length > 0) {
                await this.log(`Found ${newIssues.length} new issues to process`);
                
                for (const issue of newIssues) {
                    await this.log(`Processing issue #${issue.number}: ${issue.title}`);
                    
                    try {
                        await this.automation.processIssue(issue);
                        await this.log(`✅ Successfully processed issue #${issue.number}`);
                    } catch (error) {
                        await this.log(`❌ Failed to process issue #${issue.number}: ${error.message}`, 'ERROR');
                    }
                }
            }

        } catch (error) {
            await this.log(`Error checking for new issues: ${error.message}`, 'ERROR');
            if (error.message?.includes('secondary rate limit')) {
                throw error; // Re-throw to handle in performChecks
            }
        }
    }

    async checkForNewComments() {
        const lastCheck = await this.getLastCheckTime();
        const botUsername = await this.getBotUsername();
        
        await this.log(`Checking for new comments since ${lastCheck.toISOString()}`);

        try {
            const { data: issues } = await this.octokit.issues.listForRepo({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                state: 'open',
                sort: 'updated',
                direction: 'desc',
                since: lastCheck.toISOString(),
                per_page: 100
            });

            for (const issue of issues) {
                if (issue.pull_request) continue;
                
                const { data: comments } = await this.octokit.issues.listComments({
                    owner: this.config.github.owner,
                    repo: this.config.github.repo,
                    issue_number: issue.number,
                    since: lastCheck.toISOString(),
                    per_page: 100
                });

                const newHumanComments = comments.filter(comment => {
                    if (comment.user.login === botUsername) return false;
                    if (new Date(comment.created_at) <= lastCheck) return false;
                    if (this.processedComments.has(comment.id)) return false;
                    return true;
                });

                if (newHumanComments.length > 0) {
                    await this.log(`Found ${newHumanComments.length} new human comments on issue #${issue.number}`);
                    
                    for (const comment of newHumanComments) {
                        this.processedComments.add(comment.id);
                        
                        if (comment.body.toLowerCase().includes('help') || 
                            comment.body.toLowerCase().includes('please') ||
                            comment.body.toLowerCase().includes('update')) {
                            
                            await this.handleHumanComment(issue, comment);
                        }
                    }
                }
            }

        } catch (error) {
            await this.log(`Error checking for new comments: ${error.message}`, 'ERROR');
        }
    }

    async handleHumanComment(issue, comment) {
        await this.log(`Handling human comment on issue #${issue.number}`);
        
        try {
            await this.octokit.issues.createComment({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                issue_number: issue.number,
                body: `👋 Hello @${comment.user.login}!

I see your comment. I'm currently monitoring this issue.

If you need me to reprocess this issue with the latest updates, please add the \`reprocess\` label to trigger a new run.

For status updates, all files are organized in the issue directory.`
            });
            
        } catch (error) {
            await this.log(`Failed to respond to comment: ${error.message}`, 'ERROR');
        }
    }

    async checkForReprocessRequests() {
        await this.log('Checking for reprocess requests...');
        
        try {
            const { data: issues } = await this.octokit.issues.listForRepo({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                state: 'open',
                labels: 'reprocess',
                per_page: 100
            });

            for (const issue of issues) {
                await this.log(`Reprocessing issue #${issue.number}`);
                
                try {
                    await this.automation.processIssue(issue);
                    
                    // Remove reprocess label
                    await this.automation.updateIssueLabels(
                        issue.number,
                        [],
                        ['reprocess']
                    );
                    
                } catch (error) {
                    await this.log(`Failed to reprocess issue #${issue.number}: ${error.message}`, 'ERROR');
                }
            }
            
        } catch (error) {
            await this.log(`Error checking reprocess requests: ${error.message}`, 'ERROR');
        }
    }

    async runCleanup() {
        await this.log('Running periodic cleanup...');
        
        try {
            // Clean temporary files older than 24 hours
            await this.automation.fileOrg.cleanupTemp(24);
            await this.log('Cleaned up old temporary files');
            
        } catch (error) {
            await this.log(`Cleanup error: ${error.message}`, 'ERROR');
        }
    }

    async monitor() {
        await this.log('🚀 Starting Enhanced GitHub Monitor V3...');
        await this.log(`Repository: ${this.config.github.owner}/${this.config.github.repo}`);
        
        // Use pollInterval from config, default to 5 minutes if not set
        const checkInterval = this.config.github?.pollInterval || 300000;
        await this.log(`Check interval: ${checkInterval / 1000} seconds`);
        await this.log('File organization: ENABLED');
        
        // Initial check with delays to avoid rate limiting
        await this.performChecks();
        
        // Set up periodic checks
        setInterval(async () => {
            await this.performChecks();
        }, checkInterval);
        
        // Run cleanup every hour
        setInterval(async () => {
            await this.runCleanup();
        }, 60 * 60 * 1000);
        
        await this.log('Monitor is running. Press Ctrl+C to stop.');
    }
    
    async performChecks() {
        try {
            // Add delays between API calls to avoid rate limiting
            await this.checkForNewIssues();
            await this.delay(30000); // 30 second delay
            
            await this.checkForNewComments();
            await this.delay(30000); // 30 second delay
            
            await this.checkForReprocessRequests();
            await this.delay(30000); // 30 second delay
            
            await this.updateLastCheckTime();
        } catch (error) {
            if (error.message?.includes('secondary rate limit')) {
                await this.log('Rate limit hit, waiting 5 minutes before retry...', 'WARN');
                await this.delay(300000); // Wait 5 minutes
            } else {
                await this.log(`Error during checks: ${error.message}`, 'ERROR');
            }
        }
    }
    
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Load configuration
async function loadConfig() {
    const configPath = path.join(__dirname, 'config-enhanced.json');
    try {
        const configData = await fs.readFile(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('Failed to load config:', error.message);
        process.exit(1);
    }
}

// Main execution
if (require.main === module) {
    loadConfig().then(async config => {
        const monitor = new EnhancedGitHubMonitorV3(config);
        await monitor.initialize();
        await monitor.monitor();
    }).catch(console.error);
}

module.exports = EnhancedGitHubMonitorV3;
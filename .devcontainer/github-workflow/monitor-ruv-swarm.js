/**
 * GitHub Issue Monitor with ruv-swarm MCP Automation
 * Claude uses ruv-swarm MCP tools for orchestration
 */

const RuvSwarmGitHubAutomation = require('./automation-ruv-swarm');
const fs = require('fs').promises;
const path = require('path');

class GitHubSwarmMonitor {
    constructor() {
        this.configPath = path.join(__dirname, 'config-enhanced.json');
        this.lastCheckFile = path.join(__dirname, '.last-check');
        this.config = null;
        this.automation = null;
    }

    async init() {
        console.log('🚀 Initializing GitHub Monitor with ruv-swarm MCP...');
        
        // Load configuration
        this.config = JSON.parse(await fs.readFile(this.configPath, 'utf8'));
        
        // Add token from environment
        if (!this.config.github.token && process.env.AGENT_TOKEN) {
            this.config.github.token = process.env.AGENT_TOKEN;
        }
        
        if (!this.config.github.token) {
            throw new Error('No GitHub token found. Please set AGENT_TOKEN environment variable.');
        }
        
        // Initialize automation
        this.automation = new RuvSwarmGitHubAutomation(this.config);
        
        // Load last check time
        try {
            const lastCheck = await fs.readFile(this.lastCheckFile, 'utf8');
            this.lastCheck = new Date(lastCheck);
        } catch {
            this.lastCheck = new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to 24 hours ago
        }
        
        console.log(`📅 Last check: ${this.lastCheck.toISOString()}`);
    }

    async fetchIssues() {
        const { Octokit } = require('@octokit/rest');
        const octokit = new Octokit({
            auth: this.config.github.token
        });

        const issues = await octokit.issues.listForRepo({
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            state: 'open',
            sort: 'created',
            direction: 'desc',
            per_page: this.config.processing?.maxIssuesPerRun || 10
        });

        return issues.data;
    }

    shouldProcessIssue(issue) {
        // Skip drafts if configured
        if (this.config.filtering.ignoreDrafts && issue.draft) {
            return false;
        }

        // Skip if has any ignore labels
        const labels = issue.labels.map(l => l.name);
        for (const ignoreLabel of this.config.filtering.ignoreLabels) {
            if (labels.includes(ignoreLabel)) {
                return false;
            }
        }

        // Skip if no trigger labels (if configured)
        if (this.config.filtering.requireLabels && this.config.filtering.requireLabels.length > 0) {
            const hasRequiredLabel = this.config.filtering.requireLabels.some(
                label => labels.includes(label)
            );
            if (!hasRequiredLabel) {
                return false;
            }
        }

        // Skip if created before last check
        const createdAt = new Date(issue.created_at);
        if (createdAt < this.lastCheck) {
            return false;
        }

        return true;
    }

    async run() {
        try {
            await this.init();
            
            console.log('🔍 Fetching issues...');
            const issues = await this.fetchIssues();
            
            console.log(`📊 Found ${issues.length} total issues`);
            
            // Filter issues
            const issuesToProcess = issues.filter(issue => this.shouldProcessIssue(issue));
            
            console.log(`✅ ${issuesToProcess.length} issues need processing`);
            
            if (issuesToProcess.length === 0) {
                console.log('😴 No new issues to process');
                await this.updateLastCheck();
                return;
            }

            // Process each issue sequentially with ruv-swarm
            for (const [index, issue] of issuesToProcess.entries()) {
                console.log(`\n📋 Processing issue ${index + 1}/${issuesToProcess.length}: #${issue.number} - ${issue.title}`);
                
                try {
                    const result = await this.automation.processIssue(issue);
                    
                    if (result.success) {
                        console.log(`✅ Successfully orchestrated swarm for issue #${issue.number}`);
                    } else {
                        console.log(`❌ Failed to orchestrate swarm for issue #${issue.number}: ${result.error}`);
                    }
                    
                    // Add delay between issues
                    if (index < issuesToProcess.length - 1) {
                        const delay = this.config.processing?.processingDelay || this.config.automation?.processingDelay || 2000;
                        console.log(`⏳ Waiting ${delay/1000} seconds before next issue...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    
                } catch (error) {
                    console.error(`❌ Error processing issue #${issue.number}:`, error);
                }
            }

            // Update last check time
            await this.updateLastCheck();
            
            console.log('\n✨ Swarm monitor run completed');
            
        } catch (error) {
            console.error('❌ Monitor error:', error);
            process.exit(1);
        }
    }

    async updateLastCheck() {
        const now = new Date();
        await fs.writeFile(this.lastCheckFile, now.toISOString());
        this.lastCheck = now;
        console.log(`📝 Updated last check time to ${now.toISOString()}`);
    }
}

// Run if called directly
if (require.main === module) {
    const monitor = new GitHubSwarmMonitor();
    monitor.run().catch(console.error);
}

module.exports = GitHubSwarmMonitor;
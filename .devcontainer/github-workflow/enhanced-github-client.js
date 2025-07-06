/**
 * Enhanced GitHub Client with AI Attribution
 * Extends the standard GitHub automation to include AI attribution
 */

const AIAttribution = require('./ai-attribution');

class EnhancedGitHubClient {
    constructor(octokit, config) {
        this.octokit = octokit;
        this.config = config;
        this.attribution = new AIAttribution();
        this.defaultAgentType = config.defaultAgentType || 'CLAUDE';
    }

    /**
     * Post a comment with automatic AI attribution
     * @param {number} issueNumber - GitHub issue number
     * @param {string} body - Comment body
     * @param {Object} options - Additional options
     * @returns {Promise} - GitHub API response
     */
    async postComment(issueNumber, body, options = {}) {
        // Determine if this should have AI attribution
        const shouldAddAttribution = options.attribution !== false && 
                                   (options.agentType || this.isAutomatedContext());

        let finalBody = body;
        
        if (shouldAddAttribution) {
            const agentType = options.agentType || this.defaultAgentType;
            const metadata = {
                taskId: options.taskId,
                sessionId: options.sessionId,
                phase: options.phase,
                automated: true,
                ...options.metadata
            };
            
            finalBody = this.attribution.wrapWithAttribution(body, agentType, metadata);
        }

        // Post the comment
        return this.octokit.rest.issues.createComment({
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            issue_number: issueNumber,
            body: finalBody
        });
    }

    /**
     * Post a progress update with proper attribution
     */
    async postProgressUpdate(issueNumber, progress, agentType) {
        const body = this.attribution.createProgressUpdate(progress, agentType);
        
        return this.octokit.rest.issues.createComment({
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            issue_number: issueNumber,
            body
        });
    }

    /**
     * Post an error message with attribution
     */
    async postError(issueNumber, error, context, agentType = 'AUTOMATION') {
        const body = this.attribution.createErrorMessage(error, context, agentType);
        
        return this.octokit.rest.issues.createComment({
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            issue_number: issueNumber,
            body
        });
    }

    /**
     * Update issue labels with attribution comment
     */
    async updateLabelsWithComment(issueNumber, addLabels, removeLabels, agentType) {
        // Update labels
        if (addLabels && addLabels.length > 0) {
            await this.octokit.rest.issues.addLabels({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                issue_number: issueNumber,
                labels: addLabels
            });
        }

        if (removeLabels && removeLabels.length > 0) {
            for (const label of removeLabels) {
                try {
                    await this.octokit.rest.issues.removeLabel({
                        owner: this.config.github.owner,
                        repo: this.config.github.repo,
                        issue_number: issueNumber,
                        name: label
                    });
                } catch (e) {
                    // Label might not exist, ignore
                }
            }
        }

        // Post attribution comment about label changes
        const changes = [];
        if (addLabels && addLabels.length > 0) {
            changes.push(`Added labels: ${addLabels.map(l => `\`${l}\``).join(', ')}`);
        }
        if (removeLabels && removeLabels.length > 0) {
            changes.push(`Removed labels: ${removeLabels.map(l => `\`${l}\``).join(', ')}`);
        }

        if (changes.length > 0) {
            await this.postComment(
                issueNumber,
                `🏷️ **Label Update**\n\n${changes.join('\n')}`,
                { agentType: agentType || 'AUTOMATION' }
            );
        }
    }

    /**
     * Check if we're in an automated context
     */
    isAutomatedContext() {
        // Check various indicators that this is an automated run
        return process.env.GITHUB_ACTIONS === 'true' ||
               process.env.CI === 'true' ||
               process.env.AUTOMATION_ENABLED === 'true' ||
               process.argv.includes('--automated');
    }

    /**
     * Create a batch comment with multiple agent contributions
     */
    async postMultiAgentComment(issueNumber, contributions) {
        const sections = [];
        
        for (const contribution of contributions) {
            const agent = this.attribution.agentTypes[contribution.agentType] || 
                         this.attribution.agentTypes.CLAUDE;
            
            sections.push([
                `### ${agent.emoji} ${agent.name} Report`,
                ``,
                contribution.content,
                ``
            ].join('\n'));
        }

        const body = [
            `🤝 **Multi-Agent Update**`,
            ``,
            `*This update contains contributions from multiple AI agents*`,
            ``,
            `---`,
            ``,
            sections.join('\n---\n\n'),
            ``,
            `---`,
            `*Generated by ruv-swarm Multi-Agent System*`,
            `*Timestamp: ${new Date().toISOString()}*`
        ].join('\n');

        return this.octokit.rest.issues.createComment({
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            issue_number: issueNumber,
            body
        });
    }

    /**
     * Get all AI-generated comments on an issue
     */
    async getAIComments(issueNumber) {
        const allComments = await this.octokit.paginate(
            this.octokit.rest.issues.listComments,
            {
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                issue_number: issueNumber
            }
        );

        return allComments.filter(comment => 
            this.attribution.isAIGenerated(comment.body)
        ).map(comment => ({
            ...comment,
            agentType: this.attribution.extractAgentType(comment.body)
        }));
    }
}

module.exports = EnhancedGitHubClient;
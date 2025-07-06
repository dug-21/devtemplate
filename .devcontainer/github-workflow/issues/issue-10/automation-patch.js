/**
 * Patch for existing automation classes to add AI attribution
 * This can be applied to any automation class that extends the base
 */

const AIAttribution = require('./ai-attribution');
const EnhancedGitHubClient = require('./enhanced-github-client');

/**
 * Enhance an existing automation class with AI attribution
 * @param {Class} AutomationClass - The class to enhance
 * @returns {Class} - Enhanced class with AI attribution
 */
function enhanceWithAttribution(AutomationClass) {
    return class extends AutomationClass {
        constructor(config) {
            super(config);
            
            // Create enhanced GitHub client
            this.enhancedClient = new EnhancedGitHubClient(this.octokit, this.config);
            
            // Store original postComment for fallback
            this._originalPostComment = this.postComment.bind(this);
        }

        /**
         * Override postComment to add AI attribution
         */
        async postComment(issueNumber, body, options = {}) {
            // Use enhanced client for AI attribution
            return this.enhancedClient.postComment(issueNumber, body, {
                agentType: this.getAgentType(),
                sessionId: this.sessionId,
                phase: this.currentPhase,
                ...options
            });
        }

        /**
         * Post a welcome comment with AI attribution
         */
        async postWelcomeComment(issue) {
            const body = `👋 **Welcome!**

Thank you for creating this issue. I'll help process it automatically.

**What happens next:**
- I'll analyze the issue content
- Apply appropriate labels
- Trigger relevant automation workflows
- Provide updates on progress

Please feel free to add any additional context while I work on this.`;

            return this.postComment(issue.number, body, {
                agentType: 'AUTOMATION'
            });
        }

        /**
         * Post swarm activation comment with attribution
         */
        async postSwarmComment(issue, phase, swarmConfig) {
            const agentList = swarmConfig.agents.map(a => `- ${a}`).join('\n');
            
            const body = `🐝 **Swarm Activated for ${phase} Phase**

I'm deploying a specialized agent swarm to handle this ${phase} task.

**Active Agents:**
${agentList}

**What to expect:**
- Agents will collaborate on the task
- Each agent will provide specialized insights
- Results will be compiled and presented
- You'll receive regular progress updates

The swarm is now active and working on your issue.`;

            return this.postComment(issue.number, body, {
                agentType: 'SWARM_COORDINATOR',
                phase: phase
            });
        }

        /**
         * Determine the agent type based on context
         */
        getAgentType() {
            // Check for specific agent context
            if (this.agentType) return this.agentType;
            
            // Check for swarm context
            if (this.swarmRole) {
                switch(this.swarmRole) {
                    case 'researcher': return 'SWARM_RESEARCHER';
                    case 'coder': return 'SWARM_CODER';
                    case 'analyst': return 'SWARM_ANALYST';
                    case 'coordinator': return 'SWARM_COORDINATOR';
                    default: return 'RUV_SWARM';
                }
            }
            
            // Check for Claude context
            if (process.env.CLAUDE_CONTEXT === 'true' || this.usingClaude) {
                return 'CLAUDE';
            }
            
            // Default to automation
            return 'AUTOMATION';
        }

        /**
         * Post progress update with proper attribution
         */
        async postProgressUpdate(issueNumber, progress) {
            return this.enhancedClient.postProgressUpdate(
                issueNumber, 
                progress,
                this.getAgentType()
            );
        }

        /**
         * Post error with attribution
         */
        async postErrorComment(issueNumber, error, context) {
            return this.enhancedClient.postError(
                issueNumber,
                error,
                context,
                this.getAgentType()
            );
        }

        /**
         * Update labels with attribution
         */
        async updateIssueLabels(issueNumber, addLabels, removeLabels) {
            return this.enhancedClient.updateLabelsWithComment(
                issueNumber,
                addLabels,
                removeLabels,
                this.getAgentType()
            );
        }

        /**
         * Post a summary with multi-agent contributions
         */
        async postMultiAgentSummary(issueNumber, agentResults) {
            const contributions = Object.entries(agentResults).map(([agent, result]) => ({
                agentType: this.mapAgentToType(agent),
                content: result.summary || result.message || 'No summary provided'
            }));

            return this.enhancedClient.postMultiAgentComment(issueNumber, contributions);
        }

        /**
         * Map agent names to types
         */
        mapAgentToType(agentName) {
            const mapping = {
                'researcher': 'SWARM_RESEARCHER',
                'coder': 'SWARM_CODER',
                'analyst': 'SWARM_ANALYST',
                'coordinator': 'SWARM_COORDINATOR',
                'claude': 'CLAUDE',
                'automation': 'AUTOMATION'
            };
            
            return mapping[agentName.toLowerCase()] || 'RUV_SWARM';
        }
    };
}

module.exports = {
    enhanceWithAttribution,
    AIAttribution,
    EnhancedGitHubClient
};
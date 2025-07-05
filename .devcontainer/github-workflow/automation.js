const { Octokit } = require('@octokit/rest');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class GitHubWorkflowAutomation {
  constructor(config) {
    this.config = config;
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || process.env.AGENT_TOKEN
    });
  }

  async processIssue(issue) {
    console.log(`🔄 Processing issue #${issue.number}: ${issue.title}`);
    
    try {
      const phase = this.detectPhase(issue);
      const actions = [];

      // Welcome new issues
      if (this.isNewIssue(issue) && this.config.automation.welcomeNewIssues) {
        await this.postWelcomeComment(issue);
        actions.push('welcomed');
      }

      // Trigger appropriate swarm based on phase
      if (phase) {
        await this.triggerSwarmForPhase(issue, phase);
        actions.push(`swarm-triggered-${phase}`);
      }

      // Auto-assign labels if configured
      if (this.config.automation.autoLabel) {
        const newLabels = this.suggestLabels(issue);
        if (newLabels.length > 0) {
          await this.addLabels(issue, newLabels);
          actions.push(`labeled-${newLabels.join(',')}`);
        }
      }

      return { success: true, phase, actions };
    } catch (error) {
      console.error(`❌ Error processing issue #${issue.number}:`, error);
      return { success: false, error: error.message };
    }
  }

  detectPhase(issue) {
    const labels = issue.labels.map(l => l.name);
    
    if (labels.includes('phase:idea')) return 'idea';
    if (labels.includes('phase:research')) return 'research';
    if (labels.includes('phase:planning')) return 'planning';
    if (labels.includes('phase:implementation')) return 'implementation';
    
    // Fallback to title analysis
    const title = issue.title.toLowerCase();
    if (title.includes('idea') || title.includes('concept')) return 'idea';
    if (title.includes('research') || title.includes('analyze')) return 'research';
    if (title.includes('plan') || title.includes('design')) return 'planning';
    if (title.includes('implement') || title.includes('build')) return 'implementation';
    
    return null;
  }

  async triggerSwarmForPhase(issue, phase) {
    const swarmConfig = this.config.phases[phase];
    if (!swarmConfig) return;

    const task = this.generateTaskDescription(issue, phase);
    
    console.log(`🐝 Triggering ${phase} swarm for issue #${issue.number}`);
    
    try {
      // Initialize swarm and spawn agents
      const commands = [
        'npx ruv-swarm init hierarchical --claude',
        ...swarmConfig.agents.map(agent => `npx ruv-swarm spawn ${agent} --name "${phase}-${agent}"`),
        `npx ruv-swarm orchestrate "${task}"`
      ];

      for (const cmd of commands) {
        await execAsync(cmd);
      }

      // Post swarm activation comment
      await this.postSwarmComment(issue, phase, swarmConfig);
      
    } catch (error) {
      console.error(`Failed to trigger swarm:`, error);
      throw error;
    }
  }

  generateTaskDescription(issue, phase) {
    const templates = {
      idea: `Analyze idea feasibility: ${issue.title}`,
      research: `Conduct research for: ${issue.title}`,
      planning: `Create implementation plan for: ${issue.title}`,
      implementation: `Implement feature: ${issue.title}`
    };
    
    return templates[phase] || `Process ${phase} for: ${issue.title}`;
  }

  async postWelcomeComment(issue) {
    const message = `👋 Thanks for opening this issue, @${issue.user.login}!

🤖 Our GitHub workflow automation has been activated and will begin processing this shortly.

The appropriate ruv-swarm will be deployed based on the issue phase and labels.`;

    await this.postComment(issue.number, message);
  }

  async postSwarmComment(issue, phase, swarmConfig) {
    const agentList = swarmConfig.agents.join(', ');
    const message = `🐝 **${phase.toUpperCase()} Swarm Activated**

A ${phase} swarm has been deployed with the following agents:
- **Agents**: ${agentList}
- **Strategy**: ${swarmConfig.strategy || 'adaptive'}

The swarm will analyze this issue and provide updates here.

---
*Automated by ruv-swarm GitHub workflow integration*`;

    await this.postComment(issue.number, message);
  }

  async postComment(issueNumber, body) {
    return this.octokit.rest.issues.createComment({
      owner: this.config.github.owner,
      repo: this.config.github.repo,
      issue_number: issueNumber,
      body
    });
  }

  async addLabels(issue, labels) {
    return this.octokit.rest.issues.addLabels({
      owner: this.config.github.owner,
      repo: this.config.github.repo,
      issue_number: issue.number,
      labels
    });
  }

  suggestLabels(issue) {
    const suggestions = [];
    const title = issue.title.toLowerCase();
    const body = (issue.body || '').toLowerCase();
    
    // Suggest labels based on content
    if (title.includes('bug') || body.includes('error')) {
      suggestions.push('bug');
    }
    if (title.includes('feature') || title.includes('enhancement')) {
      suggestions.push('enhancement');
    }
    if (title.includes('doc') || body.includes('documentation')) {
      suggestions.push('documentation');
    }
    if (issue.labels.length === 0) {
      suggestions.push('needs-triage');
    }
    
    return suggestions;
  }

  isNewIssue(issue) {
    const created = new Date(issue.created_at);
    const now = new Date();
    const ageMinutes = (now - created) / (1000 * 60);
    return ageMinutes < 30; // Consider "new" if less than 30 minutes old
  }
}

module.exports = { GitHubWorkflowAutomation };
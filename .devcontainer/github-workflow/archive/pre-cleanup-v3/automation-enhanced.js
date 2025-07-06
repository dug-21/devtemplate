const { Octokit } = require('@octokit/rest');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

class GitHubWorkflowAutomation {
  constructor(config) {
    this.config = config;
    this.octokit = new Octokit({
      auth: process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN
    });
    // Enhanced tracking to prevent reprocessing
    this.processedTasksFile = '.devcontainer/github-workflow/.processed-tasks.json';
    this.processedTasks = new Map();
  }

  async initialize() {
    // Load previously processed tasks
    try {
      const data = await fs.readFile(this.processedTasksFile, 'utf8');
      const processed = JSON.parse(data);
      this.processedTasks = new Map(processed);
    } catch (error) {
      // File doesn't exist yet, start fresh
      this.processedTasks = new Map();
    }
  }

  async processIssue(issue) {
    console.log(`🔄 Processing issue #${issue.number}: ${issue.title}`);
    
    // Check if we should skip this issue
    if (this.shouldSkipIssue(issue)) {
      console.log(`⏭️ Skipping issue #${issue.number} - filtered or already processed`);
      return { success: true, skipped: true };
    }
    
    // Check if already has swarm-processed label
    const labels = issue.labels.map(l => l.name);
    if (labels.includes('swarm-processed')) {
      console.log(`✓ Issue #${issue.number} already has swarm-processed label`);
      return { success: true, cached: true };
    }
    
    try {
      const phase = this.detectPhase(issue);
      const actions = [];
      
      // Create unique task ID for tracking
      const taskId = `${issue.number}-${issue.updated_at}-${phase}`;
      
      // Check if already processed
      if (this.processedTasks.has(taskId)) {
        console.log(`✓ Issue #${issue.number} already processed for phase ${phase}`);
        return { success: true, cached: true };
      }

      // Process in parallel using ruv-swarm
      const results = await this.processWithSwarm(issue, phase);
      
      // Mark as processed
      this.processedTasks.set(taskId, {
        timestamp: new Date().toISOString(),
        phase,
        results
      });
      await this.saveProcessedTasks();
      
      return { success: true, phase, results };
    } catch (error) {
      console.error(`❌ Error processing issue #${issue.number}:`, error);
      return { success: false, error: error.message };
    }
  }

  shouldSkipIssue(issue) {
    // Skip if draft (for GitHub Projects support)
    if (issue.draft) return true;
    
    // Skip if has ignore label
    const labels = issue.labels.map(l => l.name);
    if (labels.includes('automation:ignore') || labels.includes('no-automation')) {
      return true;
    }
    
    // Skip pull requests
    if (issue.pull_request) return true;
    
    return false;
  }

  detectPhase(issue) {
    const labels = issue.labels.map(l => l.name);
    
    // Check labels first
    for (const label of labels) {
      if (label.startsWith('phase:')) {
        return label.replace('phase:', '');
      }
    }
    
    // Check project column (if available)
    if (issue.project_column) {
      const columnName = issue.project_column.name.toLowerCase();
      if (columnName.includes('idea')) return 'idea';
      if (columnName.includes('research')) return 'research';
      if (columnName.includes('planning')) return 'planning';
      if (columnName.includes('implementation')) return 'implementation';
    }
    
    // Fallback to title analysis
    const title = issue.title.toLowerCase();
    if (title.includes('idea') || title.includes('concept')) return 'idea';
    if (title.includes('research') || title.includes('analyze')) return 'research';
    if (title.includes('plan') || title.includes('design')) return 'planning';
    if (title.includes('implement') || title.includes('build')) return 'implementation';
    
    return null;
  }

  async processWithSwarm(issue, phase) {
    const swarmConfig = this.config.phases[phase];
    if (!swarmConfig) return null;

    console.log(`🐝 Initiating parallel swarm processing for ${phase} phase`);
    
    // Create task context for Claude Code
    const context = {
      issue: {
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        url: `https://github.com/${this.config.github.owner}/${this.config.github.repo}/issues/${issue.number}`,
        author: issue.user.login,
        labels: issue.labels.map(l => l.name)
      },
      phase,
      repository: `${this.config.github.owner}/${this.config.github.repo}`,
      requirements: this.getPhaseRequirements(phase)
    };
    
    // Save context for Claude Code to access
    const contextFile = `.devcontainer/github-workflow/.swarm-context-${issue.number}.json`;
    await fs.writeFile(contextFile, JSON.stringify(context, null, 2));
    
    // Use the orchestration script that properly sets up the swarm
    const orchestrationScript = path.join(__dirname, 'orchestrate-github-issue.js');
    
    console.log(`🐝 Launching ruv-swarm orchestration for issue #${issue.number}...`);
    
    // Execute the orchestration with proper environment
    const env = {
      ...process.env,
      AGENT_TOKEN: process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN,
      GITHUB_OWNER: this.config.github.owner,
      GITHUB_REPO: this.config.github.repo
    };
    
    const { stdout, stderr } = await execAsync(
      `node ${orchestrationScript} ${contextFile}`,
      { env }
    );
    
    console.log(stdout);
    if (stderr) console.error('Orchestration warnings:', stderr);
    
    try {
      // Post initial comment to GitHub
      await this.postSwarmStartComment(issue, phase, swarmConfig);
      
      // Track this task as processed
      const taskId = `${issue.number}-${issue.updated_at}-${phase}`;
      this.processedTasks.set(taskId, {
        issueNumber: issue.number,
        phase,
        processedAt: new Date().toISOString(),
        swarmId: `swarm-${Date.now()}`
      });
      await this.saveProcessedTasks();
      
      // Swarm is now orchestrating the task
      console.log(`✅ Swarm orchestration initiated for issue #${issue.number}. Agents will coordinate to analyze and respond.`);
      
      // Clean up context file after a delay
      setTimeout(async () => {
        try {
          await fs.unlink(contextFile);
        } catch (error) {
          // Ignore if already deleted
        }
      }, 300000); // 5 minutes
      
      return { swarmId: `swarm-${Date.now()}`, phase, initiated: true };
      
    } catch (error) {
      console.error(`Failed to process with swarm:`, error);
      await this.postErrorComment(issue, phase, error);
      throw error;
    }
  }

  getPhaseInstructions(phase) {
    const instructions = {
      idea: `Analyze the feasibility of this idea. Research similar implementations, evaluate complexity, identify challenges and opportunities.`,
      
      research: `Conduct thorough research on this topic. Find best practices, compare solutions, analyze trade-offs. Create comparison tables and provide actionable recommendations.`,
      
      planning: `Create a detailed implementation plan. Design the architecture, break down into tasks, estimate effort, identify risks. Include diagrams and technical specifications.`,
      
      implementation: `Provide implementation guidance. Create code templates, define testing strategy, specify deployment steps. Include example code and configuration.`
    };
    
    return instructions[phase] || `Process this ${phase} issue with comprehensive analysis.`;
  }

  getPhaseRequirements(phase) {
    return {
      idea: ['feasibility analysis', 'complexity assessment', 'recommendations'],
      research: ['best practices', 'comparison matrix', 'pros/cons analysis', 'recommendations'],
      planning: ['architecture design', 'task breakdown', 'time estimates', 'risk assessment'],
      implementation: ['code examples', 'testing approach', 'deployment guide', 'configuration']
    }[phase] || [];
  }

  async postSwarmStartComment(issue, phase, swarmConfig) {
    const topology = swarmConfig.topology || 'hierarchical';
    const agentCount = swarmConfig.agents?.length || 3;
    
    const message = `🐝 **${phase.toUpperCase()} Swarm Initiated**

Processing your issue with a dedicated ruv-swarm:
- **Topology**: ${topology} (optimized for ${phase})
- **Specialized Agents**: ${agentCount} agents working together
- **Strategy**: ${swarmConfig.strategy || 'adaptive'}

Your dedicated swarm is now analyzing this issue. Claude Code will execute the analysis and post comprehensive results shortly.

⏳ Expected completion: 2-5 minutes

---
*Powered by ruv-swarm + Claude Code integration*`;

    await this.postComment(issue.number, message);
  }

  async postErrorComment(issue, phase, error) {
    const message = `❌ **Swarm Processing Error**

Failed to process ${phase} phase for this issue.

**Error**: ${error.message || error}

The team has been notified. You may need to process this manually or check the automation configuration.

---
*If this persists, please check the automation logs or contact support.*`;

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

  async saveProcessedTasks() {
    const data = Array.from(this.processedTasks.entries());
    await fs.writeFile(this.processedTasksFile, JSON.stringify(data, null, 2));
  }

  // Enhanced to support GitHub Projects
  async fetchIssuesWithProjects() {
    const issues = await this.octokit.rest.issues.listForRepo({
      owner: this.config.github.owner,
      repo: this.config.github.repo,
      state: 'open',
      per_page: 100
    });
    
    // Enhance with project data if available
    if (this.config.github.projectNumber) {
      try {
        const projectData = await this.octokit.rest.projects.listCards({
          column_id: this.config.github.projectColumnId
        });
        
        // Merge project column data with issues
        const projectIssueMap = new Map();
        for (const card of projectData.data) {
          if (card.content_url) {
            const issueNumber = parseInt(card.content_url.split('/').pop());
            projectIssueMap.set(issueNumber, card.column_url);
          }
        }
        
        // Add project column to issues
        issues.data = issues.data.map(issue => ({
          ...issue,
          project_column: projectIssueMap.get(issue.number)
        }));
        
      } catch (error) {
        console.warn('⚠️ Could not fetch project data:', error.message);
      }
    }
    
    return issues.data;
  }

  async saveProcessedTasks() {
    try {
      const data = JSON.stringify([...this.processedTasks.entries()], null, 2);
      await fs.writeFile(this.processedTasksFile, data);
    } catch (error) {
      console.error('Failed to save processed tasks:', error);
    }
  }
}

module.exports = { GitHubWorkflowAutomation };
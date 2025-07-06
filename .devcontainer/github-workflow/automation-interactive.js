const { Octokit } = require('@octokit/rest');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

class InteractiveGitHubAutomation {
  constructor(config) {
    this.config = config;
    this.octokit = new Octokit({
      auth: process.env.AGENT_TOKEN
    });
    this.processedTasksFile = '.devcontainer/github-workflow/.processed-tasks.json';
    this.processedTasks = new Map();
  }

  async initialize() {
    try {
      const data = await fs.readFile(this.processedTasksFile, 'utf8');
      const processed = JSON.parse(data);
      this.processedTasks = new Map(processed);
    } catch (error) {
      this.processedTasks = new Map();
    }
  }

  async processIssue(issue) {
    console.log(`\n🔄 Processing issue #${issue.number}: ${issue.title}`);
    
    // Check if already processed
    const taskId = `${issue.number}-${issue.updated_at}`;
    if (this.processedTasks.has(taskId)) {
      console.log(`✓ Already processed`);
      return { success: true, cached: true };
    }
    
    const phase = this.detectPhase(issue);
    const labels = issue.labels.map(l => l.name);
    
    // Skip if has ignore labels
    if (labels.some(l => ['automation:ignore', 'no-automation', 'wip'].includes(l))) {
      console.log(`⏭️ Skipping - has ignore label`);
      return { success: true, skipped: true };
    }
    
    // Skip if already processed
    if (labels.includes('swarm-processed')) {
      console.log(`✓ Already has swarm-processed label`);
      return { success: true, cached: true };
    }
    
    try {
      // Post initial comment
      await this.postComment(issue.number, `🐝 **${phase.toUpperCase()} Swarm Initiating**

I'm deploying a swarm to analyze this issue. The swarm will provide updates as it progresses through the analysis.

**You can guide the process** by commenting at any time. The swarm will incorporate your feedback.

🤖 Initializing specialized agents...`);
      
      // Initialize swarm
      console.log(`🐝 Initializing swarm...`);
      await execAsync(`npx ruv-swarm init hierarchical 5 --force`);
      
      // Create the GitHub posting instructions
      const githubInstructions = `
IMPORTANT: Throughout your analysis, use Claude to post updates to GitHub issue #${issue.number}.
Tell Claude: "Use the GitHub MCP tool mcp__github__add_issue_comment to post an update to issue ${issue.number} in repository ${this.config.github.owner}/${this.config.github.repo}"
Post updates for each major step:
1. When starting analysis
2. When discovering key insights
3. When evaluating options
4. When forming recommendations
5. When completing analysis`;

      // Spawn coordinator with GitHub posting instructions
      console.log(`🤖 Spawning coordinator with GitHub integration...`);
      await execAsync(`npx ruv-swarm spawn coordinator "GitHub Issue Coordinator - ${githubInstructions}"`);
      
      // Spawn specialized agents based on phase
      const agents = this.getPhaseAgents(phase);
      for (const agent of agents) {
        console.log(`🤖 Spawning ${agent.type}: ${agent.name}...`);
        await execAsync(`npx ruv-swarm spawn ${agent.type} "${agent.name} - Must coordinate with GitHub Issue Coordinator for updates"`);
      }
      
      // Post agent lineup
      await this.postComment(issue.number, `🤖 **Swarm Agents Deployed**

The following specialized agents are now analyzing your issue:
${agents.map(a => `- **${a.name}** (${a.type})`).join('\n')}

They will post updates as they progress. Feel free to provide guidance or ask questions!`);
      
      // Create the orchestration task
      const task = `
Analyze GitHub issue #${issue.number}: "${issue.title}"

${issue.body ? `Issue Description: ${issue.body.substring(0, 500)}...` : ''}

Phase: ${phase}
Focus: ${this.getPhaseInstructions(phase)}

CRITICAL INSTRUCTIONS:
1. Post updates to GitHub as you progress using Claude and the GitHub MCP tools
2. Each agent should share their findings via GitHub comments
3. Coordinator should synthesize findings and post comprehensive analysis
4. Check the GitHub issue for any new user comments and incorporate their feedback
5. End with clear recommendations and next steps

Repository: ${this.config.github.owner}/${this.config.github.repo}
Issue URL: https://github.com/${this.config.github.owner}/${this.config.github.repo}/issues/${issue.number}
`;
      
      console.log(`🚀 Orchestrating interactive task...`);
      await execAsync(`npx ruv-swarm orchestrate "${task}"`);
      
      // Give the swarm time to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Post status update
      await this.postComment(issue.number, `⚡ **Swarm Analysis In Progress**

The agents are now working on your issue. They will post updates as they discover insights.

🔄 **Current Status**: Analysis phase started
📊 **Expected Duration**: 3-5 minutes
💡 **Tip**: You can guide the analysis by commenting with additional context or questions!`);
      
      // Track as processed
      this.processedTasks.set(taskId, {
        issueNumber: issue.number,
        phase,
        processedAt: new Date().toISOString()
      });
      await this.saveProcessedTasks();
      
      // The swarm will handle the rest of the updates and final analysis
      console.log(`✅ Interactive swarm deployed for issue #${issue.number}`);
      
      // Note: We'll add the swarm-processed label after a delay to ensure analysis is complete
      setTimeout(async () => {
        try {
          const newLabels = [...labels, 'swarm-processed'];
          await this.octokit.rest.issues.update({
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            issue_number: issue.number,
            labels: newLabels
          });
          
          // Check for auto-close
          if (labels.includes('auto-close-on-complete') && phase === 'implementation' && !labels.includes('keep-open')) {
            await this.octokit.rest.issues.update({
              owner: this.config.github.owner,
              repo: this.config.github.repo,
              issue_number: issue.number,
              state: 'closed'
            });
          }
        } catch (e) {
          console.error('Failed to update labels:', e);
        }
      }, 300000); // 5 minutes
      
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Failed to process:`, error.message);
      await this.postComment(issue.number, `❌ **Swarm Initialization Error**

Failed to deploy the analysis swarm: ${error.message}

Please try again or contact support if the issue persists.`);
      throw error;
    }
  }
  
  getPhaseAgents(phase) {
    const agentConfigs = {
      idea: [
        { type: 'researcher', name: 'Feasibility Researcher' },
        { type: 'analyst', name: 'Market Analyst' },
        { type: 'analyst', name: 'Technical Feasibility Expert' }
      ],
      research: [
        { type: 'researcher', name: 'Literature Reviewer' },
        { type: 'researcher', name: 'Best Practices Expert' },
        { type: 'analyst', name: 'Comparative Analyst' }
      ],
      planning: [
        { type: 'architect', name: 'System Architect' },
        { type: 'analyst', name: 'Risk Analyst' },
        { type: 'coder', name: 'Technical Planner' }
      ],
      implementation: [
        { type: 'architect', name: 'Implementation Architect' },
        { type: 'coder', name: 'Code Designer' },
        { type: 'tester', name: 'Testing Strategist' }
      ]
    };
    
    return agentConfigs[phase] || agentConfigs.research;
  }
  
  detectPhase(issue) {
    const labels = issue.labels.map(l => l.name);
    const phases = ['idea', 'research', 'planning', 'implementation'];
    
    for (const phase of phases) {
      if (labels.includes(`phase:${phase}`)) return phase;
    }
    
    // Check title/body
    const text = `${issue.title} ${issue.body || ''}`.toLowerCase();
    if (text.includes('idea') || text.includes('suggestion')) return 'idea';
    if (text.includes('research') || text.includes('investigate')) return 'research';
    if (text.includes('plan') || text.includes('design')) return 'planning';
    if (text.includes('implement') || text.includes('build')) return 'implementation';
    
    return 'research'; // default
  }
  
  getPhaseInstructions(phase) {
    const instructions = {
      idea: 'Analyze feasibility, identify challenges, assess complexity, explore market fit',
      research: 'Find best practices, compare solutions, analyze trade-offs, gather evidence',
      planning: 'Design architecture, break down tasks, estimate effort, identify risks',
      implementation: 'Create code structure, define tests, specify deployment, detail configuration'
    };
    return instructions[phase] || 'Provide comprehensive analysis';
  }
  
  async postComment(issueNumber, message) {
    await this.octokit.rest.issues.createComment({
      owner: this.config.github.owner,
      repo: this.config.github.repo,
      issue_number: issueNumber,
      body: message
    });
  }
  
  async saveProcessedTasks() {
    const data = JSON.stringify([...this.processedTasks.entries()], null, 2);
    await fs.writeFile(this.processedTasksFile, data);
  }
  
  async listIssues() {
    const { data } = await this.octokit.rest.issues.listForRepo({
      owner: this.config.github.owner,
      repo: this.config.github.repo,
      state: 'open',
      sort: 'updated',
      direction: 'desc',
      per_page: 100
    });
    return data;
  }
}

module.exports = { InteractiveGitHubAutomation };
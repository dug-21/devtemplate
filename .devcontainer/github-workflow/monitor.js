const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const { GitHubWorkflowAutomation } = require('./automation');

class GitHubWorkflowMonitor {
  constructor(config) {
    this.config = config;
    this.automation = new GitHubWorkflowAutomation(config);
    this.octokit = new Octokit({
      auth: process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN
    });
    this.stateFile = '.devcontainer/github-workflow/.monitor-state.json';
    this.running = false;
  }

  async start() {
    if (this.running) return;
    
    console.log('🚀 Starting GitHub workflow monitor...');
    console.log(`📊 Repository: ${this.config.github.owner}/${this.config.github.repo}`);
    console.log(`⏰ Poll interval: ${this.config.github.pollInterval / 1000}s`);
    
    this.running = true;
    
    // Initial check
    await this.checkIssues();
    
    // Set up polling
    this.pollInterval = setInterval(async () => {
      if (this.running) {
        await this.checkIssues();
      }
    }, this.config.github.pollInterval);
  }

  async stop() {
    console.log('⏸️ Stopping GitHub workflow monitor...');
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  async checkIssues() {
    try {
      console.log('🔍 Checking for issue updates...');
      
      const state = await this.loadState();
      const response = await this.fetchIssues(state);
      
      if (response.status === 304) {
        console.log('✅ No changes since last check');
        return;
      }

      const issues = response.data;
      console.log(`📋 Found ${issues.length} issues to process`);

      // Process new or updated issues
      let processedCount = 0;
      for (const issue of issues) {
        if (this.shouldProcess(issue, state)) {
          console.log(`🔄 Processing issue #${issue.number}: ${issue.title}`);
          await this.automation.processIssue(issue);
          processedCount++;
        }
      }

      console.log(`✅ Processed ${processedCount} issues`);

      // Update state
      await this.saveState({
        lastCheck: new Date().toISOString(),
        etag: response.headers.etag,
        processedIssues: issues.map(i => ({
          number: i.number,
          updated_at: i.updated_at
        }))
      });

    } catch (error) {
      console.error('❌ Monitor error:', error);
      
      // Don't stop monitoring on errors, just wait longer before retry
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        setTimeout(() => {
          if (this.running) {
            this.pollInterval = setInterval(async () => {
              if (this.running) {
                await this.checkIssues();
              }
            }, this.config.github.pollInterval);
          }
        }, 60000); // Wait 1 minute before resuming
      }
    }
  }

  async fetchIssues(state) {
    const options = {
      owner: this.config.github.owner,
      repo: this.config.github.repo,
      state: 'open',
      sort: 'updated',
      direction: 'desc',
      per_page: 50
    };

    // Add conditional request headers if we have them
    const headers = {};
    if (state.etag) {
      headers['If-None-Match'] = state.etag;
    }

    return this.octokit.rest.issues.listForRepo({
      ...options,
      headers
    });
  }

  shouldProcess(issue, state) {
    // Skip pull requests (they appear in issues API)
    if (issue.pull_request) return false;

    // Always process if no previous state
    if (!state.processedIssues) return true;

    // Check if issue was updated since last processing
    const previouslyProcessed = state.processedIssues.find(p => p.number === issue.number);
    if (!previouslyProcessed) return true;

    return new Date(issue.updated_at) > new Date(previouslyProcessed.updated_at);
  }

  async loadState() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.log('📝 No previous state found, starting fresh');
      return {
        lastCheck: null,
        etag: null,
        processedIssues: []
      };
    }
  }

  async saveState(state) {
    try {
      await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('⚠️ Failed to save state:', error);
    }
  }

  getStatus() {
    return {
      running: this.running,
      config: {
        repository: `${this.config.github.owner}/${this.config.github.repo}`,
        pollInterval: this.config.github.pollInterval,
        enabled: this.config.github.enabled
      }
    };
  }
}

// CLI usage
if (require.main === module) {
  const config = require('./config.json');
  const monitor = new GitHubWorkflowMonitor(config);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await monitor.stop();
    process.exit(0);
  });

  monitor.start().catch(error => {
    console.error('💥 Monitor failed to start:', error);
    process.exit(1);
  });
}

module.exports = { GitHubWorkflowMonitor };
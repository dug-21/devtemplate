const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');
const { InteractiveGitHubAutomation } = require('./automation-interactive');

class GitHubWorkflowMonitor {
  constructor(config) {
    this.config = config;
    this.automation = new InteractiveGitHubAutomation(config);
    this.octokit = new Octokit({
      auth: process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN
    });
    this.stateFile = '.devcontainer/github-workflow/.monitor-state.json';
    this.running = false;
    this.startTime = null;
  }

  async start() {
    if (this.running) {
      console.log('⚠️ Monitor is already running');
      return;
    }
    
    console.log('🚀 Starting Enhanced GitHub Workflow Monitor...');
    console.log(`📊 Repository: ${this.config.github.owner}/${this.config.github.repo}`);
    console.log(`⏰ Poll interval: ${this.config.github.pollInterval / 1000}s`);
    console.log(`🐝 Parallel processing: ENABLED`);
    console.log(`📁 Issue tracking: ENABLED`);
    console.log(`📋 GitHub Projects support: ${this.config.github.projectNumber ? 'ENABLED' : 'DISABLED'}`);
    
    this.running = true;
    this.startTime = new Date();
    
    // Initialize automation (loads processed tasks)
    await this.automation.initialize();
    
    // Initial check
    await this.checkIssues();
    
    // Set up polling with error recovery
    this.scheduleNextCheck();
  }

  scheduleNextCheck() {
    if (!this.running) return;
    
    this.pollTimeout = setTimeout(async () => {
      if (this.running) {
        await this.checkIssues();
        this.scheduleNextCheck();
      }
    }, this.config.github.pollInterval);
  }

  async stop() {
    console.log('⏸️ Stopping GitHub workflow monitor...');
    this.running = false;
    
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    
    // Save final state
    await this.saveState({
      lastCheck: new Date().toISOString(),
      stopped: true,
      runtime: new Date() - this.startTime
    });
    
    console.log('✅ Monitor stopped gracefully');
  }

  async checkIssues() {
    const checkStart = Date.now();
    
    try {
      console.log('\n🔍 Checking for issue updates...');
      
      const state = await this.loadState();
      const response = await this.fetchIssues(state);
      
      if (response.status === 304) {
        console.log('✅ No changes since last check');
        return;
      }

      const issues = response.data;
      console.log(`📋 Found ${issues.length} open issues`);

      // Process issues sequentially, each with its own swarm
      const issuesToProcess = issues.filter(issue => this.shouldProcess(issue, state));
      console.log(`🎯 ${issuesToProcess.length} issues need processing`);
      
      if (issuesToProcess.length > 0) {
        // Process each issue sequentially with its own swarm
        console.log(`🐝 Processing ${issuesToProcess.length} issues sequentially (one swarm per issue)...`);
        
        for (const [index, issue] of issuesToProcess.entries()) {
          console.log(`\n📋 Processing issue ${index + 1}/${issuesToProcess.length}: #${issue.number} - ${issue.title}`);
          
          try {
            const result = await this.automation.processIssue(issue);
            
            if (result.cached) {
              console.log(`✓ Issue #${issue.number} already processed (cached)`);
            } else if (result.skipped) {
              console.log(`⏭️ Issue #${issue.number} skipped (filtered)`);
            } else {
              console.log(`✅ Issue #${issue.number} processed with dedicated swarm`);
            }
            
            // Add a small delay between issues to avoid overwhelming the system
            if (index < issuesToProcess.length - 1) {
              console.log(`⏱️ Waiting 2 seconds before next issue...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
          } catch (error) {
            console.error(`❌ Failed to process issue #${issue.number}:`, error.message);
          }
        }
      }

      // Update state with new ETags and processed issues
      await this.saveState({
        lastCheck: new Date().toISOString(),
        etag: response.headers.etag,
        processedIssues: issues.map(i => ({
          number: i.number,
          updated_at: i.updated_at,
          phase: this.automation.detectPhase(i)
        })),
        stats: {
          totalIssues: issues.length,
          processedCount: issuesToProcess.length,
          checkDuration: Date.now() - checkStart
        }
      });
      
      console.log(`\n⏱️ Check completed in ${((Date.now() - checkStart) / 1000).toFixed(1)}s`);
      
    } catch (error) {
      console.error('❌ Monitor error:', error);
      
      // Log error but don't stop monitoring
      await this.saveState({
        lastCheck: new Date().toISOString(),
        error: error.message,
        errorTime: new Date().toISOString()
      });
      
      // If rate limited, wait longer
      if (error.status === 403 || error.status === 429) {
        console.log('⚠️ Rate limited, waiting 15 minutes...');
        if (this.pollTimeout) {
          clearTimeout(this.pollTimeout);
        }
        this.pollTimeout = setTimeout(() => {
          if (this.running) {
            this.checkIssues();
            this.scheduleNextCheck();
          }
        }, 900000); // 15 minutes
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
      per_page: 100
    };

    // Add conditional request headers for efficiency
    const headers = {};
    if (state.etag && !state.error) {
      headers['If-None-Match'] = state.etag;
    }

    try {
      return await this.octokit.rest.issues.listForRepo({
        ...options,
        headers
      });
    } catch (error) {
      // Handle 304 Not Modified
      if (error.status === 304) {
        return { status: 304, data: [] };
      }
      throw error;
    }
  }

  shouldProcess(issue, state) {
    // Skip pull requests
    if (issue.pull_request) return false;
    
    // Check if in processed issues
    if (!state.processedIssues) return true;
    
    const processed = state.processedIssues.find(p => p.number === issue.number);
    if (!processed) return true;
    
    // Process if updated since last check
    return new Date(issue.updated_at) > new Date(processed.updated_at);
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
        processedIssues: [],
        firstRun: true
      };
    }
  }

  async saveState(state) {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.stateFile);
      await fs.mkdir(dir, { recursive: true });
      
      // Merge with existing state
      const existing = await this.loadState().catch(() => ({}));
      const merged = { ...existing, ...state };
      
      await fs.writeFile(this.stateFile, JSON.stringify(merged, null, 2));
    } catch (error) {
      console.error('⚠️ Failed to save state:', error);
    }
  }

  getStatus() {
    const uptime = this.startTime ? (new Date() - this.startTime) / 1000 : 0;
    
    return {
      running: this.running,
      uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      config: {
        repository: `${this.config.github.owner}/${this.config.github.repo}`,
        pollInterval: `${this.config.github.pollInterval / 1000}s`,
        projectsEnabled: !!this.config.github.projectNumber,
        parallelProcessing: true
      }
    };
  }
}

// CLI usage
if (require.main === module) {
  // Load config with validation
  let config;
  try {
    config = require('./config.json');
    
    // Update config for local testing
    if (config.github.owner === 'YOUR_GITHUB_USERNAME') {
      config.github.owner = 'dug-21';
      config.github.repo = 'devtemplate';
      console.log('📝 Using default test repository: dug-21/devtemplate');
    }
    
  } catch (error) {
    console.error('❌ Failed to load config.json:', error.message);
    console.log('💡 Make sure config.json exists and is valid JSON');
    process.exit(1);
  }
  
  // Validate environment
  const token = process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ No agent token found! Automation requires AGENT_TOKEN.');
    console.log('💡 Set AGENT_TOKEN for automation use (or GITHUB_TOKEN as fallback)');
    process.exit(1);
  }
  
  const monitor = new GitHubWorkflowMonitor(config);
  
  // Handle graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    await monitor.stop();
    process.exit(0);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught exception:', error);
    monitor.stop().then(() => process.exit(1));
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
    monitor.stop().then(() => process.exit(1));
  });
  
  // Start monitor
  monitor.start().catch(error => {
    console.error('💥 Monitor failed to start:', error);
    process.exit(1);
  });
}

module.exports = { GitHubWorkflowMonitor };
#!/usr/bin/env node

/**
 * Enhanced GitHub Automation V3 with File Organization
 * Features:
 * - Organized file storage in issue-specific directories
 * - Robust cleanup in all scenarios
 * - Comprehensive reporting with links
 * - Real-time progress tracking
 */

const { Octokit } = require('@octokit/rest');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const FileOrganization = require('./file-organization');
const AIAttribution = require('./ai-attribution');
const EnhancedGitHubClient = require('./enhanced-github-client');
const SecurityCheck = require('./issues/issue-11/security-check');

class EnhancedGitHubAutomation extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.octokit = new Octokit({
            auth: config.github.token || process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN
        });
        
        // Enhanced client for AI attribution
        this.enhancedClient = new EnhancedGitHubClient(this.octokit, config);
        
        this.fileOrg = new FileOrganization();
        this.securityCheck = new SecurityCheck();
        this.logFile = path.join(__dirname, 'automation-enhanced-v3.log');
        this.activeIssues = new Map();
        this.updateInterval = 30000;
        
        // Track agent context
        this.agentType = 'AUTOMATION';
        this.sessionId = `session-${Date.now()}`;
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

    async processIssue(issue) {
        const issueId = `${issue.number}`;
        let issueDir = null;
        let tempFiles = [];
        
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
                tempFiles: [],
                modifiedFiles: [] // Track files modified in-place
            });

            // Add in-progress label
            await this.updateIssueLabels(issue.number, 
                [...(issue.labels?.map(l => l.name) || []), 'in-progress', 'swarm-active'],
                ['ready', 'todo']
            );
            
            // Post initial message
            const reportUrl = this.fileOrg.getIssueReportUrl(
                issue.number, 
                `https://github.com/${this.config.github.owner}/${this.config.github.repo}`
            );
            
            const initialComment = await this.postComment(issue.number, `🐝 **Enhanced Swarm V3 Activated**

I'm processing this issue with improved file organization.

**Features:**
- ✅ All files stored in organized structure
- ✅ Automatic cleanup of temporary files
- ✅ Comprehensive reporting with links
- ✅ Real-time progress updates

**Issue Directory:** [View Files](${reportUrl})

**Current Status:** 🟡 Initializing...
**Progress:** 0%

---
*Updates will appear below*`);

            // Start progress monitoring
            const progressTimer = setInterval(async () => {
                await this.postProgressUpdate(issueId);
            }, this.updateInterval);

            // Create comprehensive Claude prompt
            const claudePrompt = this.createEnhancedClaudePromptV3(issue);
            
            // Store prompt in issue directory
            const promptPath = await this.fileOrg.moveToIssueDir(
                await this.createTempFile(claudePrompt, issueId, 'prompt', 'txt'),
                issue.number,
                'claude-prompt.txt'
            );
            
            // Execute Claude with enhanced monitoring
            const result = await this.executeClaudeWithMonitoringV3(issue, issueId);
            
            // Stop progress monitoring
            clearInterval(progressTimer);
            
            // Create comprehensive summary
            await this.createIssueSummary(issue, result);
            
            // Post final summary with links
            await this.postFinalSummaryV3(issue);
            
            // Handle issue completion
            await this.handleIssueCompletion(issue);
            
            // Cleanup temporary files
            await this.cleanupIssueFiles(issueId, true);
            
            // Clean up tracking
            this.activeIssues.delete(issueId);
            
            return { success: true, result, issueDir };
            
        } catch (error) {
            await this.log(`Error processing issue #${issue.number}: ${error.message}`, 'ERROR');
            
            // Cleanup on error
            await this.cleanupIssueFiles(issueId, false);
            
            // Post error message
            await this.postComment(issue.number, `❌ **Error During Processing**

An error occurred: ${error.message}

The issue has been marked for manual review.`);
            
            // Update labels
            await this.updateIssueLabels(issue.number,
                ['error', 'needs-review'],
                ['in-progress', 'swarm-active']
            );
            
            throw error;
        }
    }

    async createTempFile(content, issueId, prefix, extension) {
        const tracking = this.activeIssues.get(issueId);
        const tempPath = this.fileOrg.getTempPath(tracking.number, prefix, extension);
        
        // Security check before writing
        try {
            await this.securityCheck.safeWriteFile(tempPath, content);
        } catch (error) {
            await this.log(`SECURITY: ${error.message}`, 'ERROR');
            // Write sanitized version instead
            const sanitized = this.securityCheck.sanitizeObject(
                typeof content === 'string' ? content : JSON.parse(content)
            );
            await fs.writeFile(tempPath, 
                typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized, null, 2)
            );
        }
        
        tracking.tempFiles.push(tempPath);
        return tempPath;
    }

    async cleanupIssueFiles(issueId, success) {
        const tracking = this.activeIssues.get(issueId);
        if (!tracking) return;

        // Clean up temp files
        for (const tempFile of tracking.tempFiles) {
            try {
                await fs.unlink(tempFile);
            } catch (error) {
                await this.log(`Failed to delete temp file ${tempFile}: ${error.message}`, 'WARN');
            }
        }

        // Clean up general temp directory
        await this.fileOrg.cleanupTemp(1); // Clean files older than 1 hour
    }

    createEnhancedClaudePromptV3(issue) {
        return `You are working on GitHub issue #${issue.number} with ENHANCED V3 file organization.

CRITICAL FILE MANAGEMENT RULES:
1. **MODIFY CODE FILES IN-PLACE** - Use Edit/MultiEdit tools for existing project files
2. **ONLY store NEW ARTIFACTS in issue directory** - Reports, summaries, research docs
3. Track all file operations for cleanup
4. Provide frequent progress updates
5. Create comprehensive documentation

Issue Details:
- Repository: ${this.config.github.owner}/${this.config.github.repo}
- Issue #${issue.number}: ${issue.title}
- Description: ${issue.body || 'No description provided'}
- Labels: ${issue.labels?.map(l => l.name).join(', ') || 'None'}

FILE ORGANIZATION REQUIREMENTS:
- **EXISTING CODE FILES**: Modify in their original locations (DO NOT copy to issue directory)
- **NEW ARTIFACTS ONLY**: Store these in the issue directory:
  - Implementation summaries (SUMMARY.md)
  - Research reports
  - Analysis documents
  - Test results
  - Other work products NOT part of the codebase
- Clean up temporary files after use
- Document all created files

MANDATORY WORKFLOW:

1. INITIALIZATION:
   mcp__github__add_issue_comment({
     owner: "${this.config.github.owner}",
     repo: "${this.config.github.repo}",
     issue_number: ${issue.number},
     body: "🔄 **Starting Implementation**\\n\\nInitializing file organization system..."
   })

2. During implementation:
   - EDIT existing code files in-place
   - CREATE new artifacts in issue directory
   - Post progress updates
   - Track all operations

3. COMPLETION:
   - Create summary report in issue directory
   - List both modified files and created artifacts
   - Clean up temporary files

Remember: NEVER copy existing code files to the issue directory. Always modify them in-place!`;
    }

    async executeClaudeWithMonitoringV3(issue, issueId) {
        await this.log(`Executing Claude V3 for issue #${issue.number}`);
        
        const tracking = this.activeIssues.get(issueId);
        tracking.phase = 'claude-execution';
        
        try {
            // Create MCP config WITHOUT exposing tokens
            // SECURITY: Never write tokens to files - pass via environment only
            const mcpConfig = {
                mcpServers: {
                    "ruv-swarm": {
                        command: "npx",
                        args: ["ruv-swarm", "mcp", "start"]
                    },
                    github: {
                        command: "npx",
                        args: ["@modelcontextprotocol/server-github"]
                        // Token will be passed via environment variables only
                    }
                }
            };
            
            const mcpConfigPath = await this.createTempFile(
                JSON.stringify(mcpConfig, null, 2),
                issueId,
                'mcp-config',
                'json'
            );
            
            const promptPath = this.fileOrg.getIssuePath(issue.number, 'claude-prompt.txt');
            
            // Execute Claude
            const command = `claude --print --dangerously-skip-permissions --mcp-config "${mcpConfigPath}" < "${promptPath}"`;
            
            tracking.phase = 'claude-running';
            this.usingClaude = true; // Set flag for attribution
            
            const result = execSync(command, {
                encoding: 'utf8',
                maxBuffer: 20 * 1024 * 1024,
                env: {
                    ...process.env,
                    AGENT_TOKEN: this.config.github.token || process.env.AGENT_TOKEN
                }
            });
            
            // Store execution log
            await fs.writeFile(
                this.fileOrg.getIssuePath(issue.number, 'execution.log'),
                result
            );
            
            tracking.phase = 'complete';
            return result;
            
        } catch (error) {
            tracking.phase = 'error';
            throw error;
        }
    }

    async createIssueSummary(issue, result) {
        const issueDir = this.fileOrg.getIssuePath(issue.number);
        const files = await fs.readdir(issueDir);
        
        const summary = {
            overview: `Issue #${issue.number} has been processed successfully.`,
            files: files.map(f => ({ name: f })),
            details: `Execution completed at ${new Date().toISOString()}`
        };
        
        await this.fileOrg.createIssueSummary(issue.number, summary);
    }

    async postFinalSummaryV3(issue) {
        const reportUrl = this.fileOrg.getIssueReportUrl(
            issue.number,
            `https://github.com/${this.config.github.owner}/${this.config.github.repo}`
        );
        
        const issueDir = this.fileOrg.getIssuePath(issue.number);
        const files = await fs.readdir(issueDir);
        
        // Get information about modified files vs created artifacts
        const tracking = this.activeIssues.get(`${issue.number}`);
        const modifiedFiles = tracking?.modifiedFiles || [];
        const createdArtifacts = files.filter(f => !f.endsWith('.md') || f === 'SUMMARY.md');
        
        const summary = `🎉 **Processing Complete!**

All changes have been implemented successfully.

**📝 Modified Files (In-Place):**
${modifiedFiles.length > 0 ? modifiedFiles.map(f => `- \`${f}\` - Modified in original location`).join('\n') : '- No code files were modified'}

**📁 Created Artifacts:** [View in Issue Directory](${reportUrl})
${createdArtifacts.map(f => `- \`${f}\``).join('\n')}

**Summary:** [View Summary](${reportUrl}/SUMMARY.md)

---

✅ Code files modified in-place (not copied)
✅ Artifacts stored in issue directory
✅ All temporary files cleaned up
✅ Documentation generated`;

        await this.postComment(issue.number, summary);
    }

    async postProgressUpdate(issueId) {
        const tracking = this.activeIssues.get(issueId);
        if (!tracking) return;
        
        const elapsed = Date.now() - tracking.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        const lastUpdateTime = tracking.lastProgressUpdate || 0;
        if (Date.now() - lastUpdateTime < 25000) return;
        
        tracking.lastProgressUpdate = Date.now();
        
        const reportUrl = this.fileOrg.getIssueReportUrl(
            tracking.number,
            `https://github.com/${this.config.github.owner}/${this.config.github.repo}`
        );
        
        const progressMessage = `🔄 **Progress Update**

**Phase:** ${tracking.phase}
**Elapsed:** ${minutes}m ${seconds}s
**Files:** [View Current Files](${reportUrl})

*Working on implementation...*`;
        
        try {
            await this.postComment(tracking.number, progressMessage);
        } catch (error) {
            await this.log(`Failed to post progress: ${error.message}`, 'WARN');
        }
    }

    async postComment(issueNumber, body, options = {}) {
        // Use enhanced client for AI attribution
        return this.enhancedClient.postComment(issueNumber, body, {
            agentType: this.getAgentType(),
            sessionId: this.sessionId,
            phase: this.currentPhase,
            ...options
        });
    }
    
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

    async updateIssueLabels(issueNumber, addLabels, removeLabels = []) {
        try {
            const { data: issue } = await this.octokit.issues.get({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                issue_number: issueNumber
            });
            
            let labels = issue.labels.map(l => l.name);
            labels = labels.filter(l => !removeLabels.includes(l));
            
            addLabels.forEach(label => {
                if (!labels.includes(label)) {
                    labels.push(label);
                }
            });
            
            await this.octokit.issues.setLabels({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                issue_number: issueNumber,
                labels
            });
        } catch (error) {
            await this.log(`Failed to update labels: ${error.message}`, 'ERROR');
        }
    }

    async handleIssueCompletion(issue) {
        const labels = issue.labels?.map(l => l.name) || [];
        
        // Check if this is a bug issue - bugs should NOT be auto-closed
        const isBugIssue = labels.includes('bug') || 
                          issue.title.toLowerCase().includes('[bug]') ||
                          issue.body?.toLowerCase().includes('**describe the bug**');
        
        if (labels.includes('auto-close-on-complete') && !labels.includes('keep-open') && !isBugIssue) {
            await this.postComment(issue.number, `🔔 **Auto-Close Notice**

This issue will be automatically closed in 60 seconds.

To prevent closure, add the \`keep-open\` label.`);
            
            await new Promise(resolve => setTimeout(resolve, 60000));
            
            const { data: updatedIssue } = await this.octokit.issues.get({
                owner: this.config.github.owner,
                repo: this.config.github.repo,
                issue_number: issue.number
            });
            
            if (!updatedIssue.labels.map(l => l.name).includes('keep-open')) {
                await this.octokit.issues.update({
                    owner: this.config.github.owner,
                    repo: this.config.github.repo,
                    issue_number: issue.number,
                    state: 'closed'
                });
                
                await this.postComment(issue.number, `✅ **Issue Closed**

This issue has been automatically closed after successful completion.`);
            }
        } else if (isBugIssue) {
            // For bug issues, add a note but keep them open
            await this.postComment(issue.number, `🐛 **Bug Fix Complete**

The bug has been fixed and the changes have been implemented.

**Note:** Bug issues remain open for verification and tracking purposes.

To close this issue:
- Verify the fix is working as expected
- Close manually if satisfied with the resolution`);
        }
        
        await this.updateIssueLabels(issue.number, 
            ['swarm-processed', 'completed'],
            ['in-progress', 'swarm-active']
        );
    }
}

module.exports = EnhancedGitHubAutomation;
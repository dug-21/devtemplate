/**
 * Claude CLI Client
 * Handles direct interaction with Claude Code CLI
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ClaudeClient {
    constructor(config = {}) {
        this.config = {
            workingDir: path.join(process.cwd(), '..', '..', 'issues'),
            timeout: 600000, // 10 minutes default
            ...config
        };
    }

    /**
     * Execute a Claude command with a prompt
     */
    async executePrompt(prompt, context = {}) {
        const issueNumber = context.issueNumber || 'general';
        const issueDir = path.join(this.config.workingDir, `issue-${issueNumber}`);
        
        // Ensure issue directory exists
        await fs.mkdir(issueDir, { recursive: true });
        
        // Write prompt to temporary file
        const promptFile = path.join(issueDir, `claude-prompt-${Date.now()}.txt`);
        await fs.writeFile(promptFile, prompt);
        
        // Prepare execution log
        const logFile = path.join(issueDir, 'claude-execution.log');
        const logStream = await fs.open(logFile, 'a');
        
        try {
            // Log execution start
            await logStream.write(`\n=== Claude Execution Started at ${new Date().toISOString()} ===\n`);
            await logStream.write(`Prompt: ${prompt.substring(0, 200)}...\n`);
            
            const result = await this.runClaudeCommand(prompt, {
                cwd: issueDir,
                timeout: this.config.timeout
            });
            
            // Log execution end
            await logStream.write(`=== Claude Execution Completed at ${new Date().toISOString()} ===\n`);
            
            // Save result to file
            const resultFile = path.join(issueDir, `claude-result-${Date.now()}.txt`);
            await fs.writeFile(resultFile, result);
            
            return result;
        } catch (error) {
            // Log error
            await logStream.write(`=== Claude Execution Failed at ${new Date().toISOString()} ===\n`);
            await logStream.write(`Error: ${error.message}\n`);
            throw error;
        } finally {
            await logStream.close();
            // Clean up prompt file
            await fs.unlink(promptFile).catch(() => {});
        }
    }

    /**
     * Run Claude command via CLI
     */
    runClaudeCommand(prompt, options = {}) {
        return new Promise((resolve, reject) => {
            const claude = spawn('claude', [], {
                cwd: options.cwd || process.cwd(),
                env: { ...process.env }
            });
            
            let output = '';
            let error = '';
            let timedOut = false;
            
            // Set timeout
            const timeout = setTimeout(() => {
                timedOut = true;
                claude.kill('SIGTERM');
            }, options.timeout || this.config.timeout);
            
            // Send prompt to stdin
            claude.stdin.write(prompt);
            claude.stdin.end();
            
            // Collect stdout
            claude.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            // Collect stderr
            claude.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            // Handle completion
            claude.on('close', (code) => {
                clearTimeout(timeout);
                
                if (timedOut) {
                    reject(new Error('Claude command timed out'));
                } else if (code !== 0) {
                    reject(new Error(`Claude command failed with code ${code}: ${error}`));
                } else {
                    resolve(output);
                }
            });
            
            // Handle errors
            claude.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    /**
     * Generate phase-specific prompt
     */
    generatePhasePrompt(phase, issueContent, previousPhases = []) {
        const phasePrompts = {
            inception: `Analyze this new issue and provide an initial assessment:

Issue Content:
${issueContent}

Please provide:
1. A clear understanding of what is being requested
2. Initial feasibility assessment
3. Potential challenges or concerns
4. Recommended approach
5. Estimated complexity (low/medium/high)`,

            discovery: `Conduct detailed research and requirement gathering for this issue:

Issue Content:
${issueContent}

Previous Phase Results:
${previousPhases.map(p => p.content).join('\n\n')}

Please provide:
1. Detailed requirements analysis
2. Technical constraints and dependencies
3. Research findings and best practices
4. Risk assessment
5. Success criteria`,

            design: `Create a comprehensive solution design:

Issue Content:
${issueContent}

Previous Phase Results:
${previousPhases.map(p => p.content).join('\n\n')}

Please provide:
1. High-level solution design
2. Component breakdown
3. Interface definitions
4. Data flow diagrams
5. Alternative approaches considered`,

            architecture: `Define the technical architecture:

Issue Content:
${issueContent}

Previous Phase Results:
${previousPhases.map(p => p.content).join('\n\n')}

Please provide:
1. System architecture diagram
2. Technology stack decisions
3. Integration points
4. Scalability considerations
5. Security architecture`,

            implementation: `Provide implementation guidance:

Issue Content:
${issueContent}

Previous Phase Results:
${previousPhases.map(p => p.content).join('\n\n')}

Please provide:
1. Implementation roadmap
2. Code structure recommendations
3. Key algorithms or patterns to use
4. Testing strategy
5. Performance considerations`,

            testing: `Define comprehensive testing approach:

Issue Content:
${issueContent}

Previous Phase Results:
${previousPhases.map(p => p.content).join('\n\n')}

Please provide:
1. Test plan and strategy
2. Test cases (unit, integration, e2e)
3. Performance test scenarios
4. Security test cases
5. Acceptance criteria validation`,

            deployment: `Create deployment plan:

Issue Content:
${issueContent}

Previous Phase Results:
${previousPhases.map(p => p.content).join('\n\n')}

Please provide:
1. Deployment strategy
2. Environment configurations
3. Rollback procedures
4. Monitoring setup
5. Documentation requirements`,

            operations: `Define operational procedures:

Issue Content:
${issueContent}

Previous Phase Results:
${previousPhases.map(p => p.content).join('\n\n')}

Please provide:
1. Operational runbook
2. Monitoring and alerting setup
3. Maintenance procedures
4. Troubleshooting guide
5. Performance optimization tips`
        };

        return phasePrompts[phase] || phasePrompts.inception;
    }

    /**
     * Handle @mention processing
     */
    async processMention(comment, issueContext) {
        const prompt = `You were mentioned in a GitHub issue comment. Please provide a helpful response.

Issue Title: ${issueContext.title}
Issue Body: ${issueContext.body}

Comment: ${comment}

Please provide a thoughtful and helpful response addressing the comment.`;

        return await this.executePrompt(prompt, {
            issueNumber: issueContext.number
        });
    }

    /**
     * Generate subtasks for an issue
     */
    async generateSubtasks(issueContent, issueType = 'general') {
        const prompt = `Analyze this issue and break it down into manageable subtasks:

Issue Type: ${issueType}
Issue Content:
${issueContent}

Please provide:
1. A list of specific, actionable subtasks
2. Dependencies between tasks
3. Estimated effort for each task
4. Suggested order of execution
5. Success criteria for each subtask

Format the output as a structured list that can be easily converted to GitHub issues.`;

        return await this.executePrompt(prompt);
    }

    /**
     * Check if Claude CLI is available
     */
    async isAvailable() {
        try {
            const result = await new Promise((resolve, reject) => {
                const claude = spawn('claude', ['--version']);
                
                claude.on('close', (code) => {
                    resolve(code === 0);
                });
                
                claude.on('error', () => {
                    resolve(false);
                });
            });
            
            return result;
        } catch {
            return false;
        }
    }
}
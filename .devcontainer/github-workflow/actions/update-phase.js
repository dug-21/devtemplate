#!/usr/bin/env node

/**
 * Update Phase Action
 * Updates EPIC phase content and transitions
 * Maintains phase history with timestamps
 * Updates phase-related labels
 * Preserves existing issue content while updating phase section
 */

import { GitHubClient, withRetry } from '../library/github-client.js';
import { RuvSwarmClient } from '../library/ruv-swarm-client.js';
import { ClaudeClient } from '../library/claude-client.js';
import { PhaseManager } from '../library/phase-manager.js';
import minimist from 'minimist';

// Parse command line arguments
const argv = minimist(process.argv.slice(2));
const issueNumber = parseInt(argv.issue || process.env.ISSUE_NUMBER);
const targetPhase = argv.phase || process.env.TARGET_PHASE;

if (!issueNumber || !targetPhase) {
    console.error('Missing required parameters: --issue and --phase');
    process.exit(1);
}

// Initialize clients
const github = new GitHubClient();
const ruvSwarm = new RuvSwarmClient();
const claude = new ClaudeClient();
const phaseManager = new PhaseManager();

/**
 * Main phase update function
 */
async function updatePhase() {
    console.log(`Updating issue #${issueNumber} to ${targetPhase} phase`);
    
    try {
        // Get issue details with retry
        const issue = await withRetry(() => github.getIssue(issueNumber));
        const currentPhase = phaseManager.parseCurrentPhase(issue.body);
        
        // Update labels with retry
        await withRetry(() => github.removeLabel(issueNumber, `phase:${currentPhase}`));
        await withRetry(() => github.addLabels(issueNumber, [`phase:${targetPhase}`, 'swarm-active']));
        
        // Post phase transition notice with retry
        await withRetry(() => github.createComment(issueNumber,
            `${phaseManager.getPhaseEmoji(targetPhase)} **Starting ${phaseManager.capitalizeFirst(targetPhase)} Phase**\n\n` +
            `The system is now processing the ${targetPhase} phase. This may take a few minutes...\n\n` +
            `I'll update the issue with results when complete.`
        ));
        
        // Collect previous phase results
        const previousPhases = collectPreviousPhases(issue.body, targetPhase);
        
        // Check which AI service to use
        const ruvAvailable = await ruvSwarm.isAvailable();
        const claudeAvailable = await claude.isAvailable();
        
        let phaseResult;
        let metadata = {
            agentsUsed: 0,
            tasksCompleted: 0,
            startTime: new Date().toISOString()
        };
        
        if (ruvAvailable) {
            // Use ruv-swarm for processing
            console.log('Processing with ruv-swarm');
            
            // Initialize swarm if needed
            await ruvSwarm.initializeSwarm();
            
            // Determine agent configuration based on phase
            const agents = await spawnPhaseAgents(targetPhase);
            metadata.agentsUsed = agents.length;
            
            // Create phase-specific task
            const task = createPhaseTask(targetPhase, issue, previousPhases);
            
            // Orchestrate task with retry
            const taskResult = await withRetry(() => 
                ruvSwarm.orchestrateTask(task, {
                    priority: 'high',
                    strategy: getPhaseStrategy(targetPhase),
                    maxAgents: agents.length
                })
            );
            
            phaseResult = taskResult.summary || taskResult;
            metadata.tasksCompleted = 1;
            
        } else if (claudeAvailable) {
            // Use Claude directly
            console.log('Processing with Claude CLI');
            
            const prompt = claude.generatePhasePrompt(targetPhase, issue.body, previousPhases);
            phaseResult = await withRetry(() => claude.executePrompt(prompt, { issueNumber }));
            metadata.agentsUsed = 1;
            metadata.tasksCompleted = 1;
            
        } else {
            throw new Error('No AI services available for phase processing');
        }
        
        // Calculate duration
        const endTime = new Date();
        metadata.duration = formatDuration(endTime - new Date(metadata.startTime));
        metadata.completedTime = endTime.toISOString();
        
        // Generate phase update content with full metadata
        const phaseContent = generatePhaseUpdateWithHistory(
            targetPhase,
            phaseResult,
            metadata,
            phaseManager
        );
        
        // Preserve existing issue content and update phase section
        const updatedBody = preserveAndUpdatePhaseContent(issue.body, targetPhase, phaseContent, phaseManager);
        
        // Update current phase indicator and phase history
        const finalBody = updatePhaseMetadata(updatedBody, targetPhase, metadata, phaseManager);
        
        // Update issue with retry
        await withRetry(() => github.updateIssue(issueNumber, {
            body: finalBody
        }));
        
        // Remove processing label with retry
        await withRetry(() => github.removeLabel(issueNumber, 'swarm-active'));
        
        // Post completion comment with retry
        await withRetry(() => github.createComment(issueNumber,
            `✅ **${phaseManager.capitalizeFirst(targetPhase)} Phase Completed**\n\n` +
            `The ${targetPhase} phase has been completed successfully.\n\n` +
            `**Phase Metrics:**\n` +
            `- Duration: ${metadata.duration}\n` +
            `- AI Agents Used: ${metadata.agentsUsed}\n` +
            `- Tasks Completed: ${metadata.tasksCompleted}\n` +
            `- Started: ${formatTimestamp(metadata.startTime)}\n` +
            `- Completed: ${formatTimestamp(metadata.completedTime)}\n\n` +
            `**Next Steps:**\n` +
            `1. Review the phase results in the issue description\n` +
            `2. Validate that all requirements have been addressed\n` +
            `3. Decide whether to proceed to the next phase or iterate\n\n` +
            getNextPhaseHint(targetPhase, phaseManager)
        ));
        
        // Check if this was the final phase
        if (targetPhase === 'operations') {
            await handleEpicCompletion(issueNumber);
        }
        
        console.log(`Phase update completed successfully`);
        process.exit(0);
        
    } catch (error) {
        console.error('Error updating phase:', error);
        
        // Remove processing label with retry
        await withRetry(() => github.removeLabel(issueNumber, 'swarm-active'), 3, 500).catch(() => {});
        
        // Post error comment with retry
        await withRetry(() => github.createComment(issueNumber,
            `❌ **Phase Update Failed**\n\n` +
            `An error occurred while processing the ${targetPhase} phase:\n` +
            `\`\`\`\n${error.message}\n\`\`\`\n\n` +
            `**Error Details:**\n` +
            `- Error Type: ${error.name || 'Unknown'}\n` +
            `- Phase: ${targetPhase}\n` +
            `- Time: ${new Date().toISOString()}\n` +
            `- Stack: \`${error.stack?.split('\n')[1]?.trim() || 'N/A'}\`\n\n` +
            `Please check the logs and try again, or process this phase manually.`
        ), 3, 500).catch(console.error);
        
        process.exit(1);
    }
}

/**
 * Generate phase update content with history
 */
function generatePhaseUpdateWithHistory(phase, content, metadata, phaseManager) {
    const timestamp = metadata.completedTime || new Date().toISOString();
    const phaseNumber = phaseManager.phases.indexOf(phase);
    
    return `## Phase ${phaseNumber}: ${phaseManager.capitalizeFirst(phase)}
*Updated: ${timestamp}*

### Status
- [x] Phase Started (${formatTimestamp(metadata.startTime)})
- [x] Phase Completed (${formatTimestamp(metadata.completedTime)})
- Duration: ${metadata.duration || 'N/A'}

### Summary
${content}

### Phase History
- **Started:** ${formatTimestamp(metadata.startTime)}
- **Completed:** ${formatTimestamp(metadata.completedTime)}
- **Duration:** ${metadata.duration || 'N/A'}
- **AI Agents Used:** ${metadata.agentsUsed || 0}
- **Tasks Completed:** ${metadata.tasksCompleted || 0}

### Metadata
\`\`\`yaml
phase: ${phase}
started: ${metadata.startTime}
completed: ${metadata.completedTime}
duration: ${metadata.duration || 'N/A'}
agentsUsed: ${metadata.agentsUsed || 0}
tasksCompleted: ${metadata.tasksCompleted || 0}
\`\`\`

### Exit Criteria
${phaseManager.generateExitCriteria(phase)}

---
`;
}

/**
 * Preserve existing content and update phase section
 */
function preserveAndUpdatePhaseContent(issueBody, phase, newContent, phaseManager) {
    // First, ensure we preserve any frontmatter
    const frontmatterMatch = issueBody.match(/^---\n[\s\S]*?\n---\n/);
    const frontmatter = frontmatterMatch ? frontmatterMatch[0] : '';
    const bodyWithoutFrontmatter = frontmatter ? issueBody.slice(frontmatter.length) : issueBody;
    
    // Update the phase content
    const updatedBody = phaseManager.formatPhaseContent(bodyWithoutFrontmatter, phase, newContent);
    
    // Recombine with frontmatter
    return frontmatter + updatedBody;
}

/**
 * Update phase metadata including current phase and history
 */
function updatePhaseMetadata(body, newPhase, metadata, phaseManager) {
    let updatedBody = body;
    
    // Update current phase indicator
    updatedBody = updatedBody.replace(
        /\*\*Current Phase:\*\* \w+/i,
        `**Current Phase:** ${newPhase}`
    );
    
    // Update or add phase history section
    const historySection = generatePhaseHistorySection(updatedBody, newPhase, metadata, phaseManager);
    
    // Check if phase history section exists
    if (updatedBody.includes('## Phase History')) {
        // Update existing history section
        updatedBody = updatedBody.replace(
            /## Phase History[\s\S]*?(?=##|$)/,
            historySection + '\n'
        );
    } else {
        // Add history section before the first phase section
        const firstPhaseMatch = updatedBody.match(/## Phase \d+:/);
        if (firstPhaseMatch) {
            const insertPos = updatedBody.indexOf(firstPhaseMatch[0]);
            updatedBody = updatedBody.slice(0, insertPos) + historySection + '\n\n' + updatedBody.slice(insertPos);
        } else {
            // Add at the end if no phase sections exist
            updatedBody += '\n\n' + historySection;
        }
    }
    
    return updatedBody;
}

/**
 * Generate phase history section
 */
function generatePhaseHistorySection(body, currentPhase, currentMetadata, phaseManager) {
    const phases = phaseManager.phases;
    const currentIndex = phases.indexOf(currentPhase);
    
    let history = '## Phase History\n\n';
    history += '| Phase | Status | Started | Completed | Duration | Agents | Tasks |\n';
    history += '|-------|--------|---------|-----------|----------|--------|-------|\n';
    
    // Extract existing history from body
    const existingHistory = extractPhaseHistory(body);
    
    for (let i = 0; i <= currentIndex; i++) {
        const phase = phases[i];
        const emoji = phaseManager.getPhaseEmoji(phase);
        
        if (phase === currentPhase) {
            // Current phase with new data
            history += `| ${emoji} ${phaseManager.capitalizeFirst(phase)} | ✅ Complete | ${formatTimestamp(currentMetadata.startTime)} | ${formatTimestamp(currentMetadata.completedTime)} | ${currentMetadata.duration} | ${currentMetadata.agentsUsed} | ${currentMetadata.tasksCompleted} |\n`;
        } else if (existingHistory[phase]) {
            // Previous phases from existing history
            const h = existingHistory[phase];
            history += `| ${emoji} ${phaseManager.capitalizeFirst(phase)} | ✅ Complete | ${h.started || 'N/A'} | ${h.completed || 'N/A'} | ${h.duration || 'N/A'} | ${h.agents || 'N/A'} | ${h.tasks || 'N/A'} |\n`;
        } else {
            // Phases that were completed but not in history (shouldn't happen normally)
            history += `| ${emoji} ${phaseManager.capitalizeFirst(phase)} | ✅ Complete | N/A | N/A | N/A | N/A | N/A |\n`;
        }
    }
    
    // Add remaining phases as pending
    for (let i = currentIndex + 1; i < phases.length; i++) {
        const phase = phases[i];
        const emoji = phaseManager.getPhaseEmoji(phase);
        history += `| ${emoji} ${phaseManager.capitalizeFirst(phase)} | ⏳ Pending | - | - | - | - | - |\n`;
    }
    
    return history;
}

/**
 * Extract existing phase history from issue body
 */
function extractPhaseHistory(body) {
    const history = {};
    const historyMatch = body.match(/## Phase History[\s\S]*?(?=##|$)/);
    
    if (historyMatch) {
        const lines = historyMatch[0].split('\n');
        for (const line of lines) {
            if (line.includes('|') && !line.includes('Phase |') && !line.includes('|----')) {
                const parts = line.split('|').map(p => p.trim());
                if (parts.length >= 7) {
                    const phaseName = parts[1].replace(/[^\w\s]/g, '').trim().toLowerCase();
                    history[phaseName] = {
                        started: parts[3],
                        completed: parts[4],
                        duration: parts[5],
                        agents: parts[6],
                        tasks: parts[7]
                    };
                }
            }
        }
    }
    
    return history;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toISOString().replace('T', ' ').slice(0, 16);
}

/**
 * Collect previous phase results
 */
function collectPreviousPhases(issueBody, currentPhase) {
    const phases = phaseManager.phases;
    const currentIndex = phases.indexOf(currentPhase);
    const previousPhases = [];
    
    for (let i = 0; i < currentIndex; i++) {
        const phase = phases[i];
        const phaseHeader = `## Phase ${i}: ${phaseManager.capitalizeFirst(phase)}`;
        const nextPhaseHeader = `## Phase ${i + 1}:`;
        
        const regex = new RegExp(`${phaseHeader}[\\s\\S]*?(?=${nextPhaseHeader}|## Phase \\d+:|## Summary|$)`, 'i');
        const match = issueBody.match(regex);
        
        if (match) {
            previousPhases.push({
                phase,
                content: match[0]
            });
        }
    }
    
    return previousPhases;
}

/**
 * Spawn appropriate agents for phase
 */
async function spawnPhaseAgents(phase) {
    const agentConfigs = {
        inception: [
            { type: 'researcher', capabilities: ['requirements', 'feasibility'] },
            { type: 'analyst', capabilities: ['risk-assessment', 'scoping'] }
        ],
        discovery: [
            { type: 'researcher', capabilities: ['deep-dive', 'best-practices'] },
            { type: 'analyst', capabilities: ['requirements', 'constraints'] },
            { type: 'coordinator', capabilities: ['planning', 'dependencies'] }
        ],
        design: [
            { type: 'analyst', capabilities: ['system-design', 'architecture'] },
            { type: 'coder', capabilities: ['prototyping', 'interfaces'] },
            { type: 'optimizer', capabilities: ['patterns', 'best-practices'] }
        ],
        architecture: [
            { type: 'analyst', capabilities: ['architecture', 'scalability'] },
            { type: 'coder', capabilities: ['technical-design', 'integration'] },
            { type: 'optimizer', capabilities: ['performance', 'security'] }
        ],
        implementation: [
            { type: 'coder', capabilities: ['implementation', 'testing'] },
            { type: 'coordinator', capabilities: ['task-breakdown', 'tracking'] },
            { type: 'optimizer', capabilities: ['code-quality', 'performance'] }
        ],
        testing: [
            { type: 'coder', capabilities: ['test-development', 'automation'] },
            { type: 'analyst', capabilities: ['test-planning', 'coverage'] },
            { type: 'optimizer', capabilities: ['performance-testing', 'security'] }
        ],
        deployment: [
            { type: 'coordinator', capabilities: ['deployment-planning', 'rollout'] },
            { type: 'coder', capabilities: ['automation', 'configuration'] },
            { type: 'analyst', capabilities: ['risk-assessment', 'rollback'] }
        ],
        operations: [
            { type: 'coordinator', capabilities: ['handoff', 'documentation'] },
            { type: 'analyst', capabilities: ['monitoring', 'maintenance'] },
            { type: 'optimizer', capabilities: ['optimization', 'troubleshooting'] }
        ]
    };
    
    const configs = agentConfigs[phase] || agentConfigs.inception;
    const agents = [];
    
    for (const config of configs) {
        const agent = await ruvSwarm.spawnAgent(config.type, config.capabilities);
        agents.push(agent);
    }
    
    return agents;
}

/**
 * Create phase-specific task
 */
function createPhaseTask(phase, issue, previousPhases) {
    const phaseDescriptions = {
        inception: 'Analyze the issue and provide initial assessment, feasibility analysis, and recommended approach',
        discovery: 'Conduct detailed research, gather requirements, identify constraints, and assess risks',
        design: 'Create comprehensive solution design with components, interfaces, and data flows',
        architecture: 'Define technical architecture, technology stack, integration points, and scalability approach',
        implementation: 'Provide implementation roadmap, code structure, algorithms, and testing strategy',
        testing: 'Create test plans, test cases, performance scenarios, and validation criteria',
        deployment: 'Define deployment strategy, environment configs, rollback procedures, and monitoring',
        operations: 'Create operational runbook, monitoring setup, maintenance procedures, and troubleshooting guide'
    };
    
    let task = `Execute the ${phase} phase for this EPIC:\n\n`;
    task += `**Issue Title:** ${issue.title}\n\n`;
    task += `**Original Request:**\n${issue.body.split('##')[0].trim()}\n\n`;
    
    if (previousPhases.length > 0) {
        task += `**Previous Phase Results:**\n`;
        previousPhases.forEach(p => {
            task += `\n### ${phaseManager.capitalizeFirst(p.phase)} Phase Summary\n`;
            task += `${extractPhaseSummary(p.content)}\n`;
        });
        task += '\n';
    }
    
    task += `**${phaseManager.capitalizeFirst(phase)} Phase Objectives:**\n`;
    task += phaseDescriptions[phase] || 'Complete phase objectives';
    
    return task;
}

/**
 * Extract summary from phase content
 */
function extractPhaseSummary(phaseContent) {
    // Try to find the Summary section
    const summaryMatch = phaseContent.match(/### Summary\n([\s\S]*?)(?=###|\n##|$)/);
    if (summaryMatch) {
        return summaryMatch[1].trim();
    }
    
    // Fallback: get first few lines after the header
    const lines = phaseContent.split('\n').slice(2, 10);
    return lines.filter(line => line.trim() && !line.startsWith('#')).join('\n');
}

/**
 * Get strategy for phase
 */
function getPhaseStrategy(phase) {
    const strategies = {
        inception: 'adaptive',
        discovery: 'parallel',
        design: 'adaptive',
        architecture: 'sequential',
        implementation: 'parallel',
        testing: 'parallel',
        deployment: 'sequential',
        operations: 'adaptive'
    };
    
    return strategies[phase] || 'adaptive';
}

/**
 * Get hint for next phase
 */
function getNextPhaseHint(currentPhase, phaseManager) {
    const phases = phaseManager.phases;
    const currentIndex = phases.indexOf(currentPhase);
    
    if (currentIndex === phases.length - 1) {
        return `This was the final phase! The EPIC is now complete. 🎉`;
    }
    
    const nextPhase = phases[currentIndex + 1];
    return `To proceed to the **${phaseManager.capitalizeFirst(nextPhase)}** phase, use:\n` +
           `- The manual workflow trigger, or\n` +
           `- Comment: "transition to ${nextPhase} phase"`;
}

/**
 * Handle EPIC completion
 */
async function handleEpicCompletion(issueNumber) {
    await withRetry(() => github.createComment(issueNumber,
        `🎉 **EPIC Completed!**\n\n` +
        `Congratulations! All phases of this EPIC have been completed.\n\n` +
        `**EPIC Summary:**\n` +
        `- Total Phases Completed: 8\n` +
        `- Status: ✅ Complete\n\n` +
        `**Final Steps:**\n` +
        `1. Review the complete EPIC documentation\n` +
        `2. Ensure all deliverables are ready\n` +
        `3. Close this issue when ready\n\n` +
        `Thank you for using the GitHub Workflow Automation system!`
    ));
    
    // Add completion label
    await withRetry(() => github.addLabels(issueNumber, ['epic-complete', 'swarm-processed']));
}

/**
 * Format duration
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

// Run the update with exponential backoff on main function
updatePhase().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
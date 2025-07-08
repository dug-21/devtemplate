#!/usr/bin/env node

/**
 * Validate Phase Transition Action
 * Validates EPIC phase transitions before execution
 */

import { GitHubClient, withRetry } from './lib/github-client.js';
import { PhaseManager } from './lib/phase-manager.js';
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
const phaseManager = new PhaseManager();

/**
 * Main validation function
 */
async function validatePhaseTransition() {
    console.log(`Validating phase transition for issue #${issueNumber} to ${targetPhase}`);
    
    try {
        // Get issue details
        const issue = await withRetry(() => github.getIssue(issueNumber));
        
        // Check if this is an EPIC
        if (!phaseManager.isEpicIssue(issue.labels, issue.body)) {
            throw new Error('Phase transitions are only valid for EPIC issues');
        }
        
        // Get current phase
        const currentPhase = phaseManager.parseCurrentPhase(issue.body);
        console.log(`Current phase: ${currentPhase}`);
        
        // Validate transition
        const validation = phaseManager.validateTransition(currentPhase, targetPhase);
        
        if (!validation.valid) {
            console.error(`Invalid transition: ${validation.error}`);
            
            // Post validation failure comment
            await withRetry(() => github.createComment(issueNumber,
                `❌ **Phase Transition Validation Failed**\n\n` +
                `Cannot transition from **${currentPhase}** to **${targetPhase}**.\n\n` +
                `**Error:** ${validation.error}\n\n` +
                (validation.requiresApproval ? 
                    `This transition requires explicit approval from a repository maintainer. ` +
                    `Please have a maintainer approve this transition manually.` :
                    `Please ensure all requirements are met before attempting this transition.`)
            ));
            
            process.exit(1);
        }
        
        // Check exit criteria
        const exitCriteria = await phaseManager.checkExitCriteria(currentPhase, issue.body);
        
        if (!exitCriteria.met && !validation.warning) {
            console.error('Exit criteria not met');
            
            // Post criteria failure comment
            await withRetry(() => github.createComment(issueNumber,
                `⚠️ **Exit Criteria Not Met**\n\n` +
                `The following exit criteria for the **${currentPhase}** phase are not met:\n\n` +
                exitCriteria.missing.map(c => `- ❌ ${c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`).join('\n') +
                `\n\n**Options:**\n` +
                `1. Complete the missing criteria before transitioning\n` +
                `2. Have a maintainer override and force the transition\n` +
                `3. Document why these criteria are not applicable`
            ));
            
            process.exit(1);
        }
        
        // Check for warnings
        if (validation.warning) {
            console.warn(`Warning: ${validation.warning}`);
            
            await withRetry(() => github.createComment(issueNumber,
                `⚠️ **Phase Transition Warning**\n\n` +
                `${validation.warning}\n\n` +
                `The transition from **${currentPhase}** to **${targetPhase}** will skip intermediate phases.\n\n` +
                `**Skipped Phases:**\n` +
                getSkippedPhases(currentPhase, targetPhase).map(p => `- ${phaseManager.capitalizeFirst(p)}`).join('\n') +
                `\n\nThis transition is allowed but may miss important steps. Proceeding...`
            ));
        }
        
        // Validation successful
        console.log('Phase transition validation successful');
        
        // Post success comment
        await withRetry(() => github.createComment(issueNumber,
            `✅ **Phase Transition Validated**\n\n` +
            `Transition from **${currentPhase}** to **${targetPhase}** has been validated.\n\n` +
            `**Validation Results:**\n` +
            `- Current phase exit criteria: ${exitCriteria.met ? '✅ Met' : '⚠️ Overridden'}\n` +
            `- Target phase entry criteria: ✅ Met\n` +
            `- Transition path: ${validation.warning ? '⚠️ Non-sequential' : '✅ Sequential'}\n\n` +
            `Proceeding with phase transition...`
        ));
        
        // Set output for next step
        console.log(`::set-output name=validation_passed::true`);
        console.log(`::set-output name=current_phase::${currentPhase}`);
        console.log(`::set-output name=has_warning::${!!validation.warning}`);
        
    } catch (error) {
        console.error('Validation error:', error);
        
        await github.createComment(issueNumber,
            `❌ **Validation Error**\n\n` +
            `An error occurred during phase transition validation:\n` +
            `\`\`\`\n${error.message}\n\`\`\`\n\n` +
            `Please check the workflow logs for more details.`
        ).catch(console.error);
        
        process.exit(1);
    }
}

/**
 * Get list of skipped phases
 */
function getSkippedPhases(currentPhase, targetPhase) {
    const phases = new PhaseManager().phases;
    const currentIndex = phases.indexOf(currentPhase);
    const targetIndex = phases.indexOf(targetPhase);
    
    if (currentIndex === -1 || targetIndex === -1 || targetIndex <= currentIndex + 1) {
        return [];
    }
    
    return phases.slice(currentIndex + 1, targetIndex);
}

// Run validation
validatePhaseTransition().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
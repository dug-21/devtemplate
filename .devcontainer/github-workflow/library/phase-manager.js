/**
 * EPIC Phase Manager
 * Handles phase transitions and validations for EPIC workflow
 */

import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export class PhaseManager {
    constructor() {
        this.phases = [
            'inception',
            'discovery',
            'design',
            'architecture',
            'implementation',
            'testing',
            'deployment',
            'operations'
        ];
        
        this.phaseRequirements = {
            inception: {
                entry: [],
                exit: ['initial_assessment', 'feasibility_check']
            },
            discovery: {
                entry: ['inception_complete'],
                exit: ['requirements_documented', 'risks_assessed']
            },
            design: {
                entry: ['discovery_complete'],
                exit: ['design_approved', 'components_defined']
            },
            architecture: {
                entry: ['design_complete'],
                exit: ['architecture_documented', 'tech_stack_defined']
            },
            implementation: {
                entry: ['architecture_complete'],
                exit: ['code_complete', 'unit_tests_pass']
            },
            testing: {
                entry: ['implementation_complete'],
                exit: ['all_tests_pass', 'performance_validated']
            },
            deployment: {
                entry: ['testing_complete'],
                exit: ['deployed_successfully', 'monitoring_active']
            },
            operations: {
                entry: ['deployment_complete'],
                exit: ['runbook_created', 'handoff_complete']
            }
        };
    }

    /**
     * Get current phase from issue content
     */
    parseCurrentPhase(issueBody) {
        const phaseMatch = issueBody.match(/## Current Phase: (\w+)/i);
        if (phaseMatch) {
            return phaseMatch[1].toLowerCase();
        }
        
        // Check for phase in YAML frontmatter
        const yamlMatch = issueBody.match(/^---\n([\s\S]*?)\n---/);
        if (yamlMatch) {
            try {
                const metadata = yaml.load(yamlMatch[1]);
                return metadata.phase || 'inception';
            } catch (error) {
                console.error('Failed to parse YAML frontmatter:', error);
            }
        }
        
        return 'inception';
    }

    /**
     * Validate phase transition
     */
    validateTransition(currentPhase, targetPhase) {
        const currentIndex = this.phases.indexOf(currentPhase);
        const targetIndex = this.phases.indexOf(targetPhase);
        
        if (currentIndex === -1) {
            return {
                valid: false,
                error: `Invalid current phase: ${currentPhase}`
            };
        }
        
        if (targetIndex === -1) {
            return {
                valid: false,
                error: `Invalid target phase: ${targetPhase}`
            };
        }
        
        // Allow skipping phases with warning
        if (targetIndex > currentIndex + 1) {
            return {
                valid: true,
                warning: `Skipping phases from ${currentPhase} to ${targetPhase}`
            };
        }
        
        // Don't allow going backwards without explicit approval
        if (targetIndex < currentIndex) {
            return {
                valid: false,
                error: `Cannot go backwards from ${currentPhase} to ${targetPhase} without approval`,
                requiresApproval: true
            };
        }
        
        return { valid: true };
    }

    /**
     * Check if exit criteria are met
     */
    async checkExitCriteria(phase, issueContent) {
        const requirements = this.phaseRequirements[phase]?.exit || [];
        const missingCriteria = [];
        
        for (const criterion of requirements) {
            const criterionRegex = new RegExp(`\\[x\\].*${criterion}`, 'i');
            if (!criterionRegex.test(issueContent)) {
                missingCriteria.push(criterion);
            }
        }
        
        return {
            met: missingCriteria.length === 0,
            missing: missingCriteria
        };
    }

    /**
     * Generate phase update content
     */
    generatePhaseUpdate(phase, content, metadata = {}) {
        const timestamp = new Date().toISOString();
        const phaseNumber = this.phases.indexOf(phase);
        
        return `## Phase ${phaseNumber}: ${this.capitalizeFirst(phase)}
*Updated: ${timestamp}*

### Status
- [x] Phase Started
- [ ] Phase Completed

### Summary
${content}

### Metadata
\`\`\`yaml
phase: ${phase}
started: ${timestamp}
duration: pending
agentsUsed: ${metadata.agentsUsed || 0}
tasksCompleted: ${metadata.tasksCompleted || 0}
\`\`\`

### Exit Criteria
${this.generateExitCriteria(phase)}

---
`;
    }

    /**
     * Generate exit criteria checklist
     */
    generateExitCriteria(phase) {
        const criteria = this.phaseRequirements[phase]?.exit || [];
        
        if (criteria.length === 0) {
            return '- [ ] Phase objectives completed';
        }
        
        return criteria.map(criterion => {
            const readableName = criterion.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            return `- [ ] ${readableName}`;
        }).join('\n');
    }

    /**
     * Update issue with phase content
     */
    formatPhaseContent(issueBody, phase, newContent) {
        const phaseHeader = `## Phase ${this.phases.indexOf(phase)}: ${this.capitalizeFirst(phase)}`;
        const nextPhaseHeader = this.phases[this.phases.indexOf(phase) + 1] 
            ? `## Phase ${this.phases.indexOf(phase) + 1}:` 
            : '## Summary';
        
        // Check if phase section exists
        const phaseRegex = new RegExp(`${phaseHeader}[\\s\\S]*?(?=${nextPhaseHeader}|$)`, 'i');
        
        if (phaseRegex.test(issueBody)) {
            // Update existing phase section
            return issueBody.replace(phaseRegex, newContent);
        } else {
            // Add new phase section
            const insertPoint = issueBody.lastIndexOf('---');
            if (insertPoint !== -1) {
                return issueBody.slice(0, insertPoint) + '\n' + newContent + '\n' + issueBody.slice(insertPoint);
            } else {
                return issueBody + '\n\n' + newContent;
            }
        }
    }

    /**
     * Get phase progress
     */
    calculateProgress(issueBody) {
        const completedPhases = [];
        const inProgressPhase = this.parseCurrentPhase(issueBody);
        const inProgressIndex = this.phases.indexOf(inProgressPhase);
        
        // All phases before current are considered complete
        for (let i = 0; i < inProgressIndex; i++) {
            completedPhases.push(this.phases[i]);
        }
        
        const progress = {
            completed: completedPhases,
            current: inProgressPhase,
            remaining: this.phases.slice(inProgressIndex + 1),
            percentage: Math.round((inProgressIndex / this.phases.length) * 100)
        };
        
        return progress;
    }

    /**
     * Generate phase transition comment
     */
    generateTransitionComment(fromPhase, toPhase, results = {}) {
        const emoji = this.getPhaseEmoji(toPhase);
        
        return `${emoji} **Phase Transition: ${this.capitalizeFirst(fromPhase)} → ${this.capitalizeFirst(toPhase)}**

### ${this.capitalizeFirst(fromPhase)} Phase Summary
- Duration: ${results.duration || 'N/A'}
- Tasks Completed: ${results.tasksCompleted || 0}
- Agents Used: ${results.agentsUsed || 0}

### Exit Criteria Met
${results.exitCriteria?.map(c => `- ✅ ${c}`).join('\n') || '- ✅ All criteria satisfied'}

### Moving to ${this.capitalizeFirst(toPhase)} Phase
The system will now begin the ${toPhase} phase with appropriate AI agents.

---
*Automated by GitHub Workflow Automation*`;
    }

    /**
     * Get emoji for phase
     */
    getPhaseEmoji(phase) {
        const emojis = {
            inception: '💡',
            discovery: '🔍',
            design: '🎨',
            architecture: '🏗️',
            implementation: '💻',
            testing: '🧪',
            deployment: '🚀',
            operations: '⚙️'
        };
        
        return emojis[phase] || '📋';
    }

    /**
     * Capitalize first letter
     */
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Check if issue is an EPIC
     */
    isEpicIssue(labels, issueBody) {
        // Check labels
        if (labels.some(label => label.name.toLowerCase() === 'epic')) {
            return true;
        }
        
        // Check issue template
        if (issueBody.includes('template: epic') || issueBody.includes('workflow: epic')) {
            return true;
        }
        
        // Check YAML frontmatter
        const yamlMatch = issueBody.match(/^---\n([\s\S]*?)\n---/);
        if (yamlMatch) {
            try {
                const metadata = yaml.load(yamlMatch[1]);
                return metadata.template === 'epic' || metadata.workflow === 'epic';
            } catch (error) {
                console.error('Failed to parse YAML:', error);
            }
        }
        
        return false;
    }
}
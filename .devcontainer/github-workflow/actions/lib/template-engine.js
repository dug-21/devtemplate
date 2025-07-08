/**
 * Template Engine
 * Handles template selection and processing for issues
 */

import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TemplateEngine {
    constructor(config = {}) {
        this.config = {
            templatesDir: path.join(__dirname, '..', '..', '..', 'issues', 'issue-15', 'templates'),
            ...config
        };
        
        this.templateMappings = {
            'epic': '17-epic-feature.yml',
            'feature': '01-feature-development.yml',
            'bug': '02-bug-investigation.yml',
            'research': '03-research-task.yml',
            'architecture': '04-architecture-design.yml',
            'api': '05-api-integration.yml',
            'performance': '06-performance-optimization.yml',
            'security': '07-security-analysis.yml',
            'documentation': '08-documentation.yml',
            'testing': '09-testing-strategy.yml',
            'deployment': '10-deployment-planning.yml',
            'refactoring': '11-refactoring.yml',
            'database': '12-database-design.yml',
            'ui': '13-ui-ux-implementation.yml',
            'monitoring': '14-monitoring-observability.yml',
            'tech-debt': '15-technical-debt.yml',
            'project': '16-project-initialization.yml'
        };
    }

    /**
     * Select appropriate template based on issue content
     */
    async selectTemplate(issueTitle, issueBody, labels = []) {
        // Check for explicit template in issue
        const templateMatch = issueBody.match(/template:\s*(\S+)/i);
        if (templateMatch) {
            const templateName = templateMatch[1].toLowerCase();
            if (this.templateMappings[templateName]) {
                return await this.loadTemplate(this.templateMappings[templateName]);
            }
        }
        
        // Check labels
        for (const label of labels) {
            const labelName = label.name.toLowerCase();
            if (this.templateMappings[labelName]) {
                return await this.loadTemplate(this.templateMappings[labelName]);
            }
        }
        
        // Analyze title and body for keywords
        const content = `${issueTitle} ${issueBody}`.toLowerCase();
        
        if (content.includes('epic') || content.includes('major feature')) {
            return await this.loadTemplate(this.templateMappings.epic);
        }
        
        if (content.includes('bug') || content.includes('error') || content.includes('fix')) {
            return await this.loadTemplate(this.templateMappings.bug);
        }
        
        if (content.includes('research') || content.includes('investigate') || content.includes('analysis')) {
            return await this.loadTemplate(this.templateMappings.research);
        }
        
        if (content.includes('architecture') || content.includes('design') || content.includes('system')) {
            return await this.loadTemplate(this.templateMappings.architecture);
        }
        
        if (content.includes('api') || content.includes('integration') || content.includes('endpoint')) {
            return await this.loadTemplate(this.templateMappings.api);
        }
        
        if (content.includes('performance') || content.includes('optimize') || content.includes('speed')) {
            return await this.loadTemplate(this.templateMappings.performance);
        }
        
        if (content.includes('security') || content.includes('vulnerability') || content.includes('auth')) {
            return await this.loadTemplate(this.templateMappings.security);
        }
        
        if (content.includes('document') || content.includes('readme') || content.includes('guide')) {
            return await this.loadTemplate(this.templateMappings.documentation);
        }
        
        if (content.includes('test') || content.includes('quality') || content.includes('coverage')) {
            return await this.loadTemplate(this.templateMappings.testing);
        }
        
        if (content.includes('deploy') || content.includes('release') || content.includes('production')) {
            return await this.loadTemplate(this.templateMappings.deployment);
        }
        
        if (content.includes('refactor') || content.includes('cleanup') || content.includes('improve code')) {
            return await this.loadTemplate(this.templateMappings.refactoring);
        }
        
        if (content.includes('database') || content.includes('schema') || content.includes('migration')) {
            return await this.loadTemplate(this.templateMappings.database);
        }
        
        if (content.includes('ui') || content.includes('ux') || content.includes('interface')) {
            return await this.loadTemplate(this.templateMappings.ui);
        }
        
        if (content.includes('monitor') || content.includes('observability') || content.includes('metrics')) {
            return await this.loadTemplate(this.templateMappings.monitoring);
        }
        
        if (content.includes('tech debt') || content.includes('technical debt')) {
            return await this.loadTemplate(this.templateMappings['tech-debt']);
        }
        
        // Default to feature template
        return await this.loadTemplate(this.templateMappings.feature);
    }

    /**
     * Load template from file
     */
    async loadTemplate(filename) {
        try {
            const templatePath = path.join(this.config.templatesDir, filename);
            const content = await fs.readFile(templatePath, 'utf8');
            const template = yaml.load(content);
            
            return {
                ...template,
                filename,
                path: templatePath
            };
        } catch (error) {
            console.error(`Failed to load template ${filename}:`, error.message);
            return this.getDefaultTemplate();
        }
    }

    /**
     * Get default template structure
     */
    getDefaultTemplate() {
        return {
            name: 'General Task',
            description: 'Default template for general tasks',
            workflow: {
                type: 'sequential',
                phases: ['analysis', 'implementation', 'review']
            },
            agents: {
                primary: 'coordinator',
                support: ['coder', 'analyst']
            },
            complexity: 'medium',
            filename: 'default',
            path: null
        };
    }

    /**
     * Get workflow configuration from template
     */
    getWorkflowConfig(template) {
        return {
            type: template.workflow?.type || 'sequential',
            phases: template.workflow?.phases || ['analysis', 'implementation', 'review'],
            agents: template.agents || { primary: 'coordinator', support: [] },
            complexity: template.complexity || 'medium',
            estimatedDuration: template.estimatedDuration || 'unknown',
            requiresApproval: template.requiresApproval || false
        };
    }

    /**
     * Generate issue metadata from template
     */
    generateMetadata(template, issueNumber) {
        return {
            issueNumber,
            template: template.name,
            workflow: template.workflow?.type,
            complexity: template.complexity,
            startedAt: new Date().toISOString(),
            phases: template.workflow?.phases || [],
            currentPhase: template.workflow?.phases?.[0] || 'analysis',
            agents: template.agents,
            status: 'initialized'
        };
    }

    /**
     * Format template for display
     */
    formatTemplateInfo(template) {
        return `### Selected Template: ${template.name}

**Description:** ${template.description}
**Workflow Type:** ${template.workflow?.type || 'Sequential'}
**Complexity:** ${template.complexity || 'Medium'}
**Estimated Duration:** ${template.estimatedDuration || 'Variable'}

**Phases:**
${template.workflow?.phases?.map((phase, index) => `${index + 1}. ${phase}`).join('\n') || 'Standard workflow'}

**AI Agents:**
- Primary: ${template.agents?.primary || 'coordinator'}
- Support: ${template.agents?.support?.join(', ') || 'As needed'}

---`;
    }

    /**
     * Validate template structure
     */
    validateTemplate(template) {
        const required = ['name', 'description', 'workflow'];
        const missing = required.filter(field => !template[field]);
        
        if (missing.length > 0) {
            return {
                valid: false,
                errors: [`Missing required fields: ${missing.join(', ')}`]
            };
        }
        
        if (!template.workflow.phases || template.workflow.phases.length === 0) {
            return {
                valid: false,
                errors: ['Template must define at least one phase']
            };
        }
        
        return { valid: true };
    }

    /**
     * Get all available templates
     */
    async listTemplates() {
        try {
            const files = await fs.readdir(this.config.templatesDir);
            const templates = [];
            
            for (const file of files) {
                if (file.endsWith('.yml') || file.endsWith('.yaml')) {
                    const template = await this.loadTemplate(file);
                    templates.push({
                        filename: file,
                        name: template.name,
                        description: template.description,
                        complexity: template.complexity
                    });
                }
            }
            
            return templates;
        } catch (error) {
            console.error('Failed to list templates:', error.message);
            return [];
        }
    }
}
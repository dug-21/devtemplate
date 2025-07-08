#!/usr/bin/env node

import { GitHubClient } from '../library/github-client.js';
import { Logger } from '../library/logger.js';
import { RetryHandler } from '../library/retry-handler.js';
import { ValidationUtils } from '../library/validation-utils.js';
import { IssueProcessor } from '../library/issue-processor.js';
import { RuvSwarmRunner } from '../library/ruv-swarm-runner.js';
import { SubtaskGenerator } from '../library/subtask-generator.js';
import { DocumentationUpdater } from '../library/documentation-updater.js';
import { SetupValidator } from '../library/setup-validator.js';
import { ServiceManager } from '../library/service-manager.js';
import { LabelManager } from '../library/label-manager.js';
import fs from 'fs/promises';
import path from 'path';

class ManualTriggerAction {
  constructor() {
    this.logger = new Logger('ManualTriggerAction');
    this.github = new GitHubClient();
    this.retry = new RetryHandler();
    this.validator = new ValidationUtils();
    
    // Initialize action handlers
    this.actionHandlers = {
      'reprocess-issue': this.reprocessIssue.bind(this),
      'run-ruv-swarm': this.runRuvSwarm.bind(this),
      'generate-subtasks': this.generateSubtasks.bind(this),
      'update-documentation': this.updateDocumentation.bind(this),
      'validate-setup': this.validateSetup.bind(this),
      'restart-services': this.restartServices.bind(this),
      'clear-labels': this.clearLabels.bind(this),
      'force-close': this.forceClose.bind(this)
    };
    
    // Audit log configuration
    this.auditLogPath = process.env.AUDIT_LOG_PATH || '/workspaces/devtemplate/.devcontainer/github-workflow/logs/manual-actions.log';
  }

  async run() {
    try {
      this.logger.info('Starting manual trigger action');
      
      // Get action type and parameters from environment
      const actionType = process.env.MANUAL_ACTION_TYPE;
      const actionParams = process.env.MANUAL_ACTION_PARAMS ? 
        JSON.parse(process.env.MANUAL_ACTION_PARAMS) : {};
      
      // Validate action type
      if (!actionType) {
        throw new Error('MANUAL_ACTION_TYPE environment variable is required');
      }
      
      if (!this.actionHandlers[actionType]) {
        throw new Error(`Invalid action type: ${actionType}. Valid types: ${Object.keys(this.actionHandlers).join(', ')}`);
      }
      
      // Log the manual action for audit trail
      await this.logAuditEntry({
        timestamp: new Date().toISOString(),
        action: actionType,
        parameters: actionParams,
        user: process.env.GITHUB_ACTOR || 'unknown',
        repository: process.env.GITHUB_REPOSITORY || 'unknown',
        runId: process.env.GITHUB_RUN_ID || 'local'
      });
      
      // Execute the action with retry logic
      const result = await this.retry.execute(
        async () => this.actionHandlers[actionType](actionParams),
        {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          backoffFactor: 2
        }
      );
      
      this.logger.info(`Manual action '${actionType}' completed successfully`, { result });
      
      // Log successful completion
      await this.logAuditEntry({
        timestamp: new Date().toISOString(),
        action: actionType,
        status: 'success',
        result: result
      });
      
      process.exit(0);
    } catch (error) {
      this.logger.error('Manual trigger action failed', { error: error.message });
      
      // Log failure
      await this.logAuditEntry({
        timestamp: new Date().toISOString(),
        action: process.env.MANUAL_ACTION_TYPE || 'unknown',
        status: 'failure',
        error: error.message
      }).catch(e => this.logger.error('Failed to log audit entry', { error: e.message }));
      
      process.exit(1);
    }
  }

  async reprocessIssue(params) {
    this.logger.info('Reprocessing issue', params);
    
    // Validate required parameters
    const validation = this.validator.validateObject(params, {
      issueNumber: { required: true, type: 'number' }
    });
    
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }
    
    const processor = new IssueProcessor();
    const result = await processor.processIssue({
      number: params.issueNumber,
      forceReprocess: true
    });
    
    return {
      action: 'reprocess-issue',
      issueNumber: params.issueNumber,
      processed: result.success,
      subtasks: result.subtasks?.length || 0
    };
  }

  async runRuvSwarm(params) {
    this.logger.info('Running RUV swarm', params);
    
    // Validate optional parameters
    const validation = this.validator.validateObject(params, {
      issueNumber: { required: false, type: 'number' },
      taskIds: { required: false, type: 'array' },
      parallel: { required: false, type: 'boolean' }
    });
    
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }
    
    const runner = new RuvSwarmRunner();
    const result = await runner.run({
      issueNumber: params.issueNumber,
      taskIds: params.taskIds,
      parallel: params.parallel !== false
    });
    
    return {
      action: 'run-ruv-swarm',
      tasksProcessed: result.processed,
      successful: result.successful,
      failed: result.failed
    };
  }

  async generateSubtasks(params) {
    this.logger.info('Generating subtasks', params);
    
    // Validate required parameters
    const validation = this.validator.validateObject(params, {
      issueNumber: { required: true, type: 'number' },
      regenerate: { required: false, type: 'boolean' }
    });
    
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }
    
    const generator = new SubtaskGenerator();
    const result = await generator.generateForIssue({
      issueNumber: params.issueNumber,
      force: params.regenerate === true
    });
    
    return {
      action: 'generate-subtasks',
      issueNumber: params.issueNumber,
      subtasksGenerated: result.subtasks?.length || 0,
      files: result.files
    };
  }

  async updateDocumentation(params) {
    this.logger.info('Updating documentation', params);
    
    // Validate optional parameters
    const validation = this.validator.validateObject(params, {
      issueNumber: { required: false, type: 'number' },
      files: { required: false, type: 'array' },
      generateAll: { required: false, type: 'boolean' }
    });
    
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }
    
    const updater = new DocumentationUpdater();
    const result = await updater.update({
      issueNumber: params.issueNumber,
      files: params.files,
      generateAll: params.generateAll === true
    });
    
    return {
      action: 'update-documentation',
      filesUpdated: result.updated?.length || 0,
      files: result.updated
    };
  }

  async validateSetup(params) {
    this.logger.info('Validating setup', params);
    
    // Validate optional parameters
    const validation = this.validator.validateObject(params, {
      components: { required: false, type: 'array' },
      verbose: { required: false, type: 'boolean' }
    });
    
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }
    
    const validator = new SetupValidator();
    const result = await validator.validate({
      components: params.components || ['all'],
      verbose: params.verbose === true
    });
    
    return {
      action: 'validate-setup',
      valid: result.valid,
      checks: result.checks,
      errors: result.errors
    };
  }

  async restartServices(params) {
    this.logger.info('Restarting services', params);
    
    // Validate optional parameters
    const validation = this.validator.validateObject(params, {
      services: { required: false, type: 'array' },
      graceful: { required: false, type: 'boolean' }
    });
    
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }
    
    const manager = new ServiceManager();
    const result = await manager.restart({
      services: params.services || ['all'],
      graceful: params.graceful !== false
    });
    
    return {
      action: 'restart-services',
      restarted: result.restarted,
      failed: result.failed
    };
  }

  async clearLabels(params) {
    this.logger.info('Clearing labels', params);
    
    // Validate required parameters
    const validation = this.validator.validateObject(params, {
      issueNumber: { required: true, type: 'number' },
      labels: { required: false, type: 'array' },
      clearAll: { required: false, type: 'boolean' }
    });
    
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }
    
    const labelManager = new LabelManager();
    const result = await labelManager.clearLabels({
      issueNumber: params.issueNumber,
      labels: params.labels,
      clearAll: params.clearAll === true
    });
    
    return {
      action: 'clear-labels',
      issueNumber: params.issueNumber,
      labelsRemoved: result.removed?.length || 0,
      labels: result.removed
    };
  }

  async forceClose(params) {
    this.logger.info('Force closing issue', params);
    
    // Validate required parameters
    const validation = this.validator.validateObject(params, {
      issueNumber: { required: true, type: 'number' },
      reason: { required: false, type: 'string' },
      comment: { required: false, type: 'boolean' }
    });
    
    if (!validation.valid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }
    
    // Add comment if requested
    if (params.comment !== false) {
      await this.github.addComment(
        params.issueNumber,
        `Issue force-closed via manual trigger.\nReason: ${params.reason || 'No reason provided'}`
      );
    }
    
    // Close the issue
    await this.github.updateIssue(params.issueNumber, {
      state: 'closed',
      state_reason: 'completed'
    });
    
    // Add closed label
    await this.github.addLabels(params.issueNumber, ['force-closed']);
    
    return {
      action: 'force-close',
      issueNumber: params.issueNumber,
      closed: true,
      reason: params.reason
    };
  }

  async logAuditEntry(entry) {
    try {
      // Ensure log directory exists
      const logDir = path.dirname(this.auditLogPath);
      await fs.mkdir(logDir, { recursive: true });
      
      // Append to audit log
      const logEntry = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.auditLogPath, logEntry);
    } catch (error) {
      this.logger.error('Failed to write audit log', { error: error.message });
    }
  }
}

// Run the action
const action = new ManualTriggerAction();
action.run();
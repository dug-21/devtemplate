/**
 * ruv-swarm MCP Client
 * Handles integration with ruv-swarm for AI coordination
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class RuvSwarmClient {
    constructor(config = {}) {
        this.config = {
            maxAgents: 5,
            topology: 'mesh',
            strategy: 'adaptive',
            ...config
        };
        this.isInitialized = false;
    }

    /**
     * Initialize the swarm
     */
    async initializeSwarm() {
        try {
            const result = await this.executeMCPCommand('swarm_init', {
                topology: this.config.topology,
                maxAgents: this.config.maxAgents,
                strategy: this.config.strategy
            });
            
            this.isInitialized = true;
            console.log('Swarm initialized:', result);
            return result;
        } catch (error) {
            console.error('Failed to initialize swarm:', error.message);
            throw error;
        }
    }

    /**
     * Spawn an agent in the swarm
     */
    async spawnAgent(type, capabilities = []) {
        if (!this.isInitialized) {
            await this.initializeSwarm();
        }

        try {
            const result = await this.executeMCPCommand('agent_spawn', {
                type,
                capabilities
            });
            
            console.log(`Spawned ${type} agent:`, result);
            return result;
        } catch (error) {
            console.error(`Failed to spawn ${type} agent:`, error.message);
            throw error;
        }
    }

    /**
     * Orchestrate a task across the swarm
     */
    async orchestrateTask(task, options = {}) {
        if (!this.isInitialized) {
            await this.initializeSwarm();
        }

        try {
            const result = await this.executeMCPCommand('task_orchestrate', {
                task,
                priority: options.priority || 'medium',
                strategy: options.strategy || 'adaptive',
                maxAgents: options.maxAgents || this.config.maxAgents
            });
            
            console.log('Task orchestrated:', result);
            return result;
        } catch (error) {
            console.error('Failed to orchestrate task:', error.message);
            throw error;
        }
    }

    /**
     * Get swarm status
     */
    async getStatus(verbose = false) {
        try {
            const result = await this.executeMCPCommand('swarm_status', { verbose });
            return result;
        } catch (error) {
            console.error('Failed to get swarm status:', error.message);
            throw error;
        }
    }

    /**
     * Get task status
     */
    async getTaskStatus(taskId = null) {
        try {
            const params = { detailed: true };
            if (taskId) {
                params.taskId = taskId;
            }
            
            const result = await this.executeMCPCommand('task_status', params);
            return result;
        } catch (error) {
            console.error('Failed to get task status:', error.message);
            throw error;
        }
    }

    /**
     * Get task results
     */
    async getTaskResults(taskId, format = 'detailed') {
        try {
            const result = await this.executeMCPCommand('task_results', {
                taskId,
                format
            });
            return result;
        } catch (error) {
            console.error('Failed to get task results:', error.message);
            throw error;
        }
    }

    /**
     * Monitor swarm activity
     */
    async monitorActivity(duration = 10, interval = 1) {
        try {
            const result = await this.executeMCPCommand('swarm_monitor', {
                duration,
                interval
            });
            return result;
        } catch (error) {
            console.error('Failed to monitor swarm activity:', error.message);
            throw error;
        }
    }

    /**
     * Execute MCP command via Claude CLI
     */
    async executeMCPCommand(tool, params = {}) {
        const toolName = `mcp__ruv-swarm__${tool}`;
        const paramsJson = JSON.stringify(params);
        
        // Escape the JSON for shell
        const escapedParams = paramsJson.replace(/"/g, '\\"');
        
        const command = `claude mcp call ${toolName} '${escapedParams}'`;
        
        try {
            const { stdout, stderr } = await execAsync(command, {
                timeout: 30000 // 30 second timeout
            });
            
            if (stderr) {
                console.warn('MCP command warning:', stderr);
            }
            
            try {
                return JSON.parse(stdout);
            } catch {
                return stdout.trim();
            }
        } catch (error) {
            console.error('MCP command failed:', error.message);
            throw error;
        }
    }

    /**
     * Check if ruv-swarm is available
     */
    async isAvailable() {
        try {
            const { stdout } = await execAsync('claude mcp list', { timeout: 5000 });
            return stdout.includes('ruv-swarm');
        } catch (error) {
            console.error('Failed to check ruv-swarm availability:', error.message);
            return false;
        }
    }

    /**
     * Spawn agents for specific issue types
     */
    async spawnAgentsForIssue(issueType, complexity = 'medium') {
        const agents = [];
        
        switch (issueType) {
            case 'epic':
                agents.push(await this.spawnAgent('coordinator', ['planning', 'orchestration']));
                agents.push(await this.spawnAgent('researcher', ['requirements', 'analysis']));
                agents.push(await this.spawnAgent('analyst', ['design', 'architecture']));
                if (complexity === 'high') {
                    agents.push(await this.spawnAgent('optimizer', ['performance', 'scalability']));
                }
                break;
                
            case 'bug':
                agents.push(await this.spawnAgent('analyst', ['debugging', 'root-cause']));
                agents.push(await this.spawnAgent('coder', ['fix', 'testing']));
                break;
                
            case 'enhancement':
                agents.push(await this.spawnAgent('analyst', ['requirements', 'impact']));
                agents.push(await this.spawnAgent('coder', ['implementation', 'testing']));
                break;
                
            case 'research':
                agents.push(await this.spawnAgent('researcher', ['investigation', 'documentation']));
                agents.push(await this.spawnAgent('analyst', ['evaluation', 'recommendations']));
                break;
                
            default:
                agents.push(await this.spawnAgent('coordinator', ['general', 'planning']));
                agents.push(await this.spawnAgent('coder', ['implementation', 'testing']));
        }
        
        return agents;
    }
}
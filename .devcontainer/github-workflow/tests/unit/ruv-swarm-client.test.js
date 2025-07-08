const { RuvSwarmClient } = require('../../lib/ruv-swarm-client');
const { EventEmitter } = require('events');
const childProcess = require('child_process');

jest.mock('child_process');

describe('RuvSwarmClient', () => {
    let client;
    let mockMcpService;
    
    beforeEach(() => {
        mockMcpService = {
            url: 'http://localhost:3000',
            apiKey: 'test-api-key'
        };
        
        client = new RuvSwarmClient({
            mcpService: mockMcpService,
            maxAgents: 5,
            timeout: 30000
        });
        
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default values', () => {
            const defaultClient = new RuvSwarmClient();
            expect(defaultClient.maxAgents).toBe(10);
            expect(defaultClient.timeout).toBe(60000);
            expect(defaultClient.agents).toEqual(new Map());
        });

        it('should initialize with custom configuration', () => {
            expect(client.mcpService).toEqual(mockMcpService);
            expect(client.maxAgents).toBe(5);
            expect(client.timeout).toBe(30000);
        });

        it('should validate MCP service configuration', () => {
            expect(() => {
                new RuvSwarmClient({
                    mcpService: { url: 'invalid-url' }
                });
            }).toThrow('Invalid MCP service URL');
        });
    });

    describe('swarm initialization', () => {
        it('should initialize swarm successfully', async () => {
            const mockHealthCheck = jest.fn().mockResolvedValue({ status: 'healthy' });
            client.checkMcpHealth = mockHealthCheck;

            await client.initialize();
            
            expect(client.initialized).toBe(true);
            expect(mockHealthCheck).toHaveBeenCalled();
        });

        it('should handle MCP service unavailable', async () => {
            const mockHealthCheck = jest.fn().mockRejectedValue(new Error('Connection refused'));
            client.checkMcpHealth = mockHealthCheck;

            await expect(client.initialize()).rejects.toThrow('MCP service unavailable');
            expect(client.initialized).toBe(false);
        });

        it('should validate swarm configuration', async () => {
            const config = {
                maxAgents: 20,
                agentTimeout: 120000,
                retryPolicy: {
                    maxRetries: 5,
                    backoff: 'exponential'
                }
            };

            const isValid = await client.validateConfiguration(config);
            expect(isValid).toBe(true);
        });
    });

    describe('agent spawning', () => {
        beforeEach(async () => {
            client.initialized = true;
        });

        it('should spawn a new agent', async () => {
            const mockSpawn = jest.fn().mockReturnValue({
                pid: 12345,
                stdout: new EventEmitter(),
                stderr: new EventEmitter(),
                on: jest.fn()
            });
            childProcess.spawn = mockSpawn;

            const agentConfig = {
                task: 'analyze-issue',
                prompt: 'Analyze issue #123',
                context: { issueNumber: 123 }
            };

            const agent = await client.spawnAgent(agentConfig);
            
            expect(agent.id).toBeDefined();
            expect(agent.status).toBe('running');
            expect(agent.config).toEqual(agentConfig);
            expect(client.agents.has(agent.id)).toBe(true);
        });

        it('should enforce max agents limit', async () => {
            // Fill up agent slots
            for (let i = 0; i < client.maxAgents; i++) {
                client.agents.set(`agent-${i}`, {
                    id: `agent-${i}`,
                    status: 'running'
                });
            }

            await expect(client.spawnAgent({ task: 'test' }))
                .rejects.toThrow('Maximum number of agents reached');
        });

        it('should handle agent spawn failures', async () => {
            const mockSpawn = jest.fn().mockImplementation(() => {
                throw new Error('spawn ENOENT');
            });
            childProcess.spawn = mockSpawn;

            await expect(client.spawnAgent({ task: 'test' }))
                .rejects.toThrow('Failed to spawn agent');
        });

        it('should queue agents when at capacity', async () => {
            // Fill up agent slots
            for (let i = 0; i < client.maxAgents; i++) {
                client.agents.set(`agent-${i}`, {
                    id: `agent-${i}`,
                    status: 'running'
                });
            }

            const agentPromise = client.spawnAgentQueued({ task: 'queued-task' });
            expect(client.agentQueue.length).toBe(1);

            // Simulate agent completion
            client.agents.delete('agent-0');
            client.processQueue();

            const agent = await agentPromise;
            expect(agent).toBeDefined();
        });
    });

    describe('task orchestration', () => {
        beforeEach(() => {
            client.initialized = true;
        });

        it('should orchestrate multi-agent workflow', async () => {
            const workflow = {
                name: 'epic-analysis',
                phases: [
                    {
                        name: 'research',
                        agents: [
                            { task: 'research-api', prompt: 'Research API design' },
                            { task: 'research-ui', prompt: 'Research UI patterns' }
                        ]
                    },
                    {
                        name: 'synthesis',
                        agents: [
                            { task: 'synthesize', prompt: 'Combine research findings' }
                        ]
                    }
                ]
            };

            const mockSpawnAgent = jest.fn().mockResolvedValue({
                id: 'test-agent',
                waitForCompletion: jest.fn().mockResolvedValue({
                    status: 'completed',
                    result: 'Agent result'
                })
            });
            client.spawnAgent = mockSpawnAgent;

            const results = await client.orchestrateWorkflow(workflow);
            
            expect(results.phases).toHaveLength(2);
            expect(mockSpawnAgent).toHaveBeenCalledTimes(3);
            expect(results.status).toBe('completed');
        });

        it('should handle phase dependencies', async () => {
            const workflow = {
                name: 'dependent-workflow',
                phases: [
                    {
                        name: 'phase1',
                        agents: [{ task: 'task1' }]
                    },
                    {
                        name: 'phase2',
                        dependsOn: ['phase1'],
                        agents: [{ task: 'task2' }]
                    }
                ]
            };

            const executionOrder = [];
            client.spawnAgent = jest.fn().mockImplementation(({ task }) => {
                executionOrder.push(task);
                return Promise.resolve({
                    id: `agent-${task}`,
                    waitForCompletion: jest.fn().mockResolvedValue({ status: 'completed' })
                });
            });

            await client.orchestrateWorkflow(workflow);
            expect(executionOrder).toEqual(['task1', 'task2']);
        });

        it('should handle workflow failures gracefully', async () => {
            const workflow = {
                name: 'failing-workflow',
                phases: [
                    {
                        name: 'failing-phase',
                        agents: [{ task: 'failing-task' }]
                    }
                ]
            };

            client.spawnAgent = jest.fn().mockRejectedValue(new Error('Agent failed'));

            const results = await client.orchestrateWorkflow(workflow);
            expect(results.status).toBe('failed');
            expect(results.error).toBeDefined();
        });

        it('should support parallel agent execution', async () => {
            const startTimes = [];
            client.spawnAgent = jest.fn().mockImplementation(() => {
                startTimes.push(Date.now());
                return Promise.resolve({
                    id: 'test-agent',
                    waitForCompletion: () => new Promise(resolve => 
                        setTimeout(() => resolve({ status: 'completed' }), 100)
                    )
                });
            });

            const phase = {
                name: 'parallel-phase',
                agents: [
                    { task: 'task1' },
                    { task: 'task2' },
                    { task: 'task3' }
                ],
                parallel: true
            };

            await client.executePhase(phase);
            
            // Check that all agents started within 50ms of each other
            const maxDiff = Math.max(...startTimes) - Math.min(...startTimes);
            expect(maxDiff).toBeLessThan(50);
        });
    });

    describe('agent communication', () => {
        let mockAgent;

        beforeEach(() => {
            mockAgent = {
                id: 'test-agent',
                process: {
                    stdin: { write: jest.fn() },
                    stdout: new EventEmitter(),
                    stderr: new EventEmitter()
                },
                status: 'running'
            };
            client.agents.set(mockAgent.id, mockAgent);
        });

        it('should send messages to agents', async () => {
            const message = {
                type: 'command',
                data: { action: 'analyze', target: 'codebase' }
            };

            await client.sendToAgent(mockAgent.id, message);
            
            expect(mockAgent.process.stdin.write).toHaveBeenCalledWith(
                JSON.stringify(message) + '\n'
            );
        });

        it('should receive messages from agents', async () => {
            const messagePromise = client.waitForAgentMessage(mockAgent.id, 'result');
            
            // Simulate agent sending a message
            mockAgent.process.stdout.emit('data', 
                Buffer.from(JSON.stringify({
                    type: 'result',
                    data: { analysis: 'complete' }
                }) + '\n')
            );

            const message = await messagePromise;
            expect(message.type).toBe('result');
            expect(message.data.analysis).toBe('complete');
        });

        it('should handle malformed agent messages', async () => {
            const errorHandler = jest.fn();
            client.on('agent-error', errorHandler);

            mockAgent.process.stdout.emit('data', Buffer.from('invalid json\n'));
            
            expect(errorHandler).toHaveBeenCalledWith({
                agentId: mockAgent.id,
                error: expect.any(Error)
            });
        });

        it('should broadcast messages to all agents', async () => {
            const mockAgent2 = {
                id: 'test-agent-2',
                process: {
                    stdin: { write: jest.fn() }
                },
                status: 'running'
            };
            client.agents.set(mockAgent2.id, mockAgent2);

            const message = { type: 'broadcast', data: 'update' };
            await client.broadcastToAgents(message);

            expect(mockAgent.process.stdin.write).toHaveBeenCalled();
            expect(mockAgent2.process.stdin.write).toHaveBeenCalled();
        });
    });

    describe('agent lifecycle management', () => {
        let mockAgent;

        beforeEach(() => {
            mockAgent = {
                id: 'test-agent',
                process: {
                    kill: jest.fn(),
                    pid: 12345
                },
                status: 'running',
                startTime: Date.now()
            };
            client.agents.set(mockAgent.id, mockAgent);
        });

        it('should terminate an agent', async () => {
            await client.terminateAgent(mockAgent.id);
            
            expect(mockAgent.process.kill).toHaveBeenCalledWith('SIGTERM');
            expect(client.agents.has(mockAgent.id)).toBe(false);
        });

        it('should force kill agent after timeout', async () => {
            mockAgent.process.kill = jest.fn().mockImplementation((signal) => {
                if (signal === 'SIGKILL') {
                    mockAgent.status = 'terminated';
                }
            });

            await client.terminateAgent(mockAgent.id, { force: true });
            
            expect(mockAgent.process.kill).toHaveBeenCalledWith('SIGKILL');
        });

        it('should handle agent timeout', async () => {
            jest.useFakeTimers();
            
            const timeoutHandler = jest.fn();
            client.on('agent-timeout', timeoutHandler);
            
            mockAgent.timeout = 1000;
            client.startAgentTimeout(mockAgent);
            
            jest.advanceTimersByTime(1001);
            
            expect(timeoutHandler).toHaveBeenCalledWith({
                agentId: mockAgent.id,
                runtime: expect.any(Number)
            });
            
            jest.useRealTimers();
        });

        it('should restart failed agents', async () => {
            const originalConfig = { task: 'test-task' };
            mockAgent.config = originalConfig;
            mockAgent.restartCount = 0;
            
            client.spawnAgent = jest.fn().mockResolvedValue({
                id: 'new-agent',
                status: 'running'
            });

            const newAgent = await client.restartAgent(mockAgent.id);
            
            expect(client.agents.has(mockAgent.id)).toBe(false);
            expect(newAgent.id).toBe('new-agent');
            expect(client.spawnAgent).toHaveBeenCalledWith(originalConfig);
        });

        it('should respect max restart limit', async () => {
            mockAgent.restartCount = 3;
            client.maxRestarts = 3;

            await expect(client.restartAgent(mockAgent.id))
                .rejects.toThrow('Agent exceeded maximum restart attempts');
        });
    });

    describe('error handling and recovery', () => {
        it('should handle MCP service failures', async () => {
            const mockHealthCheck = jest.fn()
                .mockRejectedValueOnce(new Error('Service down'))
                .mockResolvedValueOnce({ status: 'healthy' });

            client.checkMcpHealth = mockHealthCheck;
            client.initialized = false;

            // Start recovery process
            const recovery = client.startRecovery();
            
            // Wait for recovery
            await recovery;
            
            expect(mockHealthCheck).toHaveBeenCalledTimes(2);
            expect(client.initialized).toBe(true);
        });

        it('should clean up orphaned agents', async () => {
            const orphanedAgent = {
                id: 'orphaned',
                process: null,
                status: 'running',
                startTime: Date.now() - 3600000 // 1 hour ago
            };
            
            client.agents.set(orphanedAgent.id, orphanedAgent);
            
            await client.cleanupOrphanedAgents();
            
            expect(client.agents.has(orphanedAgent.id)).toBe(false);
        });

        it('should emit events for monitoring', async () => {
            const events = [];
            
            client.on('agent-spawned', (e) => events.push({ type: 'spawned', ...e }));
            client.on('agent-completed', (e) => events.push({ type: 'completed', ...e }));
            client.on('agent-failed', (e) => events.push({ type: 'failed', ...e }));
            
            // Simulate agent lifecycle
            client.emit('agent-spawned', { agentId: 'test-1' });
            client.emit('agent-completed', { agentId: 'test-1', result: 'success' });
            client.emit('agent-failed', { agentId: 'test-2', error: 'timeout' });
            
            expect(events).toHaveLength(3);
            expect(events[0].type).toBe('spawned');
            expect(events[1].type).toBe('completed');
            expect(events[2].type).toBe('failed');
        });
    });

    describe('performance and resource management', () => {
        it('should track agent resource usage', async () => {
            const mockAgent = {
                id: 'resource-test',
                process: { pid: 12345 },
                status: 'running'
            };
            
            client.agents.set(mockAgent.id, mockAgent);
            
            const usage = await client.getAgentResourceUsage(mockAgent.id);
            
            expect(usage).toMatchObject({
                agentId: mockAgent.id,
                cpu: expect.any(Number),
                memory: expect.any(Number),
                runtime: expect.any(Number)
            });
        });

        it('should limit concurrent agent operations', async () => {
            client.concurrencyLimit = 2;
            
            const operations = [];
            for (let i = 0; i < 5; i++) {
                operations.push(client.spawnAgentWithLimit({ task: `task-${i}` }));
            }
            
            // Check that only 2 are running at a time
            const runningCount = client.getRunningAgentsCount();
            expect(runningCount).toBeLessThanOrEqual(2);
        });

        it('should provide swarm metrics', () => {
            // Set up some test agents
            client.agents.set('agent-1', { status: 'running' });
            client.agents.set('agent-2', { status: 'completed' });
            client.agents.set('agent-3', { status: 'failed' });
            
            const metrics = client.getSwarmMetrics();
            
            expect(metrics).toMatchObject({
                totalAgents: 3,
                runningAgents: 1,
                completedAgents: 1,
                failedAgents: 1,
                queueLength: 0,
                uptime: expect.any(Number)
            });
        });
    });

    describe('integration with MCP tools', () => {
        it('should discover available MCP tools', async () => {
            const mockTools = [
                { name: 'file-reader', description: 'Read files' },
                { name: 'code-analyzer', description: 'Analyze code' }
            ];
            
            client.fetchMcpTools = jest.fn().mockResolvedValue(mockTools);
            
            const tools = await client.discoverTools();
            
            expect(tools).toEqual(mockTools);
            expect(client.availableTools).toEqual(mockTools);
        });

        it('should validate tool availability before agent spawn', async () => {
            client.availableTools = ['file-reader', 'code-analyzer'];
            
            const agentConfig = {
                task: 'analyze',
                requiredTools: ['file-reader', 'unknown-tool']
            };
            
            await expect(client.spawnAgent(agentConfig))
                .rejects.toThrow('Required tool not available: unknown-tool');
        });

        it('should inject tool configurations into agents', async () => {
            const toolConfig = {
                'file-reader': { maxFileSize: 1048576 },
                'code-analyzer': { languages: ['javascript', 'python'] }
            };
            
            client.toolConfigurations = toolConfig;
            
            const agentConfig = {
                task: 'analyze',
                requiredTools: ['file-reader']
            };
            
            const processedConfig = client.prepareAgentConfig(agentConfig);
            
            expect(processedConfig.tools).toMatchObject({
                'file-reader': toolConfig['file-reader']
            });
        });
    });
});
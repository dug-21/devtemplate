const { ClaudeClient } = require('../../lib/claude-client');
const childProcess = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

jest.mock('child_process');
jest.mock('fs').promises;

describe('ClaudeClient', () => {
    let client;
    const mockApiKey = 'test-claude-api-key';
    
    beforeEach(() => {
        client = new ClaudeClient({
            apiKey: mockApiKey,
            model: 'claude-3-opus-20240229',
            maxTokens: 4096,
            temperature: 0.7
        });
        
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default values', () => {
            const defaultClient = new ClaudeClient();
            expect(defaultClient.model).toBe('claude-3-opus-20240229');
            expect(defaultClient.maxTokens).toBe(4096);
            expect(defaultClient.temperature).toBe(0);
        });

        it('should validate API key', () => {
            expect(() => {
                new ClaudeClient({ apiKey: '' });
            }).toThrow('Claude API key is required');
        });

        it('should validate model selection', () => {
            expect(() => {
                new ClaudeClient({ 
                    apiKey: 'test',
                    model: 'invalid-model' 
                });
            }).toThrow('Invalid Claude model');
        });

        it('should set rate limiting defaults', () => {
            expect(client.rateLimiter).toMatchObject({
                maxRequests: 50,
                windowMs: 60000,
                queue: []
            });
        });
    });

    describe('CLI integration', () => {
        it('should execute claude CLI command', async () => {
            const mockProcess = new EventEmitter();
            mockProcess.stdout = new EventEmitter();
            mockProcess.stderr = new EventEmitter();
            
            childProcess.spawn.mockReturnValue(mockProcess);
            
            const promptText = 'Analyze this code';
            const responsePromise = client.executeClaudeCommand(promptText);
            
            // Simulate CLI output
            mockProcess.stdout.emit('data', Buffer.from('Claude response text'));
            mockProcess.emit('close', 0);
            
            const response = await responsePromise;
            expect(response).toBe('Claude response text');
            expect(childProcess.spawn).toHaveBeenCalledWith('claude', [
                '--api-key', mockApiKey,
                '--model', client.model,
                '--max-tokens', client.maxTokens.toString(),
                '--temperature', client.temperature.toString()
            ], expect.any(Object));
        });

        it('should handle CLI command failures', async () => {
            const mockProcess = new EventEmitter();
            mockProcess.stdout = new EventEmitter();
            mockProcess.stderr = new EventEmitter();
            
            childProcess.spawn.mockReturnValue(mockProcess);
            
            const responsePromise = client.executeClaudeCommand('Test prompt');
            
            mockProcess.stderr.emit('data', Buffer.from('Error: API rate limit exceeded'));
            mockProcess.emit('close', 1);
            
            await expect(responsePromise).rejects.toThrow('Claude CLI error');
        });

        it('should handle CLI command timeout', async () => {
            const mockProcess = new EventEmitter();
            mockProcess.stdout = new EventEmitter();
            mockProcess.stderr = new EventEmitter();
            mockProcess.kill = jest.fn();
            
            childProcess.spawn.mockReturnValue(mockProcess);
            
            client.timeout = 100; // 100ms timeout
            const responsePromise = client.executeClaudeCommand('Test prompt');
            
            await expect(responsePromise).rejects.toThrow('Claude command timeout');
            expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
        });

        it('should stream responses', async () => {
            const mockProcess = new EventEmitter();
            mockProcess.stdout = new EventEmitter();
            mockProcess.stderr = new EventEmitter();
            
            childProcess.spawn.mockReturnValue(mockProcess);
            
            const chunks = [];
            const stream = client.streamClaudeResponse('Test prompt');
            
            stream.on('data', chunk => chunks.push(chunk));
            
            // Simulate streaming output
            mockProcess.stdout.emit('data', Buffer.from('First chunk '));
            mockProcess.stdout.emit('data', Buffer.from('Second chunk '));
            mockProcess.stdout.emit('data', Buffer.from('Final chunk'));
            mockProcess.emit('close', 0);
            
            await new Promise(resolve => stream.on('end', resolve));
            
            expect(chunks.join('')).toBe('First chunk Second chunk Final chunk');
        });
    });

    describe('prompt generation', () => {
        it('should generate phase-specific prompts', () => {
            const context = {
                phase: 'specification',
                issueTitle: 'Implement user authentication',
                issueBody: 'We need OAuth2 integration',
                labels: ['enhancement', 'backend']
            };
            
            const prompt = client.generatePhasePrompt(context);
            
            expect(prompt).toContain('specification');
            expect(prompt).toContain('Implement user authentication');
            expect(prompt).toContain('OAuth2 integration');
            expect(prompt).toContain('enhancement');
        });

        it('should include conversation history', () => {
            const history = [
                { role: 'user', content: 'Can you analyze this?' },
                { role: 'assistant', content: 'I\'ll analyze the code.' }
            ];
            
            const prompt = client.buildConversationalPrompt('New question', history);
            
            expect(prompt).toContain('Can you analyze this?');
            expect(prompt).toContain('I\'ll analyze the code.');
            expect(prompt).toContain('New question');
        });

        it('should apply system prompts correctly', () => {
            const systemPrompt = 'You are a helpful coding assistant.';
            const userPrompt = 'Explain this function';
            
            const fullPrompt = client.applySystemPrompt(systemPrompt, userPrompt);
            
            expect(fullPrompt).toMatch(/System: You are a helpful coding assistant/);
            expect(fullPrompt).toMatch(/Human: Explain this function/);
        });

        it('should truncate prompts exceeding token limits', () => {
            const longPrompt = 'x'.repeat(10000);
            const truncated = client.truncatePrompt(longPrompt, 1000);
            
            expect(truncated.length).toBeLessThan(longPrompt.length);
            expect(truncated).toContain('...[truncated]...');
        });

        it('should generate prompts for different task types', () => {
            const taskTypes = ['code-review', 'bug-fix', 'refactor', 'documentation'];
            
            taskTypes.forEach(taskType => {
                const prompt = client.generateTaskPrompt(taskType, {
                    code: 'function test() {}',
                    context: 'This function needs improvement'
                });
                
                expect(prompt).toContain(taskType);
                expect(prompt).toContain('function test()');
            });
        });
    });

    describe('error handling', () => {
        it('should handle malformed responses', async () => {
            const mockProcess = new EventEmitter();
            mockProcess.stdout = new EventEmitter();
            mockProcess.stderr = new EventEmitter();
            
            childProcess.spawn.mockReturnValue(mockProcess);
            
            const responsePromise = client.executeClaudeCommand('Test');
            
            // Send incomplete JSON
            mockProcess.stdout.emit('data', Buffer.from('{"incomplete": '));
            mockProcess.emit('close', 0);
            
            const response = await responsePromise;
            expect(response).toBe('{"incomplete": ');
        });

        it('should retry on rate limit errors', async () => {
            let attempts = 0;
            const mockProcess = new EventEmitter();
            mockProcess.stdout = new EventEmitter();
            mockProcess.stderr = new EventEmitter();
            
            childProcess.spawn.mockImplementation(() => {
                attempts++;
                const proc = new EventEmitter();
                proc.stdout = new EventEmitter();
                proc.stderr = new EventEmitter();
                
                setTimeout(() => {
                    if (attempts === 1) {
                        proc.stderr.emit('data', Buffer.from('Rate limit exceeded'));
                        proc.emit('close', 1);
                    } else {
                        proc.stdout.emit('data', Buffer.from('Success'));
                        proc.emit('close', 0);
                    }
                }, 10);
                
                return proc;
            });
            
            const response = await client.executeWithRetry('Test prompt');
            expect(response).toBe('Success');
            expect(attempts).toBe(2);
        });

        it('should handle network errors', async () => {
            childProcess.spawn.mockImplementation(() => {
                throw new Error('spawn ENOENT');
            });
            
            await expect(client.executeClaudeCommand('Test'))
                .rejects.toThrow('Failed to spawn Claude CLI');
        });

        it('should validate response format', async () => {
            const mockProcess = new EventEmitter();
            mockProcess.stdout = new EventEmitter();
            mockProcess.stderr = new EventEmitter();
            
            childProcess.spawn.mockReturnValue(mockProcess);
            
            client.validateResponse = true;
            const responsePromise = client.executeClaudeCommand('Test');
            
            mockProcess.stdout.emit('data', Buffer.from('Invalid response format'));
            mockProcess.emit('close', 0);
            
            await expect(responsePromise).rejects.toThrow('Invalid Claude response format');
        });
    });

    describe('rate limiting', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should enforce rate limits', async () => {
            const requests = [];
            
            // Queue up requests exceeding the limit
            for (let i = 0; i < 60; i++) {
                requests.push(client.rateLimitedRequest(() => Promise.resolve(i)));
            }
            
            // First 50 should be immediate
            const firstBatch = await Promise.all(requests.slice(0, 50));
            expect(firstBatch.length).toBe(50);
            
            // Next 10 should be queued
            expect(client.rateLimiter.queue.length).toBe(10);
            
            // Advance time to next window
            jest.advanceTimersByTime(60000);
            
            const secondBatch = await Promise.all(requests.slice(50));
            expect(secondBatch.length).toBe(10);
        });

        it('should handle burst requests', async () => {
            const burstSize = 10;
            const requests = [];
            
            for (let i = 0; i < burstSize; i++) {
                requests.push(
                    client.executeClaudeCommand(`Prompt ${i}`)
                );
            }
            
            // All requests should be queued properly
            expect(client.rateLimiter.currentRequests).toBeLessThanOrEqual(
                client.rateLimiter.maxRequests
            );
        });

        it('should provide rate limit status', () => {
            const status = client.getRateLimitStatus();
            
            expect(status).toMatchObject({
                remaining: expect.any(Number),
                resetTime: expect.any(Number),
                queueLength: expect.any(Number)
            });
        });
    });

    describe('response processing', () => {
        it('should parse structured responses', async () => {
            const mockProcess = new EventEmitter();
            mockProcess.stdout = new EventEmitter();
            mockProcess.stderr = new EventEmitter();
            
            childProcess.spawn.mockReturnValue(mockProcess);
            
            const responsePromise = client.getStructuredResponse('Generate JSON');
            
            const jsonResponse = JSON.stringify({
                analysis: 'Complete',
                recommendations: ['Fix bug', 'Add tests']
            });
            
            mockProcess.stdout.emit('data', Buffer.from(jsonResponse));
            mockProcess.emit('close', 0);
            
            const parsed = await responsePromise;
            expect(parsed.analysis).toBe('Complete');
            expect(parsed.recommendations).toHaveLength(2);
        });

        it('should extract code blocks', async () => {
            const responseWithCode = `
Here's the solution:

\`\`\`javascript
function hello() {
    console.log('Hello, world!');
}
\`\`\`

And here's another example:

\`\`\`python
def greet():
    print("Hello from Python")
\`\`\`
            `;
            
            const codeBlocks = client.extractCodeBlocks(responseWithCode);
            
            expect(codeBlocks).toHaveLength(2);
            expect(codeBlocks[0].language).toBe('javascript');
            expect(codeBlocks[0].code).toContain('console.log');
            expect(codeBlocks[1].language).toBe('python');
        });

        it('should format responses for GitHub', async () => {
            const claudeResponse = `
## Analysis

The code has the following issues:
- Missing error handling
- No input validation

## Recommendations

1. Add try-catch blocks
2. Validate user input
            `;
            
            const formatted = client.formatForGitHub(claudeResponse, {
                addSummary: true,
                addCodeBlocks: true
            });
            
            expect(formatted).toContain('<details>');
            expect(formatted).toContain('<summary>');
            expect(formatted).toContain('## Analysis');
        });

        it('should sanitize responses', () => {
            const unsafeResponse = `
                <script>alert('XSS')</script>
                Here's the analysis: <img src=x onerror=alert('XSS')>
                API_KEY=secret123
            `;
            
            const sanitized = client.sanitizeResponse(unsafeResponse);
            
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).not.toContain('onerror=');
            expect(sanitized).not.toContain('secret123');
        });
    });

    describe('caching', () => {
        beforeEach(() => {
            client.enableCache = true;
            client.cache = new Map();
        });

        it('should cache responses', async () => {
            const mockProcess = new EventEmitter();
            mockProcess.stdout = new EventEmitter();
            mockProcess.stderr = new EventEmitter();
            
            childProcess.spawn.mockReturnValue(mockProcess);
            
            const prompt = 'Cached prompt';
            const responsePromise = client.executeClaudeCommand(prompt);
            
            mockProcess.stdout.emit('data', Buffer.from('Cached response'));
            mockProcess.emit('close', 0);
            
            await responsePromise;
            
            // Second call should use cache
            const cachedResponse = await client.executeClaudeCommand(prompt);
            expect(cachedResponse).toBe('Cached response');
            expect(childProcess.spawn).toHaveBeenCalledTimes(1);
        });

        it('should respect cache TTL', async () => {
            jest.useFakeTimers();
            
            const cacheKey = 'test-prompt';
            client.cache.set(cacheKey, {
                response: 'Cached',
                timestamp: Date.now()
            });
            
            // Within TTL
            expect(client.getCachedResponse(cacheKey)).toBe('Cached');
            
            // After TTL
            jest.advanceTimersByTime(client.cacheTTL + 1000);
            expect(client.getCachedResponse(cacheKey)).toBeNull();
            
            jest.useRealTimers();
        });

        it('should clear cache on demand', () => {
            client.cache.set('key1', { response: 'value1' });
            client.cache.set('key2', { response: 'value2' });
            
            client.clearCache();
            
            expect(client.cache.size).toBe(0);
        });
    });

    describe('context management', () => {
        it('should maintain conversation context', async () => {
            const context = client.createContext('issue-123');
            
            await context.addMessage('user', 'First question');
            await context.addMessage('assistant', 'First response');
            
            expect(context.messages).toHaveLength(2);
            expect(context.tokenCount).toBeGreaterThan(0);
        });

        it('should truncate context when exceeding limits', async () => {
            const context = client.createContext('issue-456');
            
            // Add many messages
            for (let i = 0; i < 100; i++) {
                await context.addMessage('user', `Question ${i}`);
                await context.addMessage('assistant', `Response ${i}`);
            }
            
            const truncated = context.getTruncatedHistory(10);
            expect(truncated.length).toBeLessThanOrEqual(10);
        });

        it('should save and load context', async () => {
            const context = client.createContext('issue-789');
            await context.addMessage('user', 'Test question');
            
            const saved = await context.save();
            expect(saved).toBe(true);
            
            const loaded = await client.loadContext('issue-789');
            expect(loaded.messages).toHaveLength(1);
            expect(loaded.messages[0].content).toBe('Test question');
        });
    });

    describe('integration with GitHub issues', () => {
        it('should format response for issue comment', async () => {
            const claudeResponse = 'This is my analysis of the issue.';
            const formatted = client.formatIssueComment(claudeResponse, {
                issueNumber: 123,
                mentionUser: '@testuser',
                addTimestamp: true
            });
            
            expect(formatted).toContain('@testuser');
            expect(formatted).toContain('This is my analysis');
            expect(formatted).toMatch(/Generated at: \d{4}-\d{2}-\d{2}/);
        });

        it('should handle mention detection', () => {
            const comment = 'Hey @claude-bot can you help with this @user123?';
            const mentions = client.detectMentions(comment);
            
            expect(mentions).toContain('@claude-bot');
            expect(mentions).toContain('@user123');
        });

        it('should process issue templates', async () => {
            const issueBody = `
**Epic Title**: Implement authentication
**Description**: Add OAuth2 support
**Acceptance Criteria**:
- [ ] Login works
- [ ] Logout works
            `;
            
            const processed = client.processIssueTemplate(issueBody);
            
            expect(processed.epicTitle).toBe('Implement authentication');
            expect(processed.description).toContain('OAuth2');
            expect(processed.acceptanceCriteria).toHaveLength(2);
        });
    });

    describe('performance monitoring', () => {
        it('should track request metrics', async () => {
            const mockProcess = new EventEmitter();
            mockProcess.stdout = new EventEmitter();
            mockProcess.stderr = new EventEmitter();
            
            childProcess.spawn.mockReturnValue(mockProcess);
            
            const startMetrics = client.getMetrics();
            
            const responsePromise = client.executeClaudeCommand('Test');
            mockProcess.stdout.emit('data', Buffer.from('Response'));
            mockProcess.emit('close', 0);
            
            await responsePromise;
            
            const endMetrics = client.getMetrics();
            expect(endMetrics.totalRequests).toBe(startMetrics.totalRequests + 1);
            expect(endMetrics.averageResponseTime).toBeGreaterThan(0);
        });

        it('should log slow requests', async () => {
            const slowThreshold = 5000;
            client.slowRequestThreshold = slowThreshold;
            
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            // Simulate slow request
            client.logRequestMetrics('test-prompt', slowThreshold + 1000);
            
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Slow Claude request')
            );
            
            warnSpy.mockRestore();
        });
    });
});
const { PhaseManager } = require('../../lib/phase-manager');
const { GitHubClient } = require('../../lib/github-client');
const { ClaudeClient } = require('../../lib/claude-client');

jest.mock('../../lib/github-client');
jest.mock('../../lib/claude-client');

describe('PhaseManager', () => {
    let phaseManager;
    let mockGitHubClient;
    let mockClaudeClient;
    
    beforeEach(() => {
        mockGitHubClient = {
            getIssue: jest.fn(),
            updateIssue: jest.fn(),
            createComment: jest.fn(),
            addLabels: jest.fn(),
            removeLabel: jest.fn(),
            setLabels: jest.fn(),
            createIssue: jest.fn()
        };
        
        mockClaudeClient = {
            generatePhasePrompt: jest.fn(),
            executeClaudeCommand: jest.fn()
        };
        
        GitHubClient.mockImplementation(() => mockGitHubClient);
        ClaudeClient.mockImplementation(() => mockClaudeClient);
        
        phaseManager = new PhaseManager({
            githubClient: mockGitHubClient,
            claudeClient: mockClaudeClient,
            phases: [
                'specification',
                'implementation-planning',
                'implementation',
                'validation',
                'documentation',
                'completion'
            ]
        });
    });

    describe('constructor', () => {
        it('should initialize with default phases', () => {
            const defaultManager = new PhaseManager({
                githubClient: mockGitHubClient,
                claudeClient: mockClaudeClient
            });
            
            expect(defaultManager.phases).toEqual([
                'specification',
                'implementation-planning',
                'implementation',
                'validation',
                'documentation',
                'completion'
            ]);
        });

        it('should validate custom phases', () => {
            expect(() => {
                new PhaseManager({
                    githubClient: mockGitHubClient,
                    claudeClient: mockClaudeClient,
                    phases: []
                });
            }).toThrow('At least one phase is required');
        });

        it('should initialize phase configurations', () => {
            expect(phaseManager.phaseConfigs.specification).toBeDefined();
            expect(phaseManager.phaseConfigs.implementation).toBeDefined();
        });
    });

    describe('phase validation', () => {
        it('should validate phase entry criteria', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'epic' }],
                body: 'Epic description with all required sections'
            };
            
            mockGitHubClient.getIssue.mockResolvedValue(issue);
            
            const canEnter = await phaseManager.canEnterPhase('specification', issue);
            expect(canEnter).toBe(true);
        });

        it('should check prerequisite phases', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'phase:specification' }]
            };
            
            const canEnter = await phaseManager.canEnterPhase('implementation', issue);
            expect(canEnter).toBe(false); // Missing implementation-planning
        });

        it('should validate phase exit criteria', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'phase:specification' }],
                body: `
# Specification
## Overview
Complete specification

## Requirements
- Requirement 1
- Requirement 2

## Technical Details
Detailed implementation approach
                `
            };
            
            const canExit = await phaseManager.canExitPhase('specification', issue);
            expect(canExit).toBe(true);
        });

        it('should detect incomplete phase requirements', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'phase:implementation' }],
                body: 'Incomplete implementation'
            };
            
            const validation = await phaseManager.validatePhaseCompletion('implementation', issue);
            
            expect(validation.isComplete).toBe(false);
            expect(validation.missingRequirements).toContain('Code implementation');
            expect(validation.missingRequirements).toContain('Unit tests');
        });
    });

    describe('phase transitions', () => {
        it('should transition to next phase', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'phase:specification' }]
            };
            
            mockGitHubClient.getIssue.mockResolvedValue(issue);
            mockGitHubClient.removeLabel.mockResolvedValue(true);
            mockGitHubClient.addLabels.mockResolvedValue(true);
            
            await phaseManager.transitionToPhase(issue.number, 'implementation-planning');
            
            expect(mockGitHubClient.removeLabel).toHaveBeenCalledWith(123, 'phase:specification');
            expect(mockGitHubClient.addLabels).toHaveBeenCalledWith(123, ['phase:implementation-planning']);
        });

        it('should update issue body on phase transition', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'phase:specification' }],
                body: 'Original body'
            };
            
            mockGitHubClient.getIssue.mockResolvedValue(issue);
            mockClaudeClient.generatePhasePrompt.mockReturnValue('Phase prompt');
            mockClaudeClient.executeClaudeCommand.mockResolvedValue('Phase content');
            
            await phaseManager.transitionToPhase(issue.number, 'implementation-planning');
            
            expect(mockGitHubClient.updateIssue).toHaveBeenCalledWith(123, {
                body: expect.stringContaining('# Implementation Planning')
            });
        });

        it('should create phase transition comment', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'phase:specification' }]
            };
            
            mockGitHubClient.getIssue.mockResolvedValue(issue);
            
            await phaseManager.transitionToPhase(issue.number, 'implementation-planning');
            
            expect(mockGitHubClient.createComment).toHaveBeenCalledWith(
                123,
                expect.stringContaining('Phase transition: `specification` → `implementation-planning`')
            );
        });

        it('should handle transition failures', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'phase:specification' }]
            };
            
            mockGitHubClient.getIssue.mockResolvedValue(issue);
            mockGitHubClient.removeLabel.mockRejectedValue(new Error('API error'));
            
            await expect(phaseManager.transitionToPhase(issue.number, 'implementation-planning'))
                .rejects.toThrow('Failed to transition phase');
        });

        it('should prevent invalid phase transitions', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'phase:specification' }]
            };
            
            mockGitHubClient.getIssue.mockResolvedValue(issue);
            
            await expect(phaseManager.transitionToPhase(issue.number, 'validation'))
                .rejects.toThrow('Cannot transition from specification to validation');
        });
    });

    describe('progress tracking', () => {
        it('should calculate phase progress', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'phase:implementation' }],
                body: `
# Implementation

## Tasks
- [x] Create main module
- [x] Add error handling
- [ ] Write unit tests
- [ ] Integration tests
                `
            };
            
            const progress = await phaseManager.calculatePhaseProgress(issue);
            
            expect(progress.completedTasks).toBe(2);
            expect(progress.totalTasks).toBe(4);
            expect(progress.percentage).toBe(50);
        });

        it('should track overall epic progress', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'phase:implementation' }]
            };
            
            mockGitHubClient.getIssue.mockResolvedValue(issue);
            
            const progress = await phaseManager.getEpicProgress(issue.number);
            
            expect(progress.currentPhase).toBe('implementation');
            expect(progress.currentPhaseIndex).toBe(2);
            expect(progress.totalPhases).toBe(6);
            expect(progress.overallProgress).toBeCloseTo(33.33, 1);
        });

        it('should generate progress report', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'phase:validation' }],
                created_at: '2024-01-01T00:00:00Z'
            };
            
            mockGitHubClient.getIssue.mockResolvedValue(issue);
            
            const report = await phaseManager.generateProgressReport(issue.number);
            
            expect(report).toContain('Current Phase: validation');
            expect(report).toContain('Progress: 3/6 phases completed');
            expect(report).toContain('Time in current phase:');
        });

        it('should detect stalled phases', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'phase:implementation' }],
                updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
            };
            
            mockGitHubClient.getIssue.mockResolvedValue(issue);
            
            const isStalled = await phaseManager.isPhaseStalled(issue.number);
            expect(isStalled).toBe(true);
        });
    });

    describe('AI prompt generation', () => {
        it('should generate phase-specific prompts', () => {
            const issue = {
                title: 'Implement OAuth2 authentication',
                body: 'We need secure authentication',
                labels: [{ name: 'backend' }, { name: 'security' }]
            };
            
            const prompt = phaseManager.generatePhasePrompt('specification', issue);
            
            expect(prompt).toContain('specification phase');
            expect(prompt).toContain('Implement OAuth2 authentication');
            expect(prompt).toContain('backend');
            expect(prompt).toContain('security');
        });

        it('should include phase-specific instructions', () => {
            const phases = ['specification', 'implementation-planning', 'implementation'];
            
            phases.forEach(phase => {
                const prompt = phaseManager.generatePhasePrompt(phase, {
                    title: 'Test issue',
                    body: 'Test body'
                });
                
                expect(prompt).toContain(phaseManager.phaseConfigs[phase].promptTemplate);
            });
        });

        it('should incorporate previous phase outputs', async () => {
            const issue = {
                number: 123,
                title: 'Test Epic',
                body: `
# Specification
Previous specification content

# Implementation Planning
Previous planning content
                `
            };
            
            const prompt = phaseManager.generatePhasePrompt('implementation', issue);
            
            expect(prompt).toContain('Previous specification content');
            expect(prompt).toContain('Previous planning content');
        });

        it('should handle custom prompt templates', () => {
            phaseManager.setPhasePromptTemplate('specification', 
                'Custom template: {{title}} - {{labels}}');
            
            const prompt = phaseManager.generatePhasePrompt('specification', {
                title: 'Custom Epic',
                labels: [{ name: 'urgent' }]
            });
            
            expect(prompt).toContain('Custom template: Custom Epic - urgent');
        });
    });

    describe('sub-task management', () => {
        it('should create sub-tasks when needed', async () => {
            const parentIssue = {
                number: 123,
                title: 'Parent Epic',
                labels: [{ name: 'phase:implementation-planning' }]
            };
            
            const subTasks = [
                { title: 'Design API schema', description: 'Create OpenAPI spec' },
                { title: 'Setup database', description: 'Configure PostgreSQL' }
            ];
            
            mockGitHubClient.getIssue.mockResolvedValue(parentIssue);
            mockGitHubClient.createIssue.mockResolvedValue({ number: 124 });
            
            const created = await phaseManager.createSubTasks(parentIssue.number, subTasks);
            
            expect(mockGitHubClient.createIssue).toHaveBeenCalledTimes(2);
            expect(created).toHaveLength(2);
        });

        it('should link sub-tasks to parent', async () => {
            const parentIssue = { number: 123 };
            const subTask = { 
                title: 'Sub-task 1',
                description: 'Description'
            };
            
            mockGitHubClient.createIssue.mockResolvedValue({ number: 124 });
            
            await phaseManager.createSubTask(parentIssue.number, subTask);
            
            expect(mockGitHubClient.createIssue).toHaveBeenCalledWith({
                title: 'Sub-task 1',
                body: expect.stringContaining('Parent issue: #123'),
                labels: ['sub-task', 'parent:123']
            });
        });

        it('should track sub-task completion', async () => {
            const parentIssue = { number: 123 };
            const subTasks = [
                { number: 124, state: 'closed' },
                { number: 125, state: 'open' },
                { number: 126, state: 'closed' }
            ];
            
            mockGitHubClient.listIssues.mockResolvedValue(subTasks);
            
            const completion = await phaseManager.getSubTaskCompletion(parentIssue.number);
            
            expect(completion.total).toBe(3);
            expect(completion.completed).toBe(2);
            expect(completion.percentage).toBeCloseTo(66.67, 1);
        });

        it('should auto-close completed sub-tasks', async () => {
            const subTasks = [
                { number: 124, state: 'open', labels: [{ name: 'sub-task' }] },
                { number: 125, state: 'open', labels: [{ name: 'sub-task' }] }
            ];
            
            mockGitHubClient.listIssues.mockResolvedValue(subTasks);
            mockGitHubClient.updateIssue.mockResolvedValue(true);
            
            await phaseManager.closeCompletedSubTasks(123);
            
            // Should check each sub-task for completion criteria
            expect(mockGitHubClient.getIssue).toHaveBeenCalledWith(124);
            expect(mockGitHubClient.getIssue).toHaveBeenCalledWith(125);
        });
    });

    describe('phase templates', () => {
        it('should apply phase templates to issue body', async () => {
            const template = phaseManager.getPhaseTemplate('specification');
            
            expect(template).toContain('## Overview');
            expect(template).toContain('## Requirements');
            expect(template).toContain('## Technical Approach');
            expect(template).toContain('## Success Criteria');
        });

        it('should merge template with existing content', async () => {
            const existingBody = `
# Existing Content
This should be preserved

# Specification
Old specification
            `;
            
            const newBody = phaseManager.mergePhaseContent(
                existingBody,
                'specification',
                'New specification content'
            );
            
            expect(newBody).toContain('Existing Content');
            expect(newBody).toContain('This should be preserved');
            expect(newBody).toContain('New specification content');
            expect(newBody).not.toContain('Old specification');
        });

        it('should validate template sections', () => {
            const body = `
# Implementation
## Code Changes
Some code here

## Unit Tests
Test descriptions
            `;
            
            const validation = phaseManager.validateTemplateCompleteness(
                'implementation',
                body
            );
            
            expect(validation.isComplete).toBe(false);
            expect(validation.missingSections).toContain('Integration Tests');
        });
    });

    describe('phase automation', () => {
        it('should auto-transition on completion', async () => {
            phaseManager.enableAutoTransition = true;
            
            const issue = {
                number: 123,
                labels: [{ name: 'phase:specification' }],
                body: 'Complete specification'
            };
            
            mockGitHubClient.getIssue.mockResolvedValue(issue);
            jest.spyOn(phaseManager, 'canExitPhase').mockResolvedValue(true);
            jest.spyOn(phaseManager, 'transitionToPhase').mockResolvedValue(true);
            
            await phaseManager.checkAutoTransition(issue.number);
            
            expect(phaseManager.transitionToPhase).toHaveBeenCalledWith(
                123,
                'implementation-planning'
            );
        });

        it('should schedule phase reviews', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'phase:implementation' }],
                updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            };
            
            mockGitHubClient.getIssue.mockResolvedValue(issue);
            
            const needsReview = await phaseManager.needsPhaseReview(issue.number);
            expect(needsReview).toBe(true);
            
            await phaseManager.requestPhaseReview(issue.number);
            
            expect(mockGitHubClient.createComment).toHaveBeenCalledWith(
                123,
                expect.stringContaining('review requested')
            );
        });

        it('should generate phase checklists', async () => {
            const checklist = phaseManager.generatePhaseChecklist('validation');
            
            expect(checklist).toContain('- [ ] All unit tests passing');
            expect(checklist).toContain('- [ ] Integration tests completed');
            expect(checklist).toContain('- [ ] Performance benchmarks met');
            expect(checklist).toContain('- [ ] Security review completed');
        });
    });

    describe('error recovery', () => {
        it('should handle phase rollback', async () => {
            const issue = {
                number: 123,
                labels: [{ name: 'phase:implementation' }]
            };
            
            mockGitHubClient.getIssue.mockResolvedValue(issue);
            
            await phaseManager.rollbackPhase(issue.number, 'Phase failed due to errors');
            
            expect(mockGitHubClient.removeLabel).toHaveBeenCalledWith(123, 'phase:implementation');
            expect(mockGitHubClient.addLabels).toHaveBeenCalledWith(123, ['phase:implementation-planning']);
            expect(mockGitHubClient.createComment).toHaveBeenCalledWith(
                123,
                expect.stringContaining('Phase rollback')
            );
        });

        it('should recover from partial transitions', async () => {
            const issue = {
                number: 123,
                labels: [
                    { name: 'phase:specification' },
                    { name: 'phase:implementation' } // Invalid state
                ]
            };
            
            mockGitHubClient.getIssue.mockResolvedValue(issue);
            
            await phaseManager.repairPhaseState(issue.number);
            
            expect(mockGitHubClient.setLabels).toHaveBeenCalledWith(
                123,
                expect.arrayContaining(['phase:specification'])
            );
        });
    });

    describe('phase metrics', () => {
        it('should track phase duration', async () => {
            const phaseHistory = [
                {
                    phase: 'specification',
                    startTime: '2024-01-01T00:00:00Z',
                    endTime: '2024-01-03T00:00:00Z'
                },
                {
                    phase: 'implementation-planning',
                    startTime: '2024-01-03T00:00:00Z',
                    endTime: '2024-01-05T00:00:00Z'
                }
            ];
            
            const metrics = phaseManager.calculatePhaseMetrics(phaseHistory);
            
            expect(metrics.averagePhaseDuration).toBe(2 * 24 * 60 * 60 * 1000); // 2 days
            expect(metrics.longestPhase).toBe('specification');
            expect(metrics.totalDuration).toBe(4 * 24 * 60 * 60 * 1000); // 4 days
        });

        it('should identify bottleneck phases', async () => {
            const historicalData = [
                { phase: 'specification', duration: 2 },
                { phase: 'implementation', duration: 10 },
                { phase: 'validation', duration: 3 }
            ];
            
            const bottlenecks = phaseManager.identifyBottlenecks(historicalData);
            
            expect(bottlenecks[0].phase).toBe('implementation');
            expect(bottlenecks[0].averageDuration).toBe(10);
        });
    });
});
#!/usr/bin/env node

/**
 * Test script for AI Attribution
 * Demonstrates different types of AI-attributed comments
 */

const { Octokit } = require('@octokit/rest');
const AIAttribution = require('./ai-attribution');
const EnhancedGitHubClient = require('./enhanced-github-client');

async function testAIAttribution() {
    console.log('🧪 Testing AI Attribution System\n');

    // Configuration
    const config = {
        github: {
            owner: process.env.GITHUB_OWNER || 'dug-21',
            repo: process.env.GITHUB_REPO || 'devtemplate'
        },
        defaultAgentType: 'CLAUDE'
    };

    // Create Octokit instance
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN || process.env.AGENT_TOKEN
    });

    // Create enhanced client
    const client = new EnhancedGitHubClient(octokit, config);

    // Test issue number (can be overridden)
    const testIssueNumber = process.argv[2] ? parseInt(process.argv[2]) : 10;

    console.log(`📍 Testing on issue #${testIssueNumber}\n`);

    try {
        // Test 1: Claude AI comment
        console.log('1️⃣ Testing Claude AI comment...');
        await client.postComment(
            testIssueNumber,
            `Hello! I'm analyzing your issue and will provide assistance shortly.

I've identified the following key points:
- The issue is about differentiating human vs AI updates
- Currently all updates show as coming from the human user
- We need clear attribution for AI-generated content

I'll implement a solution that adds clear visual indicators to AI-generated comments.`,
            {
                agentType: 'CLAUDE',
                metadata: {
                    taskId: 'test-001',
                    sessionId: 'demo-session'
                }
            }
        );
        console.log('✅ Claude comment posted\n');

        // Wait a bit between comments
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 2: Swarm Coordinator comment
        console.log('2️⃣ Testing Swarm Coordinator comment...');
        await client.postComment(
            testIssueNumber,
            `I'm coordinating the following agents to work on this issue:
            
**Agent Assignments:**
- 🔬 Researcher: Analyzing existing code patterns
- 💻 Coder: Implementing the attribution system
- 📊 Analyst: Reviewing impact and dependencies
- 🧪 Tester: Validating the solution

All agents are now active and collaborating on the solution.`,
            {
                agentType: 'SWARM_COORDINATOR',
                metadata: {
                    phase: 'implementation'
                }
            }
        );
        console.log('✅ Swarm Coordinator comment posted\n');

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 3: Progress update
        console.log('3️⃣ Testing progress update...');
        await client.postProgressUpdate(testIssueNumber, {
            status: 'In Progress',
            phase: 'Implementation',
            percentage: 65,
            currentTask: 'Creating AI attribution module',
            updates: [
                'Analyzed current implementation',
                'Designed attribution system',
                'Created AIAttribution class',
                'Implementing enhanced GitHub client'
            ]
        }, 'SWARM_CODER');
        console.log('✅ Progress update posted\n');

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 4: Multi-agent comment
        console.log('4️⃣ Testing multi-agent comment...');
        await client.postMultiAgentComment(testIssueNumber, [
            {
                agentType: 'SWARM_RESEARCHER',
                content: `**Research Findings:**
- All comments currently use the human's GitHub token
- No built-in way to change the displayed author
- Solution must use visual attribution in comment body`
            },
            {
                agentType: 'SWARM_CODER',
                content: `**Implementation Status:**
- Created AIAttribution module ✅
- Enhanced GitHub client with attribution ✅
- Created patch for existing automation ✅
- Ready for integration`
            },
            {
                agentType: 'SWARM_ANALYST',
                content: `**Impact Analysis:**
- Changes are backward compatible
- No breaking changes to existing code
- Clear visual differentiation achieved
- Easy to identify AI vs human comments`
            }
        ]);
        console.log('✅ Multi-agent comment posted\n');

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 5: Error message
        console.log('5️⃣ Testing error message...');
        await client.postError(
            testIssueNumber,
            new Error('This is a test error for demonstration'),
            'Testing error attribution',
            'AUTOMATION'
        );
        console.log('✅ Error message posted\n');

        // Test 6: Get AI comments
        console.log('6️⃣ Retrieving AI comments...');
        const aiComments = await client.getAIComments(testIssueNumber);
        console.log(`Found ${aiComments.length} AI-generated comments`);
        
        const agentCounts = {};
        aiComments.forEach(comment => {
            const agent = comment.agentType || 'Unknown';
            agentCounts[agent] = (agentCounts[agent] || 0) + 1;
        });
        
        console.log('\nAI Comment Breakdown:');
        Object.entries(agentCounts).forEach(([agent, count]) => {
            console.log(`  ${agent}: ${count} comments`);
        });

        console.log('\n✅ All tests completed successfully!');
        console.log(`\nView the results at: https://github.com/${config.github.owner}/${config.github.repo}/issues/${testIssueNumber}`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testAIAttribution().catch(console.error);
}

module.exports = testAIAttribution;
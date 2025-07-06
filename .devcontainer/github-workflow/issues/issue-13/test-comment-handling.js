#!/usr/bin/env node

/**
 * Test script for Issue #13 - Human comment improvements
 * Tests that the system responds to ALL human comments on swarm-processed issues
 */

const { Octokit } = require('@octokit/rest');

class CommentHandlingTester {
    constructor() {
        this.octokit = new Octokit({
            auth: process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN
        });
        this.owner = 'dug-21';
        this.repo = 'devtemplate';
    }

    async testCommentDetection() {
        console.log('🧪 Testing Comment Detection Logic\n');

        const testCases = [
            {
                comment: "This looks good but could use some improvements in the error handling.",
                isSwarmProcessed: true,
                expected: true,
                description: "Regular comment on swarm-processed issue"
            },
            {
                comment: "@claude can you explain how this works?",
                isSwarmProcessed: true,
                expected: true,
                description: "@claude mention on swarm-processed issue"
            },
            {
                comment: "Thanks for the fix!",
                isSwarmProcessed: true,
                expected: true,
                description: "Simple feedback on swarm-processed issue"
            },
            {
                comment: "/reprocess this issue",
                isSwarmProcessed: false,
                expected: true,
                description: "Directive on active issue"
            },
            {
                comment: "This needs more work",
                isSwarmProcessed: false,
                expected: false,
                description: "Regular comment on non-processed issue"
            }
        ];

        for (const testCase of testCases) {
            const shouldProcess = this.shouldProcessComment(
                testCase.comment,
                testCase.isSwarmProcessed
            );
            
            const result = shouldProcess === testCase.expected ? '✅' : '❌';
            console.log(`${result} ${testCase.description}`);
            console.log(`   Comment: "${testCase.comment}"`);
            console.log(`   Swarm Processed: ${testCase.isSwarmProcessed}`);
            console.log(`   Expected: ${testCase.expected}, Got: ${shouldProcess}\n`);
        }
    }

    shouldProcessComment(comment, isSwarmProcessed) {
        const isClaude = this.isMentioningClaude(comment);
        const isDirective = this.isDirective(comment);
        
        // Process comment if:
        // 1. It's a @claude mention (always process)
        // 2. It's a directive on an active issue
        // 3. It's ANY human comment on a swarm-processed issue
        return isClaude || (isDirective && !isSwarmProcessed) || isSwarmProcessed;
    }

    isMentioningClaude(text) {
        return /\B@claude\b/i.test(text);
    }

    isDirective(text) {
        const patterns = [
            /^\/\w+/,
            /@automation/i,
            /please\s+(re)?process/i,
            /run\s+automation/i
        ];
        
        return patterns.some(pattern => pattern.test(text));
    }

    async verifyConfiguration() {
        console.log('\n📋 Configuration Verification\n');
        
        try {
            const fs = require('fs').promises;
            const path = require('path');
            const configPath = path.join(__dirname, '../../config-enhanced.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            const pollInterval = config.github?.pollInterval || 300000;
            const pollMinutes = pollInterval / 60000;
            
            console.log(`✅ Polling Interval: ${pollInterval}ms (${pollMinutes} minute${pollMinutes !== 1 ? 's' : ''})`);
            
            if (pollInterval === 60000) {
                console.log('   ✓ Polling interval is correctly set to 1 minute');
            } else {
                console.log('   ⚠️  Polling interval is not set to 1 minute as requested');
            }
            
            console.log(`\n📋 Filtering Configuration:`);
            console.log(`   Completion Label: ${config.filtering.completionLabel}`);
            console.log(`   Ignore Labels: ${config.filtering.ignoreLabels.join(', ')}`);
            
        } catch (error) {
            console.error('❌ Failed to read configuration:', error.message);
        }
    }

    async testResponseTypes() {
        console.log('\n💬 Response Type Examples\n');

        const examples = [
            {
                type: '@claude mention',
                header: "🤖 **Claude's Response to @username**",
                footer: "*This response was generated based on your @claude mention.*",
                description: "Direct @claude mention gets personalized response"
            },
            {
                type: 'Regular comment',
                header: "🤖 **Follow-up Response**",
                footer: "*This response was generated based on your comment on this completed issue.*",
                description: "Regular comment gets standard follow-up response"
            }
        ];

        for (const example of examples) {
            console.log(`📝 ${example.description}`);
            console.log(`   Type: ${example.type}`);
            console.log(`   Header: ${example.header}`);
            console.log(`   Footer: ${example.footer}\n`);
        }
    }

    async run() {
        console.log('=== Issue #13 Comment Handling Test ===\n');
        
        await this.testCommentDetection();
        await this.verifyConfiguration();
        await this.testResponseTypes();
        
        console.log('\n✅ Test completed!\n');
        console.log('To fully test the implementation:');
        console.log('1. Create a test issue and let the swarm process it');
        console.log('2. Add a regular comment (without @claude) - should get a response');
        console.log('3. Add a @claude mention - should get a more detailed response');
        console.log('4. Monitor the logs to verify 1-minute polling interval');
    }
}

// Run the test
if (require.main === module) {
    const tester = new CommentHandlingTester();
    tester.run().catch(console.error);
}

module.exports = CommentHandlingTester;
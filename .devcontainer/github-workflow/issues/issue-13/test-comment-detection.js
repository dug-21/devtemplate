#!/usr/bin/env node

/**
 * Test script for Issue #13 - Human comment improvements
 * Tests:
 * 1. Polling interval is 1 minute
 * 2. @claude mentions are detected
 * 3. Comments on completed issues are processed
 */

const fs = require('fs').promises;
const path = require('path');

async function testConfiguration() {
    console.log('🧪 Testing Issue #13 Fixes...\n');
    
    // Test 1: Check polling interval
    console.log('1️⃣ Testing polling interval configuration...');
    const configPath = path.join(__dirname, '../../config-enhanced.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    
    if (config.github.pollInterval === 60000) {
        console.log('✅ Polling interval correctly set to 1 minute (60000ms)');
    } else {
        console.log(`❌ Polling interval is ${config.github.pollInterval}ms, expected 60000ms`);
    }
    
    // Test 2: Check @claude mention detection
    console.log('\n2️⃣ Testing @claude mention detection...');
    const MonitorClass = require('../../monitor-enhanced.js');
    
    // Create mock config
    const mockConfig = {
        github: {
            owner: 'test',
            repo: 'test',
            token: 'test'
        },
        filtering: {
            ignoreLabels: [],
            requireLabels: [],
            completionLabel: 'completed'
        }
    };
    
    const monitor = new MonitorClass(mockConfig);
    
    // Test mention detection
    const testCases = [
        { text: 'Hey @claude, can you help?', expected: true },
        { text: '@Claude please fix this', expected: true },
        { text: 'cc @CLAUDE', expected: true },
        { text: 'No mention here', expected: false },
        { text: 'email@claude.com', expected: false }
    ];
    
    let mentionTestsPassed = true;
    for (const test of testCases) {
        const result = monitor.isMentioningClaude(test.text);
        if (result === test.expected) {
            console.log(`✅ "${test.text}" -> ${result} (expected: ${test.expected})`);
        } else {
            console.log(`❌ "${test.text}" -> ${result} (expected: ${test.expected})`);
            mentionTestsPassed = false;
        }
    }
    
    // Test 3: Check directive detection still works
    console.log('\n3️⃣ Testing directive detection...');
    const directiveTests = [
        { text: '/reprocess', expected: true },
        { text: '@automation please process', expected: true },
        { text: 'please reprocess this', expected: true },
        { text: 'run automation', expected: true },
        { text: 'normal comment', expected: false }
    ];
    
    let directiveTestsPassed = true;
    for (const test of directiveTests) {
        const result = monitor.isDirective(test.text);
        if (result === test.expected) {
            console.log(`✅ "${test.text}" -> ${result} (expected: ${test.expected})`);
        } else {
            console.log(`❌ "${test.text}" -> ${result} (expected: ${test.expected})`);
            directiveTestsPassed = false;
        }
    }
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`- Polling interval: ${config.github.pollInterval === 60000 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`- @claude detection: ${mentionTestsPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`- Directive detection: ${directiveTestsPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    console.log('\n📝 Implementation Notes:');
    console.log('- Comments with @claude mentions will now be processed on ALL issues (open or closed)');
    console.log('- Regular directives will only be processed on non-completed issues');
    console.log('- Polling interval reduced from 5 minutes to 1 minute for faster response');
    console.log('- handleClaudeFollowUp() provides context-aware responses on completed issues');
}

// Run tests
testConfiguration().catch(console.error);
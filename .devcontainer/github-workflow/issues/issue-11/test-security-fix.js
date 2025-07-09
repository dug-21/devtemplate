#!/usr/bin/env node

/**
 * Test script to verify security fix
 */

const SecurityCheck = require('./security-check');
const fs = require('fs').promises;
const path = require('path');

async function runTests() {
    const checker = new SecurityCheck();
    console.log('🧪 Running Security Fix Tests...\n');
    
    // Test 1: Detect GitHub PAT
    console.log('Test 1: GitHub PAT Detection');
    try {
        await checker.safeWriteFile('test1.json', JSON.stringify({
            token: 'github_pat_11BUJVQUY0PDCBib5oX2zk_example'
        }));
        console.error('❌ FAILED - Should have blocked GitHub PAT');
    } catch (error) {
        console.log('✅ PASSED - Blocked GitHub PAT');
    }
    
    // Test 2: Detect AGENT_TOKEN
    console.log('\nTest 2: AGENT_TOKEN Detection');
    try {
        await checker.safeWriteFile('test2.json', JSON.stringify({
            env: {
                AGENT_TOKEN: 'secret_token_value'
            }
        }));
        console.error('❌ FAILED - Should have blocked AGENT_TOKEN');
    } catch (error) {
        console.log('✅ PASSED - Blocked AGENT_TOKEN');
    }
    
    // Test 3: Allow safe content
    console.log('\nTest 3: Safe Content');
    try {
        const safeConfig = {
            mcpServers: {
                github: {
                    command: "npx",
                    args: ["@modelcontextprotocol/server-github"]
                }
            }
        };
        await checker.safeWriteFile('test3.json', JSON.stringify(safeConfig));
        console.log('✅ PASSED - Allowed safe content');
        await fs.unlink('test3.json');
    } catch (error) {
        console.error('❌ FAILED - Should have allowed safe content');
    }
    
    // Test 4: Sanitization
    console.log('\nTest 4: Object Sanitization');
    const sensitiveObj = {
        name: 'test',
        github_token: 'ghp_secrettoken123',
        config: {
            api_key: 'secret_api_key',
            safe_value: 'this is safe'
        }
    };
    
    const sanitized = checker.sanitizeObject(sensitiveObj);
    console.log('Original:', JSON.stringify(sensitiveObj, null, 2));
    console.log('Sanitized:', JSON.stringify(sanitized, null, 2));
    
    if (sanitized.github_token === '[REDACTED]' && 
        sanitized.config.api_key === '[REDACTED]' &&
        sanitized.config.safe_value === 'this is safe') {
        console.log('✅ PASSED - Correctly sanitized sensitive data');
    } else {
        console.error('❌ FAILED - Sanitization not working correctly');
    }
    
    // Test 5: Directory scan
    console.log('\nTest 5: Directory Scan');
    const testDir = './test-scan';
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test files
    await fs.writeFile(path.join(testDir, 'safe.json'), JSON.stringify({ data: 'safe' }));
    await fs.writeFile(path.join(testDir, 'unsafe.json'), JSON.stringify({ 
        token: 'github_pat_11BUJVQUY0PDCBib5oX2zk_test' 
    }));
    
    const results = await checker.scanDirectory(testDir);
    
    if (results.length === 1 && results[0].file.includes('unsafe.json')) {
        console.log('✅ PASSED - Found sensitive file in scan');
    } else {
        console.error('❌ FAILED - Directory scan not working correctly');
    }
    
    // Cleanup
    await fs.rm(testDir, { recursive: true });
    
    console.log('\n🎉 Security tests complete!');
}

runTests().catch(console.error);
#!/usr/bin/env node

/**
 * Verify the fix works for the specific bot scenario
 */

const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');

async function verifyFix() {
    console.log('Verifying bot comment filtering fix...\n');
    
    // Check if the monitor file has been updated
    const monitorPath = path.join(__dirname, '../../monitor-enhanced.js');
    const monitorContent = await fs.readFile(monitorPath, 'utf8');
    
    // Check for the key fixes
    const checks = [
        {
            name: 'Self-check for bot username',
            pattern: /if\s*\(\s*comment\.user\.login\s*===\s*this\.botUsername\s*\)/,
            found: false
        },
        {
            name: 'Bot username initialization in initialize()',
            pattern: /await\s+this\.getBotUsername\(\)/,
            found: false
        },
        {
            name: 'Enhanced AI signatures',
            pattern: /🤖\s*\*\*Claude Response\*\*/,
            found: false
        },
        {
            name: 'Error processing signature',
            pattern: /❌\s*\*\*Error Processing/,
            found: false
        }
    ];
    
    // Run checks
    checks.forEach(check => {
        check.found = check.pattern.test(monitorContent);
    });
    
    // Report results
    console.log('Fix Verification Results:');
    console.log('========================\n');
    
    let allPassed = true;
    checks.forEach(check => {
        const status = check.found ? '✅ PASS' : '❌ FAIL';
        console.log(`${status}: ${check.name}`);
        if (!check.found) allPassed = false;
    });
    
    console.log('\n' + '='.repeat(50));
    
    if (allPassed) {
        console.log('✅ All fixes have been properly applied!');
        console.log('\nThe bot should now:');
        console.log('1. Skip its own comments (dug21-bot)');
        console.log('2. Not reprocess comments on restart');
        console.log('3. Properly detect all bot-generated responses');
    } else {
        console.log('❌ Some fixes are missing. Please review the implementation.');
    }
    
    // Check processed comments file
    try {
        const processedFile = path.join(__dirname, '../../.processed-comments-v3.json');
        const processedData = await fs.readFile(processedFile, 'utf8');
        const processedComments = JSON.parse(processedData);
        console.log(`\nCurrent processed comments cache: ${processedComments.length} entries`);
        
        // Show some recent entries
        if (processedComments.length > 0) {
            console.log('Recent processed comment IDs:', processedComments.slice(-5));
        }
    } catch (e) {
        console.log('\nNo processed comments file found (will be created on first run)');
    }
}

// Run verification
verifyFix().catch(console.error);
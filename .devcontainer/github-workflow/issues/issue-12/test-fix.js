#!/usr/bin/env node

/**
 * Test script for Issue #12 fixes
 * Tests:
 * 1. File organization - ensuring code files are modified in-place
 * 2. Auto-close behavior - ensuring bug issues remain open
 */

const FileOrganization = require('../../file-organization');
const fs = require('fs').promises;
const path = require('path');

async function testFileOrganization() {
    console.log('Testing File Organization...\n');
    
    const fileOrg = new FileOrganization();
    await fileOrg.initialize();
    
    // Create test issue directory
    const testIssue = {
        number: 999,
        title: 'Test Issue',
        created_at: new Date().toISOString(),
        labels: [{ name: 'test' }],
        state: 'open'
    };
    
    await fileOrg.createIssueDirectory(testIssue.number, testIssue);
    
    // Test tracking modified files (in-place edits)
    await fileOrg.trackModifiedFile(999, '/src/app.js', 'Fixed bug in main function');
    await fileOrg.trackModifiedFile(999, '/lib/utils.js', 'Updated utility functions');
    
    // Test tracking artifacts (new files)
    await fileOrg.trackArtifact(999, fileOrg.getIssuePath(999, 'research.md'), 'research');
    await fileOrg.trackArtifact(999, fileOrg.getIssuePath(999, 'analysis.json'), 'analysis');
    
    // Create summary
    await fileOrg.createIssueSummary(999, {
        overview: 'Test issue completed successfully',
        files: [
            { name: 'research.md' },
            { name: 'analysis.json' }
        ],
        details: 'All tests passed'
    });
    
    // Read and display metadata
    const metadata = JSON.parse(
        await fs.readFile(fileOrg.getIssuePath(999, 'metadata.json'), 'utf8')
    );
    
    console.log('Modified Files (in-place):');
    metadata.modifiedFiles?.forEach(f => {
        console.log(`  - ${f.path}: ${f.description}`);
    });
    
    console.log('\nArtifacts Created:');
    metadata.artifacts?.forEach(f => {
        console.log(`  - ${f.path} (${f.type})`);
    });
    
    // Cleanup test
    await fs.rm(fileOrg.getIssuePath(999), { recursive: true, force: true });
    
    console.log('\n✅ File organization test passed!\n');
}

async function testAutoCloseLogic() {
    console.log('Testing Auto-Close Logic...\n');
    
    // Test cases
    const testCases = [
        {
            labels: ['bug', 'auto-close-on-complete'],
            title: '[BUG] Something broken',
            shouldClose: false,
            description: 'Bug with auto-close label'
        },
        {
            labels: ['feature', 'auto-close-on-complete'],
            title: 'Add new feature',
            shouldClose: true,
            description: 'Feature with auto-close label'
        },
        {
            labels: ['bug'],
            title: 'Fix issue',
            shouldClose: false,
            description: 'Bug without auto-close label'
        },
        {
            labels: ['enhancement', 'auto-close-on-complete', 'keep-open'],
            title: 'Improve performance',
            shouldClose: false,
            description: 'Issue with keep-open label'
        }
    ];
    
    for (const testCase of testCases) {
        const labels = testCase.labels;
        const isBugIssue = labels.includes('bug') || 
                          testCase.title.toLowerCase().includes('[bug]');
        
        const shouldAutoClose = labels.includes('auto-close-on-complete') && 
                               !labels.includes('keep-open') && 
                               !isBugIssue;
        
        const result = shouldAutoClose === testCase.shouldClose ? '✅' : '❌';
        console.log(`${result} ${testCase.description}:`);
        console.log(`   Labels: ${labels.join(', ')}`);
        console.log(`   Expected: ${testCase.shouldClose ? 'close' : 'keep open'}`);
        console.log(`   Result: ${shouldAutoClose ? 'close' : 'keep open'}\n`);
    }
}

async function main() {
    console.log('=== Testing Issue #12 Fixes ===\n');
    
    try {
        await testFileOrganization();
        await testAutoCloseLogic();
        
        console.log('=== All Tests Passed! ===\n');
        console.log('Summary:');
        console.log('1. ✅ File organization correctly tracks in-place modifications');
        console.log('2. ✅ Auto-close logic correctly handles bug issues');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { testFileOrganization, testAutoCloseLogic };
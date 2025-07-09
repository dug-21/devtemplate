#!/usr/bin/env node

/**
 * Test script for file organization system
 */

const FileOrganization = require('./file-organization');
const fs = require('fs').promises;
const path = require('path');

async function runTests() {
    console.log('🧪 Testing File Organization System...\n');
    
    const fileOrg = new FileOrganization();
    await fileOrg.initialize();
    
    const testIssueNumber = 9999;
    const results = [];
    
    try {
        // Test 1: Create issue directory
        console.log('Test 1: Creating issue directory...');
        const issueDir = await fileOrg.createIssueDirectory(testIssueNumber, {
            number: testIssueNumber,
            title: 'Test Issue',
            created_at: new Date().toISOString(),
            labels: [{ name: 'test' }],
            state: 'open'
        });
        results.push('✅ Issue directory created');
        
        // Test 2: Create temp file
        console.log('Test 2: Creating temporary file...');
        const tempPath = fileOrg.getTempPath(testIssueNumber, 'test', 'txt');
        await fs.writeFile(tempPath, 'Test content');
        results.push('✅ Temporary file created');
        
        // Test 3: Move to issue directory
        console.log('Test 3: Moving file to issue directory...');
        const movedPath = await fileOrg.moveToIssueDir(tempPath, testIssueNumber, 'test-file.txt');
        results.push('✅ File moved to issue directory');
        
        // Test 4: Create summary
        console.log('Test 4: Creating issue summary...');
        await fileOrg.createIssueSummary(testIssueNumber, {
            overview: 'This is a test issue',
            files: [{ name: 'test-file.txt' }],
            details: 'Testing the file organization system'
        });
        results.push('✅ Summary created');
        
        // Test 5: Verify structure
        console.log('Test 5: Verifying directory structure...');
        const files = await fs.readdir(issueDir);
        const expectedFiles = ['metadata.json', 'test-file.txt', 'SUMMARY.md'];
        const allPresent = expectedFiles.every(f => files.includes(f));
        if (allPresent) {
            results.push('✅ All expected files present');
        } else {
            results.push('❌ Missing expected files');
        }
        
        // Test 6: Archive issue
        console.log('Test 6: Archiving issue...');
        const archivePath = await fileOrg.archiveIssue(testIssueNumber);
        if (archivePath) {
            results.push('✅ Issue archived');
            // Clean up archive
            await fs.rm(archivePath, { recursive: true });
        } else {
            results.push('❌ Archive failed');
        }
        
        // Test 7: Cleanup temp files
        console.log('Test 7: Testing temp cleanup...');
        // Create an old temp file
        const oldTempPath = path.join(fileOrg.tempDir, 'old-temp.txt');
        await fs.writeFile(oldTempPath, 'Old content');
        // Backdate it
        const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
        await fs.utimes(oldTempPath, oldTime, oldTime);
        
        await fileOrg.cleanupTemp(24);
        
        try {
            await fs.access(oldTempPath);
            results.push('❌ Old temp file not cleaned');
        } catch {
            results.push('✅ Old temp files cleaned');
        }
        
    } catch (error) {
        console.error('Test error:', error);
        results.push(`❌ Error: ${error.message}`);
    }
    
    // Summary
    console.log('\n📊 Test Results:');
    results.forEach(r => console.log(`   ${r}`));
    
    const passed = results.filter(r => r.startsWith('✅')).length;
    const total = results.length;
    console.log(`\n✅ Passed: ${passed}/${total}`);
    
    if (passed === total) {
        console.log('🎉 All tests passed!');
    } else {
        console.log('❌ Some tests failed');
        process.exit(1);
    }
}

// Run tests
runTests().catch(console.error);
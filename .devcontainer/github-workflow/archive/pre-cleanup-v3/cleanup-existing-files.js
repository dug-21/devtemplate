#!/usr/bin/env node

/**
 * Cleanup Utility for Existing Files
 * Organizes orphaned files into appropriate directories
 */

const fs = require('fs').promises;
const path = require('path');
const FileOrganization = require('./file-organization');

class FileCleanup {
    constructor() {
        this.baseDir = __dirname;
        this.fileOrg = new FileOrganization(this.baseDir);
        this.orphanedDir = path.join(this.baseDir, 'orphaned-files');
    }

    async run() {
        console.log('🧹 Starting file cleanup...\n');
        
        await this.fileOrg.initialize();
        await this.ensureDir(this.orphanedDir);
        
        const stats = {
            promptFiles: 0,
            mcpConfigs: 0,
            reports: 0,
            moved: 0,
            errors: 0
        };

        try {
            // Find and organize prompt files
            const promptFiles = await this.findFiles(/^prompt-(\d+)-\d+\.txt$/);
            for (const file of promptFiles) {
                const match = file.match(/^prompt-(\d+)-\d+\.txt$/);
                if (match) {
                    const issueNumber = match[1];
                    await this.organizeFile(file, issueNumber, 'prompt', stats);
                    stats.promptFiles++;
                }
            }

            // Find and organize MCP config files
            const mcpFiles = await this.findFiles(/^mcp-config-(\d+)\.json$/);
            for (const file of mcpFiles) {
                const match = file.match(/^mcp-config-(\d+)\.json$/);
                if (match) {
                    const issueNumber = match[1];
                    await this.organizeFile(file, issueNumber, 'config', stats);
                    stats.mcpConfigs++;
                }
            }

            // Find report files
            const reportFiles = await this.findFiles(/report|summary/i);
            for (const file of reportFiles) {
                if (file.endsWith('.md')) {
                    await this.moveToOrphaned(file, stats);
                    stats.reports++;
                }
            }

            // Create cleanup report
            await this.createCleanupReport(stats);
            
            console.log('\n✅ Cleanup complete!');
            console.log(`📊 Summary:`);
            console.log(`   - Prompt files: ${stats.promptFiles}`);
            console.log(`   - MCP configs: ${stats.mcpConfigs}`);
            console.log(`   - Reports: ${stats.reports}`);
            console.log(`   - Total moved: ${stats.moved}`);
            console.log(`   - Errors: ${stats.errors}`);
            
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }

    async findFiles(pattern) {
        const files = await fs.readdir(this.baseDir);
        return files.filter(file => {
            if (typeof pattern === 'string') {
                return file.includes(pattern);
            }
            return pattern.test(file);
        });
    }

    async organizeFile(filename, issueNumber, type, stats) {
        const sourcePath = path.join(this.baseDir, filename);
        
        try {
            // Check if issue directory exists
            const issueDir = this.fileOrg.getIssuePath(issueNumber);
            
            try {
                await fs.access(issueDir);
                // Directory exists, move file there
                const timestamp = filename.match(/-(\d+)\./)?.[1] || Date.now();
                const newName = `${type}-${timestamp}${path.extname(filename)}`;
                const targetPath = path.join(issueDir, newName);
                
                await fs.rename(sourcePath, targetPath);
                console.log(`✅ Moved ${filename} → issue-${issueNumber}/${newName}`);
                stats.moved++;
                
            } catch {
                // Issue directory doesn't exist, create it
                await this.fileOrg.createIssueDirectory(issueNumber, {
                    number: issueNumber,
                    title: `Issue #${issueNumber} (recovered)`,
                    created_at: new Date().toISOString(),
                    labels: [],
                    state: 'unknown'
                });
                
                // Try again
                await this.organizeFile(filename, issueNumber, type, stats);
            }
            
        } catch (error) {
            console.error(`❌ Failed to organize ${filename}: ${error.message}`);
            stats.errors++;
            // Move to orphaned directory as fallback
            await this.moveToOrphaned(filename, stats);
        }
    }

    async moveToOrphaned(filename, stats) {
        const sourcePath = path.join(this.baseDir, filename);
        const targetPath = path.join(this.orphanedDir, filename);
        
        try {
            await fs.rename(sourcePath, targetPath);
            console.log(`📦 Moved ${filename} → orphaned-files/`);
            stats.moved++;
        } catch (error) {
            console.error(`❌ Failed to move ${filename}: ${error.message}`);
            stats.errors++;
        }
    }

    async ensureDir(dirPath) {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    async createCleanupReport(stats) {
        const report = `# File Cleanup Report

**Date:** ${new Date().toISOString()}

## Summary
- **Prompt Files:** ${stats.promptFiles}
- **MCP Configs:** ${stats.mcpConfigs}
- **Reports:** ${stats.reports}
- **Total Moved:** ${stats.moved}
- **Errors:** ${stats.errors}

## Actions Taken
1. Created organized directory structure under \`issues/\`
2. Moved files to their respective issue directories
3. Orphaned files moved to \`orphaned-files/\`

## Directory Structure
\`\`\`
github-workflow/
├── issues/
│   ├── issue-5/
│   ├── issue-6/
│   ├── issue-8/
│   └── ...
├── orphaned-files/
├── archive/
└── .temp/
\`\`\`

## Next Steps
- Review orphaned files and determine their proper location
- Consider archiving old completed issues
- Monitor new file creation to ensure proper organization

---
*Generated by cleanup-existing-files.js*
`;

        await fs.writeFile(path.join(this.baseDir, 'CLEANUP-REPORT-V2.md'), report);
        console.log('\n📄 Cleanup report saved to CLEANUP-REPORT-V2.md');
    }
}

// Run if executed directly
if (require.main === module) {
    const cleanup = new FileCleanup();
    cleanup.run().catch(console.error);
}

module.exports = FileCleanup;
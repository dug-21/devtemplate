#!/usr/bin/env node

/**
 * Enhanced File Organization V3
 * Properly organizes files based on their type and purpose
 */

const fs = require('fs').promises;
const path = require('path');

class FileOrganizationV3 {
    constructor() {
        this.projectRoot = '/workspaces/devtemplate';
        this.workflowDir = path.join(this.projectRoot, '.devcontainer/github-workflow');
        
        // Define file type mappings
        this.fileMappings = {
            // Documentation stays in issue directory
            documentation: {
                patterns: [/\.md$/i, /SUMMARY/i, /PLAN/i, /REPORT/i, /ANALYSIS/i],
                keepInIssueDir: true
            },
            // Logs and metadata stay in issue directory
            metadata: {
                patterns: [/\.log$/i, /metadata\.json$/i, /\.txt$/i],
                keepInIssueDir: true
            },
            // JavaScript files go to workflow directory
            javascript: {
                patterns: [/\.js$/i],
                targetDir: this.workflowDir,
                excludePatterns: [/test.*\.js$/i] // Tests have their own rule
            },
            // Test files go to tests directory
            tests: {
                patterns: [/test.*\.js$/i, /.*\.test\.js$/i],
                targetDir: path.join(this.workflowDir, 'tests')
            },
            // Shell scripts go to workflow directory
            scripts: {
                patterns: [/\.sh$/i, /\.bat$/i],
                targetDir: this.workflowDir
            },
            // Configuration files go to workflow directory
            config: {
                patterns: [/\.json$/i, /\.yml$/i, /\.yaml$/i],
                targetDir: this.workflowDir,
                excludePatterns: [/metadata\.json$/i]
            }
        };
    }

    async organizeIssueFiles(issueNumber) {
        const issueDir = path.join(this.workflowDir, 'issues', `issue-${issueNumber}`);
        const files = await this.scanDirectory(issueDir);
        const moveOperations = [];

        for (const file of files) {
            const operation = await this.determineFileOperation(file, issueDir);
            if (operation) {
                moveOperations.push(operation);
            }
        }

        // Create file mapping for reference
        const fileMapping = {
            issue: issueNumber,
            timestamp: new Date().toISOString(),
            operations: moveOperations
        };

        // Save mapping before moving files
        await fs.writeFile(
            path.join(issueDir, 'file-mapping.json'),
            JSON.stringify(fileMapping, null, 2)
        );

        // Execute move operations
        for (const op of moveOperations) {
            if (op.action === 'move') {
                await this.moveFile(op.source, op.target);
                console.log(`Moved: ${path.basename(op.source)} -> ${op.target}`);
            } else {
                console.log(`Kept in issue dir: ${path.basename(op.source)}`);
            }
        }

        return fileMapping;
    }

    async determineFileOperation(filePath, issueDir) {
        const fileName = path.basename(filePath);
        const relativePath = path.relative(issueDir, filePath);

        // Skip if file is in a subdirectory
        if (relativePath.includes(path.sep)) {
            return null;
        }

        for (const [type, config] of Object.entries(this.fileMappings)) {
            // Check if file matches any pattern
            const matches = config.patterns.some(pattern => pattern.test(fileName));
            
            // Check if file is excluded
            const excluded = config.excludePatterns?.some(pattern => pattern.test(fileName));

            if (matches && !excluded) {
                if (config.keepInIssueDir) {
                    return {
                        action: 'keep',
                        source: filePath,
                        type: type,
                        reason: 'Documentation/metadata should stay in issue directory'
                    };
                } else {
                    const targetDir = config.targetDir;
                    const targetPath = path.join(targetDir, fileName);
                    
                    // Check if file already exists
                    const exists = await this.fileExists(targetPath);
                    if (exists) {
                        // Version the file
                        const versionedName = await this.getVersionedFileName(targetPath);
                        return {
                            action: 'move',
                            source: filePath,
                            target: versionedName,
                            type: type,
                            versioned: true
                        };
                    }
                    
                    return {
                        action: 'move',
                        source: filePath,
                        target: targetPath,
                        type: type
                    };
                }
            }
        }

        // Default: keep in issue directory if no mapping found
        return {
            action: 'keep',
            source: filePath,
            type: 'unknown',
            reason: 'No mapping rule found'
        };
    }

    async moveFile(source, target) {
        // Ensure target directory exists
        await fs.mkdir(path.dirname(target), { recursive: true });
        
        // Copy file to new location
        await fs.copyFile(source, target);
        
        // Remove original
        await fs.unlink(source);
    }

    async getVersionedFileName(filePath) {
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const baseName = path.basename(filePath, ext);
        
        let version = 1;
        let versionedPath;
        
        do {
            versionedPath = path.join(dir, `${baseName}-v${version}${ext}`);
            version++;
        } while (await this.fileExists(versionedPath));
        
        return versionedPath;
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async scanDirectory(dir) {
        const files = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isFile()) {
                files.push(fullPath);
            }
        }
        
        return files;
    }

    async createTestDirectory() {
        const testDir = path.join(this.workflowDir, 'tests');
        await fs.mkdir(testDir, { recursive: true });
    }
}

module.exports = FileOrganizationV3;

// CLI execution
if (require.main === module) {
    const org = new FileOrganizationV3();
    const issueNumber = process.argv[2];
    
    if (!issueNumber) {
        console.error('Usage: node file-organization-v3.js <issue-number>');
        process.exit(1);
    }
    
    org.organizeIssueFiles(issueNumber)
        .then(result => {
            console.log('\nFile organization complete!');
            console.log(`Processed ${result.operations.length} files`);
        })
        .catch(error => {
            console.error('Error organizing files:', error);
            process.exit(1);
        });
}
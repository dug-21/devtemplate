#!/usr/bin/env node

/**
 * File Organization Module for GitHub Workflow
 * Manages structured storage of issue-related artifacts
 */

const fs = require('fs').promises;
const path = require('path');

class FileOrganization {
    constructor(baseDir = __dirname) {
        this.baseDir = baseDir;
        this.issuesDir = path.join(baseDir, 'issues');
        this.archiveDir = path.join(baseDir, 'archive');
        this.tempDir = path.join(baseDir, '.temp');
    }

    async initialize() {
        // Create directory structure
        await this.ensureDir(this.issuesDir);
        await this.ensureDir(this.archiveDir);
        await this.ensureDir(this.tempDir);
    }

    async ensureDir(dirPath) {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    /**
     * Get organized path for issue-related files
     */
    getIssuePath(issueNumber, filename = '') {
        const issueDir = path.join(this.issuesDir, `issue-${issueNumber}`);
        return filename ? path.join(issueDir, filename) : issueDir;
    }

    /**
     * Create issue directory with metadata
     */
    async createIssueDirectory(issueNumber, issueData) {
        const issueDir = this.getIssuePath(issueNumber);
        await this.ensureDir(issueDir);

        // Create metadata file
        const metadata = {
            issueNumber,
            title: issueData.title,
            createdAt: issueData.created_at,
            processedAt: new Date().toISOString(),
            labels: issueData.labels?.map(l => l.name) || [],
            state: issueData.state,
            files: [],
            modifiedFiles: [], // Track files modified in-place
            artifacts: [] // Track new artifacts created
        };

        await fs.writeFile(
            path.join(issueDir, 'metadata.json'),
            JSON.stringify(metadata, null, 2)
        );

        return issueDir;
    }

    /**
     * Track a file in issue metadata
     */
    async trackFile(issueNumber, filePath, fileType) {
        const metadataPath = this.getIssuePath(issueNumber, 'metadata.json');
        
        try {
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            metadata.files.push({
                path: filePath,
                type: fileType,
                createdAt: new Date().toISOString()
            });
            await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        } catch (error) {
            console.error(`Failed to track file: ${error.message}`);
        }
    }

    /**
     * Track a modified file (edited in-place)
     */
    async trackModifiedFile(issueNumber, filePath, changeDescription) {
        const metadataPath = this.getIssuePath(issueNumber, 'metadata.json');
        
        try {
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            if (!metadata.modifiedFiles) {
                metadata.modifiedFiles = [];
            }
            metadata.modifiedFiles.push({
                path: filePath,
                description: changeDescription,
                modifiedAt: new Date().toISOString()
            });
            await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        } catch (error) {
            console.error(`Failed to track modified file: ${error.message}`);
        }
    }

    /**
     * Track an artifact (new file created for the issue)
     */
    async trackArtifact(issueNumber, artifactPath, artifactType) {
        const metadataPath = this.getIssuePath(issueNumber, 'metadata.json');
        
        try {
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            if (!metadata.artifacts) {
                metadata.artifacts = [];
            }
            metadata.artifacts.push({
                path: artifactPath,
                type: artifactType,
                createdAt: new Date().toISOString()
            });
            await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        } catch (error) {
            console.error(`Failed to track artifact: ${error.message}`);
        }
    }

    /**
     * Get temporary file path with automatic tracking
     */
    getTempPath(issueNumber, prefix = 'temp', extension = 'txt') {
        const filename = `${prefix}-${issueNumber}-${Date.now()}.${extension}`;
        return path.join(this.tempDir, filename);
    }

    /**
     * Move file to issue directory
     */
    async moveToIssueDir(sourcePath, issueNumber, targetName) {
        const targetPath = this.getIssuePath(issueNumber, targetName);
        await this.ensureDir(path.dirname(targetPath));
        
        try {
            await fs.rename(sourcePath, targetPath);
        } catch {
            // If rename fails (cross-device), copy and delete
            await fs.copyFile(sourcePath, targetPath);
            await fs.unlink(sourcePath);
        }

        await this.trackFile(issueNumber, targetPath, path.extname(targetName));
        return targetPath;
    }

    /**
     * Create issue summary with links
     */
    async createIssueSummary(issueNumber, summary) {
        const summaryPath = this.getIssuePath(issueNumber, 'SUMMARY.md');
        const metadataPath = this.getIssuePath(issueNumber, 'metadata.json');
        
        // Load metadata to get modified files and artifacts
        let metadata = { modifiedFiles: [], artifacts: [] };
        try {
            metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
        } catch {}
        
        const content = `# Issue #${issueNumber} Summary

**Generated:** ${new Date().toISOString()}

## Overview
${summary.overview || 'No overview provided'}

## Files Modified In-Place
${metadata.modifiedFiles?.length > 0 ? 
  metadata.modifiedFiles.map(f => `- \`${f.path}\` - ${f.description || 'Modified'}`).join('\n') : 
  'No existing files were modified'}

## Artifacts Created
${summary.files?.map(f => `- [${f.name}](./${f.name})`).join('\n') || 'No artifacts created'}

## Execution Details
${summary.details || 'No details provided'}

## Directory Structure
- **Modified Files**: Changes were made to existing project files in their original locations
- **Artifacts**: New files created for this issue are stored in this directory

---
*This summary was automatically generated by the GitHub Workflow system*
`;

        await fs.writeFile(summaryPath, content);
        await this.trackFile(issueNumber, summaryPath, 'summary');
        return summaryPath;
    }

    /**
     * Archive completed issue
     */
    async archiveIssue(issueNumber) {
        const sourceDir = this.getIssuePath(issueNumber);
        const archiveDir = path.join(this.archiveDir, `issue-${issueNumber}-${Date.now()}`);
        
        try {
            await fs.rename(sourceDir, archiveDir);
            return archiveDir;
        } catch (error) {
            console.error(`Failed to archive issue ${issueNumber}: ${error.message}`);
            return null;
        }
    }

    /**
     * Clean up temporary files
     */
    async cleanupTemp(olderThanHours = 24) {
        const files = await fs.readdir(this.tempDir);
        const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);

        for (const file of files) {
            const filePath = path.join(this.tempDir, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtimeMs < cutoffTime) {
                await fs.unlink(filePath).catch(() => {});
            }
        }
    }

    /**
     * Get issue report URL
     */
    getIssueReportUrl(issueNumber, baseUrl) {
        const relativePath = path.relative(this.baseDir, this.getIssuePath(issueNumber));
        return `${baseUrl}/tree/main/.devcontainer/github-workflow/${relativePath}`;
    }
}

module.exports = FileOrganization;
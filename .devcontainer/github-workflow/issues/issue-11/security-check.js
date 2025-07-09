#!/usr/bin/env node

/**
 * Security Check Module
 * Prevents sensitive data from being written to files
 */

const fs = require('fs').promises;
const path = require('path');

class SecurityCheck {
    constructor() {
        // Patterns that indicate sensitive data
        this.sensitivePatterns = [
            /github_pat_[A-Za-z0-9_]+/gi,  // GitHub PAT
            /ghp_[A-Za-z0-9_]+/gi,         // GitHub token
            /ghs_[A-Za-z0-9_]+/gi,         // GitHub secret
            /AGENT_TOKEN.*[:=].*['"]/gi,   // AGENT_TOKEN assignments
            /GITHUB_TOKEN.*[:=].*['"]/gi,  // GITHUB_TOKEN assignments
            /api[_-]?key.*[:=].*['"]/gi,   // API keys
            /secret.*[:=].*['"]/gi,        // Secrets
            /password.*[:=].*['"]/gi,      // Passwords
            /bearer\s+[A-Za-z0-9_\-]+/gi,  // Bearer tokens
        ];
    }

    /**
     * Check if content contains sensitive data
     */
    containsSensitiveData(content) {
        if (typeof content !== 'string') {
            content = JSON.stringify(content);
        }

        for (const pattern of this.sensitivePatterns) {
            if (pattern.test(content)) {
                return {
                    isSensitive: true,
                    pattern: pattern.toString(),
                    matches: content.match(pattern)
                };
            }
        }

        return { isSensitive: false };
    }

    /**
     * Safe write file - checks for sensitive data before writing
     */
    async safeWriteFile(filePath, content) {
        const check = this.containsSensitiveData(content);
        
        if (check.isSensitive) {
            throw new Error(
                `SECURITY VIOLATION: Attempted to write sensitive data to ${filePath}\n` +
                `Matched pattern: ${check.pattern}\n` +
                `Found: ${check.matches.join(', ')}`
            );
        }

        await fs.writeFile(filePath, content);
    }

    /**
     * Scan directory for files containing sensitive data
     */
    async scanDirectory(dirPath, extensions = ['.json', '.txt', '.log', '.md']) {
        const results = [];
        
        try {
            const files = await this.getFilesRecursive(dirPath);
            
            for (const file of files) {
                const ext = path.extname(file).toLowerCase();
                if (!extensions.includes(ext)) continue;
                
                try {
                    const content = await fs.readFile(file, 'utf8');
                    const check = this.containsSensitiveData(content);
                    
                    if (check.isSensitive) {
                        results.push({
                            file,
                            pattern: check.pattern,
                            matches: check.matches
                        });
                    }
                } catch (error) {
                    // Skip files we can't read
                }
            }
        } catch (error) {
            console.error(`Error scanning directory: ${error.message}`);
        }
        
        return results;
    }

    /**
     * Get all files recursively
     */
    async getFilesRecursive(dirPath, files = []) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    await this.getFilesRecursive(fullPath, files);
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Skip directories we can't read
        }
        
        return files;
    }

    /**
     * Remove sensitive data from object
     */
    sanitizeObject(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        const sanitized = Array.isArray(obj) ? [] : {};
        
        for (const [key, value] of Object.entries(obj)) {
            // Check if key indicates sensitive data
            if (/token|secret|password|key|auth|credential/i.test(key)) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object') {
                sanitized[key] = this.sanitizeObject(value);
            } else if (typeof value === 'string') {
                const check = this.containsSensitiveData(value);
                sanitized[key] = check.isSensitive ? '[REDACTED]' : value;
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }
}

// Export for use in other modules
module.exports = SecurityCheck;

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const checker = new SecurityCheck();
    
    if (args[0] === 'scan') {
        const dirPath = args[1] || '.';
        checker.scanDirectory(dirPath).then(results => {
            if (results.length > 0) {
                console.error('⚠️  SECURITY VIOLATIONS FOUND:');
                results.forEach(r => {
                    console.error(`\n📄 File: ${r.file}`);
                    console.error(`🔍 Pattern: ${r.pattern}`);
                    console.error(`💥 Matches: ${r.matches.join(', ')}`);
                });
                process.exit(1);
            } else {
                console.log('✅ No sensitive data found');
            }
        });
    } else {
        console.log('Usage: node security-check.js scan [directory]');
    }
}
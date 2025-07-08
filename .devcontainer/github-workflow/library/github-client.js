/**
 * GitHub API Client Wrapper
 * Provides authenticated GitHub API access with retry logic
 */

import { Octokit } from '@octokit/rest';

export class GitHubClient {
    constructor(token = process.env.GITHUB_TOKEN) {
        if (!token) {
            throw new Error('GitHub token is required');
        }

        this.octokit = new Octokit({
            auth: token,
            throttle: {
                onRateLimit: (retryAfter, options) => {
                    console.warn(`Rate limit hit, retrying after ${retryAfter} seconds`);
                    return true;
                },
                onSecondaryRateLimit: (retryAfter, options) => {
                    console.warn(`Secondary rate limit hit, retrying after ${retryAfter} seconds`);
                    return true;
                }
            }
        });

        this.owner = process.env.GITHUB_REPOSITORY_OWNER || '';
        this.repo = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';
    }

    /**
     * Get issue details
     */
    async getIssue(issueNumber) {
        try {
            const { data } = await this.octokit.issues.get({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber
            });
            return data;
        } catch (error) {
            console.error(`Failed to get issue #${issueNumber}:`, error.message);
            throw error;
        }
    }

    /**
     * Create a comment on an issue
     */
    async createComment(issueNumber, body) {
        try {
            const { data } = await this.octokit.issues.createComment({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                body
            });
            return data;
        } catch (error) {
            console.error(`Failed to create comment on issue #${issueNumber}:`, error.message);
            throw error;
        }
    }

    /**
     * Update an issue
     */
    async updateIssue(issueNumber, updates) {
        try {
            const { data } = await this.octokit.issues.update({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                ...updates
            });
            return data;
        } catch (error) {
            console.error(`Failed to update issue #${issueNumber}:`, error.message);
            throw error;
        }
    }

    /**
     * Add labels to an issue
     */
    async addLabels(issueNumber, labels) {
        try {
            const { data } = await this.octokit.issues.addLabels({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                labels
            });
            return data;
        } catch (error) {
            console.error(`Failed to add labels to issue #${issueNumber}:`, error.message);
            throw error;
        }
    }

    /**
     * Remove a label from an issue
     */
    async removeLabel(issueNumber, label) {
        try {
            await this.octokit.issues.removeLabel({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                name: label
            });
        } catch (error) {
            if (error.status !== 404) {
                console.error(`Failed to remove label "${label}" from issue #${issueNumber}:`, error.message);
                throw error;
            }
        }
    }

    /**
     * Get issue comments
     */
    async getComments(issueNumber) {
        try {
            const { data } = await this.octokit.issues.listComments({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber
            });
            return data;
        } catch (error) {
            console.error(`Failed to get comments for issue #${issueNumber}:`, error.message);
            throw error;
        }
    }

    /**
     * Check if user has write permissions
     */
    async hasWritePermission(username) {
        try {
            const { data } = await this.octokit.repos.getCollaboratorPermissionLevel({
                owner: this.owner,
                repo: this.repo,
                username
            });
            return ['admin', 'write'].includes(data.permission);
        } catch (error) {
            console.error(`Failed to check permissions for user ${username}:`, error.message);
            return false;
        }
    }

    /**
     * Get repository content
     */
    async getContent(path) {
        try {
            const { data } = await this.octokit.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path
            });
            return data;
        } catch (error) {
            if (error.status === 404) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Create or update repository content
     */
    async createOrUpdateContent(path, content, message, sha = null) {
        try {
            const params = {
                owner: this.owner,
                repo: this.repo,
                path,
                message,
                content: Buffer.from(content).toString('base64')
            };

            if (sha) {
                params.sha = sha;
            }

            const { data } = await this.octokit.repos.createOrUpdateFileContents(params);
            return data;
        } catch (error) {
            console.error(`Failed to create/update content at ${path}:`, error.message);
            throw error;
        }
    }
}

/**
 * Exponential backoff retry logic
 */
export async function withRetry(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (i < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, i);
                console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}
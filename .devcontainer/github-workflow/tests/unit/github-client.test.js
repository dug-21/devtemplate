import { jest } from '@jest/globals';
import { GitHubClient } from '../../library/github-client.js';

// Mock Octokit
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      issues: {
        get: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        createComment: jest.fn(),
        addLabels: jest.fn(),
        removeLabel: jest.fn(),
        listComments: jest.fn()
      },
      repos: {
        getContent: jest.fn(),
        createOrUpdateFileContents: jest.fn()
      },
      pulls: {
        create: jest.fn(),
        list: jest.fn()
      }
    }
  }))
}));

describe('GitHubClient', () => {
  let client;
  let mockOctokit;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'test-token';
    client = new GitHubClient();
    mockOctokit = client.octokit;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if GITHUB_TOKEN is not set', () => {
      delete process.env.GITHUB_TOKEN;
      expect(() => new GitHubClient()).toThrow('GITHUB_TOKEN environment variable is required');
    });

    it('should initialize with valid token', () => {
      expect(client).toBeDefined();
      expect(client.octokit).toBeDefined();
    });
  });

  describe('getIssue', () => {
    it('should fetch issue successfully', async () => {
      const mockIssue = {
        data: {
          number: 123,
          title: 'Test Issue',
          body: 'Test body',
          labels: [{ name: 'bug' }]
        }
      };
      mockOctokit.rest.issues.get.mockResolvedValue(mockIssue);

      const result = await client.getIssue('owner/repo', 123);
      
      expect(result).toEqual(mockIssue.data);
      expect(mockOctokit.rest.issues.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123
      });
    });

    it('should handle errors with retry', async () => {
      mockOctokit.rest.issues.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { number: 123 } });

      const result = await client.getIssue('owner/repo', 123);
      
      expect(result).toEqual({ number: 123 });
      expect(mockOctokit.rest.issues.get).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      mockOctokit.rest.issues.get.mockRejectedValue(new Error('Persistent error'));

      await expect(client.getIssue('owner/repo', 123))
        .rejects.toThrow('Failed to get issue after 3 attempts');
    });
  });

  describe('updateIssue', () => {
    it('should update issue successfully', async () => {
      const updates = { title: 'Updated Title', body: 'Updated body' };
      mockOctokit.rest.issues.update.mockResolvedValue({ data: { ...updates, number: 123 } });

      const result = await client.updateIssue('owner/repo', 123, updates);
      
      expect(result).toEqual({ ...updates, number: 123 });
      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        ...updates
      });
    });
  });

  describe('addLabels', () => {
    it('should add labels successfully', async () => {
      const labels = ['bug', 'enhancement'];
      mockOctokit.rest.issues.addLabels.mockResolvedValue({ data: labels });

      const result = await client.addLabels('owner/repo', 123, labels);
      
      expect(result).toEqual(labels);
      expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        labels
      });
    });

    it('should handle empty labels array', async () => {
      const result = await client.addLabels('owner/repo', 123, []);
      
      expect(result).toEqual([]);
      expect(mockOctokit.rest.issues.addLabels).not.toHaveBeenCalled();
    });
  });

  describe('removeLabel', () => {
    it('should remove label successfully', async () => {
      mockOctokit.rest.issues.removeLabel.mockResolvedValue({ data: {} });

      const result = await client.removeLabel('owner/repo', 123, 'bug');
      
      expect(result).toBe(true);
      expect(mockOctokit.rest.issues.removeLabel).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        name: 'bug'
      });
    });

    it('should handle label not found error', async () => {
      mockOctokit.rest.issues.removeLabel.mockRejectedValue({ status: 404 });

      const result = await client.removeLabel('owner/repo', 123, 'nonexistent');
      
      expect(result).toBe(false);
    });
  });

  describe('createComment', () => {
    it('should create comment successfully', async () => {
      const comment = { body: 'Test comment' };
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: { id: 1, ...comment } });

      const result = await client.createComment('owner/repo', 123, 'Test comment');
      
      expect(result).toEqual({ id: 1, ...comment });
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        body: 'Test comment'
      });
    });
  });

  describe('rate limiting', () => {
    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 403;
      rateLimitError.response = {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': Math.floor(Date.now() / 1000) + 3600
        }
      };

      mockOctokit.rest.issues.get.mockRejectedValue(rateLimitError);

      await expect(client.getIssue('owner/repo', 123))
        .rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('parseRepository', () => {
    it('should parse repository string correctly', () => {
      const result = client.parseRepository('owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should throw error for invalid repository format', () => {
      expect(() => client.parseRepository('invalid'))
        .toThrow('Invalid repository format');
    });
  });

  describe('withRetry', () => {
    it('should retry on transient errors', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Transient error');
        }
        return 'success';
      });

      const result = await client.withRetry(operation, 5, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect maxRetries parameter', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent error'));

      await expect(client.withRetry(operation, 2, 10))
        .rejects.toThrow('Persistent error');
      
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});
#!/usr/bin/env node

/**
 * Script to post GitHub issue analysis results
 * This is called after ruv-swarm completes analysis
 */

const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');

async function postGitHubResults() {
  const issueNumber = process.argv[2];
  const phase = process.argv[3];
  const resultsFile = process.argv[4];
  
  if (!issueNumber || !phase || !resultsFile) {
    console.error('Usage: claude-github-post.js <issue-number> <phase> <results-file>');
    process.exit(1);
  }

  try {
    // Read the results
    const results = await fs.readFile(resultsFile, 'utf8');
    
    // Initialize GitHub client
    const octokit = new Octokit({
      auth: process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN
    });

    const owner = process.env.GITHUB_OWNER || 'dug-21';
    const repo = process.env.GITHUB_REPO || 'devtemplate';

    // Post the comment
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: parseInt(issueNumber),
      body: results
    });

    console.log(`✅ Posted results to issue #${issueNumber}`);

    // Get current labels
    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number: parseInt(issueNumber)
    });

    const currentLabels = issue.labels.map(l => l.name);
    
    // Add swarm-processed label
    if (!currentLabels.includes('swarm-processed')) {
      const newLabels = [...currentLabels, 'swarm-processed'];
      
      await octokit.issues.update({
        owner,
        repo,
        issue_number: parseInt(issueNumber),
        labels: newLabels
      });
      
      console.log('✅ Added swarm-processed label');
    }

    // Check for auto-close
    if (phase === 'implementation' && 
        currentLabels.includes('auto-close-on-complete') && 
        !currentLabels.includes('keep-open')) {
      
      await octokit.issues.update({
        owner,
        repo,
        issue_number: parseInt(issueNumber),
        state: 'closed'
      });
      
      console.log('✅ Closed issue (auto-close-on-complete)');
    }

  } catch (error) {
    console.error('❌ Error posting to GitHub:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  postGitHubResults();
}

module.exports = { postGitHubResults };
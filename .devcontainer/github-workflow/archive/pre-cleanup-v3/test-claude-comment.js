#!/usr/bin/env node

const { Octokit } = require('@octokit/rest');

async function postTestComment() {
  try {
    // Initialize GitHub client
    const octokit = new Octokit({
      auth: process.env.AGENT_TOKEN || process.env.GITHUB_TOKEN
    });

    const owner = 'dug-21';
    const repo = 'devtemplate';
    const issue_number = 6;

    // Post the test comment
    const response = await octokit.issues.createComment({
      owner,
      repo,
      issue_number,
      body: `🤖 **Claude Analysis Test**

This is a test comment posted by Claude using GitHub MCP tools.

If you see this, it means Claude can successfully post to GitHub issues!`
    });

    console.log(`✅ Successfully posted comment to issue #${issue_number}`);
    console.log(`Comment URL: ${response.data.html_url}`);

  } catch (error) {
    console.error('❌ Error posting to GitHub:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the function
postTestComment();
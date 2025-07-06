#!/bin/bash

echo "Testing Claude with GitHub MCP..."

# Create a simple prompt
cat > test-prompt.txt << 'EOF'
Please post a comment to GitHub issue #6 in repository dug-21/devtemplate.

Use the GitHub MCP tool:
mcp__github__add_issue_comment({
  owner: "dug-21",
  repo: "devtemplate", 
  issue_number: 6,
  body: "🤖 **Claude Analysis Test**\n\nThis is a test comment posted by Claude using GitHub MCP tools.\n\nIf you see this, it means Claude can successfully post to GitHub issues!"
})

After posting, just say "Done."
EOF

# Run Claude with GitHub MCP
echo "Running Claude..."
claude --print --dangerously-skip-permissions < test-prompt.txt 2>&1 | tee claude-output.txt

echo "Test complete"
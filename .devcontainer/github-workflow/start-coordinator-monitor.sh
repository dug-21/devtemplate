#!/bin/bash

echo "🚀 Starting GitHub Monitor with Coordinator Automation"
echo "=================================================="

# Check if GitHub token is set
if [ -z "$AGENT_TOKEN" ]; then
    echo "❌ Error: AGENT_TOKEN environment variable is not set"
    echo "Please set it with: export AGENT_TOKEN=your_token_here"
    exit 1
fi

# Ensure Claude has GitHub MCP server configured
echo "🔧 Configuring Claude MCP servers..."
claude mcp add github "npx @modelcontextprotocol/server-github" || true

# Verify ruv-swarm is available
echo "🐝 Checking ruv-swarm..."
if ! npx ruv-swarm version > /dev/null 2>&1; then
    echo "❌ Error: ruv-swarm is not available"
    echo "Please run: npm install -g ruv-swarm"
    exit 1
fi

# Run the coordinator monitor
echo "📊 Starting monitor..."
cd "$(dirname "$0")"
node monitor-coordinator.js

echo "✅ Monitor completed"
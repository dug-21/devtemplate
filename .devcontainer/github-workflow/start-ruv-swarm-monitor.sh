#!/bin/bash

echo "🚀 Starting GitHub Monitor with ruv-swarm MCP Orchestration"
echo "========================================================"

# Check if GitHub token is set
if [ -z "$AGENT_TOKEN" ]; then
    echo "❌ Error: AGENT_TOKEN environment variable is not set"
    echo "Please set it with: export AGENT_TOKEN=your_token_here"
    exit 1
fi

# Ensure Claude has BOTH MCP servers configured
echo "🔧 Configuring Claude MCP servers..."
echo "  1️⃣ Adding ruv-swarm MCP server..."
claude mcp add ruv-swarm "npx ruv-swarm mcp start" || true

echo "  2️⃣ Adding GitHub MCP server..."
claude mcp add github "npx @modelcontextprotocol/server-github" || true

# Verify ruv-swarm is available
echo "🐝 Verifying ruv-swarm..."
if ! npx ruv-swarm version > /dev/null 2>&1; then
    echo "❌ Error: ruv-swarm is not available"
    echo "Please run: npm install -g ruv-swarm"
    exit 1
fi

# Check MCP servers are configured
echo "📋 Checking MCP configuration..."
claude mcp list

# Run the ruv-swarm monitor
echo "📊 Starting ruv-swarm monitor..."
cd "$(dirname "$0")"
node monitor-ruv-swarm.js

echo "✅ Monitor completed"
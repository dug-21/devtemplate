#!/bin/bash

# Enhanced V3 Monitor with MCP Integration and File Organization
# Features:
# - GitHub issue monitoring with rate limit protection
# - MCP server health monitoring
# - Proper file organization
# - Automatic reconnection for MCP

echo "🚀 Starting Enhanced GitHub Monitor V3 with MCP Integration..."
echo "📁 File organization: ENABLED"
echo "🔌 MCP monitoring: ENABLED"
echo "⏱️  Rate limit protection: ENABLED (30s delays)"
echo ""

# Change to the script's directory
cd "$(dirname "$0")"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    exit 1
fi

# Check if token is set
if [ -z "$AGENT_TOKEN" ] && [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: Neither AGENT_TOKEN nor GITHUB_TOKEN is set"
    echo "Please set one of these environment variables with your GitHub token"
    exit 1
fi

# Check if Claude CLI is available
if ! command -v claude &> /dev/null; then
    echo "⚠️  Warning: Claude CLI not found. MCP monitoring will be limited."
    echo "Install Claude CLI for full MCP integration support."
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install @octokit/rest
fi

# Create required directories
echo "📁 Creating directory structure..."
mkdir -p issues archive .temp orphaned-files logs tests

# Run file organization for issue-9 if requested
if [ "$1" = "--organize-issue-9" ]; then
    echo "📂 Organizing files from issue-9..."
    node file-organization-v3.js 9
    echo ""
fi

# Check MCP server status
echo "🔌 Checking MCP server status..."
if command -v claude &> /dev/null; then
    claude mcp list 2>/dev/null | grep -q "ruv-swarm"
    if [ $? -eq 0 ]; then
        echo "✅ MCP server 'ruv-swarm' is connected"
    else
        echo "⚠️  MCP server 'ruv-swarm' is not connected"
        echo "  You can add it with: claude mcp add ruv-swarm npx ruv-swarm mcp start"
    fi
else
    echo "⚠️  Claude CLI not available, skipping MCP check"
fi

echo ""
echo "✅ Starting integrated monitor..."
echo "---"

# Check if the monitor exists
if [ -f "monitor-enhanced.js" ]; then
    node monitor-enhanced.js
else
    echo "❌ Error: monitor-enhanced.js not found"
    echo "Please ensure the monitor script exists in the current directory"
    exit 1
fi
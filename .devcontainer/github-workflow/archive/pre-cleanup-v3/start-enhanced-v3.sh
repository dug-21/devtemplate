#!/bin/bash

# Enhanced V3 Monitor with File Organization
# Features proper file organization and cleanup

echo "🚀 Starting Enhanced GitHub Monitor V3..."
echo "📁 File organization: ENABLED"
echo "🧹 Automatic cleanup: ENABLED"
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

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install @octokit/rest
fi

# Run initial cleanup if requested
if [ "$1" = "--cleanup" ]; then
    echo "🧹 Running initial file cleanup..."
    if [ -f "cleanup-existing-files.js" ]; then
        node cleanup-existing-files.js
    else
        echo "⚠️  Cleanup script not found, skipping..."
    fi
    echo ""
fi

# Create required directories
echo "📁 Creating directory structure..."
mkdir -p issues archive .temp orphaned-files

# Start the monitor
echo "✅ Starting monitor..."
echo "---"

# Check if monitor-enhanced-v3.js exists
if [ -f "monitor-enhanced-v3.js" ]; then
    node monitor-enhanced-v3.js
else
    echo "❌ Error: monitor-enhanced-v3.js not found"
    echo "Please ensure the monitor script exists in the current directory"
    exit 1
fi
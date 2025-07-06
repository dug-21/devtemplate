#!/bin/bash

# Enhanced GitHub Automation Startup Script V2
# Starts the monitor with progress tracking and issue management

echo "🚀 Starting Enhanced GitHub Automation V2..."

# Change to the script's directory
cd "$(dirname "$0")"

# Check for required environment variables
if [ -z "$AGENT_TOKEN" ] && [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: AGENT_TOKEN or GITHUB_TOKEN must be set"
    echo "Export one of these variables with your GitHub token:"
    echo "  export AGENT_TOKEN=your_github_token"
    echo "  export GITHUB_TOKEN=your_github_token"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install @octokit/rest
fi

# Make scripts executable
chmod +x automation-enhanced-v2.js
chmod +x monitor-enhanced-v2.js
chmod +x test-enhanced-system.js

# Run the test first
echo ""
echo "🧪 Running system tests..."
node test-enhanced-system.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Tests passed! Starting monitor..."
    echo ""
    
    # Start the enhanced monitor
    node monitor-enhanced-v2.js
else
    echo ""
    echo "❌ Tests failed. Please fix issues before starting the monitor."
    exit 1
fi
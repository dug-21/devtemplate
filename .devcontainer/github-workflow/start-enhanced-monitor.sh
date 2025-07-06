#!/bin/bash

echo "🐝 Starting Enhanced GitHub Workflow Monitor with ruv-swarm"
echo "=================================================="

# Check for agent token (automation should use AGENT_TOKEN)
if [[ -z "$AGENT_TOKEN" ]]; then
    echo "❌ Error: No agent token found!"
    echo "Please set AGENT_TOKEN for automation use"
    echo "(GITHUB_PAT should only be used by VSCode/human)"
    exit 1
fi

# Change to the workflow directory
cd /workspaces/devtemplate/.devcontainer/github-workflow

# Stop any existing monitor
echo "🛑 Stopping any existing monitors..."
pkill -f "node.*monitor" 2>/dev/null || true
sleep 2

# Use the enhanced versions
if [ ! -f "config-enhanced.json" ]; then
    echo "❌ Error: config-enhanced.json not found!"
    exit 1
fi

# Copy enhanced config to config.json for compatibility
cp config-enhanced.json config.json

echo "🚀 Starting enhanced monitor with:"
echo "  - Parallel swarm processing ⚡"
echo "  - Issue tracking to prevent reprocessing 📊"
echo "  - GitHub Projects support 📋"
echo "  - Draft/label filtering 🏷️"
echo ""

# Start the enhanced monitor
nohup node monitor-enhanced.js > monitor.log 2>&1 &
MONITOR_PID=$!

echo "✅ Monitor started with PID: $MONITOR_PID"
echo ""
echo "📝 Commands:"
echo "  - View logs: tail -f monitor.log"
echo "  - Stop monitor: pkill -f 'node.*monitor'"
echo "  - Check status: ps aux | grep monitor"
echo ""
echo "🐝 The swarm is ready to process your GitHub issues!"
#!/bin/bash

# Start Enhanced GitHub Monitor V3 with MCP Server Monitoring
# This script ensures the ruv-swarm MCP server stays connected

echo "🚀 Starting Enhanced GitHub Monitor V3 with MCP Monitoring..."
echo "=================================================="
echo ""

# Set working directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Create log directory if it doesn't exist
mkdir -p logs

# Check if required dependencies are installed
echo "Checking dependencies..."
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx is not installed"
    exit 1
fi

# Check if ruv-swarm is available
echo "Checking ruv-swarm availability..."
if ! npx ruv-swarm --version &> /dev/null; then
    echo "⚠️  Warning: ruv-swarm may not be installed globally"
    echo "Attempting to install ruv-swarm..."
    npm install -g ruv-swarm
fi

# Kill any existing monitor processes
echo "Cleaning up existing processes..."
pkill -f "monitor-enhanced-v3-mcp.js" 2>/dev/null
pkill -f "ruv-swarm mcp" 2>/dev/null

# Wait a moment for processes to clean up
sleep 2

# Export required environment variables
export RUV_SWARM_HOOKS_ENABLED=false
export RUV_SWARM_TELEMETRY_ENABLED=true
export RUV_SWARM_REMOTE_READY=true
export RUV_SWARM_AUTO_RECONNECT=true

# Start the monitor with MCP support
echo ""
echo "Starting monitor with MCP support..."
echo "Log files will be written to: $SCRIPT_DIR/logs/"
echo ""
echo "Press Ctrl+C to stop the monitor"
echo "=================================================="
echo ""

# Run the monitor
node monitor-enhanced-v3-mcp.js

# Cleanup on exit
echo ""
echo "Monitor stopped. Cleaning up..."
pkill -f "ruv-swarm mcp" 2>/dev/null
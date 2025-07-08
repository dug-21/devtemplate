#!/bin/bash
echo "🚀 Starting GitHub Workflow Monitor..."
echo "📊 Repository: $(jq -r '.github.owner + "/" + .github.repo' config.json)"
echo "⏰ Poll interval: $(jq -r '.github.pollInterval / 1000' config.json)s"
echo ""
echo "To stop: Ctrl+C"
echo "To run in background: nohup ./start-monitor.sh > monitor.log 2>&1 &"
echo ""
node monitor.js

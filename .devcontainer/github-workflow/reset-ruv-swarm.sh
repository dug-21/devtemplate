#!/bin/bash

# Simple reset script for ruv-swarm
echo "🧹 Resetting ruv-swarm data..."

# Method 1: Remove any local storage directories
echo "Checking for local storage..."
if [ -d "$HOME/.ruv-swarm" ]; then
    echo "Found ~/.ruv-swarm - removing..."
    rm -rf "$HOME/.ruv-swarm"
fi

if [ -d ".ruv-swarm" ]; then
    echo "Found .ruv-swarm - removing..."
    rm -rf ".ruv-swarm"
fi

# Method 2: Clear any node_modules cache
echo "Clearing potential cache..."
rm -rf node_modules/.cache/ruv-swarm 2>/dev/null

# Method 3: Force reinitialize with minimal agents
echo "Force reinitializing ruv-swarm..."
npx ruv-swarm init mesh 1 --force

echo ""
echo "✅ Reset complete!"
echo ""
echo "📊 Current status:"
npx ruv-swarm status

echo ""
echo "💡 If agents still persist:"
echo "1. The data might be in browser IndexedDB (if using web interface)"
echo "2. Try restarting your terminal/VS Code"
echo "3. Check for any ruv-swarm processes: ps aux | grep ruv-swarm"
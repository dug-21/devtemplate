#!/bin/bash

echo "🧹 Force cleanup of ruv-swarm data..."
echo ""
echo "⚠️  This will completely remove and reinstall ruv-swarm"
echo ""

# Step 1: Kill any running ruv-swarm processes
echo "1️⃣ Stopping any ruv-swarm processes..."
pkill -f ruv-swarm 2>/dev/null || true

# Step 2: Clear npm cache
echo "2️⃣ Clearing npm cache..."
npm cache clean --force 2>/dev/null || true

# Step 3: Find and remove any ruv-swarm data directories
echo "3️⃣ Removing data directories..."
# Common locations where Node.js might store data
rm -rf ~/.ruv-swarm 2>/dev/null || true
rm -rf ~/.config/ruv-swarm 2>/dev/null || true
rm -rf ~/.local/share/ruv-swarm 2>/dev/null || true
rm -rf /tmp/ruv-swarm* 2>/dev/null || true
rm -rf ./.ruv-swarm 2>/dev/null || true

# Step 4: Clear any IndexedDB-like storage in the npm global directory
echo "4️⃣ Checking npm global directory..."
NPM_GLOBAL=$(npm root -g)
if [ -d "$NPM_GLOBAL/ruv-swarm" ]; then
    # Look for any data directories within ruv-swarm
    find "$NPM_GLOBAL/ruv-swarm" -name "*.db" -o -name "*.leveldb" -o -name "data" -type d 2>/dev/null | while read -r datadir; do
        echo "   Found data: $datadir"
        rm -rf "$datadir" 2>/dev/null || true
    done
fi

# Step 5: Uninstall and reinstall ruv-swarm
echo "5️⃣ Reinstalling ruv-swarm..."
echo "   Uninstalling..."
npm uninstall -g ruv-swarm 2>/dev/null || true
echo "   Installing fresh copy..."
npm install -g ruv-swarm@latest

# Step 6: Initialize with a clean state
echo "6️⃣ Initializing clean ruv-swarm..."
npx ruv-swarm init mesh 1 --force

echo ""
echo "✅ Force cleanup complete!"
echo ""
echo "📊 Checking new status..."
npx ruv-swarm status

echo ""
echo "🎉 If this worked, you should see only 1 swarm with 0-1 agents!"
echo ""
echo "💡 If agents still persist, try:"
echo "   1. Exit and restart VS Code"
echo "   2. Rebuild the dev container"
echo "   3. Check if ruv-swarm is storing data in a cloud service"
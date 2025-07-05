#!/bin/bash
set -e

echo "🔄 Running post-start configuration..."

# Ensure proper permissions
if [ -f ".devcontainer/setup.sh" ]; then
    chmod +x .devcontainer/setup.sh
fi
if [ -f ".devcontainer/post-start.sh" ]; then
    chmod +x .devcontainer/post-start.sh
fi
if [ -f ".devcontainer/mcp_setup.sh" ]; then
    chmod +x .devcontainer/mcp_setup.sh
fi

# Verify Claude and ruv-swarm are available
if command -v claude &> /dev/null; then
    echo "✅ Claude Code CLI is available: $(claude --version 2>/dev/null || echo 'version check failed')"
else
    echo "⚠️  Claude Code CLI not found. You may need to restart the terminal or run setup again."
fi

if command -v ruv-swarm &> /dev/null; then
    echo "✅ ruv-swarm is available: $(ruv-swarm --version 2>/dev/null || echo 'version check failed')"
else
    echo "⚠️  ruv-swarm not found. You may need to restart the terminal or run setup again."
fi

# Verify and configure MCP connections if setup script exists
if [ -f ".devcontainer/mcp_setup.sh" ]; then
    .devcontainer/mcp_setup.sh
else
    # Just list MCP connections if Claude is available
    if command -v claude &> /dev/null; then
        echo "📋 Current MCP connections:"
        claude mcp list 2>/dev/null || echo "No MCP connections configured yet."
    fi
fi

echo ""
echo "✅ Post-start configuration complete!"
echo "💡 This is a minimal base environment with Claude Code and ruv-swarm."
echo "   Add project-specific dependencies and configurations as needed."
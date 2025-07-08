#!/bin/bash
set -e

echo "🔌 Configuring MCP servers with Podman support..."

# Check if Claude CLI is available
if ! command -v claude &> /dev/null; then
    echo "❌ Claude CLI not found. Please ensure it's installed first."
    exit 1
fi

# Function to check if an MCP server exists
mcp_exists() {
    local server_name=$1
    claude mcp list 2>/dev/null | grep -q "^${server_name}:" && return 0 || return 1
}

# Function to add MCP server if it doesn't exist
add_mcp_if_not_exists() {
    local server_name=$1
    shift  # Remove server_name from arguments
    
    if mcp_exists "$server_name"; then
        echo "  ✓ $server_name already configured"
    else
        echo "  + Adding $server_name MCP server..."
        claude mcp add --scope local "$server_name" "$@"
    fi
}

# Configure ruv-swarm MCP server (always include this)
add_mcp_if_not_exists "ruv-swarm" npx ruv-swarm mcp start

# Configure Podman MCP server
echo "🐳 Configuring Podman MCP server..."
add_mcp_if_not_exists "podman" npx podman-mcp-server@latest

# Optional: Configure GitHub MCP server if AGENT_TOKEN is set
if [ -n "$GITHUB_BOT_TOKEN" ]; then
    add_mcp_if_not_exists "github" npx @modelcontextprotocol/server-github -e GITHUB_PERSONAL_ACCESS_TOKEN="$GITHUB_BOT_TOKEN"
else
    echo "  ℹ️  AGENT_TOKEN not set. Set it in Codespaces secrets to enable GitHub MCP."
fi

echo ""
echo "📋 Current MCP servers:"
claude mcp list

echo ""
echo "💡 Podman MCP server is now available! You can use it to:"
echo "   - Manage containers and images"
echo "   - Control container lifecycle"
echo "   - Access container logs and stats"
echo "   - Work with both Podman and Docker runtimes"
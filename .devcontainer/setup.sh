#!/bin/bash

echo "🚀 Setting up development environment..."

# Install MCP servers (continue on error)
echo "📦 Installing MCP servers..."
npm install -g @modelcontextprotocol/server-github @modelcontextprotocol/server-filesystem 2>/dev/null || echo "Note: MCP servers installation had warnings"

# Install ruv-swarm globally
echo "📦 Installing ruv-swarm..."
npm install -g ruv-swarm 2>/dev/null || echo "Note: ruv-swarm installation had warnings"

# Fix ruv-swarm permissions
echo "🔧 Fixing ruv-swarm permissions..."
if [ -d "/usr/lib/node_modules/ruv-swarm" ]; then
    sudo mkdir -p /usr/lib/node_modules/ruv-swarm/data 2>/dev/null || true
    sudo chmod -R 777 /usr/lib/node_modules/ruv-swarm/data 2>/dev/null || true
    echo "✅ ruv-swarm permissions fixed"
else
    echo "⚠️  ruv-swarm not found globally, skipping permissions fix"
fi

# Configure git to use Developer PAT if available
if [ -n "$GITHUB_PAT" ]; then
    echo "🔑 Configuring git to use Developer GitHub PAT..."
    git config --global credential.helper store
    git config --global url."https://${GITHUB_PAT}@github.com/".insteadOf "https://github.com/"
    git config --global url."https://${GITHUB_PAT}@github.com/".insteadOf "git@github.com:"
    echo "✅ Git configured to use Developer PAT for authentication"
else
    echo "⚠️  No Developer GitHub PAT found. You'll need to authenticate manually."
fi

# Configure MCP with restricted PAT
if [ -n "$AGENT_TOKEN" ]; then
    echo "🤖 MCP GitHub PAT detected (restricted permissions)"
    # Export for MCP servers to use
    echo "export GITHUB_PERSONAL_ACCESS_TOKEN=$AGENT_TOKEN" >> ~/.bashrc
else
    echo "⚠️  No MCP GitHub PAT found. Claude won't have GitHub access."
fi

# Create symlink for Claude configuration file to persist it
if [ ! -e "/home/vscode/.claude.json" ]; then
    echo "🔗 Creating symlink for Claude configuration persistence..."
    # If backup exists in volume, use it
    if [ -f "/home/vscode/.claude/claude.json" ]; then
        ln -s /home/vscode/.claude/claude.json /home/vscode/.claude.json
    else
        # Create empty file in volume and symlink to it
        touch /home/vscode/.claude/claude.json
        ln -s /home/vscode/.claude/claude.json /home/vscode/.claude.json
    fi
    echo "✅ Claude configuration will now persist across rebuilds"
fi

# Initialize git config if not already done
if [ -z "$(git config --global user.name 2>/dev/null)" ]; then
    echo ""
    echo "📧 Configuring git:"
    git config --global user.name 'Doug Faist'
    git config --global user.email 'angryweed@gmail.com'
fi

# Create alias for swarm to always use ruv-swarm
echo ""
echo "🔗 Creating swarm alias..."
echo 'alias swarm="ruv-swarm"' >> ~/.bashrc
echo "✅ Alias created: swarm → ruv-swarm"

# Initialize ruv-swarm in the repository for full functionality
echo ""
echo "🔧 Initializing ruv-swarm..."
cd /workspaces/devtemplate && npx -y ruv-swarm init --claude
echo ""
echo "✅ ruv-swarm initialization complete!"
echo

# Setup GitHub workflow integration if enabled
if [ -f ".devcontainer/setup-github-workflow.sh" ]; then
    echo ""
    echo "🐙 Setting up GitHub workflow integration..."
    bash .devcontainer/setup-github-workflow.sh
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Available tools:"
echo "  - claude (Claude Code CLI)"
echo "  - ruv-swarm (AI swarm orchestration)"
echo "  - rustc, cargo (Rust development)"
echo "  - node, npm (JavaScript/TypeScript)"
echo "  - python3, pip3 (Python development)"

if [ -n "$GITHUB_PAT" ] || [ -n "$AGENT_TOKEN" ]; then
    echo ""
    echo "🔐 Authentication Status:"
    [ -n "$GITHUB_PAT" ] && echo "   ✅ Developer PAT: Configured for git operations"
    [ -n "$AGENT_TOKEN" ] && echo "   ✅ MCP PAT: Configured for Claude/AI agents"
    echo "   Clone with: git clone https://github.com/username/repo.git"
fi
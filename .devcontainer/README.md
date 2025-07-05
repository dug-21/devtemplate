# Base Development Container

This is a minimal devcontainer setup that ensures Claude Code CLI and ruv-swarm are available in any project.

## What's Included

- **Claude Code CLI** - AI-powered development assistant
- **ruv-swarm** - Distributed AI swarm coordination
- **Git** - Version control
- **Node.js** - For running Claude and ruv-swarm

## Setup Scripts

- `setup.sh` - Installs Claude Code and ruv-swarm globally
- `post-start.sh` - Verifies installations and shows status
- `mcp_setup.sh` - Configures MCP servers (ruv-swarm and optionally GitHub)
- `mcp_setup_podman.sh` - Alternative setup that includes Podman MCP server

## Usage

1. Copy this `.devcontainer` folder to any project
2. Open in VS Code or GitHub Codespaces
3. The container will automatically install Claude and ruv-swarm
4. Add project-specific tools and dependencies as needed

## Environment Variables

- `AGENT_TOKEN` - (Optional) GitHub personal access token for GitHub MCP server

## Available MCP Servers

### Default (mcp_setup.sh)
- **ruv-swarm** - AI swarm coordination
- **github** - GitHub integration (if AGENT_TOKEN is set)

### With Podman Support (mcp_setup_podman.sh)
- **ruv-swarm** - AI swarm coordination
- **podman** - Container management (works with both Podman and Docker)
- **github** - GitHub integration (if AGENT_TOKEN is set)

To use Podman MCP, update your `post-start.sh` to call `mcp_setup_podman.sh` instead of `mcp_setup.sh`.

## Customization

This is intentionally minimal. Add project-specific:
- Language runtimes (Python, Rust, etc.)
- Development tools
- Project dependencies
- Additional MCP servers

in your project's setup scripts or Dockerfile.
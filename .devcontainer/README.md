# Personal Development Container

A fully-featured development container with Claude Code CLI, ruv-swarm orchestration, and multi-language support.

## What's Included

### Core Tools
- **Claude Code CLI** - AI-powered development assistant
- **ruv-swarm** - Distributed AI swarm orchestration with MCP integration
- **Git** - Version control with credential management

### Language Support
- **Node.js** (LTS) - JavaScript/TypeScript development
- **Python 3** - Python development with pip and venv
- **Rust** - Systems programming with cargo

### MCP Servers
- **@modelcontextprotocol/server-github** - GitHub integration
- **@modelcontextprotocol/server-filesystem** - File system access
- **ruv-swarm** - AI swarm coordination (via stdio)

## Setup Process

The container automatically:
1. Installs all MCP servers and ruv-swarm globally
2. Fixes ruv-swarm permissions for data directory access
3. Configures git authentication using provided PATs
4. Creates persistent Claude configuration
5. Initializes ruv-swarm with Claude integration

## Environment Variables

- `GITHUB_PAT` - Developer GitHub personal access token for git operations
- `AGENT_TOKEN` - MCP GitHub personal access token for Claude/AI agents

Both tokens are passed securely using Docker secrets.

## Files and Scripts

### Configuration Files
- `devcontainer.json` - Main container configuration with VS Code extensions
- `Dockerfile` - Container image definition with all language runtimes

### Setup Scripts
- `setup.sh` - Main setup script that:
  - Installs MCP servers and ruv-swarm
  - Fixes permissions for ruv-swarm data directory
  - Configures git authentication
  - Creates persistent Claude configuration
  - Initializes ruv-swarm with `--claude` flag
- `post-start.sh` - Verifies installations and configures Claude MCP
- `mcp_setup.sh` - Standard MCP configuration
- `mcp_setup_podman.sh` - Alternative with Podman support
- `setup-secrets.sh` - Manages GitHub PAT secrets

## Persistent Storage

The container mounts a volume at `/home/vscode/.claude` to persist:
- Claude configuration (`.claude.json`)
- ruv-swarm data and swarm state
- Any other Claude-related settings

## VS Code Extensions

Automatically installed:
- rust-lang.rust-analyzer - Rust language support
- ms-python.python - Python language support
- dbaeumer.vscode-eslint - JavaScript linting
- esbenp.prettier-vscode - Code formatting
- ms-vscode-remote.remote-containers - Container support
- eamodio.gitlens - Enhanced Git features

## ruv-swarm Integration

After setup, ruv-swarm creates:
- `CLAUDE.md` - Configuration guide for Claude Code
- `.claude/settings.json` - Enhanced hooks configuration
- `.claude/commands/` - Command documentation
- Cross-platform wrapper scripts (`ruv-swarm`, `claude-swarm.*`)
- Local data directory at `.ruv-swarm/` (gitignored)

## Usage

1. Open project in VS Code with Dev Containers extension
2. Container will build and run setup automatically
3. Use `claude` command for AI assistance
4. Use ruv-swarm MCP tools for swarm orchestration
5. All language runtimes are ready to use

## Customization

Add project-specific requirements:
- Additional language runtimes
- Database clients
- Project dependencies
- Extra MCP servers

Modify the Dockerfile or add to setup.sh as needed.
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install essential development tools
RUN apt-get update && apt-get install -y \
    # Python
    python3 \
    python3-pip \
    python3-venv \
    # Clean up
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Node.js via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Rust
USER vscode
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/home/vscode/.cargo/bin:${PATH}"

# Switch back to root for global npm installs
USER root

# Install global npm packages
RUN npm install -g \
    @anthropic-ai/claude-code \
    ruv-swarm

# Install MCP servers
RUN npm install -g \
    @modelcontextprotocol/server-github \
    @modelcontextprotocol/server-filesystem

# Switch back to vscode user
USER vscode
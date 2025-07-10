# Docker Migration Guide

## Changes Made for Docker Compatibility

### 1. Volume Mount Configuration
The mount configuration has been updated to use Docker's volume syntax:

```json
"mounts": [
  {
    "source": "claude-devtemplate",
    "target": "/home/vscode/.claude",
    "type": "volume"
  }
]
```

**Key changes:**
- Uses explicit object notation for better Docker compatibility
- Added `initializeCommand` to ensure volume exists before container creation
- The volume will persist across container rebuilds, preserving your Claude configuration

### 2. Environment Variables
Replaced Podman-specific secret mounting with Docker-compatible environment variable handling:

```json
"containerEnv": {
  "GITHUB_PAT": "${localEnv:GITHUB_PAT}",
  "GITHUB_BOT_TOKEN": "${localEnv:GITHUB_BOT_TOKEN}"
}
```

**Options for environment variables:**

#### Option A: Export in your shell (Recommended)
```bash
export GITHUB_PAT="your_token_here"
export GITHUB_BOT_TOKEN="your_bot_token_here"
```

Add these to your `~/.bashrc` or `~/.zshrc` for persistence.

#### Option B: Use VS Code settings
Add to your VS Code user settings.json:
```json
"remote.localPortHost": "localhost",
"remote.containers.defaultExtensions": [],
"remote.containers.env": {
  "GITHUB_PAT": "your_token_here",
  "GITHUB_BOT_TOKEN": "your_bot_token_here"
}
```

#### Option C: Use .env file
1. Copy `.devcontainer/.env.example` to `.devcontainer/.env`
2. Fill in your values
3. Uncomment the `runArgs` line in devcontainer.json:
   ```json
   "runArgs": ["--env-file", "${localWorkspaceFolder}/.devcontainer/.env"],
   ```

### 3. Removed Podman-specific Options
- Removed `--security-opt label=disable` (not needed for Docker)
- Removed `--secret` flags (replaced with environment variables)

## Testing the Configuration

1. **Check volume persistence:**
   ```bash
   docker volume ls | grep claude-devtemplate
   ```

2. **Verify environment variables inside container:**
   ```bash
   echo $GITHUB_PAT
   echo $GITHUB_BOT_TOKEN
   ```

3. **Test Claude config persistence:**
   - Save Claude configuration
   - Rebuild container
   - Verify configuration persists

## Troubleshooting

### Environment variables not available
1. Ensure variables are exported in your shell before launching VS Code
2. Try launching VS Code from terminal: `code .`
3. Check VS Code Developer Tools console for errors

### Volume mount issues
1. Ensure Docker has necessary permissions
2. Check if volume exists: `docker volume inspect claude-devtemplate`
3. If issues persist, remove and recreate: 
   ```bash
   docker volume rm claude-devtemplate
   docker volume create claude-devtemplate
   ```

### Migration from Podman
If you have existing Podman volumes with data:
1. Export data from Podman volume
2. Import into Docker volume
3. Or manually copy configuration files after first container start
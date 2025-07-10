#!/bin/bash
# Setup script to ensure environment variables are available for Docker devcontainer

echo "🔧 Setting up environment for Docker devcontainer..."

# Check if running in VS Code context
if [ -n "$VSCODE_IPC_HOOK_CLI" ]; then
    echo "✓ Running in VS Code context"
fi

# Source local environment if available
if [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc"
fi

if [ -f "$HOME/.bash_profile" ]; then
    source "$HOME/.bash_profile"
fi

# Check for required environment variables
check_env_var() {
    local var_name=$1
    if [ -z "${!var_name}" ]; then
        echo "⚠️  Warning: $var_name is not set"
        return 1
    else
        echo "✓ $var_name is set"
        return 0
    fi
}

echo ""
echo "Checking environment variables..."
check_env_var "GITHUB_PAT"
check_env_var "GITHUB_BOT_TOKEN"

# Export to ensure they're available
export GITHUB_PAT
export GITHUB_BOT_TOKEN

# Option to use .env file if variables are missing
if [ ! -z "$1" ] && [ "$1" = "--use-env-file" ]; then
    if [ -f ".devcontainer/.env" ]; then
        echo ""
        echo "Loading from .env file..."
        export $(grep -v '^#' .devcontainer/.env | xargs)
        echo "✓ Environment variables loaded from .env file"
    fi
fi

echo ""
echo "✅ Environment setup complete"
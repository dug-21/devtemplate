#!/bin/bash
# Secure secret setup for Podman development environments

set -e

echo "🔐 Setting up Podman secrets for development..."

# Function to create secret if it doesn't exist
create_secret_if_not_exists() {
    local secret_name=$1
    local prompt_text=$2
    
    if podman secret exists "$secret_name" 2>/dev/null; then
        echo "  ✓ Secret '$secret_name' already exists"
    else
        echo -n "  → $prompt_text: "
        read -s secret_value
        echo
        echo -n "$secret_value" | podman secret create "$secret_name" -
        echo "  ✓ Secret '$secret_name' created"
    fi
}

# Common development secrets
echo ""
echo "📋 Setting up common development secrets..."
echo "   (Press Enter to skip any secret you don't need)"
echo ""

create_secret_if_not_exists "db_password" "Database password"
create_secret_if_not_exists "db_root_password" "Database root password"
create_secret_if_not_exists "api_key" "API key"
create_secret_if_not_exists "jwt_secret" "JWT secret"
create_secret_if_not_exists "session_secret" "Session secret"

# Generate random secrets if needed
echo ""
read -p "Generate random secrets for any missing values? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    for secret in jwt_secret session_secret app_secret; do
        if ! podman secret exists "$secret" 2>/dev/null; then
            openssl rand -base64 32 | podman secret create "$secret" -
            echo "  ✓ Generated random secret '$secret'"
        fi
    done
fi

# List created secrets
echo ""
echo "🔑 Available secrets:"
podman secret ls --format "table {{.Name}}\t{{.CreatedAt}}"

echo ""
echo "✅ Secret setup complete!"
echo ""
echo "📝 To use these secrets in your containers:"
echo "   podman run --secret db_password myapp"
echo "   podman run --secret api_key,type=env,target=API_KEY myapp"
echo ""
echo "🔍 Secrets are available at /run/secrets/<secret_name> in containers"
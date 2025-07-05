#!/bin/bash

echo "🔧 Setting up GitHub Workflow Integration..."

# Check for GitHub token
if [ -z "$GITHUB_TOKEN" ] && [ -z "$GITHUB_PAT" ] && [ -z "$AGENT_TOKEN" ]; then
    echo "⚠️  Warning: No GitHub token found"
    echo "   Set GITHUB_TOKEN, GITHUB_PAT, or AGENT_TOKEN for full functionality"
fi

# Get current repo info
REPO_URL=$(git config --get remote.origin.url 2>/dev/null || echo "")
if [ -n "$REPO_URL" ]; then
    # Extract owner and repo from URL
    if [[ $REPO_URL =~ github\.com[:/]([^/]+)/([^/]+)(\.git)?$ ]]; then
        GITHUB_OWNER="${BASH_REMATCH[1]}"
        GITHUB_REPO="${BASH_REMATCH[2]}"
        GITHUB_REPO="${GITHUB_REPO%.git}"  # Remove .git suffix if present
    fi
fi

# Fallback to defaults if extraction failed
GITHUB_OWNER="${GITHUB_OWNER:-YOUR_GITHUB_USERNAME}"
GITHUB_REPO="${GITHUB_REPO:-YOUR_REPO_NAME}"

echo "📊 Repository: $GITHUB_OWNER/$GITHUB_REPO"

# Navigate to workflow directory
cd /workspaces/devtemplate/.devcontainer/github-workflow

# Install dependencies
echo "📦 Installing dependencies..."
npm install --silent

# Update config with detected repo info
echo "📝 Updating configuration..."
cat > config.json << EOF
{
  "github": {
    "owner": "$GITHUB_OWNER",
    "repo": "$GITHUB_REPO",
    "pollInterval": 300000,
    "enabled": true
  },
  "phases": {
    "idea": {
      "agents": ["researcher", "analyst"],
      "strategy": "research",
      "autoAdvance": false,
      "nextPhase": "research"
    },
    "research": {
      "agents": ["researcher", "analyst", "coordinator"],
      "strategy": "analysis",
      "autoAdvance": true,
      "nextPhase": "planning"
    },
    "planning": {
      "agents": ["analyst", "coder", "coordinator"],
      "strategy": "planning",
      "autoAdvance": false,
      "nextPhase": "implementation"
    },
    "implementation": {
      "agents": ["coder", "tester", "coordinator"],
      "strategy": "development",
      "autoAdvance": false,
      "nextPhase": "testing"
    }
  },
  "automation": {
    "welcomeNewIssues": true,
    "autoLabel": true,
    "postUpdates": true,
    "triggerSwarms": true
  },
  "templates": {
    "welcome": "👋 Thanks for opening this issue! Our GitHub workflow automation has been activated.",
    "swarmActivated": "🐝 A {phase} swarm has been deployed to analyze this issue.",
    "analysisComplete": "✅ Swarm analysis complete. See results above."
  }
}
EOF

# Add state file to gitignore
echo ".monitor-state.json" >> /workspaces/devtemplate/.gitignore

# Create service file for systemd-style management (optional)
cat > github-workflow.service << EOF
[Unit]
Description=GitHub Workflow Monitor
After=network.target

[Service]
Type=simple
WorkingDirectory=/workspaces/devtemplate/.devcontainer/github-workflow
ExecStart=/usr/bin/node monitor.js
Restart=always
Environment="GITHUB_TOKEN=${GITHUB_TOKEN:-}"
Environment="GITHUB_PAT=${GITHUB_PAT:-}"
Environment="AGENT_TOKEN=${AGENT_TOKEN:-}"

[Install]
WantedBy=multi-user.target
EOF

# Create simple start script
cat > start-monitor.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting GitHub Workflow Monitor..."
echo "📊 Repository: $(jq -r '.github.owner + "/" + .github.repo' config.json)"
echo "⏰ Poll interval: $(jq -r '.github.pollInterval / 1000' config.json)s"
echo ""
echo "To stop: Ctrl+C"
echo "To run in background: nohup ./start-monitor.sh > monitor.log 2>&1 &"
echo ""
node monitor.js
EOF

chmod +x start-monitor.sh

# Return to project root
cd /workspaces/devtemplate

echo ""
echo "✅ GitHub Workflow Integration setup complete!"
echo ""
echo "📋 What was configured:"
echo "   📄 Issue templates: .github/ISSUE_TEMPLATE/"
echo "   🤖 Automation: .devcontainer/github-workflow/"
echo "   📊 Repository: $GITHUB_OWNER/$GITHUB_REPO"
echo ""
echo "🚀 To start monitoring:"
echo "   cd .devcontainer/github-workflow"
echo "   ./start-monitor.sh"
echo ""
echo "⚙️  To configure:"
echo "   Edit .devcontainer/github-workflow/config.json"
echo ""
echo "📖 Usage:"
echo "   1. Create issues using the templates"
echo "   2. Issues are automatically processed by ruv-swarm"
echo "   3. Monitor progress in issue comments"
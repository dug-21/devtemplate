# GitHub Workflow Integration with ruv-swarm

A standardized development process using GitHub Issues and ruv-swarm automation for feature planning, research, implementation, and tracking.

## 🎯 Overview

This system creates a structured development workflow where:
- Ideas → Research → Planning → Implementation
- Each phase has dedicated GitHub issue templates
- ruv-swarm automatically processes issues and provides intelligent assistance
- Everything is tracked and documented in GitHub

## 🏗️ Architecture

```
GitHub Issues → Monitor → Automation → ruv-swarm → Comments/Updates
     ↓              ↓           ↓            ↓
  Templates    Polling     Phase Logic   Specialized
  (4 phases)   (5 min)     (Labels)      Agents
```

## 📋 Development Phases

### 1. 💡 Idea Phase
- **Template**: `01-idea.yml`
- **Labels**: `phase:idea`, `needs-research`
- **Swarm**: Research agents analyze feasibility
- **Output**: Research recommendations

### 2. 🔍 Research Phase  
- **Template**: `02-research.yml`
- **Labels**: `phase:research`, `needs-analysis`
- **Swarm**: Research + analysis agents
- **Output**: Detailed analysis and approach

### 3. 📋 Planning Phase
- **Template**: `03-planning.yml` 
- **Labels**: `phase:planning`, `needs-design`
- **Swarm**: Analysis + coding agents
- **Output**: Implementation plan and architecture

### 4. ⚒️ Implementation Phase
- **Template**: `04-implementation.yml`
- **Labels**: `phase:implementation`, `in-development`
- **Swarm**: Coding + testing agents
- **Output**: Working implementation

## 🚀 Quick Start

### 1. Setup (One-time)
```bash
# Run the setup script
bash .devcontainer/setup-github-workflow.sh

# Start monitoring (optional - for real-time processing)
cd .devcontainer/github-workflow
./start-monitor.sh
```

### 2. Usage
1. **Create an issue** using one of the templates
2. **ruv-swarm automatically processes** the issue
3. **Monitor progress** in issue comments
4. **Advance to next phase** when ready

### 3. Configuration
Edit `.devcontainer/github-workflow/config.json`:
```json
{
  "github": {
    "owner": "your-username",
    "repo": "your-repo",
    "pollInterval": 300000
  },
  "automation": {
    "welcomeNewIssues": true,
    "triggerSwarms": true
  }
}
```

## 📁 File Structure

```
.devcontainer/github-workflow/
├── automation.js      # Core automation logic
├── monitor.js         # Issue polling system  
├── config.json        # Configuration
├── package.json       # Dependencies
├── start-monitor.sh   # Start script
└── README.md          # This file

.github/ISSUE_TEMPLATE/
├── 01-idea.yml        # Idea exploration template
├── 02-research.yml    # Research template
├── 03-planning.yml    # Planning template
└── 04-implementation.yml # Implementation template
```

## 🔧 Components

### Monitor (`monitor.js`)
- Polls GitHub Issues every 5 minutes
- Uses ETags for efficient API usage
- Processes new/updated issues automatically
- Handles errors gracefully with retry logic

### Automation (`automation.js`)
- Detects issue phases from labels/content
- Triggers appropriate ruv-swarm for each phase
- Posts progress updates as comments
- Manages issue lifecycle transitions

### Configuration (`config.json`)
- Repository settings
- Phase definitions and swarm assignments
- Automation preferences
- Customizable templates

## 🐝 Swarm Integration

Each phase triggers a specialized swarm:

```javascript
// Idea Phase
agents: ["researcher", "analyst"]
task: "Analyze idea feasibility"

// Research Phase  
agents: ["researcher", "analyst", "coordinator"]
task: "Conduct comprehensive research"

// Planning Phase
agents: ["analyst", "coder", "coordinator"] 
task: "Create implementation plan"

// Implementation Phase
agents: ["coder", "tester", "coordinator"]
task: "Implement and test feature"
```

## 🔄 Workflow Example

1. **Create Idea Issue**
   - Use `01-idea.yml` template
   - Describe the concept/problem
   - ruv-swarm research agents analyze feasibility

2. **Research Phase**
   - Create `02-research.yml` issue (or convert idea)
   - Define research questions
   - Swarm conducts analysis and reports findings

3. **Planning Phase**
   - Create `03-planning.yml` issue
   - Define requirements from research
   - Swarm creates implementation plan

4. **Implementation Phase**
   - Create `04-implementation.yml` issue
   - Reference planning issue
   - Swarm implements and tests feature

## ⚙️ Advanced Configuration

### Custom Phase Definition
```json
{
  "phases": {
    "custom-phase": {
      "agents": ["researcher", "coder"],
      "strategy": "parallel",
      "autoAdvance": false,
      "nextPhase": "implementation"
    }
  }
}
```

### Environment Variables
- `GITHUB_TOKEN` - GitHub Personal Access Token
- `GITHUB_PAT` - Alternative token variable
- `AGENT_TOKEN` - MCP-specific token

### Monitoring Options
```bash
# Run in foreground
node monitor.js

# Run in background
nohup node monitor.js > monitor.log 2>&1 &

# Check status
ps aux | grep monitor.js

# Stop background process
pkill -f monitor.js
```

## 🛠️ Customization for New Projects

### 1. Copy Files
```bash
# Copy workflow integration
cp -r .devcontainer/github-workflow /path/to/new-project/.devcontainer/
cp -r .github/ISSUE_TEMPLATE /path/to/new-project/.github/

# Copy setup script
cp .devcontainer/setup-github-workflow.sh /path/to/new-project/.devcontainer/
```

### 2. Run Setup
```bash
cd /path/to/new-project
bash .devcontainer/setup-github-workflow.sh
```

### 3. Customize (Optional)
- Edit issue templates for project-specific needs
- Modify phase definitions in `config.json`
- Adjust swarm agent assignments
- Customize automation messages

## 🔍 Troubleshooting

### Monitor Not Processing Issues
1. Check GitHub token permissions
2. Verify repository settings in config.json
3. Check monitor logs for errors
4. Ensure ruv-swarm is properly installed

### Swarms Not Triggering
1. Verify ruv-swarm installation: `npx ruv-swarm --version`
2. Check issue labels match phase definitions
3. Review automation.js logs
4. Ensure GitHub API rate limits not exceeded

### Missing Dependencies
```bash
cd .devcontainer/github-workflow
npm install
```

## 📊 Benefits

- **Standardized Process**: Consistent workflow across all projects
- **Automated Intelligence**: ruv-swarm provides expert analysis at each phase
- **Full Documentation**: Every decision tracked in GitHub
- **Scalable**: Handle multiple projects with same workflow
- **Integrated**: Works seamlessly with existing GitHub workflow

## 🚀 Next Steps

1. Create your first idea issue using the template
2. Watch ruv-swarm automatically process and provide insights
3. Advance through the phases as your feature evolves
4. Customize templates and phases for your specific needs
5. Deploy to additional repositories

---

*This GitHub workflow integration turns your repository into an intelligent development environment where every feature follows a structured, documented process with AI assistance at every step.*
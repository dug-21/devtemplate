# GitHub Workflow Integration V3 with MCP & Bot Identity

## 🚀 Overview

This V3 architecture provides comprehensive GitHub automation with advanced MCP server integration, bot identity management, and intelligent file organization. The system monitors GitHub issues and comments, processes them through Claude AI with ruv-swarm coordination, and maintains organized project artifacts.

### Key V3 Enhancements
- **MCP Server Integration** with automatic health monitoring and recovery
- **Bot Identity Management** with separate bot account support
- **Structured File Organization** with issue-specific directories
- **Advanced Comment Detection** with bot filtering and @claude mention handling
- **Robust Error Recovery** with exponential backoff and retry logic
- **Real-time Progress Updates** with comprehensive status tracking

## 📋 Architecture Components

### 1. **Enhanced GitHub Monitor V3** (`monitor-enhanced.js`)
- **Polling System**: Monitors GitHub issues and comments every 60 seconds
- **MCP Health Monitoring**: Automatic ruv-swarm MCP server configuration and recovery
- **Comment Intelligence**: Detects @claude mentions, filters bot comments, prevents loops
- **Rate Limiting**: Built-in protection with automatic delays and backoff
- **Persistent Tracking**: Maintains cache of processed comments to prevent reprocessing

### 2. **Enhanced Automation Engine** (`automation-enhanced.js`)
- **Issue Processing**: Structured workflow from analysis to implementation
- **File Organization**: Automatic creation of issue-specific directories
- **Claude Integration**: Executes Claude CLI with MCP configuration
- **Progress Tracking**: Real-time updates posted to issues
- **Cleanup Management**: Automatic temporary file cleanup and organization

### 3. **Bot Identity System**
- **Dual Identity**: Separate bot account for automation vs. human account
- **Token Hierarchy**: Configurable token priority system
- **Permission Management**: Minimal required permissions for security
- **Visual Distinction**: Clear identification of bot vs. human comments

### 4. **MCP Server Integration**
- **ruv-swarm**: Cognitive coordination and multi-agent processing
- **Health Monitoring**: Automatic connection recovery and metrics tracking
- **Auto-Configuration**: Seamless setup with `claude mcp add ruv-swarm`
- **GitHub MCP**: Optional GitHub API operations through MCP protocol

## 🛠️ Setup Guide

### Prerequisites
```bash
# Required software
- Node.js (v18+)
- npm package manager
- Claude CLI with MCP support
- Git (for repository operations)

# Install dependencies
npm install @octokit/rest
```

### Bot Identity Setup
See detailed guide: **[Bot Identity Setup](BOT_IDENTITY_SETUP.md)**

**Quick Setup:**
1. Create separate GitHub bot account (e.g., `yourname-bot`)
2. Generate Personal Access Token with `repo` scope
3. Add bot account as repository collaborator
4. Configure environment variables:

```bash
# Primary bot token (recommended)
export GITHUB_BOT_TOKEN="ghp_your_bot_token_here"

# Alternative configurations
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_your_personal_token"
export GITHUB_TOKEN="ghp_your_github_token"
```

### MCP Server Configuration
```bash
# Add ruv-swarm MCP server
claude mcp add ruv-swarm npx ruv-swarm mcp start

# Verify MCP server status
claude mcp list
```

### Configuration File
Edit `config-enhanced.json`:
```json
{
  "github": {
    "owner": "your-org",
    "repo": "your-repo",
    "pollInterval": 60000,
    "enabled": true,
    "token": null
  },
  "phases": {
    "idea": {
      "agents": ["researcher", "analyst"],
      "topology": "mesh",
      "strategy": "research"
    },
    "research": {
      "agents": ["researcher", "analyst", "coordinator"],
      "topology": "hierarchical",
      "strategy": "analysis"
    },
    "planning": {
      "agents": ["analyst", "coder", "coordinator"],
      "topology": "hierarchical",
      "strategy": "planning"
    },
    "implementation": {
      "agents": ["coder", "tester", "coordinator"],
      "topology": "star",
      "strategy": "development"
    }
  },
  "automation": {
    "welcomeNewIssues": true,
    "autoLabel": true,
    "postUpdates": true,
    "triggerSwarms": true
  },
  "filtering": {
    "ignoreLabels": ["automation:ignore", "no-automation", "wip"],
    "completionLabel": "swarm-processed",
    "autoCloseLabel": "auto-close-on-complete"
  }
}
```

### Quick Start
```bash
# Start the enhanced monitor
./start-enhanced-monitor.sh

# Or manually start monitor
node monitor-enhanced.js
```

## 📊 How It Works

### Issue Processing Flow
1. **Detection**: Monitor polls GitHub API for new issues/comments
2. **Filtering**: Applies label filters and ignores processed items
3. **MCP Health Check**: Verifies ruv-swarm connection and auto-reconnects
4. **Bot Identity**: Determines bot username and validates permissions
5. **File Organization**: Creates issue-specific directory structure
6. **Claude Processing**: Executes Claude with comprehensive prompts
7. **Progress Updates**: Posts real-time status to GitHub issue
8. **Completion**: Summarizes results and manages labels
9. **Cleanup**: Organizes files and cleans temporary artifacts

### Comment Detection Logic
- **@claude mentions**: Always processed regardless of issue status
- **Directive patterns**: `/command`, `@automation`, `please process`
- **Human follow-ups**: Comments on completed issues trigger responses
- **Bot filtering**: Automatically skips bot comments and AI-generated content
- **Processed tracking**: Maintains cache to prevent reprocessing

### File Organization System
See detailed guide: **[File Organization](FILE-ORGANIZATION.md)**

```
issues/
├── issue-{number}/
│   ├── claude-prompt.txt
│   ├── execution.log
│   ├── metadata.json
│   ├── SUMMARY.md
│   └── [artifacts]/
├── archive/
├── logs/
└── tmp/
```

## 🔧 Phase-Based Processing

### Agent Types and Roles
- **Researcher**: Information gathering and analysis
- **Analyst**: Data processing and requirements analysis
- **Coder**: Implementation and development
- **Tester**: Quality assurance and validation
- **Coordinator**: Workflow orchestration and decision making

### Topology Strategies
- **Mesh**: Collaborative exploration for research phases
- **Hierarchical**: Structured decision-making for planning
- **Star**: Centralized coordination for implementation

### Phase Transitions
Issues progress through phases based on completion criteria:
- **Idea** → **Research**: Requirements analysis complete
- **Research** → **Planning**: Technical feasibility confirmed
- **Planning** → **Implementation**: Architecture approved
- **Implementation** → **Complete**: Solution deployed and tested

## 🏷️ Label System

### Processing Labels
- `swarm-in-progress` - Currently being processed by system
- `swarm-processed` - Processing complete, ready for review
- `completed` - Work finished and verified
- `error` - Processing failed, requires intervention

### Control Labels
- `auto-close-on-complete` - Enable automatic issue closure
- `keep-open` - Prevent automatic closure
- `automation:ignore` - Skip this issue completely
- `needs-human-review` - Requires manual intervention

### Phase Labels
- `phase:idea` - Initial concept or request
- `phase:research` - Under analysis
- `phase:planning` - Architecture and design
- `phase:implementation` - Development in progress

## 🧪 Testing and Verification

### Token Verification
```bash
# Test all configured tokens
node verify-bot-token.js

# Test monitor token selection
node test-monitor-token.js

# Expected output:
# ✅ GITHUB_BOT_TOKEN: @your-bot (User)
# ✅ Selected token: Set
```

### MCP Server Testing
```bash
# Check MCP server status
claude mcp list

# Should show:
# ruv-swarm: npx ruv-swarm mcp start
```

### System Integration Tests
```bash
# Run enhanced monitor tests
node test-enhanced-monitor.js

# Test file organization
node test-file-organization.js

# Test bot identity
node test-identities.js
```

## 🚨 Troubleshooting

### Common Issues

#### 1. **MCP Server Connection**
```bash
# Problem: MCP server not connected
# Solution: Add ruv-swarm MCP server
claude mcp add ruv-swarm npx ruv-swarm mcp start

# Check connection status
claude mcp list
```

#### 2. **Bot Token Issues**
```bash
# Problem: Authentication failed
# Solution: Verify token and bot permissions
node verify-bot-token.js

# Check bot repository access
node verify-bot-access.js
```

#### 3. **File Organization Problems**
```bash
# Problem: Files not organized properly
# Solution: Check directory permissions
ls -la issues/

# Reset file organization
rm -rf issues/issue-*/
```

#### 4. **Comment Detection Issues**
```bash
# Problem: Comments not being processed
# Solution: Check processed comments cache
cat .processed-comments-v3.json

# Reset processed comments
rm .processed-comments-v3.json
```

### Debug Mode
```bash
# Check monitor logs
tail -f logs/monitor-v3.log

# Check automation logs
tail -f automation-enhanced.log

# Reset last check time
rm .last-check-enhanced-v3
```

## 📚 Additional Documentation

### Setup Guides
- **[Bot Identity Setup](BOT_IDENTITY_SETUP.md)** - Complete bot account configuration
- **[Repository Access Guide](BOT_REPO_ACCESS_GUIDE.md)** - Permission management
- **[Machine User Setup](MACHINE-USER-SETUP.md)** - Advanced bot configuration

### System Guides
- **[File Organization](FILE-ORGANIZATION.md)** - Directory structure and cleanup
- **[Flow Analysis](FLOW_ANALYSIS.md)** - Technical implementation details
- **[Workflow System Guide](../WORKFLOW-SYSTEM-GUIDE.md)** - Phase-based processing

### Templates and Examples
- **[Phase Workflow Templates](../PHASE-WORKFLOW-TEMPLATES.md)** - Ready-to-use workflows
- **[Enhanced Workflow Templates](../ENHANCED_WORKFLOW_TEMPLATES.md)** - Advanced examples
- **[GitHub Bot Example](../WORKFLOW-EXAMPLE-GITHUB-BOT.md)** - Practical implementation

## 🎯 Best Practices

### 1. **Bot Identity Management**
- Use separate bot account for clear attribution
- Rotate tokens regularly for security
- Monitor bot permissions and access

### 2. **Issue Processing**
- Use appropriate labels to control automation
- Monitor progress through real-time updates
- Intervene with `keep-open` label when needed

### 3. **File Organization**
- Let system manage issue directories automatically
- Archive completed issues periodically
- Monitor disk space usage

### 4. **MCP Integration**
- Keep ruv-swarm MCP server running
- Monitor connection health in logs
- Update MCP servers regularly

## 🔗 Integration Points

### External Services
- **GitHub API**: Issue and comment monitoring
- **Claude AI**: Processing and implementation
- **ruv-swarm**: Multi-agent coordination
- **MCP Protocol**: Server communication

### Internal Components
- **Monitor**: Real-time GitHub event detection
- **Automation**: Issue processing and execution
- **File Organization**: Structured artifact management
- **Bot Identity**: Authentication and attribution

## 🚀 Performance Characteristics

### Efficiency Features
- **Smart Caching**: Prevents reprocessing of handled items
- **Rate Limiting**: Automatic delays to prevent API throttling
- **Parallel Processing**: Multiple issues handled concurrently
- **Resource Management**: Automatic cleanup of temporary files

### Scalability Considerations
- **Configurable Polling**: Adjustable intervals for different workloads
- **Multi-Repository**: Support for multiple GitHub repositories
- **Load Balancing**: Distributed processing through MCP servers
- **Monitoring**: Comprehensive metrics and logging

## 📈 Monitoring and Metrics

### System Health
- MCP server connection status
- GitHub API rate limit usage
- Processing queue length
- Error rates and recovery times

### Performance Metrics
- Issue processing time
- Comment response latency
- File organization efficiency
- Bot response accuracy

Perfect for automating:
- **Feature Development**: End-to-end feature implementation
- **Bug Resolution**: Systematic bug analysis and fixes
- **Documentation**: Comprehensive documentation generation
- **Code Review**: AI-assisted code review and improvement
- **Research Tasks**: Systematic research and analysis workflows

---

*This V3 system represents a significant evolution from basic monitoring to a comprehensive AI-integrated development workflow platform.*
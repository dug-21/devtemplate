# Enhanced GitHub Automation V2 with ruv-swarm

## 🚀 Overview

This enhanced system provides complete GitHub issue automation with:
- **Real-time progress updates** posted to issues every 30 seconds
- **Automatic issue closure** when work is complete
- **Human comment response** handling
- **Full ruv-swarm coordination** for multi-agent analysis
- **Parallel issue processing** (up to 3 concurrent)

## 📋 Key Features

### 1. Progress Tracking
- Posts updates to GitHub issues as Claude works
- Shows current phase, elapsed time, and completion percentage
- Provides detailed status messages at each stage

### 2. Automatic Issue Management
- Adds appropriate labels during processing
- Auto-closes issues marked with `auto-close-on-complete`
- Respects `keep-open` label to prevent closure
- 60-second warning before auto-closure

### 3. Human Interaction
- Monitors for human comments on bot-processed issues
- Detects questions and requests using pattern matching
- Triggers Claude to respond appropriately

### 4. ruv-swarm Integration
- Uses hierarchical swarm topology with 6 specialized agents
- Stores progress in swarm memory for coordination
- Implements batch operations for efficiency

## 🛠️ Setup

### Prerequisites
```bash
# Install dependencies
npm install @octokit/rest

# Set GitHub token
export AGENT_TOKEN=your_github_personal_access_token
```

### Quick Start
```bash
# Run tests and start monitor
./start-enhanced-v2.sh
```

### Manual Testing
```bash
# Test specific issue
node automation-enhanced-v2.js 6

# Run system tests
node test-enhanced-system.js

# Start monitor
node monitor-enhanced-v2.js
```

## 📊 How It Works

### Issue Processing Flow
1. **Detection**: Monitor detects new issue
2. **Initialization**: Adds `in-progress` and `swarm-active` labels
3. **Analysis**: Claude + ruv-swarm analyze requirements
4. **Progress Updates**: Posts updates every 30 seconds
5. **Implementation**: Claude implements solution
6. **Completion**: Posts summary and handles closure
7. **Cleanup**: Updates final labels

### Progress Update Example
```
🔄 Phase 2/4: Analysis

- ✅ Swarm initialized with 6 agents
- 🔄 Analyzing requirements...
- 🔄 Researching best practices...

Progress: 25%
```

### Auto-Closure Flow
1. Issue completed successfully
2. Check for `auto-close-on-complete` label
3. Post 60-second warning
4. Wait for intervention
5. Close if no `keep-open` label added

## 🏷️ Label System

### Processing Labels
- `in-progress` - Currently being processed
- `swarm-active` - ruv-swarm coordination active
- `swarm-processed` - Processing complete
- `completed` - Work finished

### Control Labels
- `auto-close-on-complete` - Enable auto-closure
- `keep-open` - Prevent auto-closure
- `automation:ignore` - Skip this issue
- `error` - Processing failed
- `needs-human-review` - Requires manual intervention

## 🔧 Configuration

Edit `config.json` to customize:
```json
{
  "github": {
    "owner": "your-org",
    "repo": "your-repo",
    "pollInterval": 300000
  },
  "automation": {
    "postUpdates": true,
    "triggerSwarms": true
  },
  "filtering": {
    "ignoreLabels": ["wip", "draft"],
    "completionLabel": "swarm-processed",
    "autoCloseLabel": "auto-close-on-complete"
  }
}
```

## 🧪 Testing

The test script verifies:
1. Direct GitHub API access
2. Issue retrieval
3. Label management
4. Progress tracking
5. MCP server availability

## 📝 Example Claude Prompt

The system generates comprehensive prompts that instruct Claude to:
1. Post initialization message
2. Set up ruv-swarm with 6 agents
3. Analyze the issue
4. Post progress at each stage
5. Implement the solution
6. Post completion summary

## 🚨 Troubleshooting

### Common Issues
1. **No GitHub token**: Set `AGENT_TOKEN` or `GITHUB_TOKEN`
2. **MCP not found**: Install with `npm install -g @modelcontextprotocol/server-github`
3. **ruv-swarm missing**: Install with `npm install -g ruv-swarm`
4. **Rate limiting**: Reduce `pollInterval` in config

### Debug Mode
```bash
# Check logs
tail -f automation-enhanced.log

# Test specific issue
node automation-enhanced-v2.js 6

# Reset last check time
rm .last-check-enhanced
```

## 🎯 Best Practices

1. **Labels**: Use control labels to manage automation behavior
2. **Progress**: Monitor issue comments for real-time updates
3. **Intervention**: Add `keep-open` label to prevent auto-closure
4. **Scaling**: Process up to 3 issues concurrently

## 🔗 Integration

This system integrates with:
- GitHub Issues API
- Claude with MCP tools
- ruv-swarm for coordination
- Existing monitor infrastructure

Perfect for automating:
- Feature requests
- Bug reports
- Research tasks
- Documentation needs
- Code generation
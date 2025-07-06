#!/bin/bash

# Cleanup script to archive obsolete files
# Based on FILE-USAGE-TRACE.md analysis

ARCHIVE_DIR="archive/pre-cleanup-v3"

echo "🧹 Starting cleanup of obsolete files..."
echo "📁 Archive directory: $ARCHIVE_DIR"

# Old Monitor Versions
echo "Moving old monitor versions..."
mv monitor-enhanced-v2.js monitor-enhanced-v3.js monitor-enhanced.js monitor-coordinator.js monitor-ruv-swarm.js monitor.js $ARCHIVE_DIR/ 2>/dev/null

# Old Automation Versions
echo "Moving old automation versions..."
mv automation-enhanced-v2.js automation-enhanced.js automation-claude-integrated.js automation-coordinator.js automation-interactive.js automation-ruv-swarm.js automation-swarm-enhanced.js automation-task-based.js automation.js $ARCHIVE_DIR/ 2>/dev/null

# Old Start Scripts
echo "Moving old start scripts..."
mv start-enhanced-v2.sh start-enhanced-v3.sh start-enhanced-monitor.sh start-coordinator-monitor.sh start-ruv-swarm-monitor.sh $ARCHIVE_DIR/ 2>/dev/null

# Old Test Files
echo "Moving obsolete test files..."
mv test-enhanced-system.js test-claude-comment.js test-claude-integrated.js test-single-issue.js $ARCHIVE_DIR/ 2>/dev/null

# Cleanup Scripts
echo "Moving one-time cleanup scripts..."
mv cleanup-ruv-swarm.js force-cleanup-ruv-swarm.sh reset-ruv-swarm.sh execute-cleanup.sh cleanup-existing-files.js $ARCHIVE_DIR/ 2>/dev/null

# Demo/Example Files
echo "Moving demo files..."
mv demo-issue-6.js example-issue-flow.md claude-integration-task.md test-prompt.txt claude-github-post.js issue-6-analysis.md $ARCHIVE_DIR/ 2>/dev/null

# Old Config and State
echo "Moving old config files..."
mv config.json .last-check-enhanced test-claude-github-simple.sh $ARCHIVE_DIR/ 2>/dev/null

# Duplicate file organization
echo "Moving duplicate file organization..."
mv file-organization-v3.js $ARCHIVE_DIR/ 2>/dev/null

# Move duplicate MCP monitor (code is in v3-integrated)
echo "Moving duplicate MCP monitor..."
mv mcp-server-monitor.js $ARCHIVE_DIR/ 2>/dev/null

# Move old README files (keep main ones for now)
echo "Moving old README files..."
mv README-COORDINATOR.md README-RUV-SWARM.md $ARCHIVE_DIR/ 2>/dev/null

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Files moved to: $ARCHIVE_DIR"
echo "Active files remain in place"
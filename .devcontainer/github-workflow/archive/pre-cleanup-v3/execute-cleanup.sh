#!/bin/bash

# GitHub Workflow Cleanup Script
# This script removes all broken automation versions, keeping only Enhanced V2

echo "🧹 GitHub Workflow Cleanup Script"
echo "================================="
echo "This will remove all broken automation versions and keep only Enhanced V2"
echo ""

# Confirm before proceeding
read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 1
fi

# Create backup
echo "📦 Creating backup..."
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" .
echo "✅ Backup created: $BACKUP_FILE"
echo ""

# Remove broken automation files
echo "🗑️  Removing broken automation versions..."
rm -f automation.js automation-coordinator.js automation-ruv-swarm.js
rm -f automation-enhanced.js automation-interactive.js
rm -f automation-swarm-enhanced.js automation-task-based.js
rm -f automation-claude-integrated.js
echo "  ✓ Removed 8 broken automation scripts"

# Remove broken monitor versions
rm -f monitor.js monitor-coordinator.js monitor-ruv-swarm.js monitor-enhanced.js
echo "  ✓ Removed 4 broken monitor scripts"

# Remove unused scripts
rm -f claude-github-post.js demo-issue-6.js
rm -f test-claude-comment.js test-claude-integrated.js test-single-issue.js
rm -f test-claude-github-simple.sh cleanup-ruv-swarm.js
echo "  ✓ Removed 7 unused scripts"

# Remove startup scripts for broken versions
rm -f start-coordinator-monitor.sh start-enhanced-monitor.sh start-ruv-swarm-monitor.sh
echo "  ✓ Removed 3 obsolete startup scripts"
echo ""

# Remove outdated documentation
echo "📄 Removing outdated documentation..."
rm -f README.md README-COORDINATOR.md README-RUV-SWARM.md README-ENHANCED.md
rm -f CLAUDE.md SOLUTION-SUMMARY.md claude-integration-task.md
rm -f example-issue-flow.md issue-6-analysis.md
rm -f ai-customer-discovery-*.md
echo "  ✓ Removed 12 outdated documentation files"
echo ""

# Remove unused scripts & configs
echo "⚙️  Removing unused scripts and configs..."
rm -f config-enhanced.json mcp-config-5.json
rm -f reset-last-check.sh reset-ruv-swarm.sh force-cleanup-ruv-swarm.sh
echo "  ✓ Removed 10 unused scripts and configs"
echo ""

# Remove temporary files & logs
echo "🧹 Removing temporary files and logs..."
rm -f prompt-*.txt test-prompt.txt
rm -f *.log
echo "  ✓ Removed temporary files and logs"
echo ""

# Remove unrelated project
if [ -d "micromentor" ]; then
    echo "📦 Removing unrelated micromentor project..."
    rm -rf micromentor/
    echo "  ✓ Removed micromentor directory"
    echo ""
fi

# Summary
echo "✅ Cleanup Complete!"
echo "==================="
echo ""
echo "📊 Remaining Enhanced V2 files:"
echo "  - automation-enhanced-v2.js (main automation)"
echo "  - monitor-enhanced-v2.js (issue monitor)"
echo "  - test-enhanced-system.js (test suite)"
echo "  - start-enhanced-v2.sh (startup script)"
echo "  - config.json (configuration)"
echo "  - README-ENHANCED-V2.md (documentation)"
echo "  - CLEANUP-REPORT.md (this cleanup report)"
echo "  - execute-cleanup.sh (this script)"
echo "  + Supporting files (package.json, logs/, node_modules/, etc.)"
echo ""
echo "📋 Next steps:"
echo "  1. Review remaining files: ls -la"
echo "  2. Test the system: node test-enhanced-system.js"
echo "  3. Start monitor: ./start-enhanced-v2.sh"
echo "  4. Commit changes: git add -A && git commit -m 'Clean up github-workflow directory'"
echo ""
echo "💾 Backup saved as: $BACKUP_FILE"
echo "   To restore: tar -xzf $BACKUP_FILE"
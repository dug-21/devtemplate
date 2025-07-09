# MCP Server Monitor Documentation

## Overview

The MCP Server Monitor is a specialized monitoring solution designed to address the ruv-swarm MCP server disconnection issues experienced with Claude Code. This monitor automatically detects when the MCP server becomes unresponsive and attempts to reconnect it, ensuring continuous operation of the github-workflow system.

## Problem Statement

The ruv-swarm MCP server works correctly initially but disconnects from Claude after 1-2 uses or approximately 3 minutes of inactivity. This causes the github-workflow system to stop responding as it relies on the MCP server for swarm coordination.

## Solution Architecture

### Components

1. **MCPServerMonitor** (`mcp-server-monitor.js`)
   - Core monitoring module that handles health checks and reconnection logic
   - Implements exponential backoff for reconnection attempts
   - Provides event-based notifications for connection state changes
   - Collects metrics on disconnections and uptime

2. **EnhancedGitHubMonitorV3WithMCP** (`monitor-enhanced-v3-mcp.js`)
   - Extends the base GitHub monitor with MCP monitoring capabilities
   - Integrates MCP health checks into the regular monitoring cycle
   - Creates GitHub issues for critical MCP failures
   - Maintains MCP status logs and metrics

3. **Startup Script** (`start-monitor-with-mcp.sh`)
   - Ensures clean startup by killing existing processes
   - Sets required environment variables
   - Provides user-friendly logging and error handling

4. **Test Suite** (`test-mcp-monitor.js`)
   - Comprehensive tests for connection detection
   - Disconnection handling verification
   - Auto-reconnection testing
   - Metrics collection validation

## Features

### Health Monitoring
- Periodic health checks every 30 seconds (configurable)
- Multiple health check methods:
  - Direct MCP server status check
  - Claude Code connection verification
  - Response time monitoring

### Auto-Reconnection
- Automatic detection of disconnections
- Configurable reconnection attempts (default: 5)
- Exponential backoff to prevent overwhelming the system
- Clean process termination and restart

### Logging and Metrics
- Detailed logging to `logs/mcp-monitor.log`
- Real-time status in `logs/mcp-status.json`
- Metrics tracking:
  - Total disconnections
  - Total successful reconnections
  - Uptime statistics
  - Last health check timestamp

### Alerting
- Event-based notifications for connection state changes
- Automatic GitHub issue creation for critical failures
- Prevention of duplicate issue creation (1-hour cooldown)

## Configuration

### Monitor Configuration
```javascript
{
    checkInterval: 30000,        // Health check interval (ms)
    reconnectDelay: 5000,        // Initial reconnect delay (ms)
    maxReconnectAttempts: 5,     // Maximum reconnection attempts
    healthCheckTimeout: 10000    // Health check timeout (ms)
}
```

### Environment Variables
```bash
RUV_SWARM_HOOKS_ENABLED=false
RUV_SWARM_TELEMETRY_ENABLED=true
RUV_SWARM_REMOTE_READY=true
RUV_SWARM_AUTO_RECONNECT=true
```

## Usage

### Starting the Monitor

```bash
# Navigate to the issue directory
cd /workspaces/devtemplate/.devcontainer/github-workflow/issues/issue-9

# Run the startup script
./start-monitor-with-mcp.sh
```

### Running Tests

```bash
# Run the test suite
node test-mcp-monitor.js
```

### Standalone MCP Monitor

```bash
# Run just the MCP monitor
node mcp-server-monitor.js
```

## How It Works

1. **Initialization**
   - Monitor starts and checks if MCP server is running
   - If not running, starts the MCP server
   - Sets up periodic health checks

2. **Health Monitoring**
   - Every 30 seconds, performs health check
   - Verifies server responsiveness and connection
   - Updates metrics and status

3. **Disconnection Detection**
   - If health check fails, marks server as unhealthy
   - Emits 'disconnected' event
   - Logs disconnection with timestamp

4. **Auto-Reconnection**
   - Kills existing MCP process
   - Waits for reconnect delay (exponential backoff)
   - Attempts to restart MCP server
   - Verifies successful restart

5. **Failure Escalation**
   - After max attempts, emits 'max-reconnects-reached'
   - Creates GitHub issue for manual intervention
   - Continues monitoring (will retry if manually fixed)

## Troubleshooting

### Common Issues

1. **MCP Server Won't Start**
   - Check if port is already in use
   - Verify ruv-swarm is installed: `npx ruv-swarm --version`
   - Check system resources (memory, CPU)

2. **Frequent Disconnections**
   - Increase health check interval if system is under load
   - Check network stability
   - Review MCP server logs for errors

3. **Monitor Not Detecting Disconnections**
   - Verify health check command is working
   - Check log files for errors
   - Ensure proper permissions for process management

### Log Files

- **MCP Monitor Log**: `logs/mcp-monitor.log`
  - Contains all monitor activities and errors
  - Health check results
  - Connection/disconnection events

- **MCP Status**: `logs/mcp-status.json`
  - Current connection status
  - Latest metrics
  - Health check history

### Manual Recovery

If automatic recovery fails:

1. Stop the monitor: `Ctrl+C`
2. Kill any stuck processes: `pkill -f "ruv-swarm mcp"`
3. Clear temporary files: `rm .mcp-issue-created`
4. Restart the monitor: `./start-monitor-with-mcp.sh`

## Integration with GitHub Workflow

The MCP monitor integrates seamlessly with the enhanced GitHub workflow:

1. Runs alongside issue monitoring
2. Ensures MCP server availability for swarm operations
3. Reports status through GitHub issues when critical
4. Maintains separate logs for debugging

## Future Improvements

1. **Connection Pool**: Implement connection pooling for better reliability
2. **Advanced Metrics**: Add performance metrics and trending
3. **Configuration UI**: Web interface for monitoring configuration
4. **Multi-Server Support**: Monitor multiple MCP servers
5. **Custom Health Checks**: Pluggable health check strategies

## Support

For issues or questions:
1. Check the log files in `logs/`
2. Review created GitHub issues with label `mcp-monitor`
3. Run the test suite to verify functionality
4. Enable debug logging by modifying log level in code
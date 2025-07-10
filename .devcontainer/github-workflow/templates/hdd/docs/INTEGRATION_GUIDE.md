# HDD Integration Guide

This guide explains how to integrate the Hypothesis-Driven Development (HDD) templates and workflows with the existing github-workflow automation system.

## Integration Overview

The HDD system is designed to extend, not replace, the existing github-workflow automation. It adds new capabilities while leveraging the existing infrastructure.

## Key Integration Points

### 1. Configuration Integration

The HDD configuration (`config/hdd-config.yml`) extends the existing `config-enhanced.json`:

```javascript
// In your automation-enhanced.js
const loadHDDConfig = () => {
  const baseConfig = require('./config-enhanced.json');
  const hddConfig = yaml.load(fs.readFileSync('./templates/hdd/config/hdd-config.yml'));
  
  // Merge HDD phases with existing phases
  return {
    ...baseConfig,
    phases: {
      ...baseConfig.phases,
      ...hddConfig.hdd.phases
    },
    hdd: hddConfig.hdd
  };
};
```

### 2. Label Detection Enhancement

Extend the existing label detection in `monitor-enhanced.js`:

```javascript
// Add HDD label patterns
const HDDLabels = {
  phases: ['phase:hypothesis', 'phase:prototype', 'phase:validation', 'phase:evolution'],
  status: ['hdd:active', 'validation:passed', 'validation:failed', 'hdd:pivoted'],
  tracking: ['hdd:metrics']
};

// In checkForNewIssues()
const isHDDIssue = issue.labels.some(l => 
  HDDLabels.phases.includes(l.name) || 
  l.name === 'hdd:active'
);

if (isHDDIssue) {
  // Route to HDD-specific processing
  await this.processHDDIssue(issue);
}
```

### 3. File Organization Extension

Extend `file-organization.js` to handle HDD artifacts:

```javascript
class HDDFileOrganization extends FileOrganization {
  async createHDDStructure(issueNumber, phase) {
    const baseDir = await this.createIssueDirectory(issueNumber);
    
    // Create phase-specific subdirectories
    const phaseDirs = {
      hypothesis: ['hypothesis', 'research', 'assumptions'],
      prototype: ['prototypes/v1', 'prototypes/v2', 'prototypes/v3', 'prototypes/comparison'],
      validation: ['validation/tests', 'validation/results', 'validation/reports'],
      evolution: ['evolution/metrics', 'evolution/optimizations', 'evolution/learnings']
    };
    
    for (const dir of phaseDirs[phase] || []) {
      await fs.mkdir(path.join(baseDir, dir), { recursive: true });
    }
    
    return baseDir;
  }
  
  async trackHypothesis(issueNumber, hypothesis) {
    const hypothesisPath = path.join(
      await this.getIssueDirectory(issueNumber),
      'hypothesis',
      'statement.md'
    );
    await fs.writeFile(hypothesisPath, hypothesis);
  }
  
  async trackValidationResults(issueNumber, results) {
    const resultsPath = path.join(
      await this.getIssueDirectory(issueNumber),
      'validation',
      'results',
      `results-${Date.now()}.json`
    );
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  }
}
```

### 4. AI Attribution Integration

Extend `ai-attribution.js` to track HDD-specific activities:

```javascript
// Add HDD activity types
const HDDActivities = {
  HYPOTHESIS_FORMULATION: 'hdd:hypothesis:formulated',
  PROTOTYPE_CREATED: 'hdd:prototype:created',
  VALIDATION_EXECUTED: 'hdd:validation:executed',
  LEARNING_CAPTURED: 'hdd:learning:captured'
};

// In enhanced-github-client.js
async createHDDComment(issueNumber, phase, content) {
  const attribution = `🔬 **HDD ${phase} Phase**\n\n${content}`;
  return this.createAttributedComment(issueNumber, attribution, {
    activity: `hdd:${phase}`,
    model: 'claude-3',
    timestamp: new Date().toISOString()
  });
}
```

### 5. Swarm Agent Integration

Configure swarm agents for HDD phases:

```javascript
// In automation-enhanced.js
const HDDAgentConfigs = {
  hypothesis: {
    agents: ['researcher', 'analyst', 'architect'],
    prompts: {
      researcher: 'Research similar solutions and market analysis for: ',
      analyst: 'Analyze risks and feasibility for hypothesis: ',
      architect: 'Design technical approaches for: '
    }
  },
  prototype: {
    agents: ['builder', 'tester', 'optimizer'],
    parallel: true,
    prompts: {
      builder: 'Create prototype implementation for approach: ',
      tester: 'Design test scenarios for prototype: ',
      optimizer: 'Optimize performance for: '
    }
  }
};
```

### 6. Webhook Integration

Add HDD-specific webhook handlers:

```javascript
// Handle HDD commands in comments
const HDDCommands = {
  '/advance-phase': async (issue, comment) => {
    // Trigger phase transition workflow
    await github.actions.createWorkflowDispatch({
      workflow_id: 'hdd-phase-transition.yml',
      inputs: {
        issue_number: issue.number,
        target_phase: 'auto'
      }
    });
  },
  '/run-validation': async (issue, comment) => {
    // Trigger validation workflow
    await github.actions.createWorkflowDispatch({
      workflow_id: 'hdd-validation-checks.yml',
      inputs: {
        issue_number: issue.number
      }
    });
  }
};
```

### 7. Metrics Integration

Integrate HDD metrics with existing monitoring:

```javascript
// Extend metrics collection
class HDDMetrics {
  async collectPhaseMetrics(issue) {
    const timeline = await this.getIssueTimeline(issue.number);
    const phaseTransitions = timeline.filter(e => 
      e.event === 'labeled' && 
      e.label.name.startsWith('phase:')
    );
    
    return {
      phases: this.calculatePhaseDurations(phaseTransitions),
      cycleTime: this.calculateCycleTime(issue),
      outcome: this.determineOutcome(issue.labels)
    };
  }
  
  async updateMetricsDashboard(metrics) {
    // Integrate with existing dashboard
    const dashboard = await this.loadDashboard();
    dashboard.hdd = {
      ...dashboard.hdd,
      ...metrics
    };
    await this.saveDashboard(dashboard);
  }
}
```

## Migration Strategy

### Phase 1: Parallel Operation (Week 1-2)
1. Install HDD templates alongside existing system
2. Run both systems in parallel
3. Compare results and refine integration

### Phase 2: Selective Migration (Week 3-4)
1. Route specific issue types to HDD workflow
2. Use label-based routing
3. Maintain fallback to original system

### Phase 3: Full Integration (Month 2)
1. Merge HDD features into main workflow
2. Deprecate redundant features
3. Update documentation

## Configuration Examples

### Example 1: Enabling HDD for Specific Repositories

```json
{
  "github": {
    "repositories": {
      "experimental-repo": {
        "hdd": {
          "enabled": true,
          "defaultPhase": "hypothesis"
        }
      },
      "production-repo": {
        "hdd": {
          "enabled": false
        }
      }
    }
  }
}
```

### Example 2: Custom Phase Mapping

```yaml
hdd:
  phaseMapping:
    # Map existing labels to HDD phases
    "research": "hypothesis"
    "development": "prototype"
    "testing": "validation"
    "maintenance": "evolution"
```

### Example 3: AI Agent Override

```yaml
hdd:
  phases:
    hypothesis:
      agents:
        # Use custom agent configuration
        researcher:
          model: "gpt-4"
          temperature: 0.7
          maxTokens: 2000
```

## Troubleshooting

### Common Integration Issues

1. **Label Conflicts**
   - Solution: Use namespaced labels (e.g., `hdd:phase:hypothesis`)

2. **Workflow Permissions**
   - Solution: Ensure workflows have write permissions for issues

3. **File Organization Conflicts**
   - Solution: Use separate directories for HDD artifacts

4. **Agent Coordination Issues**
   - Solution: Implement proper locking mechanisms

## Best Practices

1. **Start Small**: Begin with one repository or project
2. **Monitor Closely**: Track metrics during integration
3. **Iterate Quickly**: Adjust based on early results
4. **Document Changes**: Keep integration decisions documented
5. **Train Team**: Ensure everyone understands both systems

## API Reference

### HDD Extension Methods

```javascript
// Issue processing
processHDDIssue(issue)
advanceHDDPhase(issueNumber, targetPhase)
validateHypothesis(issueNumber)

// File management
createHDDStructure(issueNumber, phase)
trackHDDartifact(issueNumber, type, content)

// Metrics
collectHDDMetrics(issueNumber)
generateHDDReport(timeframe)

// Learning
captureLearning(issueNumber)
updateLearningLibrary(insights)
```

## Support

For integration support:
1. Check existing github-workflow documentation
2. Review HDD templates README
3. Open an issue with the `hdd:integration` label
# Hypothesis-Driven Development (HDD) Templates & Workflows

This directory contains a complete implementation of Hypothesis-Driven Development (HDD) for GitHub-based projects, integrated with the existing github-workflow automation system.

## 🚀 Quick Start

1. **Copy templates to your project**:
   ```bash
   # Copy issue templates
   cp -r templates/hdd/issue-templates/* .github/ISSUE_TEMPLATE/
   
   # Copy workflow files
   cp -r templates/hdd/workflows/* .github/workflows/
   ```

2. **Configure your repository**:
   - Enable GitHub Actions
   - Add required labels: `phase:hypothesis`, `phase:prototype`, `phase:validation`, `phase:evolution`, `hdd:active`

3. **Start your first HDD cycle**:
   - Create a new issue using the "HDD: Hypothesis Discovery" template
   - Follow the guided process through each phase

## 📁 Directory Structure

```
templates/hdd/
├── issue-templates/        # GitHub issue templates for each HDD phase
│   ├── hypothesis-discovery.yml
│   ├── prototype-sprint.yml
│   ├── validation-phase.yml
│   └── evolution-tracking.yml
├── workflows/             # GitHub Actions workflows
│   ├── hdd-phase-transition.yml
│   ├── hdd-validation-checks.yml
│   ├── hdd-metrics-collection.yml
│   └── hdd-learning-capture.yml
├── config/               # Configuration files
│   └── hdd-config.yml
├── docs/                 # Additional documentation
│   ├── INTEGRATION_GUIDE.md
│   ├── MOCK_PROTOTYPE_GUIDE.md
│   └── IMPLEMENTATION_SUMMARY.md
└── README.md            # This file
```

## 📋 HDD Phases

### 1. Discovery Phase (1-2 days)
- **Template**: `hypothesis-discovery.yml`
- **Purpose**: Formulate clear, testable hypotheses
- **Key Activities**:
  - Define hypothesis statement
  - Identify assumptions
  - Set success metrics
  - Plan discovery research

### 2. Prototype Sprint (3-5 days)
- **Templates**: 
  - `prototype-sprint.yml` - Original full-build approach
  - `prototype-sprint-enhanced.yml` - Two-stage mock-first approach (recommended)
- **Purpose**: Build multiple approaches rapidly
- **Key Activities**:
  - Stage 1: Create 3+ lightweight mock prototypes (1-2 days)
  - Stage 2: Build only the selected approach (2-3 days)
  - Compare against criteria
  - Reduce cost by 67% using mocks first

### 3. Validation Phase (2-3 days)
- **Template**: `validation-phase.yml`
- **Purpose**: Test hypothesis against success metrics
- **Key Activities**:
  - Execute comprehensive tests
  - Measure actual vs. target metrics
  - Make go/no-go decision
  - Document results

### 4. Evolution Phase (Ongoing)
- **Template**: `evolution-tracking.yml`
- **Purpose**: Monitor and optimize in production
- **Key Activities**:
  - Track performance metrics
  - Run optimization experiments
  - Capture learnings
  - Share knowledge

## 🔄 Workflow Features

### Automated Phase Transitions
- Use `/advance-phase` command in issue comments
- Validates exit criteria before advancing
- Checks for required artifacts
- Updates labels automatically

### Validation Automation
- Run tests with `/run-validation` command
- Automated daily checks for validation phase issues
- Performance, load, functional, and lighthouse testing
- Results posted as issue comments

### Metrics Collection
- Weekly automated metrics reports
- Visual dashboards generated
- Success rate tracking
- Phase duration analysis

### Learning Capture
- Automatic extraction when issues close
- Pattern analysis across cycles
- Learning library maintenance
- Recommendations generation

## 🏷️ Required Labels

Create these labels in your repository:

| Label | Color | Description |
|-------|-------|-------------|
| `phase:hypothesis` | #1D76DB | Discovery phase |
| `phase:prototype` | #5319E7 | Prototype sprint phase |
| `phase:validation` | #0E8A16 | Validation phase |
| `phase:evolution` | #FEF2C0 | Evolution/monitoring phase |
| `hdd:active` | #B60205 | Active HDD cycle |
| `validation:passed` | #0E8A16 | Validation successful |
| `validation:failed` | #D93F0B | Validation failed |
| `hdd:pivoted` | #FBCA04 | Hypothesis pivoted |
| `hdd:metrics` | #C5DEF5 | Metrics tracking |

## 🤖 AI Agent Integration

The templates include integration points for AI agents:

### Discovery Phase Agents
- **Researcher**: Market analysis and prior art
- **Analyst**: Risk assessment and feasibility
- **Architect**: Technical approach options

### Prototype Phase Agents
- **Builder**: Rapid implementation
- **Tester**: Test scenario creation
- **Optimizer**: Performance tuning

### Validation Phase Agents
- **QA Agent**: Comprehensive testing
- **Analyst**: Results interpretation
- **Documentation**: Findings summary

### Evolution Phase Agents
- **Monitor**: Performance tracking
- **Optimizer**: Improvement suggestions
- **Refactor**: Code quality maintenance

## 📊 Metrics Tracked

- **Cycle Time**: Total time from hypothesis to validation
- **Phase Durations**: Time spent in each phase
- **Success Rate**: Percentage of validated hypotheses
- **Pivot Rate**: How often hypotheses need adjustment
- **Learning Velocity**: Insights captured per cycle

## 🛠️ Customization

### Adjusting Phase Durations
Edit the timeline options in each issue template:
```yaml
options:
  - 1-2 days
  - 3-4 days
  - 1 week
```

### Adding Custom Metrics
Modify the validation template success metrics section to include your specific KPIs.

### Extending Workflows
Add new steps to the workflow files for additional automation:
- Custom notifications
- Integration with other tools
- Additional validation types

## 📚 Learning System

The HDD templates include a comprehensive learning capture system:

1. **Automatic Learning Extraction**: When issues close, learnings are extracted
2. **Pattern Analysis**: Common themes identified across cycles
3. **Learning Library**: Searchable repository of insights
4. **Recommendations**: Based on historical patterns

## 🚦 Getting Started Checklist

- [ ] Copy templates to `.github/` directory
- [ ] Create required labels
- [ ] Configure repository settings
- [ ] Test workflow permissions
- [ ] Create first hypothesis issue
- [ ] Brief team on HDD process
- [ ] Set up metrics tracking issue

## 📖 Additional Resources

- [HDD Methodology Details](../../issues/issue-26/METHODOLOGY_DETAILS.md)
- [Practical Examples](../../issues/issue-26/PRACTICAL_EXAMPLES.md)
- [Transition Guide](../../issues/issue-26/TRANSITION_GUIDE.md)
- [Mock Prototype Guide](docs/MOCK_PROTOTYPE_GUIDE.md) - Save 67% time and cost

## 🤝 Contributing

To improve these templates:
1. Test changes in your repository
2. Document any customizations
3. Share learnings with the team
4. Submit improvements as PRs

---

*These templates implement Hypothesis-Driven Development as researched in Issue #26*
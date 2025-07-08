#!/bin/bash

# Spawn all 15 agents for the GitHub Workflow Automation implementation

echo "🚀 Spawning 15 specialized agents for GitHub Workflow Automation implementation..."

# Architecture & Design Team
ruv-swarm spawn architect "SPARC Architect"
ruv-swarm spawn architect "Systems Designer"  
ruv-swarm spawn architect "Integration Architect"

# Development Team
ruv-swarm spawn tester "Test Engineer"
ruv-swarm spawn coder "Actions Developer"
ruv-swarm spawn coder "Core Developer"
ruv-swarm spawn coder "Automation Developer"
ruv-swarm spawn coder "AI Integration Developer"

# Quality & Operations Team
ruv-swarm spawn analyst "Quality Analyst"
ruv-swarm spawn coder "DevOps Engineer"
ruv-swarm spawn analyst "Security Engineer"
ruv-swarm spawn researcher "Documentation Engineer"

# Coordination & Review Team
ruv-swarm spawn coordinator "Project Coordinator"
ruv-swarm spawn analyst "Requirements Analyst"
ruv-swarm spawn analyst "Technical Reviewer"

echo "✅ All 15 agents spawned successfully!"
echo "🐝 Swarm is ready for orchestration"
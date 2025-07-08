# API Reference

This document provides comprehensive API documentation for the GitHub workflow automation system.

## Table of Contents

1. [Library APIs](#library-apis)
   - [github-client](#github-client)
   - [ruv-swarm-client](#ruv-swarm-client)
   - [claude-client](#claude-client)
   - [phase-manager](#phase-manager)
   - [template-engine](#template-engine)
2. [Action Scripts APIs](#action-scripts-apis)
   - [process-issue](#process-issue)
   - [process-comment](#process-comment)
   - [validate-phase-transition](#validate-phase-transition)
   - [update-phase](#update-phase)
   - [manual-trigger](#manual-trigger)
3. [Webhook Payloads](#webhook-payloads)
   - [GitHub Webhook Formats](#github-webhook-formats)
   - [Custom Event Formats](#custom-event-formats)
4. [Response Formats](#response-formats)
   - [Success Responses](#success-responses)
   - [Error Responses](#error-responses)
   - [Status Codes](#status-codes)
5. [Integration APIs](#integration-apis)
   - [MCP Protocol](#mcp-protocol)
   - [Claude CLI Interface](#claude-cli-interface)

---

## Library APIs

### github-client

The GitHub client library provides methods for interacting with GitHub's REST and GraphQL APIs.

#### Constructor

```javascript
constructor(options: GitHubClientOptions)
```

**Parameters:**
- `options`: Object
  - `token`: string - GitHub personal access token or app token
  - `owner`: string - Repository owner
  - `repo`: string - Repository name
  - `apiUrl?`: string - GitHub API URL (default: 'https://api.github.com')

**Example:**
```javascript
const client = new GitHubClient({
  token: process.env.GITHUB_TOKEN,
  owner: 'myorg',
  repo: 'myrepo'
});
```

#### Methods

##### getIssue
```javascript
async getIssue(issueNumber: number): Promise<Issue>
```

**Parameters:**
- `issueNumber`: number - Issue number

**Returns:** Issue object containing:
- `number`: number
- `title`: string
- `body`: string
- `state`: 'open' | 'closed'
- `labels`: Label[]
- `assignees`: User[]
- `created_at`: string
- `updated_at`: string

**Example:**
```javascript
const issue = await client.getIssue(123);
console.log(issue.title);
```

##### createComment
```javascript
async createComment(issueNumber: number, body: string): Promise<Comment>
```

**Parameters:**
- `issueNumber`: number - Issue number
- `body`: string - Comment body (markdown supported)

**Returns:** Comment object containing:
- `id`: number
- `body`: string
- `user`: User
- `created_at`: string
- `updated_at`: string

**Example:**
```javascript
const comment = await client.createComment(123, 'Processing request...');
```

##### updateIssueLabels
```javascript
async updateIssueLabels(issueNumber: number, labels: string[]): Promise<Issue>
```

**Parameters:**
- `issueNumber`: number - Issue number
- `labels`: string[] - Array of label names

**Returns:** Updated Issue object

**Example:**
```javascript
await client.updateIssueLabels(123, ['phase:research', 'priority:high']);
```

##### createPullRequest
```javascript
async createPullRequest(options: PROptions): Promise<PullRequest>
```

**Parameters:**
- `options`: Object
  - `title`: string - PR title
  - `body`: string - PR body
  - `head`: string - Head branch
  - `base`: string - Base branch (default: 'main')
  - `draft?`: boolean - Create as draft (default: false)

**Returns:** PullRequest object

**Example:**
```javascript
const pr = await client.createPullRequest({
  title: 'Implement feature X',
  body: 'This PR implements...',
  head: 'feature-x',
  base: 'main'
});
```

---

### ruv-swarm-client

The RUV Swarm client manages agent execution and coordination.

#### Constructor

```javascript
constructor(config: RuvSwarmConfig)
```

**Parameters:**
- `config`: Object
  - `apiKey`: string - RUV Swarm API key
  - `baseUrl?`: string - API base URL
  - `timeout?`: number - Request timeout in ms (default: 30000)

#### Methods

##### executeAgent
```javascript
async executeAgent(agentId: string, context: AgentContext): Promise<AgentResult>
```

**Parameters:**
- `agentId`: string - Agent identifier
- `context`: Object
  - `issue`: Issue - GitHub issue object
  - `phase`: string - Current phase
  - `parameters`: Record<string, any> - Agent-specific parameters

**Returns:** AgentResult object:
- `success`: boolean
- `output`: any - Agent output
- `logs`: string[]
- `duration`: number - Execution time in ms

**Example:**
```javascript
const result = await swarm.executeAgent('research-agent', {
  issue: issueData,
  phase: 'research',
  parameters: { depth: 'comprehensive' }
});
```

##### runSwarm
```javascript
async runSwarm(swarmConfig: SwarmConfig): Promise<SwarmResult>
```

**Parameters:**
- `swarmConfig`: Object
  - `agents`: AgentDefinition[] - Array of agent configurations
  - `coordination`: 'sequential' | 'parallel' | 'orchestrated'
  - `context`: AgentContext

**Returns:** SwarmResult object:
- `results`: AgentResult[]
- `summary`: SwarmSummary
- `errors`: Error[]

---

### claude-client

The Claude client provides integration with Claude AI for processing and analysis.

#### Constructor

```javascript
constructor(apiKey: string, options?: ClaudeOptions)
```

**Parameters:**
- `apiKey`: string - Claude API key
- `options?`: Object
  - `model`: string - Model to use (default: 'claude-3-opus-20240229')
  - `maxTokens`: number - Max tokens (default: 4096)
  - `temperature`: number - Temperature (default: 0.7)

#### Methods

##### analyzeIssue
```javascript
async analyzeIssue(issue: Issue): Promise<IssueAnalysis>
```

**Parameters:**
- `issue`: Issue - GitHub issue object

**Returns:** IssueAnalysis object:
- `summary`: string - Issue summary
- `complexity`: 'low' | 'medium' | 'high'
- `estimatedEffort`: number - Hours estimate
- `suggestedPhases`: string[]
- `requirements`: Requirement[]

**Example:**
```javascript
const analysis = await claude.analyzeIssue(issue);
console.log(`Complexity: ${analysis.complexity}`);
```

##### generateCode
```javascript
async generateCode(prompt: string, context?: CodeContext): Promise<GeneratedCode>
```

**Parameters:**
- `prompt`: string - Code generation prompt
- `context?`: Object
  - `language`: string
  - `framework`: string
  - `dependencies`: string[]
  - `existingCode`: string

**Returns:** GeneratedCode object:
- `code`: string
- `language`: string
- `explanation`: string
- `tests`: string[]

---

### phase-manager

The phase manager handles workflow phase transitions and validations.

#### Constructor

```javascript
constructor(config?: PhaseConfig)
```

**Parameters:**
- `config?`: Object
  - `phases`: Phase[] - Custom phase definitions
  - `transitions`: Transition[] - Custom transition rules

#### Methods

##### getCurrentPhase
```javascript
getCurrentPhase(labels: string[]): string | null
```

**Parameters:**
- `labels`: string[] - Issue labels

**Returns:** Current phase name or null

**Example:**
```javascript
const phase = phaseManager.getCurrentPhase(['phase:research', 'bug']);
// Returns: 'research'
```

##### validateTransition
```javascript
validateTransition(from: string, to: string, context?: TransitionContext): ValidationResult
```

**Parameters:**
- `from`: string - Source phase
- `to`: string - Target phase
- `context?`: Object
  - `issue`: Issue
  - `user`: User
  - `reason`: string

**Returns:** ValidationResult object:
- `valid`: boolean
- `errors`: string[]
- `warnings`: string[]

##### getNextPhases
```javascript
getNextPhases(currentPhase: string): Phase[]
```

**Parameters:**
- `currentPhase`: string - Current phase name

**Returns:** Array of valid next phases

---

### template-engine

The template engine processes and renders templates for comments and documents.

#### Constructor

```javascript
constructor(options?: TemplateOptions)
```

**Parameters:**
- `options?`: Object
  - `templateDir`: string - Template directory path
  - `cache`: boolean - Enable template caching (default: true)

#### Methods

##### render
```javascript
async render(templateName: string, data: any): Promise<string>
```

**Parameters:**
- `templateName`: string - Template file name
- `data`: any - Template data

**Returns:** Rendered template string

**Example:**
```javascript
const comment = await engine.render('phase-transition.md', {
  issue: issue,
  fromPhase: 'research',
  toPhase: 'design',
  summary: 'Research completed successfully'
});
```

##### registerHelper
```javascript
registerHelper(name: string, helper: HelperFunction): void
```

**Parameters:**
- `name`: string - Helper name
- `helper`: Function - Helper function

**Example:**
```javascript
engine.registerHelper('formatDate', (date) => {
  return new Date(date).toLocaleDateString();
});
```

---

## Action Scripts APIs

### process-issue

Processes new GitHub issues and initializes workflow.

#### Command Line Usage

```bash
node scripts/process-issue.js --issue-number=123 [options]
```

**Options:**
- `--issue-number`: Required. Issue number to process
- `--dry-run`: Optional. Run without making changes
- `--config`: Optional. Path to config file

#### Programmatic Usage

```javascript
const { processIssue } = require('./scripts/process-issue');

const result = await processIssue({
  issueNumber: 123,
  dryRun: false,
  config: './config.json'
});
```

**Parameters:**
- `options`: Object
  - `issueNumber`: number - Issue to process
  - `dryRun?`: boolean - Dry run mode
  - `config?`: string - Config file path

**Returns:** ProcessResult object:
- `success`: boolean
- `phase`: string - Assigned phase
- `actions`: string[] - Actions taken
- `errors`: Error[]

---

### process-comment

Processes issue comments and triggers appropriate actions.

#### Command Line Usage

```bash
node scripts/process-comment.js --issue-number=123 --comment-id=456 [options]
```

**Options:**
- `--issue-number`: Required. Issue number
- `--comment-id`: Required. Comment ID
- `--webhook-payload`: Optional. Full webhook payload (JSON)

#### Programmatic Usage

```javascript
const { processComment } = require('./scripts/process-comment');

const result = await processComment({
  issueNumber: 123,
  commentId: 456,
  payload: webhookPayload
});
```

**Returns:** CommentResult object:
- `processed`: boolean
- `command`: string | null - Detected command
- `response`: string - Response message
- `actions`: Action[] - Triggered actions

---

### validate-phase-transition

Validates phase transition requests.

#### Command Line Usage

```bash
node scripts/validate-phase-transition.js --issue-number=123 --from=research --to=design
```

**Options:**
- `--issue-number`: Required. Issue number
- `--from`: Required. Source phase
- `--to`: Required. Target phase
- `--user`: Optional. User requesting transition

#### Programmatic Usage

```javascript
const { validatePhaseTransition } = require('./scripts/validate-phase-transition');

const result = await validatePhaseTransition({
  issueNumber: 123,
  from: 'research',
  to: 'design',
  user: 'username'
});
```

**Returns:** ValidationResult object:
- `valid`: boolean
- `errors`: string[]
- `warnings`: string[]
- `requirements`: Requirement[]

---

### update-phase

Updates issue phase labels and metadata.

#### Command Line Usage

```bash
node scripts/update-phase.js --issue-number=123 --phase=design [options]
```

**Options:**
- `--issue-number`: Required. Issue number
- `--phase`: Required. New phase
- `--reason`: Optional. Transition reason
- `--notify`: Optional. Send notifications (default: true)

#### Programmatic Usage

```javascript
const { updatePhase } = require('./scripts/update-phase');

const result = await updatePhase({
  issueNumber: 123,
  phase: 'design',
  reason: 'Research completed',
  notify: true
});
```

**Returns:** UpdateResult object:
- `success`: boolean
- `previousPhase`: string
- `newPhase`: string
- `comment`: Comment - Created comment
- `notifications`: Notification[]

---

### manual-trigger

Manually triggers workflow actions.

#### Command Line Usage

```bash
node scripts/manual-trigger.js --action=run-agent --target=research-agent [options]
```

**Options:**
- `--action`: Required. Action to trigger
- `--target`: Required. Target (issue, agent, phase)
- `--params`: Optional. JSON parameters
- `--async`: Optional. Run asynchronously

#### Programmatic Usage

```javascript
const { manualTrigger } = require('./scripts/manual-trigger');

const result = await manualTrigger({
  action: 'run-agent',
  target: 'research-agent',
  params: { issueNumber: 123 },
  async: false
});
```

**Returns:** TriggerResult object:
- `triggered`: boolean
- `actionId`: string
- `status`: 'pending' | 'running' | 'completed' | 'failed'
- `output`: any

---

## Webhook Payloads

### GitHub Webhook Formats

#### Issue Event

```json
{
  "action": "opened" | "edited" | "closed" | "reopened" | "labeled" | "unlabeled",
  "issue": {
    "number": 123,
    "title": "Issue title",
    "body": "Issue body",
    "state": "open" | "closed",
    "labels": [
      {
        "name": "bug",
        "color": "d73a4a"
      }
    ],
    "user": {
      "login": "username",
      "id": 12345,
      "type": "User"
    },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "repository": {
    "name": "repo-name",
    "owner": {
      "login": "owner-name"
    }
  },
  "sender": {
    "login": "username",
    "id": 12345
  }
}
```

#### Issue Comment Event

```json
{
  "action": "created" | "edited" | "deleted",
  "issue": {
    "number": 123,
    "title": "Issue title",
    "state": "open"
  },
  "comment": {
    "id": 456789,
    "body": "Comment body",
    "user": {
      "login": "username",
      "id": 12345
    },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "repository": {
    "name": "repo-name",
    "owner": {
      "login": "owner-name"
    }
  }
}
```

#### Pull Request Event

```json
{
  "action": "opened" | "closed" | "merged" | "ready_for_review",
  "pull_request": {
    "number": 456,
    "title": "PR title",
    "body": "PR description",
    "state": "open" | "closed",
    "merged": false,
    "head": {
      "ref": "feature-branch",
      "sha": "abc123"
    },
    "base": {
      "ref": "main",
      "sha": "def456"
    },
    "user": {
      "login": "username"
    }
  },
  "repository": {
    "name": "repo-name",
    "owner": {
      "login": "owner-name"
    }
  }
}
```

### Custom Event Formats

#### Phase Transition Event

```json
{
  "type": "phase_transition",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "issueNumber": 123,
    "fromPhase": "research",
    "toPhase": "design",
    "triggeredBy": "username",
    "reason": "Research completed successfully",
    "metadata": {
      "duration": 3600000,
      "artifacts": ["research-doc.md", "analysis.json"]
    }
  }
}
```

#### Agent Execution Event

```json
{
  "type": "agent_execution",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "agentId": "research-agent",
    "issueNumber": 123,
    "phase": "research",
    "status": "started" | "completed" | "failed",
    "result": {
      "success": true,
      "output": {},
      "logs": ["Log entry 1", "Log entry 2"],
      "duration": 5000
    }
  }
}
```

---

## Response Formats

### Success Responses

#### Standard Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "duration": 150,
    "version": "1.0.0"
  }
}
```

#### Paginated Response

```json
{
  "success": true,
  "data": [
    // Array of items
  ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 100,
    "totalPages": 5
  },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### Error Responses

#### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid phase transition",
    "details": {
      "from": "research",
      "to": "implementation",
      "reason": "Design phase required before implementation"
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req-123456"
  }
}
```

#### Validation Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "issueNumber": ["Required field"],
      "phase": ["Invalid phase name"]
    }
  }
}
```

### Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT |
| 201 | Created | Successful POST |
| 202 | Accepted | Request accepted for async processing |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Conflict with current state |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 502 | Bad Gateway | External service error |
| 503 | Service Unavailable | Service temporarily down |

---

## Integration APIs

### MCP Protocol

The Model Context Protocol enables communication between the system and AI models.

#### Protocol Structure

```json
{
  "version": "1.0",
  "id": "unique-request-id",
  "method": "tool.execute",
  "params": {
    "tool": "github.createIssue",
    "arguments": {
      "title": "New feature request",
      "body": "Feature description",
      "labels": ["enhancement"]
    }
  }
}
```

#### Available Tools

##### github.createIssue
```json
{
  "tool": "github.createIssue",
  "arguments": {
    "title": "string",
    "body": "string",
    "labels": ["string"],
    "assignees": ["string"],
    "milestone": "number"
  }
}
```

##### github.updateIssue
```json
{
  "tool": "github.updateIssue",
  "arguments": {
    "issueNumber": "number",
    "title": "string",
    "body": "string",
    "state": "open" | "closed",
    "labels": ["string"]
  }
}
```

##### workflow.transitionPhase
```json
{
  "tool": "workflow.transitionPhase",
  "arguments": {
    "issueNumber": "number",
    "toPhase": "string",
    "reason": "string"
  }
}
```

##### agent.execute
```json
{
  "tool": "agent.execute",
  "arguments": {
    "agentId": "string",
    "context": {
      "issueNumber": "number",
      "phase": "string",
      "parameters": {}
    }
  }
}
```

#### Response Format

```json
{
  "version": "1.0",
  "id": "unique-request-id",
  "result": {
    "success": true,
    "output": {
      // Tool-specific output
    }
  }
}
```

### Claude CLI Interface

The Claude CLI provides command-line integration with Claude AI.

#### Basic Commands

##### Analyze Issue
```bash
claude analyze-issue --issue-number=123 --depth=comprehensive
```

**Options:**
- `--issue-number`: Required. Issue to analyze
- `--depth`: Optional. Analysis depth (quick | standard | comprehensive)
- `--output`: Optional. Output format (json | markdown | summary)

##### Generate Code
```bash
claude generate --prompt="Create a React component" --context=./src
```

**Options:**
- `--prompt`: Required. Generation prompt
- `--context`: Optional. Context directory
- `--language`: Optional. Target language
- `--output`: Optional. Output file path

##### Process Workflow
```bash
claude workflow --issue=123 --phase=research --action=execute
```

**Options:**
- `--issue`: Required. Issue number
- `--phase`: Required. Current phase
- `--action`: Required. Action to perform
- `--params`: Optional. JSON parameters

#### Configuration

##### CLI Config File (.claude.json)
```json
{
  "apiKey": "your-api-key",
  "model": "claude-3-opus-20240229",
  "github": {
    "token": "github-token",
    "owner": "org-name",
    "repo": "repo-name"
  },
  "workflow": {
    "autoTransition": true,
    "requireApproval": ["implementation", "deployment"]
  }
}
```

#### Output Formats

##### JSON Output
```json
{
  "command": "analyze-issue",
  "result": {
    "issueNumber": 123,
    "analysis": {
      "summary": "...",
      "complexity": "medium",
      "recommendations": []
    }
  },
  "metadata": {
    "model": "claude-3-opus-20240229",
    "duration": 2500
  }
}
```

##### Markdown Output
```markdown
# Issue Analysis #123

## Summary
...

## Complexity: Medium

## Recommendations
1. ...
2. ...

---
*Generated by Claude (claude-3-opus-20240229)*
```

---

## Error Handling

### Error Types

| Error Type | Code | Description |
|------------|------|-------------|
| ValidationError | VALIDATION_ERROR | Invalid input parameters |
| AuthenticationError | AUTH_ERROR | Authentication failed |
| AuthorizationError | AUTHZ_ERROR | Insufficient permissions |
| NotFoundError | NOT_FOUND | Resource not found |
| ConflictError | CONFLICT | State conflict |
| RateLimitError | RATE_LIMIT | Rate limit exceeded |
| TimeoutError | TIMEOUT | Operation timed out |
| ExternalServiceError | EXTERNAL_ERROR | External service failure |
| InternalError | INTERNAL_ERROR | Internal system error |

### Error Handling Examples

```javascript
try {
  const result = await client.updatePhase({
    issueNumber: 123,
    phase: 'invalid-phase'
  });
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    console.error('Invalid phase:', error.details);
  } else if (error.code === 'NOT_FOUND') {
    console.error('Issue not found');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Retry Strategies

```javascript
const retryOptions = {
  retries: 3,
  factor: 2,
  minTimeout: 1000,
  maxTimeout: 10000,
  randomize: true,
  retryCondition: (error) => {
    return error.code === 'RATE_LIMIT' || 
           error.code === 'TIMEOUT' ||
           error.statusCode >= 500;
  }
};

const result = await retry(
  () => client.executeAgent('agent-id', context),
  retryOptions
);
```

---

## Best Practices

### API Usage

1. **Authentication**: Always use environment variables for API keys
2. **Error Handling**: Implement comprehensive error handling
3. **Rate Limiting**: Respect rate limits and implement backoff
4. **Logging**: Log all API calls for debugging
5. **Timeouts**: Set appropriate timeouts for long operations

### Integration Guidelines

1. **Idempotency**: Make operations idempotent where possible
2. **Validation**: Validate inputs before API calls
3. **Caching**: Cache responses when appropriate
4. **Monitoring**: Monitor API usage and performance
5. **Documentation**: Keep API documentation up to date

### Security Considerations

1. **Token Management**: Rotate tokens regularly
2. **Input Validation**: Sanitize all user inputs
3. **Output Filtering**: Filter sensitive data from responses
4. **Audit Logging**: Log security-relevant events
5. **Access Control**: Implement proper access controls
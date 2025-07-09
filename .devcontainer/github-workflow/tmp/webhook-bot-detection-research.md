# Webhook-Based Bot Detection Research

## Overview
Webhook-based bot detection leverages GitHub's webhook system to receive real-time notifications about repository events, including comments from bots and GitHub Apps.

## How It Works

### 1. Webhook Event Flow
- GitHub sends HTTP POST requests to configured endpoint when events occur
- Events include `issue_comment` and `pull_request_review_comment` 
- Payload contains detailed information about the event and actor

### 2. Bot Identification in Webhooks

#### User Type Field
- GitHub API provides `sender.type` field in webhook payloads
- Can be "Bot" or "User"
- **Critical Finding**: Inconsistent classification
  - Some bots (e.g., `welcome[bot]`) correctly show `type: "Bot"`
  - Others (e.g., `googlebot`) incorrectly show `type: "User"`
  - Cannot rely solely on this field for accurate bot detection

#### GitHub App Identification
- GitHub Apps include `installation_id` in webhook payloads
- Unique identifier for each app installation
- More reliable than user type for GitHub Apps

#### Webhook Headers
- `X-GitHub-Hook-ID`: Unique webhook identifier
- `X-GitHub-Event`: Event name (e.g., "issue_comment")
- `X-GitHub-Delivery`: Globally unique event ID
- `X-GitHub-Hook-Installation-Target-Type`: Resource type
- `X-GitHub-Hook-Installation-Target-ID`: Resource ID
- `User-Agent`: Always prefixed with "GitHub-Hookshot/"

### 3. Implementation Architecture

#### Requirements
1. **External HTTPS Endpoint**
   - Public-facing server to receive webhooks
   - Must handle HTTP POST requests
   - Requires SSL/TLS certificate

2. **Server Implementation (Node.js/Express.js)**
   ```javascript
   const { Webhooks, createNodeMiddleware } = require("@octokit/webhooks");
   const express = require("express");
   
   const webhooks = new Webhooks({
     secret: process.env.WEBHOOK_SECRET
   });
   
   const app = express();
   app.use(createNodeMiddleware(webhooks, { path: "/api/github/webhooks" }));
   
   webhooks.on("issue_comment", ({ payload }) => {
     const sender = payload.sender;
     const isBot = sender.type === "Bot" || sender.login.includes("[bot]");
     const installationId = payload.installation?.id;
     
     // Process based on bot detection
   });
   ```

3. **Security Requirements**
   - Webhook secret for signature validation
   - HMAC verification of payload integrity
   - Signature in `X-Hub-Signature-256` header

4. **Development Tools**
   - Use smee.io for local webhook testing
   - Tunnels webhooks to local development server
   - No need for public endpoint during development

### 4. Benefits

1. **Real-time Event Processing**
   - Immediate notification when events occur
   - No polling required
   - Lower API rate limit usage

2. **Rich Event Metadata**
   - Complete event context in payload
   - Includes sender, repository, and action details
   - Installation info for GitHub Apps

3. **Clear Actor Information**
   - Direct access to `sender` object
   - Can check multiple bot indicators
   - Installation ID for GitHub Apps

4. **Scalability**
   - Can handle high volume of events
   - Asynchronous processing possible
   - Queue integration for reliability

### 5. Drawbacks

1. **Infrastructure Requirements**
   - Need external server/endpoint
   - Must be publicly accessible
   - Requires ongoing maintenance

2. **Network Dependencies**
   - Relies on webhook delivery
   - Potential for missed events
   - Need retry/recovery mechanisms

3. **Complexity**
   - More complex than API polling
   - Requires webhook signature validation
   - Need to handle various event types

4. **Bot Detection Limitations**
   - Inconsistent `type` field values
   - Some bots misidentified as users
   - Requires multiple detection strategies

### 6. Integration with Current MCP Solution

#### Hybrid Approach
1. Use webhooks for real-time events
2. Store bot detection results in MCP memory
3. Fall back to API calls for missed events
4. Combine webhook and API data for accuracy

#### Implementation Strategy
```javascript
// Webhook handler stores bot detection
webhooks.on("issue_comment", async ({ payload }) => {
  const botIndicators = {
    typeField: payload.sender.type === "Bot",
    loginPattern: payload.sender.login.includes("[bot]"),
    installationId: !!payload.installation?.id,
    appId: payload.app?.id
  };
  
  // Store in MCP memory for later use
  await mcpMemory.store(`bot-detection/${payload.comment.id}`, {
    isBot: Object.values(botIndicators).some(v => v),
    indicators: botIndicators,
    timestamp: new Date().toISOString()
  });
});
```

## Recommendations

1. **Primary Detection Strategy**
   - Check `sender.type === "Bot"`
   - Check if login contains "[bot]"
   - Check for `installation` object (GitHub Apps)
   - Check for `app` object in payload

2. **Reliability Improvements**
   - Maintain whitelist of known bot accounts
   - Use pattern matching on login names
   - Cross-reference with API user endpoint
   - Store detection results for consistency

3. **Architecture Considerations**
   - Use serverless functions for webhook endpoint
   - Implement queue for reliable processing
   - Add monitoring and alerting
   - Plan for webhook delivery failures

## Conclusion

Webhook-based bot detection offers real-time processing and rich metadata but requires external infrastructure and careful handling of inconsistent bot identification. A hybrid approach combining webhooks with API calls and pattern matching provides the most reliable solution.
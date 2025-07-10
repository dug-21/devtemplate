# Mock Prototype Guide for HDD

## Overview

This guide explains how to use lightweight mock prototypes in the HDD process to dramatically reduce the cost and time of the prototype phase while still making informed decisions.

## The Problem with Full Prototypes

Building 3+ complete implementations to test hypotheses is:
- **Expensive**: 3-5 days × 3 prototypes = 9-15 days of development
- **Wasteful**: 2 out of 3 prototypes get thrown away
- **Risky**: Major effort before validation
- **Slow**: Delays critical decisions

## The Mock-First Solution

### Two-Stage Prototyping

**Stage 1: Mock Prototypes (1-2 days total)**
- Create lightweight versions of each approach
- Use mocks, stubs, and wireframes
- Test core assumptions cheaply
- Make informed selection decision

**Stage 2: Full Build (2-3 days)**
- Build only the selected approach
- Implement with confidence
- Focus resources on the winner
- Deliver production-quality code

## Mock Prototype Techniques

### 1. UI Mocking
```yaml
Approach A - Figma Interactive:
  - Tool: Figma/Sketch
  - Time: 2-4 hours
  - Fidelity: High visual, clickable
  - Tests: User flow, visual design

Approach B - HTML/CSS Static:
  - Tool: CodePen, static files
  - Time: 1-3 hours  
  - Fidelity: Medium visual, limited interaction
  - Tests: Layout, responsiveness

Approach C - Paper Prototype:
  - Tool: Sketches, Miro board
  - Time: 30-60 minutes
  - Fidelity: Low visual, concept only
  - Tests: Information architecture
```

### 2. API Mocking
```javascript
// Approach A: JSON Server
// mock-server/db.json
{
  "users": [
    { "id": 1, "name": "John", "role": "admin" }
  ],
  "posts": [
    { "id": 1, "title": "Hello World", "userId": 1 }
  ]
}
// Run: json-server --watch db.json

// Approach B: Express Mock
app.get('/api/users/:id', (req, res) => {
  // Return hardcoded response
  res.json({ id: req.params.id, name: "Mock User" });
});

// Approach C: Service Worker
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      new Response(JSON.stringify({ mock: true }))
    );
  }
});
```

### 3. Logic Mocking
```python
# Approach A: Pseudocode
def process_payment(amount, user):
    # MOCK: Always return success for testing
    return {
        "status": "success",
        "transaction_id": "mock_123",
        "processing_time": 0.5
    }

# Approach B: State Machine
STATES = {
    "INIT": ["PROCESSING"],
    "PROCESSING": ["SUCCESS", "FAILED"],
    "SUCCESS": ["COMPLETE"],
    "FAILED": ["RETRY", "CANCEL"]
}

# Approach C: Decision Table
RULES = [
    {"condition": "amount > 1000", "action": "require_approval"},
    {"condition": "user.verified", "action": "auto_approve"},
    {"condition": "default", "action": "manual_review"}
]
```

### 4. Data Mocking
```sql
-- Approach A: SQLite with sample data
CREATE TABLE mock_orders AS
SELECT * FROM generate_series(1, 1000) AS id,
       'ORDER_' || id AS order_number,
       (RANDOM() * 1000)::decimal(10,2) AS amount;

-- Approach B: CSV fixtures
orders.csv:
id,customer,amount,status
1,ACME Corp,1500.00,pending
2,Beta Inc,750.50,completed

-- Approach C: Faker.js
const orders = Array(100).fill(null).map(() => ({
  id: faker.datatype.uuid(),
  customer: faker.company.name(),
  amount: faker.finance.amount(),
  date: faker.date.recent()
}));
```

## Evaluation Framework

### Stage 1: Mock Evaluation (Lightweight)

| Criteria | Weight | Approach A | Approach B | Approach C |
|----------|--------|------------|------------|------------|
| User Experience | 30% | 8/10 | 6/10 | 9/10 |
| Technical Feasibility | 25% | 7/10 | 9/10 | 5/10 |
| Performance Potential | 20% | 6/10 | 8/10 | 7/10 |
| Development Effort | 15% | High | Medium | Low |
| Maintenance Burden | 10% | Medium | Low | High |
| **Total Score** | 100% | 7.1 | 7.5 | 6.9 |

### Decision Matrix
```yaml
Approach B Selected Because:
  - Highest overall score (7.5/10)
  - Best technical feasibility
  - Moderate development effort
  - Low maintenance burden
  - Acceptable UX (can be improved)
```

## Implementation Examples

### Example 1: E-commerce Checkout Flow

**Stage 1 Mocks (1 day):**
- Approach A: Single-page checkout (Figma clickable)
- Approach B: Multi-step wizard (HTML/CSS)
- Approach C: One-click checkout (Wireframe + API mock)

**Evaluation Results:**
- A: Good UX, complex implementation
- B: Familiar pattern, easy to build
- C: Best UX, requires payment integration

**Decision**: Approach B selected for full build

**Stage 2 Build (3 days):**
- Implement multi-step wizard
- Full validation and error handling
- Payment integration
- Responsive design

### Example 2: Search Algorithm

**Stage 1 Mocks (4 hours):**
- Approach A: Full-text search (mock results from JSON)
- Approach B: Faceted search (static filters)
- Approach C: AI-powered search (hardcoded "smart" results)

**Evaluation Results:**
- A: Fast, simple, limited
- B: Powerful, complex UI
- C: Best results, expensive

**Decision**: Approach B selected with simplified UI

**Stage 2 Build (2 days):**
- Implement faceted search
- Optimize query performance
- Progressive enhancement

## Benefits Realized

### Time Savings
- Traditional: 15 days (5 days × 3 full prototypes)
- Mock-first: 5 days (1 day mocks + 4 days build)
- **Savings: 67%**

### Cost Savings
- Traditional: $15,000 (@ $1000/day)
- Mock-first: $5,000
- **Savings: $10,000**

### Risk Reduction
- Test assumptions before major investment
- Validate with stakeholders early
- Pivot quickly if needed
- Build with confidence

## Best Practices

### DO:
- ✅ Keep mocks truly lightweight (hours, not days)
- ✅ Focus on testing core assumptions
- ✅ Involve stakeholders in mock reviews
- ✅ Document why you selected the winner
- ✅ Reuse mock assets in full build

### DON'T:
- ❌ Over-engineer mocks (they're throwaway)
- ❌ Skip mocking because "we know what to build"
- ❌ Build all approaches halfway (pick one)
- ❌ Forget to validate mock assumptions in build
- ❌ Let scope creep into the mock phase

## AI Agent Strategies

### For Mock Stage:
```yaml
Architect Agent:
  - Generate multiple architecture diagrams
  - Create API contracts
  - Design data models
  - Identify integration points

Analyst Agent:
  - Evaluate technical feasibility
  - Estimate performance characteristics
  - Assess security implications
  - Calculate resource requirements

UX Agent:
  - Create user journey maps
  - Design wireframes
  - Write user stories
  - Validate accessibility
```

### For Build Stage:
```yaml
Builder Agent:
  - Implement selected architecture
  - Write production code
  - Create unit tests
  - Handle edge cases

Optimizer Agent:
  - Profile performance
  - Implement caching
  - Optimize queries
  - Reduce bundle size
```

## Metrics to Track

### Mock Phase Metrics
- Time to create each mock
- Number of assumptions tested
- Stakeholder feedback scores
- Decision confidence level

### Comparison Metrics
- Mock prediction accuracy (did the build match expectations?)
- Time saved vs. traditional approach
- Cost saved vs. traditional approach
- Number of pivots avoided

## Integration with HDD Workflow

1. **Hypothesis Phase**: Define what you're testing
2. **Prototype Phase - Stage 1**: Create mocks (1-2 days)
3. **Prototype Phase - Stage 2**: Build winner (2-3 days)
4. **Validation Phase**: Test the full build
5. **Evolution Phase**: Monitor and optimize

The mock-first approach fits naturally into the HDD framework while dramatically reducing the cost and risk of the prototype phase.
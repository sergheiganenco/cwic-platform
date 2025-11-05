# Enhanced AI Assistant - Documentation

## Overview

The Enhanced AI Assistant is a powerful, context-aware conversational AI system designed to help users interact with their data governance platform naturally. It can answer questions about data quality, discover assets, explain lineage, monitor pipelines, and much more.

## Key Features

### 🎯 Context-Aware Conversations
- Maintains conversation history across sessions
- Understands context from previous messages
- Provides relevant follow-up suggestions

### 📊 Real-Time Data Integration
- Automatically fetches data from catalog, quality, lineage, and pipeline services
- Always has up-to-date information about your data platform
- Can answer questions about current state without manual data entry

### 🤖 Intelligent Query Routing
The AI automatically detects intent and routes queries to specialized handlers:

- **Search/Discovery**: "Find all tables with customer data"
- **Quality Analysis**: "Show me quality issues in the orders table"
- **Lineage**: "What's the lineage for the sales table?"
- **Pipeline Status**: "Are all my pipelines running?"
- **Statistics**: "How many assets do we have?"
- **Sensitive Data**: "Show me all PII fields"
- **SQL Generation**: "Generate SQL to find top customers"
- **Recommendations**: "What should I do to improve data quality?"

### 💡 Smart Recommendations
- Provides actionable suggestions based on your data state
- Identifies potential issues and solutions
- Helps optimize data governance workflows

## Architecture

```
Frontend (React)
    ↓
AI Assistant Service API
    ↓
Enhanced AI Service
    ↓
┌─────────────────────────────────────┐
│ Data Context Provider               │
├─────────────────────────────────────┤
│ - Catalog Service    (Assets)       │
│ - Quality Service    (Metrics)      │
│ - Lineage Service    (Dependencies) │
│ - Pipeline Service   (Status)       │
│ - Data Sources       (Connections)  │
└─────────────────────────────────────┘
```

## API Endpoints

### POST `/api/ai/discovery/enhanced-query`

Process a natural language query with full context awareness.

**Request Body:**
```json
{
  "query": "Show me data quality issues",
  "sessionId": "session_123" (optional),
  "conversationHistory": [], (optional)
  "includeContext": true,
  "preferences": {
    "detailLevel": "detailed",
    "includeCode": true,
    "includeRecommendations": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Formatted response message with markdown",
    "type": "analysis | text | data | query | visualization",
    "results": {},
    "recommendations": [],
    "relatedAssets": [],
    "confidence": 0.95,
    "isAiGenerated": true
  },
  "meta": {
    "processingTime": 234,
    "sessionId": "session_123",
    "model": "enhanced-ai",
    "timestamp": "2025-10-13T..."
  }
}
```

### GET `/api/ai/discovery/conversation/:sessionId`

Retrieve conversation history for a session.

### DELETE `/api/ai/discovery/conversation/:sessionId`

Clear conversation history for a session.

## Usage Examples

### Example 1: Search for Assets

**Query:** "Find all tables containing customer information"

**Response:**
```
🔍 Search Results for "customer", "information"

Found 12 assets:

TABLES (8):
- customers (public) - Main customer information table
- customer_addresses (public) - Customer shipping addresses
- customer_orders (sales) - Customer order history
...

COLUMNS (4):
- customer_email (customers) - Customer email address
- customer_phone (customers) - Customer phone number
...
```

### Example 2: Quality Analysis

**Query:** "What's the quality score for the orders table?"

**Response:**
```
📊 Quality Report for orders

Overall Score: 87%
Issues Found: 15
Last Check: 2025-10-13 10:30 AM

Active Rules: 8 validation rules
- Not null validation
- Date format check
- Foreign key integrity
- Amount range validation
- Status enum validation

⚠️ Action Required: Review and fix quality issues
```

### Example 3: Pipeline Status

**Query:** "Show me pipeline status"

**Response:**
```
📊 Pipeline Status Overview

Active: 12 pipelines running

🟢 RUNNING (10):
- Customer Data Sync - Last run: 2 minutes ago
- Transaction Processing - Last run: 15 seconds ago
- Inventory Update - Last run: 5 minutes ago
...

🔴 FAILED (2):
- Daily Aggregation - Last run: 1 hour ago
- Report Generation - Last run: 30 minutes ago
```

### Example 4: SQL Generation

**Query:** "Generate SQL to find customers who made purchases in the last 30 days"

**Response:**
```sql
SELECT DISTINCT
    c.customer_id,
    c.customer_name,
    c.customer_email,
    COUNT(o.order_id) as order_count,
    SUM(o.order_total) as total_spent
FROM customers c
INNER JOIN orders o ON c.customer_id = o.customer_id
WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.customer_id, c.customer_name, c.customer_email
ORDER BY total_spent DESC;
```

**Explanation:** This query retrieves customers who have placed orders in the last 30 days, showing their order count and total spending.

## Frontend Integration

### Using the AI Assistant Service

```typescript
import aiAssistantService from '@/services/api/aiAssistant';

// Send a query
const response = await aiAssistantService.sendMessageWithFallback(
  "Show me data quality issues",
  {
    sessionId: 'my-session-123',
    cacheKey: 'quality-query-1'
  }
);

if (response.success) {
  console.log(response.data.message);
  console.log('Recommendations:', response.data.recommendations);
}
```

### Using the Chat Interface Component

```tsx
import { ChatInterface } from '@/components/features/ai-assistant/ChatInterface';

function MyPage() {
  return (
    <ChatInterface
      showHeader={true}
      placeholder="Ask me anything about your data..."
    />
  );
}
```

## Configuration

### Environment Variables

#### Backend (AI Service)

```env
# OpenAI Configuration (optional)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=4000
OPENAI_TEMPERATURE=0.1

# Data Service URL
DATA_SERVICE_URL=http://localhost:3002

# Cache Configuration
CACHE_TTL=3600
```

#### Frontend

```env
# AI Service Configuration
VITE_AI_SERVICE_URL=/api/ai
VITE_USE_AI_BACKEND=true
VITE_ENABLE_MOCK_MODE=false
```

## Query Intent Detection

The AI automatically detects the intent of your query using pattern matching and natural language understanding:

| Intent | Patterns | Example Queries |
|--------|----------|----------------|
| **Search** | find, search, show me, list, what, where | "Find customer tables", "Show me all databases" |
| **Quality** | quality, issue, problem, validation | "What quality issues exist?", "Show me validation errors" |
| **Lineage** | lineage, upstream, downstream, dependency | "What's the lineage for sales?", "Show me dependencies" |
| **Pipeline** | pipeline, workflow, job, run | "Pipeline status", "Are my jobs running?" |
| **Statistics** | how many, count, total, metrics | "How many assets do we have?", "Show statistics" |
| **Sensitive Data** | sensitive, pii, phi, compliance | "Find PII fields", "Show me sensitive data" |
| **SQL Generation** | generate sql, write query, create query | "Generate SQL for...", "Write a query to..." |
| **Recommendation** | recommend, suggest, improve | "What should I do?", "How can I improve quality?" |

## Advanced Features

### Conversation Context

The AI maintains conversation context across multiple messages:

```
User: "Show me the customers table"
AI: [Shows customer table details]

User: "What's the quality score?"
AI: [Understands you're asking about the customers table from previous message]
```

### Data Context Caching

- Data context is cached for 1 minute to improve performance
- Automatically refreshes when stale
- Can be manually refreshed by clearing cache

### Fallback Mechanism

If the enhanced AI service fails or OpenAI is unavailable:
1. Falls back to rule-based query processing
2. Provides basic keyword-based responses
3. Uses mock responses in development mode

### Multi-Service Integration

The AI seamlessly integrates data from multiple services:
- **Catalog Service**: Asset information, schemas, tables, columns
- **Quality Service**: Quality scores, rules, violations
- **Lineage Service**: Data flow, dependencies, impact analysis
- **Pipeline Service**: Pipeline status, execution history
- **Data Sources**: Connection details, availability

## Best Practices

### For Users

1. **Be Specific**: "Show quality issues for orders table" is better than "Show quality"
2. **Use Natural Language**: Don't worry about perfect syntax
3. **Follow Up**: Ask clarifying questions based on responses
4. **Explore Suggestions**: Click on suggested queries to learn more

### For Developers

1. **Monitor Performance**: Check processing times and optimize slow queries
2. **Review Logs**: Monitor AI service logs for errors and improvements
3. **Update Patterns**: Enhance intent detection patterns based on user queries
4. **Cache Strategy**: Adjust cache TTL based on data update frequency

## Troubleshooting

### AI Not Responding

1. Check if AI service is running: `http://localhost:3003/health`
2. Verify DATA_SERVICE_URL is configured correctly
3. Check network connectivity between services
4. Review logs for error messages

### Inaccurate Responses

1. Clear conversation history and try again
2. Be more specific in your query
3. Check if data has been cataloged and scanned
4. Verify OpenAI API key if using AI mode

### Slow Performance

1. Check data service response times
2. Review cache configuration
3. Reduce context size if very large datasets
4. Optimize database queries in data service

## Future Enhancements

- [ ] Voice input support
- [ ] Multi-language support
- [ ] Custom training on domain-specific data
- [ ] Visual query builder integration
- [ ] Automated alerting and notifications
- [ ] Integration with Slack/Teams
- [ ] Advanced analytics and insights
- [ ] Predictive quality analysis

## Support

For issues or questions:
- Check the logs in `backend/ai-service/logs/`
- Review the API documentation
- Contact the data governance team
- Submit a ticket in the platform

---

**Version:** 1.0.0
**Last Updated:** 2025-10-13
**Maintained By:** Data Governance Team

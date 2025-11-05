# AI Assistant - Developer Guide

## Overview

This guide helps developers understand, extend, and maintain the Enhanced AI Assistant system.

## Architecture Deep Dive

### Core Components

```
┌─────────────────────────────────────────────────────────┐
│  DataContextProvider                                     │
│  - Fetches data from 5 services                         │
│  - Caches for 1 minute                                   │
│  - Provides search/filter utilities                      │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │
┌─────────────────────────────────────────────────────────┐
│  EnhancedAIService                                       │
│  - Intent detection                                      │
│  - Query routing                                         │
│  - 8 specialized handlers                                │
│  - Conversation management                               │
│  - Response formatting                                   │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │
┌─────────────────────────────────────────────────────────┐
│  DiscoveryController                                     │
│  - HTTP endpoints                                        │
│  - Request validation                                    │
│  - Error handling                                        │
└─────────────────────────────────────────────────────────┘
```

## Adding New Query Types

### Step 1: Add Intent Pattern

Edit `EnhancedAIService.ts`:

```typescript
private detectQueryIntent(query: string): { type: string; entities: string[] } {
  const lowerQuery = query.toLowerCase();

  // Add your new pattern
  if (lowerQuery.match(/\b(your|keywords|here)\b/)) {
    return { type: 'your_new_type', entities: [] };
  }

  // ... existing patterns
}
```

### Step 2: Create Handler

```typescript
private async handleYourNewQuery(
  query: string,
  context: ConversationContext,
  intent: any
): Promise<EnhancedQueryResponse> {
  const dataContext = context.dataContext!;

  // Your logic here
  const results = await this.dataContextProvider.yourMethod(query, dataContext);

  // Format response
  const message = this.formatYourResults(results);

  return {
    message,
    type: 'analysis', // or 'data', 'text', etc.
    data: results,
    recommendations: ['Do this', 'Do that'],
    confidence: 0.9,
    processingTime: 0,
    isAiGenerated: false,
    sessionId: context.sessionId,
  };
}
```

### Step 3: Route to Handler

```typescript
public async processQuery(request: EnhancedQueryRequest): Promise<EnhancedQueryResponse> {
  // ... existing code

  switch (intent.type) {
    // ... existing cases
    case 'your_new_type':
      response = await this.handleYourNewQuery(request.query, context, intent);
      break;
    // ... rest
  }
}
```

## Adding Data Context Methods

### In DataContextProvider.ts

```typescript
/**
 * Your new method to fetch/filter data
 */
public async yourMethod(query: string, context?: DataContext): Promise<YourResultType[]> {
  const dataContext = context || await this.getDataContext();

  // Implement your logic
  return dataContext.assets.filter(/* your filter logic */);
}
```

### Adding New Data Sources

```typescript
// 1. Add interface for your data type
export interface YourNewDataType {
  id: number;
  name: string;
  // ... other fields
}

// 2. Add to DataContext interface
export interface DataContext {
  // ... existing fields
  yourNewData: YourNewDataType[];
}

// 3. Add fetch method
private async fetchYourNewData(): Promise<YourNewDataType[]> {
  try {
    const response = await axios.get(`${this.dataServiceUrl}/api/your-endpoint`);
    return response.data?.data || [];
  } catch (error) {
    logger.warn('Failed to fetch your new data:', error);
    return [];
  }
}

// 4. Update getDataContext()
public async getDataContext(forceRefresh: boolean = false): Promise<DataContext> {
  // ... existing code

  const [dataSources, assets, /* ... */, yourNewData] = await Promise.allSettled([
    this.fetchDataSources(),
    this.fetchAssets(),
    // ... existing fetches
    this.fetchYourNewData(), // Add your fetch
  ]);

  const context: DataContext = {
    // ... existing fields
    yourNewData: yourNewData.status === 'fulfilled' ? yourNewData.value : [],
  };

  // ... rest of the method
}
```

## Customizing Response Formatting

### Create Custom Formatter

```typescript
private formatYourResults(data: any[]): string {
  let message = `📊 **Your Title**\n\n`;

  // Use markdown for formatting
  message += `Found ${data.length} items:\n\n`;

  data.forEach(item => {
    message += `- **${item.name}**: ${item.description}\n`;
  });

  // Add icons for visual appeal
  if (data.length === 0) {
    message += '❌ No results found';
  } else {
    message += '✅ Results loaded successfully';
  }

  return message;
}
```

### Markdown Formatting Guidelines

Use these patterns for consistent formatting:

```markdown
# Headers
**Bold Text**
*Italic Text*
- Bullet points
1. Numbered lists

📊 Data/Analytics icon
🔍 Search icon
✅ Success icon
❌ Error icon
⚠️ Warning icon
💡 Recommendation icon
🔗 Lineage/Link icon
🛡️ Security icon
⚙️ Pipeline/Process icon
```

## Adding AI Capabilities

### Using OpenAI

```typescript
private async yourAIMethod(input: any): Promise<string> {
  if (!openai.isAvailable()) {
    return this.fallbackMethod(input);
  }

  try {
    const response = await openai.createChatCompletion({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'Your system prompt here'
        },
        {
          role: 'user',
          content: `Your user prompt: ${input}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || this.fallbackMethod(input);
  } catch (error) {
    logger.error('AI method failed:', error);
    return this.fallbackMethod(input);
  }
}

private fallbackMethod(input: any): string {
  // Non-AI fallback logic
  return 'Basic response without AI';
}
```

## Testing

### Unit Testing

```typescript
// test/services/EnhancedAIService.test.ts
import { EnhancedAIService } from '@services/EnhancedAIService';

describe('EnhancedAIService', () => {
  let service: EnhancedAIService;

  beforeEach(() => {
    service = new EnhancedAIService();
  });

  describe('processQuery', () => {
    it('should detect search intent', async () => {
      const response = await service.processQuery({
        query: 'Find customer tables',
        includeContext: false, // Skip actual data fetching in tests
      });

      expect(response.type).toBe('data');
      expect(response.confidence).toBeGreaterThan(0.7);
    });
  });
});
```

### Integration Testing

```typescript
// test/integration/ai-assistant.test.ts
import axios from 'axios';

describe('AI Assistant API', () => {
  it('should process enhanced query', async () => {
    const response = await axios.post('http://localhost:3003/api/ai/discovery/enhanced-query', {
      query: 'Show me data quality issues',
      includeContext: true,
    }, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data.message).toBeDefined();
  });
});
```

### Manual Testing

```bash
# Test with curl
curl -X POST http://localhost:3003/api/ai/discovery/enhanced-query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "Show me data quality issues",
    "includeContext": true
  }'
```

## Performance Optimization

### Caching Strategy

```typescript
// Adjust cache duration
constructor() {
  this.dataServiceUrl = process.env.DATA_SERVICE_URL || 'http://localhost:3002';
  this.cacheTimeout = 60000; // 1 minute - adjust as needed
}

// Force refresh for specific queries
if (query.includes('fresh') || query.includes('latest')) {
  context.dataContext = await this.dataContextProvider.getDataContext(true);
}
```

### Parallel Processing

```typescript
// Process multiple queries in parallel
const [result1, result2] = await Promise.all([
  this.dataContextProvider.searchAssets('term1', dataContext),
  this.dataContextProvider.searchAssets('term2', dataContext),
]);
```

### Timeout Handling

```typescript
// Add timeout to long-running operations
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Timeout')), 10000)
);

const result = await Promise.race([
  this.longRunningOperation(),
  timeoutPromise
]);
```

## Error Handling

### Graceful Degradation

```typescript
try {
  return await this.enhancedMethod();
} catch (error) {
  logger.error('Enhanced method failed, using fallback:', error);
  return this.fallbackMethod();
}
```

### User-Friendly Error Messages

```typescript
private handleError(error: any): EnhancedQueryResponse {
  let userMessage: string;

  if (error.code === 'TIMEOUT') {
    userMessage = 'The request took too long. Please try a more specific query.';
  } else if (error.code === 'SERVICE_UNAVAILABLE') {
    userMessage = 'Some data services are currently unavailable. Showing cached results.';
  } else {
    userMessage = 'I encountered an issue processing your request. Please try again.';
  }

  return {
    message: userMessage,
    type: 'text',
    confidence: 0,
    processingTime: 0,
    isAiGenerated: false,
    sessionId: '',
  };
}
```

## Logging Best Practices

```typescript
// Structured logging
logger.info('Processing query', {
  query: request.query,
  intent: intent.type,
  sessionId: request.sessionId,
  userId: 'user-123',
  timestamp: new Date().toISOString(),
});

// Performance logging
const startTime = Date.now();
const result = await this.operation();
logger.info('Operation completed', {
  duration: Date.now() - startTime,
  resultCount: result.length,
});

// Error logging with context
logger.error('Failed to process query', {
  error: error.message,
  stack: error.stack,
  query: request.query,
  sessionId: request.sessionId,
});
```

## Configuration

### Environment Variables

```typescript
// config/ai.config.ts
export const aiConfig = {
  dataServiceUrl: process.env.DATA_SERVICE_URL || 'http://localhost:3002',
  cacheTimeout: parseInt(process.env.CACHE_TIMEOUT || '60000'),
  maxConversationHistory: parseInt(process.env.MAX_CONVERSATION_HISTORY || '20'),
  enableOpenAI: process.env.ENABLE_OPENAI === 'true',
  openAIModel: process.env.OPENAI_MODEL || 'gpt-4',
  openAIMaxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000'),
  openAITemperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
};
```

### Feature Flags

```typescript
// Use feature flags for gradual rollout
const features = {
  enhancedQuery: process.env.FEATURE_ENHANCED_QUERY === 'true',
  aiRecommendations: process.env.FEATURE_AI_RECOMMENDATIONS === 'true',
  conversationHistory: process.env.FEATURE_CONVERSATION_HISTORY === 'true',
};

if (features.enhancedQuery) {
  // Use enhanced query
} else {
  // Use basic query
}
```

## Monitoring & Metrics

### Key Metrics to Track

```typescript
class AIMetrics {
  private metrics = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    averageResponseTime: 0,
    intentDistribution: new Map<string, number>(),
  };

  recordQuery(intent: string, success: boolean, responseTime: number) {
    this.metrics.totalQueries++;
    if (success) {
      this.metrics.successfulQueries++;
    } else {
      this.metrics.failedQueries++;
    }

    // Update average response time
    const n = this.metrics.totalQueries;
    this.metrics.averageResponseTime =
      ((this.metrics.averageResponseTime * (n - 1)) + responseTime) / n;

    // Track intent distribution
    const count = this.metrics.intentDistribution.get(intent) || 0;
    this.metrics.intentDistribution.set(intent, count + 1);
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.successfulQueries / this.metrics.totalQueries,
    };
  }
}
```

## Deployment

### Build Process

```bash
# Build AI service
cd backend/ai-service
npm run build

# Run tests
npm test

# Start in production
npm start
```

### Docker Deployment

```dockerfile
# Dockerfile for AI Service
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3003

CMD ["node", "dist/server.js"]
```

### Environment Configuration

```yaml
# docker-compose.yml
ai-service:
  build: ./backend/ai-service
  ports:
    - "3003:3003"
  environment:
    - DATA_SERVICE_URL=http://data-service:3002
    - OPENAI_API_KEY=${OPENAI_API_KEY}
    - CACHE_TIMEOUT=60000
  depends_on:
    - data-service
```

## Debugging Tips

### Enable Verbose Logging

```typescript
// In .env
DEBUG=true
LOG_LEVEL=debug

// In code
if (process.env.DEBUG === 'true') {
  console.log('Debug info:', {
    query,
    intent,
    dataContext: context.dataContext?.statistics,
  });
}
```

### Test Individual Components

```typescript
// Test data context provider independently
const provider = new DataContextProvider();
const context = await provider.getDataContext(true);
console.log('Data Context:', context);

// Test intent detection
const service = new EnhancedAIService();
const intent = service['detectQueryIntent']('Find customer tables');
console.log('Detected Intent:', intent);
```

### Use Debug Endpoints

```typescript
// Add debug endpoint (remove in production!)
router.get('/debug/context', async (req, res) => {
  const provider = new DataContextProvider();
  const context = await provider.getDataContext(true);
  res.json(context);
});
```

## Common Issues & Solutions

### Issue: Slow Response Times

**Solutions:**
1. Increase cache timeout
2. Optimize data service queries
3. Reduce amount of data fetched
4. Add pagination to results

### Issue: Inaccurate Intent Detection

**Solutions:**
1. Add more pattern variations
2. Order patterns from most specific to least specific
3. Add entity extraction
4. Use AI for intent detection if available

### Issue: Context Not Being Used

**Solutions:**
1. Verify `includeContext: true` in request
2. Check data service connectivity
3. Review cache expiration
4. Ensure data is being fetched correctly

## Security Considerations

### Input Validation

```typescript
private sanitizeQuery(query: string): string {
  // Remove potentially dangerous characters
  return query.replace(/[<>]/g, '');
}

private validateQuery(query: string): boolean {
  if (!query || query.length > 500) {
    return false;
  }
  // Add more validation as needed
  return true;
}
```

### Rate Limiting

```typescript
// Implemented in middleware
const rateLimit = {
  windowMs: 60000, // 1 minute
  max: 10, // 10 requests per minute
};
```

### Authentication

```typescript
// All endpoints require valid JWT token
router.use(authenticateToken);
```

## Contributing

When adding new features:

1. **Follow existing patterns**
2. **Add tests**
3. **Update documentation**
4. **Log appropriately**
5. **Handle errors gracefully**
6. **Consider performance**
7. **Test with real data**

## Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Express.js Documentation](https://expressjs.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Jest Testing Framework](https://jestjs.io/)

## Support

For development questions:
- Check existing code examples
- Review test files
- Consult the architecture diagram
- Ask the development team

---

**Happy Developing!** 🚀

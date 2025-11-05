# AI Assistant - User Guide

## Welcome to Your Intelligent Data Companion! 🤖

The AI Assistant is your personal data governance expert that can answer any question about your data platform. Just ask naturally, as if you're talking to a colleague!

## Getting Started

### Accessing the AI Assistant

1. Navigate to the **AI Assistant** page from the main menu
2. You'll see a chat interface ready to help
3. Type your question in the input box
4. Press **Enter** or click **Send**

## What Can You Ask?

### 🔍 Finding Data

**Search for tables, columns, or datasets:**
- "Find all tables related to customers"
- "Show me email fields across all databases"
- "List all tables in the sales schema"
- "Search for payment information"

**Discover data sources:**
- "What databases do we have?"
- "Show me all data sources"
- "List active connections"

### 📊 Checking Data Quality

**Get quality scores:**
- "What's the quality score for the orders table?"
- "Show me quality issues"
- "Which tables have the lowest quality?"
- "Are there any validation errors?"

**Understand specific issues:**
- "Why is the customers table failing validation?"
- "What quality rules are active?"
- "Show me completeness scores"

### 🔗 Understanding Data Flow

**Explore lineage:**
- "Show me lineage for the sales table"
- "What feeds into the customer table?"
- "What tables depend on orders?"
- "Explain the data flow from source to reports"

**Impact analysis:**
- "If I change customers, what's affected?"
- "Show me downstream consumers"
- "What are the upstream sources?"

### ⚙️ Monitoring Pipelines

**Check pipeline status:**
- "Are all my pipelines running?"
- "Show me failed pipelines"
- "What's the status of the ETL?"
- "When did the last pipeline run?"

**Pipeline details:**
- "How many pipelines do we have?"
- "Show me pipeline health"
- "What pipelines need attention?"

### 📈 Getting Statistics

**Platform overview:**
- "How many assets do we have?"
- "Show me platform statistics"
- "What's our overall quality score?"
- "How many data sources are connected?"

**Detailed metrics:**
- "How many tables are cataloged?"
- "Show me quality metrics"
- "What's the average quality score?"

### 🛡️ Finding Sensitive Data

**Discover PII/PHI:**
- "Show me all PII fields"
- "Find sensitive data"
- "List all personal information"
- "What PHI do we have?"

**Compliance checks:**
- "Are we GDPR compliant?"
- "Show me financial data"
- "List high-sensitivity fields"

### 💻 Generating SQL

**Create queries:**
- "Generate SQL to find top 10 customers"
- "Write a query for recent orders"
- "Create SQL to calculate monthly revenue"
- "Query to find duplicate records"

**The AI will provide:**
- ✅ Complete SQL query
- ✅ Explanation of what it does
- ✅ Tables and fields used
- ✅ Any warnings or considerations

### 💡 Getting Recommendations

**Ask for advice:**
- "How can I improve data quality?"
- "What should I do about failed pipelines?"
- "Best practices for data governance"
- "How to optimize my workflows?"

## Pro Tips

### 🎯 Be Specific
**Better:** "Show me quality issues in the orders table"
**Not as good:** "Show me quality"

### 💬 Ask Follow-up Questions
The AI remembers your conversation! After asking about a table, you can simply say:
- "What's the quality score?" (It knows you mean the table from your previous question)
- "Show me its lineage"
- "Are there any issues?"

### 🔄 Use Natural Language
Don't worry about perfect phrasing. The AI understands variations:
- "Find customer tables" = "Show me tables with customer data" = "List customer-related tables"

### 📝 Check Suggestions
The AI often provides suggestions for next steps or related queries - try clicking on them!

## Common Patterns

### Pattern 1: Investigate a Table

```
You: "Show me the customers table"
AI: [Provides table details]

You: "What's the quality score?"
AI: [Shows quality metrics]

You: "Show me lineage"
AI: [Displays lineage diagram]

You: "Any recommendations?"
AI: [Suggests improvements]
```

### Pattern 2: Troubleshoot Quality Issues

```
You: "Show me tables with quality issues"
AI: [Lists tables with problems]

You: "Tell me more about the orders table"
AI: [Detailed quality report]

You: "What validation rules are failing?"
AI: [Lists failing rules]

You: "How do I fix this?"
AI: [Provides recommendations]
```

### Pattern 3: Monitor System Health

```
You: "System status"
AI: [Shows overall platform health]

You: "Any failed pipelines?"
AI: [Lists failures if any]

You: "Show me quality trends"
AI: [Displays quality metrics]
```

## Understanding Responses

### Response Types

The AI provides different types of responses:

#### 📝 **Text Responses**
Simple answers to your questions with explanations.

#### 📊 **Data Tables**
Structured data showing assets, metrics, or statistics.

#### 💻 **SQL Code**
When you ask for queries, you'll get formatted SQL code.

#### 📈 **Analysis**
Detailed breakdowns with insights and recommendations.

#### 🎨 **Visualizations**
For lineage and complex relationships (when applicable).

### Reading Responses

Responses include:
- **Main Answer**: The direct answer to your question
- **Confidence Score**: How confident the AI is (shown as a percentage)
- **Recommendations**: Suggested next steps
- **Related Assets**: Links to relevant data assets
- **Processing Time**: How long it took to answer

## Examples by Role

### For Data Analysts

```
"Find all tables with customer demographics"
"Generate SQL to calculate monthly active users"
"Show me data freshness for reporting tables"
"What's the completeness score for analytics tables?"
```

### For Data Engineers

```
"Show me failed pipeline jobs"
"List all ETL workflows"
"What's the lineage for the aggregated_sales table?"
"Find tables that need quality rules"
```

### For Data Stewards

```
"Show me all PII fields"
"What tables have quality issues?"
"List data classification for customer data"
"Which assets need governance review?"
```

### For Business Users

```
"Where can I find customer information?"
"Show me available sales data"
"What reports are available?"
"How recent is the data in customers table?"
```

## Advanced Features

### Session Management

Your conversations are saved per session. This means:
- The AI remembers your previous questions
- You can have contextual follow-up conversations
- Each browser tab has its own conversation

**To start fresh:** Refresh the page or use the "Clear Conversation" button

### Smart Caching

- Frequently asked questions are cached for faster responses
- Data is refreshed every minute automatically
- You always get up-to-date information

### Fallback Modes

If the AI service is temporarily unavailable:
1. You'll get rule-based responses (still helpful!)
2. Basic search functionality remains available
3. Cached responses are used when possible

## Keyboard Shortcuts

- **Enter**: Send message
- **Shift + Enter**: New line (not yet implemented)
- **Esc**: Clear input box (not yet implemented)

## Common Questions

### "Why is my response taking a while?"
The AI is fetching real-time data from multiple services. First-time queries may take 2-3 seconds.

### "Can I export the conversation?"
Not yet, but this feature is planned!

### "Does it remember old conversations?"
Currently, conversations are session-based. Long-term memory is planned.

### "Can I customize the AI's behavior?"
Advanced preferences are coming soon!

### "Is my data secure?"
Yes! All queries require authentication, and conversations are not stored permanently.

## Tips for Best Results

✅ **DO:**
- Ask clear, specific questions
- Use natural language
- Ask follow-up questions
- Try the suggested queries
- Provide context when needed

❌ **DON'T:**
- Use technical jargon unnecessarily
- Ask multiple unrelated questions at once
- Expect the AI to modify data (it's read-only)
- Include sensitive credentials in queries

## Getting Help

If you're not getting the results you expect:

1. **Rephrase your question** - Try asking in a different way
2. **Be more specific** - Add table names, schema names, or other details
3. **Check the documentation** - See example queries
4. **Contact support** - If something seems broken

## Feedback

We're constantly improving the AI Assistant! If you:
- Get an unhelpful response
- Have suggestions for new features
- Find a bug
- Want to share a great experience

Please let the data governance team know!

## Example Conversation

Here's a complete example of how you might use the AI Assistant:

```
🧑 You: "Hello"
🤖 AI: "Hi! I'm your AI Data Assistant. I can help you find data,
       check quality, explore lineage, and more. What would you
       like to know?"

🧑 You: "Find tables with customer information"
🤖 AI: "I found 8 tables with customer information:
       - customers (public) - Main customer data
       - customer_addresses (public) - Shipping addresses
       - customer_orders (sales) - Order history
       ..."

🧑 You: "What's the quality score for customers?"
🤖 AI: "Quality Report for customers:
       Overall Score: 92%
       Issues Found: 3
       Last Check: 2025-10-13 10:30 AM

       Active Rules: 5
       - Email validation: Passing
       - Phone format: 2 issues
       - Address completeness: 1 issue

       ⚠️ Action Required: Review phone number formats"

🧑 You: "How do I fix the phone number issues?"
🤖 AI: "Recommendations for fixing phone number validation:
       1. Standardize phone format to (XXX) XXX-XXXX
       2. Add validation rule for international numbers
       3. Review and clean existing data
       4. Implement input validation in source systems

       Would you like me to generate a quality rule for this?"

🧑 You: "Yes please"
🤖 AI: "Here's a quality rule for phone number validation:

       ```sql
       RULE: phone_standardization
       REGEX: ^\(\d{3}\) \d{3}-\d{4}$
       FIELD: customer_phone
       SEVERITY: MEDIUM

       This rule validates phone numbers in the format (XXX) XXX-XXXX
       ```"
```

## Quick Reference

| I Want To... | Ask... |
|--------------|--------|
| Find data | "Find tables with [keyword]" |
| Check quality | "Show me quality for [table]" |
| See lineage | "Show lineage for [table]" |
| Monitor pipelines | "Pipeline status" |
| Get statistics | "How many assets do we have?" |
| Find sensitive data | "Show me PII fields" |
| Generate SQL | "Generate SQL to [task]" |
| Get help | "What can you help me with?" |

## Conclusion

The AI Assistant is designed to make your data governance tasks easier and more intuitive. Don't hesitate to experiment and ask questions - that's what it's here for!

**Remember:** The more you use it, the better it gets at understanding your needs.

Happy querying! 🚀

---

**Need Help?** Ask the AI: "What can you help me with?"
**Want Examples?** Ask: "Show me example queries"
**Report Issues:** Contact the data governance team

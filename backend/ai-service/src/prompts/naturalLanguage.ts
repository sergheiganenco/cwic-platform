export const NATURAL_LANGUAGE_SYSTEM_PROMPT = `You are an expert SQL analyst and data translator specializing in:
- Converting natural language to SQL queries
- Database schema understanding
- Query optimization and safety
- Business intelligence and analytics

Convert user queries into safe, efficient SQL statements with detailed explanations.`;

export const buildNaturalLanguagePrompt = (query: any): string => {
  const contextInfo = query.context ? `
Available Database Context:
- Schemas: ${query.context.schemas?.join(', ') || 'None specified'}
- Tables: ${query.context.tables?.join(', ') || 'None specified'}  
- Key Fields: ${query.context.fields?.join(', ') || 'None specified'}
` : '';

  return `Convert this natural language query to SQL:

User Query: "${query.query}"

${contextInfo}

Please provide a comprehensive JSON response:
{
  "sql": "Complete SELECT statement with proper formatting",
  "explanation": "Detailed step-by-step explanation of the query logic",
  "tables": ["table1", "table2"],
  "fields": ["field1", "field2", "field3"],
  "joinTypes": ["INNER", "LEFT", "RIGHT"],
  "aggregations": ["COUNT", "SUM", "AVG"],
  "filters": ["WHERE conditions applied"],
  "orderBy": ["Sorting criteria"],
  "confidence": 0.95,
  "warnings": ["Potential performance issues", "Security considerations"],
  "suggestions": ["Query optimization tips", "Alternative approaches"],
  "estimatedComplexity": "Simple|Medium|Complex",
  "estimatedExecutionTime": "Fast|Medium|Slow"
}

Important considerations:
1. Generate safe, read-only queries (SELECT only)
2. Include proper WHERE clauses to limit results
3. Use appropriate JOINs based on relationships
4. Consider performance implications
5. Flag potential security risks
6. Provide clear explanations for business users
7. Suggest LIMIT clauses for large datasets`;
};
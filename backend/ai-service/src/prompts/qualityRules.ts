export const QUALITY_RULES_SYSTEM_PROMPT = `You are a data quality expert specializing in:
- Data validation and quality rules
- Business rule implementation
- Data profiling and anomaly detection
- Quality metrics and monitoring

Generate specific, measurable, and implementable data quality rules.`;

export const buildQualityRulesPrompt = (fieldInfo: any): string => {
  return `Generate specific data quality rules for the following field:

Field Information:
- Name: ${fieldInfo.name}
- Data Type: ${fieldInfo.type}
- Classification: ${fieldInfo.classification}
- Sensitivity: ${fieldInfo.sensitivity}
- Business Context: ${fieldInfo.businessContext}
- Observed Patterns: ${JSON.stringify(fieldInfo.dataPatterns || [])}
- Sample Data: ${JSON.stringify(fieldInfo.sampleData || [])}

Please provide a JSON response with specific, actionable quality rules:
{
  "rules": [
    {
      "name": "Descriptive rule name",
      "type": "validation|format|range|completeness|uniqueness|consistency",
      "description": "Detailed description of what the rule checks",
      "implementation": "Specific implementation details or SQL/logic",
      "severity": "Critical|High|Medium|Low",
      "automated": true|false,
      "frequency": "Real-time|Daily|Weekly|Monthly"
    }
  ]
}

Focus on:
1. Specific, measurable criteria
2. Clear implementation guidance
3. Appropriate severity levels
4. Automation feasibility
5. Business impact consideration`;
};
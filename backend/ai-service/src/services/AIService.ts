import { openai } from '@config/openai';
import { logger } from '@utils/logger';
import { CacheService } from './CacheService';

export interface FieldDiscoveryRequest {
  schema: string;
  tableName: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    description?: string;
  }>;
  sampleData?: any[];
  context?: string;
}

export interface FieldDiscoveryResponse {
  fields: Array<{
    name: string;
    type: string;
    classification: 'PII' | 'PHI' | 'Financial' | 'General';
    sensitivity: 'High' | 'Medium' | 'Low';
    description: string;
    suggestedRules: string[];
    dataPatterns: string[];
    businessContext: string;
  }>;
  recommendations: {
    governance: string[];
    quality: string[];
    compliance: string[];
  };
  confidence: number;
  isAiGenerated: boolean; // Track if this came from AI or fallback
}

export interface NaturalLanguageQuery {
  query: string;
  context?: {
    schemas: string[];
    tables: string[];
    fields: string[];
  };
}

export interface QueryResult {
  sql: string;
  explanation: string;
  tables: string[];
  fields: string[];
  confidence: number;
  warnings: string[];
  isAiGenerated: boolean;
}

export class AIService {
  private cacheService: CacheService;

  constructor() {
    this.cacheService = new CacheService();
  }

  public async discoverFields(request: FieldDiscoveryRequest): Promise<FieldDiscoveryResponse> {
    try {
      const cacheKey = `field_discovery:${JSON.stringify(request)}`;
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        logger.info('Returning cached field discovery result');
        return JSON.parse(cached);
      }

      // Check if OpenAI is available
      if (!openai.isAvailable()) {
        logger.warn('OpenAI not available - using fallback field discovery');
        return this.fallbackFieldDiscovery(request);
      }

      const prompt = this.buildFieldDiscoveryPrompt(request);
      
      const response = await openai.createChatCompletion({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert data governance analyst specializing in field classification, 
                     data sensitivity analysis, and compliance requirements. Analyze database fields 
                     and provide comprehensive governance recommendations.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000'),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
        response_format: { type: 'json_object' }
      });

      if (!response || !response.choices[0]?.message?.content) {
        logger.warn('No response from OpenAI - using fallback');
        return this.fallbackFieldDiscovery(request);
      }

      const result = JSON.parse(response.choices[0].message.content) as FieldDiscoveryResponse;
      result.isAiGenerated = true;
      
      // Cache the result for 1 hour
      await this.cacheService.set(cacheKey, JSON.stringify(result), 3600);
      
      logger.info('Field discovery completed successfully with AI', {
        schema: request.schema,
        table: request.tableName,
        fieldsAnalyzed: request.columns.length
      });

      return result;

    } catch (error) {
      logger.error('AI field discovery failed, using fallback:', error);
      return this.fallbackFieldDiscovery(request);
    }
  }

  public async processNaturalLanguageQuery(query: NaturalLanguageQuery): Promise<QueryResult> {
    try {
      const cacheKey = `nlq:${JSON.stringify(query)}`;
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        logger.info('Returning cached natural language query result');
        return JSON.parse(cached);
      }

      // Check if OpenAI is available
      if (!openai.isAvailable()) {
        logger.warn('OpenAI not available - using fallback query processing');
        return this.fallbackNaturalLanguageQuery(query);
      }

      const prompt = this.buildNLQueryPrompt(query);
      
      const response = await openai.createChatCompletion({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert SQL analyst. Convert natural language queries into 
                     SQL statements with detailed explanations and safety warnings.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000'),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
        response_format: { type: 'json_object' }
      });

      if (!response || !response.choices[0]?.message?.content) {
        logger.warn('No response from OpenAI - using fallback');
        return this.fallbackNaturalLanguageQuery(query);
      }

      const result = JSON.parse(response.choices[0].message.content) as QueryResult;
      result.isAiGenerated = true;
      
      // Cache the result for 30 minutes
      await this.cacheService.set(cacheKey, JSON.stringify(result), 1800);
      
      logger.info('Natural language query processed successfully with AI');
      return result;

    } catch (error) {
      logger.error('AI query processing failed, using fallback:', error);
      return this.fallbackNaturalLanguageQuery(query);
    }
  }

  public async generateQualityRules(fieldInfo: any): Promise<string[]> {
    try {
      if (!openai.isAvailable()) {
        logger.warn('OpenAI not available - using fallback quality rules');
        return this.fallbackQualityRules(fieldInfo);
      }

      const prompt = `Generate data quality rules for the following field:
        Field Name: ${fieldInfo.name}
        Data Type: ${fieldInfo.type}
        Classification: ${fieldInfo.classification}
        Sample Data: ${JSON.stringify(fieldInfo.sampleData || [])}
        
        Return a JSON array of specific, actionable quality rules.`;

      const response = await openai.createChatCompletion({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a data quality expert. Generate specific, measurable quality rules.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      if (!response || !response.choices[0]?.message?.content) {
        return this.fallbackQualityRules(fieldInfo);
      }

      const result = JSON.parse(response.choices[0].message.content);
      return result.rules || this.fallbackQualityRules(fieldInfo);

    } catch (error) {
      logger.error('AI quality rule generation failed, using fallback:', error);
      return this.fallbackQualityRules(fieldInfo);
    }
  }

  public async explainViolation(violation: any): Promise<string> {
    try {
      if (!openai.isAvailable()) {
        return this.fallbackViolationExplanation(violation);
      }

      const prompt = `Explain this data quality violation in simple terms:
        Rule: ${violation.rule}
        Field: ${violation.field}
        Value: ${violation.value}
        Error: ${violation.error}
        
        Provide a clear explanation and suggested fix.`;

      const response = await openai.createChatCompletion({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful data analyst explaining quality issues.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      if (!response || !response.choices[0]?.message?.content) {
        return this.fallbackViolationExplanation(violation);
      }

      return response.choices[0].message.content;

    } catch (error) {
      logger.error('AI violation explanation failed, using fallback:', error);
      return this.fallbackViolationExplanation(violation);
    }
  }

  // Fallback methods for when AI is not available
  private fallbackFieldDiscovery(request: FieldDiscoveryRequest): FieldDiscoveryResponse {
    const fields = request.columns.map(col => {
      const classification = this.classifyFieldBasic(col.name, col.type);
      const sensitivity = this.determineSensitivityBasic(classification);
      
      return {
        name: col.name,
        type: col.type,
        classification,
        sensitivity,
        description: `${col.type} field containing ${classification.toLowerCase()} data`,
        suggestedRules: this.getBasicQualityRules(col.type, classification),
        dataPatterns: this.detectBasicPatterns(col.name, col.type),
        businessContext: `Data field in ${request.tableName} table`
      };
    });

    return {
      fields,
      recommendations: {
        governance: ['Implement data classification policy', 'Set up access controls'],
        quality: ['Add data validation rules', 'Monitor data quality metrics'],
        compliance: ['Review compliance requirements', 'Implement audit logging']
      },
      confidence: 0.7, // Lower confidence for rule-based classification
      isAiGenerated: false
    };
  }

  private fallbackNaturalLanguageQuery(query: NaturalLanguageQuery): QueryResult {
    // Simple keyword-based SQL generation
    const lowerQuery = query.query.toLowerCase();
    let sql = 'SELECT ';
    
    if (lowerQuery.includes('count') || lowerQuery.includes('how many')) {
      sql += 'COUNT(*) ';
    } else {
      sql += '* ';
    }
    
    sql += 'FROM ';
    
    // Try to detect table names from context or query
    if (query.context?.tables && query.context.tables.length > 0) {
      sql += query.context.tables[0];
    } else if (lowerQuery.includes('user')) {
      sql += 'users';
    } else if (lowerQuery.includes('order')) {
      sql += 'orders';
    } else {
      sql += 'table_name';
    }

    return {
      sql,
      explanation: 'Basic SQL query generated using keyword matching (AI not available)',
      tables: query.context?.tables || ['table_name'],
      fields: query.context?.fields || ['*'],
      confidence: 0.3, // Low confidence for keyword-based generation
      warnings: ['AI service not available - this is a basic keyword-based query'],
      isAiGenerated: false
    };
  }

  private fallbackQualityRules(fieldInfo: any): string[] {
    const rules = [];
    
    if (fieldInfo.type?.includes('varchar') || fieldInfo.type?.includes('text')) {
      rules.push('Validate string length');
      rules.push('Check for null values');
    }
    
    if (fieldInfo.type?.includes('int') || fieldInfo.type?.includes('number')) {
      rules.push('Validate numeric range');
      rules.push('Check for negative values');
    }
    
    if (fieldInfo.name?.toLowerCase().includes('email')) {
      rules.push('Validate email format');
    }
    
    if (fieldInfo.name?.toLowerCase().includes('phone')) {
      rules.push('Validate phone number format');
    }
    
    return rules.length > 0 ? rules : ['Basic data validation required'];
  }

  private fallbackViolationExplanation(violation: any): string {
    return `Data quality issue detected in field "${violation.field}". The rule "${violation.rule}" failed because: ${violation.error}. Please review the data and apply appropriate corrections.`;
  }

  // Helper methods for basic classification
  private classifyFieldBasic(name: string, type: string): 'PII' | 'PHI' | 'Financial' | 'General' {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('email') || lowerName.includes('phone') || lowerName.includes('name')) {
      return 'PII';
    }
    if (lowerName.includes('medical') || lowerName.includes('health')) {
      return 'PHI';
    }
    if (lowerName.includes('payment') || lowerName.includes('amount') || lowerName.includes('price')) {
      return 'Financial';
    }
    
    return 'General';
  }

  private determineSensitivityBasic(classification: string): 'High' | 'Medium' | 'Low' {
    switch (classification) {
      case 'PHI': return 'High';
      case 'PII': case 'Financial': return 'Medium';
      default: return 'Low';
    }
  }

  private getBasicQualityRules(type: string, classification: string): string[] {
    const rules = ['Not null validation'];
    
    if (type.includes('varchar')) {
      rules.push('String length validation');
    }
    
    if (classification === 'PII' || classification === 'PHI') {
      rules.push('Data encryption required');
    }
    
    return rules;
  }

  private detectBasicPatterns(name: string, type: string): string[] {
    const patterns = [];
    
    if (name.toLowerCase().includes('email')) {
      patterns.push('Email format');
    }
    if (name.toLowerCase().includes('phone')) {
      patterns.push('Phone number format');
    }
    if (type.includes('date') || type.includes('timestamp')) {
      patterns.push('Date format');
    }
    
    return patterns;
  }

  // Existing helper methods...
  private buildFieldDiscoveryPrompt(request: FieldDiscoveryRequest): string {
    return `Analyze the following database table and provide comprehensive field classification:

Schema: ${request.schema}
Table: ${request.tableName}
Context: ${request.context || 'Not provided'}

Columns:
${request.columns.map(col => 
  `- ${col.name} (${col.type}) ${col.nullable ? 'NULLABLE' : 'NOT NULL'} ${col.description ? '- ' + col.description : ''}`
).join('\n')}

${request.sampleData ? `Sample Data (first 5 rows):
${JSON.stringify(request.sampleData.slice(0, 5), null, 2)}` : ''}

Please provide a JSON response with comprehensive field analysis.`;
  }

  private buildNLQueryPrompt(query: NaturalLanguageQuery): string {
    const contextInfo = query.context ? `
Available Context:
- Schemas: ${query.context.schemas?.join(', ') || 'None'}
- Tables: ${query.context.tables?.join(', ') || 'None'}
- Fields: ${query.context.fields?.join(', ') || 'None'}
` : '';

    return `Convert this natural language query to SQL:
"${query.query}"

${contextInfo}

Please provide a JSON response with SQL and explanation.`;
  }
}
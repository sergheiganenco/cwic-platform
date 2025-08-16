// src/processors/SchemaProcessor.ts
import { logger } from '@utils/logger';
import FieldProcessor, { FieldInfo } from './FieldProcessor';

export interface SchemaInfo {
  name: string;
  tables: TableInfo[];
}

export interface TableInfo {
  schema: string;
  name: string;
  columns: FieldInfo[];
  rowCount?: number;
  relationships?: RelationshipInfo[];
}

export interface RelationshipInfo {
  type: 'foreign_key' | 'one_to_many' | 'many_to_many';
  targetTable: string;
  targetColumn: string;
  sourceColumn: string;
}

export interface ProcessedTable extends TableInfo {
  processedColumns: Array<
    FieldInfo & { classification: string; sensitivity: string; patterns: string[] }
  >;
  governance: {
    classification: string;
    sensitivity: string;
    complianceFrameworks: string[];
    suggestedPolicies: string[];
  };
}

export interface SchemaSummary {
  totalTables: number;
  totalColumns: number;
  sensitiveDataTables: number;
  complianceRequirements: string[];
  recommendations: string[];
}

export interface ProcessedSchema {
  name: string;
  tables: ProcessedTable[];
  summary: SchemaSummary;
}

export class SchemaProcessor {
  private readonly fieldProcessor: FieldProcessor;

  constructor() {
    this.fieldProcessor = new FieldProcessor();
  }

  public async processSchema(schema: SchemaInfo): Promise<ProcessedSchema> {
    try {
      logger.info('Processing schema', { schema: schema.name, tables: schema.tables.length });

      const processedTables = await Promise.all(
        schema.tables.map((table) => this.processTable(table))
      );

      const summary = this.generateSchemaSummary(processedTables);

      return { name: schema.name, tables: processedTables, summary };
    } catch (error) {
      logger.error('Schema processing failed:', error);
      throw error;
    }
  }

  private async processTable(table: TableInfo): Promise<ProcessedTable> {
    try {
      const processedColumns = this.fieldProcessor.processFields(table.columns);
      const governance = this.generateTableGovernance(processedColumns);

      return { ...table, processedColumns, governance };
    } catch (error) {
      logger.error('Table processing failed:', { table: table.name, error });
      throw error;
    }
  }

  private generateTableGovernance(
    processedColumns: ProcessedTable['processedColumns']
  ): ProcessedTable['governance'] {
    const classifications = processedColumns.map((c) => c.classification);
    const sensitivities = processedColumns.map((c) => c.sensitivity);

    const hasPhiData = classifications.includes('PHI');
    const hasPiiData = classifications.includes('PII');
    const hasFinancialData = classifications.includes('Financial');

    let classification = 'General';
    if (hasPhiData) classification = 'PHI';
    else if (hasPiiData) classification = 'PII';
    else if (hasFinancialData) classification = 'Financial';

    let sensitivity = 'Low';
    if (sensitivities.includes('High')) sensitivity = 'High';
    else if (sensitivities.includes('Medium')) sensitivity = 'Medium';

    const complianceFrameworks: string[] = [];
    if (hasPhiData) complianceFrameworks.push('HIPAA');
    if (hasPiiData) complianceFrameworks.push('GDPR', 'CCPA');
    if (hasFinancialData) complianceFrameworks.push('SOX', 'PCI-DSS');

    const suggestedPolicies: string[] = [];
    if (sensitivity === 'High') {
      suggestedPolicies.push('Data encryption required', 'Access approval required', 'Regular access reviews');
    }
    if (hasPiiData || hasPhiData) {
      suggestedPolicies.push('Data retention policy', 'Right to be forgotten procedures');
    }

    return { classification, sensitivity, complianceFrameworks, suggestedPolicies };
  }

  private generateSchemaSummary(tables: ProcessedTable[]): SchemaSummary {
    const totalTables = tables.length;
    const totalColumns = tables.reduce((sum, t) => sum + t.columns.length, 0);
    const sensitiveDataTables = tables.filter(
      (t) => t.governance.sensitivity === 'High' || t.governance.sensitivity === 'Medium'
    ).length;

    const complianceSet = new Set<string>();
    for (const t of tables) {
      for (const f of t.governance.complianceFrameworks) complianceSet.add(f);
    }

    const recommendations: string[] = [
      `${sensitiveDataTables} of ${totalTables} tables contain sensitive data`,
      'Implement role-based access controls',
      'Regular compliance audits recommended',
      'Consider data classification labels',
    ];
    if (complianceSet.has('GDPR')) recommendations.push('GDPR compliance review required');
    if (complianceSet.has('HIPAA')) recommendations.push('HIPAA security controls needed');

    return {
      totalTables,
      totalColumns,
      sensitiveDataTables,
      complianceRequirements: Array.from(complianceSet),
      recommendations,
    };
  }
}

// export both ways so AnalysisService can `new (mod.SchemaProcessor ?? mod.default)()`
export default SchemaProcessor;

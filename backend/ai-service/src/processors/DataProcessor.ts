// src/processors/DataProcessor.ts
import type {
  DataSample,
  IDataProcessor,
  QualityIssue,
} from '@/services/AnalysisService';

export class DataProcessor implements IDataProcessor {
  async analyzeSampleData(
    samples: DataSample[],
  ): Promise<{ analysis: Record<string, unknown>[]; qualityIssues: QualityIssue[] }> {
    const analysis: Record<string, unknown>[] = [];
    const qualityIssues: QualityIssue[] = [];

    for (const s of samples) {
      const values = Array.isArray(s.values) ? s.values : [];
      const nonNull = values.filter((v) => v !== null && v !== undefined);
      const nulls = values.length - nonNull.length;

      const uniqueCount = new Set(nonNull.map((v) => JSON.stringify(v))).size;

      analysis.push({
        column: s.columnName,
        count: values.length,
        nulls,
        nullRate: values.length ? +(nulls / values.length * 100).toFixed(2) : 0,
        uniqueCount,
        sample: nonNull.slice(0, 5),
      });

      if (nulls > 0) {
        qualityIssues.push({
          column: s.columnName,
          type: 'null_values',
          severity: nulls / (values.length || 1) > 0.2 ? 'High' : 'Low',
          count: nulls,
          message: 'Column contains null/undefined values',
          sample: values.slice(0, 5),
        });
      }

      const lower = s.columnName.toLowerCase();

      if (lower.includes('email')) {
        const bad = nonNull.filter(
          (v) => typeof v === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        );
        if (bad.length) {
          qualityIssues.push({
            column: s.columnName,
            type: 'format_inconsistency',
            severity: bad.length / (nonNull.length || 1) > 0.05 ? 'Medium' : 'Low',
            count: bad.length,
            message: 'Invalid email addresses detected',
            sample: bad.slice(0, 5),
          });
        }
      }

      if (lower.includes('phone')) {
        const bad = nonNull.filter(
          (v) => typeof v === 'string' && !/^\+?[0-9().\- ]{7,}$/.test(v),
        );
        if (bad.length) {
          qualityIssues.push({
            column: s.columnName,
            type: 'format_inconsistency',
            severity: bad.length / (nonNull.length || 1) > 0.05 ? 'Medium' : 'Low',
            count: bad.length,
            message: 'Invalid phone numbers detected',
            sample: bad.slice(0, 5),
          });
        }
      }
    }

    return { analysis, qualityIssues };
  }
}

export default DataProcessor;

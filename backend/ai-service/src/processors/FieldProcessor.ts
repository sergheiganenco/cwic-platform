// src/processors/FieldProcessor.ts
export interface FieldInfo {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
}

export type Classification = 'PII' | 'PHI' | 'Financial' | 'General';
export type Sensitivity = 'Low' | 'Medium' | 'High';

export interface ProcessedField extends FieldInfo {
  classification: Classification;
  sensitivity: Sensitivity;
  patterns: string[];
}

/** Very lightweight field classifier used by SchemaProcessor */
export class FieldProcessor {
  processFields(fields: FieldInfo[]): ProcessedField[] {
    return fields.map((f) => {
      const classification = this.classify(f);
      const sensitivity = this.sensitivityFromClass(classification);
      const patterns = this.detectPatterns(f);

      return { ...f, classification, sensitivity, patterns };
    });
  }

  private classify(f: FieldInfo): Classification {
    const n = f.name.toLowerCase();
    if (/(email|first_?name|last_?name|phone|ssn|address)/.test(n)) return 'PII';
    if (/(health|medical|patient|diagnosis)/.test(n)) return 'PHI';
    if (/(payment|amount|price|card|invoice|billing)/.test(n)) return 'Financial';
    return 'General';
    }

  private sensitivityFromClass(c: Classification): Sensitivity {
    if (c === 'PHI') return 'High';
    if (c === 'PII' || c === 'Financial') return 'Medium';
    return 'Low';
  }

  private detectPatterns(f: FieldInfo): string[] {
    const out: string[] = [];
    const n = f.name.toLowerCase();
    if (n.includes('email')) out.push('email');
    if (n.includes('phone')) out.push('phone');
    if (/(date|timestamp)/.test(f.type.toLowerCase())) out.push('date');
    return out;
  }
}

export default FieldProcessor;

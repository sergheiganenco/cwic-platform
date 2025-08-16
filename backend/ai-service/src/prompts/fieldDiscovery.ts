// src/prompts/fieldDiscovery.ts

/* eslint-disable max-lines */
type Sensitivity =
  | 'Low'
  | 'Medium'
  | 'High'
  | 'Critical';

type Classification =
  | 'General'
  | 'PII'
  | 'PHI'
  | 'Financial';

export interface FieldDiscoveryColumn {
  name: string;
  type: string;
  nullable: boolean;
  description?: string | null | undefined;
  /** Optional small set of example values for extra context */
  exampleValues?: readonly unknown[] | null | undefined;
}

export interface FieldDiscoveryResultField {
  name: string;
  type: string;
  classification: Classification;
  sensitivity: Sensitivity;
  description: string;
  suggestedRules: string[];
  dataPatterns: string[];
  businessContext: string;
}

export interface FieldDiscoveryRequest {
  schema: string;
  tableName: string;
  /** Optional business context of the table */
  context?: string | null | undefined;
  /** Table columns */
  columns: readonly FieldDiscoveryColumn[];
  /** Optional sample data (records/rows) */
  sampleData?: readonly Record<string, unknown>[] | null | undefined;
  /** Optional region for compliance nuance */
  region?: 'US' | 'EU' | 'Global';
  /** Optional hint for how deep the analysis should go */
  aiAnalysisDepth?: 'basic' | 'detailed' | 'comprehensive';
}

export const FIELD_DISCOVERY_SYSTEM_PROMPT = `
You are an expert data governance analyst specializing in:
- Field classification and data sensitivity analysis
- Compliance requirements (GDPR, HIPAA, CCPA, SOX, PCI-DSS)
- Data quality and governance best practices
- Business context understanding

GENERAL PRINCIPLES
- Be precise, practical, and implementation-oriented.
- Prefer least-privilege and data minimization.
- Recommend enforceable validation and indexing strategies when useful.

RESPONSE FORMAT (STRICT)
- Respond with STRICT JSON only. Do NOT include markdown, prose, or comments.
- Use these enums exactly:
  classification: "General" | "PII" | "PHI" | "Financial"
  sensitivity: "Low" | "Medium" | "High" | "Critical"
- Confidence is 0..1 (number).
- Recommendations arrays must be concise and actionable.
`.trim();

/**
 * Build a robust user prompt for field discovery.
 * - Strong typing (no implicit any)
 * - Sanitizes and truncates inputs to control token size
 * - Adds light heuristics to give the model helpful hints
 */
export function buildFieldDiscoveryPrompt(
  request: FieldDiscoveryRequest,
  opts?: {
    maxSampleRows?: number;
    maxCharsPerValue?: number;
    maxColumns?: number;
  }
): string {
  const maxSampleRows = Number.isFinite(opts?.maxSampleRows) ? Math.max(0, Number(opts?.maxSampleRows)) : 5;
  const maxCharsPerValue = Number.isFinite(opts?.maxCharsPerValue) ? Math.max(16, Number(opts?.maxCharsPerValue)) : 120;
  const maxColumns = Number.isFinite(opts?.maxColumns) ? Math.max(1, Number(opts?.maxColumns)) : 200;

  const cleanContext = sanitizeText(request.context);
  const cleanRegion = request.region ?? 'Global';
  const depth = request.aiAnalysisDepth ?? 'detailed';

  const columns = (request.columns ?? []).slice(0, maxColumns).map(safeColumn);
  const hints = buildHeuristicHints(columns);

  const sample = pruneSampleData(request.sampleData ?? [], maxSampleRows, maxCharsPerValue);

  const columnsBlock = columns
    .map((col) => {
      const nullable = col.nullable ? 'NULLABLE' : 'NOT NULL';
      const desc = col.description ? ` - ${sanitizeInline(col.description)}` : '';
      const examples = (col.exampleValues && col.exampleValues.length)
        ? ` (examples: ${stringifyInline(col.exampleValues.slice(0, 3), maxCharsPerValue)})`
        : '';
      return `- ${col.name} (${col.type}) ${nullable}${desc}${examples}`;
    })
    .join('\n');

  const sampleBlock = sample.length
    ? `Sample Data (first ${sample.length} rows):
${JSON.stringify(sample, null, 2)}`
    : '';

  const hintsBlock = hints.length
    ? `Heuristic Hints:
${hints.map((h) => `- ${h}`).join('\n')}`
    : '';

  // Final strict instructions to shape output for downstream services
  const strictJsonContract = `
RETURN STRICT JSON ONLY (no markdown, no comments) with this structure:
{
  "fields": [
    {
      "name": "field_name",
      "type": "data_type",
      "classification": "PII|PHI|Financial|General",
      "sensitivity": "High|Medium|Low|Critical",
      "description": "clear business meaning and purpose",
      "suggestedRules": ["specific quality rule 1", "specific quality rule 2"],
      "dataPatterns": ["observed pattern 1", "observed pattern 2"],
      "businessContext": "business context and usage"
    }
  ],
  "recommendations": {
    "governance": ["actionable governance recommendation 1", "recommendation 2"],
    "quality": ["actionable quality recommendation 1", "recommendation 2"],
    "compliance": ["specific compliance requirement 1", "requirement 2"]
  },
  "confidence": 0.0-1.0
}

CONSTRAINTS
- Keep arrays concise (max 5 items each) and prioritize high impact actions.
- Prefer column-specific recommendations over generic advice.
- Match enum values exactly as specified.
- If uncertain about a field, mark classification "General" with lower confidence.
`.trim();

  const userPrompt = `
Analyze the following database table and provide comprehensive field classification.

Context:
- Schema: ${sanitizeInline(request.schema)}
- Table: ${sanitizeInline(request.tableName)}
- Region: ${cleanRegion}
- Depth: ${depth}
${cleanContext ? `- Business Context: ${sanitizeInline(cleanContext)}` : ''}

Columns:
${columnsBlock}

${sampleBlock ? `\n${sampleBlock}\n` : ''}

${hintsBlock ? `\n${hintsBlock}\n` : ''}

${strictJsonContract}

FOCUS AREAS
1) Accurate classification based on names, types, and sample data.
2) Practical quality rules (validation, uniqueness, ranges, referential integrity).
3) Specific compliance requirements (GDPR/HIPAA/PCI-DSS/CCPA/SOX) relevant to the region.
4) Clear business value and usage context for each field.
5) Actionable, high-impact recommendations.
`.trim();

  return userPrompt;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */

function sanitizeText(input?: string | null | undefined): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  // very light sanitization to cut obvious prompt-injection vectors
  return trimmed.replace(/[<>]/g, '');
}

function sanitizeInline(input: string): string {
  return sanitizeText(input) ?? '';
}

function safeColumn(col: FieldDiscoveryColumn): FieldDiscoveryColumn {
  return {
    name: String(col.name).trim(),
    type: String(col.type).trim(),
    nullable: Boolean(col.nullable),
    description: col.description ?? undefined,
    exampleValues: col.exampleValues ?? undefined,
  };
}

function stringifyInline(values: readonly unknown[], maxCharsPerValue: number): string {
  return values
    .map((v) => compactValue(v, maxCharsPerValue))
    .join(', ');
}

function compactValue(v: unknown, maxCharsPerValue: number): string {
  try {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    const trimmed = (s ?? '').toString();
    if (trimmed.length <= maxCharsPerValue) return trimmed;
    return trimmed.slice(0, maxCharsPerValue) + '…';
  } catch {
    return '[unserializable]';
  }
}

function pruneSampleData(
  rows: readonly Record<string, unknown>[],
  maxRows: number,
  maxCharsPerValue: number
): Record<string, unknown>[] {
  const limited = rows.slice(0, Math.max(0, maxRows));
  return limited.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) {
        out[k] = v as null | undefined;
        continue;
      }
      if (typeof v === 'string') {
        out[k] = redactString(v, maxCharsPerValue);
      } else if (typeof v === 'number' || typeof v === 'boolean') {
        out[k] = v;
      } else if (v instanceof Date) {
        out[k] = v.toISOString();
      } else {
        // stringify and truncate complex values
        out[k] = compactValue(v, maxCharsPerValue);
      }
    }
    return out;
  });
}

function redactString(s: string, maxChars: number): string {
  // simple redactions for PII-ish patterns
  const emailRx = /([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/gi;
  const phoneRx = /\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,6}/g;
  const ssnRx = /\b\d{3}-?\d{2}-?\d{4}\b/g;

  let out = s.replace(emailRx, (_, user, host) => `${user[0]}***@${host}`);
  out = out.replace(phoneRx, (m) => m.slice(0, 3) + '***' + m.slice(-2));
  out = out.replace(ssnRx, '***-**-****');

  if (out.length <= maxChars) return out;
  return out.slice(0, maxChars) + '…';
}

function buildHeuristicHints(columns: readonly FieldDiscoveryColumn[]): string[] {
  const hints: string[] = [];

  for (const col of columns) {
    const name = col.name.toLowerCase();
    const type = col.type.toLowerCase();

    if (/email/.test(name)) {
      hints.push(`Column "${col.name}" likely contains email addresses → consider "PII" with Medium sensitivity and format validation.`);
    }
    if (/(phone|mobile|cell)/.test(name)) {
      hints.push(`Column "${col.name}" likely contains phone numbers → consider "PII"; recommend E.164 normalization and validation.`);
    }
    if (/(ssn|social[_-]?security)/.test(name)) {
      hints.push(`Column "${col.name}" may be SSN → consider "PII" with High sensitivity; encryption at rest, restricted access.`);
    }
    if (/(dob|date[_-]?of[_-]?birth|birth[_-]?date)/.test(name) || (type.includes('date') && /birth/.test(name))) {
      hints.push(`Column "${col.name}" looks like date of birth → "PII" with Medium/High sensitivity depending on jurisdiction.`);
    }
    if (/(card|cc|credit[_-]?card)/.test(name)) {
      hints.push(`Column "${col.name}" may be card data → classify "Financial" with High sensitivity; tokenize or avoid storing PAN.`);
    }
    if (/(amount|price|salary|income|revenue)/.test(name)) {
      hints.push(`Column "${col.name}" is financial metric → classify "Financial" (usually Medium sensitivity), enforce numeric ranges.`);
    }
    if (/(patient|diagnosis|medical|icd|phi)/.test(name)) {
      hints.push(`Column "${col.name}" suggests PHI → classify "PHI" with High/Critical sensitivity and HIPAA safeguards.`);
    }
    if (/(ip[_-]?address|ipv4|ipv6)/.test(name)) {
      hints.push(`Column "${col.name}" may store IPs → treat as "PII" in some frameworks; consider anonymization/retention policy.`);
    }
    if (/password|secret|token|api[_-]?key/.test(name)) {
      hints.push(`Column "${col.name}" looks like a credential/secret → do not store raw; hash/tokenize and restrict access.`);
    }
  }

  return Array.from(new Set(hints)).slice(0, 12); // cap to keep the prompt lean
}

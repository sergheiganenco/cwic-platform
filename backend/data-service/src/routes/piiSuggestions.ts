// PII Rule Suggestions API - Analyzes existing data to suggest patterns
import { Request, Response, Router } from 'express';
import { Pool } from 'pg';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ok = <T>(res: Response, data: T) => res.json({ success: true, data });
const fail = (res: Response, code: number, message: string) =>
  res.status(code).json({ success: false, error: message });

/**
 * GET /api/pii-suggestions/columns
 * Get all columns from catalog that could be used to create PII rules
 */
router.get('/columns', async (req: Request, res: Response) => {
  try {
    const { search, limit = 100 } = req.query;

    let query = `
      SELECT
        cc.id,
        cc.column_name,
        cc.data_type,
        cc.pii_type,
        cc.data_classification,
        ca.name as table_name,
        ca.schema as schema_name,
        ds.name as data_source_name,
        ds.id as data_source_id,
        ca.database_name,
        cc.sample_values
      FROM catalog_columns cc
      JOIN catalog_assets ca ON ca.id = cc.asset_id
      JOIN data_sources ds ON ds.id = ca.data_source_id
      WHERE ca.type IN ('table', 'view')
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (
        cc.column_name ILIKE $${paramIndex} OR
        ca.name ILIKE $${paramIndex} OR
        ds.name ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY ds.name, ca.name, cc.column_name LIMIT $${paramIndex}`;
    params.push(Number(limit));

    const { rows } = await pool.query(query, params);

    ok(res, rows);
  } catch (error: any) {
    console.error('Error fetching column suggestions:', error);
    fail(res, 500, error.message);
  }
});

/**
 * POST /api/pii-suggestions/analyze
 * Analyze a specific column and suggest PII rule patterns
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { columnId, dataSourceId, databaseName, schemaName, tableName, columnName } = req.body;

    // Get sample values for the column
    let sampleValues: string[] = [];

    if (columnId) {
      // Get from catalog_columns
      const { rows } = await pool.query(
        `SELECT sample_values FROM catalog_columns WHERE id = $1`,
        [columnId]
      );

      if (rows.length > 0 && rows[0].sample_values) {
        sampleValues = rows[0].sample_values;
      }
    } else if (dataSourceId && databaseName && schemaName && tableName && columnName) {
      // Fetch directly from data source
      // This would require connection to the actual data source
      // For now, return empty suggestions
    }

    if (sampleValues.length === 0) {
      return ok(res, {
        suggestions: {
          regex_pattern: null,
          examples: [],
          confidence: 0,
          pattern_explanation: 'No sample data available for analysis',
        },
      });
    }

    // Analyze sample values and suggest patterns
    const analysis = analyzeSampleValues(sampleValues);

    ok(res, {
      suggestions: analysis,
      sample_values: sampleValues.slice(0, 10), // Return first 10 samples
    });
  } catch (error: any) {
    console.error('Error analyzing column:', error);
    fail(res, 500, error.message);
  }
});

/**
 * Analyze sample values and suggest regex patterns
 */
function analyzeSampleValues(samples: string[]): {
  regex_pattern: string | null;
  examples: string[];
  confidence: number;
  pattern_explanation: string;
  detected_format?: string;
} {
  if (samples.length === 0) {
    return {
      regex_pattern: null,
      examples: [],
      confidence: 0,
      pattern_explanation: 'No sample data available',
    };
  }

  // Filter out nulls and empty strings
  const validSamples = samples.filter(s => s != null && s.toString().trim() !== '');

  if (validSamples.length === 0) {
    return {
      regex_pattern: null,
      examples: [],
      confidence: 0,
      pattern_explanation: 'All sample values are null or empty',
    };
  }

  // Convert to strings
  const stringValues = validSamples.map(v => String(v).trim());

  // Detect common patterns
  const patterns = [
    {
      name: 'Email',
      regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      test: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      explanation: 'Standard email address format',
    },
    {
      name: 'Phone (US)',
      regex: '^\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}$',
      test: /^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
      explanation: 'US phone number with optional formatting',
    },
    {
      name: 'SSN',
      regex: '^\\d{3}-\\d{2}-\\d{4}$',
      test: /^\d{3}-\d{2}-\d{4}$/,
      explanation: 'Social Security Number (XXX-XX-XXXX)',
    },
    {
      name: 'UUID',
      regex: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
      test: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      explanation: 'UUID format',
    },
    {
      name: 'Credit Card',
      regex: '^\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}$',
      test: /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/,
      explanation: 'Credit card number with optional separators',
    },
    {
      name: 'Date (ISO)',
      regex: '^\\d{4}-\\d{2}-\\d{2}$',
      test: /^\d{4}-\d{2}-\d{2}$/,
      explanation: 'ISO date format (YYYY-MM-DD)',
    },
    {
      name: 'Numeric ID',
      regex: '^\\d+$',
      test: /^\d+$/,
      explanation: 'Numeric identifier',
    },
    {
      name: 'Alphanumeric Code',
      regex: '^[A-Z0-9]+$',
      test: /^[A-Z0-9]+$/,
      explanation: 'Uppercase alphanumeric code',
    },
  ];

  // Test each pattern
  for (const pattern of patterns) {
    const matches = stringValues.filter(v => pattern.test.test(v));
    const confidence = (matches.length / stringValues.length) * 100;

    if (confidence >= 80) {
      // High confidence match
      return {
        regex_pattern: pattern.regex,
        examples: stringValues.slice(0, 5),
        confidence: Math.round(confidence),
        pattern_explanation: pattern.explanation,
        detected_format: pattern.name,
      };
    }
  }

  // No specific pattern detected, try to infer from data
  const lengths = stringValues.map(v => v.length);
  const minLength = Math.min(...lengths);
  const maxLength = Math.max(...lengths);
  const avgLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);

  // Check if all values have same length
  if (minLength === maxLength) {
    const firstValue = stringValues[0];

    // Check if it's all digits
    if (/^\d+$/.test(firstValue)) {
      return {
        regex_pattern: `^\\d{${minLength}}$`,
        examples: stringValues.slice(0, 5),
        confidence: 70,
        pattern_explanation: `Fixed-length numeric value (${minLength} digits)`,
        detected_format: 'Fixed Numeric',
      };
    }

    // Check if it's alphanumeric
    if (/^[A-Z0-9]+$/i.test(firstValue)) {
      // Detect pattern (e.g., ABC123 → AAA999)
      let patternStr = '';
      for (let i = 0; i < minLength; i++) {
        const char = firstValue[i];
        if (/[A-Z]/i.test(char)) {
          patternStr += '[A-Z]';
        } else if (/\d/.test(char)) {
          patternStr += '\\d';
        } else {
          patternStr += '\\' + char;
        }
      }

      return {
        regex_pattern: `^${patternStr}$`,
        examples: stringValues.slice(0, 5),
        confidence: 60,
        pattern_explanation: `Fixed-length alphanumeric pattern (${minLength} characters)`,
        detected_format: 'Fixed Alphanumeric',
      };
    }
  }

  // Variable length - suggest a generic pattern
  if (/^\d+$/.test(stringValues.join(''))) {
    return {
      regex_pattern: `^\\d{${minLength},${maxLength}}$`,
      examples: stringValues.slice(0, 5),
      confidence: 50,
      pattern_explanation: `Variable-length numeric (${minLength}-${maxLength} digits)`,
      detected_format: 'Variable Numeric',
    };
  }

  // Fallback - just return examples without regex
  return {
    regex_pattern: null,
    examples: stringValues.slice(0, 5),
    confidence: 0,
    pattern_explanation: 'Unable to detect consistent pattern. Please define regex manually.',
  };
}

/**
 * POST /api/pii-suggestions/discover-hints
 * Discover SPECIFIC COLUMNS (not just column names) matching a PII rule's pattern
 * Returns actual columns with table/database context for user approval
 */
router.post('/discover-hints', async (req: Request, res: Response) => {
  try {
    const { piiType, regexPattern, existingHints = [] } = req.body;

    if (!piiType) {
      return fail(res, 400, 'piiType is required');
    }

    // Get ALL specific columns (not aggregated) with full context
    const { rows: allColumns } = await pool.query(`
      SELECT
        cc.id as column_id,
        cc.column_name,
        cc.data_type,
        cc.pii_type as current_pii_type,
        cc.is_sensitive,
        ca.id as asset_id,
        ca.table_name,
        ca.schema_name,
        ca.database_name,
        ds.id as data_source_id,
        ds.name as data_source_name,
        ds.type as data_source_type,
        cc.sample_values
      FROM catalog_columns cc
      JOIN catalog_assets ca ON ca.id = cc.asset_id
      JOIN data_sources ds ON ds.id::text = ca.datasource_id::text
      WHERE ca.type IN ('table', 'view')
        AND cc.column_name IS NOT NULL
        AND cc.column_name != ''
        AND cc.pii_type IS NULL
      ORDER BY ds.name, ca.database_name, ca.schema_name, ca.table_name, cc.column_name
    `);

    console.log(`[Discover Hints] Found ${allColumns.length} unclassified columns for PII type: ${piiType}`);

    // Filter and score columns
    const suggestions = [];
    const existingHintsLower = existingHints.map((h: string) => h.toLowerCase());

    for (const col of allColumns) {
      const columnName = col.column_name.toLowerCase();

      // Skip if column name already in hints (exact match)
      if (existingHintsLower.some(hint => hint === columnName)) {
        continue;
      }

      let matchScore = 0;
      let matchReason = '';
      let matchDetails: string[] = [];

      // Check if column name matches regex pattern (if provided)
      if (regexPattern) {
        try {
          const regex = new RegExp(regexPattern, 'i');
          if (regex.test(columnName)) {
            matchScore += 50;
            matchDetails.push('Matches regex pattern');
          }
        } catch (e) {
          // Invalid regex, skip regex matching
        }
      }

      // Check if column name contains PII type keywords
      const piiKeywords = getPIIKeywords(piiType);
      for (const keyword of piiKeywords) {
        if (columnName.includes(keyword.toLowerCase())) {
          matchScore += 30;
          matchDetails.push(`Contains "${keyword}"`);
        }
      }

      // Check if column name has common PII suffixes/prefixes
      const piiPatterns = ['_name', '_email', '_phone', '_address', '_ssn', '_number', '_id'];
      for (const pattern of piiPatterns) {
        if (columnName.includes(pattern)) {
          matchScore += 5;
        }
      }

      if (matchScore > 0) {
        matchReason = matchDetails.join(', ') || 'Potential match';

        suggestions.push({
          column_id: col.column_id,
          column_name: col.column_name,
          data_type: col.data_type,
          current_pii_type: col.current_pii_type,
          is_sensitive: col.is_sensitive,
          asset_id: col.asset_id,
          table_name: col.table_name,
          schema_name: col.schema_name,
          database_name: col.database_name,
          data_source_id: col.data_source_id,
          data_source_name: col.data_source_name,
          data_source_type: col.data_source_type,
          full_path: `${col.data_source_name}.${col.database_name}.${col.schema_name}.${col.table_name}.${col.column_name}`,
          match_score: matchScore,
          match_reason: matchReason,
          sample_values: col.sample_values ? col.sample_values.slice(0, 3) : [], // First 3 samples for preview
        });
      }
    }

    // Sort by match score descending
    suggestions.sort((a, b) => b.match_score - a.match_score);

    console.log(`[Discover Hints] Returning ${suggestions.length} column suggestions for ${piiType}`);

    ok(res, {
      suggestions: suggestions.slice(0, 100), // Return top 100 specific columns
      total_found: suggestions.length,
      pii_type: piiType,
    });
  } catch (error: any) {
    console.error('Error discovering hints:', error);
    fail(res, 500, error.message);
  }
});

/**
 * Get relevant keywords for a PII type
 */
function getPIIKeywords(piiType: string): string[] {
  const keywordMap: Record<string, string[]> = {
    email: ['email', 'mail', 'e_mail'],
    phone: ['phone', 'mobile', 'telephone', 'cell'],
    ssn: ['ssn', 'social', 'security'],
    name: ['name', 'first', 'last', 'full'],
    address: ['address', 'street', 'city', 'state', 'zip', 'postal'],
    credit_card: ['card', 'credit', 'cc', 'payment'],
    ip_address: ['ip', 'address'],
    date_of_birth: ['birth', 'dob', 'birthday'],
    driver_license: ['license', 'dl', 'driver'],
    passport: ['passport'],
    zip_code: ['zip', 'postal'],
  };

  return keywordMap[piiType.toLowerCase()] || [piiType];
}

export default router;

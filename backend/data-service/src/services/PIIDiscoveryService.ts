/**
 * PII Discovery Service
 *
 * Analyzes existing catalog columns to suggest PII rule configurations.
 * Helps users discover what name patterns, email patterns, etc. exist
 * in their actual databases before creating rules.
 */

import { Pool } from 'pg';

interface ColumnPattern {
  pattern: string; // e.g., "name", "email", "phone"
  columns: Array<{
    column_name: string;
    table_name: string;
    schema_name: string;
    database_name: string;
    data_source_name: string;
    data_type: string;
    sample_values?: string[];
    current_pii_type?: string;
  }>;
  occurrences: number;
  suggested_hints: string[];
  suggested_regex?: string;
  confidence: 'high' | 'medium' | 'low';
}

interface PIITypeDiscovery {
  pii_type_suggestion: string; // e.g., "CUSTOMER_NAME", "EMAIL_ADDRESS"
  display_name: string;
  patterns: ColumnPattern[];
  total_columns: number;
  category: 'financial' | 'personal' | 'contact' | 'identifier' | 'health' | 'custom';
  description: string;
}

export class PIIDiscoveryService {
  constructor(private pool: Pool) {}

  /**
   * Discover potential PII patterns in catalog by analyzing column names
   */
  async discoverPIIPatterns(options?: {
    dataSourceId?: string;
    category?: string;
    minOccurrences?: number;
  }): Promise<PIITypeDiscovery[]> {
    const minOccurrences = options?.minOccurrences || 2;

    try {
      // Get all columns with their metadata
      let query = `
        SELECT
          cc.column_name,
          cc.data_type,
          cc.pii_type,
          cc.sample_values,
          ca.table_name,
          ca.schema_name,
          ca.database_name,
          ds.name as data_source_name,
          ds.id as data_source_id
        FROM catalog_columns cc
        JOIN catalog_assets ca ON ca.id = cc.asset_id
        LEFT JOIN data_sources ds ON ds.id::text = ca.datasource_id::text
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (options?.dataSourceId) {
        query += ` AND ca.datasource_id::text = $${paramIndex}`;
        params.push(options.dataSourceId);
        paramIndex++;
      }

      query += ` ORDER BY cc.column_name`;

      const { rows } = await this.pool.query(query, params);

      // Group columns by pattern
      const patternGroups = this.groupColumnsByPattern(rows);

      // Convert to discovery format
      const discoveries: PIITypeDiscovery[] = [];

      // Name patterns
      const namePatterns = this.extractPatterns(patternGroups, [
        'name', 'first_name', 'last_name', 'full_name', 'customer_name',
        'user_name', 'employee_name', 'contact_name', 'person_name',
        'fname', 'lname', 'fullname', 'firstname', 'lastname'
      ]);
      if (namePatterns.length >= minOccurrences) {
        discoveries.push(this.createDiscovery('NAME', 'Person Name', namePatterns, 'personal'));
      }

      // Email patterns
      const emailPatterns = this.extractPatterns(patternGroups, [
        'email', 'email_address', 'e_mail', 'mail', 'contact_email',
        'user_email', 'customer_email', 'work_email', 'personal_email'
      ]);
      if (emailPatterns.length >= minOccurrences) {
        discoveries.push(this.createDiscovery('EMAIL', 'Email Address', emailPatterns, 'contact'));
      }

      // Phone patterns
      const phonePatterns = this.extractPatterns(patternGroups, [
        'phone', 'phone_number', 'telephone', 'mobile', 'cell', 'tel',
        'contact_phone', 'home_phone', 'work_phone', 'cell_phone',
        'mobile_number', 'phone_no', 'phonenumber'
      ]);
      if (phonePatterns.length >= minOccurrences) {
        discoveries.push(this.createDiscovery('PHONE', 'Phone Number', phonePatterns, 'contact'));
      }

      // Address patterns
      const addressPatterns = this.extractPatterns(patternGroups, [
        'address', 'street', 'city', 'state', 'zip', 'zipcode', 'postal',
        'country', 'street_address', 'billing_address', 'shipping_address',
        'home_address', 'mailing_address', 'address_line'
      ]);
      if (addressPatterns.length >= minOccurrences) {
        discoveries.push(this.createDiscovery('ADDRESS', 'Address', addressPatterns, 'contact'));
      }

      // SSN patterns
      const ssnPatterns = this.extractPatterns(patternGroups, [
        'ssn', 'social_security', 'social_security_number', 'tax_id'
      ]);
      if (ssnPatterns.length >= minOccurrences) {
        discoveries.push(this.createDiscovery('SSN', 'Social Security Number', ssnPatterns, 'identifier'));
      }

      // Credit card patterns
      const ccPatterns = this.extractPatterns(patternGroups, [
        'credit_card', 'card_number', 'cc_number', 'payment_card',
        'card_no', 'cc', 'creditcard'
      ]);
      if (ccPatterns.length >= minOccurrences) {
        discoveries.push(this.createDiscovery('CREDIT_CARD', 'Credit Card', ccPatterns, 'financial'));
      }

      // Date of Birth patterns
      const dobPatterns = this.extractPatterns(patternGroups, [
        'dob', 'date_of_birth', 'birth_date', 'birthdate', 'birthday'
      ]);
      if (dobPatterns.length >= minOccurrences) {
        discoveries.push(this.createDiscovery('DATE_OF_BIRTH', 'Date of Birth', dobPatterns, 'personal'));
      }

      return discoveries;
    } catch (error) {
      console.error('Error discovering PII patterns:', error);
      throw error;
    }
  }

  /**
   * Get column suggestions for a specific pattern keyword
   */
  async getColumnSuggestions(keyword: string, options?: {
    dataSourceId?: string;
    limit?: number;
  }): Promise<{
    columns: Array<{
      column_name: string;
      table_name: string;
      schema_name: string;
      database_name: string;
      data_source_name: string;
      data_type: string;
      sample_values?: string[];
      current_pii_type?: string;
      full_path: string;
    }>;
    suggested_hints: string[];
    suggested_pii_types: string[];
  }> {
    const limit = options?.limit || 50;

    try {
      let query = `
        SELECT
          cc.column_name,
          cc.data_type,
          cc.pii_type,
          cc.sample_values,
          ca.table_name,
          ca.schema_name,
          ca.database_name,
          ds.name as data_source_name
        FROM catalog_columns cc
        JOIN catalog_assets ca ON ca.id = cc.asset_id
        LEFT JOIN data_sources ds ON ds.id::text = ca.datasource_id::text
        WHERE LOWER(cc.column_name) LIKE LOWER($1)
      `;

      const params: any[] = [`%${keyword}%`];
      let paramIndex = 2;

      if (options?.dataSourceId) {
        query += ` AND ca.datasource_id::text = $${paramIndex}`;
        params.push(options.dataSourceId);
        paramIndex++;
      }

      query += ` ORDER BY cc.column_name LIMIT $${paramIndex}`;
      params.push(limit);

      const { rows } = await this.pool.query(query, params);

      // Extract unique column name patterns
      const uniqueNames = new Set<string>();
      rows.forEach(row => uniqueNames.add(row.column_name.toLowerCase()));

      const suggested_hints = Array.from(uniqueNames).slice(0, 10);

      // Extract existing PII types for these columns
      const existingPIITypes = new Set<string>();
      rows.forEach(row => {
        if (row.pii_type) existingPIITypes.add(row.pii_type);
      });

      const columns = rows.map(row => ({
        column_name: row.column_name,
        table_name: row.table_name,
        schema_name: row.schema_name,
        database_name: row.database_name,
        data_source_name: row.data_source_name,
        data_type: row.data_type,
        sample_values: row.sample_values,
        current_pii_type: row.pii_type,
        full_path: `${row.data_source_name}.${row.database_name}.${row.schema_name}.${row.table_name}.${row.column_name}`
      }));

      return {
        columns,
        suggested_hints,
        suggested_pii_types: Array.from(existingPIITypes)
      };
    } catch (error) {
      console.error('Error getting column suggestions:', error);
      throw error;
    }
  }

  /**
   * Analyze a specific data source and suggest PII rules
   */
  async analyzeDataSource(dataSourceId: string): Promise<{
    dataSourceName: string;
    totalColumns: number;
    potentialPIIColumns: number;
    discoveries: PIITypeDiscovery[];
    recommendations: string[];
  }> {
    try {
      // Get data source info
      const { rows: dsRows } = await this.pool.query(
        'SELECT name FROM data_sources WHERE id = $1',
        [dataSourceId]
      );

      if (dsRows.length === 0) {
        throw new Error('Data source not found');
      }

      const dataSourceName = dsRows[0].name;

      // Count total columns
      const { rows: countRows } = await this.pool.query(
        `SELECT COUNT(*) as total
         FROM catalog_columns cc
         JOIN catalog_assets ca ON ca.id = cc.asset_id
         WHERE ca.datasource_id::text = $1`,
        [dataSourceId]
      );

      const totalColumns = parseInt(countRows[0].total);

      // Discover patterns
      const discoveries = await this.discoverPIIPatterns({ dataSourceId, minOccurrences: 1 });

      const potentialPIIColumns = discoveries.reduce((sum, d) => sum + d.total_columns, 0);

      // Generate recommendations
      const recommendations: string[] = [];
      discoveries.forEach(d => {
        if (d.total_columns > 0) {
          recommendations.push(
            `Found ${d.total_columns} potential ${d.display_name} column(s). ` +
            `Consider creating a "${d.pii_type_suggestion}" rule with hints: ${d.patterns[0]?.suggested_hints.slice(0, 3).join(', ')}`
          );
        }
      });

      return {
        dataSourceName,
        totalColumns,
        potentialPIIColumns,
        discoveries,
        recommendations
      };
    } catch (error) {
      console.error('Error analyzing data source:', error);
      throw error;
    }
  }

  // Helper methods

  private groupColumnsByPattern(rows: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    rows.forEach(row => {
      const columnName = row.column_name.toLowerCase();

      // Add to exact match group
      if (!groups.has(columnName)) {
        groups.set(columnName, []);
      }
      groups.get(columnName)!.push(row);
    });

    return groups;
  }

  private extractPatterns(patternGroups: Map<string, any[]>, keywords: string[]): any[] {
    const matchedColumns: any[] = [];

    patternGroups.forEach((columns, columnName) => {
      const matches = keywords.some(keyword =>
        columnName.includes(keyword.toLowerCase())
      );

      if (matches) {
        matchedColumns.push(...columns);
      }
    });

    return matchedColumns;
  }

  private createDiscovery(
    piiType: string,
    displayName: string,
    columns: any[],
    category: PIITypeDiscovery['category']
  ): PIITypeDiscovery {
    // Extract unique column name patterns
    const columnNameSet = new Set<string>();
    columns.forEach(col => columnNameSet.add(col.column_name.toLowerCase()));
    const suggested_hints = Array.from(columnNameSet).slice(0, 10);

    // Group by column name for pattern analysis
    const patternMap = new Map<string, any[]>();
    columns.forEach(col => {
      const key = col.column_name.toLowerCase();
      if (!patternMap.has(key)) {
        patternMap.set(key, []);
      }
      patternMap.get(key)!.push(col);
    });

    const patterns: ColumnPattern[] = Array.from(patternMap.entries()).map(([pattern, cols]) => ({
      pattern,
      columns: cols.map(c => ({
        column_name: c.column_name,
        table_name: c.table_name,
        schema_name: c.schema_name,
        database_name: c.database_name,
        data_source_name: c.data_source_name,
        data_type: c.data_type,
        sample_values: c.sample_values,
        current_pii_type: c.pii_type
      })),
      occurrences: cols.length,
      suggested_hints: [pattern],
      confidence: cols.length > 5 ? 'high' : cols.length > 2 ? 'medium' : 'low'
    }));

    return {
      pii_type_suggestion: piiType,
      display_name: displayName,
      patterns: patterns.sort((a, b) => b.occurrences - a.occurrences),
      total_columns: columns.length,
      category,
      description: this.getDescription(piiType)
    };
  }

  private getDescription(piiType: string): string {
    const descriptions: Record<string, string> = {
      NAME: 'Personal names including first name, last name, full name, etc.',
      EMAIL: 'Email addresses for contact or identification',
      PHONE: 'Phone numbers including mobile, home, and work numbers',
      ADDRESS: 'Physical addresses including street, city, state, zip',
      SSN: 'Social Security Numbers and tax identifiers',
      CREDIT_CARD: 'Credit card and payment card numbers',
      DATE_OF_BIRTH: 'Dates of birth and birthday information'
    };

    return descriptions[piiType] || 'Sensitive personal information';
  }
}

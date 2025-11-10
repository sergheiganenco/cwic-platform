import { Pool } from 'pg';
import { logger } from '@utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { DiscoveredField } from './FieldDiscoveryService';

export class FieldDiscoveryDBService {
  private pool: Pool;

  constructor() {
    // Use direct config for Docker environment
    const isDocker = process.env.IS_DOCKER === 'true' || process.env.NODE_ENV === 'production';

    if (isDocker) {
      // Inside Docker, use container hostname
      this.pool = new Pool({
        host: 'db',
        port: 5432,
        database: 'cwic_platform',
        user: 'cwic_user',
        password: 'cwic_secure_pass',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    } else {
      // Outside Docker, use localhost
      this.pool = new Pool({
        host: 'localhost',
        port: 5432,
        database: 'cwic_platform',
        user: 'cwic_user',
        password: 'cwic_secure_pass',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }

    logger.info('FieldDiscoveryDBService initialized', { isDocker });
  }

  /**
   * Create a new field discovery session
   */
  async createSession(datasourceId: string, options?: {
    schemas?: string[];
    tables?: string[];
    triggeredBy?: string;
  }): Promise<string> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO field_discovery_sessions
         (datasource_id, target_schemas, target_tables, triggered_by, session_type)
         VALUES ($1, $2, $3, $4, 'manual')
         RETURNING id`,
        [
          datasourceId,
          options?.schemas || null,
          options?.tables || null,
          options?.triggeredBy || 'system'
        ]
      );
      return result.rows[0].id;
    } catch (error) {
      logger.error('Failed to create discovery session', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update session with results
   */
  async updateSession(sessionId: string, results: {
    fieldsDiscovered: number;
    fieldsClassified: number;
    piiFieldsFound: number;
    status: 'completed' | 'failed';
    errorMessage?: string;
  }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE field_discovery_sessions
         SET fields_discovered = $1,
             fields_classified = $2,
             pii_fields_found = $3,
             status = $4,
             error_message = $5,
             completed_at = NOW(),
             duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
         WHERE id = $6`,
        [
          results.fieldsDiscovered,
          results.fieldsClassified,
          results.piiFieldsFound,
          results.status,
          results.errorMessage || null,
          sessionId
        ]
      );
    } catch (error) {
      logger.error('Failed to update discovery session', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Save discovered fields to database
   */
  async saveDiscoveredFields(fields: DiscoveredField[], datasourceId: string, sessionId?: string): Promise<void> {
    if (!fields || fields.length === 0) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const field of fields) {
        // First, try to find existing field
        const existing = await client.query(
          `SELECT id, status FROM discovered_fields
           WHERE datasource_id = $1 AND schema_name = $2
           AND table_name = $3 AND field_name = $4`,
          [datasourceId, field.schema, field.tableName, field.fieldName]
        );

        if (existing.rows.length > 0) {
          // Update existing field (but preserve status if it was already reviewed)
          const preserveStatus = existing.rows[0].status !== 'pending';

          await client.query(
            `UPDATE discovered_fields
             SET data_type = $1,
                 classification = $2,
                 sensitivity = $3,
                 confidence = $4,
                 description = $5,
                 business_context = $6,
                 suggested_tags = $7,
                 suggested_rules = $8,
                 data_patterns = $9,
                 is_ai_generated = $10,
                 asset_id = $11,
                 updated_at = NOW(),
                 status = CASE WHEN $12 THEN status ELSE 'pending' END
             WHERE id = $13`,
            [
              field.dataType,
              field.classification,
              field.sensitivity,
              field.confidence,
              field.description,
              field.businessContext,
              field.suggestedTags,
              field.suggestedRules,
              field.dataPatterns,
              field.isAiGenerated,
              field.assetId,
              preserveStatus,
              existing.rows[0].id
            ]
          );

          // Log classification change if it changed
          if (sessionId) {
            await client.query(
              `INSERT INTO field_classification_history
               (field_id, new_classification, new_sensitivity, new_status,
                change_reason, changed_by, session_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                existing.rows[0].id,
                field.classification,
                field.sensitivity,
                preserveStatus ? existing.rows[0].status : 'pending',
                'Field re-discovered',
                'system',
                sessionId
              ]
            );
          }
        } else {
          // Insert new field
          const newFieldId = await client.query(
            `INSERT INTO discovered_fields
             (datasource_id, asset_id, field_name, schema_name, table_name,
              data_type, classification, sensitivity, confidence,
              description, business_context, suggested_tags, suggested_rules,
              data_patterns, is_ai_generated, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending')
             RETURNING id`,
            [
              datasourceId,
              field.assetId,
              field.fieldName,
              field.schema,
              field.tableName,
              field.dataType,
              field.classification,
              field.sensitivity,
              field.confidence,
              field.description,
              field.businessContext,
              field.suggestedTags,
              field.suggestedRules,
              field.dataPatterns,
              field.isAiGenerated
            ]
          );

          // Log initial classification
          if (sessionId) {
            await client.query(
              `INSERT INTO field_classification_history
               (field_id, new_classification, new_sensitivity, new_status,
                change_reason, changed_by, session_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                newFieldId.rows[0].id,
                field.classification,
                field.sensitivity,
                'pending',
                'Initial discovery',
                'system',
                sessionId
              ]
            );
          }
        }
      }

      await client.query('COMMIT');
      logger.info('Saved discovered fields to database', { count: fields.length });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to save discovered fields', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get discovered fields from database
   */
  async getDiscoveredFields(filter?: {
    datasourceId?: string;
    dataSourceId?: string;  // Support both naming conventions
    status?: string;
    classification?: string;
    sensitivity?: string;
    search?: string;
    database?: string;
    table?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ fields: DiscoveredField[]; total: number }> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT
          df.*,
          ca.table_name as asset_name
        FROM discovered_fields df
        LEFT JOIN catalog_assets ca ON df.asset_id = ca.id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramCount = 0;

      // Support both naming conventions for dataSourceId
      const dsId = filter?.datasourceId || filter?.dataSourceId;
      if (dsId) {
        query += ` AND df.datasource_id = $${++paramCount}`;
        params.push(dsId);
      }

      if (filter?.database) {
        query += ` AND df.schema_name = $${++paramCount}`;
        params.push(filter.database);
      }

      if (filter?.table) {
        query += ` AND df.table_name = $${++paramCount}`;
        params.push(filter.table);
      }

      if (filter?.status) {
        query += ` AND df.status = $${++paramCount}`;
        params.push(filter.status);
      }

      if (filter?.classification) {
        query += ` AND df.classification = $${++paramCount}`;
        params.push(filter.classification);
      }

      if (filter?.sensitivity) {
        query += ` AND df.sensitivity = $${++paramCount}`;
        params.push(filter.sensitivity);
      }

      if (filter?.search) {
        query += ` AND (
          df.field_name ILIKE $${++paramCount} OR
          df.table_name ILIKE $${paramCount} OR
          df.description ILIKE $${paramCount}
        )`;
        params.push(`%${filter.search}%`);
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM (${query}) as subquery`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      // Add pagination
      query += ' ORDER BY df.created_at DESC';

      if (filter?.limit) {
        query += ` LIMIT $${++paramCount}`;
        params.push(filter.limit);
      }

      if (filter?.offset) {
        query += ` OFFSET $${++paramCount}`;
        params.push(filter.offset);
      }

      const result = await client.query(query, params);

      const fields: DiscoveredField[] = result.rows.map(row => ({
        id: row.id,
        assetId: row.asset_id,
        assetName: row.asset_name || `${row.schema_name}.${row.table_name}`,
        fieldName: row.field_name,
        schema: row.schema_name,
        tableName: row.table_name,
        dataType: row.data_type,
        classification: row.classification,
        sensitivity: row.sensitivity,
        description: row.description,
        suggestedTags: row.suggested_tags || [],
        suggestedRules: row.suggested_rules || [],
        dataPatterns: row.data_patterns || [],
        businessContext: row.business_context,
        confidence: parseFloat(row.confidence || 0),
        status: row.status,
        detectedAt: row.detected_at,
        reviewedAt: row.reviewed_at,
        reviewedBy: row.reviewed_by,
        isAiGenerated: row.is_ai_generated
      }));

      return { fields, total };
    } catch (error) {
      logger.error('Failed to get discovered fields', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update field status (accept/reject/needs-review)
   */
  async updateFieldStatus(fieldId: string, status: string, userId?: string): Promise<DiscoveredField | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current field state
      const currentResult = await client.query(
        'SELECT * FROM discovered_fields WHERE id = $1',
        [fieldId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Field not found');
      }

      const current = currentResult.rows[0];

      // Update field status
      const result = await client.query(
        `UPDATE discovered_fields
         SET status = $1,
             reviewed_at = CASE WHEN $1 != 'pending' THEN NOW() ELSE reviewed_at END,
             reviewed_by = CASE WHEN $1 != 'pending' THEN $2 ELSE reviewed_by END,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [String(status), String(userId || 'user'), fieldId]
      );

      // Commit the status update first
      await client.query('COMMIT');

      // Log status change separately (optional - don't fail main operation if this fails)
      try {
        await client.query(
          `INSERT INTO field_classification_history
           (field_id, previous_status, new_status, change_reason, changed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            fieldId,
            String(current.status),
            String(status),
            'Manual review',
            userId || 'user'
          ]
        );
      } catch (historyError) {
        // Log error but don't fail the main operation
        console.warn('Failed to log status change history:', historyError);
      }

      const updated = result.rows[0];
      return {
        id: updated.id,
        assetId: updated.asset_id,
        assetName: `${updated.schema_name}.${updated.table_name}`,
        fieldName: updated.field_name,
        schema: updated.schema_name,
        tableName: updated.table_name,
        dataType: updated.data_type,
        classification: updated.classification,
        sensitivity: updated.sensitivity,
        description: updated.description,
        suggestedTags: updated.suggested_tags || [],
        suggestedRules: updated.suggested_rules || [],
        dataPatterns: updated.data_patterns || [],
        businessContext: updated.business_context,
        confidence: parseFloat(updated.confidence || 0),
        status: updated.status,
        detectedAt: updated.detected_at,
        reviewedAt: updated.reviewed_at,
        reviewedBy: updated.reviewed_by,
        isAiGenerated: updated.is_ai_generated
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update field status', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get field discovery statistics
   */
  async getStats(datasourceId?: string): Promise<any> {
    const client = await this.pool.connect();
    try {
      let whereClause = '';
      const params: any[] = [];

      if (datasourceId) {
        whereClause = 'WHERE datasource_id = $1';
        params.push(datasourceId);
      }

      const result = await client.query(`
        SELECT
          COUNT(*) as total_fields,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
          COUNT(CASE WHEN status = 'needs-review' THEN 1 END) as needs_review,
          COUNT(CASE WHEN classification = 'PII' THEN 1 END) as pii,
          COUNT(CASE WHEN classification = 'PHI' THEN 1 END) as phi,
          COUNT(CASE WHEN classification = 'Financial' THEN 1 END) as financial,
          COUNT(CASE WHEN classification = 'General' THEN 1 END) as general,
          COUNT(CASE WHEN sensitivity = 'Critical' THEN 1 END) as critical,
          COUNT(CASE WHEN sensitivity = 'High' THEN 1 END) as high,
          COUNT(CASE WHEN sensitivity = 'Medium' THEN 1 END) as medium,
          COUNT(CASE WHEN sensitivity = 'Low' THEN 1 END) as low,
          AVG(confidence) as avg_confidence,
          COUNT(CASE WHEN detected_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_discoveries
        FROM discovered_fields
        ${whereClause}
      `, params);

      const stats = result.rows[0];

      return {
        totalFields: parseInt(stats.total_fields),
        byStatus: {
          pending: parseInt(stats.pending),
          accepted: parseInt(stats.accepted),
          rejected: parseInt(stats.rejected),
          'needs-review': parseInt(stats.needs_review)
        },
        byClassification: {
          PII: parseInt(stats.pii),
          PHI: parseInt(stats.phi),
          Financial: parseInt(stats.financial),
          General: parseInt(stats.general)
        },
        bySensitivity: {
          Critical: parseInt(stats.critical),
          High: parseInt(stats.high),
          Medium: parseInt(stats.medium),
          Low: parseInt(stats.low)
        },
        averageConfidence: parseFloat(stats.avg_confidence || 0),
        recentDiscoveries: parseInt(stats.recent_discoveries)
      };
    } catch (error) {
      logger.error('Failed to get field stats', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Bulk update field status
   */
  async bulkUpdateStatus(fieldIds: string[], action: 'accept' | 'reject', userId?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const status = action === 'accept' ? 'accepted' : 'rejected';

      // Update all fields
      await client.query(
        `UPDATE discovered_fields
         SET status = $1,
             reviewed_at = NOW(),
             reviewed_by = $2,
             updated_at = NOW()
         WHERE id = ANY($3)`,
        [status, userId || 'user', fieldIds]
      );

      // Log all changes
      for (const fieldId of fieldIds) {
        await client.query(
          `INSERT INTO field_classification_history
           (field_id, new_status, change_reason, changed_by)
           VALUES ($1, $2, $3, $4)`,
          [fieldId, status, `Bulk ${action}`, userId || 'user']
        );
      }

      await client.query('COMMIT');
      logger.info('Bulk updated field status', { count: fieldIds.length, action });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to bulk update field status', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clean up connections
   */
  async destroy(): Promise<void> {
    await this.pool.end();
  }
}

// Export singleton instance
export const fieldDiscoveryDB = new FieldDiscoveryDBService();
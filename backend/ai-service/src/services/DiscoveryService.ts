// src/services/DiscoveryService.ts
import { db } from '@/config/database';
import { APIError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { AIService, type FieldDiscoveryRequest } from './AIService';

export interface DiscoverySession {
  sessionId: string;
  userId: string;
  dataSourceId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results?: unknown;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StartDiscoveryRequest {
  userId: string;
  dataSourceId: string;
  schemas?: string[];
  tables?: string[];
  options?: {
    sampleSize?: number;
    includeData?: boolean;
    analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
  };
}

// shape as returned from DB
type DbSessionRow = {
  session_id: string;
  user_id: string;
  data_source_id: string;
  status: DiscoverySession['status'];
  progress: number;
  results: unknown | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
};

// local helper type for metadata
type ColumnDef = { name: string; type: string; nullable: boolean; description?: string };
type TableMeta = { schema: string; name: string; columns: ColumnDef[] };

export class DiscoveryService {
  private readonly aiService = new AIService();

  public async startDiscovery(request: StartDiscoveryRequest): Promise<DiscoverySession> {
    try {
      const sessionId = uuidv4();

      // Create discovery session
      const session = await this.createSession({
        sessionId,
        userId: request.userId,
        dataSourceId: request.dataSourceId,
        status: 'pending',
        progress: 0,
      });

      // Kick off async processing
      setImmediate(() =>
        this.processDiscovery(session, request).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error('Discovery background task fatal error', { sessionId, error: msg });
        })
      );

      logger.info('Discovery session started', { sessionId, dataSourceId: request.dataSourceId });
      return session;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to start discovery', { error: msg });
      throw new APIError('Failed to start discovery', 500, err);
    }
  }

  public async getSession(sessionId: string): Promise<DiscoverySession | null> {
    try {
      const result = await db.query('SELECT * FROM discovery_sessions WHERE session_id = $1', [sessionId]);
      if (result.rows.length === 0) return null;
      return this.mapSessionFromDb(result.rows[0] as DbSessionRow);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to get discovery session', { sessionId, error: msg });
      throw new APIError('Failed to get session', 500, err);
    }
  }

  public async listSessions(userId: string, limit = 20, offset = 0): Promise<DiscoverySession[]> {
    try {
      const result = await db.query(
        `SELECT * FROM discovery_sessions 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return (result.rows as DbSessionRow[]).map((row) => this.mapSessionFromDb(row));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to list discovery sessions', { userId, error: msg });
      throw new APIError('Failed to list sessions', 500, err);
    }
  }

  public async deleteSession(sessionId: string, userId: string): Promise<void> {
    try {
      const result = await db.query('DELETE FROM discovery_sessions WHERE session_id = $1 AND user_id = $2', [
        sessionId,
        userId,
      ]);

      if (result.rowCount === 0) {
        throw new APIError('Session not found', 404);
      }

      logger.info('Discovery session deleted', { sessionId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to delete discovery session', { sessionId, error: msg });
      throw err instanceof APIError ? err : new APIError('Failed to delete session', 500, err);
    }
  }

  /* --------------------------- Internals --------------------------- */

  private async createSession(session: Partial<DiscoverySession>): Promise<DiscoverySession> {
    const result = await db.query(
      `INSERT INTO discovery_sessions 
       (session_id, user_id, data_source_id, status, progress, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [session.sessionId, session.userId, session.dataSourceId, session.status, session.progress]
    );
    return this.mapSessionFromDb(result.rows[0] as DbSessionRow);
  }

  private async updateSession(sessionId: string, updates: Partial<DiscoverySession>): Promise<void> {
    const setClause: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'sessionId') continue;
      // convert camelCase to snake_case
      const dbKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      setClause.push(`${dbKey} = $${i++}`);
      values.push(value);
    }

    if (setClause.length === 0) return;

    setClause.push(`updated_at = NOW()`);
    values.push(sessionId);

    await db.query(`UPDATE discovery_sessions SET ${setClause.join(', ')} WHERE session_id = $${i}`, values);
  }

  private async processDiscovery(session: DiscoverySession, request: StartDiscoveryRequest): Promise<void> {
    try {
      await this.updateSession(session.sessionId, { status: 'processing', progress: 10 });

      const dataSource = await this.getDataSource(request.dataSourceId);
      if (!dataSource) throw new Error('Data source not found');

      await this.updateSession(session.sessionId, { progress: 20 });

      // Retrieve metadata
      const metadata = await this.getSchemaMetadata(dataSource, request.schemas, request.tables);
      await this.updateSession(session.sessionId, { progress: 40 });

      const results: Array<{ schema: string; table: string; analysis: unknown }> = [];
      const totalTables = metadata.length || 1;

      for (let idx = 0; idx < metadata.length; idx++) {
        const table = metadata[idx];

        // Optional sample data
        let sampleData: unknown[] = [];
        if (request.options?.includeData) {
          sampleData = await this.getSampleData(
            dataSource,
            table.schema,
            table.name,
            request.options.sampleSize ?? 100
          );
        }

        // IMPORTANT: make columns mutable (clone), not readonly
        const columns: ColumnDef[] = table.columns.map((c) => ({ ...c }));

        const discoveryRequest: FieldDiscoveryRequest = {
          schema: table.schema,
          tableName: table.name,
          columns,            // mutable array now
          sampleData,         // always an array
          context: `Discovery session for ${String(dataSource.name ?? dataSource.id)}`,
        };

        const analysis = await this.aiService.discoverFields(discoveryRequest);

        results.push({ schema: table.schema, table: table.name, analysis });

        // progress: 40 → 90 during table loop
        const progress = 40 + Math.floor(((idx + 1) / totalTables) * 50);
        await this.updateSession(session.sessionId, { progress });
      }

      await this.updateSession(session.sessionId, {
        status: 'completed',
        progress: 100,
        results: { tables: results, summary: this.generateSummary(results) },
      });

      logger.info('Discovery completed successfully', {
        sessionId: session.sessionId,
        tablesProcessed: results.length,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Discovery processing failed', { sessionId: session.sessionId, error: msg });

      await this.updateSession(session.sessionId, { status: 'failed', error: msg });
    }
  }

  private async getDataSource(dataSourceId: string): Promise<any | null> {
    const result = await db.query('SELECT * FROM data_sources WHERE id = $1', [dataSourceId]);
    return result.rows[0] ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async getSchemaMetadata(
    _dataSource: any,
    _schemas?: string[],
    _tables?: string[]
  ): Promise<TableMeta[]> {
    // TODO: replace with real connector fetch
    return [
      {
        schema: 'public',
        name: 'users',
        columns: [
          { name: 'id', type: 'integer', nullable: false },
          { name: 'email', type: 'varchar', nullable: false },
          { name: 'first_name', type: 'varchar', nullable: true },
          { name: 'last_name', type: 'varchar', nullable: true },
          { name: 'phone', type: 'varchar', nullable: true },
          { name: 'created_at', type: 'timestamp', nullable: false },
        ],
      },
    ];
  }

  private async getSampleData(
    _dataSource: any,
    _schema: string,
    _table: string,
    _limit: number
  ): Promise<unknown[]> {
    // TODO: replace with actual sampling query
    return [
      { id: 1, email: 'john@example.com', first_name: 'John', last_name: 'Doe', phone: '+1234567890' },
      { id: 2, email: 'jane@example.com', first_name: 'Jane', last_name: 'Smith', phone: '+1987654321' },
    ];
  }

  private generateSummary(results: ReadonlyArray<{ analysis: any }>): {
    totalTables: number;
    totalFields: number;
    classifications: Record<string, number>;
    sensitivities: Record<string, number>;
    recommendations: string[];
  } {
    let totalFields = 0;
    const classifications: Record<string, number> = Object.create(null);
    const sensitivities: Record<string, number> = Object.create(null);

    for (const t of results) {
      const fields: ReadonlyArray<any> = Array.isArray(t.analysis?.fields) ? t.analysis.fields : [];
      totalFields += fields.length;

      for (const f of fields) {
        const cls = String(f.classification ?? 'Unknown');
        const sen = String(f.sensitivity ?? 'Unknown');
        classifications[cls] = (classifications[cls] ?? 0) + 1;
        sensitivities[sen] = (sensitivities[sen] ?? 0) + 1;
      }
    }

    const recommendations = results
      .flatMap((t) => {
        const gov: unknown = t.analysis?.recommendations?.governance;
        return Array.isArray(gov) ? gov : [];
      })
      .slice(0, 10);

    return {
      totalTables: results.length,
      totalFields,
      classifications,
      sensitivities,
      recommendations,
    };
  }

  private mapSessionFromDb(row: DbSessionRow): DiscoverySession {
    // Build with conditional spreads to satisfy exactOptionalPropertyTypes:
    const base: Omit<DiscoverySession, 'results' | 'error'> = {
      sessionId: row.session_id,
      userId: row.user_id,
      dataSourceId: row.data_source_id,
      status: row.status,
      progress: row.progress,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return {
      ...base,
      ...(row.results !== null ? { results: row.results } : {}),
      ...(row.error !== null ? { error: row.error } : {}),
    };
  }
}

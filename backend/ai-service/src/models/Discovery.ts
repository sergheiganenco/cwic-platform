// src/models/Discovery.ts
import { db } from '@/config/database';
import { logger } from '@/utils/logger';

/** Domain model */
export interface DiscoverySession {
  sessionId: string;
  userId: string;
  dataSourceId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results?: unknown; // if present, must not be undefined (exactOptionalPropertyTypes)
  error?: string;    // if present, must not be undefined
  createdAt: Date;
  updatedAt: Date;
}

/** Shape returned by Postgres (snake_case) */
interface DbDiscoveryRow {
  session_id: string;
  user_id: string;
  data_source_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results: unknown | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

export class DiscoveryModel {
  static async create(session: Partial<DiscoverySession>): Promise<DiscoverySession> {
    try {
      const result = await db.query(
        `INSERT INTO discovery_sessions 
           (session_id, user_id, data_source_id, status, progress, created_at, updated_at)
         VALUES ($1,        $2,     $3,            $4,    $5,      NOW(),     NOW())
         RETURNING *`,
        [
          session.sessionId,
          session.userId,
          session.dataSourceId,
          session.status,
          session.progress,
        ]
      );

      const row = (result.rows as unknown as DbDiscoveryRow[])[0];
      return this.mapFromDb(row);
    } catch (error) {
      logger.error('Failed to create discovery session:', error);
      throw error;
    }
  }

  static async findById(sessionId: string): Promise<DiscoverySession | null> {
    try {
      const result = await db.query(
        'SELECT * FROM discovery_sessions WHERE session_id = $1',
        [sessionId]
      );

      const rows = result.rows as unknown as DbDiscoveryRow[];
      if (rows.length === 0) return null;
      return this.mapFromDb(rows[0]);
    } catch (error) {
      logger.error('Failed to find discovery session:', error);
      throw error;
    }
  }

  static async findByUserId(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<DiscoverySession[]> {
    try {
      const result = await db.query(
        `SELECT * FROM discovery_sessions
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const rows = result.rows as unknown as DbDiscoveryRow[];
      return rows.map((row) => this.mapFromDb(row));
    } catch (error) {
      logger.error('Failed to find discovery sessions by user:', error);
      throw error;
    }
  }

  static async update(
    sessionId: string,
    updates: Partial<DiscoverySession>
  ): Promise<DiscoverySession | null> {
    try {
      const setClause: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      // Build dynamic SET list (convert camelCase -> snake_case)
      for (const [key, value] of Object.entries(updates)) {
        if (key === 'sessionId') continue; // never update PK here
        const dbKey = key.replace(/[A-Z]/g, (ltr) => `_${ltr.toLowerCase()}`);
        setClause.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }

      if (setClause.length === 0) return null;

      // always set updated_at
      setClause.push(`updated_at = NOW()`);

      // WHERE param
      values.push(sessionId);

      const result = await db.query(
        `UPDATE discovery_sessions
            SET ${setClause.join(', ')}
          WHERE session_id = $${paramIndex}
          RETURNING *`,
        values
      );

      const rows = result.rows as unknown as DbDiscoveryRow[];
      if (rows.length === 0) return null;
      return this.mapFromDb(rows[0]);
    } catch (error) {
      logger.error('Failed to update discovery session:', error);
      throw error;
    }
  }

  static async delete(sessionId: string, userId: string): Promise<boolean> {
    try {
      const result = await db.query(
        'DELETE FROM discovery_sessions WHERE session_id = $1 AND user_id = $2',
        [sessionId, userId]
      );
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to delete discovery session:', error);
      throw error;
    }
  }

  /** Map DB row -> domain object, respecting exactOptionalPropertyTypes */
  private static mapFromDb(row: DbDiscoveryRow): DiscoverySession {
    const base: DiscoverySession = {
      sessionId: row.session_id,
      userId: row.user_id,
      dataSourceId: row.data_source_id,
      status: row.status,
      progress: row.progress,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // Only assign optional fields if they are non-null/defined
    if (row.results !== null && row.results !== undefined) {
      (base as { results: unknown }).results = row.results;
    }
    if (row.error !== null && row.error !== undefined) {
      (base as { error: string }).error = row.error;
    }

    return base;
  }
}

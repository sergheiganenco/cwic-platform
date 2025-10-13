// Advanced Catalog Service with Hierarchical Discovery
import { Pool } from 'pg';
import { EventEmitter } from 'events';

export interface ScanConfig {
  sourceId: string;
  databaseNames?: string[]; // If empty, scan all
  scanAll: boolean;
  options: {
    discoverObjects: boolean;
    profileData: boolean;
    classifyData: boolean;
    samplingRate: number;
    parallelism: number;
  };
}

export interface ScanProgress {
  scanId: string;
  phase: 'connecting' | 'discovering' | 'profiling' | 'classifying' | 'completing';
  currentDatabase?: string;
  currentSchema?: string;
  currentObject?: string;
  objectsScanned: number;
  totalObjects: number;
  databasesDiscovered: number;
  schemasDiscovered: number;
  objectsDiscovered: number;
  startTime: string;
  estimatedCompletion?: string;
  errors: Array<{
    severity: string;
    location: string;
    message: string;
  }>;
}

export class AdvancedCatalogService extends EventEmitter {
  private db: Pool;
  private activeScans: Map<string, ScanProgress> = new Map();

  constructor(db: Pool) {
    super();
    this.db = db;
  }

  /**
   * Start async catalog scan
   */
  async startScan(config: ScanConfig, triggeredBy: string = 'system'): Promise<{ scanId: string }> {
    const client = await this.db.connect();

    try {
      // Create scan record
      const scanResult = await client.query(`
        INSERT INTO catalog_scan_history (
          datasource_id, scan_type, databases_scanned, options, status, triggered_by, started_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING scan_id
      `, [
        config.sourceId,
        config.scanAll ? 'full' : 'targeted',
        config.databaseNames || [],
        config.options,
        'queued',
        triggeredBy
      ]);

      const scanId = scanResult.rows[0].scan_id;

      // Initialize progress tracking
      this.activeScans.set(scanId, {
        scanId,
        phase: 'connecting',
        objectsScanned: 0,
        totalObjects: 0,
        databasesDiscovered: 0,
        schemasDiscovered: 0,
        objectsDiscovered: 0,
        startTime: new Date().toISOString(),
        errors: []
      });

      // Start async scan (don't await - run in background)
      this.executeScan(scanId, config).catch(err => {
        console.error(`Scan ${scanId} failed:`, err);
        this.updateScanStatus(scanId, 'failed', err.message);
      });

      return { scanId };

    } finally {
      client.release();
    }
  }

  /**
   * Execute the scan asynchronously
   */
  private async executeScan(scanId: string, config: ScanConfig): Promise<void> {
    const client = await this.db.connect();

    try {
      // Get data source connection info
      const sourceResult = await client.query(`
        SELECT id, name, type, connection_config FROM data_sources WHERE id = $1
      `, [config.sourceId]);

      if (sourceResult.rows.length === 0) {
        throw new Error('Data source not found');
      }

      const source = sourceResult.rows[0];
      const connConfig = source.connection_config;

      // Phase 1: Discover Databases
      await this.updateScanPhase(scanId, 'discovering');
      const databases = await this.discoverDatabases(scanId, source, connConfig, config);

      // Phase 2: Discover Schemas & Objects
      for (const dbName of databases) {
        await this.discoverSchemasAndObjects(scanId, source, dbName, connConfig, config);
      }

      // Phase 3: Profile Data (if enabled)
      if (config.options.profileData) {
        await this.updateScanPhase(scanId, 'profiling');
        await this.profileData(scanId, config);
      }

      // Phase 4: Classify Data (if enabled)
      if (config.options.classifyData) {
        await this.updateScanPhase(scanId, 'classifying');
        await this.classifyData(scanId, config);
      }

      // Phase 5: Complete
      await this.updateScanPhase(scanId, 'completing');
      await this.completeScan(scanId);

    } catch (error: any) {
      await this.logScanError(scanId, 'critical', 'scan', error.message);
      await this.updateScanStatus(scanId, 'failed', error.message);
      throw error;
    } finally {
      client.release();
      this.activeScans.delete(scanId);
    }
  }

  /**
   * Discover databases
   */
  private async discoverDatabases(
    scanId: string,
    source: any,
    connConfig: any,
    config: ScanConfig
  ): Promise<string[]> {
    const databases: string[] = config.databaseNames && config.databaseNames.length > 0
      ? config.databaseNames
      : await this.listDatabases(source.type, connConfig);

    const client = await this.db.connect();
    try {
      for (const dbName of databases) {
        await client.query(`
          INSERT INTO catalog_databases (datasource_id, name, status, discovered_at)
          VALUES ($1, $2, 'discovered', NOW())
          ON CONFLICT (datasource_id, name) DO UPDATE
          SET status = 'discovered', updated_at = NOW()
        `, [source.id, dbName]);
      }

      const progress = this.activeScans.get(scanId);
      if (progress) {
        progress.databasesDiscovered = databases.length;
        this.emit('progress', scanId, progress);
      }

      return databases;
    } finally {
      client.release();
    }
  }

  /**
   * Discover schemas and objects
   */
  private async discoverSchemasAndObjects(
    scanId: string,
    source: any,
    dbName: string,
    connConfig: any,
    config: ScanConfig
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      // Get database ID
      const dbResult = await client.query(`
        SELECT id FROM catalog_databases WHERE datasource_id = $1 AND name = $2
      `, [source.id, dbName]);

      const databaseId = dbResult.rows[0].id;

      // Update current database in progress
      const progress = this.activeScans.get(scanId);
      if (progress) {
        progress.currentDatabase = dbName;
        this.emit('progress', scanId, progress);
      }

      // Discover schemas and objects based on source type
      if (source.type === 'postgresql') {
        await this.discoverPostgresSchemas(scanId, source.id, databaseId, dbName, connConfig, config, client);
      } else if (source.type === 'mssql') {
        await this.discoverMSSQLSchemas(scanId, source.id, databaseId, dbName, connConfig, config, client);
      }

    } finally {
      client.release();
    }
  }

  /**
   * Discover PostgreSQL schemas and objects
   */
  private async discoverPostgresSchemas(
    scanId: string,
    sourceId: string,
    databaseId: number,
    dbName: string,
    connConfig: any,
    config: ScanConfig,
    client: any
  ): Promise<void> {
    // Connect to target database
    const { Pool: PgPool } = require('pg');
    const targetDb = new PgPool({
      host: connConfig.host,
      port: connConfig.port || 5432,
      database: dbName,
      user: connConfig.username,
      password: connConfig.password,
      ssl: connConfig.ssl !== false ? connConfig.ssl : undefined
    });

    try {
      // Get schemas (excluding system schemas unless specified)
      const schemasResult = await targetDb.query(`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name
      `);

      for (const schemaRow of schemasResult.rows) {
        const schemaName = schemaRow.schema_name;

        // Insert/update schema
        const schemaResult = await client.query(`
          INSERT INTO catalog_schemas (database_id, name, is_system, discovered_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (database_id, name) DO UPDATE
          SET updated_at = NOW()
          RETURNING id
        `, [databaseId, schemaName, false]);

        const schemaId = schemaResult.rows[0].id;

        const progress = this.activeScans.get(scanId);
        if (progress) {
          progress.currentSchema = schemaName;
          progress.schemasDiscovered++;
          this.emit('progress', scanId, progress);
        }

        // Discover tables and views
        const objectsResult = await targetDb.query(`
          SELECT
            table_name as name,
            table_type,
            (SELECT reltuples::bigint FROM pg_class WHERE relname = table_name) as row_count
          FROM information_schema.tables
          WHERE table_schema = $1
            AND table_type IN ('BASE TABLE', 'VIEW')
        `, [schemaName]);

        for (const objRow of objectsResult.rows) {
          const objectType = objRow.table_type === 'BASE TABLE' ? 'table' : 'view';
          const fqn = `${source.name}.${dbName}.${schemaName}.${objRow.name}`;

          // Insert object
          await client.query(`
            INSERT INTO catalog_objects (
              schema_id, database_id, datasource_id, name, object_type,
              fully_qualified_name, row_count, discovered_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (schema_id, name, object_type) DO UPDATE
            SET row_count = EXCLUDED.row_count, updated_at = NOW()
          `, [schemaId, databaseId, sourceId, objRow.name, objectType, fqn, objRow.row_count || 0]);

          const progress = this.activeScans.get(scanId);
          if (progress) {
            progress.currentObject = objRow.name;
            progress.objectsDiscovered++;
            progress.objectsScanned++;
            this.emit('progress', scanId, progress);
          }
        }

        // Discover stored procedures and functions
        const routinesResult = await targetDb.query(`
          SELECT routine_name as name, routine_type
          FROM information_schema.routines
          WHERE routine_schema = $1
        `, [schemaName]);

        for (const routine of routinesResult.rows) {
          const objectType = routine.routine_type === 'PROCEDURE' ? 'stored_procedure' : 'function';
          const fqn = `${source.name}.${dbName}.${schemaName}.${routine.name}`;

          await client.query(`
            INSERT INTO catalog_objects (
              schema_id, database_id, datasource_id, name, object_type,
              fully_qualified_name, discovered_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (schema_id, name, object_type) DO UPDATE
            SET updated_at = NOW()
          `, [schemaId, databaseId, sourceId, routine.name, objectType, fqn]);

          const progress = this.activeScans.get(scanId);
          if (progress) {
            progress.objectsDiscovered++;
            progress.objectsScanned++;
            this.emit('progress', scanId, progress);
          }
        }
      }

    } finally {
      await targetDb.end();
    }
  }

  /**
   * Discover MSSQL schemas (similar pattern)
   */
  private async discoverMSSQLSchemas(
    scanId: string,
    sourceId: string,
    databaseId: number,
    dbName: string,
    connConfig: any,
    config: ScanConfig,
    client: any
  ): Promise<void> {
    // Similar to PostgreSQL but with MSSQL-specific queries
    // Implementation would follow same pattern
  }

  /**
   * Profile data
   */
  private async profileData(scanId: string, config: ScanConfig): Promise<void> {
    // Get all objects to profile
    const result = await this.db.query(`
      SELECT id, schema_id, name, object_type, fully_qualified_name
      FROM catalog_objects
      WHERE datasource_id = $1 AND object_type IN ('table', 'view')
      ORDER BY id
    `, [config.sourceId]);

    // Profile each object (simplified)
    for (const obj of result.rows) {
      const progress = this.activeScans.get(scanId);
      if (progress) {
        progress.currentObject = obj.name;
        this.emit('progress', scanId, progress);
      }

      // Here you would run ANALYZE queries, collect statistics, etc.
      await this.db.query(`
        UPDATE catalog_objects
        SET last_profiled_at = NOW()
        WHERE id = $1
      `, [obj.id]);
    }
  }

  /**
   * Classify data (detect PII, sensitive data)
   */
  private async classifyData(scanId: string, config: ScanConfig): Promise<void> {
    // Get columns to classify
    const result = await this.db.query(`
      SELECT c.id, c.name, c.data_type, o.name as object_name
      FROM catalog_columns c
      JOIN catalog_objects o ON o.id = c.object_id
      WHERE o.datasource_id = $1
    `, [config.sourceId]);

    // Simple pattern-based classification
    const piiPatterns = {
      email: /email|e_mail|mail_address/i,
      phone: /phone|telephone|mobile|cell/i,
      ssn: /ssn|social_security/i,
      credit_card: /cc|credit_card|card_number/i,
    };

    for (const col of result.rows) {
      let classification = 'Public';
      let dataCategory = null;

      // Check patterns
      for (const [category, pattern] of Object.entries(piiPatterns)) {
        if (pattern.test(col.name)) {
          classification = 'PII';
          dataCategory = category;
          break;
        }
      }

      await this.db.query(`
        UPDATE catalog_columns
        SET classification = $1, data_category = $2
        WHERE id = $3
      `, [classification, dataCategory, col.id]);
    }
  }

  /**
   * Complete scan
   */
  private async completeScan(scanId: string): Promise<void> {
    const progress = this.activeScans.get(scanId);

    await this.db.query(`
      UPDATE catalog_scan_history
      SET
        status = 'completed',
        completed_at = NOW(),
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
        objects_scanned = $1,
        summary = $2
      WHERE scan_id = $3
    `, [
      progress?.objectsScanned || 0,
      JSON.stringify({
        databasesDiscovered: progress?.databasesDiscovered || 0,
        schemasDiscovered: progress?.schemasDiscovered || 0,
        objectsDiscovered: progress?.objectsDiscovered || 0
      }),
      scanId
    ]);

    if (progress) {
      progress.phase = 'completing';
      this.emit('complete', scanId, progress);
    }
  }

  /**
   * Get scan progress
   */
  async getScanProgress(scanId: string): Promise<ScanProgress | null> {
    // Check active scans first
    if (this.activeScans.has(scanId)) {
      return this.activeScans.get(scanId)!;
    }

    // Check database
    const result = await this.db.query(`
      SELECT * FROM catalog_scan_history WHERE scan_id = $1
    `, [scanId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      scanId,
      phase: row.status,
      currentDatabase: row.current_database,
      currentSchema: row.current_schema,
      currentObject: row.current_object,
      objectsScanned: row.objects_scanned,
      totalObjects: row.total_objects,
      databasesDiscovered: row.summary?.databasesDiscovered || 0,
      schemasDiscovered: row.summary?.schemasDiscovered || 0,
      objectsDiscovered: row.summary?.objectsDiscovered || 0,
      startTime: row.started_at,
      errors: []
    };
  }

  /**
   * List databases from source
   */
  private async listDatabases(sourceType: string, connConfig: any): Promise<string[]> {
    if (sourceType === 'postgresql') {
      const { Pool } = require('pg');
      const pool = new Pool({
        host: connConfig.host,
        port: connConfig.port || 5432,
        user: connConfig.username,
        password: connConfig.password,
        database: 'postgres'
      });

      try {
        const result = await pool.query(`
          SELECT datname FROM pg_database
          WHERE datistemplate = false
            AND datname NOT IN ('postgres', 'template0', 'template1')
        `);
        return result.rows.map((r: any) => r.datname);
      } finally {
        await pool.end();
      }
    }

    return [];
  }

  private async updateScanPhase(scanId: string, phase: string): Promise<void> {
    await this.db.query(`
      UPDATE catalog_scan_history SET current_phase = $1, status = $2 WHERE scan_id = $3
    `, [phase, phase, scanId]);

    const progress = this.activeScans.get(scanId);
    if (progress) {
      progress.phase = phase as any;
      this.emit('progress', scanId, progress);
    }
  }

  private async updateScanStatus(scanId: string, status: string, error?: string): Promise<void> {
    await this.db.query(`
      UPDATE catalog_scan_history SET status = $1 WHERE scan_id = $2
    `, [status, scanId]);
  }

  private async logScanError(scanId: string, severity: string, phase: string, message: string): Promise<void> {
    await this.db.query(`
      INSERT INTO catalog_scan_errors (scan_id, severity, phase, error_message)
      VALUES ($1, $2, $3, $4)
    `, [scanId, severity, phase, message]);

    await this.db.query(`
      UPDATE catalog_scan_history SET error_count = error_count + 1 WHERE scan_id = $1
    `, [scanId]);
  }
}

// src/cron.ts (optional)
import { Pool } from 'pg';
import { SyncQueue } from './queue';
const cpdb = new Pool({ connectionString: process.env.DATABASE_URL });

export async function scheduleSyncAll() {
  const { rows } = await cpdb.query(`SELECT id::text AS id FROM data_sources WHERE status='connected'`);
  for (const r of rows) {
    await SyncQueue.add('sync-source', { dataSourceId: r.id }, { removeOnComplete: 50, removeOnFail: 50 });
  }
}

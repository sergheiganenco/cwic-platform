import { DatabaseService } from './DatabaseService';

export class RequestsService {
  private db = new DatabaseService();

  async list(status?: string, type?: string) {
    const clauses: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (status) { clauses.push(`status=$${i++}`); params.push(status); }
    if (type)   { clauses.push(`type=$${i++}`);   params.push(type); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await this.db.query(`
      SELECT * FROM workflow_requests ${where} ORDER BY updated_at DESC LIMIT 200
    `, params);
    return rows;
  }

  async create(data: any, userId?: string) {
    const { rows } = await this.db.query(`
      INSERT INTO workflow_requests (title,type,status,requester,payload,updated_by)
      VALUES ($1,COALESCE($2,'access'),COALESCE($3,'open'),$4,$5::jsonb,$6)
      RETURNING *
    `, [data.title, data.type ?? 'access', data.status ?? 'open', data.requester ?? userId ?? null, JSON.stringify(data.payload ?? {}), userId ?? null]);
    return rows[0];
  }

  async update(id: string, patch: any, userId?: string) {
    const sets: string[] = []; const params: any[] = []; let i = 1;
    const push = (f: string, v: any) => { sets.push(f); params.push(v); };
    if (patch.title !== undefined)   push(`title=$${i++}`, patch.title);
    if (patch.type !== undefined)    push(`type=$${i++}`, patch.type);
    if (patch.status !== undefined)  push(`status=$${i++}`, patch.status);
    if (patch.assignee !== undefined)push(`assignee=$${i++}`, patch.assignee);
    if (patch.payload !== undefined) push(`payload=$${i++}::jsonb`, JSON.stringify(patch.payload ?? {}));
    push(`updated_by=$${i++}`, userId ?? null);
    push(`updated_at=NOW()`, null);
    params.push(id);
    const { rows } = await this.db.query(`UPDATE workflow_requests SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
    return rows[0] ?? null;
  }
}

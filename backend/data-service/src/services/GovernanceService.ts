import { DatabaseService } from './DatabaseService';

export class GovernanceService {
  private db = new DatabaseService();

  async listPolicies(status?: string) {
    const where = status ? `WHERE status=$1` : '';
    const params = status ? [status] : [];
    const { rows } = await this.db.query(`
      SELECT * FROM governance_policies ${where} ORDER BY updated_at DESC LIMIT 200
    `, params);
    return rows;
  }

  async createPolicy(patch: any, userId?: string) {
    const rules = Array.isArray(patch.rules) ? patch.rules : [];
    const { rows } = await this.db.query(`
      INSERT INTO governance_policies (name,description,category,status,rules,created_by,updated_by)
      VALUES ($1,$2,COALESCE($3,'access'),COALESCE($4,'active'),$5::jsonb,$6,$6)
      RETURNING *
    `, [patch.name, patch.description ?? null, patch.category ?? 'access', patch.status ?? 'active', JSON.stringify(rules), userId ?? null]);
    return rows[0];
  }

  async updatePolicy(id: string, patch: any, userId?: string) {
    const sets: string[] = []; const params: any[] = []; let i = 1;
    const push = (frag: string, val: any) => { sets.push(frag); params.push(val); };
    if (patch.name !== undefined)        push(`name=$${i++}`, patch.name);
    if (patch.description !== undefined) push(`description=$${i++}`, patch.description);
    if (patch.category !== undefined)    push(`category=$${i++}`, patch.category);
    if (patch.status !== undefined)      push(`status=$${i++}`, patch.status);
    if (patch.rules !== undefined)       push(`rules=$${i++}::jsonb`, JSON.stringify(Array.isArray(patch.rules) ? patch.rules : []));
    push(`updated_by=$${i++}`, userId ?? null);
    push(`updated_at=NOW()`, null);
    params.push(id);

    const { rows } = await this.db.query(`
      UPDATE governance_policies SET ${sets.join(', ')} WHERE id=$${i} RETURNING *
    `, params);
    return rows[0] ?? null;
  }

  async deletePolicy(id: string) {
    const { rowCount } = await this.db.query(`DELETE FROM governance_policies WHERE id=$1`, [id]);
    return (rowCount ?? 0) > 0;
  }
}

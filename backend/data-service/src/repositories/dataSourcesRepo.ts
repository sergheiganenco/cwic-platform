// backend/data-service/src/repositories/dataSourcesRepo.ts
import { pool } from "../db/pool";

export type SortBy =
  | "name"
  | "type"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "lastSyncAt"
  | "lastTestAt";

const SORT_MAP: Record<SortBy, string> = {
  name: "name",
  type: "type",
  status: "status",
  createdAt: "created_at",
  updatedAt: "updated_at",
  lastSyncAt: "last_sync_at",
  lastTestAt: "last_test_at",
};

export async function listDataSources(opts: {
  page?: number;
  limit?: number;
  sortBy?: SortBy;
  sortOrder?: "asc" | "desc";
}) {
  const page = Math.max(1, Number(opts.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(opts.limit ?? 20)));
  const offset = (page - 1) * limit;

  const sortBy = (opts.sortBy ?? "updatedAt") as SortBy;
  const sortCol = SORT_MAP[sortBy] ?? "updated_at";
  const sortOrder = (opts.sortOrder ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";

  const client = await pool.connect();
  try {
    const countSql = `SELECT COUNT(*)::int AS total FROM data_sources WHERE deleted_at IS NULL`;
    const countRes = await client.query<{ total: number }>(countSql);
    const total = countRes.rows[0]?.total ?? 0;

    const sql = `
      SELECT
        id,
        name,
        description,
        type,
        status,
        connection_config           AS "connectionConfig",
        tags,
        metadata,
        created_at                  AS "createdAt",
        updated_at                  AS "updatedAt",
        created_by                  AS "createdBy",
        updated_by                  AS "updatedBy",
        deleted_at                  AS "deletedAt",
        last_test_at                AS "lastTestAt",
        last_sync_at                AS "lastSyncAt",
        last_error                  AS "lastError",
        response_time               AS "responseTime",
        availability,
        sync_enabled                AS "syncEnabled",
        sync_schedule               AS "syncSchedule",
        sync_options                AS "syncOptions"
      FROM data_sources
      WHERE deleted_at IS NULL
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT $1 OFFSET $2
    `;
    const res = await client.query(sql, [limit, offset]);

    return {
      success: true as const,
      data: res.rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      sortBy,
      sortOrder,
    };
  } finally {
    client.release();
  }
}

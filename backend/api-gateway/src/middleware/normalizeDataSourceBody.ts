import type { NextFunction, Request, Response } from "express";

/**
 * Normalizes request bodies sent to data-source endpoints so the data-service
 * always receives a consistent shape:
 *
 * {
 *   type: "<engine>",                      // e.g. "postgres" | "mysql" | "mssql" | "snowflake" | "bigquery"
 *   connection: {
 *     host: string,
 *     port?: number,
 *     database?: string,
 *     user?: string,
 *     username?: string,                   // will be mapped to user
 *     password?: string,
 *     ssl?: boolean | object
 *   },
 *   sql?: string
 * }
 *
 * Accepted aliases:
 * - "driver" or "engine" → "type"
 * - "postgresql" | "pg" → "postgres"
 * - "ms-sql" | "sqlserver" → "mssql"
 * - "user" | "username" normalized to "user"
 * - top-level connection fields flattened into connection object if needed
 */
export function normalizeDataSourceBody(req: Request, _res: Response, next: NextFunction) {
  if (!req.is("application/json")) return next(); // only normalize JSON payloads

  // Only touch bodies that are objects
  const body = (req.body && typeof req.body === "object") ? req.body as Record<string, any> : null;
  if (!body) return next();

  // 1) Normalize engine key to "type"
  let type: unknown =
    body.type ??
    body.driver ??
    body.engine ??
    (body.connection?.type ?? body.connection?.driver ?? body.connection?.engine);

  if (typeof type === "string") {
    const t = type.toLowerCase().trim();

    const typeMap: Record<string, string> = {
      // Postgres
      "postgres": "postgres",
      "postgresql": "postgres",
      "pg": "postgres",
      // MySQL
      "mysql": "mysql",
      "mariadb": "mysql",           // treat as mysql for connection test/preview
      // Microsoft SQL Server
      "mssql": "mssql",
      "ms-sql": "mssql",
      "sqlserver": "mssql",
      "sql-server": "mssql",
      // Snowflake
      "snowflake": "snowflake",
      // BigQuery
      "bigquery": "bigquery",
      "bq": "bigquery",
    };

    body.type = typeMap[t] ?? t;    // if unknown, still pass the string through
  }

  // 2) Build/normalize connection object
  const srcConn = ((): Record<string, any> => {
    // allow connection under body.connection, or flatten top-level host/port/etc
    if (body.connection && typeof body.connection === "object") {
      return { ...(body.connection as Record<string, any>) };
    }
    const {
      host, hostname, server,
      port,
      database, db, catalog, schema,
      user, username,
      password, pass,
      ssl,
      projectId, dataset, location, // BigQuery style
      account, warehouse, role      // Snowflake style
    } = body;

    const conn: Record<string, any> = {};
    if (host ?? hostname ?? server) conn.host = host ?? hostname ?? server;
    if (typeof port !== "undefined") conn.port = Number(port);
    if (database ?? db ?? catalog ?? schema) conn.database = database ?? db ?? catalog ?? schema;
    if (user ?? username) conn.user = user ?? username;
    if (password ?? pass) conn.password = password ?? pass;
    if (typeof ssl !== "undefined") conn.ssl = ssl;

    // Pass through cloud-specific fields if present
    if (projectId) conn.projectId = projectId;
    if (dataset) conn.dataset = dataset;
    if (location) conn.location = location;

    if (account) conn.account = account;
    if (warehouse) conn.warehouse = warehouse;
    if (role) conn.role = role;

    return conn;
  })();

  // Ensure username alias is mapped
  if (srcConn.username && !srcConn.user) {
    srcConn.user = srcConn.username;
    delete srcConn.username;
  }

  // 3) Attach normalized connection back
  body.connection = srcConn;

  // 4) For legacy shapes { db: {...} } or { config: {...} } → move into connection
  if (body.db && typeof body.db === "object") {
    body.connection = { ...body.connection, ...body.db };
    delete body.db;
  }
  if (body.config && typeof body.config === "object") {
    body.connection = { ...body.connection, ...body.config };
    delete body.config;
  }

  // 5) Ensure sql is a string when present
  if (typeof body.sql !== "undefined" && body.sql !== null) {
    body.sql = String(body.sql);
  }

  // 6) Put normalized body back on req
  req.body = body;

  return next();
}

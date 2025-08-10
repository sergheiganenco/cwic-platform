export type DataSourceType = 'azure-sql' | 'synapse' | 'fabric' | 'data-lake' | 'postgres' | 'snowflake'
export type DataSourceHealth = 'healthy' | 'warning' | 'down' | 'error' 

export type DataSource = {
  id: string
  name: string
  type: DataSourceType
  host?: string
  database?: string
  schema?: string
  username?: string
  updatedAt?: string
   status?: DataSourceHealth
  metadata?: Record<string, unknown>
}

export type TestResult = 'idle' | 'testing' | 'ok' | 'fail'

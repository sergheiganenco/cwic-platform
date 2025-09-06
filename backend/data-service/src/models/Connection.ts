// backend/data-service/src/models/Connection.ts
// Back-compat shim: re-export the canonical connection types from DataSource.
// This prevents drift between modules and ensures 'mssql' etc. exist here too.

export type {
  APIConnection, AzureBlobConnection, BigQueryConnection, ConnectionConfig, ConnectionTestResult, DatabricksConnection, ElasticsearchConnection, FileConnection, GCSConnection, KafkaConnection, MongoDBConnection, MSSQLConnection, MySQLConnection, OracleConnection, PostgreSQLConnection, RedisConnection, RedshiftConnection, S3Connection, SnowflakeConnection
} from './DataSource';


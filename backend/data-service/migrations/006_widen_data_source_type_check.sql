-- Allow both 'postgres' and 'postgresql' (plus existing types)
ALTER TABLE data_sources
  DROP CONSTRAINT IF EXISTS data_sources_type_check;

ALTER TABLE data_sources
  ADD CONSTRAINT data_sources_type_check CHECK (
    type IN (
      'postgres','postgresql','mysql','mssql','mongodb','redis','snowflake',
      'bigquery','redshift','databricks','s3','azure-blob','gcs','kafka',
      'api','file','ftp','elasticsearch','oracle'
    )
  );

import type { ConnectionConfig, DataSourceType } from '@/types/dataSources';

/* =========================
   Types
========================= */
export type ConnectorCategory =
  | 'Databases'
  | 'Warehouses'
  | 'Storage'
  | 'Streaming'
  | 'API & Files';

export type FieldType =
  | 'text'
  | 'password'
  | 'number'
  | 'textarea'
  | 'checkbox'
  | 'select'
  | 'connectionString';

// connector ids, including aliases that submit as another backend type
export type ConnectorId =
  | DataSourceType
  | 'azure-sql'
  | 'synapse-dedicated'
  | 'synapse-serverless'
  | 'aws-rds-postgres'
  | 'aws-rds-mysql'
  | 'planetscale'
  | 'neon'
  | 'supabase';

// NOTE: key/dependsOn.field are strings to avoid TS friction with custom keys like "brokers"
export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
  dependsOn?: {
    field: string;
    value?: any;
    condition?: 'equals' | 'not-equals' | 'truthy' | 'falsy';
  };
  validation?: {
    pattern?: RegExp;
    min?: number;
    max?: number;
    custom?: (value: any, config: ConnectionConfig) => string | null;
  };
};

export type ConnectionTemplate = {
  name: string;
  description: string;
  config: Partial<ConnectionConfig>;
  icon?: string;
};

export type ConnectorMeta = {
  id: ConnectorId;
  submitType: DataSourceType; // what your backend expects in "type"
  label: string;
  category: ConnectorCategory;
  icon: string;
  description?: string;
  defaultPort?: number;
  fields: FieldDef[];
  tips?: string[];
  supportsConnectionString?: boolean;
  connectionStringPlaceholder?: string;
  parseConnectionString?: (url: string) => Partial<ConnectionConfig>;
  templates?: ConnectionTemplate[];
  tags?: string[];
  popularity?: number;
  isNew?: boolean;
  isBeta?: boolean;
  documentationUrl?: string;
};

/* =========================
   Validation helpers
========================= */
export const VALIDATION_PATTERNS = {
  url: /^https?:\/\/.+/,
  hostname:
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  snowflakeAccount: /^[a-zA-Z0-9_-]+\.snowflakecomputing\.com$/,
  azureServer: /^[a-zA-Z0-9-]+\.database\.windows\.net$/,
  gcpProject: /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/,
};

/* =========================
   Connection string parsers
========================= */
export const CONNECTION_STRING_PARSERS = {
  postgresql: (url: string): Partial<ConnectionConfig> => {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 5432,
        database: parsed.pathname.replace(/^\//, ''),
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        ssl:
          parsed.searchParams.get('sslmode') === 'require' ||
          parsed.searchParams.get('ssl') === 'true',
      };
    } catch {
      return {};
    }
  },

  mysql: (url: string): Partial<ConnectionConfig> => {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 3306,
        database: parsed.pathname.replace(/^\//, ''),
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        ssl: parsed.searchParams.get('ssl') === 'true',
      };
    } catch {
      return {};
    }
  },

  mongodb: (url: string): Partial<ConnectionConfig> => {
    return { connectionString: url };
  },
};

/* =========================
   Templates
========================= */
const ENVIRONMENT_TEMPLATES: Record<string, ConnectionTemplate[]> = {
  postgresql: [
    {
      name: 'Local Development',
      description: 'Default PostgreSQL on localhost',
      icon: '💻',
      config: { host: 'localhost', port: 5432, ssl: false },
    },
    {
      name: 'Production',
      description: 'Secure production setup',
      icon: '🔐',
      config: { port: 5432, ssl: true },
    },
  ],
  mysql: [
    {
      name: 'Local Development',
      description: 'Default MySQL on localhost',
      icon: '💻',
      config: { host: 'localhost', port: 3306, ssl: false },
    },
    {
      name: 'Production',
      description: 'Secure production setup',
      icon: '🔐',
      config: { port: 3306, ssl: true },
    },
  ],
};

/* =========================
   Default config per connector
========================= */
export function defaultConfigFor(meta: ConnectorMeta): Partial<ConnectionConfig> {
  // Use Record<string, any> for flexibility since ConnectionConfig is a union type
  const base: Record<string, any> = {};
  
  // Set default port if specified
  if (meta.defaultPort) {
    base.port = meta.defaultPort;
  }

  // Set connector-specific defaults
  switch (meta.id) {
    case 'azure-sql':
    case 'synapse-dedicated':
    case 'synapse-serverless':
      base.ssl = true;
      base.encrypt = true;
      break;
      
    case 'neon':
    case 'supabase':
    case 'planetscale':
    case 'aws-rds-postgres':
    case 'aws-rds-mysql':
      base.ssl = true;
      break;
      
    case 'snowflake':
      base.ssl = true;
      base.warehouse = 'COMPUTE_WH';
      // Note: Snowflake doesn't use 'port', it uses the host URL
      break;
      
    case 'bigquery':
      base.location = 'US';
      // Note: BigQuery doesn't use traditional connection properties
      break;
      
    case 'redis':
      base.database = 0; // Default Redis database
      break;
      
    case 'kafka':
      base.securityProtocol = 'PLAINTEXT';
      break;
      
    case 'api':
      base.timeout = 30;
      base.authType = 'none';
      break;
      
    case 'file':
      base.format = 'csv';
      base.encoding = 'utf-8';
      base.recursive = false;
      break;
      
    case 'elasticsearch':
      base.ssl = false;
      break;
  }
    // Cast back to Partial<ConnectionConfig> for type compatibility
  return base as Partial<ConnectionConfig>;
}

/* =========================
   Connectors
========================= */
export const CONNECTORS: ConnectorMeta[] = [
  // --- Databases ---
  {
    id: 'postgresql',
    submitType: 'postgresql',
    label: 'PostgreSQL',
    category: 'Databases',
    icon: '🐘',
    description: 'Open-source relational database',
    defaultPort: 5432,
    popularity: 95,
    supportsConnectionString: true,
    connectionStringPlaceholder: 'postgresql://user:pass@host:5432/db',
    parseConnectionString: CONNECTION_STRING_PARSERS.postgresql,
    templates: ENVIRONMENT_TEMPLATES.postgresql,
    documentationUrl: 'https://www.postgresql.org/docs/',
    fields: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true, validation: { pattern: VALIDATION_PATTERNS.hostname } },
      { key: 'port', label: 'Port', type: 'number', placeholder: '5432', required: true },
      { key: 'database', label: 'Database', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'ssl', label: 'Use SSL', type: 'checkbox', help: 'Enable for production' },
      {
        key: 'sslmode',
        label: 'SSL Mode',
        type: 'select',
        options: [
          { value: 'disable', label: 'Disable' },
          { value: 'require', label: 'Require' },
          { value: 'verify-ca', label: 'Verify CA' },
          { value: 'verify-full', label: 'Verify Full' },
        ],
        dependsOn: { field: 'ssl', value: true, condition: 'equals' },
      },
    ],
    tips: ['Use a read-only user', 'Consider pooling', 'Enable SSL in prod'],
    tags: ['sql', 'relational', 'open-source'],
  },
  {
    id: 'aws-rds-postgres',
    submitType: 'postgresql',
    label: 'AWS RDS PostgreSQL',
    category: 'Databases',
    icon: '🟠',
    description: 'Managed PostgreSQL on AWS',
    defaultPort: 5432,
    popularity: 85,
    fields: [
      { key: 'host', label: 'RDS Endpoint', type: 'text', placeholder: 'mydb.cluster-xyz.us-east-1.rds.amazonaws.com', required: true },
      { key: 'port', label: 'Port', type: 'number', placeholder: '5432', required: true },
      { key: 'database', label: 'Database', type: 'text', required: true },
      { key: 'username', label: 'Master Username', type: 'text', required: true },
      { key: 'password', label: 'Master Password', type: 'password', required: true },
      { key: 'ssl', label: 'Force SSL', type: 'checkbox' },
    ],
    tips: ['Backups', 'IAM auth', 'Security groups'],
    tags: ['aws', 'managed', 'postgresql', 'cloud'],
  },
  {
    id: 'neon',
    submitType: 'postgresql',
    label: 'Neon',
    category: 'Databases',
    icon: '⚡',
    description: 'Serverless PostgreSQL platform',
    defaultPort: 5432,
    popularity: 75,
    isNew: true,
    supportsConnectionString: true,
    connectionStringPlaceholder: 'postgresql://user:pass@ep-xxx.neon.tech/db',
    parseConnectionString: CONNECTION_STRING_PARSERS.postgresql,
    fields: [
      { key: 'host', label: 'Neon Host', type: 'text', placeholder: 'ep-xxx.neon.tech', required: true },
      { key: 'database', label: 'Database', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'ssl', label: 'SSL (Required)', type: 'checkbox' },
    ],
    tips: ['Pooling recommended', 'SSL required'],
    tags: ['serverless', 'postgresql', 'modern'],
  },
  {
    id: 'supabase',
    submitType: 'postgresql',
    label: 'Supabase',
    category: 'Databases',
    icon: '🟢',
    description: 'Open-source Firebase alternative',
    defaultPort: 5432,
    popularity: 80,
    supportsConnectionString: true,
    connectionStringPlaceholder: 'postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres',
    parseConnectionString: CONNECTION_STRING_PARSERS.postgresql,
    fields: [
      { key: 'host', label: 'Supabase Host', type: 'text', placeholder: 'db.xxx.supabase.co', required: true },
      { key: 'port', label: 'Port', type: 'number', placeholder: '5432', required: true },
      { key: 'database', label: 'Database', type: 'text', placeholder: 'postgres', required: true },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'postgres', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'ssl', label: 'SSL (Required)', type: 'checkbox' },
    ],
    tips: ['Use dashboard for creds'],
    tags: ['baas', 'postgresql', 'open-source'],
  },
  {
    id: 'mysql',
    submitType: 'mysql',
    label: 'MySQL',
    category: 'Databases',
    icon: '🐬',
    description: 'Popular open-source database',
    defaultPort: 3306,
    popularity: 90,
    supportsConnectionString: true,
    connectionStringPlaceholder: 'mysql://user:pass@host:3306/db',
    parseConnectionString: CONNECTION_STRING_PARSERS.mysql,
    fields: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true },
      { key: 'port', label: 'Port', type: 'number', placeholder: '3306', required: true },
      { key: 'database', label: 'Database', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'ssl', label: 'Use SSL', type: 'checkbox' },
    ],
    tips: ['Enable SSL in prod'],
    tags: ['sql', 'relational', 'open-source'],
  },
  {
    id: 'planetscale',
    submitType: 'mysql',
    label: 'PlanetScale',
    category: 'Databases',
    icon: '🪐',
    description: 'Serverless MySQL platform',
    defaultPort: 3306,
    popularity: 70,
    isNew: true,
    fields: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'xxx.planetscale.dev', required: true },
      { key: 'database', label: 'Database', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'ssl', label: 'SSL (Required)', type: 'checkbox' },
    ],
    tips: ['SSL is required'],
    tags: ['serverless', 'mysql', 'modern'],
  },
  {
    id: 'mssql',
    submitType: 'mssql',
    label: 'SQL Server',
    category: 'Databases',
    icon: '🏢',
    description: 'Microsoft SQL Server',
    defaultPort: 1433,
    popularity: 75,
    fields: [
      { key: 'host', label: 'Server', type: 'text', placeholder: 'localhost', required: true },
      { key: 'port', label: 'Port', type: 'number', placeholder: '1433', required: true },
      { key: 'database', label: 'Database', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'ssl', label: 'Encrypt Connection', type: 'checkbox' },
      {
        key: 'trustServerCertificate',
        label: 'Trust Server Certificate',
        type: 'checkbox',
        dependsOn: { field: 'ssl', value: true, condition: 'equals' },
        help: 'Use for self-signed certs',
      },
    ],
    tips: ['Enable encryption in prod'],
    tags: ['microsoft', 'sql', 'enterprise'],
  },
  {
    id: 'azure-sql',
    submitType: 'mssql',
    label: 'Azure SQL Database',
    category: 'Databases',
    icon: '🟦',
    description: 'Managed SQL Server on Azure',
    defaultPort: 1433,
    popularity: 80,
    fields: [
      {
        key: 'host',
        label: 'Server Name',
        type: 'text',
        placeholder: 'myserver.database.windows.net',
        required: true,
        validation: { pattern: VALIDATION_PATTERNS.azureServer },
      },
      { key: 'port', label: 'Port', type: 'number', placeholder: '1433', required: true },
      { key: 'database', label: 'Database', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'ssl', label: 'Encrypt (Required)', type: 'checkbox' },
    ],
    tips: ['Configure firewall rules', 'Use Azure AD if possible'],
    tags: ['azure', 'managed', 'microsoft', 'cloud'],
  },
  {
    id: 'mongodb',
    submitType: 'mongodb',
    label: 'MongoDB',
    category: 'Databases',
    icon: '🍃',
    description: 'NoSQL document database',
    defaultPort: 27017,
    popularity: 85,
    supportsConnectionString: true,
    connectionStringPlaceholder: 'mongodb+srv://user:pass@cluster.mongodb.net/db',
    parseConnectionString: CONNECTION_STRING_PARSERS.mongodb,
    fields: [
      { key: 'connectionString', label: 'Connection String (Recommended)', type: 'connectionString', placeholder: 'mongodb+srv://...' },
      { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost', dependsOn: { field: 'connectionString', condition: 'falsy' } },
      { key: 'port', label: 'Port', type: 'number', placeholder: '27017', dependsOn: { field: 'connectionString', condition: 'falsy' } },
      { key: 'database', label: 'Database', type: 'text' },
      { key: 'username', label: 'Username', type: 'text' },
      { key: 'password', label: 'Password', type: 'password' },
      { key: 'ssl', label: 'Use TLS', type: 'checkbox' },
    ],
    tips: ['Prefer connection strings for Atlas'],
    tags: ['nosql', 'document', 'json'],
  },

  // --- Warehouses ---
  {
    id: 'snowflake',
    submitType: 'snowflake',
    label: 'Snowflake',
    category: 'Warehouses',
    icon: '❄️',
    description: 'Cloud data warehouse',
    popularity: 90,
    fields: [
      { key: 'host', label: 'Account Identifier', type: 'text', placeholder: 'abc123.region.snowflakecomputing.com', required: true, validation: { pattern: VALIDATION_PATTERNS.snowflakeAccount } },
      { key: 'database', label: 'Database', type: 'text', required: true },
      { key: 'warehouse', label: 'Warehouse', type: 'text', placeholder: 'COMPUTE_WH', required: true },
      { key: 'schema', label: 'Schema', type: 'text', placeholder: 'PUBLIC' },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'role', label: 'Role', type: 'text', placeholder: 'PUBLIC' },
    ],
    tips: ['Use dedicated warehouses', 'Key-pair auth for prod'],
    tags: ['warehouse', 'cloud', 'enterprise'],
  },
  {
    id: 'bigquery',
    submitType: 'bigquery',
    label: 'Google BigQuery',
    category: 'Warehouses',
    icon: '📊',
    description: 'Serverless data warehouse',
    popularity: 85,
    fields: [
      {
        key: 'serviceAccountKey',
        label: 'Service Account JSON',
        type: 'textarea',
        placeholder: '{ "type": "service_account", ... }',
        required: true,
        validation: {
          custom: (value) => {
            try {
              const parsed = JSON.parse(value);
              return parsed?.type === 'service_account'
                ? null
                : 'Must be a service account JSON key';
            } catch {
              return 'Invalid JSON format';
            }
          },
        },
      },
      { key: 'projectId', label: 'Project ID', type: 'text', required: true, validation: { pattern: VALIDATION_PATTERNS.gcpProject } },
      {
        key: 'location',
        label: 'Location',
        type: 'select',
        options: [
          { value: 'US', label: 'US (Multi-region)' },
          { value: 'EU', label: 'EU (Multi-region)' },
          { value: 'us-central1', label: 'US Central 1' },
          { value: 'us-east1', label: 'US East 1' },
          { value: 'europe-west1', label: 'Europe West 1' },
        ],
      },
    ],
    tips: ['Least privilege for service accounts'],
    tags: ['google', 'serverless', 'warehouse'],
  },
  {
    id: 'synapse-dedicated',
    submitType: 'mssql',
    label: 'Azure Synapse Analytics',
    category: 'Warehouses',
    icon: '🟦',
    description: 'Enterprise data warehouse',
    defaultPort: 1433,
    popularity: 70,
    fields: [
      { key: 'host', label: 'Synapse Endpoint', type: 'text', placeholder: 'myworkspace.sql.azuresynapse.net', required: true },
      { key: 'port', label: 'Port', type: 'number', placeholder: '1433', required: true },
      { key: 'database', label: 'SQL Pool', type: 'text', required: true },
      { key: 'username', label: 'SQL Admin User', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'ssl', label: 'Encrypt (Required)', type: 'checkbox' },
    ],
    tips: ['Firewall rules for your IP'],
    tags: ['azure', 'warehouse', 'enterprise'],
  },

  // --- Storage ---
  {
    id: 's3',
    submitType: 's3',
    label: 'Amazon S3',
    category: 'Storage',
    icon: '☁️',
    description: 'Object storage service',
    popularity: 95,
    fields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'bucket', label: 'Bucket Name', type: 'text', required: true },
      {
        key: 'region',
        label: 'Region',
        type: 'select',
        options: [
          { value: 'us-east-1', label: 'US East (N. Virginia)' },
          { value: 'us-east-2', label: 'US East (Ohio)' },
          { value: 'us-west-2', label: 'US West (Oregon)' },
          { value: 'eu-west-1', label: 'Europe (Ireland)' },
          { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
          { value: 'ap-southeast-1', label: 'AP (Singapore)' },
        ],
        required: true,
      },
      { key: 'prefix', label: 'Prefix/Folder', type: 'text', placeholder: 'data/' },
    ],
    tips: ['Prefer IAM roles', 'Enable versioning'],
    tags: ['aws', 'storage', 'object'],
  },
  {
    id: 'azure-blob',
    submitType: 'azure-blob',
    label: 'Azure Blob Storage',
    category: 'Storage',
    icon: '🟦',
    description: 'Azure object storage',
    popularity: 70,
    fields: [
      { key: 'accountName', label: 'Storage Account Name', type: 'text', required: true },
      { key: 'accountKey', label: 'Account Key', type: 'password', required: true },
      { key: 'containerName', label: 'Container Name', type: 'text', required: true },
      { key: 'prefix', label: 'Blob Prefix', type: 'text', placeholder: 'data/' },
      { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'https://myaccount.blob.core.windows.net' },
    ],
    tips: ['Use SAS for fine-grained access'],
    tags: ['azure', 'storage', 'blob'],
  },
  {
    id: 'gcs',
    submitType: 'gcs',
    label: 'Google Cloud Storage',
    category: 'Storage',
    icon: '☁️',
    description: 'Google object storage',
    popularity: 75,
    fields: [
      {
        key: 'serviceAccountKey',
        label: 'Service Account JSON',
        type: 'textarea',
        required: true,
        validation: {
          custom: (v) => {
            try {
              JSON.parse(v);
              return null;
            } catch {
              return 'Invalid JSON format';
            }
          },
        },
      },
      { key: 'bucketName', label: 'Bucket Name', type: 'text', required: true },
      { key: 'prefix', label: 'Object Prefix', type: 'text', placeholder: 'data/' },
      { key: 'projectId', label: 'Project ID', type: 'text', validation: { pattern: VALIDATION_PATTERNS.gcpProject } },
    ],
    tips: ['Uniform bucket-level access'],
    tags: ['google', 'storage', 'gcp'],
  },

  // --- Streaming ---
  {
    id: 'kafka',
    submitType: 'kafka',
    label: 'Apache Kafka',
    category: 'Streaming',
    icon: '🚀',
    description: 'Distributed streaming platform',
    popularity: 80,
    fields: [
      { key: 'brokers', label: 'Bootstrap Servers (CSV)', type: 'text', placeholder: 'broker1:9092,broker2:9092', required: true, help: 'Comma-separated list' },
      { key: 'consumerGroup', label: 'Consumer Group', type: 'text', placeholder: 'cwic-consumer' },
      {
        key: 'securityProtocol',
        label: 'Security Protocol',
        type: 'select',
        options: [
          { value: 'PLAINTEXT', label: 'PLAINTEXT' },
          { value: 'SASL_PLAINTEXT', label: 'SASL_PLAINTEXT' },
          { value: 'SASL_SSL', label: 'SASL_SSL' },
          { value: 'SSL', label: 'SSL' },
        ],
      },
      {
        key: 'saslMechanism',
        label: 'SASL Mechanism',
        type: 'select',
        options: [
          { value: 'PLAIN', label: 'PLAIN' },
          { value: 'SCRAM-SHA-256', label: 'SCRAM-SHA-256' },
          { value: 'SCRAM-SHA-512', label: 'SCRAM-SHA-512' },
        ],
        dependsOn: { field: 'securityProtocol', value: 'SASL_PLAINTEXT', condition: 'equals' },
      },
      { key: 'saslUsername', label: 'SASL Username', type: 'text' },
      { key: 'saslPassword', label: 'SASL Password', type: 'password' },
    ],
    tips: ['Use SASL_SSL for prod', 'Monitor lag'],
    tags: ['streaming', 'real-time', 'apache'],
  },

  // --- API & Files ---
  {
    id: 'api',
    submitType: 'api',
    label: 'REST API',
    category: 'API & Files',
    icon: '🔌',
    description: 'HTTP REST API endpoint',
    popularity: 75,
    fields: [
      { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://api.example.com', required: true, validation: { pattern: VALIDATION_PATTERNS.url } },
      {
        key: 'authType',
        label: 'Authentication Type',
        type: 'select',
        options: [
          { value: 'none', label: 'None' },
          { value: 'api-key', label: 'API Key' },
          { value: 'bearer', label: 'Bearer Token' },
          { value: 'basic', label: 'Basic Auth' },
          { value: 'oauth2', label: 'OAuth 2.0' },
        ],
      },
      { key: 'apiKey', label: 'API Key', type: 'password', dependsOn: { field: 'authType', value: 'api-key', condition: 'equals' } },
      { key: 'apiKeyHeader', label: 'API Key Header', type: 'text', placeholder: 'X-API-Key', dependsOn: { field: 'authType', value: 'api-key', condition: 'equals' } },
      { key: 'bearerToken', label: 'Bearer Token', type: 'password', dependsOn: { field: 'authType', value: 'bearer', condition: 'equals' } },
      { key: 'username', label: 'Username', type: 'text', dependsOn: { field: 'authType', value: 'basic', condition: 'equals' } },
      { key: 'password', label: 'Password', type: 'password', dependsOn: { field: 'authType', value: 'basic', condition: 'equals' } },
      { key: 'timeout', label: 'Timeout (seconds)', type: 'number', placeholder: '30', validation: { min: 1, max: 300 } },
      { key: 'rateLimit', label: 'Rate Limit (req/min)', type: 'number', placeholder: '100' },
    ],
    tips: ['Put API keys in headers', 'Rate limit to avoid throttling'],
    tags: ['http', 'rest', 'api'],
  },
  {
    id: 'file',
    submitType: 'file',
    label: 'File System',
    category: 'API & Files',
    icon: '📁',
    description: 'Local or network file system',
    popularity: 60,
    fields: [
      { key: 'path', label: 'File Path / Glob', type: 'text', placeholder: '/data/*.csv or C:\\data\\*.json', required: true, help: 'Supports glob patterns' },
      {
        key: 'format',
        label: 'File Format',
        type: 'select',
        options: [
          { value: 'csv', label: 'CSV' },
          { value: 'json', label: 'JSON' },
          { value: 'jsonl', label: 'JSON Lines' },
          { value: 'parquet', label: 'Parquet' },
          { value: 'xlsx', label: 'Excel (XLSX)' },
          { value: 'xml', label: 'XML' },
          { value: 'txt', label: 'Text' },
        ],
        required: true,
      },
      { key: 'encoding', label: 'Text Encoding', type: 'select', options: [{ value: 'utf-8', label: 'UTF-8' }, { value: 'utf-16', label: 'UTF-16' }, { value: 'latin1', label: 'Latin-1' }, { value: 'ascii', label: 'ASCII' }], dependsOn: { field: 'format', value: 'csv', condition: 'equals' } },
      { key: 'delimiter', label: 'Delimiter', type: 'text', placeholder: ',', dependsOn: { field: 'format', value: 'csv', condition: 'equals' } },
      { key: 'hasHeader', label: 'Has Header Row', type: 'checkbox', dependsOn: { field: 'format', value: 'csv', condition: 'equals' } },
      { key: 'recursive', label: 'Scan Subdirectories', type: 'checkbox' },
    ],
    tips: ['Check file permissions', 'Start with a small subset'],
    tags: ['filesystem', 'local', 'files'],
  },
  {
    id: 'elasticsearch',
    submitType: 'elasticsearch',
    label: 'Elasticsearch',
    category: 'Databases',
    icon: '🔍',
    description: 'Search and analytics engine',
    defaultPort: 9200,
    popularity: 70,
    fields: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true },
      { key: 'port', label: 'Port', type: 'number', placeholder: '9200' },
      { key: 'username', label: 'Username', type: 'text' },
      { key: 'password', label: 'Password', type: 'password' },
      { key: 'ssl', label: 'Use HTTPS', type: 'checkbox' },
      { key: 'apiKey', label: 'API Key', type: 'password' },
      { key: 'cloudId', label: 'Elastic Cloud ID', type: 'text', placeholder: 'deployment:base64...' },
      { key: 'index', label: 'Default Index Pattern', type: 'text', placeholder: 'logs-*' },
    ],
    tips: ['Use API keys', 'Enable security features'],
    tags: ['search', 'analytics', 'elk'],
  },
  {
    id: 'redis',
    submitType: 'redis',
    label: 'Redis',
    category: 'Databases',
    icon: '📦',
    description: 'In-memory data store',
    defaultPort: 6379,
    popularity: 85,
    fields: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true },
      { key: 'port', label: 'Port', type: 'number', placeholder: '6379', required: true },
      { key: 'password', label: 'Password', type: 'password' },
      { key: 'database', label: 'Database Number', type: 'number', placeholder: '0' },
      { key: 'ssl', label: 'Use TLS', type: 'checkbox' },
      { key: 'keyPrefix', label: 'Key Prefix', type: 'text', placeholder: 'myapp:' },
    ],
    tips: ['Use AUTH in prod', 'Expiry for memory mgmt'],
    tags: ['cache', 'memory', 'key-value'],
  },
];

/* =========================
   Category / helpers
========================= */
export const CATEGORIES: ConnectorCategory[] = [
  'Databases',
  'Warehouses',
  'Storage',
  'Streaming',
  'API & Files',
];

export function getPopularConnectors(limit = 6): ConnectorMeta[] {
  return [...CONNECTORS]
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, limit);
}

export function getNewConnectors(): ConnectorMeta[] {
  return CONNECTORS.filter((c) => c.isNew);
}

export function searchConnectors(query: string): ConnectorMeta[] {
  const q = query.toLowerCase().trim();
  return CONNECTORS.filter(
    (c) =>
      c.label.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.tags?.some((t) => t.toLowerCase().includes(q)) ||
      String(c.id).toLowerCase().includes(q)
  );
}

export function validateField(
  field: FieldDef,
  value: any,
  config: ConnectionConfig
): string | null {
  if (field.required && (value === undefined || value === null || value === '')) {
    return `${field.label} is required`;
  }
  if (!value && !field.required) return null;

  if (field.validation?.pattern && !field.validation.pattern.test(String(value))) {
    return `${field.label} format is invalid`;
  }

  if (field.type === 'number') {
    const n = Number(value);
    if (field.validation?.min !== undefined && n < field.validation.min) {
      return `${field.label} must be at least ${field.validation.min}`;
    }
    if (field.validation?.max !== undefined && n > field.validation.max) {
      return `${field.label} must be at most ${field.validation.max}`;
    }
  }

  if (field.validation?.custom) {
    return field.validation.custom(value, config);
  }
  return null;
}

export function shouldShowField(field: FieldDef, config: ConnectionConfig): boolean {
  if (!field.dependsOn) return true;

  const { field: dep, value, condition = 'equals' } = field.dependsOn;
  const dv =
    dep.startsWith('custom.')
      ? (config.customOptions || {})[dep.slice('custom.'.length)]
      : (config as any)[dep];

  switch (condition) {
    case 'equals':
      return dv === value;
    case 'not-equals':
      return dv !== value;
    case 'truthy':
      return !!dv;
    case 'falsy':
      return !dv;
    default:
      return true;
  }
}

/* =========================
   Migration helpers
========================= */
type MigrationPath = {
  name: string;
  description: string;
  fieldMapping: Record<string, string>;
  transformations: Record<string, (v: any) => any>;
};

export const MIGRATION_PATHS: Record<string, MigrationPath> = {
  'mysql-to-postgresql': {
    name: 'MySQL to PostgreSQL',
    description: 'Copy common fields; toggle SSL on',
    fieldMapping: { host: 'host', port: 'port', database: 'database', username: 'username', password: 'password' },
    transformations: { port: (v: number) => (v === 3306 ? 5432 : v), ssl: () => true },
  },
};

export function getMigrationPath(fromId: ConnectorId, toId: ConnectorId) {
  return MIGRATION_PATHS[`${fromId}-to-${toId}`];
}

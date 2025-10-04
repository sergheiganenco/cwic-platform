// src/components/features/data-sources/AddConnectionWizard.tsx
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  Database,
  Eye,
  EyeOff,
  FileText,
  Filter,
  HardDrive,
  Info,
  Loader2,
  Lock,
  Search,
  Server,
  Settings,
  Shield,
  Star,
  TestTube,
  Unlock,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { dataSourcesApi } from '@/services/api/dataSources'; // ⬅️ fallback to your real API
import type {
  ConnectionConfig,
  CreateDataSourcePayload,
  DataSource,
  DataSourceType,
} from '@/types/dataSources';

/* ----------------------------------------------------------------------------
   Helpers: normalize test response (now with diagnostics)
---------------------------------------------------------------------------- */

type NormalizedTestResult = {
  success: boolean;
  message: string;
  databases: any[];
  metadata: any | null;
  connectionStatus?: string;
  responseTime?: number;
  testedAt?: string | number | Date;
};

function normalizeTestResponse(r: any) {
  const inner = r?.data ?? r;

  const success =
    typeof inner?.success === 'boolean'
      ? inner.success
      : typeof r?.success === 'boolean'
      ? r.success
      : false;

  const message =
    inner?.error ||
    inner?.details?.serverInfo?.statusText ||
    inner?.message ||
    r?.error ||
    r?.message ||
    (success ? 'Connection OK' : 'Connection test failed');

  const databases = Array.isArray(inner?.databases) ? inner.databases : r?.databases || [];
  const metadata  = inner?.metadata ?? r?.metadata ?? null;

  // ⬇️ pass through common diagnostics if present (your backend already returns these)
  const connectionStatus = inner?.connectionStatus ?? r?.connectionStatus;
  const responseTime     = inner?.responseTime ?? r?.responseTime;
  const testedAt         = inner?.testedAt ?? r?.testedAt;

  return { success, message, databases, metadata, connectionStatus, responseTime, testedAt };
}


/* ----------------------------------------------------------------------------
   Strong Types (UI-side)
---------------------------------------------------------------------------- */
type ConnectionScope = 'server' | 'cluster' | 'database' | 'schema'
type EnvironmentType = 'development' | 'staging' | 'production' | 'testing'
type SecurityLevel = 'basic' | 'enhanced' | 'enterprise'
type DiscoveryMode = 'auto' | 'manual' | 'scheduled' | 'guided'

export interface DatabaseInfo {
  name: string
  schema?: string
  size?: string
  tables?: number
  views?: number
  procedures?: number
  lastAccessed?: string
  accessible?: boolean
  selected?: boolean
  permissions?: string[]
  quality?: 'high' | 'medium' | 'low'
  usage?: 'active' | 'moderate' | 'inactive'
  owner?: string
  description?: string
  tags?: string[]
}

export interface ServerMetadata {
  version?: string
  edition?: string
  maxConnections?: number
  currentConnections?: number
  uptime?: string
  performance?: { cpu?: number; memory?: number; storage?: number }
}

type FieldType =
  | 'text'
  | 'password'
  | 'number'
  | 'textarea'
  | 'select'
  | 'toggle'
  | 'array'
  | 'url'
  | 'file'

interface EnhancedConnectorField {
  key: string
  label: string
  type: FieldType
  required?: boolean
  sensitive?: boolean
  placeholder?: string
  help?: string
  options?: Array<{
    label: string
    value: string
    description?: string
    recommended?: boolean
  }>
  validation?: {
    pattern?: string
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
  }
  dependsOn?: {
    field: string
    value?: any
    condition?: 'equals' | 'not-equals' | 'truthy' | 'falsy' | 'contains'
  }
  wide?: boolean
  group?:
    | 'basic'
    | 'authentication'
    | 'security'
    | 'discovery'
    | 'advanced'
    | 'general'
  autoComplete?: 'on' | 'off' | 'username' | 'new-password'
}

interface ConnectionExample {
  id: string
  name: string
  description: string
  environment: EnvironmentType
  security: SecurityLevel
  config: Record<string, any>
  requirements?: string[]
  notes?: string
}

interface ValidationRule {
  field: string
  rule: 'required' | 'format' | 'range'
  params?: any
  message: string
  severity: 'error' | 'warning' | 'info'
}

/**
 * Connector template drives UI + safe config mapping to backend ConnectionConfig
 */
interface ConnectorTemplate {
  id: string // UI id
  submitType: DataSourceType // backend DataSourceType
  name: string
  description: string
  icon: string
  category: string
  scope: ConnectionScope
  environment: EnvironmentType
  security: SecurityLevel
  defaultPort?: number
  supportsDiscovery?: boolean
  supportsServerLevel?: boolean
  fields: EnhancedConnectorField[]
  examples: ConnectionExample[]
  validationRules: ValidationRule[]
  /** Allow-list of keys to send inside connectionConfig for this connector */
  configKeys: readonly string[]
  /** Optional custom mapper to transform UI cfg -> ConnectionConfig */
  toConfig?: (ui: Record<string, any>) => ConnectionConfig
  tags: string[]
  isPopular?: boolean
  isNew?: boolean
  isEnterprise?: boolean
  documentation?: string
  troubleshooting?: Array<{ issue: string; solution: string }>
}

/* utils */
function pick<T extends object, K extends readonly string[]>(
  obj: T,
  keys: K,
): Record<K[number], any> {
  const out: Record<string, any> = {}
  for (const k of keys) {
    if (k in obj) out[k] = (obj as any)[k]
  }
  return out as Record<K[number], any>
}

/* ----------------------------------------------------------------------------
   Connector Registry
---------------------------------------------------------------------------- */
const CONNECTORS: ConnectorTemplate[] = [
  {
    id: 'postgresql-server',
    submitType: 'postgresql',
    name: 'PostgreSQL Server',
    description: 'Server-level connection; auto-discover databases.',
    icon: '🐘',
    category: 'Relational Databases',
    scope: 'server',
    environment: 'production',
    security: 'enterprise',
    defaultPort: 5432,
    supportsDiscovery: true,
    supportsServerLevel: true,
    tags: ['sql', 'server-level', 'acid', 'oss'],
    fields: [
      {
        key: 'name',
        label: 'Connection Name',
        type: 'text',
        required: true,
        wide: true,
        group: 'basic',
        autoComplete: 'off',
      },
      {
        key: 'host',
        label: 'Server Host',
        type: 'text',
        required: true,
        placeholder: 'db.company.com',
        validation: { pattern: '^[a-zA-Z0-9.-]+$' },
        group: 'basic',
        autoComplete: 'off',
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        required: true,
        placeholder: '5432',
        validation: { min: 1, max: 65535 },
        group: 'basic',
      },
      {
        key: 'database',
        label: 'Database',
        type: 'text',
        required: false,
        placeholder: 'postgres',
        group: 'basic',
        help: 'Used for the connectivity test. Defaults to "postgres".',
      },
      {
        key: 'username',
        label: 'Username',
        type: 'text',
        required: true,
        placeholder: 'postgres',
        group: 'authentication',
        autoComplete: 'username',
      },
      {
        key: 'password',
        label: 'Password',
        type: 'password',
        required: true,
        sensitive: true,
        group: 'authentication',
        autoComplete: 'new-password',
      },
      { key: 'ssl', label: 'Enable SSL/TLS', type: 'toggle', group: 'security' },
      {
        key: 'discoveryMode',
        label: 'Database Discovery',
        type: 'select',
        group: 'discovery',
        options: [
          {
            label: 'Automatic',
            value: 'auto',
            description: 'Auto-discover new databases',
            recommended: true,
          },
          { label: 'Manual', value: 'manual' },
          { label: 'Scheduled', value: 'scheduled' },
        ],
      },
    ],
    validationRules: [
      {
        field: 'host',
        rule: 'required',
        message: 'Server host is required',
        severity: 'error',
      },
      {
        field: 'port',
        rule: 'range',
        params: { min: 1, max: 65535 },
        message: 'Port must be between 1 and 65535',
        severity: 'error',
      },
    ],
    examples: [
      {
        id: 'pg-local',
        name: 'Local Dev',
        description: 'Local Docker/Homebrew',
        environment: 'development',
        security: 'basic',
        config: {
          host: 'localhost',
          port: 5432,
          database: 'postgres', 
          username: 'postgres',
          ssl: false,
          discoveryMode: 'auto',
        },
      },
      {
        id: 'pg-rds',
        name: 'AWS RDS',
        description: 'Production with SSL',
        environment: 'production',
        security: 'enterprise',
        config: { port: 5432, ssl: true, discoveryMode: 'scheduled' },
      },
    ],
    configKeys: ['host', 'port','database' ,'username', 'password', 'ssl'] as const,
  },

  {
    id: 'mysql-server',
    submitType: 'mysql',
    name: 'MySQL Server',
    description: 'Server-level connection; auto-discover databases.',
    icon: '🐬',
    category: 'Relational Databases',
    scope: 'server',
    environment: 'production',
    security: 'enhanced',
    defaultPort: 3306,
    supportsDiscovery: true,
    supportsServerLevel: true,
    tags: ['sql', 'server-level'],
    fields: [
      {
        key: 'name',
        label: 'Connection Name',
        type: 'text',
        required: true,
        wide: true,
        group: 'basic',
      },
      {
        key: 'host',
        label: 'Server Host',
        type: 'text',
        required: true,
        placeholder: 'mysql.company.com',
        group: 'basic',
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        required: true,
        placeholder: '3306',
        validation: { min: 1, max: 65535 },
        group: 'basic',
      },
      { key: 'username', label: 'Username', type: 'text', required: true, group: 'authentication' },
      {
        key: 'password',
        label: 'Password',
        type: 'password',
        required: true,
        sensitive: true,
        group: 'authentication',
      },
      { key: 'ssl', label: 'Enable SSL', type: 'toggle', group: 'security' },
    ],
    validationRules: [
      {
        field: 'host',
        rule: 'required',
        message: 'Server host is required',
        severity: 'error',
      },
    ],
    examples: [
      {
        id: 'mysql-local',
        name: 'Local Dev',
        description: 'Local MySQL',
        environment: 'development',
        security: 'basic',
        config: { host: 'localhost', port: 3306, ssl: false },
      },
    ],
    configKeys: ['host', 'port', 'username', 'password', 'ssl'] as const,
  },

  {
    id: 'mssql-server',
    submitType: 'mssql',
    name: 'SQL Server',
    description: 'Connect to SQL Server instance and discover databases.',
    icon: '🏢',
    category: 'Relational Databases',
    scope: 'server',
    environment: 'production',
    security: 'enhanced',
    defaultPort: 1433,
    supportsDiscovery: true,
    supportsServerLevel: true,
    tags: ['microsoft', 'azure', 'managed'],
    fields: [
      {
        key: 'name',
        label: 'Connection Name',
        type: 'text',
        required: true,
        wide: true,
        group: 'basic',
      },
      {
        key: 'host',
        label: 'Server Host',
        type: 'text',
        required: true,
        placeholder: 'myserver.database.windows.net',
        group: 'basic',
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        required: true,
        placeholder: '1433',
        validation: { min: 1, max: 65535 },
        group: 'basic',
      },
      { key: 'username', label: 'Username', type: 'text', required: true, group: 'authentication' },
      {
        key: 'password',
        label: 'Password',
        type: 'password',
        required: true,
        sensitive: true,
        group: 'authentication',
      },
      { key: 'ssl', label: 'Encrypt/SSL', type: 'toggle', group: 'security' },
    ],
    validationRules: [
      {
        field: 'host',
        rule: 'required',
        message: 'Server host is required',
        severity: 'error',
      },
    ],
    examples: [
      {
        id: 'mssql-azure',
        name: 'Azure SQL',
        description: 'Azure-hosted SQL Server',
        environment: 'production',
        security: 'enhanced',
        config: { port: 1433, ssl: true },
      },
    ],
    configKeys: ['host', 'port', 'username', 'password', 'ssl'] as const,
  },

  {
    id: 'snowflake-account',
    submitType: 'snowflake',
    name: 'Snowflake Account',
    description: 'Account-level connection (warehouses/databases discovery).',
    icon: '❄️',
    category: 'Cloud Warehouses',
    scope: 'cluster',
    environment: 'production',
    security: 'enterprise',
    defaultPort: 443,
    supportsDiscovery: true,
    supportsServerLevel: true,
    isPopular: true,
    tags: ['cloud', 'warehouse', 'account-level'],
    fields: [
      {
        key: 'name',
        label: 'Connection Name',
        type: 'text',
        required: true,
        wide: true,
        group: 'basic',
      },
      {
        key: 'account',
        label: 'Account Identifier',
        type: 'text',
        required: true,
        placeholder: 'xyz12345.us-east-1',
        group: 'basic',
      },
      { key: 'username', label: 'Username', type: 'text', required: true, group: 'authentication' },
      {
        key: 'password',
        label: 'Password',
        type: 'password',
        required: true,
        sensitive: true,
        group: 'authentication',
      },
      {
        key: 'warehouse',
        label: 'Default Warehouse',
        type: 'text',
        required: true,
        group: 'basic',
      },
    ],
    validationRules: [
      {
        field: 'account',
        rule: 'format',
        params: { pattern: '^[a-zA-Z0-9._-]+$' },
        message: 'Invalid account format',
        severity: 'error',
      },
    ],
    examples: [
      {
        id: 'sn-prod',
        name: 'Production',
        description: 'Full access account',
        environment: 'production',
        security: 'enterprise',
        config: { warehouse: 'COMPUTE_WH' },
      },
    ],
    configKeys: ['account', 'username', 'password', 'warehouse'] as const,
  },

  {
    id: 'bigquery-project',
    submitType: 'bigquery',
    name: 'BigQuery Project',
    description: 'Connect to a GCP project and discover datasets.',
    icon: '📊',
    category: 'Cloud Warehouses',
    scope: 'cluster',
    environment: 'production',
    security: 'enterprise',
    supportsDiscovery: true,
    tags: ['gcp', 'warehouse'],
    fields: [
      {
        key: 'name',
        label: 'Connection Name',
        type: 'text',
        required: true,
        wide: true,
        group: 'basic',
      },
      { key: 'projectId', label: 'Project ID', type: 'text', required: true, group: 'basic' },
      {
        key: 'serviceAccountKey',
        label: 'Service Account JSON',
        type: 'textarea',
        required: true,
        sensitive: true,
        group: 'authentication',
      },
    ],
    validationRules: [
      {
        field: 'projectId',
        rule: 'required',
        message: 'Project ID is required',
        severity: 'error',
      },
    ],
    examples: [
      {
        id: 'bq-prod',
        name: 'Prod Project',
        description: 'Org prod project',
        environment: 'production',
        security: 'enterprise',
        config: {},
      },
    ],
    configKeys: ['projectId', 'serviceAccountKey'] as const,
  },

  {
    id: 'redshift-cluster',
    submitType: 'redshift',
    name: 'Amazon Redshift',
    description: 'Connect to your Redshift cluster.',
    icon: '🔴',
    category: 'Cloud Warehouses',
    scope: 'cluster',
    environment: 'production',
    security: 'enterprise',
    defaultPort: 5439,
    supportsDiscovery: true,
    tags: ['aws', 'warehouse'],
    fields: [
      {
        key: 'name',
        label: 'Connection Name',
        type: 'text',
        required: true,
        wide: true,
        group: 'basic',
      },
      { key: 'host', label: 'Cluster Endpoint', type: 'text', required: true, group: 'basic' },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        required: true,
        placeholder: '5439',
        validation: { min: 1, max: 65535 },
        group: 'basic',
      },
      { key: 'username', label: 'Username', type: 'text', required: true, group: 'authentication' },
      {
        key: 'password',
        label: 'Password',
        type: 'password',
        required: true,
        sensitive: true,
        group: 'authentication',
      },
      { key: 'ssl', label: 'Enable SSL', type: 'toggle', group: 'security' },
    ],
    validationRules: [
      {
        field: 'host',
        rule: 'required',
        message: 'Cluster endpoint is required',
        severity: 'error',
      },
    ],
    examples: [
      {
        id: 'rs-prod',
        name: 'Production',
        description: 'Prod cluster',
        environment: 'production',
        security: 'enterprise',
        config: { ssl: true },
      },
    ],
    configKeys: ['host', 'port', 'username', 'password', 'ssl'] as const,
  },

  {
    id: 'databricks-sql',
    submitType: 'databricks',
    name: 'Databricks SQL',
    description: 'Connect to a Databricks SQL endpoint.',
    icon: '🧱',
    category: 'Cloud Warehouses',
    scope: 'cluster',
    environment: 'production',
    security: 'enterprise',
    supportsDiscovery: true,
    tags: ['lakehouse', 'warehouse'],
    fields: [
      {
        key: 'name',
        label: 'Connection Name',
        type: 'text',
        required: true,
        wide: true,
        group: 'basic',
      },
      { key: 'host', label: 'Host', type: 'text', required: true, group: 'basic' },
      { key: 'httpPath', label: 'HTTP Path', type: 'text', required: true, group: 'basic' },
      {
        key: 'accessToken',
        label: 'Access Token',
        type: 'password',
        required: true,
        sensitive: true,
        group: 'authentication',
      },
    ],
    validationRules: [
      { field: 'host', rule: 'required', message: 'Host is required', severity: 'error' },
    ],
    examples: [
      {
        id: 'dbx-sql',
        name: 'Workspace SQL',
        description: 'SQL Warehouse endpoint',
        environment: 'production',
        security: 'enterprise',
        config: {},
      },
    ],
    configKeys: ['host', 'httpPath', 'accessToken'] as const,
  },

  {
    id: 'mongodb-server',
    submitType: 'mongodb',
    name: 'MongoDB Server',
    description: 'Connect to Mongo and discover databases.',
    icon: '🍃',
    category: 'NoSQL',
    scope: 'server',
    environment: 'production',
    security: 'enhanced',
    defaultPort: 27017,
    supportsDiscovery: true,
    tags: ['nosql', 'document'],
    fields: [
      {
        key: 'name',
        label: 'Connection Name',
        type: 'text',
        required: true,
        wide: true,
        group: 'basic',
      },
      { key: 'host', label: 'Server Host', type: 'text', required: true, group: 'basic' },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        required: true,
        placeholder: '27017',
        validation: { min: 1, max: 65535 },
        group: 'basic',
      },
      { key: 'username', label: 'Username', type: 'text', required: false, group: 'authentication' },
      {
        key: 'password',
        label: 'Password',
        type: 'password',
        required: false,
        sensitive: true,
        group: 'authentication',
      },
      {
        key: 'replicaSet',
        label: 'Replica Set',
        type: 'text',
        required: false,
        group: 'advanced',
      },
      { key: 'ssl', label: 'Enable SSL', type: 'toggle', group: 'security' },
    ],
    validationRules: [
      { field: 'host', rule: 'required', message: 'Host is required', severity: 'error' },
    ],
    examples: [
      {
        id: 'mongo-dev',
        name: 'Dev Cluster',
        description: 'Dev replica set',
        environment: 'development',
        security: 'enhanced',
        config: { ssl: false },
      },
    ],
    configKeys: ['host', 'port', 'username', 'password', 'replicaSet', 'ssl'] as const,
  },

  {
    id: 'elasticsearch-cluster',
    submitType: 'elasticsearch',
    name: 'Elasticsearch',
    description: 'Connect to cluster for index discovery.',
    icon: '🔍',
    category: 'Search',
    scope: 'cluster',
    environment: 'production',
    security: 'enhanced',
    supportsDiscovery: true,
    tags: ['search', 'indices'],
    fields: [
      {
        key: 'name',
        label: 'Connection Name',
        type: 'text',
        required: true,
        wide: true,
        group: 'basic',
      },
      {
        key: 'host',
        label: 'Cluster URL',
        type: 'text',
        required: true,
        placeholder: 'https://es.company.com:9200',
        group: 'basic',
      },
      { key: 'username', label: 'Username', type: 'text', required: false, group: 'authentication' },
      {
        key: 'password',
        label: 'Password',
        type: 'password',
        required: false,
        sensitive: true,
        group: 'authentication',
      },
    ],
    validationRules: [
      {
        field: 'host',
        rule: 'required',
        message: 'Cluster URL is required',
        severity: 'error',
      },
    ],
    examples: [
      {
        id: 'es-prod',
        name: 'Prod ES',
        description: 'Managed cluster',
        environment: 'production',
        security: 'enhanced',
        config: {},
      },
    ],
    configKeys: ['host', 'username', 'password'] as const,
  },

  {
    id: 's3-bucket',
    submitType: 's3',
    name: 'Amazon S3',
    description: 'Connect to S3 bucket (object discovery/browse).',
    icon: '☁️',
    category: 'Object Storage',
    scope: 'cluster',
    environment: 'production',
    security: 'enhanced',
    supportsDiscovery: true,
    tags: ['files', 'lake'],
    fields: [
      {
        key: 'name',
        label: 'Connection Name',
        type: 'text',
        required: true,
        wide: true,
        group: 'basic',
      },
      { key: 'bucket', label: 'Bucket', type: 'text', required: true, group: 'basic' },
      { key: 'region', label: 'Region', type: 'text', required: false, group: 'basic' },
      {
        key: 'accessKeyId',
        label: 'Access Key ID',
        type: 'text',
        required: true,
        group: 'authentication',
      },
      {
        key: 'secretAccessKey',
        label: 'Secret Access Key',
        type: 'password',
        required: true,
        sensitive: true,
        group: 'authentication',
      },
    ],
    validationRules: [
      { field: 'bucket', rule: 'required', message: 'Bucket is required', severity: 'error' },
    ],
    examples: [
      {
        id: 's3-lake',
        name: 'Data Lake',
        description: 'Central lake bucket',
        environment: 'production',
        security: 'enhanced',
        config: {},
      },
    ],
    configKeys: ['bucket', 'region', 'accessKeyId', 'secretAccessKey'] as const,
  },

  {
    id: 'azure-blob',
    submitType: 'azure-blob',
    name: 'Azure Blob Storage',
    description: 'Connect to Azure blob container.',
    icon: '🟦',
    category: 'Object Storage',
    scope: 'cluster',
    environment: 'production',
    security: 'enhanced',
    supportsDiscovery: true,
    tags: ['files', 'azure'],
    fields: [
      {
        key: 'name',
        label: 'Connection Name',
        type: 'text',
        required: true,
        wide: true,
        group: 'basic',
      },
      { key: 'accountName', label: 'Account Name', type: 'text', required: true, group: 'basic' },
      { key: 'containerName', label: 'Container', type: 'text', required: true, group: 'basic' },
      {
        key: 'sasToken',
        label: 'SAS Token',
        type: 'password',
        required: true,
        sensitive: true,
        group: 'authentication',
      },
    ],
    validationRules: [
      {
        field: 'containerName',
        rule: 'required',
        message: 'Container is required',
        severity: 'error',
      },
    ],
    examples: [
      {
        id: 'ab-lake',
        name: 'Lake Container',
        description: 'Landing zone',
        environment: 'production',
        security: 'enhanced',
        config: {},
      },
    ],
    configKeys: ['accountName', 'containerName', 'sasToken'] as const,
  },

  {
    id: 'gcs-bucket',
    submitType: 'gcs',
    name: 'Google Cloud Storage',
    description: 'Connect to a GCS bucket.',
    icon: '☁️',
    category: 'Object Storage',
    scope: 'cluster',
    environment: 'production',
    security: 'enhanced',
    supportsDiscovery: true,
    tags: ['files', 'gcp'],
    fields: [
      {
        key: 'name',
        label: 'Connection Name',
        type: 'text',
        required: true,
        wide: true,
        group: 'basic',
      },
      { key: 'bucketName', label: 'Bucket', type: 'text', required: true, group: 'basic' },
      { key: 'projectId', label: 'Project ID', type: 'text', required: false, group: 'basic' },
      {
        key: 'serviceAccountKey',
        label: 'Service Account JSON',
        type: 'textarea',
        required: true,
        sensitive: true,
        group: 'authentication',
      },
    ],
    validationRules: [
      {
        field: 'bucketName',
        rule: 'required',
        message: 'Bucket is required',
        severity: 'error',
      },
    ],
    examples: [
      {
        id: 'gcs-lake',
        name: 'Lake Bucket',
        description: 'Lakehouse files',
        environment: 'production',
        security: 'enhanced',
        config: {},
      },
    ],
    configKeys: ['bucketName', 'projectId', 'serviceAccountKey'] as const,
  },

  {
    id: 'rest-api',
    submitType: 'api',
    name: 'REST API',
    description: 'Connect to a REST/HTTP data API.',
    icon: '🔌',
    category: 'APIs',
    scope: 'cluster',
    environment: 'production',
    security: 'enhanced',
    supportsDiscovery: false,
    tags: ['http', 'json'],
    fields: [
      {
        key: 'name',
        label: 'Connection Name',
        type: 'text',
        required: true,
        wide: true,
        group: 'basic',
      },
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        required: true,
        placeholder: 'https://api.company.com',
        group: 'basic',
      },
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: false,
        sensitive: true,
        group: 'authentication',
      },
    ],
    validationRules: [
      {
        field: 'baseUrl',
        rule: 'required',
        message: 'Base URL is required',
        severity: 'error',
      },
    ],
    examples: [
      {
        id: 'api-public',
        name: 'Public API',
        description: 'Read-only public endpoints',
        environment: 'staging',
        security: 'basic',
        config: {},
      },
    ],
    configKeys: ['baseUrl', 'apiKey'] as const,
  },

  {
    id: 'oracle-db',
    submitType: 'oracle',
    name: 'Oracle Database',
    description: 'Connect to Oracle (on-prem, OCI, or Autonomous Database).',
    icon: '🏛️',
    category: 'Relational Databases',
    scope: 'server',
    environment: 'production',
    security: 'enterprise',
    defaultPort: 1521,
    supportsDiscovery: true,
    isPopular: true,
    tags: ['enterprise', 'oci', 'autonomous', 'tnsnames', 'wallet'],

    fields: [
      {
        key: 'name',
        label: 'Connection Name',
        type: 'text',
        required: true,
        wide: true,
        group: 'basic',
      },
      {
        key: 'mode',
        label: 'Connect Using',
        type: 'select',
        required: true,
        group: 'basic',
        options: [
          { label: 'Host / Port / Service Name', value: 'basic', recommended: true },
          { label: 'Easy Connect String (EZCONNECT/TNS)', value: 'ez' },
        ],
      },

      {
        key: 'host',
        label: 'Host',
        type: 'text',
        required: true,
        group: 'basic',
        dependsOn: { field: 'mode', value: 'basic', condition: 'equals' },
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        required: true,
        placeholder: '1521',
        group: 'basic',
        validation: { min: 1, max: 65535 },
        dependsOn: { field: 'mode', value: 'basic', condition: 'equals' },
      },
      {
        key: 'serviceName',
        label: 'Service Name (or SID)',
        type: 'text',
        required: true,
        group: 'basic',
        help: 'e.g. ORCLPDB1 or a TNS service name',
        dependsOn: { field: 'mode', value: 'basic', condition: 'equals' },
      },

      {
        key: 'connectString',
        label: 'Easy Connect String',
        type: 'text',
        required: true,
        group: 'basic',
        placeholder: 'host:port/service_name or //host:port/service_name',
        help: 'EZCONNECT or a TNS alias present in tnsnames.ora',
        dependsOn: { field: 'mode', value: 'ez', condition: 'equals' },
      },

      { key: 'username', label: 'Username', type: 'text', required: true, group: 'authentication' },
      {
        key: 'password',
        label: 'Password',
        type: 'password',
        required: true,
        sensitive: true,
        group: 'authentication',
      },

      { key: 'ssl', label: 'Enable SSL/TLS', type: 'toggle', group: 'security' },
      {
        key: 'walletMode',
        label: 'Wallet',
        type: 'select',
        group: 'security',
        options: [
          { label: 'None', value: 'none', recommended: true },
          { label: 'Wallet ZIP (Base64)', value: 'zip' },
          { label: 'Wallet Directory Path', value: 'dir' },
        ],
      },
      {
        key: 'walletZipBase64',
        label: 'Wallet ZIP (base64)',
        type: 'textarea',
        sensitive: true,
        group: 'security',
        placeholder: 'Paste base64 of the wallet ZIP (Autonomous DB)',
        dependsOn: { field: 'walletMode', value: 'zip', condition: 'equals' },
      },
      {
        key: 'walletDir',
        label: 'Wallet Directory',
        type: 'text',
        group: 'security',
        placeholder: '/opt/oracle/wallet',
        dependsOn: { field: 'walletMode', value: 'dir', condition: 'equals' },
      },

      {
        key: 'role',
        label: 'Role',
        type: 'text',
        group: 'advanced',
        placeholder: 'SYSDBA, SYSOPER (if applicable)',
      },
    ],

    validationRules: [
      { field: 'mode', rule: 'required', message: 'Select a connection mode', severity: 'error' },
      { field: 'host', rule: 'required', message: 'Host is required', severity: 'error' },
      {
        field: 'port',
        rule: 'range',
        params: { min: 1, max: 65535 },
        message: 'Port must be 1–65535',
        severity: 'error',
      },
      {
        field: 'serviceName',
        rule: 'required',
        message: 'Service name (or SID) is required',
        severity: 'error',
      },
      {
        field: 'connectString',
        rule: 'format',
        params: { pattern: '^[^\\s]+$' },
        message: 'Provide a valid connect string',
        severity: 'error',
      },
    ],

    examples: [
      {
        id: 'oracle-onprem',
        name: 'On-prem (basic)',
        description: 'Host/port + service name',
        environment: 'production',
        security: 'enterprise',
        config: { mode: 'basic', port: 1521, ssl: false, walletMode: 'none' },
      },
      {
        id: 'oracle-oci-adb',
        name: 'OCI Autonomous DB (Wallet ZIP)',
        description: 'Wallet-based TLS connection',
        environment: 'production',
        security: 'enterprise',
        config: { mode: 'ez', ssl: true, walletMode: 'zip' },
        requirements: ['Autonomous DB wallet ZIP'],
      },
    ],

    configKeys: [
      'host',
      'port',
      'serviceName',
      'connectString',
      'username',
      'password',
      'ssl',
      'walletMode',
      'walletZipBase64',
      'walletDir',
      'role',
    ] as const,

    toConfig: (ui): ConnectionConfig => {
      const base: Record<string, any> = {
        username: ui.username,
        password: ui.password,
        ssl: !!ui.ssl,
        role: ui.role || undefined,
      }

      if (ui.mode === 'ez') {
        base.connectString = ui.connectString
      } else {
        base.host = ui.host
        base.port = ui.port
        base.serviceName = ui.serviceName
      }

      if (ui.walletMode === 'zip' && ui.walletZipBase64) {
        base.walletZipBase64 = ui.walletZipBase64
      } else if (ui.walletMode === 'dir' && ui.walletDir) {
        base.walletDir = ui.walletDir
      }

      return base as ConnectionConfig
    },
  },
]

/* ----------------------------------------------------------------------------
   Props
---------------------------------------------------------------------------- */
interface Props {
  open: boolean
  onClose: () => void
  onCreate: (payload: CreateDataSourcePayload) => Promise<DataSource>
  onTestConnection?: (
    config: {
      type: DataSourceType
      connectionConfig: ConnectionConfig
    },
    signal?: AbortSignal,
  ) => Promise<{
    success: boolean
    message?: string
    databases?: DatabaseInfo[]
    metadata?: ServerMetadata
  }>
  existingConnections?: DataSource[]
}

const STEPS = [
  'Select Connector',
  'Configure Connection',
  'Discover Resources',
  'Review & Create',
] as const
type Step = (typeof STEPS)[number]

/* ----------------------------------------------------------------------------
   Component
---------------------------------------------------------------------------- */
export default function AddConnectionWizard({
  open,
  onClose,
  onCreate,
  onTestConnection,
  existingConnections = [],
}: Props) {
  const [step, setStep] = useState<Step>('Select Connector')
  const [selected, setSelected] = useState<ConnectorTemplate | null>(null)
  const [cfg, setCfg] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({})

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  const [tests, setTests] = useState<
    Array<{
      id: string
      label: string
      status: 'pending' | 'running' | 'success' | 'error'
      message?: string
    }>
  >([])
  const [isTesting, setIsTesting] = useState(false)
  const [dbs, setDbs] = useState<DatabaseInfo[]>([])
  const [selectedDbs, setSelectedDbs] = useState<Set<string>>(new Set())
  const [meta, setMeta] = useState<ServerMetadata | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null)
  const lastFocusableRef = useRef<HTMLButtonElement | null>(null)

  /* lifecycle: lock body scroll, reset & focus trap */
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    setStep('Select Connector')
    setSelected(null)
    setCfg({})
    setErrors({})
    setShowSensitive({})
    setTests([])
    setDbs([])
    setSelectedDbs(new Set())
    setMeta(null)
    setIsCreating(false)
    setCreateError(null)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        abortRef.current?.abort()
        safeClose()
      }
      if (e.key === 'Tab' && containerRef.current) {
        const focusables = containerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length) {
          const first = focusables[0]
          const last = focusables[focusables.length - 1]
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            ;(last as HTMLElement).focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            ;(first as HTMLElement).focus()
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      setCfg({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const safeClose = useCallback(() => {
    setCfg({})
    onClose()
  }, [onClose])

  /* categories and filtered lists (debounced search) */
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(CONNECTORS.map(c => c.category)))],
    [],
  )
  const [searchQ, setSearchQ] = useState(search)
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchQ), 200)
    return () => clearTimeout(t)
  }, [searchQ])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return CONNECTORS.filter(c => {
      const okCat = category === 'All' || c.category === category
      if (!q) return okCat
      const blob = `${c.name} ${c.description} ${c.tags.join(' ')}`.toLowerCase()
      return okCat && blob.includes(q)
    })
  }, [search, category])

  /* group fields for selected connector */
  const groups = useMemo(() => {
    if (!selected) return {} as Record<string, EnhancedConnectorField[]>
    const m: Record<string, EnhancedConnectorField[]> = {}
    for (const f of selected.fields) {
      const g = f.group ?? 'general'
      ;(m[g] ||= []).push(f)
    }
    return m
  }, [selected])

  /* handlers */
  const onSelectConnector = useCallback((c: ConnectorTemplate) => {
    setSelected(c)
    const next: Record<string, any> = {}
    if (c.defaultPort != null) next.port = c.defaultPort
    if (c.examples?.[0]) Object.assign(next, c.examples[0].config)
    setCfg(next)
    setStep('Configure Connection')
  }, [])

  const onChangeField = useCallback((key: string, value: any) => {
    setCfg(prev => ({ ...prev, [key]: value }))
    setErrors(prev => {
      if (!prev[key]) return prev
      const n = { ...prev }
      delete n[key]
      return n
    })
  }, [])

  const validate = useCallback(
    (c: ConnectorTemplate, values: Record<string, any>) => {
      const errs: Record<string, string> = {}
      for (const r of c.validationRules) {
        const v = values[r.field]
        if (
          r.rule === 'required' &&
          (v === undefined || v === null || String(v).trim() === '')
        ) {
          if (r.severity === 'error') errs[r.field] = r.message
        }
        if (r.rule === 'format' && v && r.params?.pattern) {
          const re = new RegExp(r.params.pattern)
          if (!re.test(String(v))) errs[r.field] = r.message
        }
        if (r.rule === 'range' && v != null && r.params) {
          if (v < r.params.min || v > r.params.max) errs[r.field] = r.message
        }
      }
      return errs
    },
    [],
  )

  // build sanitized connectionConfig
  const buildConnectionConfig = useCallback((): ConnectionConfig => {
    if (!selected) return {} as ConnectionConfig

    if (selected.toConfig) {
      return selected.toConfig(cfg)
    }

    const picked: Record<string, any> = {}
    for (const k of selected.configKeys) {
      if (k in cfg) picked[k] = (cfg as any)[k]
    }

    // scrub File objects
    for (const k of Object.keys(picked)) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (typeof File !== 'undefined' && picked[k] instanceof File) {
        delete picked[k]
      }
    }

    return picked as unknown as ConnectionConfig
  }, [selected, cfg])

  const onPickTemplate = useCallback(
    (templateId: string) => {
      if (!selected) return
      const tmpl = selected.examples.find(e => e.id === templateId)
      if (!tmpl) return
      setCfg(prev => ({ ...prev, ...tmpl.config }))
    },
    [selected],
  )

  const toggleDb = useCallback((name: string, on: boolean) => {
    setSelectedDbs(prev => {
      const next = new Set(prev)
      if (on) next.add(name)
      else next.delete(name)
      return next
    })
  }, [])

  /* ------------------------------------------------------------------------
     Default tester (keeps parent override)
  ------------------------------------------------------------------------ */
  const callTest = useCallback(
    async (
      payload: { type: DataSourceType; connectionConfig: ConnectionConfig },
      signal?: AbortSignal,
    ) => {
      if (onTestConnection) {
        return onTestConnection(payload, signal);
      }
      // Fallback to service API
      return dataSourcesApi.testConfig(payload.type, payload.connectionConfig);
    },
    [onTestConnection],
  );

  /* ------------------------------------------------------------------------
     Test & Discover (drop-in)
  ------------------------------------------------------------------------ */
  const performTestAndDiscover = useCallback(
    async (signal?: AbortSignal) => {
      if (!selected) return;

      try {
        setIsTesting(true);
        setTests([{ id: 'ping', label: 'Connectivity', status: 'running' }]);
        setDbs([]);
        setSelectedDbs(new Set());
        setMeta(null);

        const config = buildConnectionConfig();

        // 1) Test connectivity
        const raw = await callTest(
          { type: selected.submitType, connectionConfig: config },
          signal,
        );
        const res = normalizeTestResponse(raw);

        if (!res.success) {
          const hasSpecificMsg = !!res.message && res.message !== 'Connection test failed';

          const rows: Array<{
            id: string;
            label: string;
            status: 'error';
            message?: string;
          }> = [
            {
              id: 'ping',
              label: 'Connectivity',
              status: 'error',
              message: hasSpecificMsg
                ? res.message
                : 'Connection failed. No error details were returned.',
            },
          ];

          const details: string[] = [];
          if (res.connectionStatus) details.push(`Status: ${String(res.connectionStatus)}`);
          if (typeof res.responseTime === 'number') details.push(`Response time: ${res.responseTime} ms`);
          if (res.testedAt) details.push(`Tested at: ${new Date(res.testedAt).toLocaleString()}`);
          if (details.length) {
            rows.push({
              id: 'details',
              label: 'Details',
              status: 'error',
              message: details.join(' • '),
            });
          }

          if (!hasSpecificMsg) {
            const tips =
              selected.submitType === 'postgresql'
                ? [
                    'Verify host/port are reachable (localhost:5432).',
                    'Confirm username/password are correct.',
                    'Toggle SSL to match server requirement (ON if required, OFF if forbidden).',
                    'Ensure Postgres listens on 127.0.0.1/0.0.0.0 and pg_hba.conf allows your user.',
                    'Try `psql -h localhost -U <user> -p 5432` locally to validate.',
                  ]
                : [
                    'Check host/port reachability (firewall, network, container networking).',
                    'Double-check credentials and auth method.',
                    'Match the server’s SSL/TLS requirement.',
                  ];
            rows.push({
              id: 'next',
              label: 'Next steps',
              status: 'error',
              message: `Try:\n• ${tips.join('\n• ')}`,
            });
          }

          setTests(rows as any);
          setStep('Configure Connection');
          return;
        }

        // Success row + optional telemetry
        const okRows: any[] = [
          {
            id: 'ping',
            label: 'Connectivity',
            status: 'success',
            message: res.message || 'Connection successful',
          },
        ];
        const okDetails: string[] = [];
        if (res.connectionStatus) okDetails.push(`Status: ${String(res.connectionStatus)}`);
        if (typeof res.responseTime === 'number') okDetails.push(`Response time: ${res.responseTime} ms`);
        if (res.testedAt) okDetails.push(`Tested at: ${new Date(res.testedAt).toLocaleString()}`);
        if (okDetails.length) {
          okRows.push({
            id: 'details',
            label: 'Details',
            status: 'success',
            message: okDetails.join(' • '),
          });
        }
        setTests(okRows);

        // 2) Optional discovery for server-scope connectors
        if (selected.supportsDiscovery && selected.scope === 'server') {
          try {
            const previewResponse = await fetch(
              'http://localhost:8000/api/data-sources/databases/preview',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-dev-auth': '1',
                },
                body: JSON.stringify({
                  type: selected.submitType,
                  config,
                }),
                signal,
              },
            );

            const previewText = await previewResponse.text();
            let previewData: any = null;
            try {
              previewData = JSON.parse(previewText);
            } catch {
              // ignore parse error; fall through to empty
            }

            if (previewResponse.ok && previewData?.success && Array.isArray(previewData.data)) {
              const discoveredDatabases = previewData.data.map((db: any) => ({
                name: db.name || db,
                accessible: true,
                selected: false,
                quality: 'medium' as const,
                usage: 'active' as const,
              }));
              setDbs(discoveredDatabases);
            } else {
              setDbs([]);
            }
          } catch (err) {
            console.error('Database discovery failed:', err);
            setDbs([]);
          }
        }

        // 3) Metadata (if any)
        setMeta((res.metadata as ServerMetadata) ?? null);

        // 4) Advance
        setStep('Discover Resources');
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        console.error('Connection test error:', error?.message || error);
        setTests([
          {
            id: 'ping',
            label: 'Connectivity',
            status: 'error',
            message: error?.message || 'Unexpected error during test',
          },
        ]);
        setStep('Configure Connection');
      } finally {
        setIsTesting(false);
      }
    },
    [selected, buildConnectionConfig, callTest],
  );

  // Click wrapper (unchanged API)
  const handleTestAndDiscover = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const controller = new AbortController();
    performTestAndDiscover(controller.signal).catch((err) =>
      console.error('Test and discover failed:', err),
    );
  };

  const onCreateConnection = useCallback(async () => {
    if (!selected) return
    const errs = validate(selected, cfg)
    setErrors(errs)
    if (Object.keys(errs).length) {
      setStep('Configure Connection')
      return
    }

    setIsCreating(true)
    setCreateError(null)
    try {
      const payload: CreateDataSourcePayload = {
        type: selected.submitType,
        name: (cfg.name as string) || selected.name,
        connectionConfig: buildConnectionConfig(),
        options: {
          selectedDatabases: Array.from(selectedDbs),
          scope: selected.scope,
        } as any,
        tags: selected.tags ?? [],
      } as CreateDataSourcePayload

      await onCreate(payload)

      setIsCreating(false)
      safeClose()
    } catch (e: any) {
      setIsCreating(false)
      setCreateError(e?.response?.data?.message ?? e?.message ?? 'Failed to create connection')
    }
  }, [selected, cfg, selectedDbs, buildConnectionConfig, onCreate, validate, safeClose])

  const canProceedFromConfigure = useMemo(() => {
    if (!selected) return false
    const errs = validate(selected, cfg)
    return Object.keys(errs).length === 0 && !isTesting
  }, [selected, cfg, validate, isTesting])

  if (!open) return null

  /* ----------------------------------------------------------------------------
     UI
  ---------------------------------------------------------------------------- */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Add Connection Wizard"
      ref={containerRef}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header & progress */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-b from-white to-slate-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Add Connection</h2>
            <p className="text-gray-600 mt-1">
              Server-level connections with automatic discovery
            </p>
            <div className="flex items-center mt-4 space-x-2">
              {STEPS.map((s, i) => (
                <React.Fragment key={s}>
                  <div
                    className={`relative flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium transition-all duration-300 ${
                      s === step
                        ? 'bg-blue-600 text-white shadow-lg scale-110'
                        : STEPS.indexOf(step) > i
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                    aria-current={step === s ? 'step' : undefined}
                  >
                    {STEPS.indexOf(step) > i ? <Check className="w-5 h-5" /> : i + 1}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`w-16 h-1 rounded-full ${
                        STEPS.indexOf(step) > i ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              ref={firstFocusableRef}
              onClick={() => {
                abortRef.current?.abort()
                safeClose()
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'Select Connector' && (
            <ConnectorSelect
              categories={categories}
              category={category}
              setCategory={setCategory}
              search={searchQ}
              setSearch={setSearchQ}
              list={filtered}
              onSelect={onSelectConnector}
            />
          )}

          {step === 'Configure Connection' && selected && (
            <ConfigureSection
              selected={selected}
              cfg={cfg}
              groups={groups}
              errors={errors}
              showSensitive={showSensitive}
              setShowSensitive={setShowSensitive}
              onPickTemplate={onPickTemplate}
              onChangeField={onChangeField}
              tests={tests}
            />
          )}

          {step === 'Discover Resources' && (
            <DiscoverSection
              meta={meta}
              dbs={dbs}
              selectedDbs={selectedDbs}
              setSelectedDbs={setSelectedDbs}
              toggleDb={toggleDb}
            />
          )}

          {step === 'Review & Create' && selected && (
            <ReviewSection selected={selected} cfg={cfg} selectedDbs={selectedDbs} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex justify-between items-center bg-gray-50">
          <div>
            {step !== 'Select Connector' && (
              <button
                onClick={() => {
                  setCreateError(null)
                  setStep(prev =>
                    prev === 'Configure Connection'
                      ? 'Select Connector'
                      : prev === 'Discover Resources'
                      ? 'Configure Connection'
                      : 'Discover Resources',
                  )
                }}
                className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {createError && <span className="text-sm text-red-600 mr-2">{createError}</span>}

            <button
              onClick={() => {
                abortRef.current?.abort()
                safeClose()
              }}
              className="px-6 py-2 border rounded-lg hover:bg-gray-50 font-medium"
              ref={lastFocusableRef}
            >
              Cancel
            </button>

            {step === 'Configure Connection' && (
              <button
                onClick={handleTestAndDiscover}
                disabled={!canProceedFromConfigure}
                className="flex items-center px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Test & Discover
              </button>
            )}

            {step === 'Discover Resources' && (
              <button
                onClick={() => setStep('Review & Create')}
                className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Review
              </button>
            )}

            {step === 'Review & Create' && (
              <button
                onClick={onCreateConnection}
                disabled={isCreating}
                className="flex items-center px-8 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Connection
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------------
   Sections & Subcomponents
---------------------------------------------------------------------------- */
function ConnectorSelect({
  categories,
  category,
  setCategory,
  search,
  setSearch,
  list,
  onSelect,
}: {
  categories: string[]
  category: string
  setCategory: (v: string) => void
  search: string
  setSearch: (v: string) => void
  list: ConnectorTemplate[]
  onSelect: (c: ConnectorTemplate) => void
}) {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search connectors by name, technology, or feature…"
              className="w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="pl-10 pr-8 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 appearance-none bg-white min-w[180px]"
            >
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {!search && category === 'All' && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <Star className="w-5 h-5 text-yellow-500 mr-2" /> Popular
            </h3>
            <span className="text-sm text-gray-500">
              Server-level & discovery-ready
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {list
              .filter(c => c.isPopular)
              .map(c => (
                <ConnectorCard
                  key={c.id}
                  connector={c}
                  onClick={() => onSelect(c)}
                  badge="Popular"
                />
              ))}
          </div>
        </section>
      )}

      <div className="space-y-10">
        {categories
          .filter(c => c !== 'All')
          .map(cat => {
            const items = list.filter(c => c.category === cat)
            if (!items.length) return null
            return (
              <section key={cat}>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{cat}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map(c => (
                    <ConnectorCard
                      key={c.id}
                      connector={c}
                      onClick={() => onSelect(c)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
      </div>
    </div>
  )
}

function ConfigureSection({
  selected,
  cfg,
  groups,
  errors,
  showSensitive,
  setShowSensitive,
  onPickTemplate,
  onChangeField,
  tests,
}: {
  selected: ConnectorTemplate
  cfg: Record<string, any>
  groups: Record<string, EnhancedConnectorField[]>
  errors: Record<string, string>
  showSensitive: Record<string, boolean>
  setShowSensitive: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >
  onPickTemplate: (id: string) => void
  onChangeField: (key: string, value: any) => void
  tests: Array<{
    id: string
    label: string
    status: 'pending' | 'running' | 'success' | 'error'
    message?: string
  }>
}) {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200">
        <div className="flex items-center gap-6">
          <div className="text-5xl">{selected.icon}</div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-gray-900">{selected.name}</h3>
            <p className="text-gray-600">{selected.description}</p>
            <div className="flex items-center mt-3 space-x-6">
              <span className="flex items-center text-sm text-blue-700">
                <Server className="w-4 h-4 mr-1" /> {selected.scope.toUpperCase()} level
              </span>
              {selected.supportsDiscovery && (
                <span className="flex items-center text-sm text-purple-700">
                  <Zap className="w-4 h-4 mr-1" /> Auto-discovery
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {selected.examples.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-gray-900 flex items-center">
            <Wand2 className="w-5 h-5 mr-2 text-purple-600" /> Quick Setup Templates
          </h4>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selected.examples.map(t => (
              <button
                key={t.id}
                onClick={() => onPickTemplate(t.id)}
                className="p-4 text-left border-2 rounded-xl hover:shadow-md transition-all border-gray-200 hover:border-blue-300"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{t.name}</div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      t.environment === 'production'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {t.environment}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{t.description}</p>
                {t.requirements?.length ? (
                  <div className="text-xs text-gray-500 mt-2">
                    <strong>Requirements:</strong> {t.requirements.join(', ')}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {Object.entries(groups).map(([g, fields]) => (
        <section key={g} className="space-y-3">
          <h4 className="text-lg font-semibold text-gray-900 capitalize flex items-center">
            {g === 'basic' && <Settings className="w-4 h-4 mr-2" />}
            {g === 'authentication' && <Lock className="w-4 h-4 mr-2" />}
            {g === 'security' && <Shield className="w-4 h-4 mr-2" />}
            {g === 'discovery' && <Search className="w-4 h-4 mr-2" />}
            {g}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fields.map(f => (
              <ConfigField
                key={f.key}
                field={f}
                value={cfg[f.key] ?? (f.type === 'toggle' ? false : '')}
                onChange={v => onChangeField(f.key, v)}
                error={errors[f.key]}
                show={!!showSensitive[f.key]}
                onToggleShow={() =>
                  setShowSensitive(prev => ({ ...prev, [f.key]: !prev[f.key] }))
                }
                config={cfg}
              />
            ))}
          </div>
        </section>
      ))}

      {!!tests.length && (
        <section>
          <h4 className="text-lg font-semibold text-gray-900 flex items-center">
            <TestTube className="w-5 h-5 mr-2 text-blue-600" /> Connection Test
          </h4>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            {tests.map(t => (
              <TestRow key={t.id} test={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function DiscoverSection({
  meta,
  dbs,
  selectedDbs,
  setSelectedDbs,
  toggleDb,
}: {
  meta: ServerMetadata | null
  dbs: DatabaseInfo[]
  selectedDbs: Set<string>
  setSelectedDbs: React.Dispatch<React.SetStateAction<Set<string>>>
  toggleDb: (name: string, on: boolean) => void
}) {
  return (
    <div className="space-y-8">
      {meta && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Server className="w-5 h-5 mr-2 text-green-600" /> Server Information
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <Stat value={meta.version ?? '—'} label="Version" color="text-green-600" />
            <Stat
              value={`${meta.currentConnections ?? 0}/${meta.maxConnections ?? '—'}`}
              label="Connections"
              color="text-blue-600"
            />
            <Stat value={meta.uptime ?? '—'} label="Uptime" color="text-purple-600" />
            <Stat value="—" label="Security" color="text-orange-600" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Discovered Databases</h3>
          <p className="text-gray-600">
            Select databases to include post-creation (for scope UI only)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              setSelectedDbs(new Set(dbs.filter(x => x.accessible !== false).map(x => x.name)))
            }
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center"
          >
            <CheckCircle className="w-4 h-4 mr-1" /> Select All Accessible
          </button>
          <button
            onClick={() => setSelectedDbs(new Set())}
            className="text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Databases"
          value={dbs.length}
          icon={<Database className="w-8 h-8 text-blue-600" />}
          tone="blue"
        />
        <SummaryCard
          label="Accessible"
          value={dbs.filter(x => x.accessible !== false).length}
          icon={<Unlock className="w-8 h-8 text-green-600" />}
          tone="green"
        />
        <SummaryCard
          label="Selected"
          value={selectedDbs.size}
          icon={<CheckCircle className="w-8 h-8 text-purple-600" />}
          tone="purple"
        />
        <SummaryCard
          label="Total Tables"
          value={dbs.reduce((s, d) => s + (d.tables ?? 0), 0)}
          icon={<FileText className="w-8 h-8 text-orange-600" />}
          tone="orange"
        />
      </div>

      {/* DB list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dbs.map(d => (
          <DbCard
            key={d.name}
            db={d}
            selected={selectedDbs.has(d.name)}
            onToggle={on => toggleDb(d.name, on)}
          />
        ))}
        {!dbs.length && (
          <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-gray-500">
            No databases discovered. You can still create the connection and
            discover later.
          </div>
        )}
      </div>

      {/* Selection hint */}
      <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Info className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <span className="font-semibold text-blue-900">
                {selectedDbs.size} database{selectedDbs.size === 1 ? '' : 's'} selected (UI)
              </span>
              <p className="text-sm text-blue-700 mt-1">
                We’ll remember this in UI. The server connection is still created at the
                server/account level.
              </p>
            </div>
          </div>
          <div className="text-right text-blue-700">
            <div className="text-sm">Coverage</div>
            <div className="text-lg font-semibold">
              {dbs.length ? Math.round((selectedDbs.size / dbs.length) * 100) : 0}%
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReviewSection({
  selected,
  cfg,
  selectedDbs,
}: {
  selected: ConnectorTemplate
  cfg: Record<string, any>
  selectedDbs: Set<string>
}) {
  return (
    <div className="space-y-8">
      <h3 className="text-2xl font-bold text-gray-900">Review Your Connection</h3>

      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-8 rounded-2xl border border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-6xl">{selected.icon}</div>
            <div>
              <div className="text-2xl font-bold">
                {(cfg.name as string) || selected.name}
              </div>
              <div className="text-gray-600">
                {selected.name} ({selected.submitType})
              </div>
              <div className="flex items-center gap-4 text-sm mt-2">
                {cfg.host && (
                  <span className="text-gray-600">
                    <Server className="inline h-4 w-4 mr-1" /> {cfg.host}
                    {cfg.port ? `:${cfg.port}` : ''}
                  </span>
                )}
                <span className="text-green-700">
                  <Database className="inline h-4 w-4 mr-1" /> {selectedDbs.size} DB(s)
                </span>
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600">
              {selectedDbs.size}
            </div>
            <div className="text-sm text-gray-600">Databases</div>
            <div className="text-xs text-green-600 mt-1">Server-level</div>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h4 className="text-lg font-semibold text-gray-900">Selected Databases</h4>
        {selectedDbs.size ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from(selectedDbs).map(name => (
              <div key={name} className="p-3 bg-white border rounded-xl text-sm">
                {name}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-gray-500">
            No databases selected. You can select them after creation.
          </div>
        )}
      </section>
    </div>
  )
}

/* presentational bits */
function ConnectorCard({
  connector,
  onClick,
  badge,
}: {
  connector: ConnectorTemplate
  onClick: () => void
  badge?: string
}) {
  return (
    <button
      onClick={onClick}
      className="group p-6 border-2 border-gray-200 rounded-2xl hover:border-blue-300 hover:shadow-xl transition-all bg-gradient-to-br from-white to-gray-50 relative text-left"
    >
      {badge && (
        <span className="absolute top-4 right-4 px-3 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800">
          {badge}
        </span>
      )}
      <div className="flex items-start justify-between mb-4">
        <div className="text-4xl group-hover:scale-110 transition-transform">
          {connector.icon}
        </div>
        <div className="text-xs text-blue-600 uppercase">{connector.scope}</div>
      </div>
      <div className="font-bold text-xl text-gray-900 mb-1 group-hover:text-blue-600">
        {connector.name}
      </div>
      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{connector.description}</p>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {connector.tags.slice(0, 2).map(t => (
            <span
              key={t}
              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
            >
              {t}
            </span>
          ))}
          {connector.tags.length > 2 && (
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              +{connector.tags.length - 2}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">{connector.submitType}</span>
      </div>
    </button>
  )
}

function ConfigField({
  field,
  value,
  onChange,
  error,
  show,
  onToggleShow,
  config,
}: {
  field: EnhancedConnectorField
  value: any
  onChange: (v: any) => void
  error?: string
  show?: boolean
  onToggleShow?: () => void
  config: Record<string, any>
}) {
  const visible = useMemo(() => {
    if (!field.dependsOn) return true
    const { field: dep, value: depV, condition = 'equals' } = field.dependsOn
    const act = (config as Record<string, any>)[dep]
    switch (condition) {
      case 'equals':
        return act === depV
      case 'not-equals':
        return act !== depV
      case 'truthy':
        return !!act
      case 'falsy':
        return !act
      case 'contains':
        return (act ?? '').toString().includes(depV)
      default:
        return true
    }
  }, [field.dependsOn, config])

  if (!visible) return null

  const base =
    'w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const err = error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'

  return (
    <div className={field.wide ? 'md:col-span-2' : ''}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
        {field.sensitive && (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
            <Lock className="w-3 h-3 mr-1" />
            Sensitive
          </span>
        )}
      </label>

      {field.type === 'password' ? (
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={`${base} ${err} pr-10`}
            autoComplete={field.autoComplete ?? 'new-password'}
          />
          {onToggleShow && (
            <button
              type="button"
              aria-label="Toggle visibility"
              onClick={onToggleShow}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
      ) : field.type === 'toggle' ? (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            value ? 'bg-blue-600' : 'bg-gray-200'
          }`}
          aria-pressed={!!value}
        >
          <span
            className={`inline-block h-4 w-4 mt-1 transform rounded-full bg-white transition-transform ${
              value ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      ) : field.type === 'select' ? (
        <div className="relative">
          <select
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
            className={`${base} ${err} appearance-none pr-10`}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
                {o.recommended ? ' (Recommended)' : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      ) : field.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={4}
          placeholder={field.placeholder}
          className={`${base} ${err} resize-none`}
        />
      ) : field.type === 'number' ? (
        <input
          type="number"
          value={value === '' || value === undefined || value === null ? '' : Number(value)}
          onChange={e =>
            onChange(e.target.value === '' ? '' : Number.parseInt(e.target.value, 10))
          }
          placeholder={field.placeholder}
          min={field.validation?.min}
          max={field.validation?.max}
          className={`${base} ${err}`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={`${base} ${err}`}
          autoComplete={field.autoComplete ?? 'off'}
        />
      )}

      {field.help && !error && (
        <p className="mt-2 text-sm text-gray-600 flex items-start">
          <Info className="w-4 h-4 text-gray-400 mr-1 mt-0.5" />
          {field.help}
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-start">
          <AlertTriangle className="w-4 h-4 text-red-500 mr-1 mt-0.5" />
          {error}
        </p>
      )}
    </div>
  )
}

function TestRow({
  test,
}: {
  test: { label: string; status: 'pending' | 'running' | 'success' | 'error'; message?: string }
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
      <div className="flex items-center gap-3">
        {test.status === 'pending' && <Clock className="w-5 h-5 text-gray-400" />}
        {test.status === 'running' && (
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
        )}
        {test.status === 'success' && (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        )}
        {test.status === 'error' && <AlertTriangle className="w-5 h-5 text-red-600" />}
        <div>
          <div className="text-sm font-medium whitespace-pre-line">{test.label}</div>
          {test.message && <div className="text-xs text-gray-600 whitespace-pre-line">{test.message}</div>}
        </div>
      </div>
    </div>
  )
}

function DbCard({
  db,
  selected,
  onToggle,
}: {
  db: DatabaseInfo
  selected: boolean
  onToggle: (on: boolean) => void
}) {
  const disabled = db.accessible === false
  return (
    <div
      className={`p-4 border-2 rounded-xl transition-all cursor-pointer ${
        selected
          ? 'border-blue-500 bg-blue-50 shadow'
          : disabled
          ? 'border-gray-100 bg-gray-50 opacity-60'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
      }`}
      onClick={() => !disabled && onToggle(!selected)}
      role="checkbox"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          if (!disabled) onToggle(!selected)
        }
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="font-semibold truncate">{db.name}</div>
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            db.quality === 'high'
              ? 'bg-green-500'
              : db.quality === 'medium'
              ? 'bg-yellow-500'
              : 'bg-red-500'
          }`}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
        {db.tables != null && (
          <div className="flex items-center">
            <FileText className="w-3 h-3 mr-1" />
            {db.tables} tables
          </div>
        )}
        {db.views != null && (
          <div className="flex items-center">
            <Eye className="w-3 h-3 mr-1" />
            {db.views} views
          </div>
        )}
        {db.size && (
          <div className="flex items-center">
            <HardDrive className="w-3 h-3 mr-1" />
            {db.size}
          </div>
        )}
        {db.usage && (
          <div className="flex items-center">
            <Activity
              className={`w-3 h-3 mr-1 ${
                db.usage === 'active'
                  ? 'text-green-500'
                  : db.usage === 'moderate'
                  ? 'text-yellow-500'
                  : 'text-gray-400'
              }`}
            />
            {db.usage}
          </div>
        )}
      </div>

      {db.description && (
        <p className="text-xs text-gray-500 truncate">{db.description}</p>
      )}
      {disabled && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
          Access denied
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={e => onToggle(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4"
          onClick={e => e.stopPropagation()}
        />
        <span className="text-sm">{selected ? 'Selected' : 'Select'}</span>
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  tone: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const map = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
  }
  return (
    <div className={`p-4 rounded-xl border ${map[tone]}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm">{label}</div>
        </div>
        {icon}
      </div>
    </div>
  )
}

function Stat({
  value,
  label,
  color,
}: {
  value: string | number
  label: string
  color: string
}) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  )
}

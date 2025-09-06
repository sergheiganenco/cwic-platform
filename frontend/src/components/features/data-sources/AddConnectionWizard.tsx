// src/components/features/data-sources/AddConnectionWizard.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';

// ✅ Use the shared app types – remove any local duplicates
import type {
    CreateDataSourcePayload,
    DataSource,
    DataSourceType,
} from '@/types/dataSources';

/* =========================
   Local types for the wizard
========================= */
type ConnectorCategory = 'Databases' | 'Warehouses' | 'Storage' | 'Streaming' | 'API & Files';

type FieldType =
  | 'text'
  | 'password'
  | 'number'
  | 'textarea'
  | 'checkbox'
  | 'select'
  | 'array';

type ConnectorField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  wide?: boolean;
  dependsOn?: {
    field: string;
    value?: any;
    condition?: 'equals' | 'not-equals' | 'truthy' | 'falsy';
  };
};

type ConnectionTemplate = {
  id: string;
  name: string;
  description: string;
  config: Record<string, any>;
};

type ConnectorMeta = {
  id: string;                       // UI ID (may NOT equal backend type)
  name: string;
  description: string;
  category: ConnectorCategory;
  icon?: string;
  tags?: string[];
  fields: ConnectorField[];
  defaultPort?: number;
  submitType?: DataSourceType;      // 👈 what to send to backend (falls back to id if omitted)
  connectionStringPattern?: string; // only used for placeholder/example text
  templates?: ConnectionTemplate[];
  isNew?: boolean;
  isPopular?: boolean;
};

/* =========================
   Connectors
========================= */
const CATEGORIES: ConnectorCategory[] = [
  'Databases',
  'Warehouses',
  'Storage',
  'Streaming',
  'API & Files',
];

const CONNECTORS: ConnectorMeta[] = [
  // ---------- Databases ----------
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    description: 'Open-source relational database',
    category: 'Databases',
    icon: '🐘',
    tags: ['sql', 'relational', 'acid'],
    defaultPort: 5432,
    isPopular: true,
    connectionStringPattern: 'postgresql://user:password@host:5432/database',
    fields: [
      { key: 'name', label: 'Connection Name', type: 'text', required: true, placeholder: 'My PostgreSQL DB' },
      { key: 'host', label: 'Host', type: 'text', required: true, placeholder: 'localhost' },
      { key: 'port', label: 'Port', type: 'number', required: true, placeholder: '5432', min: 1, max: 65535 },
      { key: 'database', label: 'Database', type: 'text', required: true, placeholder: 'myapp' },
      { key: 'username', label: 'Username', type: 'text', required: true, placeholder: 'postgres' },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'ssl', label: 'Enable SSL', type: 'checkbox' },
      {
        key: 'sslmode',
        label: 'SSL Mode',
        type: 'select',
        options: [
          { label: 'Require', value: 'require' },
          { label: 'Verify CA', value: 'verify-ca' },
          { label: 'Verify Full', value: 'verify-full' },
        ],
        dependsOn: { field: 'ssl', value: true, condition: 'equals' },
      },
    ],
    templates: [
      {
        id: 'local',
        name: 'Local Development',
        description: 'Standard local PostgreSQL setup',
        config: { host: 'localhost', port: 5432, username: 'postgres', ssl: false },
      },
      {
        id: 'production',
        name: 'Production',
        description: 'Secure production configuration',
        config: { port: 5432, ssl: true },
      },
    ],
  },
  {
    id: 'mysql',
    name: 'MySQL',
    description: 'Popular open-source database',
    category: 'Databases',
    icon: '🐬',
    tags: ['sql', 'relational'],
    defaultPort: 3306,
    isPopular: true,
    connectionStringPattern: 'mysql://user:password@host:3306/database',
    fields: [
      { key: 'name', label: 'Connection Name', type: 'text', required: true, placeholder: 'My MySQL DB' },
      { key: 'host', label: 'Host', type: 'text', required: true, placeholder: 'localhost' },
      { key: 'port', label: 'Port', type: 'number', required: true, placeholder: '3306', min: 1, max: 65535 },
      { key: 'database', label: 'Database', type: 'text', required: true, placeholder: 'myapp' },
      { key: 'username', label: 'Username', type: 'text', required: true, placeholder: 'root' },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'ssl', label: 'Enable SSL', type: 'checkbox' },
    ],
  },
  {
    id: 'mssql',
    submitType: 'mssql', // 👈 backend type
    name: 'SQL Server',
    description: 'Microsoft SQL Server',
    category: 'Databases',
    icon: '🏢',
    tags: ['microsoft', 'sql', 'enterprise'],
    defaultPort: 1433,
    fields: [
      { key: 'name', label: 'Connection Name', type: 'text', required: true, placeholder: 'My SQL Server' },
      { key: 'host', label: 'Server', type: 'text', required: true, placeholder: 'localhost' },
      { key: 'port', label: 'Port', type: 'number', required: true, placeholder: '1433', min: 1, max: 65535 },
      { key: 'database', label: 'Database', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'encrypt', label: 'Encrypt Connection', type: 'checkbox' },
      {
        key: 'trustServerCertificate',
        label: 'Trust Server Certificate',
        type: 'checkbox',
        dependsOn: { field: 'encrypt', value: true, condition: 'equals' },
        help: 'Use for self-signed certs (dev)',
      },
    ],
  },
  {
    id: 'azure-sql',
    submitType: 'mssql', // 👈 submit to backend as MSSQL
    name: 'Azure SQL Database',
    description: 'Managed SQL Server on Azure',
    category: 'Databases',
    icon: '🟦',
    tags: ['azure', 'managed', 'microsoft', 'cloud'],
    defaultPort: 1433,
    isPopular: true,
    fields: [
      { key: 'name', label: 'Connection Name', type: 'text', required: true, placeholder: 'My Azure SQL' },
      { key: 'host', label: 'Server Name', type: 'text', required: true, placeholder: 'myserver.database.windows.net' },
      { key: 'port', label: 'Port', type: 'number', required: true, placeholder: '1433', min: 1, max: 65535 },
      { key: 'database', label: 'Database', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true, placeholder: 'user@myserver' },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'encrypt', label: 'Encrypt (Required)', type: 'checkbox' },
      {
        key: 'trustServerCertificate',
        label: 'Trust Server Certificate',
        type: 'checkbox',
        dependsOn: { field: 'encrypt', value: true, condition: 'equals' },
      },
    ],
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    description: 'Document-oriented NoSQL database',
    category: 'Databases',
    icon: '🍃',
    tags: ['nosql', 'document', 'json'],
    defaultPort: 27017,
    isPopular: true,
    connectionStringPattern: 'mongodb://user:password@host:27017/database',
    fields: [
      { key: 'name', label: 'Connection Name', type: 'text', required: true, placeholder: 'My MongoDB' },
      { key: 'host', label: 'Host', type: 'text', required: true, placeholder: 'localhost' },
      { key: 'port', label: 'Port', type: 'number', required: true, placeholder: '27017', min: 1, max: 65535 },
      { key: 'database', label: 'Database', type: 'text', required: true, placeholder: 'myapp' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'Optional for local' },
      { key: 'password', label: 'Password', type: 'password' },
      { key: 'ssl', label: 'Enable SSL', type: 'checkbox' },
    ],
  },
  {
    id: 'redis',
    name: 'Redis',
    description: 'In-memory data store',
    category: 'Databases',
    icon: '📦',
    tags: ['cache', 'memory', 'key-value'],
    defaultPort: 6379,
    fields: [
      { key: 'name', label: 'Connection Name', type: 'text', required: true, placeholder: 'My Redis' },
      { key: 'host', label: 'Host', type: 'text', required: true, placeholder: 'localhost' },
      { key: 'port', label: 'Port', type: 'number', required: true, placeholder: '6379', min: 1, max: 65535 },
      { key: 'password', label: 'Password', type: 'password' },
      { key: 'database', label: 'Database Number', type: 'number', placeholder: '0', min: 0, max: 15 },
      { key: 'ssl', label: 'Use TLS', type: 'checkbox' },
      { key: 'keyPrefix', label: 'Key Prefix', type: 'text', placeholder: 'myapp:' },
    ],
  },

  // ---------- Warehouses ----------
  {
    id: 'snowflake',
    submitType: 'snowflake',
    name: 'Snowflake',
    description: 'Cloud data warehouse platform',
    category: 'Warehouses',
    icon: '❄️',
    tags: ['cloud', 'warehouse', 'analytics'],
    isPopular: true,
    fields: [
      { key: 'name', label: 'Connection Name', type: 'text', required: true, placeholder: 'My Snowflake' },
      { key: 'account', label: 'Account', type: 'text', required: true, placeholder: 'xyz12345.us-east-1' },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'database', label: 'Database', type: 'text', required: true },
      { key: 'schema', label: 'Schema', type: 'text', placeholder: 'PUBLIC' },
      { key: 'warehouse', label: 'Warehouse', type: 'text', required: true },
      { key: 'role', label: 'Role', type: 'text', placeholder: 'Optional' },
    ],
  },
  {
    id: 'bigquery',
    submitType: 'bigquery',
    name: 'Google BigQuery',
    description: 'Google Cloud data warehouse',
    category: 'Warehouses',
    icon: '📊',
    tags: ['google', 'cloud', 'analytics'],
    isNew: true,
    fields: [
      { key: 'name', label: 'Connection Name', type: 'text', required: true, placeholder: 'My BigQuery' },
      { key: 'projectId', label: 'Project ID', type: 'text', required: true, placeholder: 'my-gcp-project' },
      { key: 'serviceAccount', label: 'Service Account JSON', type: 'textarea', required: true, placeholder: 'Paste JSON key here...', wide: true },
      {
        key: 'location',
        label: 'Location',
        type: 'select',
        options: [
          { label: 'US (Multi-region)', value: 'US' },
          { label: 'EU (Multi-region)', value: 'EU' },
          { label: 'asia', value: 'asia' },
        ],
      },
    ],
  },

  // ---------- Storage ----------
  {
    id: 's3',
    submitType: 's3',
    name: 'Amazon S3',
    description: 'AWS object storage service',
    category: 'Storage',
    icon: '📦',
    tags: ['aws', 'storage', 'object'],
    isPopular: true,
    fields: [
      { key: 'name', label: 'Connection Name', type: 'text', required: true, placeholder: 'My S3 Bucket' },
      { key: 'bucket', label: 'Bucket Name', type: 'text', required: true, placeholder: 'my-data-bucket' },
      {
        key: 'region',
        label: 'Region',
        type: 'select',
        required: true,
        options: [
          { label: 'US East (N. Virginia)', value: 'us-east-1' },
          { label: 'US West (Oregon)', value: 'us-west-2' },
          { label: 'EU (Ireland)', value: 'eu-west-1' },
          { label: 'AP (Tokyo)', value: 'ap-northeast-1' },
        ],
      },
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'prefix', label: 'Path Prefix', type: 'text', placeholder: 'data/' },
    ],
  },

  // ---------- Streaming ----------
  {
    id: 'kafka',
    submitType: 'kafka',
    name: 'Apache Kafka',
    description: 'Distributed streaming platform',
    category: 'Streaming',
    icon: '🌊',
    tags: ['streaming', 'real-time', 'events'],
    fields: [
      { key: 'name', label: 'Connection Name', type: 'text', required: true, placeholder: 'My Kafka Cluster' },
      { key: 'brokers', label: 'Bootstrap Servers', type: 'array', required: true, placeholder: 'localhost:9092,localhost:9093' },
      { key: 'topics', label: 'Topics', type: 'array', placeholder: 'topic1,topic2' },
      { key: 'groupId', label: 'Consumer Group ID', type: 'text', placeholder: 'my-consumer-group' },
      {
        key: 'security',
        label: 'Security Protocol',
        type: 'select',
        options: [
          { label: 'PLAINTEXT', value: 'PLAINTEXT' },
          { label: 'SASL_SSL', value: 'SASL_SSL' },
          { label: 'SSL', value: 'SSL' },
        ],
      },
      { key: 'username', label: 'SASL Username', type: 'text', dependsOn: { field: 'security', value: 'SASL_SSL', condition: 'equals' } },
      { key: 'password', label: 'SASL Password', type: 'password', dependsOn: { field: 'security', value: 'SASL_SSL', condition: 'equals' } },
    ],
  },

  // ---------- API & Files ----------
  {
    id: 'api',
    submitType: 'api',
    name: 'REST API',
    description: 'Connect to any REST API endpoint',
    category: 'API & Files',
    icon: '🔌',
    tags: ['api', 'rest', 'http'],
    isNew: true,
    fields: [
      { key: 'name', label: 'Connection Name', type: 'text', required: true, placeholder: 'My API' },
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'https://api.example.com' },
      {
        key: 'authType',
        label: 'Authentication',
        type: 'select',
        options: [
          { label: 'None', value: 'none' },
          { label: 'API Key', value: 'apikey' },
          { label: 'Bearer Token', value: 'bearer' },
          { label: 'Basic Auth', value: 'basic' },
        ],
      },
      { key: 'apiKey', label: 'API Key', type: 'password', dependsOn: { field: 'authType', value: 'apikey', condition: 'equals' } },
      { key: 'token', label: 'Bearer Token', type: 'password', dependsOn: { field: 'authType', value: 'bearer', condition: 'equals' } },
      { key: 'username', label: 'Username', type: 'text', dependsOn: { field: 'authType', value: 'basic', condition: 'equals' } },
      { key: 'password', label: 'Password', type: 'password', dependsOn: { field: 'authType', value: 'basic', condition: 'equals' } },
    ],
  },
];

/* =========================
   Helpers
========================= */
function defaultConfigFor(meta: ConnectorMeta): Record<string, any> {
  const base: Record<string, any> = {};
  if (meta.defaultPort) base.port = meta.defaultPort;

  // secure defaults
  if (meta.id === 'azure-sql') base.encrypt = true;      // ⬅️ Azure SQL must encrypt
  if (meta.id === 'snowflake') base.ssl = true;          // Snowflake still uses ssl flag in many libs

  return base;
}

function getPopularConnectors(): ConnectorMeta[] {
  return CONNECTORS.filter((c) => c.isPopular);
}

function getNewConnectors(): ConnectorMeta[] {
  return CONNECTORS.filter((c) => c.isNew);
}

function parseConnectionString(_connectorId: string, url: string): Record<string, any> {
  const parsed = new URL(url);
  const cfg: Record<string, any> = {
    host: parsed.hostname || undefined,
    port: parsed.port ? parseInt(parsed.port, 10) : undefined,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : undefined,
  };
  Object.keys(cfg).forEach((k) => cfg[k] === undefined && delete cfg[k]);
  return cfg;
}

type MigrationPath = {
  description?: string;
  fieldMapping: Record<string, string>;
  transformations?: Record<string, (v: any) => any>;
};

function getMigrationPath(fromType: string, toType: string): MigrationPath | undefined {
  const migrations: Record<string, MigrationPath> = {
    'mysql-to-postgresql': {
      description: 'Migrate from MySQL to PostgreSQL',
      fieldMapping: { host: 'host', port: 'port', database: 'database', username: 'username', password: 'password' },
      transformations: { port: (v: number) => (v === 3306 ? 5432 : v) },
    },
    'postgresql-to-mysql': {
      description: 'Migrate from PostgreSQL to MySQL',
      fieldMapping: { host: 'host', port: 'port', database: 'database', username: 'username', password: 'password' },
      transformations: { port: (v: number) => (v === 5432 ? 3306 : v) },
    },
  };
  return migrations[`${fromType}-to-${toType}`];
}

function shouldShowField(field: ConnectorField, config: Record<string, any>): boolean {
  if (!field.dependsOn) return true;
  const { field: dep, value, condition = 'equals' } = field.dependsOn;
  const dv = config[dep];

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
   Component props
========================= */
interface AddConnectionWizardProps {
  open: boolean;
  onClose: () => void;

  // ✅ matches your hook: (draft) => Promise<DataSource>
  onCreate: (draft: CreateDataSourcePayload) => Promise<DataSource>;

  onTestAfterCreate?: (id: string) => Promise<{ success: boolean; message?: string }>;
  existingConnections?: DataSource[];
  testImmediately?: boolean;
  autoDeleteOnFail?: boolean;
}

/* =========================
   Wizard
========================= */
const STEPS = ['Choose Connector', 'Configure', 'Complete'] as const;
type Step = typeof STEPS[number];

export default function AddConnectionWizard({
  open,
  onClose,
  onCreate,
  onTestAfterCreate,
  existingConnections = [],
  testImmediately = true,
  autoDeleteOnFail = true,
}: AddConnectionWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('Choose Connector');
  const [selectedConnector, setSelectedConnector] = useState<ConnectorMeta | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [connectionString, setConnectionString] = useState('');
  const [useConnectionString, setUseConnectionString] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; dataSource?: DataSource } | null>(null);

  const popularConnectors = getPopularConnectors();
  const newConnectors = getNewConnectors();

  // Reset state on open/close
  useEffect(() => {
    if (open) {
      setCurrentStep('Choose Connector');
      setSelectedConnector(null);
      setConfig({});
      setConnectionString('');
      setUseConnectionString(false);
      setSelectedTemplate('');
      setSearch('');
      setSelectedCategory('');
      setResult(null);
    }
  }, [open]);

  // Default config when connector selected
  useEffect(() => {
    if (selectedConnector) {
      setConfig(defaultConfigFor(selectedConnector));
    }
  }, [selectedConnector]);

  // Filtering
  const filteredConnectors = useMemo(() => {
    let filtered = CONNECTORS;

    if (selectedCategory) {
      filtered = filtered.filter((c) => c.category === selectedCategory);
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    return filtered;
  }, [search, selectedCategory]);

  // Parse connection string
  const handleConnectionStringParse = useCallback(() => {
    if (!selectedConnector || !connectionString) return;
    try {
      const parsed = parseConnectionString(selectedConnector.id, connectionString);
      setConfig((prev) => ({ ...prev, ...parsed }));
    } catch (e) {
      console.error('Invalid connection string:', e);
    }
  }, [selectedConnector, connectionString]);

  // Select connector
  const handleConnectorSelect = useCallback((connector: ConnectorMeta) => {
    setSelectedConnector(connector);
    setCurrentStep('Configure');
  }, []);

  // Field change
  const handleFieldChange = useCallback((key: string, value: any, fieldType?: FieldType) => {
    setConfig((prev) => {
      const next = { ...prev };
      if (fieldType === 'array') {
        if (typeof value === 'string') {
          next[key] = value.split(',').map((v) => v.trim()).filter(Boolean);
        } else {
          next[key] = Array.isArray(value) ? value : [];
        }
      } else {
        next[key] = value;
      }
      return next;
    });
  }, []);

  // Template select
  const handleTemplateSelect = useCallback((templateId: string) => {
    if (!selectedConnector) return;
    const t = selectedConnector.templates?.find((x) => x.id === templateId);
    if (!t) return;
    setConfig((prev) => ({ ...prev, ...t.config }));
    setSelectedTemplate(templateId);
  }, [selectedConnector]);

  // Create
  const handleCreate = useCallback(async () => {
    if (!selectedConnector || !onCreate) return;

    setCreating(true);
    try {
      // 🔁 Normalize config to what backend expects
      const submitType = (selectedConnector.submitType || (selectedConnector.id as DataSourceType));
      let configToSend: Record<string, any> = { ...config };

      if (submitType === 'mssql') {
        // map `ssl` → `encrypt` if user/template still set it
        if ('ssl' in configToSend) {
          configToSend.encrypt = Boolean(configToSend.ssl);
          delete configToSend.ssl;
        }
        // sensible defaults
        if (typeof configToSend.encrypt !== 'boolean') configToSend.encrypt = true;
        if (typeof configToSend.trustServerCertificate !== 'boolean') configToSend.trustServerCertificate = false;
        if (!configToSend.port) configToSend.port = 1433;
      }

      const payload: CreateDataSourcePayload = {
        name: (config.name as string) || `${selectedConnector.name} Connection`,
        type: submitType,
        description: config.description || undefined,
        connectionConfig: configToSend,
        tags: selectedConnector.tags || [],
      };

      const created = await onCreate(payload);

      let testResult: { success: boolean; message?: string } | null = null;
      if (testImmediately && onTestAfterCreate && created.id) {
        setTesting(true);
        try {
          testResult = await onTestAfterCreate(created.id);
          if (!testResult?.success && autoDeleteOnFail) {
            console.warn('Auto-delete on failed test is not implemented in the wizard.');
          }
        } catch (err) {
          testResult = { success: false, message: 'Test failed with error' };
        } finally {
          setTesting(false);
        }
      }

      setResult({
        success: true,
        message: testResult
          ? (testResult.success
              ? 'Connection created and tested successfully!'
              : `Connection created but test failed: ${testResult.message || 'Unknown error'}`)
          : 'Connection created successfully!',
        dataSource: created,
      });
      setCurrentStep('Complete');
    } catch (error: any) {
      setResult({ success: false, message: error?.message || 'Failed to create connection' });
      setCurrentStep('Complete');
    } finally {
      setCreating(false);
    }
  }, [selectedConnector, config, onCreate, onTestAfterCreate, testImmediately, autoDeleteOnFail]);

  // Navigation
  const handleNext = useCallback(() => {
    if (currentStep === 'Choose Connector' && selectedConnector) {
      setCurrentStep('Configure');
    } else if (currentStep === 'Configure') {
      handleCreate();
    }
  }, [currentStep, selectedConnector, handleCreate]);

  const handleBack = useCallback(() => {
    if (currentStep === 'Configure') {
      setCurrentStep('Choose Connector');
    } else if (currentStep === 'Complete') {
      setCurrentStep('Configure');
    }
  }, [currentStep]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Add Data Source</h2>
            <div className="flex items-center mt-2 space-x-2">
              {STEPS.map((step, index) => (
                <React.Fragment key={step}>
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      currentStep === step
                        ? 'bg-blue-600 text-white'
                        : STEPS.indexOf(currentStep) > index
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {STEPS.indexOf(currentStep) > index ? '✓' : index + 1}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-8 h-0.5 ${
                        STEPS.indexOf(currentStep) > index ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Choose */}
          {currentStep === 'Choose Connector' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search connectors..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Popular */}
              {!search && !selectedCategory && popularConnectors.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Popular</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {popularConnectors.map((connector) => (
                      <ConnectorCard
                        key={connector.id}
                        connector={connector}
                        onClick={() => handleConnectorSelect(connector)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* New */}
              {!search && !selectedCategory && newConnectors.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">New</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {newConnectors.map((connector) => (
                      <ConnectorCard
                        key={connector.id}
                        connector={connector}
                        badge="New"
                        onClick={() => handleConnectorSelect(connector)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All (filtered) */}
              <div className="space-y-6">
                {CATEGORIES.map((category) => {
                  const group = filteredConnectors.filter((c) => c.category === category);
                  if (group.length === 0) return null;
                  return (
                    <div key={category} className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900">{category}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.map((connector) => (
                          <ConnectorCard
                            key={connector.id}
                            connector={connector}
                            onClick={() => handleConnectorSelect(connector)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {currentStep === 'Configure' && selectedConnector && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-2xl">
                    {selectedConnector.icon || '🔗'}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{selectedConnector.name}</h3>
                    <p className="text-sm text-gray-600">{selectedConnector.description}</p>
                  </div>
                </div>
              </div>

              {/* Migration helper */}
              {existingConnections.length > 0 && (
                <MigrationHelper
                  selectedConnector={selectedConnector}
                  existingConnections={existingConnections}
                  onMigrate={(migratedConfig) => setConfig((prev) => ({ ...prev, ...migratedConfig }))}
                />
              )}

              {/* Templates */}
              {selectedConnector.templates && selectedConnector.templates.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Quick Setup Templates</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedConnector.templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleTemplateSelect(t.id)}
                        className={`p-3 text-left border rounded-lg hover:bg-gray-50 ${
                          selectedTemplate === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="font-medium text-sm">{t.name}</div>
                        <div className="text-xs text-gray-600 mt-1">{t.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Connection string helper (placeholder only) */}
              {selectedConnector.connectionStringPattern && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useConnectionString"
                      checked={useConnectionString}
                      onChange={(e) => setUseConnectionString(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="useConnectionString" className="text-sm font-medium text-gray-900">
                      Use connection string
                    </label>
                  </div>
                  {useConnectionString && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder={selectedConnector.connectionStringPattern}
                        value={connectionString}
                        onChange={(e) => setConnectionString(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                      <button
                        onClick={handleConnectionStringParse}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Parse Connection String
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Fields */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Connection Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedConnector.fields.map((field) => (
                    <ConfigField
                      key={field.key}
                      field={field}
                      value={config[field.key] ?? (field.type === 'checkbox' ? false : '')}
                      onChange={(v) => handleFieldChange(field.key, v, field.type)}
                      config={config}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {currentStep === 'Complete' && result && (
            <div className="text-center space-y-6">
              <div
                className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                  result.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}
              >
                {result.success ? '✓' : '✗'}
              </div>
              <div>
                <h3
                  className={`text-lg font-medium ${
                    result.success ? 'text-green-900' : 'text-red-900'
                  }`}
                >
                  {result.success ? 'Connection Created!' : 'Creation Failed'}
                </h3>
                <p className="text-gray-600 mt-2">{result.message}</p>
              </div>

              {result.success && result.dataSource && (
                <div className="bg-gray-50 p-4 rounded-lg text-left">
                  <h4 className="font-medium text-gray-900 mb-2">Connection Details</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>Name: {result.dataSource.name}</div>
                    <div>Type: {result.dataSource.type}</div>
                    <div>Status: {result.dataSource.status}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex justify-between flex-shrink-0">
          <button
            onClick={currentStep === 'Complete' ? onClose : handleBack}
            disabled={currentStep === 'Choose Connector'}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {currentStep === 'Complete' ? 'Close' : 'Back'}
          </button>

          {currentStep !== 'Complete' && (
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleNext}
                disabled={
                  (currentStep === 'Choose Connector' && !selectedConnector) ||
                  (currentStep === 'Configure' && creating) ||
                  testing
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating || testing
                  ? 'Creating...'
                  : currentStep === 'Choose Connector'
                  ? 'Next'
                  : 'Create Connection'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Small components
========================= */
function ConnectorCard({
  connector,
  onClick,
  badge,
}: {
  connector: ConnectorMeta;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 text-left transition-colors relative"
    >
      {badge && (
        <span className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded">
          {badge}
        </span>
      )}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center text-xl">{connector.icon || '🔗'}</div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">{connector.name}</div>
          <div className="text-sm text-gray-600 truncate">{connector.description}</div>
        </div>
      </div>
      {connector.tags && connector.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {connector.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
              {tag}
            </span>
          ))}
          {connector.tags.length > 3 && (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
              +{connector.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function ConfigField({
  field,
  value,
  onChange,
  config,
}: {
  field: ConnectorField;
  value: any;
  onChange: (value: any) => void;
  config: Record<string, any>;
}) {
  const show = useMemo(() => shouldShowField(field, config), [field, config]);
  if (!show) return null;

  const base = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className={field.type === 'textarea' || field.wide ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {field.type === 'password' ? (
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          className={base}
        />
      ) : field.type === 'number' ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
          placeholder={field.placeholder}
          required={field.required}
          min={field.min}
          max={field.max}
          className={base}
        />
      ) : field.type === 'select' ? (
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={base}
        >
          <option value="">Select {field.label}</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          rows={3}
          className={base}
        />
      ) : field.type === 'checkbox' ? (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          {field.placeholder && <span className="ml-2 text-sm text-gray-600">{field.placeholder}</span>}
        </div>
      ) : field.type === 'array' ? (
        <input
          type="text"
          value={Array.isArray(value) ? value.join(', ') : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          className={base}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          className={base}
        />
      )}

      {field.help && <p className="mt-1 text-sm text-gray-500">{field.help}</p>}
    </div>
  );
}

function MigrationHelper({
  selectedConnector,
  existingConnections,
  onMigrate,
}: {
  selectedConnector: ConnectorMeta;
  existingConnections: DataSource[];
  onMigrate: (config: Record<string, any>) => void;
}) {
  const candidates = useMemo(() => {
    return existingConnections
      .map((conn) => {
        const path = getMigrationPath(conn.type, selectedConnector.submitType || selectedConnector.id);
        return path ? { conn, path } : null;
      })
      .filter((x): x is { conn: DataSource; path: MigrationPath } => !!x);
  }, [existingConnections, selectedConnector]);

  if (candidates.length === 0) return null;

  const handleMigration = (conn: DataSource, path: MigrationPath) => {
    const fromCfg = (conn.connectionConfig || {}) as Record<string, any>;
    const mapped = Object.entries(path.fieldMapping).reduce<Record<string, any>>((acc, [fromKey, toKey]) => {
      const val = fromCfg[fromKey];
      if (val !== undefined) {
        const xform = path.transformations?.[toKey];
        acc[toKey] = xform ? xform(val) : val;
      }
      return acc;
    }, {});
    onMigrate(mapped);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <h4 className="font-medium text-amber-900 mb-2">Migration Assistant</h4>
      <p className="text-sm text-amber-800 mb-3">Copy configuration from existing connections:</p>
      <div className="space-y-2">
        {candidates.map(({ conn, path }) => (
          <button
            key={conn.id}
            onClick={() => handleMigration(conn, path)}
            className="w-full p-2 text-left bg-white border border-amber-200 rounded hover:bg-amber-50"
          >
            <div className="font-medium text-sm">{conn.name}</div>
            <div className="text-xs text-amber-700">
              {path.description || `Migrate from ${conn.type} to ${selectedConnector.name}`}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

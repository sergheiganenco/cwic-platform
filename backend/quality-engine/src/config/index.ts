// backend/quality-engine/src/config/index.ts
// Configuration for the Quality Engine

export const config = {
  // Service configuration
  service: {
    name: 'quality-engine',
    version: '2.0.0',
    port: parseInt(process.env.QUALITY_ENGINE_PORT || '3010'),
    environment: process.env.NODE_ENV || 'development'
  },

  // Database configuration
  database: {
    host: process.env.DB_HOST || 'db',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'cwic_platform',
    user: process.env.DB_USER || 'cwic_user',
    password: process.env.DB_PASSWORD || 'cwic_password',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10')
  },

  // Redis configuration for event streaming
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true
  },

  // Kafka configuration (optional, for high-volume)
  kafka: {
    enabled: process.env.KAFKA_ENABLED === 'true',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: 'quality-engine',
    groupId: 'quality-engine-group',
    topics: {
      qualityEvents: 'quality-events',
      qualityResults: 'quality-results',
      anomalies: 'quality-anomalies',
      healingActions: 'quality-healing'
    }
  },

  // Machine Learning configuration
  ml: {
    anomalyDetection: {
      enabled: true,
      models: {
        isolationForest: true,
        autoencoder: true,
        lstm: true
      },
      threshold: 0.95,
      windowSize: 100,
      retrainFrequency: '0 0 * * 0' // Weekly
    },
    prediction: {
      enabled: true,
      horizon: 7, // Days
      confidence: 0.8,
      features: [
        'completeness_score',
        'accuracy_score',
        'consistency_score',
        'validity_score',
        'freshness_score',
        'uniqueness_score'
      ]
    }
  },

  // Cost-aware scheduling
  scheduling: {
    costTracking: true,
    budgetLimits: {
      daily: 100, // $100 per day
      monthly: 2000 // $2000 per month
    },
    priorities: {
      critical: 1.0,
      high: 0.8,
      medium: 0.5,
      low: 0.2
    },
    offPeakHours: {
      start: 22, // 10 PM
      end: 6 // 6 AM
    }
  },

  // Auto-healing configuration
  autoHealing: {
    enabled: true,
    confidence: 0.9,
    techniques: {
      imputation: true,
      deduplication: true,
      standardization: true,
      enrichment: false // Requires external APIs
    },
    maxAttempts: 3,
    backoffMultiplier: 2
  },

  // Smart profiling
  profiling: {
    sampling: {
      strategy: 'adaptive', // 'adaptive' | 'stratified' | 'reservoir'
      minSampleSize: 1000,
      maxSampleSize: 100000,
      confidence: 0.95
    },
    patterns: {
      detectPII: true,
      detectEnums: true,
      detectRelationships: true,
      detectSeasonality: true
    },
    incremental: {
      enabled: true,
      strategy: 'merge' // 'append' | 'merge' | 'replace'
    }
  },

  // Event streaming configuration
  events: {
    batchSize: 100,
    flushInterval: 5000, // 5 seconds
    maxRetries: 3,
    deadLetterQueue: true,
    compression: true
  },

  // Observability configuration
  observability: {
    tracing: {
      enabled: true,
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      serviceName: 'quality-engine',
      sampleRate: 0.1 // Sample 10% of requests
    },
    metrics: {
      enabled: true,
      port: 9090,
      path: '/metrics',
      defaultLabels: {
        service: 'quality-engine',
        environment: process.env.NODE_ENV || 'development'
      }
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: 'json',
      directory: './logs'
    }
  },

  // Integration configuration
  integrations: {
    slack: {
      enabled: process.env.SLACK_ENABLED === 'true',
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channels: {
        critical: '#data-quality-critical',
        alerts: '#data-quality-alerts',
        reports: '#data-quality-reports'
      }
    },
    jira: {
      enabled: process.env.JIRA_ENABLED === 'true',
      baseUrl: process.env.JIRA_BASE_URL,
      apiToken: process.env.JIRA_API_TOKEN,
      projectKey: process.env.JIRA_PROJECT_KEY || 'DQ'
    },
    pagerduty: {
      enabled: process.env.PAGERDUTY_ENABLED === 'true',
      apiKey: process.env.PAGERDUTY_API_KEY,
      serviceId: process.env.PAGERDUTY_SERVICE_ID
    }
  }
};
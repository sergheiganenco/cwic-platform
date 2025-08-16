// src/interfaces/index.ts

// Namespace-style re-exports (import as `Analysis.*` or `Discovery.*`)
export * as Analysis from './analysis.interface';
export * as Discovery from './discovery.interface';

// Flatten specific items so you can `import { DiscoveryStatus } from '@/interfaces'`
export { DiscoveryStatus, DiscoveryType } from './discovery.interface';

// NOTE: Removed this because we define JobStatus/JobPriority below.
// export { JobStatus, JobPriority } from './job.interface';

// Import only for typing
import type { Request as ExpressRequest } from 'express';

/* ────────────────────────────
 * Utility & Brand Types
 * ──────────────────────────── */
export type Brand<K, T extends string> = K & { readonly __brand: T };

export type UUID = Brand<string, 'uuid'>;
export type ISODateTime = Brand<string, 'iso-datetime'>;

export type Maybe<T> = T | null | undefined;
export type Result<T, E = ServiceError> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: E }>;
export type NonEmptyArray<T> = readonly [T, ...T[]];

export type DeepReadonly<T> =
  T extends (...args: any[]) => any ? T :
  T extends Array<infer U> ? ReadonlyArray<DeepReadonly<U>> :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T;

/* ────────────────────────────
 * Shared entities & pagination
 * ──────────────────────────── */
export interface BaseEntity {
  readonly id: UUID | string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy?: UUID | string;
  readonly updatedBy?: UUID | string;
}

export type SortOrder = 'ASC' | 'DESC';

export interface PaginationParams {
  readonly page?: number;
  readonly limit?: number;
  readonly offset?: number; // (page-1)*limit (server-calculated preferred)
  readonly sortBy?: string;
  readonly sortOrder?: SortOrder;
}

export interface PaginationInfo {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
}

export interface PaginationResult<T> {
  readonly data: readonly T[];
  readonly pagination: PaginationInfo;
}

/* ────────────────────────────
 * Filtering / query params
 * ──────────────────────────── */
export interface DateRange {
  readonly from: Date | ISODateTime | string;
  readonly to: Date | ISODateTime | string;
}

export interface FilterParams<F extends Record<string, unknown> = Record<string, unknown>> {
  readonly search?: string;
  readonly filters?: F;
  readonly dateRange?: DateRange;
}

/* ────────────────────────────
 * ApiRequest & Auth
 * ──────────────────────────── */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  DATA_STEWARD = 'data_steward',
  ANALYST = 'analyst',
  VIEWER = 'viewer'
}

export enum Permission {
  // Discovery
  DISCOVERY_READ = 'discovery:read',
  DISCOVERY_WRITE = 'discovery:write',
  DISCOVERY_DELETE = 'discovery:delete',
  // Analysis
  ANALYSIS_READ = 'analysis:read',
  ANALYSIS_WRITE = 'analysis:write',
  ANALYSIS_DELETE = 'analysis:delete',
  // Data source
  DATASOURCE_READ = 'datasource:read',
  DATASOURCE_WRITE = 'datasource:write',
  DATASOURCE_DELETE = 'datasource:delete',
  DATASOURCE_CONNECT = 'datasource:connect',
  // Admin
  USER_MANAGEMENT = 'user:management',
  SYSTEM_CONFIG = 'system:config',
  AUDIT_LOGS = 'audit:logs',
  // AI
  AI_QUERY = 'ai:query',
  AI_TRAINING = 'ai:training'
}

export interface NotificationSettings {
  readonly email: boolean;
  readonly inApp: boolean;
  readonly sms: boolean;
  readonly slack: boolean;
  readonly webhooks: boolean;
}

export interface UserPreferences {
  readonly timezone: string;
  readonly language: string;
  readonly dateFormat: string;
  readonly notifications: NotificationSettings;
}

export interface AuthenticatedUser {
  readonly id: UUID | string;
  readonly email: string;
  readonly role: UserRole;
  readonly permissions: readonly Permission[];
  readonly organizationId?: UUID | string;
  readonly preferences?: UserPreferences;
}

/** Express Request typed with body/params/query plus user */
export type ApiRequest<
  B = unknown,
  P extends Record<string, string> = Record<string, string>,
  Q extends Record<string, unknown> = Record<string, unknown>
> = ExpressRequest<P, any, B, Q> & { user?: AuthenticatedUser };

/* ────────────────────────────
 * Service response envelopes
 * ──────────────────────────── */
export interface ServiceError {
  readonly code: string; // e.g., 'VALIDATION_ERROR', 'DB_TIMEOUT'
  readonly message: string;
  readonly details?: unknown;
  readonly stack?: string; // do not expose in prod
}

export interface ResponseMeta {
  readonly timestamp: ISODateTime | string;
  readonly requestId?: string;
  readonly version: string;
  readonly processingTime?: number; // ms
}

export interface ServiceResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly message?: string;
  readonly error?: ServiceError;
  readonly meta?: ResponseMeta;
}

/** Generic pagination wrapper using ApiResponse pattern */
export type PaginatedResponse<T> =
  | Readonly<{
      success: true;
      data: { items: readonly T[]; pagination: PaginationInfo };
      message?: string;
      meta?: ResponseMeta;
    }>
  | Readonly<{
      success: false;
      error: ServiceError;
      meta?: ResponseMeta;
    }>;

/* ────────────────────────────
 * Health & system info
 * ──────────────────────────── */
export type HealthState = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheck {
  readonly name: string;
  readonly status: HealthState;
  readonly responseTime: number;
  readonly details?: unknown;
  readonly error?: string;
}

export interface SystemInfo {
  readonly memory: NodeJS.MemoryUsage;
  readonly cpu: {
    readonly loadAverage: readonly number[];
    readonly usage: number; // your implementation units
  };
  readonly process: {
    readonly pid: number;
    readonly platform: string;
    readonly nodeVersion: string;
  };
}

export interface HealthStatus {
  readonly status: HealthState;
  readonly service: string;
  readonly version: string;
  readonly timestamp: ISODateTime | string;
  readonly uptime: number;
  readonly checks: readonly HealthCheck[];
  readonly system: SystemInfo;
}

/* ────────────────────────────
 * Data sources & connection
 * ──────────────────────────── */
export enum DataSourceType {
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  SQL_SERVER = 'sql_server',
  ORACLE = 'oracle',
  SNOWFLAKE = 'snowflake',
  BIGQUERY = 'bigquery',
  REDSHIFT = 'redshift',
  MONGODB = 'mongodb',
  CASSANDRA = 'cassandra',
  ELASTICSEARCH = 'elasticsearch'
}

export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  TESTING = 'testing',
  PENDING = 'pending',
  TIMEOUT = 'timeout'
}

export interface ConnectionConfig {
  readonly host?: string;
  readonly port?: number;
  readonly database?: string;
  readonly username?: string;
  readonly password?: string; // encrypted at rest
  readonly ssl?: boolean;
  readonly connectionTimeout?: number;
  readonly queryTimeout?: number;
  readonly poolSize?: number;
  readonly additionalProperties?: Record<string, unknown>;
}

export interface DataSource {
  readonly id: UUID | string;
  readonly name: string;
  readonly type: DataSourceType;
  readonly connectionConfig: ConnectionConfig;
  readonly status: ConnectionStatus;
  readonly lastConnected?: Date;
  readonly tags?: readonly string[];
  readonly description?: string;
}

/* ────────────────────────────
 * Logging / audit / notifications
 * ──────────────────────────── */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: Date;
  readonly service: string;
  readonly requestId?: string;
  readonly userId?: UUID | string;
  readonly metadata?: Record<string, unknown>;
  readonly stack?: string;
}

export interface AuditLog extends BaseEntity {
  readonly action: string;
  readonly resource: string;
  readonly resourceId?: string;
  readonly userId: UUID | string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly details?: Record<string, unknown>;
  readonly result: 'success' | 'failure';
}

export enum NotificationType {
  DISCOVERY_COMPLETED = 'discovery_completed',
  ANALYSIS_COMPLETED = 'analysis_completed',
  QUALITY_ALERT = 'quality_alert',
  COMPLIANCE_VIOLATION = 'compliance_violation',
  SYSTEM_ALERT = 'system_alert',
  SECURITY_ALERT = 'security_alert',
  DATA_BREACH = 'data_breach',
  MAINTENANCE = 'maintenance'
}

export enum NotificationChannel {
  EMAIL = 'email',
  IN_APP = 'in_app',
  SMS = 'sms',
  SLACK = 'slack',
  TEAMS = 'teams',
  WEBHOOK = 'webhook',
  PUSH = 'push'
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface Notification extends BaseEntity {
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly userId?: UUID | string;
  readonly organizationId?: UUID | string;
  readonly channel: NotificationChannel;
  readonly status: NotificationStatus;
  readonly scheduledAt?: Date;
  readonly sentAt?: Date;
  readonly metadata?: Record<string, unknown>;
}

/* ────────────────────────────
 * Jobs (defined here; no external file needed)
 * ──────────────────────────── */
export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

export enum JobPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/* ────────────────────────────
 * Events
 * ──────────────────────────── */
export enum EventType {
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  DATA_ACCESS = 'data_access',
  DISCOVERY_START = 'discovery_start',
  DISCOVERY_COMPLETE = 'discovery_complete',
  ANALYSIS_START = 'analysis_start',
  ANALYSIS_COMPLETE = 'analysis_complete',
  COMPLIANCE_CHECK = 'compliance_check',
  QUALITY_CHECK = 'quality_check',
  SYSTEM_ERROR = 'system_error',
  SECURITY_EVENT = 'security_event'
}

/* ────────────────────────────
 * JSON types
 * ──────────────────────────── */
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export type JSONObject = { readonly [key: string]: JSONValue };
export type JSONArray = readonly JSONValue[];

/* ────────────────────────────
 * Forms (UI helpers)
 * ──────────────────────────── */
export interface ValidationRule {
  readonly required?: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: RegExp;
  readonly custom?: (value: unknown) => boolean | string;
}

export interface FormField {
  readonly name: string;
  readonly label: string;
  readonly type: 'text' | 'email' | 'password' | 'number' | 'select' | 'checkbox' | 'textarea';
  readonly placeholder?: string;
  readonly defaultValue?: unknown;
  readonly options?: ReadonlyArray<{ label: string; value: unknown }>;
  readonly validation?: ValidationRule;
  readonly disabled?: boolean;
  readonly required?: boolean;
}

/* ────────────────────────────
 * Configuration
 * ──────────────────────────── */
export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly ssl: boolean;
  readonly poolMin: number;
  readonly poolMax: number;
  readonly timeout: number;
}

export interface RedisConfig {
  readonly host: string;
  readonly port: number;
  readonly password?: string;
  readonly db: number;
  readonly ttl: number;
}

export interface AIConfig {
  readonly provider: 'openai' | 'azure' | 'anthropic';
  readonly apiKey: string;
  readonly model: string;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly timeout: number;
}

export interface SecurityConfig {
  readonly jwtSecret: string;
  readonly jwtExpiry: string;
  readonly bcryptRounds: number;
  readonly rateLimitWindow: number;
  readonly rateLimitMax: number;
  readonly corsOrigins: readonly string[];
}

export interface MonitoringConfig {
  readonly enabled: boolean;
  readonly metricsPort: number;
  readonly healthCheckInterval: number;
  readonly logLevel: LogLevel;
  readonly logRetention: number;
}

export interface ServiceConfig {
  readonly name: string;
  readonly version: string;
  readonly environment: string;
  readonly port: number;
  readonly database: DatabaseConfig;
  readonly redis: RedisConfig;
  readonly ai: AIConfig;
  readonly security: SecurityConfig;
  readonly monitoring: MonitoringConfig;
}

/* ────────────────────────────
 * Friendly named export aliases
 * ──────────────────────────── */
export type {
  AIConfig as TAIConfig,
  DatabaseConfig as TDatabaseConfig,
  FormField as TFormField,
  ISODateTime as TISODateTime,
  JSONArray as TJSONArray,
  JSONObject as TJSONObject,
  JSONValue as TJSONValue,
  MonitoringConfig as TMonitoringConfig,
  PaginatedResponse as TPaginatedResponse,
  RedisConfig as TRedisConfig,
  SecurityConfig as TSecurityConfig,
  ServiceConfig as TServiceConfig,
  UUID as TUUID
};

// Re-export ApiResponse type from utils (type-only to avoid runtime deps)
  export type { ApiResponse } from '../utils/responses';


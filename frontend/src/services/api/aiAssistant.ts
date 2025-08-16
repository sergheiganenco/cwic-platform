// src/services/api/aiAssistant.ts
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';

/* =========================
   Types
   ========================= */
export interface AIMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: Date;
  metadata?: {
    processingTime?: number;
    confidence?: number;
    sources?: string[];
    tokenCount?: number;
    model?: string;
  };
}

export interface AIAction {
  type: 'view_details' | 'export_data' | 'schedule_analysis' | 'create_rule';
  label: string;
  description?: string;
  payload?: unknown;
}

export interface AIResponse {
  success: boolean;
  data?: {
    message: string;
    type: 'text' | 'data' | 'query' | 'analysis' | 'visualization';
    results?: unknown;
    suggestions?: string[];
    sources?: string[];
    actions?: AIAction[];
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
  };
  meta?: {
    processingTime: number;
    model: string;
    tokens?: number;
    confidence?: number;
    requestId?: string;
    timestamp: string;
  };
}

export interface AIDiscoverySession {
  sessionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  phase?: 'initialization' | 'scanning' | 'analysis' | 'classification' | 'reporting';
  results?: {
    tablesAnalyzed?: number;
    columnsFound?: number;
    sensitiveDataFound?: number;
    qualityIssues?: number;
    complianceFlags?: number;
    recommendations?: string[];
  };
  startedAt: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;
  error?: string;
}

export interface AIServiceConfig {
  baseURL: string;
  timeout: number;
  maxRetries: number;    // retry attempts for transient errors
  retryDelay: number;    // base delay in ms
  enableMockMode: boolean;
  cacheDuration: number; // ms
}

export interface RequestContext {
  requestId?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  timeout?: number;
  retryable?: boolean;
  cacheKey?: string;
}

interface ConnectionMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastError?: string;
  uptime: number; // stored as start-time internally; getter returns elapsed
}

/* =========================
   Errors (TS1294-safe)
   ========================= */
class AIServiceError extends Error {
  public code: string;
  public retryable: boolean;
  public details?: unknown;

  constructor(code: string, message: string, retryable: boolean = false, details?: unknown) {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}
class NetworkError extends AIServiceError {
  constructor(message: string = 'Network connection failed') {
    super('NETWORK_ERROR', message, true);
  }
}
class TimeoutError extends AIServiceError {
  constructor(message: string = 'Request timed out') {
    super('TIMEOUT_ERROR', message, true);
  }
}
class AuthenticationError extends AIServiceError {
  constructor(message: string = 'Authentication failed') {
    super('AUTH_ERROR', message, false);
  }
}

/* =========================
   Helpers (no module augmentation)
   ========================= */
type Meta = { requestId: string; startTime: number };
const requestMeta = new WeakMap<AxiosRequestConfig, Meta>();

const isBrowser = typeof window !== 'undefined';
// Your backend exposes GET /api/status (baseURL already includes /api)
const HEALTH_PATH = '/status';

/* =========================
   Service
   ========================= */
class AIAssistantService {
  // Avoid AxiosInstance type to prevent duplicate identifier errors
  private readonly api: ReturnType<typeof axios.create>;
  private config: AIServiceConfig;

  private connected = false;
  private connectionAttempts = 0;
  private lastConnectionCheck = 0;

  private metrics: ConnectionMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    uptime: Date.now(),
  };

  private responseCache = new Map<string, { response: AIResponse; timestamp: number }>();
  private activeRequests = new Map<string, AbortController>();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  private readonly CONNECTION_CHECK_INTERVAL = 30_000; // 30s
  private readonly MAX_CACHE_SIZE = 100;

  constructor(config?: Partial<AIServiceConfig>) {
    const baseFromEnv =
      (import.meta as any).env?.VITE_AI_SERVICE_URL ||
      (import.meta as any).env?.VITE_API_BASE ||
      'http://localhost:8003/api';

    this.config = {
      baseURL: baseFromEnv,
      timeout: 30_000,
      maxRetries: 3,
      retryDelay: 1_000,
      enableMockMode: (import.meta as any).env?.VITE_ENABLE_MOCK_MODE !== 'false',
      cacheDuration: 300_000, // 5 minutes
      ...config,
    };

    this.api = this.createAxiosInstance();
    void this.checkConnection();
    this.startPeriodicCleanup();
  }

  /* ---------- axios ---------- */
  private createAxiosInstance(): ReturnType<typeof axios.create> {
    const instance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Client-Version': (import.meta as any).env?.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web',
        'X-Platform': 'cwic-frontend',
      },
    });

    // Request interceptor
    instance.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) (config.headers as any).Authorization = `Bearer ${token}`;

        const requestId = this.generateRequestId();
        (config.headers as any)['X-Request-ID'] = requestId;
        requestMeta.set(config, { requestId, startTime: Date.now() });

        const userContext = this.getUserContext();
        if (userContext) (config.headers as any)['X-User-Context'] = JSON.stringify(userContext);

        this.metrics.totalRequests++;

        if (import.meta.env.DEV) {
          console.log(`🔄 AI API Request: ${config.method?.toUpperCase()} ${config.url}`, {
            requestId,
            headers: this.sanitizeHeaders(config.headers),
            data: config.data,
          });
        }
        return config;
      },
      (error: AxiosError) => {
        this.metrics.failedRequests++;
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(new AIServiceError('REQUEST_SETUP_ERROR', error.message, false, error));
      }
    );

    // Response interceptor
    instance.interceptors.response.use(
      (response: AxiosResponse) => {
        const meta = requestMeta.get(response.config);
        const processingTime = meta ? Date.now() - meta.startTime : 0;

        this.metrics.successfulRequests++;
        this.updateAverageResponseTime(processingTime);

        if (import.meta.env.DEV) {
          console.log(`✅ AI API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            status: response.status,
            processingTime: `${processingTime}ms`,
            requestId: meta?.requestId,
            data: response.data,
          });
        }
        return response;
      },
      (error: AxiosError) => {
        const meta = error.config ? requestMeta.get(error.config) : undefined;
        const processingTime = meta ? Date.now() - meta.startTime : 0;

        this.metrics.failedRequests++;
        this.metrics.lastError = error.message;

        console.error('❌ AI Service API Error:', {
          message: error.message,
          status: error.response?.status,
          processingTime: `${processingTime}ms`,
          requestId: meta?.requestId,
          data: error.response?.data,
          config: { method: error.config?.method, url: error.config?.url },
        });

        this.handleSpecificErrors(error);
        return Promise.reject(this.createEnhancedError(error));
      }
    );

    return instance;
  }

  /* ---------- connection ---------- */
  private async checkConnection(): Promise<void> {
    const now = Date.now();
    if (now - this.lastConnectionCheck < this.CONNECTION_CHECK_INTERVAL) return;
    this.lastConnectionCheck = now;

    try {
      await this.requestWithRetry(
        () => this.api.get(HEALTH_PATH, { timeout: 5_000, headers: { 'X-Health-Check': 'true' } }),
        { skipRetry: true }
      );

      this.connected = true;
      this.connectionAttempts = 0;
      if (import.meta.env.DEV) console.log('✅ AI Service connected successfully');
    } catch (error) {
      this.connected = false;
      this.connectionAttempts++;
      if (import.meta.env.DEV) console.log(`❌ AI Service not available (attempt ${this.connectionAttempts})`, error);
    }
  }

  public isConnected(): boolean {
    return this.connected;
  }
  public getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (this.connectionAttempts > 0 && !this.connected) return 'connecting';
    return this.connected ? 'connected' : 'disconnected';
  }

  /* ---------- retry helper ---------- */
  private async requestWithRetry<T>(
    fn: () => Promise<T>,
    opts: { skipRetry?: boolean } = {}
  ): Promise<T> {
    if (opts.skipRetry) return fn();

    const max = this.config.maxRetries;
    const base = this.config.retryDelay;

    let lastError: unknown;
    for (let attempt = 0; attempt <= max; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const error = err as AxiosError;
        const status = error.response?.status;
        const code = (error as any).code;

        const isAuth = status === 401 || status === 403;
        const isValidation = status === 422;
        const isTimeout = code === 'ECONNABORTED';
        const isNetwork = code === 'ERR_NETWORK' || code === 'NETWORK_ERROR';
        const retryableStatus = !status || status >= 500 || status === 429;

        if (attempt === max || isAuth || isValidation || (!retryableStatus && !isTimeout && !isNetwork)) {
          lastError = error;
          break;
        }

        const jitter = Math.floor(Math.random() * 250);
        const wait = base * Math.pow(2, attempt) + jitter;
        if (import.meta.env.DEV) console.warn(`🔁 Retry ${attempt + 1}/${max} in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    throw lastError;
  }

  /* ---------- periodic cleanup ---------- */
  private startPeriodicCleanup(): void {
    this.stopPeriodicCleanup(); // avoid double timers

    // run immediately once
    this.cleanupCache();
    this.cleanupActiveRequests();

    // then every 5 minutes
    this.cleanupTimer = setInterval(() => {
      try {
        this.cleanupCache();
        this.cleanupActiveRequests();
      } catch (err) {
        if (import.meta.env.DEV) console.warn('Periodic cleanup error:', err);
      }
    }, 300_000);

    // optional: stop on unload
    if (isBrowser) {
      window.addEventListener('beforeunload', () => this.stopPeriodicCleanup(), { once: true });
    }
  }

  private stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, { timestamp }] of this.responseCache) {
      if (now - timestamp > this.config.cacheDuration) this.responseCache.delete(key);
    }
    if (this.responseCache.size > this.MAX_CACHE_SIZE) {
      const sorted = [...this.responseCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
      const excess = this.responseCache.size - this.MAX_CACHE_SIZE;
      for (let i = 0; i < excess; i++) this.responseCache.delete(sorted[i][0]);
    }
  }

  private cleanupActiveRequests(): void {
    for (const [id, ctrl] of this.activeRequests) {
      if (ctrl.signal.aborted) this.activeRequests.delete(id);
    }
  }

  /* ---------- normalizer ---------- */
  private normalizeBackendData(raw: any, userPrompt?: string): AIResponse['data'] {
    if (!raw) {
      return { message: 'Empty response from AI service.', type: 'text' };
    }

    // If backend already returns your unified shape, pass it through
    if (raw.type && raw.message) return raw as AIResponse['data'];

    // Natural-language → SQL result (AIService.QueryResult)
    if (raw.sql && raw.explanation) {
      return {
        message: "Here’s the SQL I generated.",
        type: 'query',
        results: {
          sql: raw.sql,
          explanation: raw.explanation,
          tables: raw.tables,
          fields: raw.fields,
          confidence: raw.confidence,
          warnings: raw.warnings,
          isAiGenerated: raw.isAiGenerated,
        },
        suggestions: [
          'Add a date range filter',
          'Group results by day',
          'Limit to the last 1,000 rows',
          'Explain this query step-by-step',
        ],
        actions: [{ type: 'view_details', label: 'Copy SQL', payload: { sql: raw.sql, prompt: userPrompt } }],
      };
    }

    // Data sample / quality analysis shape (AnalysisService.analyzeDataSample)
    if (raw.analysis && raw.qualityIssues) {
      return {
        message: "Here’s your data quality analysis.",
        type: 'analysis',
        results: {
          analysis: raw.analysis,
          qualityIssues: raw.qualityIssues,
          recommendations: raw.recommendations ?? [],
          summary: raw.summary,
          analysisMetadata: raw.analysisMetadata,
        },
        suggestions: [
          'Generate quality rules',
          'Create a remediation plan',
          'Schedule a weekly quality check',
        ],
        actions: [{ type: 'create_rule', label: 'Create Quality Rules', payload: { issues: raw.qualityIssues } }],
      };
    }

    // Field discovery (AIService.discoverFields / DiscoveryService)
    if (raw.fields && raw.recommendations) {
      return {
        message: 'Field discovery results are ready.',
        type: 'data',
        results: raw,
        suggestions: [
          'Generate quality rules for PII',
          'Export a discovery report',
          'Open governance recommendations',
        ],
        actions: [{ type: 'export_data', label: 'Export Report', payload: { format: 'json', data: raw } }],
      };
    }

    // Quality rules generation
    if (Array.isArray(raw.rules)) {
      return {
        message: 'Proposed quality rules generated.',
        type: 'data',
        results: raw.rules,
        actions: [{ type: 'create_rule', label: 'Apply Rules', description: 'Create and enable these rules' }],
      };
    }

    // Generic fallback: stringify unknown objects or pass through strings
    if (typeof raw === 'string') return { message: raw, type: 'text' };
    try {
      return { message: 'Result:', type: 'data', results: raw };
    } catch {
      return { message: 'Received an unrecognized response.', type: 'text' };
    }
  }

  /* ---------- public API ---------- */
  public async sendMessage(message: string, context?: RequestContext): Promise<AIResponse> {
    const requestId = context?.requestId || this.generateRequestId();

    // cache
    if (context?.cacheKey) {
      const cached = this.getCachedResponse(context.cacheKey);
      if (cached) return cached;
    }

    await this.checkConnection();

    try {
      const abortController = new AbortController();
      this.activeRequests.set(requestId, abortController);

      const t0 = performance.now?.() ?? Date.now();

      const res = await this.requestWithRetry(() =>
        this.api.post(
          '/discovery/query',
          {
            query: message,
            context: {
              timestamp: new Date().toISOString(),
              clientType: 'web',
              userAgent: isBrowser ? navigator.userAgent : 'node',
              ...context,
            },
          },
          {
            timeout: context?.timeout || this.config.timeout,
            signal: abortController.signal,
          }
        )
      );

      const elapsed = Math.round((performance.now?.() ?? Date.now()) - t0);

      // ⬇️ normalize backend payload to the unified chat shape
      const normalized = this.normalizeBackendData(res.data?.data, message);

      const aiResponse: AIResponse = {
        success: true,
        data: normalized,
        meta: {
          ...res.data.meta,
          requestId,
          timestamp: new Date().toISOString(),
          processingTime: res.data?.meta?.processingTime ?? elapsed,
        },
      };

      if (context?.cacheKey) this.setCachedResponse(context.cacheKey, aiResponse);
      return aiResponse;
    } catch (error) {
      return this.handleUnknownError(error, requestId);
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  public async sendMessageWithFallback(message: string, context?: RequestContext): Promise<AIResponse> {
    if (!this.connected && this.config.enableMockMode) {
      if (import.meta.env.DEV) console.log('🔄 Using intelligent mock response');
      return this.getMockResponse(message);
    }
    return this.sendMessage(message, context);
  }

  public async startDiscovery(dataSourceId: string, options?: unknown): Promise<AIResponse> {
    const ctx: RequestContext = { priority: 'high', timeout: 60_000, retryable: true };
    if (!this.connected && this.config.enableMockMode) {
      return this.getMockDiscoveryResponse(dataSourceId, options);
    }
    return this.sendMessage(`Start discovery for data source: ${dataSourceId}`, ctx);
  }

  public async getDiscoveryStatus(sessionId: string): Promise<AIDiscoverySession | null> {
    if (!this.connected && this.config.enableMockMode) return this.getMockDiscoverySession(sessionId);
    try {
      const res = await this.requestWithRetry(() => this.api.get(`/discovery/${sessionId}`));
      return res.data.data as AIDiscoverySession;
    } catch (err) {
      console.error('Failed to get discovery status:', err);
      return null;
    }
  }

  public async generateQualityRules(fieldInfo: any): Promise<AIResponse> {
    if (!this.connected && this.config.enableMockMode) return this.getMockQualityRulesResponse(fieldInfo);
    try {
      const res = await this.requestWithRetry(() =>
        this.api.post('/discovery/quality-rules', { fieldInfo })
      );

      // Normalize if backend returns { rules: [...] }
      const normalized = this.normalizeBackendData(res.data?.data, `quality rules for ${fieldInfo?.name ?? 'field'}`);

      return { success: true, data: normalized, meta: res.data.meta };
    } catch (err) {
      return this.handleUnknownError(err);
    }
  }

  public async checkHealth(): Promise<unknown> {
    try {
      const res = await this.requestWithRetry(() => this.api.get(HEALTH_PATH), { skipRetry: true });
      return res.data;
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'cwic-ai-service',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        mode: 'fallback',
        error: (error as Error).message,
      };
    }
  }

  public cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  public cancelAllRequests(): void {
    for (const controller of this.activeRequests.values()) controller.abort();
    this.activeRequests.clear();
  }

  public getMetrics(): ConnectionMetrics {
    return { ...this.metrics, uptime: Date.now() - this.metrics.uptime };
  }

  /* ---------- error & utils ---------- */
  private handleSpecificErrors(error: AxiosError): void {
    const status = error.response?.status;
    const code = (error as any).code;

    if (status === 401) return this.handleUnauthorized();
    if (status === 429) return this.handleRateLimit(error);
    if (status === 503) return this.handleServiceUnavailable();

    if (code === 'ECONNABORTED') this.handleTimeout();
    else if (code === 'ERR_NETWORK' || code === 'NETWORK_ERROR') this.handleNetworkError();
  }

  private createEnhancedError(axiosError: AxiosError): AIServiceError {
    const status = axiosError.response?.status;
    const data = axiosError.response?.data as any;

    if (status === 401) return new AuthenticationError(data?.message || 'Authentication required');
    if ((axiosError as any).code === 'ECONNABORTED') return new TimeoutError(data?.message || 'Request timed out');
    if (!axiosError.response) return new NetworkError('Unable to connect to AI service');

    const message = data?.error?.message || data?.message || axiosError.message;
    const code = data?.error?.code || `HTTP_${status}`;
    const retryable = status ? status >= 500 || status === 429 : true;

    return new AIServiceError(code, message, retryable, {
      status,
      originalError: axiosError.message,
      response: data,
    });
  }

  private handleUnauthorized(): void {
    this.clearAuthTokens();
    if (isBrowser) {
      window.dispatchEvent(new CustomEvent('ai-service-auth-required'));
      if (!import.meta.env.DEV && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
  }

  private handleRateLimit(error: AxiosError): void {
    const retryAfter = (error.response?.headers as any)?.['retry-after'];
    const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000;
    console.warn(`⏰ Rate limit exceeded. Retry after ${delay}ms`);
    if (isBrowser) {
      window.dispatchEvent(
        new CustomEvent('ai-service-rate-limited', { detail: { retryAfter: delay } })
      );
    }
  }

  private handleServiceUnavailable(): void {
    this.connected = false;
    console.warn('🚫 AI Service temporarily unavailable');
  }
  private handleTimeout(): void { console.warn('⏱️ AI Service request timed out'); }
  private handleNetworkError(): void { this.connected = false; console.warn('🌐 Network error connecting to AI service'); }

  private updateAverageResponseTime(newTime: number): void {
    const n = this.metrics.successfulRequests;
    this.metrics.averageResponseTime =
      n <= 1 ? newTime : ((this.metrics.averageResponseTime * (n - 1)) + newTime) / n;
  }

  private getCachedResponse(key: string): AIResponse | null {
    const entry = this.responseCache.get(key);
    if (entry && Date.now() - entry.timestamp < this.config.cacheDuration) return entry.response;
    return null;
  }
  private setCachedResponse(key: string, response: AIResponse): void {
    this.responseCache.set(key, { response, timestamp: Date.now() });
    if (this.responseCache.size > this.MAX_CACHE_SIZE) {
      const oldest = [...this.responseCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
      this.responseCache.delete(oldest[0][0]);
    }
  }

  private handleUnknownError(error: unknown, requestId?: string): AIResponse {
    const aiError =
      error instanceof AIServiceError
        ? error
        : (error as AxiosError)?.isAxiosError
        ? this.createEnhancedError(error as AxiosError)
        : new AIServiceError(
            'UNKNOWN_ERROR',
            (error as Error)?.message || 'An unexpected error occurred',
            false,
            error
          );

    return {
      success: false,
      error: {
        code: aiError.code,
        message: aiError.message,
        details: import.meta.env.DEV ? aiError.details : undefined,
        retryable: aiError.retryable,
      },
      meta: {
        processingTime: 0,
        model: 'error',
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
  private getAuthToken(): string | null {
    try {
      return (
        localStorage.getItem('authToken') ||
        sessionStorage.getItem('authToken') ||
        null
      );
    } catch {
      return null;
    }
  }
  private clearAuthTokens(): void {
    try { localStorage.removeItem('authToken'); sessionStorage.removeItem('authToken'); } catch {}
  }
  private getUserContext(): any {
    try { const s = localStorage.getItem('user') || sessionStorage.getItem('user'); return s ? JSON.parse(s) : null; } catch { return null; }
  }
  private sanitizeHeaders(headers: any): any {
    const h = { ...(headers || {}) };
    if (h.Authorization) h.Authorization = 'Bearer [REDACTED]';
    if (h.authorization) h.authorization = 'Bearer [REDACTED]';
    return h;
  }

  /* ---------- mocks ---------- */
  private getMockResponse(query: string): AIResponse {
    const lower = query.toLowerCase();
    const requestId = this.generateRequestId();

    const base = {
      success: true as const,
      meta: {
        processingTime: Math.floor(Math.random() * 500 + 100),
        model: 'cwic-ai-mock',
        requestId,
        timestamp: new Date().toISOString(),
        confidence: 0.9 + Math.random() * 0.1,
      },
    };

    if (/\b(hi|hello|hey)\b/.test(lower)) {
      return {
        ...base,
        data: {
          message:
            "Hello! I'm your CWIC AI Assistant. I can help with data discovery, quality analysis, pipeline management, and more. What would you like to explore?",
          type: 'text',
          suggestions: [
            'Show me all data sources',
            'Analyze data quality issues',
            'Find sensitive data fields',
            'Generate quality rules',
            'Check pipeline status',
          ],
        },
      };
    }

    if (lower.includes('data source')) {
      return {
        ...base,
        data: {
          message: 'Here are your connected data sources:',
          type: 'data',
          results: [
            { id: 'ds-001', name: 'Production Database', type: 'PostgreSQL', status: 'Connected', tables: 45, lastSync: '2 minutes ago', health: 'Excellent', volume: '2.3TB' },
            { id: 'ds-002', name: 'Analytics Warehouse', type: 'Snowflake', status: 'Connected', tables: 23, lastSync: '5 minutes ago', health: 'Good', volume: '850GB' },
            { id: 'ds-003', name: 'Customer CRM', type: 'MongoDB', status: 'Connected', collections: 12, lastSync: '1 minute ago', health: 'Excellent', volume: '124GB' },
          ],
          sources: ['Data Catalog Service'],
          actions: [
            { type: 'view_details', label: 'View Details', description: 'See detailed information about each data source' },
            { type: 'schedule_analysis', label: 'Schedule Analysis', description: 'Set up automated data quality monitoring' },
          ],
        },
      };
    }

    if (lower.includes('quality') || lower.includes('issue')) {
      return {
        ...base,
        data: {
          message: "Here's your comprehensive data quality analysis:",
          type: 'analysis',
          results: {
            summary: {
              overallScore: 87.3,
              criticalIssues: 5,
              warningIssues: 12,
              totalRecordsScanned: 1_234_567,
              lastAnalysis: '2 hours ago',
              trend: 'improving',
            },
            issues: [
              { id: 'q-001', type: 'Missing Values', table: 'customers', field: 'email', count: 234, severity: 'medium', impact: 'Customer communication issues', recommendation: 'Implement email validation at input' },
              { id: 'q-002', type: 'Format Inconsistency', table: 'orders', field: 'phone', count: 89, severity: 'low', impact: 'Contact data reliability', recommendation: 'Standardize phone number format' },
              { id: 'q-003', type: 'Duplicate Records', table: 'products', field: 'sku', count: 15, severity: 'high', impact: 'Inventory management errors', recommendation: 'Create unique constraint on SKU field' },
            ],
            recommendations: [
              'Implement data validation rules',
              'Set up automated quality monitoring',
              'Create data stewardship workflows',
            ],
          },
          sources: ['Quality Engine', 'Data Profiler'],
          actions: [
            { type: 'create_rule', label: 'Create Quality Rules', description: 'Generate automated quality rules' },
            { type: 'export_data', label: 'Export Report', description: 'Download detailed quality report' },
          ],
        },
      };
    }

    return {
      ...base,
      data: {
        message: `I understand you're asking about "${query}". Here's what I can help you with:

🔍 **Data Discovery** — Find and catalog data assets
📊 **Quality Analysis** — Identify and resolve data issues
🛡️ **Compliance** — Check for PII/PHI and regulatory compliance
🔄 **Pipeline Management** — Monitor data workflows
📋 **Documentation** — Auto-generate data documentation
⚡ **Natural Language** — Convert questions to insights

Try asking about "data sources", "quality issues", or "sensitive data".`,
        type: 'text',
        suggestions: [
          'Show me all data sources',
          'Analyze data quality issues',
          'Find sensitive data fields',
          'Generate quality rules',
          'Check pipeline status',
        ],
      },
    };
  }

  private getMockDiscoveryResponse(dataSourceId: string, _options?: unknown): AIResponse {
    return {
      success: true,
      data: {
        message: `Started discovery for data source "${dataSourceId}". I'll update you as phases complete.`,
        type: 'text',
        actions: [{ type: 'view_details', label: 'View Session', description: 'Open discovery session details' }],
      },
      meta: { processingTime: 100, model: 'cwic-ai-mock', timestamp: new Date().toISOString() },
    };
  }

  private getMockDiscoverySession(sessionId: string): AIDiscoverySession {
    const now = new Date();
    return {
      sessionId,
      status: 'running',
      progress: 42,
      phase: 'analysis',
      results: {
        tablesAnalyzed: 120,
        columnsFound: 1840,
        sensitiveDataFound: 18,
        qualityIssues: 34,
        complianceFlags: 7,
        recommendations: ['Mask PII columns', 'Add NOT NULL to customers.email'],
      },
      startedAt: new Date(now.getTime() - 5 * 60 * 1000),
      estimatedCompletion: new Date(now.getTime() + 7 * 60 * 1000),
    };
  }

  private getMockQualityRulesResponse(fieldInfo: any): AIResponse {
    return {
      success: true,
      data: {
        message: 'Proposed quality rules generated.',
        type: 'data',
        results: [
          { rule: 'NOT NULL', field: fieldInfo?.name, severity: 'high' },
          { rule: 'UNIQUE', field: fieldInfo?.name, severity: 'high' },
          { rule: 'FORMAT: email', field: fieldInfo?.name, severity: 'medium' },
        ],
        actions: [{ type: 'create_rule', label: 'Apply Rules', description: 'Create and enable these rules' }],
      },
      meta: { processingTime: 120, model: 'cwic-ai-mock', timestamp: new Date().toISOString() },
    };
  }
}

/* =========================
   Exports
   ========================= */
export const aiAssistantService = new AIAssistantService();
export default aiAssistantService;


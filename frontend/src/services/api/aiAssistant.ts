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
  maxRetries: number;
  retryDelay: number;
  enableMockMode: boolean;
  cacheDuration: number;
  enableLogging: boolean;
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
  uptime: number;
}

/* =========================
   Errors
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
   Configuration
   ========================= */
const DEFAULT_CONFIG: AIServiceConfig = {
  baseURL: '/api/ai',
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  enableMockMode: false,
  cacheDuration: 300000,
  enableLogging: false,
};

const HEALTH_PATH = '/health';
const CONNECTION_CHECK_INTERVAL = 30000;
const MAX_CACHE_SIZE = 100;

/* =========================
   Utilities
   ========================= */
const isProduction = import.meta.env.PROD;
const isDevelopment = import.meta.env.DEV;
const isBrowser = typeof window !== 'undefined';

function generateRequestId(): string {
  if (isBrowser && crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function sanitizeHeaders(headers: any): any {
  if (!headers) return {};
  const sanitized = { ...headers };
  if (sanitized.Authorization) sanitized.Authorization = 'Bearer [REDACTED]';
  if (sanitized.authorization) sanitized.authorization = 'Bearer [REDACTED]';
  return sanitized;
}

function getAuthToken(): string | null {
  if (!isBrowser) return null;
  try {
    return localStorage.getItem('authToken') || 
           sessionStorage.getItem('authToken') || 
           localStorage.getItem('access_token') ||
           sessionStorage.getItem('access_token') ||
           null;
  } catch {
    return null;
  }
}

function getUserContext(): any {
  if (!isBrowser) return null;
  try {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

/* =========================
   Service
   ========================= */
class AIAssistantService {
  private readonly api: ReturnType<typeof axios.create>;
  private readonly config: AIServiceConfig;

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

  private readonly responseCache = new Map<string, { response: AIResponse; timestamp: number }>();
  private readonly activeRequests = new Map<string, AbortController>();
  private readonly requestMeta = new WeakMap<AxiosRequestConfig, { requestId: string; startTime: number }>();

  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(config?: Partial<AIServiceConfig>) {
    // Resolve base URL with production-safe defaults
    const baseURL = this.resolveBaseURL(config?.baseURL);
    
    this.config = {
      ...DEFAULT_CONFIG,
      baseURL,
      enableMockMode: this.shouldEnableMockMode(config?.enableMockMode),
      enableLogging: this.shouldEnableLogging(config?.enableLogging),
      ...config,
    };

    this.api = this.createAxiosInstance();
    
    // Initialize connection check and cleanup
    void this.checkConnection();
    this.startPeriodicCleanup();
  }

  private resolveBaseURL(configURL?: string): string {
    if (configURL) return configURL;

    // Check environment variables
    const envURL = import.meta.env?.VITE_AI_SERVICE_URL || 
                   import.meta.env?.VITE_AI_API_URL ||
                   import.meta.env?.VITE_API_BASE;

    if (envURL) {
      // Ensure it's a proper URL for production
      if (isProduction && !envURL.startsWith('http')) {
        console.warn('[AI Service] Production environment detected but relative URL provided. This may cause issues.');
      }
      return envURL;
    }

    // Development fallback
    return isDevelopment ? '/api/ai' : '/api/ai';
  }

  private shouldEnableMockMode(configValue?: boolean): boolean {
    if (configValue !== undefined) return configValue;

    // Only enable mock mode when explicitly enabled
    return import.meta.env?.VITE_ENABLE_MOCK_MODE === 'true';
  }

  private shouldEnableLogging(configValue?: boolean): boolean {
    if (configValue !== undefined) return configValue;
    
    // Enable logging in development or when explicitly enabled
    return isDevelopment || import.meta.env?.VITE_DEBUG_AI_SERVICE === 'true';
  }

  private createAxiosInstance(): ReturnType<typeof axios.create> {
    const instance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Version': import.meta.env?.VITE_APP_VERSION || '1.0.0',
        'X-Client-Type': 'web',
        'X-Platform': 'cwic-frontend',
      },
    });

    this.setupRequestInterceptor(instance);
    this.setupResponseInterceptor(instance);

    return instance;
  }

  private setupRequestInterceptor(instance: ReturnType<typeof axios.create>): void {
    instance.interceptors.request.use(
      (config) => {
        if (!config) {
          throw new AIServiceError('REQUEST_CONFIG_ERROR', 'Invalid request configuration');
        }

        // Generate request ID and store metadata
        const requestId = generateRequestId();
        const startTime = Date.now();
        
        config.headers = config.headers || {};
        config.headers['X-Request-ID'] = requestId;
        
        this.requestMeta.set(config, { requestId, startTime });

        // Add authentication if available (but not for gateway requests in dev)
        const isGatewayRequest = this.config.baseURL.startsWith('/api/');
        if (!isGatewayRequest || isProduction) {
          const token = getAuthToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }

        // Add user context
        const userContext = getUserContext();
        if (userContext) {
          config.headers['X-User-Context'] = JSON.stringify(userContext);
        }

        this.metrics.totalRequests++;

        if (this.config.enableLogging) {
          console.log(`[AI Service] ${config.method?.toUpperCase()} ${config.url}`, {
            requestId,
            headers: sanitizeHeaders(config.headers),
            baseURL: this.config.baseURL,
          });
        }

        return config;
      },
      (error: AxiosError) => {
        this.metrics.failedRequests++;
        console.error('[AI Service] Request interceptor error:', error.message);
        return Promise.reject(new AIServiceError('REQUEST_SETUP_ERROR', error.message, false, error));
      }
    );
  }

  private setupResponseInterceptor(instance: ReturnType<typeof axios.create>): void {
    instance.interceptors.response.use(
      (response: AxiosResponse) => {
        const meta = this.requestMeta.get(response.config);
        const processingTime = meta ? Date.now() - meta.startTime : 0;

        this.metrics.successfulRequests++;
        this.updateAverageResponseTime(processingTime);

        if (this.config.enableLogging) {
          console.log(`[AI Service] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            processingTime: `${processingTime}ms`,
            requestId: meta?.requestId,
          });
        }

        return response;
      },
      (error: AxiosError) => {
        const meta = error.config ? this.requestMeta.get(error.config) : undefined;
        const processingTime = meta ? Date.now() - meta.startTime : 0;

        this.metrics.failedRequests++;
        this.metrics.lastError = error.message;

        if (this.config.enableLogging) {
          console.error('[AI Service] Request failed:', {
            message: error.message,
            status: error.response?.status,
            processingTime: `${processingTime}ms`,
            requestId: meta?.requestId,
            url: error.config?.url,
          });
        }

        this.handleSpecificErrors(error);
        return Promise.reject(this.createEnhancedError(error));
      }
    );
  }

  private async checkConnection(): Promise<void> {
    const now = Date.now();
    if (now - this.lastConnectionCheck < CONNECTION_CHECK_INTERVAL) return;
    
    this.lastConnectionCheck = now;

    try {
      await this.requestWithRetry(
        () => this.api.get(HEALTH_PATH, { 
          timeout: 5000,
          headers: { 'X-Health-Check': 'true' }
        }),
        { skipRetry: true }
      );

      this.connected = true;
      this.connectionAttempts = 0;
      
      if (this.config.enableLogging) {
        console.log('[AI Service] Connection check successful');
      }
    } catch (error) {
      this.connected = false;
      this.connectionAttempts++;
      
      if (this.config.enableLogging) {
        console.warn(`[AI Service] Connection check failed (attempt ${this.connectionAttempts}):`, (error as Error).message);
      }
    }
  }

  private async requestWithRetry<T>(
    fn: () => Promise<T>, 
    options: { skipRetry?: boolean } = {}
  ): Promise<T> {
    if (options.skipRetry) return fn();

    const maxRetries = this.config.maxRetries;
    const baseDelay = this.config.retryDelay;

    let lastError: unknown;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const error = err as AxiosError;
        const status = error.response?.status;
        const code = (error as any).code;

        // Don't retry on certain errors
        const isAuthError = status === 401 || status === 403;
        const isValidationError = status === 422;
        const isClientError = status && status >= 400 && status < 500 && !isAuthError;
        
        if (attempt === maxRetries || isAuthError || isValidationError || isClientError) {
          lastError = error;
          break;
        }

        // Calculate exponential backoff with jitter
        const jitter = Math.floor(Math.random() * 250);
        const delay = baseDelay * Math.pow(2, attempt) + jitter;
        
        if (this.config.enableLogging) {
          console.warn(`[AI Service] Retrying request (${attempt + 1}/${maxRetries}) in ${delay}ms`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  private startPeriodicCleanup(): void {
    this.stopPeriodicCleanup();

    this.cleanupTimer = setInterval(() => {
      try {
        this.cleanupCache();
        this.cleanupActiveRequests();
      } catch (err) {
        if (this.config.enableLogging) {
          console.warn('[AI Service] Periodic cleanup error:', err);
        }
      }
    }, 300000); // 5 minutes

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
    const expired: string[] = [];

    for (const [key, { timestamp }] of this.responseCache) {
      if (now - timestamp > this.config.cacheDuration) {
        expired.push(key);
      }
    }

    expired.forEach(key => this.responseCache.delete(key));

    // Remove excess entries
    if (this.responseCache.size > MAX_CACHE_SIZE) {
      const entries = [...this.responseCache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const excess = this.responseCache.size - MAX_CACHE_SIZE;
      for (let i = 0; i < excess; i++) {
        this.responseCache.delete(entries[i][0]);
      }
    }
  }

  private cleanupActiveRequests(): void {
    for (const [id, controller] of this.activeRequests) {
      if (controller.signal.aborted) {
        this.activeRequests.delete(id);
      }
    }
  }

  private handleSpecificErrors(error: AxiosError): void {
    const status = error.response?.status;
    const code = (error as any).code;

    if (status === 401) {
      this.handleUnauthorized();
    } else if (status === 429) {
      this.handleRateLimit(error);
    } else if (status === 503) {
      this.handleServiceUnavailable();
    } else if (code === 'ECONNABORTED') {
      this.handleTimeout();
    } else if (code === 'ERR_NETWORK' || code === 'NETWORK_ERROR') {
      this.handleNetworkError();
    }
  }

  private createEnhancedError(axiosError: AxiosError): AIServiceError {
    const status = axiosError.response?.status;
    const data = axiosError.response?.data as any;

    if (status === 401) {
      return new AuthenticationError(data?.message || 'Authentication required');
    }
    
    if ((axiosError as any).code === 'ECONNABORTED') {
      return new TimeoutError(data?.message || 'Request timed out');
    }
    
    if (!axiosError.response) {
      return new NetworkError('Unable to connect to AI service');
    }

    const message = data?.error?.message || data?.message || axiosError.message;
    const code = data?.error?.code || `HTTP_${status}`;
    const retryable = status ? status >= 500 || status === 429 : true;

    return new AIServiceError(code, message, retryable, {
      status,
      originalError: axiosError.message,
      response: isProduction ? undefined : data,
    });
  }

  private handleUnauthorized(): void {
    if (isBrowser) {
      try {
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('authToken');
        localStorage.removeItem('access_token');
        sessionStorage.removeItem('access_token');
      } catch {
        // Ignore storage errors
      }

      // Emit custom event for app to handle
      window.dispatchEvent(new CustomEvent('ai-service-auth-required'));
    }
  }

  private handleRateLimit(error: AxiosError): void {
    const retryAfter = (error.response?.headers as any)?.['retry-after'];
    const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
    
    if (this.config.enableLogging) {
      console.warn(`[AI Service] Rate limited. Retry after ${delay}ms`);
    }
    
    if (isBrowser) {
      window.dispatchEvent(
        new CustomEvent('ai-service-rate-limited', { detail: { retryAfter: delay } })
      );
    }
  }

  private handleServiceUnavailable(): void {
    this.connected = false;
    if (this.config.enableLogging) {
      console.warn('[AI Service] Service temporarily unavailable');
    }
  }

  private handleTimeout(): void {
    if (this.config.enableLogging) {
      console.warn('[AI Service] Request timed out');
    }
  }

  private handleNetworkError(): void {
    this.connected = false;
    if (this.config.enableLogging) {
      console.warn('[AI Service] Network error detected');
    }
  }

  private updateAverageResponseTime(newTime: number): void {
    const n = this.metrics.successfulRequests;
    if (n <= 1) {
      this.metrics.averageResponseTime = newTime;
    } else {
      this.metrics.averageResponseTime = 
        ((this.metrics.averageResponseTime * (n - 1)) + newTime) / n;
    }
  }

  private getCachedResponse(key: string): AIResponse | null {
    const entry = this.responseCache.get(key);
    if (entry && Date.now() - entry.timestamp < this.config.cacheDuration) {
      return entry.response;
    }
    this.responseCache.delete(key);
    return null;
  }

  private setCachedResponse(key: string, response: AIResponse): void {
    this.responseCache.set(key, { 
      response, 
      timestamp: Date.now() 
    });
  }

  /* =========================
   Public API
   ========================= */
  public isConnected(): boolean {
    return this.connected;
  }

  public getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (this.connectionAttempts > 0 && !this.connected) return 'connecting';
    return this.connected ? 'connected' : 'disconnected';
  }

  public getMetrics(): ConnectionMetrics {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.uptime
    };
  }

  public async sendMessage(message: string, context?: RequestContext): Promise<AIResponse> {
    if (!message?.trim()) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Message cannot be empty',
          retryable: false
        }
      };
    }

    const requestId = context?.requestId || generateRequestId();

    // Check cache first
    if (context?.cacheKey) {
      const cached = this.getCachedResponse(context.cacheKey);
      if (cached) return cached;
    }

    // Use mock response if not connected and mock mode enabled
    if (!this.connected && this.config.enableMockMode) {
      if (this.config.enableLogging) {
        console.log('[AI Service] Using mock response (service unavailable)');
      }
      return this.getMockResponse(message);
    }

    // Check connection
    await this.checkConnection();

    try {
      const abortController = new AbortController();
      this.activeRequests.set(requestId, abortController);

      const startTime = performance.now?.() ?? Date.now();

      const response = await this.requestWithRetry(() =>
        this.api.post('/discovery/enhanced-query', {
          query: message,
          sessionId: (context as any)?.sessionId,
          includeContext: true,
          preferences: {
            detailLevel: 'detailed',
            includeCode: true,
            includeRecommendations: true,
          },
        }, {
          timeout: context?.timeout || this.config.timeout,
          signal: abortController.signal,
        })
      );

      const processingTime = Math.round((performance.now?.() ?? Date.now()) - startTime);

      const aiResponse: AIResponse = {
        success: true,
        data: this.normalizeResponseData(response.data?.data, message),
        meta: {
          processingTime,
          model: response.data?.meta?.model || 'enhanced-ai',
          requestId,
          timestamp: new Date().toISOString(),
          ...response.data?.meta,
        },
      };

      // Cache successful response
      if (context?.cacheKey) {
        this.setCachedResponse(context.cacheKey, aiResponse);
      }

      return aiResponse;

    } catch (error) {
      return this.handleRequestError(error, requestId);
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Send message with fallback to basic query if enhanced fails
   */
  public async sendMessageWithFallback(message: string, context?: RequestContext): Promise<AIResponse> {
    try {
      return await this.sendMessage(message, context);
    } catch (error) {
      // Fallback to basic query endpoint
      if (this.config.enableLogging) {
        console.warn('[AI Service] Enhanced query failed, trying basic query');
      }

      try {
        const abortController = new AbortController();
        const requestId = context?.requestId || generateRequestId();
        this.activeRequests.set(requestId, abortController);

        const response = await this.requestWithRetry(() =>
          this.api.post('/discovery/query', {
            query: message,
            context: {
              timestamp: new Date().toISOString(),
              clientType: 'web',
            },
          }, {
            timeout: context?.timeout || this.config.timeout,
            signal: abortController.signal,
          })
        );

        return {
          success: true,
          data: this.normalizeResponseData(response.data?.data, message),
          meta: {
            processingTime: 0,
            model: 'basic-query',
            requestId,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (fallbackError) {
        return this.handleRequestError(fallbackError, context?.requestId);
      }
    }
  }

  private normalizeResponseData(rawData: any, originalQuery?: string): AIResponse['data'] {
    if (!rawData) {
      return {
        message: 'No response received from AI service.',
        type: 'text'
      };
    }

    // If already normalized
    if (rawData.type && rawData.message) {
      return rawData as AIResponse['data'];
    }

    // Handle different response types
    if (rawData.sql && rawData.explanation) {
      return {
        message: "Here's the generated SQL query:",
        type: 'query',
        results: {
          sql: rawData.sql,
          explanation: rawData.explanation,
          tables: rawData.tables,
          fields: rawData.fields,
          confidence: rawData.confidence,
          warnings: rawData.warnings,
        },
        actions: [{
          type: 'view_details',
          label: 'Copy SQL',
          payload: { sql: rawData.sql, query: originalQuery }
        }],
      };
    }

    if (rawData.analysis && rawData.qualityIssues) {
      return {
        message: "Data quality analysis complete:",
        type: 'analysis',
        results: rawData,
        actions: [{
          type: 'create_rule',
          label: 'Create Quality Rules',
          payload: { issues: rawData.qualityIssues }
        }],
      };
    }

    // Fallback for unknown formats
    if (typeof rawData === 'string') {
      return { message: rawData, type: 'text' };
    }

    return {
      message: 'Analysis complete.',
      type: 'data',
      results: rawData
    };
  }

  private handleRequestError(error: unknown, requestId?: string): AIResponse {
    const aiError = error instanceof AIServiceError
      ? error
      : (error as AxiosError)?.isAxiosError
        ? this.createEnhancedError(error as AxiosError)
        : new AIServiceError(
            'UNKNOWN_ERROR',
            (error as Error)?.message || 'An unexpected error occurred',
            false,
            isProduction ? undefined : error
          );

    return {
      success: false,
      error: {
        code: aiError.code,
        message: aiError.message,
        details: isProduction ? undefined : aiError.details,
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

  private getMockResponse(query: string): AIResponse {
    const requestId = generateRequestId();
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) {
      return {
        success: true,
        data: {
          message: "Hello! I'm your AI assistant. I can help with data discovery, quality analysis, and more.",
          type: 'text',
          suggestions: [
            'Show me data sources',
            'Analyze data quality',
            'Find sensitive data',
          ]
        },
        meta: {
          processingTime: 100,
          model: 'mock',
          requestId,
          timestamp: new Date().toISOString(),
        }
      };
    }

    return {
      success: true,
      data: {
        message: `I understand you're asking about "${query}". This is a mock response since the AI service is not available.`,
        type: 'text',
        suggestions: ['Try again when service is available']
      },
      meta: {
        processingTime: 100,
        model: 'mock',
        requestId,
        timestamp: new Date().toISOString(),
      }
    };
  }

  public cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller && !controller.signal.aborted) {
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  public cancelAllRequests(): void {
    for (const controller of this.activeRequests.values()) {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    }
    this.activeRequests.clear();
  }

  public destroy(): void {
    this.stopPeriodicCleanup();
    this.cancelAllRequests();
    this.responseCache.clear();
    this.connected = false;
  }
}

/* =========================
   Singleton Export
   ========================= */
export const aiAssistantService = new AIAssistantService();
export default aiAssistantService;

// Named exports for flexibility
export { AIAssistantService, AIServiceError, AuthenticationError, NetworkError, TimeoutError };

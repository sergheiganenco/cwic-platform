export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta?: Record<string, any>;
}

export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta?: Record<string, any>;
}

export interface ApiError {
  status: number;       // HTTP status
  code: string;         // e.g. NOT_FOUND, VALIDATION_ERROR, RATE_LIMIT_EXCEEDED
  message: string;
  requestId?: string;
  retryAfter?: string;
  details?: unknown;
}

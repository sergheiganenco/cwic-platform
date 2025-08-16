export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
    version: string;
  };
}

export const successResponse = <T>(
  data: T,
  message = 'Success',
  pagination?: any
): ApiResponse<T> => {
  return {
    success: true,
    data,
    message,
    ...(pagination && { pagination }),
    meta: {
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0'
    }
  };
};

export const errorResponse = (
  message: string,
  code = 500,
  details?: any
): ApiResponse => {
  return {
    success: false,
    message,
    ...(details && { data: details }),
    meta: {
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0'
    }
  };
};

export const paginatedResponse = <T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message = 'Success'
): ApiResponse<T[]> => {
  return {
    success: true,
    data,
    message,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0'
    }
  };
};
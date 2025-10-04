// Performance optimization utilities

/**
 * Debounce a function to limit how often it can be called
 * @param func The function to debounce
 * @param wait The number of milliseconds to wait
 * @returns The debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

/**
 * Throttle a function to limit how often it can be called
 * @param func The function to throttle
 * @param limit The time limit in milliseconds
 * @returns The throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function throttled(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Create a simple in-memory cache with TTL
 */
export class MemoryCache<K, V> {
  private cache = new Map<K, { value: V; expiry: number }>();
  private defaultTTL: number;

  constructor(defaultTTL = 60000) { // Default 1 minute
    this.defaultTTL = defaultTTL;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  set(key: K, value: V, ttl?: number): void {
    const expiry = Date.now() + (ttl ?? this.defaultTTL);
    this.cache.set(key, { value, expiry });
  }

  has(key: K): boolean {
    const value = this.get(key);
    return value !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }
}

/**
 * Create a cached version of an async function
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  func: T,
  getCacheKey: (...args: Parameters<T>) => string,
  ttl = 60000 // 1 minute default
): T {
  const cache = new MemoryCache<string, any>(ttl);

  return (async (...args: Parameters<T>) => {
    const key = getCacheKey(...args);

    // Check cache first
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Call the function and cache result
    const result = await func(...args);
    cache.set(key, result, ttl);
    return result;
  }) as T;
}

/**
 * Batch multiple requests into a single execution
 */
export class RequestBatcher<T> {
  private queue: Array<{ resolve: (value: T) => void; reject: (error: any) => void }> = [];
  private timeout: NodeJS.Timeout | null = null;
  private batchDelay: number;
  private batchExecutor: () => Promise<T>;

  constructor(batchExecutor: () => Promise<T>, batchDelay = 50) {
    this.batchExecutor = batchExecutor;
    this.batchDelay = batchDelay;
  }

  async request(): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ resolve, reject });

      if (!this.timeout) {
        this.timeout = setTimeout(() => this.executeBatch(), this.batchDelay);
      }
    });
  }

  private async executeBatch() {
    const batch = [...this.queue];
    this.queue = [];
    this.timeout = null;

    try {
      const result = await this.batchExecutor();
      batch.forEach(({ resolve }) => resolve(result));
    } catch (error) {
      batch.forEach(({ reject }) => reject(error));
    }
  }
}
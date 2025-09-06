// src/services/auth/tokenManager.ts
type Decoded = { exp?: number; [k: string]: unknown };

// minimal base64url decode (no external dep)
function decodeJwt(token: string): Decoded | null {
  try {
    const [, payload] = token.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch { return null; }
}

export class TokenManager {
  private accessToken: string | null = null;
  private accessExp = 0; // epoch seconds
  private refreshPromise: Promise<string | null> | null = null;
  private readonly earlyRefreshSec = 60; // refresh 60s before expiry
  private readonly storageKey = 'auth.access';

  constructor(private readonly refreshEndpoint = '/api/auth/refresh') {
    // optional: restore across reloads
    const saved = localStorage.getItem(this.storageKey);
    if (saved) this.setAccessToken(saved);
  }

  get token(): string | null { return this.accessToken; }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (!token) {
      this.accessExp = 0;
      localStorage.removeItem(this.storageKey);
      return;
    }
    const dec = decodeJwt(token);
    this.accessExp = typeof dec?.exp === 'number' ? dec.exp : 0;
    localStorage.setItem(this.storageKey, token);
  }

  // true if token expires within earlyRefreshSec
  private isStale(): boolean {
    if (!this.accessToken || !this.accessExp) return true;
    const now = Math.floor(Date.now() / 1000);
    return now >= (this.accessExp - this.earlyRefreshSec);
  }

  /** Ensures we have a fresh access token; returns null if refresh failed */
  async ensureFresh(): Promise<string | null> {
    if (!this.isStale()) return this.accessToken;

    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh().finally(() => { this.refreshPromise = null; });
    }
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<string | null> {
    try {
      // If you use cookie-based refresh, withCredentials must be true.
      const res = await fetch(this.refreshEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);

      // Expect JSON: { accessToken: string }
      const data = await res.json();
      if (typeof data?.accessToken !== 'string') throw new Error('Malformed refresh payload');
      this.setAccessToken(data.accessToken);
      return data.accessToken;
    } catch (e) {
      this.setAccessToken(null);
      return null;
    }
  }
}

export const tokenManager = new TokenManager('/api/auth/refresh');

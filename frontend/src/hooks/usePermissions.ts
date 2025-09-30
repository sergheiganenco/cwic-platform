// src/hooks/usePermissions.ts
import { api, ApiError } from '@/utils/apiUtils';
import { useCallback, useEffect, useRef, useState } from 'react';

type Role = 'admin' | 'editor' | 'viewer' | 'guest' | string;

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: string[];
  accessible_data_sources?: string[];
}

type State = {
  user: User | null;
  permissions: string[];
  isLoading: boolean;
  error: string | null;
};

const DEV_USER: User = {
  id: 'dev-user',
  email: 'developer@localhost',
  name: 'Development User',
  role: 'admin',
  permissions: ['*'],
  accessible_data_sources: [],
};

// Gateway-aligned endpoints (don’t add legacy fallbacks like /users/me)
const AUTH_ME_CANDIDATES = ['/api/auth/me'] as const;
const PERMS_CANDIDATES  = ['/api/user/permissions'] as const;

// Cache which concrete endpoint worked to avoid probing on every mount
const CACHE_AUTH_ME = 'cwic.permissions.auth_me.endpoint';
const CACHE_PERMS   = 'cwic.permissions.perms.endpoint';

function isDev() {
  return !!import.meta.env?.DEV;
}

/**
 * Probes a list of candidate endpoints and returns the first that responds 2xx.
 * Caches the winner in sessionStorage.
 */
async function probeFirstHealthy(
  candidates: readonly string[],
  cacheKey: string,
  signal?: AbortSignal,
): Promise<string> {
  const cached = sessionStorage.getItem(cacheKey);
  const toTry = cached ? [cached, ...candidates.filter(c => c !== cached)] : [...candidates];

  let lastErr: unknown = null;
  for (const p of toTry) {
    try {
      // Lightweight probe (we ignore response body; success==healthy)
      await api.get(p, undefined, signal);
      sessionStorage.setItem(cacheKey, p);
      return p;
    } catch (e) {
      lastErr = e;
      // 404 → try next; other errors might be transient so still try others
      if (e instanceof ApiError && e.status === 404) continue;
    }
  }
  throw lastErr ?? new Error(`No healthy endpoint among: ${candidates.join(', ')}`);
}

/**
 * Stable hook: never calls hooks conditionally, never early-returns before hook calls.
 * Keeps a constant hook order across renders.
 */
export function usePermissions() {
  // 1) Hooks: stable, always executed in the same order
  const [state, setState] = useState<State>({
    user: null,
    permissions: [],
    isLoading: true,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  // 2) Callbacks: stable identities (dependencies listed explicitly)
  const load = useCallback(async () => {
    // cancel any in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState(s => ({ ...s, isLoading: true, error: null }));

    try {
      // Probe & fetch user (best effort)
      let user: User | null = null;
      try {
        const authMeUrl = await probeFirstHealthy(AUTH_ME_CANDIDATES, CACHE_AUTH_ME, ctrl.signal);
        user = await api.get<User>(authMeUrl, undefined, ctrl.signal);
      } catch (e) {
        // user may be null in some environments; we still fetch permissions next
        if (isDev()) {
          // In dev, we’ll fall back after perms attempt fails too.
          // Don’t return here; proceed to perms so dev servers that only expose /user/permissions still work.
        }
      }

      // Probe & fetch permissions
      const permsUrl = await probeFirstHealthy(PERMS_CANDIDATES, CACHE_PERMS, ctrl.signal);
      const raw = await api.get<any>(permsUrl, undefined, ctrl.signal);
      const permissions: string[] = Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw)
          ? raw
          : (user?.permissions ?? []);

      setState({ user, permissions, isLoading: false, error: null });
    } catch (e: any) {
      if (ctrl.signal.aborted) return;

      if (isDev()) {
        // Dev fallback so local work isn’t blocked
        console.warn('[usePermissions] dev fallback:', e?.message || e);
        setState({ user: DEV_USER, permissions: DEV_USER.permissions, isLoading: false, error: null });
        return;
      }

      setState({
        user: null,
        permissions: [],
        isLoading: false,
        error: e?.message ?? 'Failed to load permissions',
      });
    }
  }, []);

  // 3) Effects: stable, no conditionals
  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  // 4) Derived helpers: stable, no conditionals
  const can = useCallback(
    (action: string, resource?: string) => {
      if (!state.user || state.isLoading) return false;
      if (state.user.role === 'admin' || state.permissions.includes('*')) return true;

      const need = resource ? `${action}:${resource}` : action;

      // wildcard-friendly match: supports patterns like "read:*" or "*:datasource"
      return state.permissions.some((p) => {
        const pa = p.split(':');
        const na = need.split(':');
        const len = Math.max(pa.length, na.length);
        for (let i = 0; i < len; i++) {
          const pv = (pa[i] ?? '').toLowerCase();
          const nv = (na[i] ?? '').toLowerCase();
          if (pv === '*' || nv === '*') continue;
          if (pv !== nv) return false;
        }
        return true;
      });
    },
    [state.user, state.isLoading, state.permissions],
  );

  // 5) Return shape: stable
  return {
    ...state,
    userRole: state.user?.role ?? 'guest',
    isAdmin: state.user?.role === 'admin',
    can,
    refresh: load,
  };
}

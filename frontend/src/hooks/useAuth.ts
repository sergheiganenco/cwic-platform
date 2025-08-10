import * as React from 'react'

type User = {
  id: string
  name: string
  email: string
  roles?: string[]
}

type AuthState = {
  user: User | null
  token: string | null
  loading: boolean
}

type LoginInput =
  | { email: string; password: string }
  | { username: string; password: string }

export type AuthContextValue = {
  user: User | null
  token: string | null
  loading: boolean
  isAuthenticated: boolean
  login: (input: LoginInput) => Promise<void>
  logout: () => void
  setUser: (u: User | null) => void
  refreshUser: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

const LS_USER = 'auth.user'
const LS_TOKEN = 'auth.token'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export function AuthProvider(props: { children?: React.ReactNode }): React.ReactElement {
  const [state, setState] = React.useState<AuthState>(() => {
    const token = localStorage.getItem(LS_TOKEN)
    const userRaw = localStorage.getItem(LS_USER)
    const user = userRaw ? (JSON.parse(userRaw) as User) : null
    return { user, token, loading: !!token && !user }
  })

  const persist = React.useCallback((user: User | null, token: string | null) => {
    if (user) localStorage.setItem(LS_USER, JSON.stringify(user))
    else localStorage.removeItem(LS_USER)

    if (token) localStorage.setItem(LS_TOKEN, token)
    else localStorage.removeItem(LS_TOKEN)
  }, [])

  const refreshUser = React.useCallback(async () => {
    if (!state.token) return
    try {
      setState((s) => ({ ...s, loading: true }))
      const me = await api<User>('/api/auth/me')
      setState((s) => ({ ...s, user: me, loading: false }))
      persist(me, state.token)
    } catch {
      setState({ user: null, token: null, loading: false })
      persist(null, null)
    }
  }, [state.token, persist])

  const login = React.useCallback(
    async (input: LoginInput) => {
      setState((s) => ({ ...s, loading: true }))
      const result = await api<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      persist(result.user, result.token)
      setState({ user: result.user, token: result.token, loading: false })
    },
    [persist],
  )

  const logout = React.useCallback(() => {
    // Optionally inform backend: void api('/api/auth/logout', { method: 'POST' }).catch(() => {})
    persist(null, null)
    setState({ user: null, token: null, loading: false })
  }, [persist])

  const setUser = React.useCallback(
    (u: User | null) => {
      setState((s) => ({ ...s, user: u }))
      persist(u, state.token)
    },
    [persist, state.token],
  )

  React.useEffect(() => {
    if (state.token && !state.user) {
      void refreshUser()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: AuthContextValue = React.useMemo(
    () => ({
      user: state.user,
      token: state.token,
      loading: state.loading,
      isAuthenticated: !!state.token && !!state.user,
      login,
      logout,
      setUser,
      refreshUser,
    }),
    [state.user, state.token, state.loading, login, logout, setUser, refreshUser],
  )

  // No JSX: return createElement
  return React.createElement(AuthContext.Provider, { value }, props.children)
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'

import ErrorBoundary from '@/components/common/ErrorBoundary'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { ToastProvider, Toaster } from '@/components/ui/Notification'
import { http } from '@/services/http'
import { AuthProvider } from '@hooks/useAuth'
import AppRouter from './routes/router'
import { store } from './store/store'

// ✅ existing global DB provider
import { DbProvider } from '@/store/dbContext'
// ✅ NEW: scope provider
import { DbScopeProvider } from '@/store/dbScope'

// styles …
import '@/styles/ai-assistant.css'
import '@/styles/components.css'
import '@/styles/globals.css'
import '@/styles/tailwind.css'
import '@/styles/utilities.css'

// dev auth bootstrap …
if (import.meta.env.DEV) {
  const devJwt = import.meta.env.VITE_DEV_JWT as string | undefined
  const hasToken = !!localStorage.getItem('authToken') || !!sessionStorage.getItem('authToken')
  if (devJwt && !hasToken) {
    localStorage.setItem('authToken', devJwt)
    sessionStorage.setItem('authToken', devJwt)
  }
}

console.log('[HTTP] baseURL =', http.defaults.baseURL)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: 600_000, refetchOnWindowFocus: false, retry: 2 },
    mutations: { retry: 1 },
  },
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <DbProvider>
        {/* ⬇️ mount the scope provider so any page can call useDbScope() */}
        <DbScopeProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <Toaster />
              <ErrorBoundary>
                <React.Suspense
                  fallback={
                    <div className="min-h-screen flex items-center justify-center bg-gray-50">
                      <LoadingSpinner label="Loading CWIC…" />
                    </div>
                  }
                >
                  <AuthProvider>
                    <AppRouter />
                  </AuthProvider>
                </React.Suspense>
              </ErrorBoundary>
              {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
            </ToastProvider>
          </QueryClientProvider>
        </DbScopeProvider>
      </DbProvider>
    </Provider>
  </React.StrictMode>,
)

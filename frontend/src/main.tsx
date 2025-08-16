// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'

import ErrorBoundary from '@/components/common/ErrorBoundary'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { ToastProvider, Toaster } from '@/components/ui/Notification'
import { AuthProvider } from '@hooks/useAuth'
import AppRouter from './routes/router'
import { store } from './store/store'

import '@/styles/globals.css'
import '@/styles/tailwind.css'

// ✅ DEV auth bootstrap: stash a token so Axios sends Authorization
if (import.meta.env.DEV && !localStorage.getItem('authToken')) {
  const devJwt = import.meta.env.VITE_DEV_JWT as string | undefined
  if (devJwt) {
    localStorage.setItem('authToken', devJwt)
    sessionStorage.setItem('authToken', devJwt)
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
    mutations: { retry: 1 },
  },
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
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
                {/* ⬇️ Router with v7 future flags */}
                <AppRouter />
              </AuthProvider>
            </React.Suspense>
          </ErrorBoundary>
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </ToastProvider>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>,
)

// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'

import ErrorBoundary from '@/components/common/ErrorBoundary'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { ToastProvider, Toaster } from '@/components/ui/Notification'
import { AuthProvider } from '@hooks/useAuth'
import App from './App'
import { store } from './store/store'

import '@/styles/globals.css'
import '@/styles/tailwind.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,  // if you’re on React Query v4, change to cacheTime
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
        <BrowserRouter>
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
                {/* ✅ Provide auth context to the whole app */}
                <AuthProvider>
                  <App />
                </AuthProvider>
              </React.Suspense>
            </ErrorBoundary>
            {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>,
)

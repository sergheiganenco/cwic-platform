// src/router/router.tsx
import App from '@/App'; // or ../App
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

const router = createBrowserRouter([{ path: '/*', element: <App /> }])

export default function AppRouter() {
  return <RouterProvider router={router} />
}

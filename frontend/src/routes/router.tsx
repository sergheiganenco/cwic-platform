import AppLayout from '@/layouts/AppLayout';
import * as React from 'react';
import {
  createBrowserRouter,
  isRouteErrorResponse,
  Navigate,
  RouterProvider,
  useRouteError,
  type RouteObject,
} from 'react-router-dom';

// ---------- Lazy loader ----------
type PageModule = { default: React.ComponentType<any> };
const pageModules = import.meta.glob<PageModule>('/src/pages/**/*.{tsx,jsx}');

function lazyPage(name: string) {
  const tryFiles = (n: string) => [
    `/src/pages/${n}.tsx`,
    `/src/pages/${n}.jsx`,
    `/src/pages/${n}/index.tsx`,
    `/src/pages/${n}/index.jsx`,
    `/src/pages/${n}.page.tsx`,
    `/src/pages/${n}.page.jsx`,
  ];
  const key =
    [...tryFiles(name), ...tryFiles(name.toLowerCase())].find((k) => k in pageModules) ?? null;

  const loader: () => Promise<PageModule> = key
    ? (pageModules[key] as () => Promise<PageModule>)
    : () =>
        Promise.resolve({
          default: () => (
            <div className="p-6">
              <h1 className="text-lg font-semibold">{name}</h1>
              <p className="text-gray-600">
                Placeholder page — no module found for <code>{name}</code>.
              </p>
            </div>
          ),
        });

  return React.lazy(loader);
}

// ---------- Pages ----------
const Dashboard     = lazyPage('Dashboard');
const Assistant     = lazyPage('AIAssistant');
const Analytics     = lazyPage('Analytics');
const Reports       = lazyPage('Reports');
const FieldDiscovery = lazyPage('FieldDiscovery');
const Classification = lazyPage('Classification');
const Compliance    = lazyPage('Compliance');
const AuditLogs     = lazyPage('Audit');
const Integrations  = lazyPage('Integrations');
const DataCatalog   = lazyPage('DataCatalog');
const DataQuality   = lazyPage('DataQuality');
const DataLineage   = lazyPage('DataLineage');
const CICDPipelines = lazyPage('Pipelines');
const Requests      = lazyPage('Requests');
const DataSources   = lazyPage('DataSources');
const Governance    = lazyPage('Governance');
const Monitoring    = lazyPage('Monitoring');
const Settings      = lazyPage('Settings');
const PIISettings   = lazyPage('PIISettings');
const Users         = lazyPage('Users');
const NotFound      = lazyPage('NotFound');

// ---------- Route error boundary ----------
function RouteErrorBoundary() {
  const error = useRouteError();
  const isDev = !!import.meta.env?.DEV;

  let heading = 'Something went wrong';
  let details: string | undefined;

  if (isRouteErrorResponse(error)) {
    heading = `${error.status} ${error.statusText}`;
    details = (error.data as any)?.message ?? undefined;
  } else if (error instanceof Error) {
    details = error.message;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-xl w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">{heading}</h1>
        {isDev && details && (
          <pre className="text-sm text-red-700 bg-red-50 border border-red-100 p-3 rounded overflow-auto">
            {details}
          </pre>
        )}
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-4 py-2 rounded-md bg-sky-600 text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

// ---------- Suspense wrapper ----------
function withSuspense(node: React.ReactNode) {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center text-sm text-gray-700">
          <div className="inline-block rounded border bg-white px-3 py-2 shadow">Loading…</div>
        </div>
      }
    >
      {node}
    </React.Suspense>
  );
}

// ---------- Routes (no auth gate) ----------
const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard',       element: withSuspense(<Dashboard />) },
      { path: 'assistant',       element: withSuspense(<Assistant />) },
      { path: 'ai-assistant',    element: withSuspense(<Assistant />) },
      { path: 'analytics',       element: withSuspense(<Analytics />) },
      { path: 'reports',         element: withSuspense(<Reports />) },
      { path: 'data-catalog',    element: withSuspense(<DataCatalog />) },
      { path: 'catalog',         element: <Navigate to="/data-catalog" replace /> },
      { path: 'data-quality',    element: withSuspense(<DataQuality />) },
      { path: 'quality',         element: <Navigate to="/data-quality" replace /> },
      { path: 'data-lineage',    element: withSuspense(<DataLineage />) },
      { path: 'lineage',         element: <Navigate to="/data-lineage" replace /> },
      { path: 'field-discovery', element: withSuspense(<FieldDiscovery />) },
      { path: 'classification',  element: withSuspense(<Classification />) },
      { path: 'compliance',      element: withSuspense(<Compliance />) },
      { path: 'audit',           element: withSuspense(<AuditLogs />) },
      { path: 'integrations',    element: withSuspense(<Integrations />) },
      { path: 'pipelines',       element: withSuspense(<CICDPipelines />) },
      { path: 'requests',        element: withSuspense(<Requests />) },
      { path: 'data-sources',    element: withSuspense(<DataSources />) },
      { path: 'governance',      element: withSuspense(<Governance />) },
      { path: 'monitoring',      element: withSuspense(<Monitoring />) },
      { path: 'settings',        element: withSuspense(<Settings />) },
      { path: 'pii-settings',    element: withSuspense(<PIISettings />) },
      {path: 'users',            element: withSuspense(<Users />) },
      { path: '*',               element: withSuspense(<NotFound />) },
    ],
  },
];

const basename = (import.meta as any)?.env?.BASE_URL || '/';

export const router = createBrowserRouter(routes, {
  basename,
  // @ts-expect-error future flag types may lag
  future: { v7_startTransition: true },
});

export default function AppRouter() {
  return (
    <RouterProvider
      router={router}
      fallbackElement={
        <div className="min-h-screen flex items-center justify-center text-sm text-gray-700">
          <div className="inline-block rounded border bg-white px-3 py-2 shadow">Loading app…</div>
        </div>
      }
    />
  );
}

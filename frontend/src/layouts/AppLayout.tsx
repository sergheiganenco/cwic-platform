// src/layouts/AppLayout.tsx
import { env } from '@/config/environment';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/utils/cn';
import {
  Activity, Bell, BookOpen, CheckCircle, ChevronDown, Database, GitBranch,
  LayoutDashboard, LogOut, Menu, MessageSquare, Search, Settings as SettingsIcon,
  ShieldCheck, User as UserIcon, Workflow, X, type LucideIcon,
} from 'lucide-react';
import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

/* -------------------------------------------------------------------------- */
/* Types & nav items                                                          */
/* -------------------------------------------------------------------------- */

type NavItem = {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: string; // e.g. "read:catalog"
};

const NAV_ITEMS: NavItem[] = [
  // Keep Dashboard always visible: never gate it so the sidebar is never empty
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },

  { key: 'assistant',   label: 'Assistant',     to: '/assistant',   icon: MessageSquare, permission: 'read:assistant' },
  { key: 'catalog',     label: 'Data Catalog',  to: '/catalog',     icon: BookOpen,      permission: 'read:catalog' },
  { key: 'quality',     label: 'Data Quality',  to: '/quality',     icon: CheckCircle,   permission: 'read:quality' },
  { key: 'lineage',     label: 'Data Lineage',  to: '/lineage',     icon: GitBranch,     permission: 'read:lineage' },
  { key: 'pipelines',   label: 'Pipelines',     to: '/pipelines',   icon: Workflow,      permission: 'read:pipelines' },
  { key: 'requests',    label: 'Requests',      to: '/requests',    icon: Activity,      permission: 'read:requests' },
  { key: 'sources',     label: 'Data Sources',  to: '/data-sources',icon: Database,      permission: 'read:sources' },
  { key: 'governance',  label: 'Governance',    to: '/governance',  icon: ShieldCheck,   permission: 'read:governance' },
  { key: 'monitoring',  label: 'Monitoring',    to: '/monitoring',  icon: Activity,      permission: 'read:monitoring' },
  { key: 'settings',    label: 'Settings',      to: '/settings',    icon: SettingsIcon,  permission: 'read:settings' },
];

/**
 * Some backends/registers use slightly different resource ids than the nice UI labels.
 * Map nav keys → canonical permission resource ids used by your auth service.
 * Adjust these to match your real RBAC resources if needed.
 */
const PERM_MAP: Record<string, string[]> = {
  // key: [ primary, other aliases to try ]
  assistant:  ['assistant'],
  catalog:    ['catalog'],
  quality:    ['quality', 'data-quality'],
  lineage:    ['lineage', 'data-lineage'],
  pipelines:  ['pipelines', 'cicd', 'workflow'],
  requests:   ['requests', 'tickets'],
  sources:    ['data-sources', 'sources', 'connections'],
  governance: ['governance'],
  monitoring: ['monitoring', 'observability'],
  settings:   ['settings', 'account'],
};

/* Feature flags (optional via .env) */
const DEFAULT_ALLOW = import.meta.env.VITE_RBAC_DEFAULT_ALLOW === 'true'; // show all while wiring RBAC
const STRICT_MODE   = import.meta.env.VITE_RBAC_STRICT === 'true';       // never soft-fallback

/* -------------------------------------------------------------------------- */

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const { pathname } = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // ---- auth / perms --------------------------------------------------------
  const auth  = useAuth();
  const perms = usePermissions();

  const authLoading: boolean =
    (auth as any)?.loading ?? (auth as any)?.user === undefined;
  const user   = (auth as any)?.user;
  const logout = (auth as any)?.logout;

  // can() could be either:
  //   can('read', 'resource')  or  can('read:resource')
  const rawCan =
    (perms as any)?.can as
      | ((action: string, resource: string) => boolean)
      | ((scope: string) => boolean)
      | undefined;

  /** Try several calling conventions and aliases. */
  const canRead = React.useCallback(
    (navKey: string): boolean => {
      // Always allow if we’re in permissive mode (useful during setup)
      if (DEFAULT_ALLOW) return true;
      // No can() yet? Default allow so the UI doesn’t disappear
      if (!rawCan) return true;

      const aliases = PERM_MAP[navKey] ?? [navKey];

      // Try each alias with both signatures
      for (const res of aliases) {
        try {
          // Signature A: can('read', 'resource')
          if (rawCan.length >= 2 && (rawCan as any)('read', res)) return true;
          // Signature B: can('read:resource')
          if ((rawCan as any)(`read:${res}`)) return true;
        } catch {
          // ignore and try the next shape/alias
        }
      }

      // Final attempts: also try the literal permission string from NAV_ITEMS (e.g. "read:sources")
      // in case your RBAC expects the full scope.
      const item = NAV_ITEMS.find((n) => n.key === navKey);
      if (item?.permission) {
        try {
          if (rawCan.length >= 2) {
            const [act, res] = item.permission.split(':');
            if ((rawCan as any)(act, res ?? item.permission)) return true;
          } else {
            if ((rawCan as any)(item.permission)) return true;
          }
        } catch {}
      }

      return false;
    },
    [rawCan],
  );

  // Gate the nav. We'll soft-fallback to “show all” if everything got filtered,
  // unless STRICT_MODE is set.
  const gatedNav = React.useMemo(() => {
    const items = NAV_ITEMS.filter((n) => !n.permission || canRead(n.key));
    const gatedItems = items.length <= 1 && !STRICT_MODE ? NAV_ITEMS : items; // keep more than just dashboard
    return gatedItems;
  }, [canRead]);

  // ---- crumbs / search -----------------------------------------------------
  const crumbs = React.useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    const acc: Array<{ label: string; to?: string }> = [{ label: 'Home', to: '/dashboard' }];
    let running = '';
    for (const p of parts) {
      running += `/${p}`;
      acc.push({ label: decodeURIComponent(p).replace(/-/g, ' '), to: running });
    }
    return acc;
  }, [pathname]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/catalog?search=${encodeURIComponent(query.trim())}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-gray-50 text-gray-900 grid">
        <div className="m-auto text-sm text-gray-600">Loading session…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900">
      {/* A11y: skip link */}
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-blue-600 focus:shadow"
      >
        Skip to content
      </a>

      {/* Optional environment banner */}
      {import.meta.env.VITE_SHOW_ENV_BANNER === 'true' && env?.apiBaseUrl && (
        <div className="bg-yellow-50 text-yellow-800 text-sm px-4 py-2 border-b border-yellow-200">
          Environment — API: <span className="font-mono">{env.apiBaseUrl}</span>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-0px)]">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex md:w-64 lg:w-72 xl:w-80 flex-col border-r bg-white">
          <div className="h-16 flex items-center px-5 border-b">
            <Logo />
          </div>
          <nav className="flex-1 overflow-y-auto p-3">
            <ul className="space-y-1">
              {gatedNav.map((item) => (
                <li key={item.key}>
                  <SidebarLink item={item} />
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-t p-4">
            <UserCard
              name={user?.name || user?.email || 'User'}
              email={user?.email || ''}
              onLogout={logout}
              userMenuOpen={userMenuOpen}
              setUserMenuOpen={setUserMenuOpen}
            />
          </div>
        </aside>

        {/* Mobile scrim */}
        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity md:hidden',
            sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          )}
          onClick={() => setSidebarOpen(false)}
          aria-hidden={!sidebarOpen}
        />

        {/* Sidebar (mobile) */}
        <aside
          className={cn(
            'fixed z-50 inset-y-0 left-0 w-72 bg-white border-r shadow-lg transform transition-transform md:hidden',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          role="dialog"
          aria-modal
          aria-label="Sidebar"
        >
          <div className="h-16 flex items-center justify-between px-4 border-b">
            <Logo />
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-gray-100"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-3">
            <ul className="space-y-1">
              {gatedNav.map((item) => (
                <li key={item.key}>
                  <SidebarLink item={item} onNavigate={() => setSidebarOpen(false)} />
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-t p-4">
            <UserCard
              name={user?.name || user?.email || 'User'}
              email={user?.email || ''}
              onLogout={logout}
              userMenuOpen={userMenuOpen}
              setUserMenuOpen={setUserMenuOpen}
            />
          </div>
        </aside>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center gap-3 border-b bg-white px-3 md:px-6">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-gray-100 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumbs */}
            <nav className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
              {crumbs.map((c, idx) => {
                const isLast = idx === crumbs.length - 1;
                return (
                  <span key={`${c.label}-${idx}`} className="flex items-center gap-2">
                    {idx > 0 && <span className="text-gray-300">/</span>}
                    {isLast || !c.to ? (
                      <span className="font-medium text-gray-900">{c.label}</span>
                    ) : (
                      <NavLink className="hover:text-gray-900" to={c.to}>
                        {c.label}
                      </NavLink>
                    )}
                  </span>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              {/* Search */}
              <form onSubmit={onSearch} className="hidden md:flex items-center">
                <div className="flex items-center rounded-md border bg-white focus-within:ring-2 focus-within:ring-blue-500">
                  <Search className="h-4 w-4 ml-3 text-gray-500" />
                  <input
                    className="w-64 px-3 py-2 outline-none text-sm placeholder:text-gray-400"
                    placeholder="Search catalog, lineage, sources…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search"
                  />
                </div>
              </form>

              {/* Alerts */}
              <NavLink
                to="/requests"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-gray-100"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
              </NavLink>

              {/* Settings shortcut */}
              <NavLink
                to="/settings"
                className="hidden sm:inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-gray-50"
              >
                <SettingsIcon className="h-4 w-4" />
                Settings
              </NavLink>

              {/* User menu (md+) */}
              <div className="relative hidden md:block">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <UserIcon className="h-4 w-4" />
                  <span className="max-w-[14rem] truncate">{user?.name || user?.email || 'User'}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 overflow-hidden rounded-md border bg-white shadow-lg z-50"
                  >
                    <div className="px-3 py-2">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {user?.name || user?.email || 'User'}
                      </div>
                      {user?.email && <div className="text-xs text-gray-500 truncate">{user.email}</div>}
                    </div>
                    <div className="border-t">
                      <NavLink
                        to="/settings"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <SettingsIcon className="h-4 w-4" />
                        Account settings
                      </NavLink>
                      <button
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout?.();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main content */}
          <main id="app-main" className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">
              <Outlet />
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t bg-white px-6 py-3 text-xs text-gray-500">
            <div className="mx-auto max-w-[1600px] flex items-center justify-between">
              <div>&copy; {new Date().getFullYear()} CWIC</div>
              <div className="hidden sm:block">
                {env.isProduction ? 'Production' : 'Development'} · API: {env.apiBaseUrl}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- small pieces ----------------------------- */

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void; }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          isActive ? 'bg-blue-50 text-blue-700 font-medium'
                   : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function UserCard({
  name, email, onLogout, userMenuOpen, setUserMenuOpen,
}: {
  name: string; email?: string; onLogout?: () => void;
  userMenuOpen: boolean; setUserMenuOpen: (v: boolean) => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={() => setUserMenuOpen(!userMenuOpen)}
        className="flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-gray-50"
        aria-haspopup="menu"
        aria-expanded={userMenuOpen}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white">
          {initials(name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate font-medium text-gray-900">{name}</div>
          {email ? <div className="truncate text-xs text-gray-500">{email}</div> : null}
        </div>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>
      {userMenuOpen && (
        <div role="menu" className="absolute left-0 right-0 mt-2 overflow-hidden rounded-md border bg-white shadow-lg z-50">
          <NavLink
            to="/settings"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => setUserMenuOpen(false)}
          >
            <SettingsIcon className="h-4 w-4" />
            Account settings
          </NavLink>
          <button
            role="menuitem"
            onClick={() => { setUserMenuOpen(false); onLogout?.(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded bg-blue-600 text-white flex items-center justify-center font-bold">C</div>
      <div>
        <div className="text-sm font-semibold leading-tight">CWIC</div>
        <div className="text-[10px] text-gray-500 -mt-0.5">Data Platform</div>
      </div>
    </div>
  );
}

function initials(value?: string) {
  if (!value) return 'U';
  const parts = value.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join('') || 'U';
}

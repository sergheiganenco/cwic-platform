import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  Home,
  Database,
  GitBranch,
  Bot,
  FileCheck,
  BookOpen,
  BarChart3,
  Shield,
  Settings,
  Users,
  Target,
  Activity,
  AlertTriangle,
  CheckCircle,
  Zap,
  Play,
  Sparkles,
  Search,
  ClipboardCheck,
  Lock,
  FileText,
  Download,
  PieChart,
  ChevronRight,
  ChevronDown,
  Menu,
  LineChart,
} from 'lucide-react';
import { cn } from '@/utils';

interface NavigationChild {
  id: string;
  label: string;
  icon: any;
  href?: string;
}

interface NavigationParent {
  id: string;
  label: string;
  icon: any;
  badge?: number;
  children: NavigationChild[];
}

const navigationStructure: NavigationParent[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: Home,
    children: [
      { id: 'dashboard', label: 'Dashboard', icon: Activity, href: '/dashboard' },
      { id: 'analytics', label: 'Analytics', icon: LineChart, href: '/analytics' },
      { id: 'insights', label: 'AI Insights', icon: Sparkles, href: '/ai-insights' }
    ]
  },
  {
    id: 'data-management',
    label: 'Data Management',
    icon: Database,
    badge: 247,
    children: [
      { id: 'sources', label: 'Data Sources', icon: Database, href: '/connections' },
      { id: 'catalog', label: 'Data Catalog', icon: BookOpen, href: '/data-catalog' },
      { id: 'lineage', label: 'Data Lineage', icon: GitBranch, href: '/data-lineage' },
      { id: 'quality', label: 'Data Quality', icon: CheckCircle, href: '/data-quality' }
    ]
  },
  {
    id: 'intelligence',
    label: 'AI Intelligence',
    icon: Bot,
    badge: 12,
    children: [
      { id: 'ai-assistant', label: 'AI Assistant', icon: Bot, href: '/ai-assistant' },
      { id: 'field-discovery', label: 'Field Discovery', icon: Search, href: '/field-discovery' },
      { id: 'recommendations', label: 'Recommendations', icon: Sparkles, href: '/recommendations' },
      { id: 'auto-remediation', label: 'Auto-Remediation', icon: Zap, href: '/auto-remediation' }
    ]
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: GitBranch,
    children: [
      { id: 'pipelines', label: 'Pipelines', icon: GitBranch, href: '/pipelines' },
      { id: 'workflows', label: 'Workflows', icon: Play, href: '/workflows' },
      { id: 'monitoring', label: 'Monitoring', icon: Activity, href: '/monitoring' },
      { id: 'alerts', label: 'Alerts', icon: AlertTriangle, href: '/alerts' }
    ]
  },
  {
    id: 'governance',
    label: 'Governance',
    icon: Shield,
    badge: 5,
    children: [
      { id: 'policies', label: 'Policies', icon: Shield, href: '/governance' },
      { id: 'compliance', label: 'Compliance', icon: ClipboardCheck, href: '/compliance' },
      { id: 'pii-settings', label: 'PII Configuration', icon: Lock, href: '/pii-settings' }, // Configure PII detection rules
      { id: 'access-control', label: 'Access Control', icon: Lock, href: '/access-control' },
      { id: 'audit-logs', label: 'Audit Logs', icon: FileText, href: '/audit-logs' },
      { id: 'evidence', label: 'Evidence Vault', icon: FileCheck, href: '/evidence' }
    ]
  },
  {
    id: 'reports',
    label: 'Reports & Insights',
    icon: BarChart3,
    children: [
      { id: 'reports', label: 'Reports', icon: BarChart3, href: '/reports' },
      { id: 'dashboards', label: 'Dashboards', icon: PieChart, href: '/dashboards' },
      { id: 'exports', label: 'Data Exports', icon: Download, href: '/exports' }
    ]
  },
  {
    id: 'administration',
    label: 'Administration',
    icon: Settings,
    children: [
      { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
      { id: 'users', label: 'User Management', icon: Users, href: '/users' },
      { id: 'integrations', label: 'Integrations', icon: Target, href: '/integrations' }
    ]
  }
];

export function Sidebar() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedParents, setExpandedParents] = useState(['overview', 'data-management']);

  const toggleParent = (parentId: string) => {
    if (expandedParents.includes(parentId)) {
      setExpandedParents(expandedParents.filter(id => id !== parentId));
    } else {
      setExpandedParents([...expandedParents, parentId]);
    }
  };

  const getCurrentSection = () => {
    for (const parent of navigationStructure) {
      for (const child of parent.children) {
        if (child.href === location.pathname) {
          return { parentId: parent.id, childId: child.id };
        }
      }
    }
    return { parentId: 'overview', childId: 'dashboard' };
  };

  const { parentId: activeParent, childId: activeChild } = getCurrentSection();

  return (
    <aside className={cn(
      'bg-gradient-to-b from-slate-900 via-slate-800 to-gray-900 text-white transition-all duration-300 flex-shrink-0 border-r border-gray-700 shadow-2xl',
      sidebarCollapsed ? 'w-20' : 'w-72'
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2.5 rounded-xl shadow-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">CWIC 3.0</h1>
                <p className="text-xs text-gray-400">Data Governance</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-88px)]">
        {navigationStructure.map(parent => {
          const ParentIcon = parent.icon;
          const isExpanded = expandedParents.includes(parent.id);
          const isActive = activeParent === parent.id;

          return (
            <div key={parent.id} className="space-y-1">
              <button
                onClick={() => toggleParent(parent.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/50'
                    : 'text-gray-300 hover:bg-white/10',
                  sidebarCollapsed ? 'justify-center' : 'justify-between'
                )}
              >
                <div className="flex items-center gap-3">
                  <ParentIcon className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="font-medium text-sm">{parent.label}</span>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex items-center gap-2">
                    {parent.badge && (
                      <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                        {parent.badge}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                )}
              </button>

              {isExpanded && !sidebarCollapsed && (
                <div className="ml-4 space-y-1 border-l-2 border-gray-700 pl-2">
                  {parent.children.map(child => {
                    const ChildIcon = child.icon;
                    const isChildActive = activeChild === child.id;

                    return (
                      <Link
                        key={child.id}
                        to={child.href || '#'}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all',
                          isChildActive
                            ? 'bg-white/20 text-white font-semibold border-l-4 border-white'
                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                        )}
                      >
                        <ChildIcon className="h-4 w-4" />
                        <span>{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

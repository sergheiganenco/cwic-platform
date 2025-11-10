import clsx from "clsx";
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  ChevronRight,
  Database,
  DollarSign,
  FileCheck,
  GitBranch,
  GitMerge,
  Home,
  Link2,
  Menu,
  Package,
  Shield
} from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

type Item = { to: string; label: string; icon: any };
type Section = { id: string; label: string; items: Item[] };

const sections: Section[] = [
  { id: "overview", label: "OVERVIEW", items: [{ to: "/", label: "Dashboard", icon: Home }] },
  {
    id: "data", label: "DATA", items: [
      { to: "/sources", label: "Data Sources", icon: Database },
      { to: "/data-catalog", label: "Data Catalog", icon: BookOpen },
      { to: "/data-lineage", label: "Lineage", icon: GitMerge }
    ]
  },
  {
    id: "operations", label: "OPERATIONS", items: [
      { to: "/pipelines", label: "Pipelines", icon: GitBranch },
      { to: "/data-quality", label: "Data Quality", icon: Shield },
      { to: "/monitoring", label: "Monitoring", icon: Activity }
    ]
  },
  {
    id: "governance", label: "GOVERNANCE", items: [
      { to: "/policies", label: "Policies", icon: FileCheck },
      { to: "/evidence", label: "Evidence Vault", icon: Package }
    ]
  },
  {
    id: "ai", label: "AI & AUTOMATION", items: [
      { to: "/ai", label: "AI Assistant", icon: Bot },
      { to: "/integrations", label: "Integrations", icon: Link2 }
    ]
  },
  { id: "insights", label: "INSIGHTS", items: [{ to: "/analytics", label: "Analytics", icon: BarChart3 }, { to: "/costs", label: "Costs & Usage", icon: DollarSign }] }
];

export default function Navigation() {
  const [collapsed, setCollapsed] = useState(false);
  // Force all sections to be open by default for better visibility
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["overview", "data", "operations", "governance", "ai", "insights"])
  );

  const toggleAllSections = () => {
    if (openSections.size === sections.length) {
      setOpenSections(new Set());
    } else {
      setOpenSections(new Set(sections.map(s => s.id)));
    }
  };

  return (
    <aside className={clsx(
      "fixed left-0 top-0 h-screen bg-gradient-to-b from-gray-50 to-white border-r border-gray-200 transition-all z-40 shadow-xl flex flex-col",
      collapsed ? "w-20" : "w-72"
    )}>
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2.5 rounded-xl shadow-lg">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">CWIC</h1>
                <p className="text-xs text-gray-500 font-medium">Platform</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 pb-6">
        <div className="space-y-3">
          {sections.map((section, sectionIndex) => {
            const isOpen = openSections.has(section.id);

            return (
              <div key={section.id} className="relative">
                {/* Section divider */}
                {sectionIndex > 0 && !collapsed && (
                  <div className="mb-3 border-t border-gray-100" />
                )}

                {/* Section header */}
                {!collapsed && (
                  <button
                    onClick={() => {
                      const newOpenSections = new Set(openSections);
                      if (isOpen) {
                        newOpenSections.delete(section.id);
                      } else {
                        newOpenSections.add(section.id);
                      }
                      setOpenSections(newOpenSections);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-all rounded-lg hover:bg-gray-50"
                  >
                    <span>{section.label}</span>
                    <ChevronRight
                      className={clsx(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        isOpen && "rotate-90"
                      )}
                    />
                  </button>
                )}

                {/* Section items with smooth animation */}
                <div
                  className={clsx(
                    "overflow-hidden transition-all duration-200",
                    !isOpen && !collapsed && "max-h-0",
                    (isOpen || collapsed) && "max-h-[500px]"
                  )}
                >
                  <div className={clsx("space-y-1", !collapsed && "mt-1")}>
                    {section.items.map(({ to, label, icon: Icon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={to === "/"}
                        className={({ isActive }) => clsx(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium",
                          isActive
                            ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                          collapsed && "justify-center px-2"
                        )}
                        title={collapsed ? label : undefined}
                      >
                        <Icon className={clsx(
                          "flex-shrink-0",
                          collapsed ? "h-5 w-5" : "h-4 w-4"
                        )} />
                        {!collapsed && (
                          <span className="text-sm truncate">{label}</span>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Expand/Collapse All button when not collapsed */}
        {!collapsed && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={toggleAllSections}
              className="w-full text-xs text-gray-500 hover:text-gray-700 transition-colors py-2 px-3 rounded-lg hover:bg-gray-50"
            >
              {openSections.size === sections.length ? "Collapse All" : "Expand All"}
            </button>
          </div>
        )}
      </nav>
    </aside>
  );
}

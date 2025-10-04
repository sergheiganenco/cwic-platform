import { Bell, ChevronDown, Search, Zap } from "lucide-react";
import { useEffect } from "react";

type Props = {
  title: string;
  onOpenQuickActions: () => void;
  onOpenCommandPalette: () => void;
  user?: { name?: string; email?: string; initials?: string };
};

export default function Header({ title, onOpenQuickActions, onOpenCommandPalette, user }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenCommandPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenCommandPalette]);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">Last updated: 2 min ago</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenQuickActions}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all font-medium flex items-center gap-2"
          >
            <Zap className="h-4 w-4" /> Quick Actions
          </button>

          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
          >
            <Search className="h-4 w-4" />
            <kbd className="px-2 py-1 text-xs bg-white rounded border border-gray-300 font-mono">⌘K</kbd>
          </button>

          <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute top-0 right-0 w-5 h-5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-lg">
              3
            </span>
          </button>

          <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl hover:shadow-md transition-all cursor-pointer">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
              {user?.initials ?? "A"}
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900">{user?.name ?? "Admin User"}</p>
              <p className="text-xs text-gray-500">{user?.email ?? "admin@cwic.io"}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </div>
        </div>
      </div>
    </header>
  );
}

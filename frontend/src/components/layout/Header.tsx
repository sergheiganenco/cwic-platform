import { Bell, Search, Bot, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { AIChat } from "@/components/ui/AIChat";

type Props = {
  title?: string;
  onOpenQuickActions?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenAIChat?: () => void;
  user?: { name?: string; email?: string; initials?: string };
};

export default function Header({ title, onOpenQuickActions, onOpenCommandPalette, onOpenAIChat, user }: Props) {
  const [showAIChat, setShowAIChat] = useState(false);

  useEffect(() => {
    if (!onOpenCommandPalette) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenCommandPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenCommandPalette]);

  const handleAIChatToggle = () => {
    setShowAIChat(!showAIChat);
    if (onOpenAIChat) {
      onOpenAIChat();
    }
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Search Bar */}
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search data sources, pipelines, policies..."
                  className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Right Section - Icons & User */}
            <div className="flex items-center gap-3 ml-4">
              {/* AI Bot Button */}
              <button
                onClick={handleAIChatToggle}
                className="relative p-2.5 hover:bg-gray-100 rounded-xl transition-colors"
                title="Open AI Assistant"
              >
                <Bot className="h-5 w-5 text-gray-700" />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
              </button>

              {/* Notifications */}
              <button className="relative p-2.5 hover:bg-gray-100 rounded-xl transition-colors" title="Notifications">
                <Bell className="h-5 w-5 text-gray-700" />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
              </button>

              {/* Settings */}
              <button className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors" title="Settings">
                <Settings className="h-5 w-5 text-gray-700" />
              </button>

              {/* User Avatar */}
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center ml-3 cursor-pointer hover:shadow-lg transition-shadow" title={user?.name || "User Profile"}>
                <span className="text-sm font-bold text-white">{user?.initials ?? "JD"}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* AI Chat Widget */}
      <AIChat isOpen={showAIChat} onClose={() => setShowAIChat(false)} />
    </>
  );
}

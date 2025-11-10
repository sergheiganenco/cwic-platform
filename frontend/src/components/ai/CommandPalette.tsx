import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Command,
  ArrowRight,
  Clock,
  Star,
  Database,
  FileText,
  BarChart3,
  Shield,
  GitBranch,
  Zap,
  TrendingUp,
  Users,
  Settings,
  HelpCircle,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ComponentType<any>;
  category: 'navigation' | 'search' | 'action' | 'ai' | 'recent';
  keywords: string[];
  action: () => void;
  shortcut?: string;
  color?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onAIQuery?: (query: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onAIQuery
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Sample commands - in production, these would be dynamically loaded
  const allCommands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-catalog',
      title: 'Go to Data Catalog',
      description: 'Browse all data assets',
      icon: Database,
      category: 'navigation',
      keywords: ['catalog', 'data', 'assets', 'tables', 'browse'],
      action: () => navigate('/data-catalog'),
      shortcut: 'G C',
      color: 'text-blue-600'
    },
    {
      id: 'nav-quality',
      title: 'Go to Data Quality',
      description: 'View quality rules and metrics',
      icon: Shield,
      category: 'navigation',
      keywords: ['quality', 'rules', 'validation', 'metrics'],
      action: () => navigate('/data-quality'),
      shortcut: 'G Q',
      color: 'text-green-600'
    },
    {
      id: 'nav-lineage',
      title: 'Go to Data Lineage',
      description: 'Explore data relationships',
      icon: GitBranch,
      category: 'navigation',
      keywords: ['lineage', 'relationships', 'dependencies', 'graph'],
      action: () => navigate('/data-lineage'),
      shortcut: 'G L',
      color: 'text-purple-600'
    },
    {
      id: 'nav-pipelines',
      title: 'Go to Pipelines',
      description: 'Manage data pipelines',
      icon: Zap,
      category: 'navigation',
      keywords: ['pipelines', 'workflows', 'etl', 'automation'],
      action: () => navigate('/pipelines'),
      shortcut: 'G P',
      color: 'text-orange-600'
    },

    // AI Actions
    {
      id: 'ai-analyze',
      title: 'AI: Analyze Data Quality',
      description: 'Get AI insights on data quality',
      icon: Sparkles,
      category: 'ai',
      keywords: ['ai', 'analyze', 'quality', 'insights', 'suggestions'],
      action: () => onAIQuery?.('Analyze overall data quality and provide insights'),
      color: 'text-indigo-600'
    },
    {
      id: 'ai-find-pii',
      title: 'AI: Find PII Fields',
      description: 'Detect personally identifiable information',
      icon: Shield,
      category: 'ai',
      keywords: ['ai', 'pii', 'privacy', 'sensitive', 'detect'],
      action: () => onAIQuery?.('Find all PII fields across all data sources'),
      color: 'text-red-600'
    },
    {
      id: 'ai-optimize',
      title: 'AI: Optimize Query',
      description: 'Get query optimization suggestions',
      icon: TrendingUp,
      category: 'ai',
      keywords: ['ai', 'optimize', 'query', 'performance', 'sql'],
      action: () => onAIQuery?.('Help me optimize my database queries'),
      color: 'text-green-600'
    },
    {
      id: 'ai-forecast',
      title: 'AI: Forecast Data Growth',
      description: 'Predict future data volume',
      icon: BarChart3,
      category: 'ai',
      keywords: ['ai', 'forecast', 'predict', 'growth', 'trends'],
      action: () => onAIQuery?.('Forecast data growth for the next 90 days'),
      color: 'text-blue-600'
    },

    // Search
    {
      id: 'search-tables',
      title: 'Search Tables',
      description: 'Find tables by name or description',
      icon: Database,
      category: 'search',
      keywords: ['search', 'tables', 'find', 'database'],
      action: () => navigate('/data-catalog?tab=search'),
      color: 'text-blue-600'
    },
    {
      id: 'search-columns',
      title: 'Search Columns',
      description: 'Find specific columns across all tables',
      icon: FileText,
      category: 'search',
      keywords: ['search', 'columns', 'fields', 'find'],
      action: () => navigate('/data-catalog?tab=columns'),
      color: 'text-purple-600'
    },

    // Actions
    {
      id: 'action-create-rule',
      title: 'Create Quality Rule',
      description: 'Add a new data quality rule',
      icon: Shield,
      category: 'action',
      keywords: ['create', 'new', 'rule', 'quality', 'validation'],
      action: () => navigate('/data-quality?action=create'),
      shortcut: 'N R',
      color: 'text-green-600'
    },
    {
      id: 'action-run-profiling',
      title: 'Run Data Profiling',
      description: 'Profile data quality metrics',
      icon: BarChart3,
      category: 'action',
      keywords: ['run', 'profile', 'analyze', 'metrics'],
      action: () => navigate('/data-quality?action=profile'),
      color: 'text-orange-600'
    },

    // Settings
    {
      id: 'settings',
      title: 'Open Settings',
      description: 'Configure application preferences',
      icon: Settings,
      category: 'action',
      keywords: ['settings', 'preferences', 'config', 'configure'],
      action: () => navigate('/settings'),
      shortcut: '⌘ ,',
      color: 'text-gray-600'
    },
    {
      id: 'help',
      title: 'Help & Documentation',
      description: 'View help resources',
      icon: HelpCircle,
      category: 'action',
      keywords: ['help', 'docs', 'documentation', 'support'],
      action: () => window.open('/docs', '_blank'),
      shortcut: '?',
      color: 'text-blue-600'
    }
  ];

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) {
      return allCommands.filter(cmd => cmd.category === 'navigation' || cmd.category === 'ai').slice(0, 8);
    }

    const searchLower = search.toLowerCase();
    return allCommands.filter(cmd =>
      cmd.title.toLowerCase().includes(searchLower) ||
      cmd.description?.toLowerCase().includes(searchLower) ||
      cmd.keywords.some(k => k.toLowerCase().includes(searchLower))
    );
  }, [search]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  const categoryLabels: Record<string, string> = {
    navigation: '📍 Navigation',
    ai: '🧠 AI Suggestions',
    search: '🔍 Search',
    action: '⚡ Actions',
    recent: '🕒 Recent'
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const executeCommand = (command: CommandItem) => {
    // Save to recent searches
    if (!recentSearches.includes(command.id)) {
      setRecentSearches(prev => [command.id, ...prev].slice(0, 5));
    }

    command.action();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
            onClick={onClose}
          />

          {/* Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-[20%] left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-[9999]"
          >
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 p-4 border-b border-gray-200">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search or ask AI anything..."
                  className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 text-lg"
                />
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded border border-gray-200">
                    <Command className="w-3 h-3 inline" /> K
                  </kbd>
                </div>
              </div>

              {/* AI Suggestions Banner */}
              {search.length > 3 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100 p-3"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-indigo-900">
                      Press <kbd className="px-1.5 py-0.5 text-xs bg-white rounded border">Enter</kbd> to ask AI about "{search}"
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Commands List */}
              <div className="max-h-96 overflow-y-auto">
                {Object.entries(groupedCommands).map(([category, commands]) => (
                  <div key={category} className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {categoryLabels[category] || category}
                    </div>
                    {commands.map((command, index) => {
                      const globalIndex = filteredCommands.indexOf(command);
                      const isSelected = globalIndex === selectedIndex;
                      const IconComponent = command.icon;

                      return (
                        <motion.button
                          key={command.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => executeCommand(command)}
                          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                            isSelected
                              ? 'bg-blue-50 border-l-2 border-blue-500'
                              : 'hover:bg-gray-50'
                          }`}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                        >
                          <div className={`p-2 rounded-lg ${
                            isSelected ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            <IconComponent className={`w-4 h-4 ${command.color || 'text-gray-600'}`} />
                          </div>

                          <div className="flex-1 text-left min-w-0">
                            <div className="font-medium text-gray-900 text-sm truncate">
                              {command.title}
                            </div>
                            {command.description && (
                              <div className="text-xs text-gray-500 truncate">
                                {command.description}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {command.shortcut && (
                              <kbd className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded border border-gray-200">
                                {command.shortcut}
                              </kbd>
                            )}
                            {isSelected && (
                              <ChevronRight className="w-4 h-4 text-blue-500" />
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                ))}

                {filteredCommands.length === 0 && (
                  <div className="py-12 text-center">
                    <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No results found</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Try a different search term or ask AI
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 p-3 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white rounded border">↑↓</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white rounded border">↵</kbd>
                    Select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white rounded border">esc</kbd>
                    Close
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span className="text-indigo-600 font-medium">AI Powered</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;

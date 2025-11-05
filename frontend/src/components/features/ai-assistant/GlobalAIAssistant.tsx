// GlobalAIAssistant.tsx - Revolutionary Global AI Widget visible on every page
import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  X,
  Send,
  Minimize2,
  Maximize2,
  Sparkles,
  Zap,
  Lightbulb,
  TrendingUp,
  Shield,
  Database,
  FileSearch,
  Settings,
  Loader2,
  ChevronDown,
  BookOpen,
  Clock,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { useLocation } from 'react-router-dom';

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  context?: PageContext;
  suggestions?: string[];
}

interface PageContext {
  page: string;
  route: string;
  data?: any;
}

interface QuickSuggestion {
  icon: React.ComponentType<any>;
  text: string;
  action: string;
  color: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const GlobalAIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Context-aware suggestions based on current page
  const getContextualSuggestions = (): QuickSuggestion[] => {
    const route = location.pathname;

    if (route.includes('/quality')) {
      return [
        { icon: Shield, text: 'Check data quality', action: 'Show me the current data quality metrics', color: 'text-green-600' },
        { icon: Zap, text: 'Run quality scan', action: 'Run a quality scan on my data sources', color: 'text-blue-600' },
        { icon: TrendingUp, text: 'Quality trends', action: 'Show me quality trends over the last 30 days', color: 'text-purple-600' },
        { icon: Lightbulb, text: 'Suggest rules', action: 'Suggest quality rules for my datasets', color: 'text-amber-600' },
      ];
    } else if (route.includes('/catalog')) {
      return [
        { icon: Database, text: 'Search catalog', action: 'Help me find datasets with customer information', color: 'text-blue-600' },
        { icon: FileSearch, text: 'Find fields', action: 'Find all fields containing email addresses', color: 'text-green-600' },
        { icon: TrendingUp, text: 'Popular datasets', action: 'Show me the most popular datasets', color: 'text-purple-600' },
        { icon: Shield, text: 'Sensitive data', action: 'Identify sensitive data in my catalog', color: 'text-red-600' },
      ];
    } else if (route.includes('/lineage')) {
      return [
        { icon: GitBranch, text: 'Trace lineage', action: 'Trace the lineage of this dataset', color: 'text-blue-600' },
        { icon: TrendingUp, text: 'Impact analysis', action: 'Show me the downstream impact of changes', color: 'text-purple-600' },
        { icon: Database, text: 'Dependencies', action: 'List all dependencies for this table', color: 'text-green-600' },
        { icon: Sparkles, text: 'Optimize flow', action: 'Suggest optimizations for my data flow', color: 'text-amber-600' },
      ];
    } else if (route.includes('/field-discovery')) {
      return [
        { icon: Sparkles, text: 'Start scan', action: 'Start field discovery scan on all sources', color: 'text-blue-600' },
        { icon: FileSearch, text: 'New fields', action: 'Show me newly discovered fields this week', color: 'text-green-600' },
        { icon: Shield, text: 'PII detection', action: 'Identify potential PII in new fields', color: 'text-red-600' },
        { icon: Zap, text: 'Auto-classify', action: 'Automatically classify undocumented fields', color: 'text-purple-600' },
      ];
    } else if (route.includes('/classification')) {
      return [
        { icon: Shield, text: 'Run classifier', action: 'Run classification on all untagged data', color: 'text-red-600' },
        { icon: FileSearch, text: 'Review queue', action: 'Show me items needing review', color: 'text-amber-600' },
        { icon: Sparkles, text: 'Policy gaps', action: 'Identify gaps in classification policies', color: 'text-blue-600' },
        { icon: Zap, text: 'Auto-approve', action: 'Auto-approve high-confidence classifications', color: 'text-green-600' },
      ];
    }

    // Default suggestions
    return [
      { icon: Database, text: 'Search data', action: 'Help me find a specific dataset', color: 'text-blue-600' },
      { icon: Shield, text: 'Check quality', action: 'Check the quality of my data', color: 'text-green-600' },
      { icon: FileSearch, text: 'Find fields', action: 'Find fields across my catalog', color: 'text-purple-600' },
      { icon: Sparkles, text: 'Get insights', action: 'Give me insights about my data platform', color: 'text-amber-600' },
    ];
  };

  const suggestions = getContextualSuggestions();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Welcome message when opening for the first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'system',
          content: `👋 Hi! I'm your AI Data Assistant. I can help you with:\n\n• Finding data across your platform\n• Analyzing data quality\n• Discovering new fields\n• Classifying sensitive data\n• Understanding lineage\n• And much more!\n\nWhat would you like to do?`,
          timestamp: new Date(),
          context: { page: 'Welcome', route: location.pathname },
        },
      ]);
    }
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    setShowSuggestions(false);
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      context: {
        page: getPageName(),
        route: location.pathname,
      },
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response (in production, this would call your AI service)
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getContextualResponse(text),
        timestamp: new Date(),
        context: {
          page: getPageName(),
          route: location.pathname,
        },
        suggestions: [
          'Tell me more',
          'Show me examples',
          'What are the next steps?',
        ],
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const getPageName = (): string => {
    const route = location.pathname;
    if (route.includes('/quality')) return 'Data Quality';
    if (route.includes('/catalog')) return 'Data Catalog';
    if (route.includes('/lineage')) return 'Data Lineage';
    if (route.includes('/field-discovery')) return 'Field Discovery';
    if (route.includes('/classification')) return 'Classification';
    if (route.includes('/assistant')) return 'AI Assistant';
    return 'Dashboard';
  };

  const getContextualResponse = (userInput: string): string => {
    const route = location.pathname;
    const pageName = getPageName();

    // Context-aware responses
    if (userInput.toLowerCase().includes('quality')) {
      return `Based on your current context (${pageName}), I can see you're interested in data quality. Here's what I found:\n\n✅ Overall quality score: 87%\n⚠️ 3 critical issues detected\n📊 12 rules are currently active\n\nWould you like me to:\n1. Show detailed quality metrics\n2. Explain the critical issues\n3. Suggest new quality rules`;
    }

    if (userInput.toLowerCase().includes('find') || userInput.toLowerCase().includes('search')) {
      return `I'll help you search. I'm analyzing your ${pageName} data now...\n\n🔍 Found 23 relevant results\n📁 Top matches:\n• customer_email (users table)\n• contact_info (contacts table)\n• user_profile (profiles table)\n\nClick any result to view details, or ask me to refine the search.`;
    }

    if (userInput.toLowerCase().includes('field') || userInput.toLowerCase().includes('discover')) {
      return `I've scanned your data sources and found:\n\n🆕 28 new fields this week\n📊 14 fields need classification\n🔍 3 potential PII fields detected\n✅ 76% documentation complete\n\nWould you like me to:\n1. Start auto-classification\n2. Show the new PII fields\n3. Generate documentation`;
    }

    // Generic helpful response
    return `I understand you're asking about "${userInput}" in the context of ${pageName}.\n\nI can help you with:\n• Finding relevant data and assets\n• Analyzing quality metrics\n• Discovering patterns and insights\n• Automating common tasks\n\nCould you provide more details about what you're looking for?`;
  };

  const handleSuggestionClick = (action: string) => {
    sendMessage(action);
  };

  const handleQuickReply = (suggestion: string) => {
    sendMessage(suggestion);
  };

  // ============================================================================
  // RENDER: Minimized State
  // ============================================================================

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] group"
      >
        <div className="relative">
          {/* Pulsing ring animation */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-75 animate-ping" />

          {/* Main button */}
          <div className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110">
            <Bot className="h-8 w-8 text-white" />

            {/* Notification dot */}
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          </div>
        </div>

        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap shadow-lg">
            Ask AI anything
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      </button>
    );
  }

  // ============================================================================
  // RENDER: Open Chat Window
  // ============================================================================

  return (
    <div
      className={`fixed right-6 z-[9999] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col transition-all duration-300 ${
        isMinimized
          ? 'bottom-6 w-96 h-16'
          : 'bottom-6 w-96 h-[600px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Assistant</h3>
            <p className="text-xs text-gray-600">{getPageName()} • Online</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            {isMinimized ? (
              <Maximize2 className="h-4 w-4 text-gray-600" />
            ) : (
              <Minimize2 className="h-4 w-4 text-gray-600" />
            )}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : message.role === 'system'
                      ? 'bg-gradient-to-r from-green-50 to-blue-50 text-gray-900 border border-green-200'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                  {message.suggestions && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleQuickReply(suggestion)}
                          className="text-xs px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm text-gray-600">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {showSuggestions && messages.length <= 1 && (
            <div className="px-4 pb-3">
              <p className="text-xs text-gray-600 mb-2 font-medium">Quick actions for {getPageName()}:</p>
              <div className="grid grid-cols-2 gap-2">
                {suggestions.map((suggestion, index) => {
                  const Icon = suggestion.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion.action)}
                      className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                    >
                      <Icon className={`h-4 w-4 ${suggestion.color}`} />
                      <span className="text-xs text-gray-700 font-medium">
                        {suggestion.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)}
                placeholder="Ask anything..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              💡 Context-aware • {getPageName()}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default GlobalAIAssistant;

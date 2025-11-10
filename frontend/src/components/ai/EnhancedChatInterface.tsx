/**
 * Enhanced AI Chat Interface with Context Awareness and Predictions
 *
 * This component integrates with:
 * - UniversalAIContext for application-wide awareness
 * - AIOrchestrator for cross-module intelligence
 * - Predictive capabilities for proactive suggestions
 *
 * Features:
 * - Context-aware responses
 * - Predictive typing and smart suggestions
 * - Cross-module insights
 * - Real-time data integration
 * - Conversation memory
 * - Smart action buttons
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCheck,
  Copy,
  Database,
  Lightbulb,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  TrendingUp,
  Trash2,
  Zap,
  Brain,
  Target,
  Activity
} from 'lucide-react';
import { useUniversalAI } from '@/contexts/UniversalAIContext';
import { aiOrchestrator } from '@/services/AIOrchestrator';
import aiAssistantService from '@/services/api/aiAssistant';

/* =========================
   Types
   ========================= */
type MessageKind = 'user' | 'assistant' | 'system' | 'error' | 'prediction';

interface AIMessage {
  id: string;
  type: MessageKind;
  content: string;
  timestamp: Date;
  metadata?: {
    processingTime?: number;
    confidence?: number;
    status?: 'sending' | 'delivered' | 'error';
    sources?: string[]; // Which module AIs contributed
    predictions?: string[]; // Next likely queries
    insights?: Array<{
      module: string;
      text: string;
      priority: 'high' | 'medium' | 'low';
    }>;
  };
}

interface SmartSuggestion {
  id: string;
  text: string;
  category: 'discovery' | 'quality' | 'lineage' | 'pipeline' | 'governance';
  priority: number;
  icon: React.ComponentType<any>;
  context: string; // Why this suggestion is relevant
}

interface ChatInterfaceProps {
  className?: string;
  placeholder?: string;
  showHeader?: boolean;
  initialMessage?: string | null;
}

/* =========================
   Utilities
   ========================= */
const cx = (...parts: Array<string | false | undefined | null>) =>
  parts.filter(Boolean).join(' ');

const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/* =========================
   Simple Markdown renderer
   ========================= */
const MarkdownBlock: React.FC<{ text: string }> = ({ text }) => {
  const parts = useMemo(() => {
    const result: Array<{ kind: 'code' | 'text'; lang?: string; value: string }> = [];
    const fence = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = fence.exec(text))) {
      if (match.index > lastIndex) {
        result.push({ kind: 'text', value: text.slice(lastIndex, match.index) });
      }
      result.push({ kind: 'code', lang: match[1], value: match[2] });
      lastIndex = fence.lastIndex;
    }
    if (lastIndex < text.length) result.push({ kind: 'text', value: text.slice(lastIndex) });
    return result;
  }, [text]);

  const renderInline = (s: string) => {
    const segments = s.split(/(\*\*.+?\*\*)/g);
    return segments.map((seg, i) =>
      seg.startsWith('**') && seg.endsWith('**') ? (
        <strong key={i}>{seg.slice(2, -2)}</strong>
      ) : (
        <React.Fragment key={i}>{seg}</React.Fragment>
      )
    );
  };

  const renderText = (t: string) => {
    return t.split('\n').map((line, i) => {
      if (!line.trim()) return <div key={i} className="h-1" />;

      const bullet = line.trim().match(/^(\*|-|•)\s+/);
      if (bullet) {
        const content = line.trim().slice(bullet[0].length);
        return (
          <div key={i} className="pl-6 relative">
            <span className="absolute left-1 top-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/70" />
            <span>{renderInline(content)}</span>
          </div>
        );
      }
      return <div key={i}>{renderInline(line)}</div>;
    });
  };

  return (
    <>
      {parts.map((p, idx) =>
        p.kind === 'code' ? (
          <pre
            key={idx}
            className="my-3 w-full overflow-x-auto rounded-lg bg-slate-900/95 p-3 text-slate-100 text-sm shadow-inner"
          >
            <div className="mb-2 text-xs uppercase tracking-wide opacity-60">{p.lang || 'code'}</div>
            <code>{p.value}</code>
          </pre>
        ) : (
          <div key={idx} className="space-y-1">
            {renderText(p.value)}
          </div>
        )
      )}
    </>
  );
};

/* =========================
   Enhanced Chat Hook with Context
   ========================= */
const useEnhancedAIChat = () => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { context, getContextForAI, addInsight } = useUniversalAI();

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMsg: AIMessage = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'user',
      content: content.trim(),
      timestamp: new Date(),
      metadata: { status: 'sending' },
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setError(null);

    try {
      // Get full application context
      const appContext = getContextForAI();

      // Route query through AI Orchestrator
      const orchestratorResult = await aiOrchestrator.routeQuery(content, {
        fullContext: appContext,
        currentModule: context.currentModule,
        recentActions: context.userActions.slice(0, 5),
        systemMetrics: context.systemMetrics,
      });

      // Mark user message as delivered
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsg.id ? { ...m, metadata: { ...m.metadata, status: 'delivered' } } : m))
      );

      // Generate predictions for next queries
      const predictions = generatePredictions(content, context);

      // Create assistant message with full metadata
      const assistantMsg: AIMessage = {
        id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'assistant',
        content: orchestratorResult.response,
        timestamp: new Date(),
        metadata: {
          confidence: orchestratorResult.confidence,
          sources: orchestratorResult.sources,
          status: 'delivered',
          predictions,
        },
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Track this interaction
      addInsight({
        type: 'info',
        title: 'AI Query Completed',
        message: `Processed query with ${Math.round(orchestratorResult.confidence * 100)}% confidence`,
        module: 'ai',
        priority: 'low',
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to get response.');
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsg.id ? { ...m, metadata: { ...m.metadata, status: 'error' } } : m))
      );
    } finally {
      setLoading(false);
    }
  }, [context, getContextForAI, addInsight]);

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const retryLast = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.type === 'user');
    if (lastUser) sendMessage(lastUser.content);
  }, [messages, sendMessage]);

  return { messages, loading, error, sendMessage, clear, retryLast, isTyping: loading };
};

/* =========================
   Prediction Generator
   ========================= */
const generatePredictions = (query: string, context: any): string[] => {
  const predictions: string[] = [];
  const queryLower = query.toLowerCase();

  // Quality-related predictions
  if (/quality|rule|validation/i.test(queryLower)) {
    predictions.push('Show me which quality rules are failing');
    predictions.push('Generate quality rules for this table');
    if (context.selectedAssets.length > 0) {
      predictions.push(`Fix quality issues in ${context.selectedAssets[0]}`);
    }
  }

  // Catalog-related predictions
  if (/find|search|table|column|field/i.test(queryLower)) {
    predictions.push('Show me all PII fields');
    predictions.push('What tables contain customer data?');
    predictions.push('Profile this dataset');
  }

  // Pipeline-related predictions
  if (/pipeline|workflow|etl/i.test(queryLower)) {
    predictions.push('Which pipelines are failing?');
    predictions.push('Optimize pipeline performance');
    predictions.push('Show pipeline execution history');
  }

  // Lineage-related predictions
  if (/lineage|impact|dependency|downstream|upstream/i.test(queryLower)) {
    predictions.push('What depends on this table?');
    predictions.push('Show complete data lineage');
    predictions.push('What would break if I delete this?');
  }

  // Context-aware predictions
  if (context.currentModule === 'quality' && context.systemMetrics.criticalIssues > 0) {
    predictions.push(`Fix ${context.systemMetrics.criticalIssues} critical issues`);
  }

  if (context.currentModule === 'catalog' && context.selectedAssets.length > 0) {
    predictions.push(`Analyze ${context.selectedAssets[0]}`);
  }

  return predictions.slice(0, 3); // Return top 3 predictions
};

/* =========================
   Smart Suggestions Generator
   ========================= */
const useSmartSuggestions = (): SmartSuggestion[] => {
  const { context } = useUniversalAI();

  return useMemo(() => {
    const suggestions: SmartSuggestion[] = [];

    // Quality-based suggestions
    if (context.systemMetrics.criticalIssues > 3) {
      suggestions.push({
        id: 'fix-critical',
        text: `Fix ${context.systemMetrics.criticalIssues} critical quality issues`,
        category: 'quality',
        priority: 10,
        icon: AlertTriangle,
        context: 'High number of critical issues detected',
      });
    }

    if (context.systemMetrics.dataQualityScore < 92) {
      suggestions.push({
        id: 'improve-quality',
        text: 'How can I improve data quality score?',
        category: 'quality',
        priority: 8,
        icon: TrendingUp,
        context: `Quality score is ${context.systemMetrics.dataQualityScore}%`,
      });
    }

    // Context-based suggestions
    if (context.currentModule === 'catalog' && context.selectedAssets.length > 0) {
      suggestions.push({
        id: 'analyze-asset',
        text: `Analyze ${context.selectedAssets[0]} for quality issues`,
        category: 'discovery',
        priority: 7,
        icon: Database,
        context: 'Asset selected in catalog',
      });
    }

    // Recent activity suggestions
    const recentQualityActions = context.userActions.filter(
      (a) => a.module === 'quality'
    ).length;

    if (recentQualityActions > 3) {
      suggestions.push({
        id: 'quality-summary',
        text: 'Summarize my quality management activities',
        category: 'quality',
        priority: 6,
        icon: Activity,
        context: 'Multiple quality actions performed',
      });
    }

    // Always available suggestions
    suggestions.push(
      {
        id: 'find-pii',
        text: 'Find all PII fields across databases',
        category: 'governance',
        priority: 5,
        icon: Shield,
        context: 'Compliance monitoring',
      },
      {
        id: 'pipeline-health',
        text: 'Check pipeline health status',
        category: 'pipeline',
        priority: 4,
        icon: Zap,
        context: 'Operational monitoring',
      },
      {
        id: 'smart-insights',
        text: 'What insights do you have for me?',
        category: 'discovery',
        priority: 3,
        icon: Lightbulb,
        context: 'Get AI recommendations',
      }
    );

    return suggestions.sort((a, b) => b.priority - a.priority).slice(0, 6);
  }, [context]);
};

/* =========================
   Message Bubble
   ========================= */
const MessageBubble: React.FC<{ message: AIMessage }> = ({ message }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Ignore copy errors
    }
  };

  const isUser = message.type === 'user';
  const isError = message.type === 'error';

  return (
    <div
      className={cx(
        'group relative mb-3 flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cx(
          'max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ring-1',
          isUser
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white ring-blue-600/20'
            : isError
            ? 'bg-rose-50 text-rose-900 ring-rose-200'
            : 'bg-white text-slate-900 ring-slate-200'
        )}
      >
        {/* Content */}
        <div className="prose prose-sm max-w-none prose-headings:my-2 prose-p:my-2 prose-strong:font-semibold prose-pre:my-0 prose-ul:my-2 prose-li:my-0">
          <MarkdownBlock text={message.content} />
        </div>

        {/* Metadata */}
        <div className={cx('mt-2 flex items-center gap-2 text-[11px]', isUser ? 'text-white/80' : 'text-slate-500')}>
          <span>{fmtTime(message.timestamp)}</span>
          {typeof message.metadata?.confidence === 'number' && (
            <span className="flex items-center gap-1">
              <Brain size={12} />
              {Math.round(message.metadata.confidence * 100)}%
            </span>
          )}
          {message.metadata?.sources && message.metadata.sources.length > 0 && (
            <span className="flex items-center gap-1">
              <Target size={12} />
              {message.metadata.sources.join(', ')}
            </span>
          )}
          {!isUser && (
            <button
              onClick={handleCopy}
              className={cx(
                'ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition',
                'bg-slate-100 hover:bg-slate-200 active:bg-slate-300'
              )}
              title="Copy"
            >
              {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>

        {/* Predictions */}
        {message.metadata?.predictions && message.metadata.predictions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-600 mb-2 flex items-center gap-1">
              <Sparkles size={12} />
              You might want to ask:
            </div>
            <div className="flex flex-wrap gap-2">
              {message.metadata.predictions.map((pred, idx) => (
                <button
                  key={idx}
                  className="text-xs px-2 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  onClick={() => {
                    // This would trigger sending the prediction as a new message
                    console.log('Prediction clicked:', pred);
                  }}
                >
                  {pred}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================
   Typing Indicator
   ========================= */
const TypingIndicator: React.FC = () => (
  <div className="mb-3 flex w-full justify-start">
    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
      <div className="flex items-center gap-2 text-slate-500">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:-200ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400 [animation-delay:200ms]" />
        </div>
        <span className="text-xs">AI is analyzing across all modules…</span>
      </div>
    </div>
  </div>
);

/* =========================
   Main Component
   ========================= */
export const EnhancedChatInterface: React.FC<ChatInterfaceProps> = ({
  className,
  placeholder = 'Ask me anything about your data…',
  showHeader = false,
  initialMessage = null,
}) => {
  const [input, setInput] = useState('');
  const { context } = useUniversalAI();
  const smartSuggestions = useSmartSuggestions();
  const { messages, loading, error, sendMessage, clear, retryLast, isTyping } = useEnhancedAIChat();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Send initial message if provided
  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      sendMessage(initialMessage);
    }
  }, [initialMessage]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    try {
      await sendMessage(msg);
    } catch {
      setInput(msg);
    }
  }, [input, loading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSuggestion = useCallback(
    (text: string) => {
      setInput(text);
      setTimeout(() => handleSend(), 50);
    },
    [handleSend]
  );

  return (
    <div
      className={cx(
        'flex h-full min-h-[580px] w-full flex-col rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30',
        'shadow-lg backdrop-blur-[2px]',
        className
      )}
    >
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow">
              <Bot size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">Enhanced AI Assistant</div>
              <div className="text-xs text-slate-500 leading-tight flex items-center gap-1">
                <Activity size={10} />
                Context-aware • Predictive • Cross-module intelligence
              </div>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clear}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              title="Clear conversation"
            >
              <Trash2 size={14} />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Welcome state with context */}
        {messages.length === 0 && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <Sparkles size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold">Context-Aware AI Assistant</div>
                <div className="text-xs text-slate-500">
                  I know you're on {context.pageTitle || 'the platform'} and have full system awareness
                </div>
              </div>
            </div>

            {/* Current Context Display */}
            {context.currentModule && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="text-xs font-medium text-blue-900 mb-2">Current Context:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-blue-700">Module:</span>{' '}
                    <span className="font-medium text-blue-900">{context.currentModule}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Quality Score:</span>{' '}
                    <span className="font-medium text-blue-900">{context.systemMetrics.dataQualityScore}%</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Assets:</span>{' '}
                    <span className="font-medium text-blue-900">{context.systemMetrics.assetsCount}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Critical Issues:</span>{' '}
                    <span className="font-medium text-blue-900">{context.systemMetrics.criticalIssues}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Smart Suggestions */}
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium text-slate-600 flex items-center gap-1">
                <Lightbulb size={12} />
                Smart suggestions based on your context:
              </div>
              <div className="grid grid-cols-1 gap-2">
                {smartSuggestions.map((suggestion) => {
                  const IconComponent = suggestion.icon;
                  return (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestion(suggestion.text)}
                      className="text-left p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition group"
                    >
                      <div className="flex items-start gap-2">
                        <IconComponent className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-800">{suggestion.text}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{suggestion.context}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Conversation */}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {isTyping && <TypingIndicator />}

        {error && (
          <div
            className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            role="alert"
          >
            <AlertTriangle size={16} />
            <span>{error}</span>
            <button
              onClick={retryLast}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-xs text-amber-800 hover:bg-amber-50"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={endRef} aria-hidden="true" />
      </div>

      {/* Composer */}
      <div className="border-t border-slate-200/80 bg-white/90 backdrop-blur-sm px-4 py-3">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={loading}
              maxLength={500}
              className={cx(
                'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none',
                'placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60'
              )}
            />
            <div className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-slate-400">
              {input.length}/500
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className={cx(
              'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-white shadow-sm transition',
              loading
                ? 'bg-blue-400'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800'
            )}
          >
            {loading ? <RotateCcw className="animate-spin" size={18} /> : <Send size={18} />}
            <span className="hidden sm:inline">{loading ? 'Analyzing' : 'Send'}</span>
          </button>
        </div>
        <div className="mt-1 text-[11px] text-slate-400">
          Press Enter to send • AI has context from {context.currentModule || 'all modules'}
        </div>
      </div>
    </div>
  );
};

export default EnhancedChatInterface;

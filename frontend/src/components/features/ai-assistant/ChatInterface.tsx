// src/components/ai/ChatInterface.tsx
import aiAssistantService from '@/services/api/aiAssistant';
import {
  AlertTriangle,
  CheckCheck,
  Copy,
  Database,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Zap
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* =========================
   Types / Props
   ========================= */
type MessageKind = 'user' | 'assistant' | 'system' | 'error';

interface AIMessage {
  id: string;
  type: MessageKind;
  content: string;
  timestamp: Date;
  metadata?: {
    processingTime?: number;
    confidence?: number;
    status?: 'sending' | 'delivered' | 'error';
  };
}

interface ChatInterfaceProps {
  className?: string;
  placeholder?: string;
  /** Hide internal header to avoid duplicate page headings */
  showHeader?: boolean; // default false
}

/* =========================
   Env / Feature flags
   ========================= */
const USE_BACKEND = import.meta.env.VITE_USE_AI_BACKEND === 'true';

/* =========================
   Utilities
   ========================= */
const cx = (...parts: Array<string | false | undefined | null>) =>
  parts.filter(Boolean).join(' ');

const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Very small “normalizer” for backend responses */
const normalizeBackendResponse = (res: any): { text: string; meta?: any } => {
  if (!res) return { text: 'No response from AI service.' };

  const d = res.data ?? res; // allow raw or { data }
  const candidates = [
    typeof d?.message === 'string' ? d.message : undefined,
    typeof d?.text === 'string' ? d.text : undefined,
    typeof d?.answer === 'string' ? d.answer : undefined,
    typeof d?.results === 'string' ? d.results : undefined,
  ].filter((v) => typeof v === 'string' && v.trim().length > 0) as string[];

  if (candidates.length) {
    return { text: candidates[0], meta: res.meta };
  }

  // Render objects/arrays sensibly
  if (d?.results && typeof d.results === 'object') {
    return {
      text: '```json\n' + JSON.stringify(d.results, null, 2) + '\n```',
      meta: res.meta,
    };
  }

  if (res?.error?.message) {
    return { text: `⚠️ ${res.error.message}`, meta: res.meta };
  }
  return { text: 'No response from AI service.', meta: res.meta };
};

/* =========================
   Mock AI (unchanged logic)
   ========================= */
const mockAIService = {
  async sendMessage(content: string): Promise<{ message: string; processingTime: number; confidence: number }> {
    const processingTime = 1200 + Math.random() * 1800;
    await new Promise((r) => setTimeout(r, processingTime));

    const responses: Record<string, { message: string; confidence: number }> = {
      'show me data quality issues': {
        message: `🔍 **Data Quality Analysis Complete**

**Overall Quality Score: 87/100** ✅

**Critical Issues Identified:**
• **Missing Values**: 234 records in customer_email (12.3% of dataset)
• **Duplicate Records**: 12 duplicate entries in orders table
• **Format Issues**: 5 invalid date formats in transaction_date field
• **Outliers**: 89 statistical outliers in revenue_amount column

**Quality Metrics by Category:**
📊 **Completeness**: 94.2% (Target: 95%)
📋 **Validity**: 89.7% (Target: 92%)
🔄 **Consistency**: 91.3% (Target: 90%) ✅
🎯 **Accuracy**: 85.8% (Target: 88%)

**Immediate Actions Required:**
1. ✅ Implement email validation rules for customer_email
2. ⚠️ Add unique constraints to prevent order duplicates
3. 🔧 Standardize date formats across all transaction tables
4. 📈 Review outlier detection thresholds for revenue data

**Estimated Fix Time**: 2-3 business days
**Impact**: Will improve overall data quality to 93/100`,
        confidence: 0.94,
      },
      'find sensitive data in my database': {
        message: `🛡️ **Sensitive Data Discovery Report**

**PII Detection Summary:**
Found **67,234 sensitive records** across 15 database tables

**Sensitive Data Breakdown:**
🔴 **Social Security Numbers**: 1,247 records
   • Tables: customers, employees, contractors
   • Encryption Status: ❌ Unencrypted

💳 **Credit Card Numbers**: 892 records
   • Tables: payments, billing_history
   • Encryption Status: ⚠️ Partially encrypted

📧 **Email Addresses**: 45,123 records
   • Tables: customers, marketing_contacts, employees
   • Encryption Status: ❌ Plain text

**Compliance Status:**
🟡 **GDPR**: 67% compliant (Needs consent tracking)
🟡 **CCPA**: 72% compliant (Missing data deletion processes)
🔴 **PCI-DSS**: 23% compliant (Critical - credit card data exposed)
🟡 **HIPAA**: 58% compliant (Healthcare data needs encryption)

**Critical Actions (Within 24 Hours):**
1. 🚨 **Immediate**: Encrypt all credit card data
2. 🔒 **High Priority**: Implement data masking for SSNs
3. 📝 **Required**: Add consent tracking for email collection
4. 🗂️ **Compliance**: Establish data retention policies

**Risk Level**: HIGH - Potential regulatory fines up to $2.1M`,
        confidence: 0.96,
      },
      'generate quality rules for customer data': {
        message: `⚙️ **AI-Generated Data Quality Rules**

**Customer Data Validation Rules Created:**

**1. Email Validation Rule**
\`\`\`sql
RULE: email_format_validation
REGEX: ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$
APPLIES_TO: customer_email, contact_email, billing_email
SEVERITY: HIGH
\`\`\`

**2. Phone Number Standardization**
\`\`\`sql
RULE: phone_standardization
FORMAT: (XXX) XXX-XXXX
VALIDATION: LENGTH = 14 AND STARTS_WITH('(')
APPLIES_TO: phone_number, mobile_number, emergency_contact
SEVERITY: MEDIUM
\`\`\`

**Implementation Summary:**
✅ **Rules Created**: 6 validation rules
📊 **Coverage**: 98% of customer data fields
⚡ **Performance Impact**: <2% query overhead
🎯 **Expected Quality Improvement**: 23% increase

**Deployment Status**: Ready for immediate implementation`,
        confidence: 0.91,
      },
      "what's the status of my pipelines?": {
        message: `📊 **Real-Time Pipeline Status Dashboard**

**System Overview**: 8 of 10 pipelines operational

**🟢 HEALTHY PIPELINES (6)**

**Customer Data Sync Pipeline**
• Source: Salesforce → Snowflake Data Warehouse
• Status: ✅ Running smoothly
• Last Execution: 2 minutes ago
• Records Processed: 45,231 (batched)
• Success Rate: 99.7%

**Transaction Processing Pipeline**
• Source: Payment Gateway → PostgreSQL
• Status: ✅ Real-time processing
• Last Transaction: 15 seconds ago
• Records/Hour: 3,694 transactions
• Latency: 0.3s average

**🔴 FAILED PIPELINES (2)**

**Inventory Sync Pipeline**
• Source: ERP System → Data Warehouse
• Status: ❌ Connection timeout
• Error: Database connection lost at 14:23
• **Action Required**: Manual intervention needed

**📈 Performance Metrics (24h)**
• Total Records Processed: 2.3M
• Average Processing Time: 1.2 minutes
• Success Rate: 92.3%`,
        confidence: 0.88,
      },
      hello: {
        message: `👋 **Welcome to CWIC AI Assistant!**

I'm your intelligent data governance companion, designed to help you navigate the complex world of data management with ease.

**🔍 Data Discovery & Cataloging**
• Automated discovery and lineage tracking
• Smart cataloging with AI-powered metadata

**📊 Data Quality Management**
• Real-time monitoring and scoring
• Anomaly detection and validation rules

**🛡️ Compliance & Governance**
• PII/PHI discovery and classification
• GDPR / CCPA / HIPAA / PCI-DSS checks

**⚙️ Pipeline & Workflow Management**
• Pipeline health monitoring
• Optimization recommendations

What would you like to explore first?`,
        confidence: 0.99,
      },
    };

    const lower = content.toLowerCase();
    for (const [key, resp] of Object.entries(responses)) {
      if (lower.includes(key)) {
        return { message: resp.message, processingTime, confidence: resp.confidence };
      }
    }
    return {
      message: `I understand you're asking about "${content}". Try topics like **"data quality issues"** or **"sensitive data discovery"**.`,
      processingTime,
      confidence: 0.85,
    };
  },
};

/* =========================
   Simple Markdown-ish renderer
   (bold, lists, code fences)
   ========================= */
const MarkdownBlock: React.FC<{ text: string }> = ({ text }) => {
  // Split by code fences ```lang\n...\n```
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
    // **bold**
    const segments = s.split(/(\*\*.+?\*\*)/g);
    return segments.map((seg, i) =>
      seg.startsWith('**') && seg.endsWith('**') ? <strong key={i}>{seg.slice(2, -2)}</strong> : <React.Fragment key={i}>{seg}</React.Fragment>
    );
  };

  const renderText = (t: string) => {
    // split into lines and detect bullets
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
   Hook: chat state
   ========================= */
const useAIChat = () => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      let replyText = '';
      let processingTime = 0;
      let confidence: number | undefined;

      if (USE_BACKEND) {
        const res = await aiAssistantService.sendMessageWithFallback(content, {
          cacheKey: `q:${content}`,
        });
        const norm = normalizeBackendResponse(res);
        replyText = norm.text || '';
        processingTime = res?.meta?.processingTime ?? 0;
        confidence = res?.meta?.confidence;
      } else {
        const mock = await mockAIService.sendMessage(content);
        replyText = mock.message;
        processingTime = mock.processingTime;
        confidence = mock.confidence;
      }

      // Mark user message delivered
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsg.id ? { ...m, metadata: { ...m.metadata, status: 'delivered' } } : m))
      );

      const assistantMsg: AIMessage = {
        id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: replyText ? 'assistant' : 'error',
        content: replyText || 'No response from AI service.',
        timestamp: new Date(),
        metadata: {
          processingTime,
          confidence,
          status: replyText ? 'delivered' : 'error',
        },
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      setError(e?.message || 'Failed to get response.');
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsg.id ? { ...m, metadata: { ...m.metadata, status: 'error' } } : m))
      );
    } finally {
      setLoading(false);
    }
  }, []);

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
   Message bubble
   ========================= */
const MessageBubble: React.FC<{ message: AIMessage; onCopy?: (ok: boolean) => void }> = ({ message, onCopy }) => {
  const [copied, setCopied] = useState(false);
  const canCopy = message.type !== 'system';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      onCopy?.(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      onCopy?.(false);
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
            ? 'bg-violet-600 text-white ring-violet-600/20'
            : isError
            ? 'bg-rose-50 text-rose-900 ring-rose-200'
            : 'bg-white text-slate-900 ring-slate-200'
        )}
      >
        {/* Content */}
        <div className="prose prose-sm max-w-none prose-headings:my-2 prose-p:my-2 prose-strong:font-semibold prose-pre:my-0 prose-ul:my-2 prose-li:my-0">
          <MarkdownBlock text={message.content} />
        </div>

        {/* Meta row */}
        <div className={cx('mt-2 flex items-center gap-2 text-[11px]', isUser ? 'text-white/80' : 'text-slate-500')}>
          <span>{fmtTime(message.timestamp)}</span>
          {typeof message.metadata?.processingTime === 'number' && (
            <span>{Math.round(message.metadata.processingTime)}ms</span>
          )}
          {typeof message.metadata?.confidence === 'number' && (
            <span>{Math.round(message.metadata.confidence * 100)}%</span>
          )}
          {canCopy && (
            <button
              onClick={handleCopy}
              className={cx(
                'ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition',
                isUser
                  ? 'bg-white/15 hover:bg-white/25 active:bg-white/30'
                  : 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300'
              )}
              title="Copy"
              aria-label="Copy message"
            >
              {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* =========================
   Typing indicator
   ========================= */
const TypingIndicator: React.FC = () => (
  <div className="mb-3 flex w-full justify-start">
    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
      <div className="flex items-center gap-2 text-slate-500">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-200ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:200ms]" />
        </div>
        <span className="text-xs">AI is thinking…</span>
      </div>
    </div>
  </div>
);

/* =========================
   Main component
   ========================= */
export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  className,
  placeholder = 'Ask me anything about your data…',
  showHeader = false, // avoid duplicate page titles by default
}) => {
  const [input, setInput] = useState('');
  const suggestions = useMemo(
    () => [
      'Show me data quality issues',
      'Find sensitive data in my database',
      'Generate quality rules for customer data',
      "What’s the status of my pipelines?",
    ],
    []
  );

  const { messages, loading, error, sendMessage, clear, retryLast, isTyping } = useAIChat();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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
    (s: string) => {
      setInput(s);
      setTimeout(() => handleSend(), 50);
    },
    [handleSend]
  );

  return (
    <div
      className={cx(
        'flex h-full min-h-[580px] w-full flex-col rounded-xl border border-slate-200 bg-slate-50/60',
        'shadow-sm backdrop-blur-[2px]',
        className
      )}
    >
      {/* Header (optional, subdued) */}
      {showHeader && (
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white shadow">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">CWIC AI Assistant</div>
              <div className="text-xs text-slate-500 leading-tight">Your intelligent data governance companion</div>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clear}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <Trash2 size={14} />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Empty welcome state */}
        {messages.length === 0 && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-white">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold">Welcome to CWIC AI</div>
                <div className="text-xs text-slate-500">
                  Ask about discovery, quality, compliance, or pipelines.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-4">
                <Database className="mb-2 text-slate-600" size={28} />
                <div className="text-sm font-medium">Data Discovery</div>
                <div className="text-xs text-slate-500">Find and catalog data across sources</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <Zap className="mb-2 text-slate-600" size={28} />
                <div className="text-sm font-medium">Quality Analysis</div>
                <div className="text-xs text-slate-500">Monitor and improve data quality</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <Shield className="mb-2 text-slate-600" size={28} />
                <div className="text-sm font-medium">Compliance</div>
                <div className="text-xs text-slate-500">Ensure regulatory compliance</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 text-xs font-medium text-slate-600">Try asking:</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    {s}
                  </button>
                ))}
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
      <div className="border-t border-slate-200/80 bg-white/80 px-4 py-3">
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
              aria-label="Message"
              className={cx(
                'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none',
                'placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:opacity-60'
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
                ? 'bg-violet-400'
                : 'bg-violet-600 hover:bg-violet-700 active:bg-violet-800'
            )}
            aria-label={loading ? 'Sending' : 'Send message'}
          >
            {loading ? <RotateCcw className="animate-spin" size={18} /> : <Send size={18} />}
            <span className="hidden sm:inline">{loading ? 'Sending' : 'Send'}</span>
          </button>
        </div>
        <div className="mt-1 text-[11px] text-slate-400">Press Enter to send</div>
      </div>
    </div>
  );
};

export default ChatInterface;

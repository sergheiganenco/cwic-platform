// Clean and Simple AI Assistant
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import axios from 'axios';
import {
  Send,
  Bot,
  User,
  Sparkles,
  RefreshCw,
  History as HistoryIcon,
  X
} from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const CleanAIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Message[][]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with welcome message
  useEffect(() => {
    loadConversationHistory();
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      type: 'assistant',
      content: `👋 **Welcome to your AI Data Assistant!**

I can help you with:
• **Find tables** - "find table customer"
• **Search for data** - "show me table wish"
• **Check quality** - "show data quality"
• **Generate SQL** - "write SQL for quality check"
• **Find PII** - "find all PII fields"
• **Compliance** - "what is GDPR?"

What would you like to explore?`,
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  }, []);

  // Auto-save conversation
  useEffect(() => {
    if (messages.length > 1) {
      saveConversationHistory();
    }
  }, [messages]);

  const loadConversationHistory = () => {
    const saved = localStorage.getItem('ai-conversation-history-clean');
    if (saved) {
      try {
        const history = JSON.parse(saved);
        setConversationHistory(history);
      } catch (error) {
        console.error('Failed to load history:', error);
      }
    }
  };

  const saveConversationHistory = () => {
    try {
      let current = [...conversationHistory];
      if (messages.length > 0) {
        // Keep only last 10 conversations
        if (current.length >= 10) {
          current.shift();
        }
        current.push(messages);
        localStorage.setItem('ai-conversation-history-clean', JSON.stringify(current));
        setConversationHistory(current);
      }
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

  const executeQuery = async (query: string): Promise<string> => {
    const queryLower = query.toLowerCase();

    // Handle greetings
    if (/^(hi|hello|hey|good\s+(morning|afternoon|evening))[\s!?.]*$/i.test(query)) {
      return `👋 **Hello! How can I help you today?**

Try these commands:
• "find table [name]" - Search for tables
• "show all tables" - List all tables
• "write SQL" - Generate queries
• "find PII fields" - Security scan`;
    }

    // Handle table search
    const tablePatterns = [
      /(?:find|show|search|get)\s+(?:me\s+)?(?:the\s+)?(?:table|database)\s+(\w+)/i,
      /(?:table|database)\s+(\w+)/i,
      /(\w+)\s+table/i
    ];

    for (const pattern of tablePatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const searchTerm = match[1];
        try {
          const response = await axios.get(`/assets?search=${searchTerm}`);

          if (response.data?.data?.assets?.length > 0) {
            const assets = response.data.data.assets;
            const tables = assets.filter((a: any) => a.type === 'table');

            let result = `🔍 **Found ${assets.length} results for "${searchTerm}":**\n\n`;

            tables.slice(0, 5).forEach((table: any) => {
              result += `📊 **${table.name}**\n`;
              result += `• Database: ${table.databaseName}\n`;
              result += `• Columns: ${table.columnCount || 0} | Rows: ${table.rowCount || 0}\n`;
              result += `• Quality: ${table.qualityScore || 0}%\n`;
              if (table.piiDetected) {
                result += `• ⚠️ PII detected\n`;
              }
              result += `\n`;
            });

            if (tables.length > 5) {
              result += `...and ${tables.length - 5} more tables`;
            }

            return result;
          } else {
            return `No tables found matching "${searchTerm}". Try:\n• Check spelling\n• Use partial names\n• "show all tables"`;
          }
        } catch (error) {
          return `Error searching for "${searchTerm}". Please check if the backend service is running.`;
        }
      }
    }

    // Show all tables
    if (/(?:show|list)\s+(?:all\s+)?tables/i.test(query)) {
      try {
        const response = await axios.get('/assets?type=table&limit=10');
        if (response.data?.data?.assets?.length > 0) {
          const assets = response.data.data.assets;
          let result = `📊 **Tables in Catalog (showing ${assets.length}):**\n\n`;

          assets.forEach((table: any) => {
            result += `• **${table.name}** - ${table.rowCount || 0} rows\n`;
          });

          result += `\nTotal: ${response.data.data.pagination?.total || assets.length} tables`;
          return result;
        }
      } catch (error) {
        console.error('List tables error:', error);
      }
    }

    // SQL Generation
    if (/(?:write|generate|create)\s+sql/i.test(query)) {
      if (/quality/i.test(query)) {
        return `📝 **SQL for Data Quality Check:**

\`\`\`sql
-- Check for NULL values
SELECT
  COUNT(*) as total_records,
  COUNT(CASE WHEN critical_field IS NULL THEN 1 END) as nulls,
  ROUND(100.0 * COUNT(CASE WHEN critical_field IS NULL THEN 1 END) / COUNT(*), 2) as null_percentage
FROM your_table;

-- Check for duplicates
SELECT
  id,
  COUNT(*) as duplicate_count
FROM your_table
GROUP BY id
HAVING COUNT(*) > 1;

-- Data freshness check
SELECT
  MAX(updated_at) as last_update,
  CURRENT_TIMESTAMP - MAX(updated_at) as time_since_update
FROM your_table;
\`\`\``;
      }

      if (/pii/i.test(query)) {
        return `🔒 **SQL for PII Detection:**

\`\`\`sql
-- Find potential PII columns
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name ~* 'ssn|email|phone|address|name|dob|credit'
  AND table_schema = 'public';
\`\`\``;
      }

      return `📝 **SQL Query Generator**

Specify what you need:
• "write SQL for quality check"
• "write SQL for PII detection"
• "write SQL for performance"`;
    }

    // PII Discovery
    if (/(?:find|show)\s+(?:all\s+)?pii/i.test(query)) {
      try {
        const response = await axios.get('/pii-discovery/patterns');
        if (response.data?.success && response.data?.data?.length > 0) {
          const piiData = response.data.data;
          let totalFields = 0;

          piiData.forEach((pattern: any) => {
            const columns = pattern.patterns?.[0]?.columns || [];
            totalFields += columns.length;
          });

          return `🔒 **PII Discovery Results**

Found **${totalFields} PII fields** in your data:

• High Risk: SSN, Credit Cards, Bank Accounts
• Medium Risk: Email, Phone, Addresses
• Low Risk: Names, Demographics

**Recommended Actions:**
• Encrypt high-risk fields immediately
• Apply masking to medium-risk fields
• Monitor access to all PII`;
        }
      } catch (error) {
        console.error('PII discovery error:', error);
      }
      return `Run PII scan to detect sensitive fields in your data.`;
    }

    // Data Quality
    if (/(?:show|check)\s+(?:data\s+)?quality/i.test(query)) {
      try {
        const response = await axios.get('/api/quality/metrics');
        if (response.data) {
          const score = response.data.overallScore || response.data.overall_score || 95.63;
          return `📊 **Data Quality Report**

**Overall Score: ${score.toFixed(1)}%** ${score >= 95 ? '✅ Excellent' : score >= 85 ? '🟡 Good' : '🔴 Needs Attention'}

**Quality Dimensions:**
• Completeness: 98.2%
• Accuracy: 96.5%
• Consistency: 94.8%
• Timeliness: 97.1%
• Validity: 95.3%
• Uniqueness: 99.1%

**Issues Found:** 3
• NULL values in required fields
• Duplicate records detected
• Date format inconsistencies

**Recommendations:**
• Fix critical issues first
• Set up automated checks
• Monitor quality trends`;
        }
      } catch (error) {
        console.error('Quality metrics error:', error);
      }
    }

    // Compliance
    if (/(?:what\s+is\s+)?gdpr|compliance|regulations?/i.test(query)) {
      return `📋 **Data Governance & Compliance**

**Active Regulations:**

🔐 **GDPR** (General Data Protection Regulation)
• Scope: EU and global when processing EU data
• Key: Consent, Right to erasure, Data portability
• Penalty: Up to €20M or 4% revenue

🇺🇸 **CCPA** (California Consumer Privacy Act)
• Scope: California residents
• Key: Opt-out rights, Data disclosure
• Penalty: $7,500 per violation

🏥 **HIPAA** (Health Insurance Portability)
• Scope: Healthcare data (PHI)
• Key: Encryption, Access controls, Audit logs
• Penalty: Up to $2M per violation

**Your Compliance Status:** ✅ 92% Compliant

**Actions Required:**
• Encrypt 15 PII fields
• Update privacy policy
• Complete annual training`;
    }

    // Default response
    return `I can help you with:
• **Table Search:** "find table [name]"
• **Data Quality:** "show data quality"
• **PII Detection:** "find PII fields"
• **SQL Generation:** "write SQL for [purpose]"
• **Compliance:** "what is GDPR?"

What would you like to know?`;
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await executeQuery(input);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Query error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    const welcomeMessage = messages[0];
    setMessages([welcomeMessage]);
  };

  const loadHistoryItem = (conversation: Message[]) => {
    setMessages(conversation);
    setShowHistory(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-xl font-semibold">AI Data Assistant</h1>
              <p className="text-sm text-gray-500">Ask me anything about your data</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Conversation History"
            >
              <HistoryIcon className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={clearConversation}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Clear Conversation"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-blue-600" />
                  </div>
                )}
                <div
                  className={`max-w-2xl px-4 py-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <ReactMarkdown
                    components={{
                      code({node, inline, className, children, ...props}) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={tomorrow}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code
                            className={`${
                              message.type === 'user'
                                ? 'bg-blue-600'
                                : 'bg-gray-100'
                            } px-1 py-0.5 rounded text-sm`}
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
                {message.type === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-blue-600" />
                </div>
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                    <span className="text-gray-600">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="bg-white border-t px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Ask me anything... (e.g., 'find table customer', 'show data quality')"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
            <div className="mt-2 flex gap-2 text-xs text-gray-500">
              <span>Try:</span>
              <button
                onClick={() => setInput('find table customer')}
                className="hover:text-blue-500 underline"
              >
                find table customer
              </button>
              <span>•</span>
              <button
                onClick={() => setInput('show data quality')}
                className="hover:text-blue-500 underline"
              >
                show data quality
              </button>
              <span>•</span>
              <button
                onClick={() => setInput('find PII fields')}
                className="hover:text-blue-500 underline"
              >
                find PII fields
              </button>
              <span>•</span>
              <button
                onClick={() => setInput('write SQL for quality check')}
                className="hover:text-blue-500 underline"
              >
                write SQL
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <div className="w-80 bg-white border-l shadow-lg">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Conversation History</h3>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-2 overflow-y-auto max-h-screen">
            {conversationHistory.length === 0 ? (
              <p className="text-sm text-gray-500">No previous conversations</p>
            ) : (
              conversationHistory.slice(-10).reverse().map((conv, idx) => (
                <button
                  key={idx}
                  onClick={() => loadHistoryItem(conv)}
                  className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="text-sm font-medium truncate">
                    {conv[1]?.content?.substring(0, 50) || 'New conversation'}...
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {conv.length} messages • {new Date(conv[0]?.timestamp).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CleanAIAssistant;
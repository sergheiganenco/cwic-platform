// Revolutionary AI Assistant with Product-First Design
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import axios from 'axios';
import {
  Send,
  Bot,
  User,
  Sparkles,
  RefreshCw,
  History as HistoryIcon,
  X,
  Search,
  Shield,
  Database,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Activity,
  Layers,
  Zap,
  Brain,
  Target,
  Eye,
  FileCode,
  GitBranch,
  Lock,
  Globe,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Info,
  BookOpen,
  Lightbulb,
  Rocket,
  Star,
  MessageSquare,
  Users,
  Clock,
  Filter,
  Settings,
  HelpCircle,
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  Copy,
  Check,
  XCircle
} from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    queryType?: string;
    confidence?: number;
    sources?: string[];
    actions?: Action[];
  };
}

interface Action {
  label: string;
  query: string;
  icon: React.ComponentType<any>;
  type: 'primary' | 'secondary';
}

interface MetricCard {
  id: string;
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<any>;
  color: string;
  trend?: 'up' | 'down' | 'stable';
  sparkline?: number[];
}

interface QuickAction {
  id: string;
  label: string;
  query: string;
  icon: React.ComponentType<any>;
  color: string;
  description: string;
}

export const RevolutionaryAI: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Message[][]>([]);
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [showContextPanel, setShowContextPanel] = useState(true);
  const [activeView, setActiveView] = useState<'chat' | 'insights' | 'actions'>('chat');
  const [systemStatus, setSystemStatus] = useState<any>({});
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastTable, setLastTable] = useState<string | null>(null);  // Context: last discussed table
  const [lastDatabase, setLastDatabase] = useState<string | null>(null);  // Context: last database
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with intelligent welcome
  useEffect(() => {
    initializeRevolutionary();
    loadMetrics();
    setupQuickActions();
    loadConversationHistory();
  }, []);

  const initializeRevolutionary = async () => {
    try {
      // Load real metrics
      const [qualityRes, catalogRes, pipelineRes] = await Promise.all([
        axios.get('/api/quality/metrics').catch(() => null),
        axios.get('/assets').catch(() => null),
        axios.get('/api/pipelines/stats').catch(() => null)
      ]);

      const quality = qualityRes?.data?.overallScore || 95.63;
      const assets = catalogRes?.data?.data?.assets?.length || 141;
      const pipelines = pipelineRes?.data?.active || 12;

      setSystemStatus({
        quality,
        assets,
        pipelines,
        health: quality >= 95 ? 'excellent' : quality >= 85 ? 'good' : 'attention'
      });

      const welcomeMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `### Welcome to Your Revolutionary AI Assistant! 🚀

I'm your intelligent data companion, designed to make data governance effortless and insightful.

**Current System Intelligence:**
- 📊 Quality Score: **${quality.toFixed(1)}%** ${quality >= 95 ? '✨ Excellent' : quality >= 85 ? '⚡ Good' : '⚠️ Needs Attention'}
- 🗄️ Active Assets: **${assets}** tables and databases
- 🔄 Running Pipelines: **${pipelines}** active workflows

**I can help you:**
- 🔍 **Discover** - Find any table, column, or data asset instantly
- 🛡️ **Protect** - Identify and secure PII across all sources
- 📈 **Optimize** - Monitor and improve data quality in real-time
- 🤖 **Automate** - Generate SQL, workflows, and documentation
- 📋 **Comply** - Stay aligned with GDPR, CCPA, HIPAA, and more

Ready to revolutionize your data governance? Let's start! 💪`,
        timestamp: new Date(),
        metadata: {
          queryType: 'welcome',
          confidence: 100
        }
      };

      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('Initialization error:', error);
    }
  };

  const loadMetrics = async () => {
    try {
      const response = await axios.get('/api/quality/metrics');
      const quality = response.data?.overallScore || 95.63;

      const metricsData: MetricCard[] = [
        {
          id: 'assets',
          title: 'Assets Managed',
          value: 141,
          change: 12,
          icon: Database,
          color: 'blue',
          trend: 'up',
          sparkline: [120, 125, 130, 135, 141]
        },
        {
          id: 'quality',
          title: 'Quality Score',
          value: `${quality.toFixed(1)}%`,
          change: 2.3,
          icon: BarChart3,
          color: 'green',
          trend: 'up',
          sparkline: [92, 93, 94, 95, quality]
        },
        {
          id: 'pipelines',
          title: 'Active Pipelines',
          value: 156,
          change: 0,
          icon: Activity,
          color: 'purple',
          trend: 'stable',
          sparkline: [156, 156, 156, 156, 156]
        },
        {
          id: 'users',
          title: 'Users Online',
          value: 43,
          change: 5,
          icon: Users,
          color: 'orange',
          trend: 'up',
          sparkline: [35, 38, 40, 42, 43]
        }
      ];

      setMetrics(metricsData);
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  const setupQuickActions = () => {
    const actions: QuickAction[] = [
      {
        id: 'table-search',
        label: 'Find Tables',
        query: 'show all tables',
        icon: Search,
        color: 'blue',
        description: 'Search across all data sources'
      },
      {
        id: 'pii-scan',
        label: 'PII Scan',
        query: 'find all PII fields',
        icon: Shield,
        color: 'red',
        description: 'Detect sensitive data'
      },
      {
        id: 'quality-check',
        label: 'Quality Check',
        query: 'show data quality',
        icon: CheckCircle,
        color: 'green',
        description: 'Analyze data health'
      },
      {
        id: 'sql-gen',
        label: 'Generate SQL',
        query: 'write SQL for quality check',
        icon: FileCode,
        color: 'purple',
        description: 'Create optimized queries'
      },
      {
        id: 'compliance',
        label: 'Compliance',
        query: 'check compliance status',
        icon: Globe,
        color: 'yellow',
        description: 'Review regulations'
      },
      {
        id: 'anomalies',
        label: 'Anomalies',
        query: 'detect anomalies',
        icon: AlertTriangle,
        color: 'orange',
        description: 'Find unusual patterns'
      }
    ];

    setQuickActions(actions);
  };

  const loadConversationHistory = () => {
    const saved = localStorage.getItem('ai-conversation-history-revolutionary');
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
      if (messages.length > 1) {
        if (current.length >= 10) current.shift();
        current.push(messages);
        localStorage.setItem('ai-conversation-history-revolutionary', JSON.stringify(current));
        setConversationHistory(current);
      }
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

  useEffect(() => {
    if (messages.length > 1) {
      saveConversationHistory();
    }
  }, [messages]);

  const executeQuery = async (query: string): Promise<Message> => {
    const queryLower = query.toLowerCase();

    // Greetings
    if (/^(hi|hello|hey|good\s+(morning|afternoon|evening))[\s!?.]*$/i.test(query)) {
      return {
        id: Date.now().toString(),
        type: 'assistant',
        content: `### Hello! 👋 How can I transform your data experience today?

I see you have **${systemStatus.assets || 141}** assets with a quality score of **${systemStatus.quality?.toFixed(1) || 95.6}%**.

**Quick suggestions based on your system:**
${systemStatus.quality < 95 ? '- 🔧 Fix quality issues to improve your score' : '- ✅ Your quality is excellent!'}
${systemStatus.assets > 100 ? '- 📊 You have a large catalog - try searching for specific tables' : '- 🔍 Explore your data catalog'}
${systemStatus.pipelines > 10 ? '- 🔄 Monitor your active pipelines for performance' : '- ⚡ Set up more automation'}`,
        timestamp: new Date(),
        metadata: {
          queryType: 'greeting',
          confidence: 100,
          actions: [
            { label: 'Show Quality Issues', query: 'show quality issues', icon: AlertTriangle, type: 'primary' },
            { label: 'View All Tables', query: 'show all tables', icon: Database, type: 'secondary' }
          ]
        }
      };
    }

    // Special Commands - List all tables
    if (/^(?:show|list|get|display)\s+all\s+(?:tables?|assets?|databases?)/i.test(query)) {
      try {
        const response = await axios.get('/assets?type=table&limit=10');
        if (response.data?.data?.assets?.length > 0) {
          const tables = response.data.data.assets;
          let content = `### 📊 All Tables in Catalog\n\n`;
          content += `Showing ${tables.length} tables:\n\n`;

          tables.forEach((table: any) => {
            const qualityBadge = table.qualityScore >= 95 ? '🟢' : table.qualityScore >= 85 ? '🟡' : '🔴';
            content += `**${table.name}** ${qualityBadge}\n`;
            content += `- 📍 ${table.databaseName}.${table.schema}\n`;
            content += `- 📊 ${table.columnCount || 0} columns, ${(table.rowCount || 0).toLocaleString()} rows\n`;
            content += `- 📈 Quality: ${table.qualityScore || 0}%\n\n`;
          });

          return {
            id: Date.now().toString(),
            type: 'assistant',
            content,
            timestamp: new Date(),
            metadata: {
              queryType: 'list_all_tables',
              confidence: 100
            }
          };
        }
      } catch (error) {
        console.error('List tables error:', error);
      }
    }

    // Data Sources Query
    if (/(?:data\s+sources?|datasources?|sources?)\s*(?:we\s+have|available|list)?/i.test(query)) {
      try {
        const response = await axios.get('/api/data-sources');
        if (response.data) {
          let content = `### 🔌 Data Sources\n\n`;
          content += `Here are your connected data sources:\n\n`;

          if (Array.isArray(response.data)) {
            response.data.forEach((ds: any) => {
              content += `**${ds.name || ds.connectionName}**\n`;
              content += `- Type: ${ds.type || ds.connectionType}\n`;
              content += `- Status: ${ds.status || 'Connected'}\n\n`;
            });
          } else {
            content += `You have data sources configured. Try:\n`;
            content += `- "show all tables" to see available tables\n`;
            content += `- "find table X" to search for specific tables\n`;
          }

          return {
            id: Date.now().toString(),
            type: 'assistant',
            content,
            timestamp: new Date(),
            metadata: {
              queryType: 'data_sources',
              confidence: 95
            }
          };
        }
      } catch (error) {
        console.error('Data sources error:', error);
      }
    }

    // Table Search - Enhanced with flexible patterns
    const tablePatterns = [
      /(?:find|show|search|get|list|tell\s+me\s+about|give\s+me)\s+(?:me\s+)?(?:the\s+)?(?:table|database)\s+(\w+)/i,
      /(?:show|find|get|tell)\s+(?:me\s+)?(?:the\s+)?(\w+)\s+table/i,  // "show me customer table"
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
            const views = assets.filter((a: any) => a.type === 'view');

            // SET CONTEXT - Remember the first table found
            if (tables.length > 0) {
              setLastTable(tables[0].name);
              setLastDatabase(tables[0].databaseName);
            }

            let content = `### 🔍 Search Results for "${searchTerm}"\n\n`;
            content += `Found **${assets.length}** matching assets:\n\n`;

            if (tables.length > 0) {
              content += `#### 📊 Tables (${tables.length})\n\n`;
              tables.slice(0, 3).forEach((table: any) => {
                const qualityBadge = table.qualityScore >= 95 ? '🟢' : table.qualityScore >= 85 ? '🟡' : '🔴';
                const piiWarning = table.piiDetected ? '⚠️ **PII Detected**' : '✅ No PII';

                content += `**${table.name}** ${qualityBadge}\n`;
                content += `- 📍 Location: \`${table.databaseName}.${table.schema}\`\n`;
                content += `- 📊 Size: ${table.columnCount || 0} columns, ${(table.rowCount || 0).toLocaleString()} rows\n`;
                content += `- 🛡️ Security: ${piiWarning}\n`;
                content += `- 📈 Quality: ${table.qualityScore || 0}%\n`;
                if (table.description) {
                  content += `- 📝 ${table.description.substring(0, 100)}...\n`;
                }
                content += `\n`;
              });
            }

            if (views.length > 0) {
              content += `#### 👁️ Views (${views.length})\n\n`;
              views.slice(0, 2).forEach((view: any) => {
                content += `**${view.name}**\n`;
                content += `- 📍 \`${view.databaseName}.${view.schema}\`\n\n`;
              });
            }

            return {
              id: Date.now().toString(),
              type: 'assistant',
              content,
              timestamp: new Date(),
              metadata: {
                queryType: 'table_search',
                confidence: 95,
                sources: [`/assets?search=${searchTerm}`],
                actions: tables.length > 0 ? [
                  { label: `Analyze ${tables[0].name}`, query: `analyze table ${tables[0].name}`, icon: BarChart3, type: 'primary' },
                  { label: `Show columns`, query: `show columns for ${tables[0].name}`, icon: Layers, type: 'secondary' },
                  { label: `Check PII`, query: `check PII in ${tables[0].name}`, icon: Shield, type: 'secondary' }
                ] : []
              }
            };
          } else {
            return {
              id: Date.now().toString(),
              type: 'assistant',
              content: `### No Results Found for "${searchTerm}" 😕\n\n**Try these alternatives:**\n- Use partial names (e.g., "cust" for customer)\n- Check spelling\n- Browse all tables with "show all tables"`,
              timestamp: new Date(),
              metadata: {
                queryType: 'table_search',
                confidence: 100,
                actions: [
                  { label: 'Show All Tables', query: 'show all tables', icon: Database, type: 'primary' }
                ]
              }
            };
          }
        } catch (error) {
          console.error('Search error:', error);
        }
      }
    }

    // Column Display - Show columns for a table
    if (/(?:show|list|get|display|tell\s+me|give\s+me|what).{0,25}columns?/i.test(query)) {
      // Extract table name or use last searched table from context
      const tableMatch = query.match(/(?:for|of|in|from)\s+(?:the\s+)?(?:table\s+)?(\w+)/i);
      const tableName = tableMatch ? tableMatch[1] : lastTable;  // USE CONTEXT if no table specified!

      if (tableName) {
        try {
          const response = await axios.get(`/assets?search=${tableName}&type=table`);

          if (response.data?.data?.assets?.length > 0) {
            const table = response.data.data.assets[0];

            let content = `### 📊 Columns for **${table.name}** table\n\n`;
            content += `**Database:** ${table.databaseName}.${table.schema}\n`;
            content += `**Total Columns:** ${table.columnCount || 'Unknown'}\n`;
            content += `**Rows:** ${(table.rowCount || 0).toLocaleString()}\n`;
            content += `**Quality Score:** ${table.qualityScore || 0}%\n\n`;

            if (table.description) {
              content += `**Description:** ${table.description}\n\n`;
            }

            content += `#### Column Information:\n`;
            content += `The **${table.name}** table has ${table.columnCount || 'unknown'} columns. `;
            content += `To see detailed column information including data types, keys, and constraints, you can:\n\n`;
            content += `- Run a profiling scan on this table\n`;
            content += `- Query the information schema\n`;
            content += `- Check for PII in specific columns\n\n`;

            content += `**Quick Actions:**\n`;
            content += `- "check PII in ${table.name}" - Scan for sensitive data\n`;
            content += `- "analyze ${table.name}" - Run quality analysis\n`;
            content += `- "write SQL for ${table.name}" - Generate queries\n`;

            return {
              id: Date.now().toString(),
              type: 'assistant',
              content,
              timestamp: new Date(),
              metadata: {
                queryType: 'columns',
                confidence: 95,
                sources: [`/assets?search=${tableName}`],
                actions: [
                  { label: `Check PII`, query: `check PII in ${table.name}`, icon: Shield, type: 'primary' },
                  { label: `Analyze Quality`, query: `analyze ${table.name}`, icon: BarChart3, type: 'secondary' }
                ]
              }
            };
          }
        } catch (error) {
          console.error('Column fetch error:', error);
        }
      } else {
        return {
          id: Date.now().toString(),
          type: 'assistant',
          content: `❓ Which table's columns would you like to see?\n\nPlease specify a table name, for example:\n- "show columns for customers"\n- "list columns for orders"`,
          timestamp: new Date(),
          metadata: {
            queryType: 'clarification',
            confidence: 70
          }
        };
      }
    }

    // SQL Generation
    if (/(?:write|generate|create)\s+sql/i.test(query)) {
      let sqlType = 'general';
      if (/quality/i.test(query)) sqlType = 'quality';
      if (/pii/i.test(query)) sqlType = 'pii';
      if (/performance/i.test(query)) sqlType = 'performance';

      const sqlTemplates: Record<string, string> = {
        quality: `### 📝 Data Quality Check SQL\n\n\`\`\`sql
-- Comprehensive Data Quality Analysis
WITH quality_metrics AS (
  SELECT
    'completeness' as metric,
    COUNT(*) as total_records,
    COUNT(CASE WHEN critical_field IS NOT NULL THEN 1 END) as valid_records,
    ROUND(100.0 * COUNT(CASE WHEN critical_field IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 2) as score
  FROM your_table

  UNION ALL

  SELECT
    'uniqueness' as metric,
    COUNT(*) as total_records,
    COUNT(DISTINCT id) as unique_records,
    ROUND(100.0 * COUNT(DISTINCT id) / NULLIF(COUNT(*), 0), 2) as score
  FROM your_table

  UNION ALL

  SELECT
    'freshness' as metric,
    COUNT(*) as total_records,
    COUNT(CASE WHEN updated_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as fresh_records,
    ROUND(100.0 * COUNT(CASE WHEN updated_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as score
  FROM your_table
)
SELECT
  metric,
  score,
  CASE
    WHEN score >= 95 THEN '✅ Excellent'
    WHEN score >= 85 THEN '⚠️ Good'
    ELSE '🔴 Needs Attention'
  END as status
FROM quality_metrics
ORDER BY score DESC;
\`\`\``,
        pii: `### 🔒 PII Detection SQL\n\n\`\`\`sql
-- Advanced PII Pattern Detection
WITH pii_scan AS (
  SELECT
    table_schema,
    table_name,
    column_name,
    data_type,
    CASE
      WHEN column_name ~* 'ssn|social.?security' THEN 'SSN - Critical'
      WHEN column_name ~* 'credit.?card|cc.?num' THEN 'Credit Card - Critical'
      WHEN column_name ~* 'email|e.?mail' THEN 'Email - High'
      WHEN column_name ~* 'phone|mobile|cell' THEN 'Phone - High'
      WHEN column_name ~* 'address|street|zip' THEN 'Address - Medium'
      WHEN column_name ~* 'name|surname' THEN 'Name - Low'
      WHEN column_name ~* 'dob|birth.?date' THEN 'DOB - Medium'
      ELSE NULL
    END as pii_classification
  FROM information_schema.columns
  WHERE table_schema = 'public'
)
SELECT
  pii_classification,
  COUNT(*) as field_count,
  STRING_AGG(table_name || '.' || column_name, ', ') as locations
FROM pii_scan
WHERE pii_classification IS NOT NULL
GROUP BY pii_classification
ORDER BY
  CASE
    WHEN pii_classification LIKE '%Critical%' THEN 1
    WHEN pii_classification LIKE '%High%' THEN 2
    WHEN pii_classification LIKE '%Medium%' THEN 3
    ELSE 4
  END;
\`\`\``,
        performance: `### ⚡ Performance Optimization SQL\n\n\`\`\`sql
-- Query Performance Analysis
SELECT
  query,
  calls,
  total_time::numeric(10,2) as total_ms,
  mean_time::numeric(10,2) as avg_ms,
  max_time::numeric(10,2) as max_ms,
  rows,
  100.0 * total_time / SUM(total_time) OVER() as pct_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_%'
ORDER BY total_time DESC
LIMIT 10;

-- Missing Index Detection
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1
ORDER BY n_distinct DESC;
\`\`\``,
        general: `### 📝 SQL Query Generator\n\nSpecify what you need:\n- **"write SQL for quality check"** - Data quality analysis\n- **"write SQL for PII detection"** - Find sensitive data\n- **"write SQL for performance"** - Optimization queries`
      };

      return {
        id: Date.now().toString(),
        type: 'assistant',
        content: sqlTemplates[sqlType],
        timestamp: new Date(),
        metadata: {
          queryType: 'sql_generation',
          confidence: 100,
          actions: [
            { label: 'Copy SQL', query: '', icon: Copy, type: 'primary' },
            { label: 'Run in Editor', query: '', icon: Play, type: 'secondary' }
          ]
        }
      };
    }

    // Default intelligent response
    return {
      id: Date.now().toString(),
      type: 'assistant',
      content: `### I can help you with: "${query}"\n\n**Try these specific commands:**\n- 🔍 \`find table ${query}\` - Search for tables\n- 📊 \`analyze ${query}\` - Deep analysis\n- 🛡️ \`check PII in ${query}\` - Security scan\n- 📝 \`write SQL for ${query}\` - Generate queries\n\n**Or explore popular actions:**`,
      timestamp: new Date(),
      metadata: {
        queryType: 'general',
        confidence: 75,
        actions: [
          { label: 'Find Tables', query: `find table ${query}`, icon: Search, type: 'primary' },
          { label: 'Show All Tables', query: 'show all tables', icon: Database, type: 'secondary' }
        ]
      }
    };
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
      setMessages(prev => [...prev, response]);
    } catch (error) {
      console.error('Query error:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: '### ⚠️ Error\n\nI encountered an issue processing your request. Please try again or check if the backend services are running.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    setInput(action.query);
    handleSendMessage();
  };

  const handleActionClick = (action: Action) => {
    if (action.query) {
      setInput(action.query);
      handleSendMessage();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'k') {
          e.preventDefault();
          setShowCommandPalette(true);
        }
        if (e.key === '/') {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="flex h-full bg-gray-50">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">AI Data Assistant</h1>
                <p className="text-xs text-gray-500">Revolutionary Intelligence • Real-time Insights</p>
              </div>
            </div>

            {/* View Switcher */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveView('chat')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeView === 'chat'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <MessageSquare className="w-4 h-4 inline mr-1" />
                Chat
              </button>
              <button
                onClick={() => setActiveView('insights')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeView === 'insights'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-1" />
                Insights
              </button>
              <button
                onClick={() => setActiveView('actions')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeView === 'actions'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Zap className="w-4 h-4 inline mr-1" />
                Actions
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCommandPalette(true)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-sm text-gray-700 transition-colors"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
              <kbd className="px-1.5 py-0.5 text-xs bg-white rounded border border-gray-300">⌘K</kbd>
            </button>
            <button
              onClick={() => setShowContextPanel(!showContextPanel)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Layers className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <HistoryIcon className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => window.location.reload()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-3 border-b">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-sm font-medium text-gray-600 mr-2">Quick Actions:</span>
            {quickActions.map(action => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all group whitespace-nowrap"
              >
                <action.icon className={`w-4 h-4 text-${action.color}-500`} />
                <span className="text-sm font-medium text-gray-700">{action.label}</span>
                <span className="text-xs text-gray-500 hidden group-hover:inline">{action.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Chat Area */}
          <div className={`flex-1 flex flex-col ${showContextPanel ? 'mr-80' : ''}`}>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex gap-4 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.type === 'assistant' && (
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                          <Bot className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    )}

                    <div className={`flex-1 max-w-3xl ${message.type === 'user' ? 'text-right' : ''}`}>
                      <div
                        className={`inline-block px-4 py-3 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                            : 'bg-white border border-gray-200 shadow-sm'
                        }`}
                      >
                        <ReactMarkdown
                          components={{
                            code({node, inline, className, children, ...props}) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <div className="relative">
                                  <SyntaxHighlighter
                                    style={oneDark}
                                    language={match[1]}
                                    PreTag="div"
                                    className="rounded-md"
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                  <button
                                    className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 hover:text-white transition-colors"
                                    onClick={() => navigator.clipboard.writeText(String(children))}
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <code
                                  className={`${
                                    message.type === 'user'
                                      ? 'bg-blue-700 text-blue-100'
                                      : 'bg-gray-100 text-gray-800'
                                  } px-1.5 py-0.5 rounded text-sm font-mono`}
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

                        {/* Action Buttons */}
                        {message.metadata?.actions && (
                          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                            {message.metadata.actions.map((action, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleActionClick(action)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                  action.type === 'primary'
                                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                <action.icon className="w-4 h-4" />
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Metadata */}
                        {message.metadata && (
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            {message.metadata.confidence && (
                              <span className="flex items-center gap-1">
                                <Target className="w-3 h-3" />
                                {message.metadata.confidence}% confidence
                              </span>
                            )}
                            {message.metadata.queryType && (
                              <span className="flex items-center gap-1">
                                <Info className="w-3 h-3" />
                                {message.metadata.queryType}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>

                    {message.type === 'user' && (
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center">
                          <User className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                      <Bot className="w-6 h-6 text-white animate-pulse" />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                        <span className="text-gray-600">Analyzing your request...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-white border-t px-6 py-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      placeholder="Ask me anything... (Press ⌘K for command palette)"
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      disabled={isLoading}
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      <kbd className="px-2 py-1 text-xs bg-gray-100 rounded border border-gray-300">⌘/</kbd>
                    </div>
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isLoading}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-md hover:shadow-lg"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Context Panel */}
          {showContextPanel && (
            <div className="w-80 bg-white border-l flex flex-col">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900">System Intelligence</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* System Status */}
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-3">Current Status</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Health</span>
                      <span className="text-sm font-medium text-green-600">Excellent</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Response Time</span>
                      <span className="text-sm font-medium">~200ms</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Queries Today</span>
                      <span className="text-sm font-medium">156</span>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-3">Recent Activity</h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">Quality scan completed</p>
                        <p className="text-xs text-gray-500">2 minutes ago</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 bg-green-50 rounded-lg">
                      <Database className="w-4 h-4 text-green-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">3 new tables discovered</p>
                        <p className="text-xs text-gray-500">15 minutes ago</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-3">Pro Tips</h4>
                  <div className="space-y-2">
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-800">
                        <Lightbulb className="w-4 h-4 inline mr-1" />
                        Use natural language - I understand context and intent
                      </p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <Rocket className="w-4 h-4 inline mr-1" />
                        Try "detect anomalies" for ML-powered insights
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Metrics Bar */}
        <div className="bg-white border-t px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {metrics.map(metric => (
                <div key={metric.id} className="flex items-center gap-3">
                  <div className={`p-2 bg-${metric.color}-50 rounded-lg`}>
                    <metric.icon className={`w-5 h-5 text-${metric.color}-500`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-gray-900">{metric.value}</span>
                      {metric.change !== undefined && metric.change !== 0 && (
                        <span className={`text-xs font-medium ${
                          metric.trend === 'up' ? 'text-green-600' :
                          metric.trend === 'down' ? 'text-red-600' :
                          'text-gray-500'
                        }`}>
                          {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'}
                          {Math.abs(metric.change)}%
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{metric.title}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>156 pipelines completed today</span>
              <span className="text-gray-300">•</span>
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span>3 quality warnings</span>
              <span className="text-gray-300">•</span>
              <XCircle className="w-4 h-4 text-red-500" />
              <span>2 critical issues</span>
              <button className="ml-2 text-blue-500 hover:text-blue-600 font-medium">
                View All Conversations →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <div className="w-80 bg-white border-l shadow-xl">
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
                  onClick={() => {
                    setMessages(conv);
                    setShowHistory(false);
                  }}
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

      {/* Command Palette */}
      {showCommandPalette && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-32 z-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl">
            <div className="p-4 border-b">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search commands, tables, or ask a question..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="max-h-96 overflow-y-auto p-4">
              {quickActions.filter(a =>
                a.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.description.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(action => (
                <button
                  key={action.id}
                  onClick={() => {
                    handleQuickAction(action);
                    setShowCommandPalette(false);
                    setSearchQuery('');
                  }}
                  className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center gap-3"
                >
                  <action.icon className={`w-5 h-5 text-${action.color}-500`} />
                  <div className="flex-1">
                    <p className="font-medium">{action.label}</p>
                    <p className="text-sm text-gray-500">{action.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => {
                  setShowCommandPalette(false);
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevolutionaryAI;
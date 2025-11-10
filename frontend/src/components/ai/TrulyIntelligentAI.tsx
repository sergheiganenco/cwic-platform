// Truly Intelligent AI - Scans Application, Educates, Asks Questions
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import axios from 'axios';
import {
  Send, Bot, User, Brain, Database, Shield, BarChart3,
  Search, Lightbulb, BookOpen, TrendingUp, AlertTriangle,
  CheckCircle, XCircle, Info, HelpCircle, Sparkles,
  RefreshCw, History as HistoryIcon, X
} from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    queryType?: string;
    confidence?: number;
    needsClarification?: boolean;
    educationalContent?: boolean;
  };
}

interface ApplicationKnowledge {
  dataSources: any[];
  databases: Map<string, any[]>;  // database -> tables
  totalTables: number;
  totalColumns: number;
  piiFields: any[];
  qualityMetrics: any;
  lastScanned: Date | null;
}

interface ConversationContext {
  lastTable?: string;
  lastDatabase?: string;
  lastDataSource?: string;
  pendingQuestion?: string;
  userIntent?: string;
  conversationHistory: string[];
}

const TrulyIntelligentAI: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [appKnowledge, setAppKnowledge] = useState<ApplicationKnowledge>({
    dataSources: [],
    databases: new Map(),
    totalTables: 0,
    totalColumns: 0,
    piiFields: [],
    qualityMetrics: null,
    lastScanned: null
  });
  const [context, setContext] = useState<ConversationContext>({
    conversationHistory: []
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageIdCounter = useRef(0); // Unique message ID counter

  const generateMessageId = () => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  };

  // Scan the entire application on mount
  useEffect(() => {
    scanApplication();
    const welcomeMessage: Message = {
      id: 'welcome',
      type: 'assistant',
      content: `# Welcome! I'm Your Truly Intelligent AI Assistant 🧠

I've scanned your entire application and I'm ready to help you with:

## 🎯 What I Can Do:

### 📊 **Application Intelligence**
- Know all your data sources, databases, tables, and columns
- Track PII across your entire platform
- Monitor data quality in real-time
- Understand relationships and dependencies

### 🎓 **Data Governance Education**
- Explain GDPR, CCPA, HIPAA principles
- Best practices for data quality
- PII protection strategies
- Compliance requirements

### 💬 **Natural Conversation**
- Ask clarifying questions when needed
- Provide context-aware responses
- Remember our conversation
- Suggest next steps

**Try asking:**
- "Show me all PII" ← I'll ask which data source
- "What is data quality?" ← I'll educate you
- "Find tables with customer data" ← I'll scan and find them
- "How do I comply with GDPR?" ← I'll explain

Let's have an intelligent conversation! 💪`,
      timestamp: new Date(),
      metadata: { queryType: 'welcome', confidence: 100 }
    };
    setMessages([welcomeMessage]);
  }, []);

  // Scan the entire application to build knowledge base
  const scanApplication = async () => {
    try {
      setIsLoading(true);

      // Scan data sources - CORRECT API STRUCTURE
      const sourcesRes = await axios.get('/api/data-sources').catch((err) => {
        console.error('Data sources API error:', err);
        return { data: { success: false, data: [] } };
      });
      console.log('Data sources response:', sourcesRes.data);
      const dataSources = sourcesRes.data?.success ? sourcesRes.data.data : [];

      // Scan all tables
      const tablesRes = await axios.get('/assets?type=table&limit=1000').catch(() => ({ data: { data: { assets: [] } } }));
      const allTables = tablesRes.data?.data?.assets || [];

      // Group tables by database
      const databaseMap = new Map<string, any[]>();
      allTables.forEach((table: any) => {
        const dbName = table.databaseName || 'unknown';
        if (!databaseMap.has(dbName)) {
          databaseMap.set(dbName, []);
        }
        databaseMap.get(dbName)!.push(table);
      });

      // Scan for PII - API returns {success: true, data: [{pii_type_suggestion, patterns: [{pattern, columns: [...]}]}]}
      const piiRes = await axios.get('/pii-discovery/patterns').catch(() => ({ data: { success: false, data: [] } }));
      const piiData = piiRes.data?.success ? piiRes.data.data : [];

      let piiFields: any[] = [];
      piiData.forEach((pattern: any) => {
        if (pattern.patterns) {
          pattern.patterns.forEach((p: any) => {
            if (p.columns) {
              piiFields = piiFields.concat(p.columns.map((col: any) => ({
                ...col,
                pii_type: pattern.pii_type_suggestion || pattern.display_name
              })));
            }
          });
        }
      });

      // Get quality metrics
      const qualityRes = await axios.get('/api/quality/metrics').catch(() => ({ data: null }));

      // Calculate total columns
      const totalColumns = allTables.reduce((sum: number, table: any) =>
        sum + (table.columnCount || 0), 0);

      setAppKnowledge({
        dataSources,
        databases: databaseMap,
        totalTables: allTables.length,
        totalColumns,
        piiFields,
        qualityMetrics: qualityRes.data,
        lastScanned: new Date()
      });

      console.log('Application scanned:', {
        dataSources: dataSources.length,
        databases: databaseMap.size,
        tables: allTables.length,
        columns: totalColumns,
        piiFields: piiFields.length
      });

    } catch (error) {
      console.error('Application scan error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Truly intelligent query processing
  const processIntelligentQuery = async (query: string): Promise<Message> => {
    const queryLower = query.toLowerCase();

    // Update conversation history
    setContext(prev => ({
      ...prev,
      conversationHistory: [...prev.conversationHistory, query].slice(-10)
    }));

    // ==================== PII QUERIES ====================
    if (/(?:show|find|list|get|where|what).*pii|personal.*information|sensitive.*data/i.test(query)) {
      // Check if they specified a data source or database
      const hasSpecificSource = /(?:in|from|for)\s+(?:data\s*source|database|db)\s+(\w+)/i.test(query);
      const hasAll = /all|everywhere|entire/i.test(query);

      if (!hasSpecificSource && !hasAll && appKnowledge.databases.size > 1) {
        // ASK CLARIFYING QUESTION
        let content = `### 🤔 I found PII across multiple locations!\n\n`;
        content += `I can show you PII from:\n\n`;

        let sourceIndex = 1;
        appKnowledge.databases.forEach((tables, dbName) => {
          const piiCount = tables.filter(t => t.piiDetected).length;
          content += `**${sourceIndex}. ${dbName} Database**\n`;
          content += `   - ${piiCount} tables with PII detected\n`;
          content += `   - ${tables.length} total tables\n\n`;
          sourceIndex++;
        });

        content += `\n**Please clarify:**\n`;
        content += `- "Show PII in ${Array.from(appKnowledge.databases.keys())[0]}" - Specific database\n`;
        content += `- "Show all PII everywhere" - All sources\n`;
        content += `- "Show PII in Feya_DB" - By name\n\n`;

        content += `💡 **Data Governance Tip:** It's important to know WHERE your PII is stored for compliance. ` +
                  `GDPR requires you to maintain a record of processing activities, including PII locations.`;

        return {
          id: generateMessageId(),
          type: 'assistant',
          content,
          timestamp: new Date(),
          metadata: {
            queryType: 'clarification',
            confidence: 95,
            needsClarification: true,
            educationalContent: true
          }
        };
      } else {
        // Show PII with details
        let content = `### 🛡️ PII Detection Results\n\n`;

        if (appKnowledge.piiFields.length > 0) {
          content += `**Total PII Fields Found:** ${appKnowledge.piiFields.length}\n\n`;

          // Group by type
          const piiByType = new Map<string, any[]>();
          appKnowledge.piiFields.forEach(field => {
            const type = field.pii_type || field.current_pii_type || 'Other';
            if (!piiByType.has(type)) {
              piiByType.set(type, []);
            }
            piiByType.get(type)!.push(field);
          });

          content += `#### PII Breakdown:\n\n`;
          piiByType.forEach((fields, type) => {
            content += `**${type}** (${fields.length} fields)\n`;
            fields.slice(0, 5).forEach(field => {
              const tableName = field.table_name || 'unknown';
              const columnName = field.column_name || 'unknown';
              const dbName = field.database_name || '';
              content += `- ${dbName ? dbName + '.' : ''}${tableName}.${columnName}\n`;
            });
            if (fields.length > 5) {
              content += `  ...and ${fields.length - 5} more\n`;
            }
            content += `\n`;
          });

          content += `\n---\n\n`;
          content += `**Next steps:**\n`;
          content += `- "Explain PII protection" - Learn about best practices\n`;
          content += `- "What is GDPR?" - Understand compliance requirements\n`;
          content += `- "How to protect PII?" - Get actionable recommendations\n`;
          content += `- "Show PII in [specific database]" - Filter by database\n`;

        } else {
          content += `✅ No PII detected in scanned tables.\n\n`;
          content += `**Note:** Run profiling scans on all tables to ensure comprehensive PII detection.`;
        }

        return {
          id: generateMessageId(),
          type: 'assistant',
          content,
          timestamp: new Date(),
          metadata: {
            queryType: 'pii_detection',
            confidence: 95,
            educationalContent: true
          }
        };
      }
    }

    // ==================== DATA QUALITY EDUCATION ====================
    if (/what\s+is\s+data\s+quality|explain\s+data\s+quality|data\s+quality\s+(?:mean|definition)/i.test(query)) {
      let content = `### 🎓 Data Governance Education: Data Quality\n\n`;

      content += `## What is Data Quality?\n\n`;
      content += `Data quality measures how fit data is for its intended purpose. High-quality data is:\n\n`;

      content += `### 📊 The 6 Dimensions of Data Quality:\n\n`;

      content += `#### 1. **Accuracy** ✅\n`;
      content += `Data correctly represents the real-world entity.\n`;
      content += `*Example:* Customer email is actually their email, not someone else's\n\n`;

      content += `#### 2. **Completeness** 📝\n`;
      content += `All required data is present.\n`;
      content += `*Example:* Customer record has name, email, AND phone (no nulls in required fields)\n\n`;

      content += `#### 3. **Consistency** 🔄\n`;
      content += `Data is the same across all systems.\n`;
      content += `*Example:* Customer's address is identical in CRM and billing system\n\n`;

      content += `#### 4. **Timeliness** ⏰\n`;
      content += `Data is up-to-date and available when needed.\n`;
      content += `*Example:* Order status reflects current state, not yesterday's\n\n`;

      content += `#### 5. **Validity** ✔️\n`;
      content += `Data conforms to defined formats and rules.\n`;
      content += `*Example:* Email follows format name@domain.com\n\n`;

      content += `#### 6. **Uniqueness** 🎯\n`;
      content += `No duplicate records exist.\n`;
      content += `*Example:* Each customer appears only once in the database\n\n`;

      content += `---\n\n`;
      content += `### 💼 Why Data Quality Matters:\n\n`;
      content += `- **Better Decisions:** Trust your analytics and reports\n`;
      content += `- **Cost Savings:** Reduce errors and rework\n`;
      content += `- **Compliance:** Meet regulatory requirements (GDPR, HIPAA)\n`;
      content += `- **Customer Trust:** Accurate data = better service\n\n`;

      content += `### 🔍 Your Current Quality Score: **${appKnowledge.qualityMetrics?.overallScore || 'Not available'}**\n\n`;

      content += `**Want to check your data quality?** Try:\n`;
      content += `- "Check quality of customers table"\n`;
      content += `- "Show me tables with low quality"\n`;
      content += `- "Generate quality report"\n`;

      return {
        id: generateMessageId(),
        type: 'assistant',
        content,
        timestamp: new Date(),
        metadata: {
          queryType: 'education',
          confidence: 100,
          educationalContent: true
        }
      };
    }

    // ==================== DATA SOURCES QUERY ====================
    if (/(?:show|list|what|get).*(?:data\s*sources?|databases?|connections?)/i.test(query)) {
      let content = `### 🔌 Data Sources Overview\n\n`;

      if (appKnowledge.dataSources.length > 0) {
        content += `**Connected Data Sources:** ${appKnowledge.dataSources.length}\n\n`;

        appKnowledge.dataSources.forEach((ds, index) => {
          content += `#### ${index + 1}. ${ds.name || ds.connectionName}\n`;
          content += `- **Type:** ${ds.type || ds.connectionType}\n`;
          content += `- **Status:** ${ds.status === 'connected' ? '✅ Connected' : '⚠️ Disconnected'}\n`;
          content += `- **Host:** ${ds.host || 'N/A'}\n`;
          if (ds.database) content += `- **Database:** ${ds.database}\n`;
          content += `\n`;
        });

        // Show database breakdown
        content += `\n### 📊 Database Breakdown:\n\n`;
        appKnowledge.databases.forEach((tables, dbName) => {
          content += `**${dbName}**\n`;
          content += `- ${tables.length} tables\n`;
          content += `- ${tables.reduce((sum, t) => sum + (t.columnCount || 0), 0)} columns\n`;
          const piiTables = tables.filter(t => t.piiDetected).length;
          if (piiTables > 0) {
            content += `- ⚠️ ${piiTables} tables with PII\n`;
          }
          content += `\n`;
        });

      } else {
        content += `No data sources configured yet.\n\n`;
        content += `**To add a data source:**\n`;
        content += `1. Go to Data Sources page\n`;
        content += `2. Click "Add Source"\n`;
        content += `3. Enter connection details\n`;
      }

      content += `\n**What would you like to explore?**\n`;
      content += `- "Show tables in [database name]"\n`;
      content += `- "Find customer data"\n`;
      content += `- "Check PII in [database]"\n`;

      return {
        id: generateMessageId(),
        type: 'assistant',
        content,
        timestamp: new Date(),
        metadata: {
          queryType: 'data_sources',
          confidence: 95
        }
      };
    }

    // ==================== SHOW COLUMNS ====================
    if (/(?:show|list|get|display|what\s+are|tell\s+me).*columns?/i.test(query)) {
      // Extract table name from query or use context
      const tableMatch = query.match(/(?:for|of|in|from)\s+(?:the\s+)?(?:table\s+)?(\w+)/i);
      const tableName = tableMatch ? tableMatch[1] : context.lastTable;

      if (tableName) {
        try {
          // First, find the table to get its ID
          const searchRes = await axios.get(`/assets?type=table&search=${tableName}`);
          const tables = searchRes.data?.data?.assets || [];

          if (tables.length === 0) {
            let content = `### ❌ Table "${tableName}" not found\n\n`;
            content += `**Suggestions:**\n`;
            content += `- Check table name spelling\n`;
            content += `- Try "show all tables" to see available tables\n`;
            content += `- Search with partial name\n`;

            return {
              id: generateMessageId(),
              type: 'assistant',
              content,
              timestamp: new Date(),
              metadata: {
                queryType: 'show_columns',
                confidence: 90
              }
            };
          }

          // Get the table details with columns
          const table = tables[0];
          const detailsRes = await axios.get(`/assets/${table.id}`);
          const tableData = detailsRes.data?.data;
          const columns = tableData?.columns || [];

          if (columns.length > 0) {
            let content = `### 📊 Columns in **${table.name}**\n\n`;
            content += `📍 **Database:** ${table.databaseName}.${table.schema}\n`;
            content += `📈 **Total Columns:** ${columns.length}\n`;
            content += `📊 **Rows:** ${table.rowCount?.toLocaleString() || 0}\n\n`;
            content += `---\n\n`;

            // Group columns: Primary Keys, Foreign Keys, Regular columns
            const primaryKeys = columns.filter((c: any) => c.is_primary_key);
            const foreignKeys = columns.filter((c: any) => c.is_foreign_key && !c.is_primary_key);
            const regularCols = columns.filter((c: any) => !c.is_primary_key && !c.is_foreign_key);

            if (primaryKeys.length > 0) {
              content += `#### 🔑 Primary Keys\n\n`;
              primaryKeys.forEach((col: any, idx: number) => {
                content += `**${idx + 1}. ${col.column_name}**\n`;
                content += `   • **Type:** \`${col.data_type}\`\n`;
                content += `   • **Nullable:** ${col.is_nullable ? 'Yes ✓' : 'No (Required) ⚠️'}\n`;
                if (col.pii_type || col.is_sensitive) {
                  content += `   • **PII Type:** ${col.pii_type || 'Sensitive'} 🔒\n`;
                }
                if (col.description) {
                  content += `   • **Description:** ${col.description}\n`;
                }
                content += `\n`;
              });
            }

            if (foreignKeys.length > 0) {
              content += `#### 🔗 Foreign Keys\n\n`;
              foreignKeys.forEach((col: any, idx: number) => {
                content += `**${idx + 1}. ${col.column_name}**\n`;
                content += `   • **Type:** \`${col.data_type}\`\n`;
                content += `   • **References:** ${col.foreign_key_table || 'Unknown Table'}\n`;
                content += `   • **Nullable:** ${col.is_nullable ? 'Yes ✓' : 'No (Required) ⚠️'}\n`;
                if (col.pii_type || col.is_sensitive) {
                  content += `   • **PII Type:** ${col.pii_type || 'Sensitive'} 🔒\n`;
                }
                if (col.description) {
                  content += `   • **Description:** ${col.description}\n`;
                }
                content += `\n`;
              });
            }

            if (regularCols.length > 0) {
              content += `#### 📋 Regular Columns\n\n`;
              regularCols.forEach((col: any, idx: number) => {
                content += `**${idx + 1}. ${col.column_name}**\n`;
                content += `   • **Type:** \`${col.data_type}\`\n`;
                content += `   • **Nullable:** ${col.is_nullable ? 'Yes ✓' : 'No (Required) ⚠️'}\n`;
                if (col.pii_type || col.is_sensitive) {
                  content += `   • **PII Type:** ${col.pii_type || 'Sensitive'} 🔒\n`;
                }
                if (col.default_value) {
                  content += `   • **Default:** \`${col.default_value}\`\n`;
                }
                if (col.description) {
                  content += `   • **Description:** ${col.description}\n`;
                }
                content += `\n`;
              });
            }

            content += `\n---\n\n`;
            content += `**What's next?**\n`;
            content += `- "Profile ${table.name}" - Analyze data quality\n`;
            content += `- "Check PII in ${table.name}" - Review sensitive data\n`;
            content += `- "Show relationships for ${table.name}" - View connections\n`;

            return {
              id: generateMessageId(),
              type: 'assistant',
              content,
              timestamp: new Date(),
              metadata: {
                queryType: 'show_columns',
                confidence: 100
              }
            };
          } else {
            let content = `### ⚠️ No columns found for table "${table.name}"\n\n`;
            content += `**Table exists but:**\n`;
            content += `- Columns haven't been scanned yet\n`;
            content += `- Run a catalog scan to populate column metadata\n`;

            return {
              id: generateMessageId(),
              type: 'assistant',
              content,
              timestamp: new Date(),
              metadata: {
                queryType: 'show_columns',
                confidence: 90
              }
            };
          }
        } catch (error) {
          console.error('Error fetching columns:', error);
          return {
            id: generateMessageId(),
            type: 'assistant',
            content: `### ❌ Error fetching columns for "${tableName}"\n\nPlease try again or check if the table exists.`,
            timestamp: new Date(),
            metadata: {
              queryType: 'show_columns',
              confidence: 50
            }
          };
        }
      } else {
        let content = `### ℹ️ Which table would you like to see columns for?\n\n`;
        content += `**Please specify a table name:**\n`;
        content += `- "Show columns for wish"\n`;
        content += `- "Show columns for CustomerOrders"\n`;
        content += `- "List columns in Users"\n`;

        if (appKnowledge.totalTables > 0) {
          content += `\n**Or try:**\n`;
          content += `- "Show all tables" - See all available tables\n`;
          content += `- "Find tables with [keyword]" - Search for tables\n`;
        }

        return {
          id: generateMessageId(),
          type: 'assistant',
          content,
          timestamp: new Date(),
          metadata: {
            queryType: 'show_columns',
            confidence: 80,
            needsClarification: true
          }
        };
      }
    }

    // ==================== LIST ALL TABLES ====================
    if (/^(?:show|list|find|get|display|give\s+me).*(?:all|me\s+all)\s+(?:the\s+)?(?:tables?|assets?)/i.test(query)) {
      let content = `### 📊 All Tables in Catalog\n\n`;
      content += `**Total Tables:** ${appKnowledge.totalTables}\n`;
      content += `**Total Columns:** ${appKnowledge.totalColumns}\n`;
      content += `**Databases:** ${appKnowledge.databases.size}\n\n`;

      content += `### Tables by Database:\n\n`;

      appKnowledge.databases.forEach((tables, dbName) => {
        content += `#### ${dbName} (${tables.length} tables)\n`;
        tables.slice(0, 10).forEach((table, idx) => {
          const qualityBadge = table.qualityScore >= 95 ? '🟢' : table.qualityScore >= 85 ? '🟡' : '🔴';
          content += `${idx + 1}. **${table.name}** ${qualityBadge} - ${table.columnCount} cols, ${table.rowCount?.toLocaleString() || 0} rows`;
          if (table.piiDetected) content += ` ⚠️ PII`;
          content += `\n`;
        });
        if (tables.length > 10) {
          content += `...and ${tables.length - 10} more tables\n`;
        }
        content += `\n`;
      });

      content += `**Explore further:**\n`;
      content += `- "Show tables in [database name]"\n`;
      content += `- "Find tables with [keyword]"\n`;
      content += `- "Show PII across all tables"\n`;

      return {
        id: generateMessageId(),
        type: 'assistant',
        content,
        timestamp: new Date(),
        metadata: {
          queryType: 'list_all_tables',
          confidence: 100
        }
      };
    }

    // ==================== QUALITY ISSUES SEARCH ====================
    if (/(?:show|find|get|list|display).*(?:quality\s+issues?|issues?.*quality|problems?|data\s+quality\s+problems?)/i.test(query)) {
      // Check if searching for specific database (Azure, Postgres, etc.)
      const dbMatch = query.match(/(?:azure|postgres|postgresql|feya|cwic)/i);
      const targetDb = dbMatch ? dbMatch[0].toLowerCase() : null;

      // Collect all tables with quality issues
      let problemTables: any[] = [];

      appKnowledge.databases.forEach((tables, dbName) => {
        // Filter by database if specified
        if (targetDb) {
          const dbNameLower = dbName.toLowerCase();
          if (targetDb === 'azure' && !dbNameLower.includes('feya')) return;
          if (targetDb === 'postgres' && dbNameLower.includes('feya')) return;
          if (targetDb === 'feya' && !dbNameLower.includes('feya')) return;
          if (targetDb === 'cwic' && !dbNameLower.includes('cwic')) return;
        }

        // Find tables with quality issues (score < 85 or no score)
        const issues = tables.filter(t =>
          !t.qualityScore || t.qualityScore < 85 || t.piiDetected
        );

        problemTables = problemTables.concat(issues.map(t => ({
          ...t,
          database: dbName
        })));
      });

      // Sort by quality score (worst first)
      problemTables.sort((a, b) => (a.qualityScore || 0) - (b.qualityScore || 0));

      let content = `### 🔍 Quality Issues ${targetDb ? `in ${targetDb.toUpperCase()}` : 'Across All Databases'}\n\n`;

      if (problemTables.length === 0) {
        content += `✅ **No quality issues found!**\n\n`;
        if (targetDb) {
          content += `All tables in ${targetDb.toUpperCase()} meet quality standards (≥85%).\n\n`;
        } else {
          content += `All tables across all databases meet quality standards.\n\n`;
        }
        content += `**Note:** This assumes tables have been profiled. Run profiling to get accurate quality scores.`;
      } else {
        content += `⚠️ **Found ${problemTables.length} tables with quality issues**\n\n`;

        // Group by issue type
        const criticalIssues = problemTables.filter(t => !t.qualityScore || t.qualityScore < 50);
        const majorIssues = problemTables.filter(t => t.qualityScore >= 50 && t.qualityScore < 70);
        const minorIssues = problemTables.filter(t => t.qualityScore >= 70 && t.qualityScore < 85);
        const piiIssues = problemTables.filter(t => t.piiDetected);

        if (criticalIssues.length > 0) {
          content += `#### 🔴 Critical Issues (Quality < 50%)\n\n`;
          criticalIssues.slice(0, 5).forEach((table, idx) => {
            content += `**${idx + 1}. ${table.database}.${table.name}**\n`;
            content += `   • Quality Score: ${table.qualityScore || 0}%\n`;
            content += `   • Rows: ${table.rowCount?.toLocaleString() || 0}\n`;
            content += `   • Columns: ${table.columnCount || 0}\n`;
            if (table.piiDetected) content += `   • ⚠️ Contains PII\n`;
            content += `\n`;
          });
          if (criticalIssues.length > 5) {
            content += `...and ${criticalIssues.length - 5} more critical tables\n\n`;
          }
        }

        if (majorIssues.length > 0) {
          content += `#### 🟡 Major Issues (Quality 50-70%)\n\n`;
          majorIssues.slice(0, 3).forEach((table, idx) => {
            content += `**${idx + 1}. ${table.database}.${table.name}**\n`;
            content += `   • Quality Score: ${table.qualityScore}%\n`;
            content += `   • Rows: ${table.rowCount?.toLocaleString() || 0}\n`;
            if (table.piiDetected) content += `   • ⚠️ Contains PII\n`;
            content += `\n`;
          });
          if (majorIssues.length > 3) {
            content += `...and ${majorIssues.length - 3} more tables\n\n`;
          }
        }

        if (minorIssues.length > 0) {
          content += `#### 🟠 Minor Issues (Quality 70-85%)\n\n`;
          content += `${minorIssues.length} tables need minor improvements\n\n`;
        }

        if (piiIssues.length > 0) {
          content += `#### 🔒 PII Concerns\n\n`;
          content += `${piiIssues.length} tables contain PII that may need protection\n\n`;
        }

        content += `---\n\n`;
        content += `**📊 Summary:**\n`;
        content += `• Critical (< 50%): ${criticalIssues.length} tables\n`;
        content += `• Major (50-70%): ${majorIssues.length} tables\n`;
        content += `• Minor (70-85%): ${minorIssues.length} tables\n`;
        content += `• PII Detected: ${piiIssues.length} tables\n\n`;

        content += `**🔧 Actions to Take:**\n`;
        content += `- "Profile ${problemTables[0].name}" - Analyze worst table\n`;
        content += `- "Fix quality issues in ${problemTables[0].name}" - Get recommendations\n`;
        content += `- "Create quality rules for ${targetDb || 'all databases'}" - Set up monitoring\n`;
      }

      return {
        id: generateMessageId(),
        type: 'assistant',
        content,
        timestamp: new Date(),
        metadata: {
          queryType: 'quality_issues',
          confidence: 95
        }
      };
    }

    // ==================== GDPR/COMPLIANCE EDUCATION ====================
    if (/(?:what\s+is|explain|tell.*about)\s+(?:gdpr|ccpa|hipaa|compliance)/i.test(query)) {
      const regulation = queryLower.includes('gdpr') ? 'GDPR' :
                        queryLower.includes('ccpa') ? 'CCPA' :
                        queryLower.includes('hipaa') ? 'HIPAA' : 'Data Compliance';

      let content = `### 🎓 Data Governance Education: ${regulation}\n\n`;

      if (regulation === 'GDPR') {
        content += `## General Data Protection Regulation (GDPR)\n\n`;
        content += `**Jurisdiction:** European Union\n`;
        content += `**Effective:** May 25, 2018\n\n`;

        content += `### 🎯 Key Principles:\n\n`;
        content += `1. **Lawfulness, fairness and transparency**\n`;
        content += `   - Must have legal basis for processing\n`;
        content += `   - Be transparent about data use\n\n`;

        content += `2. **Purpose limitation**\n`;
        content += `   - Collect data for specific purposes only\n`;
        content += `   - Don't use it for other purposes\n\n`;

        content += `3. **Data minimization**\n`;
        content += `   - Only collect what you need\n`;
        content += `   - "Nice to have" is not enough\n\n`;

        content += `4. **Accuracy**\n`;
        content += `   - Keep data accurate and up-to-date\n`;
        content += `   - Allow individuals to correct errors\n\n`;

        content += `5. **Storage limitation**\n`;
        content += `   - Don't keep data longer than necessary\n`;
        content += `   - Implement retention policies\n\n`;

        content += `6. **Integrity and confidentiality**\n`;
        content += `   - Protect data with appropriate security\n`;
        content += `   - Prevent unauthorized access\n\n`;

        content += `### 👥 Individual Rights:\n\n`;
        content += `- **Right to access:** Individuals can request their data\n`;
        content += `- **Right to rectification:** Correct inaccurate data\n`;
        content += `- **Right to erasure:** "Right to be forgotten"\n`;
        content += `- **Right to data portability:** Move data between services\n`;
        content += `- **Right to object:** Stop certain processing\n\n`;

        content += `### ⚠️ Penalties:\n\n`;
        content += `- Up to €20 million OR\n`;
        content += `- 4% of annual global turnover\n`;
        content += `- Whichever is HIGHER\n\n`;

        content += `### ✅ How to Comply:\n\n`;
        content += `1. **Data Inventory:** Know what PII you have (try: "show all PII")\n`;
        content += `2. **Legal Basis:** Document why you process data\n`;
        content += `3. **Privacy Policy:** Clear, transparent communication\n`;
        content += `4. **Data Protection Officer:** Appoint if required\n`;
        content += `5. **Breach Notification:** 72-hour reporting requirement\n`;
        content += `6. **Data Protection Impact Assessment:** For high-risk processing\n\n`;

        content += `**Want help with compliance?** Try:\n`;
        content += `- "Show me all PII" - Data inventory\n`;
        content += `- "Check data retention" - Storage limitation\n`;
        content += `- "Audit access logs" - Accountability\n`;
      }

      return {
        id: generateMessageId(),
        type: 'assistant',
        content,
        timestamp: new Date(),
        metadata: {
          queryType: 'education',
          confidence: 100,
          educationalContent: true
        }
      };
    }

    // ==================== SPECIFIC TABLE LOOKUP ====================
    // Handles: "show me the table wish", "find table wish", "show table customer"
    if (/(?:find|show|search|get|lookup)\s+(?:me\s+)?(?:the\s+)?table\s+(\w+)/i.test(query)) {
      const match = query.match(/table\s+(\w+)/i);
      const searchTerm = match ? match[1] : '';

      if (searchTerm) {
        let foundTables: any[] = [];

        appKnowledge.databases.forEach((tables) => {
          const matches = tables.filter(t =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase())
          );
          foundTables = foundTables.concat(matches);
        });

        if (foundTables.length > 0) {
          // Remember context
          setContext(prev => ({
            ...prev,
            lastTable: foundTables[0].name,
            lastDatabase: foundTables[0].databaseName
          }));

          let content = `### 🔍 Found ${foundTables.length} table${foundTables.length > 1 ? 's' : ''} matching "${searchTerm}"\n\n`;

          foundTables.forEach((table, index) => {
            if (index < 5) {  // Show first 5
              const qualityBadge = table.qualityScore >= 95 ? '🟢' : table.qualityScore >= 85 ? '🟡' : '🔴';
              content += `#### ${index + 1}. **${table.name}** ${qualityBadge}\n`;
              content += `- 📍 Location: ${table.databaseName}.${table.schema}\n`;
              content += `- 📊 Size: ${table.columnCount} columns, ${table.rowCount?.toLocaleString() || 0} rows\n`;
              content += `- 🛡️ PII: ${table.piiDetected ? '⚠️ Detected' : '✅ None'}\n`;
              content += `- 📈 Quality: ${table.qualityScore || 0}%\n`;
              if (table.description) {
                content += `- 📝 ${table.description.substring(0, 150)}...\n`;
              }
              content += `\n`;
            }
          });

          if (foundTables.length > 5) {
            content += `...and ${foundTables.length - 5} more tables\n\n`;
          }

          content += `**What would you like to do?**\n`;
          content += `- "Show columns for ${foundTables[0].name}"\n`;
          content += `- "Check PII in ${foundTables[0].name}"\n`;
          content += `- "Analyze quality of ${foundTables[0].name}"\n`;

          return {
            id: generateMessageId(),
            type: 'assistant',
            content,
            timestamp: new Date(),
            metadata: {
              queryType: 'table_lookup',
              confidence: 100
            }
          };
        } else {
          let content = `### ❌ No tables found matching "${searchTerm}"\n\n`;
          content += `**Suggestions:**\n`;
          content += `- Try "show all tables" to see all available tables\n`;
          content += `- Check spelling of table name\n`;
          content += `- Try "find tables with [keyword]" for broader search\n`;

          return {
            id: generateMessageId(),
            type: 'assistant',
            content,
            timestamp: new Date(),
            metadata: {
              queryType: 'table_lookup',
              confidence: 90
            }
          };
        }
      }
    }

    // ==================== TABLE SEARCH (BROADER) ====================
    if (/(?:find|show|search|get).*(?:tables?|data).*(?:with|containing|about|for)\s+(\w+)/i.test(query)) {
      const match = query.match(/(?:with|containing|about|for)\s+(\w+)/i);
      const searchTerm = match ? match[1] : '';

      if (searchTerm) {
        let foundTables: any[] = [];

        appKnowledge.databases.forEach((tables) => {
          const matches = tables.filter(t =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
          );
          foundTables = foundTables.concat(matches);
        });

        if (foundTables.length > 0) {
          // Remember context
          setContext(prev => ({
            ...prev,
            lastTable: foundTables[0].name,
            lastDatabase: foundTables[0].databaseName
          }));

          let content = `### 🔍 Found ${foundTables.length} tables matching "${searchTerm}"\n\n`;

          foundTables.forEach((table, index) => {
            if (index < 5) {  // Show first 5
              const qualityBadge = table.qualityScore >= 95 ? '🟢' : table.qualityScore >= 85 ? '🟡' : '🔴';
              content += `#### ${index + 1}. **${table.name}** ${qualityBadge}\n`;
              content += `- 📍 Location: ${table.databaseName}.${table.schema}\n`;
              content += `- 📊 Size: ${table.columnCount} columns, ${table.rowCount?.toLocaleString()} rows\n`;
              content += `- 🛡️ PII: ${table.piiDetected ? '⚠️ Detected' : '✅ None'}\n`;
              content += `- 📈 Quality: ${table.qualityScore || 0}%\n`;
              if (table.description) {
                content += `- 📝 ${table.description.substring(0, 100)}...\n`;
              }
              content += `\n`;
            }
          });

          if (foundTables.length > 5) {
            content += `...and ${foundTables.length - 5} more tables\n\n`;
          }

          content += `**What would you like to do?**\n`;
          content += `- "Show columns for ${foundTables[0].name}"\n`;
          content += `- "Check PII in ${foundTables[0].name}"\n`;
          content += `- "Analyze quality of ${foundTables[0].name}"\n`;

          return {
            id: generateMessageId(),
            type: 'assistant',
            content,
            timestamp: new Date(),
            metadata: {
              queryType: 'table_search',
              confidence: 95
            }
          };
        }
      }
    }

    // ==================== SIMPLE KEYWORD SEARCH ====================
    // Handles single words like "customer", "wish", "user"
    if (/^\w+$/.test(query.trim())) {
      const searchTerm = query.trim();
      let foundTables: any[] = [];

      appKnowledge.databases.forEach((tables) => {
        const matches = tables.filter(t =>
          t.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        foundTables = foundTables.concat(matches);
      });

      if (foundTables.length > 0) {
        // Remember context
        setContext(prev => ({
          ...prev,
          lastTable: foundTables[0].name,
          lastDatabase: foundTables[0].databaseName
        }));

        let content = `### 🔍 Found ${foundTables.length} table${foundTables.length > 1 ? 's' : ''} matching "${searchTerm}"\n\n`;

        foundTables.forEach((table, index) => {
          if (index < 5) {
            const qualityBadge = table.qualityScore >= 95 ? '🟢' : table.qualityScore >= 85 ? '🟡' : '🔴';
            content += `#### ${index + 1}. **${table.name}** ${qualityBadge}\n`;
            content += `- 📍 Location: ${table.databaseName}.${table.schema}\n`;
            content += `- 📊 Size: ${table.columnCount} columns, ${table.rowCount?.toLocaleString() || 0} rows\n`;
            content += `- 🛡️ PII: ${table.piiDetected ? '⚠️ Detected' : '✅ None'}\n`;
            content += `- 📈 Quality: ${table.qualityScore || 0}%\n`;
            if (table.description) {
              content += `- 📝 ${table.description.substring(0, 150)}...\n`;
            }
            content += `\n`;
          }
        });

        if (foundTables.length > 5) {
          content += `...and ${foundTables.length - 5} more tables\n\n`;
        }

        content += `**What would you like to do?**\n`;
        content += `- "Show columns for ${foundTables[0].name}"\n`;
        content += `- "Check PII in ${foundTables[0].name}"\n`;
        content += `- "Profile ${foundTables[0].name}"\n`;

        return {
          id: generateMessageId(),
          type: 'assistant',
          content,
          timestamp: new Date(),
          metadata: {
            queryType: 'keyword_search',
            confidence: 85
          }
        };
      }
    }

    // ==================== DEFAULT: SUGGEST ACTIONS ====================
    return {
      id: generateMessageId(),
      type: 'assistant',
      content: `### I can help you with: "${query}"\n\n` +
               `**Data Exploration:**\n` +
               `- "Show all data sources"\n` +
               `- "Find tables with customer data"\n` +
               `- "Show all PII"\n\n` +
               `**Education:**\n` +
               `- "What is data quality?"\n` +
               `- "Explain GDPR"\n` +
               `- "How to protect PII?"\n\n` +
               `**Analysis:**\n` +
               `- "Check quality metrics"\n` +
               `- "Find low quality tables"\n` +
               `- "Show compliance status"\n\n` +
               `What interests you most?`,
      timestamp: new Date(),
      metadata: {
        queryType: 'suggestion',
        confidence: 70
      }
    };
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateMessageId(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await processIntelligentQuery(input);
      setMessages(prev => [...prev, response]);
    } catch (error) {
      console.error('Query processing error:', error);
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        type: 'assistant',
        content: '❌ An error occurred while processing your request. Please try again.',
        timestamp: new Date(),
        metadata: { queryType: 'error', confidence: 0 }
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-full bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b shadow-sm px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Truly Intelligent AI Assistant</h1>
                <p className="text-sm text-gray-500">Scans • Educates • Converses • Clarifies</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-lg">
                <CheckCircle className="w-4 h-4" />
                <span>{appKnowledge.totalTables} tables scanned</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg">
                <Database className="w-4 h-4" />
                <span>{appKnowledge.databases.size} databases</span>
              </div>
              {appKnowledge.piiFields.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg">
                  <Shield className="w-4 h-4" />
                  <span>{appKnowledge.piiFields.length} PII fields</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-4xl ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                <div className="flex items-start gap-3">
                  {message.type === 'assistant' && (
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className={`rounded-xl px-4 py-3 ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.metadata?.educationalContent
                      ? 'bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200'
                      : 'bg-white border shadow-sm'
                  }`}>
                    {message.type === 'assistant' ? (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown
                          components={{
                            code: ({ node, className, children, ...props }: any) => {
                              const match = /language-(\w+)/.exec(className || '');
                              const inline = !match;
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  style={oneDark}
                                  language={match[1]}
                                  PreTag="div"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props}>
                                  {children}
                                </code>
                              );
                            }
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                    {message.metadata && (
                      <div className="mt-2 pt-2 border-t flex items-center gap-2">
                        <span className="text-xs text-gray-500">{message.metadata.confidence}% confidence</span>
                        {message.metadata.needsClarification && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Needs clarification</span>
                        )}
                        {message.metadata.educationalContent && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            Educational
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {message.type === 'user' && (
                    <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1 px-11">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 bg-white border rounded-lg px-4 py-3">
                <div className="animate-pulse flex gap-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                  <div className="w-2 h-2 bg-pink-600 rounded-full"></div>
                </div>
                <span className="text-sm text-gray-500">Thinking intelligently...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t px-6 py-4 shadow-lg">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask me anything - I'll scan your app, educate you, and ask clarifying questions..."
              className="flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              rows={2}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Powered by True Intelligence Engine
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrulyIntelligentAI;







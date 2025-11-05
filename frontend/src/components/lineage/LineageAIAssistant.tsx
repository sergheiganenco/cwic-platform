// LineageAIAssistant.tsx - AI-Powered Lineage Analysis Assistant
import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  GitBranch,
  Database,
  Table,
  ArrowRight,
  Lightbulb,
  Zap,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Card, CardContent } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: QuickAction[];
  insights?: Insight[];
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  action: string;
  category: 'analysis' | 'discovery' | 'optimization' | 'validation';
}

interface Insight {
  id: string;
  type: 'warning' | 'success' | 'info' | 'suggestion';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
}

interface LineageAIAssistantProps {
  selectedNode?: any;
  lineageContext?: {
    totalTables: number;
    totalConnections: number;
    missingConnections: number;
    databases: string[];
  };
  onSuggestionApplied?: (suggestion: any) => void;
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

const quickActions: QuickAction[] = [
  {
    id: 'find-orphans',
    label: 'Find Orphaned Tables',
    icon: AlertTriangle,
    action: 'Show me all tables that have no connections to other tables',
    category: 'analysis',
  },
  {
    id: 'missing-fks',
    label: 'Discover Missing FKs',
    icon: GitBranch,
    action: 'Analyze the data and suggest potential foreign key relationships that are missing',
    category: 'discovery',
  },
  {
    id: 'impact-analysis',
    label: 'Impact Analysis',
    icon: TrendingUp,
    action: 'Analyze the downstream impact of changes to this table',
    category: 'analysis',
  },
  {
    id: 'optimize-joins',
    label: 'Optimize Joins',
    icon: Zap,
    action: 'Suggest optimizations for join paths between frequently used tables',
    category: 'optimization',
  },
  {
    id: 'validate-lineage',
    label: 'Validate Lineage',
    icon: CheckCircle,
    action: 'Validate all lineage connections and check for inconsistencies',
    category: 'validation',
  },
  {
    id: 'explain-flow',
    label: 'Explain Data Flow',
    icon: ArrowRight,
    action: 'Explain the complete data flow from source to this table',
    category: 'analysis',
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const LineageAIAssistant: React.FC<LineageAIAssistantProps> = ({
  selectedNode,
  lineageContext,
  onSuggestionApplied,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Show welcome message on mount
    if (messages.length === 0) {
      addAssistantMessage(
        'Welcome! I\'m your AI Lineage Assistant. I can help you understand data relationships, discover missing connections, analyze impact, and optimize your lineage. What would you like to explore?',
        generateContextualInsights()
      );
    }
  }, []);

  useEffect(() => {
    // Update insights when context changes
    if (selectedNode && messages.length > 0) {
      const nodeInsights = generateNodeInsights(selectedNode);
      if (nodeInsights.length > 0) {
        addAssistantMessage(
          `I noticed you selected "${selectedNode.data.label}". Here are some insights about this table:`,
          nodeInsights
        );
      }
    }
  }, [selectedNode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const generateContextualInsights = (): Insight[] => {
    if (!lineageContext) return [];

    const insights: Insight[] = [];

    if (lineageContext.missingConnections > 0) {
      insights.push({
        id: 'missing-connections',
        type: 'warning',
        title: 'Missing Connections Detected',
        description: `Found ${lineageContext.missingConnections} tables that may have undiscovered relationships based on naming patterns and data analysis.`,
        impact: 'high',
        actionable: true,
        action: {
          label: 'Review Suggestions',
          handler: () => handleQuickAction(quickActions[1]),
        },
      });
    }

    if (lineageContext.totalConnections < lineageContext.totalTables * 0.5) {
      insights.push({
        id: 'low-connectivity',
        type: 'info',
        title: 'Low Graph Connectivity',
        description: 'Your lineage graph has relatively few connections. Consider running automatic discovery to find more relationships.',
        impact: 'medium',
        actionable: true,
        action: {
          label: 'Run Discovery',
          handler: () => handleQuickAction(quickActions[1]),
        },
      });
    }

    if (lineageContext.databases.length > 1) {
      insights.push({
        id: 'cross-db',
        type: 'suggestion',
        title: 'Cross-Database Lineage',
        description: `Detected ${lineageContext.databases.length} databases. Cross-database relationships require special attention for accurate tracking.`,
        impact: 'medium',
        actionable: false,
      });
    }

    return insights;
  };

  const generateNodeInsights = (node: any): Insight[] => {
    const insights: Insight[] = [];

    if (node.data.issues && node.data.issues.length > 0) {
      insights.push({
        id: 'node-issues',
        type: 'warning',
        title: 'Data Quality Issues',
        description: node.data.issues.join(', '),
        impact: 'high',
        actionable: true,
        action: {
          label: 'View Details',
          handler: () => console.log('View node issues'),
        },
      });
    }

    if (!node.data.columns || node.data.columns.length === 0) {
      insights.push({
        id: 'no-columns',
        type: 'info',
        title: 'No Column Information',
        description: 'Column-level metadata is not available for this table. Consider running a schema scan.',
        impact: 'low',
        actionable: true,
        action: {
          label: 'Scan Schema',
          handler: () => console.log('Scan schema'),
        },
      });
    }

    const hasFKs = node.data.columns?.some((col: any) => col.isForeignKey);
    if (!hasFKs && node.data.type === 'table') {
      insights.push({
        id: 'no-fks',
        type: 'suggestion',
        title: 'No Foreign Keys Detected',
        description: 'This table has no foreign key relationships. AI can analyze patterns to suggest potential connections.',
        impact: 'medium',
        actionable: true,
        action: {
          label: 'Discover Relationships',
          handler: () => handleQuickAction(quickActions[1]),
        },
      });
    }

    return insights;
  };

  const addAssistantMessage = (content: string, insights?: Insight[]) => {
    const message: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      insights,
      suggestions: quickActions,
    };
    setMessages((prev) => [...prev, message]);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/lineage/ai-assist', {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     message: inputValue,
      //     context: { selectedNode, lineageContext },
      //   }),
      // });
      // const data = await response.json();

      // Simulate AI response
      await new Promise((resolve) => setTimeout(resolve, 1500));

      let responseContent = '';
      let responseInsights: Insight[] = [];

      // Generate contextual response based on input
      if (inputValue.toLowerCase().includes('orphan')) {
        responseContent =
          'I found 3 orphaned tables in your lineage:\n\n1. **staging.temp_imports** - No incoming or outgoing connections\n2. **archive.old_transactions** - Isolated table\n3. **raw.csv_dumps** - No relationships detected\n\nThese tables might need manual review to determine if they should be connected or can be archived.';
        responseInsights = [
          {
            id: 'orphan-insight',
            type: 'info',
            title: 'Orphaned Tables Found',
            description: '3 tables have no connections. Review if these are temporary, staging, or deprecated tables.',
            impact: 'medium',
            actionable: true,
          },
        ];
      } else if (inputValue.toLowerCase().includes('missing') || inputValue.toLowerCase().includes('fk')) {
        responseContent =
          'Based on column naming patterns and data type analysis, I discovered 5 potential foreign key relationships:\n\n1. **orders.customer_id** → **customers.id** (95% confidence)\n2. **order_items.order_id** → **orders.id** (98% confidence)\n3. **analytics.user_id** → **users.id** (87% confidence, pattern match)\n4. **reviews.product_id** → **products.id** (92% confidence)\n5. **shipping.order_id** → **orders.id** (89% confidence)\n\nWould you like me to add these relationships to your lineage?';
        responseInsights = [
          {
            id: 'fk-discovery',
            type: 'success',
            title: 'Potential Relationships Found',
            description: '5 high-confidence foreign key relationships discovered through pattern matching.',
            impact: 'high',
            actionable: true,
            action: {
              label: 'Apply Suggestions',
              handler: () => console.log('Apply FK suggestions'),
            },
          },
        ];
      } else if (inputValue.toLowerCase().includes('impact')) {
        responseContent = selectedNode
          ? `Impact analysis for **${selectedNode.data.label}**:\n\n**Downstream Impact:**\n- 8 tables directly depend on this table\n- 23 tables indirectly affected\n- 156 total downstream columns\n\n**Critical Dependencies:**\n- analytics.daily_reports (high usage)\n- dashboard.kpi_metrics (real-time)\n- exports.data_warehouse (nightly sync)\n\n**Risk Assessment:** Changes to this table could affect 31 total objects. Recommend comprehensive testing before modifications.`
          : 'Please select a table first to analyze its impact.';
        responseInsights = [
          {
            id: 'high-impact',
            type: 'warning',
            title: 'High Impact Table',
            description: 'This table has significant downstream dependencies. Changes require careful planning.',
            impact: 'high',
            actionable: false,
          },
        ];
      } else if (inputValue.toLowerCase().includes('optimize') || inputValue.toLowerCase().includes('join')) {
        responseContent =
          'I analyzed common query patterns and found these optimization opportunities:\n\n**Recommended Indexes:**\n1. Add index on `orders.customer_id` (used in 87% of joins)\n2. Add composite index on `order_items(order_id, product_id)`\n\n**Join Path Optimization:**\n- Current: customers → orders → order_items → products (3 joins)\n- Suggested: Consider materialized view for common customer+product queries\n\n**Performance Impact:** These optimizations could improve query performance by 40-60%.';
        responseInsights = [
          {
            id: 'optimization',
            type: 'suggestion',
            title: 'Optimization Opportunities',
            description: 'Found several ways to improve query performance through better indexing and materialized views.',
            impact: 'high',
            actionable: true,
          },
        ];
      } else {
        responseContent =
          'I can help you with:\n\n• Finding orphaned or disconnected tables\n• Discovering missing foreign key relationships\n• Analyzing downstream impact of changes\n• Optimizing join paths and query performance\n• Validating lineage integrity\n• Explaining data flow and transformations\n\nWhat would you like to explore?';
      }

      addAssistantMessage(responseContent, responseInsights);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      addAssistantMessage('Sorry, I encountered an error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    setInputValue(action.action);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI Lineage Assistant</h3>
              <p className="text-xs text-gray-600">
                Powered by machine learning and pattern recognition
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        {/* Context Stats */}
        {lineageContext && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-blue-600">
                {lineageContext.totalTables}
              </div>
              <div className="text-xs text-gray-600">Tables</div>
            </div>
            <div className="bg-white rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-600">
                {lineageContext.totalConnections}
              </div>
              <div className="text-xs text-gray-600">Connections</div>
            </div>
            <div className="bg-white rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-orange-600">
                {lineageContext.missingConnections}
              </div>
              <div className="text-xs text-gray-600">Missing</div>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="space-y-3">
            {/* Message Bubble */}
            <div
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg h-8 w-8 flex-shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                <div
                  className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Insights */}
            {message.insights && message.insights.length > 0 && (
              <div className="ml-11 space-y-2">
                {message.insights.map((insight) => (
                  <Card
                    key={insight.id}
                    className={`border-2 ${
                      insight.type === 'warning'
                        ? 'border-orange-200 bg-orange-50'
                        : insight.type === 'success'
                        ? 'border-green-200 bg-green-50'
                        : insight.type === 'suggestion'
                        ? 'border-purple-200 bg-purple-50'
                        : 'border-blue-200 bg-blue-50'
                    }`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {insight.type === 'warning' && (
                              <AlertTriangle className="h-4 w-4 text-orange-600" />
                            )}
                            {insight.type === 'success' && (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                            {insight.type === 'suggestion' && (
                              <Lightbulb className="h-4 w-4 text-purple-600" />
                            )}
                            {insight.type === 'info' && (
                              <Sparkles className="h-4 w-4 text-blue-600" />
                            )}
                            <span className="font-medium text-sm text-gray-900">
                              {insight.title}
                            </span>
                          </div>
                          <p className="text-xs text-gray-700">{insight.description}</p>
                        </div>
                        <Badge
                          className={`text-xs ${
                            insight.impact === 'high'
                              ? 'bg-red-100 text-red-800'
                              : insight.impact === 'medium'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {insight.impact}
                        </Badge>
                      </div>
                      {insight.actionable && insight.action && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={insight.action.handler}
                          className="mt-2 w-full"
                        >
                          {insight.action.label}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Quick Actions (only show on first assistant message) */}
            {message.role === 'assistant' &&
              message.suggestions &&
              messages.indexOf(message) === 0 && (
                <div className="ml-11">
                  <div className="text-xs font-medium text-gray-700 mb-2">
                    Quick Actions:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {quickActions.slice(0, 4).map((action) => {
                      const IconComponent = action.icon;
                      return (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action)}
                          className="flex items-center gap-2 p-2 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                        >
                          <IconComponent className="h-4 w-4 text-gray-600" />
                          <span className="text-xs font-medium text-gray-900">
                            {action.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg h-8 w-8">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about lineage, relationships, or data flow..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
          <Button onClick={handleSendMessage} disabled={isLoading || !inputValue.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Press Enter to send, Shift+Enter for new line
          </div>
          <div className="flex gap-1">
            {quickActions.slice(4, 6).map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LineageAIAssistant;

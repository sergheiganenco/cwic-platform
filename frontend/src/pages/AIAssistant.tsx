// src/pages/AIAssistant.tsx - Enhanced Version
import { ChatInterface } from '@/components/features/ai-assistant/ChatInterface';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  BarChart3,
  Bot,
  ChevronRight,
  Clock,
  Database,
  FileText,
  MessageSquare,
  Search,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  category: 'query' | 'analysis' | 'automation' | 'governance';
  prompt: string;
  color: string;
}

interface RecentConversation {
  id: string;
  title: string;
  timestamp: string;
  preview: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'data-quality',
    title: 'Check Data Quality',
    description: 'Analyze data quality metrics and identify issues',
    icon: Shield,
    category: 'analysis',
    prompt: 'Show me data quality metrics for our key datasets and highlight any issues that need attention.',
    color: 'bg-green-50 border-green-200 hover:bg-green-100'
  },
  {
    id: 'field-search',
    title: 'Find Data Fields',
    description: 'Search for specific fields across all datasets',
    icon: Search,
    category: 'query',
    prompt: 'Help me find fields containing customer information across all our datasets.',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100'
  },
  {
    id: 'pipeline-status',
    title: 'Pipeline Health',
    description: 'Check status of data pipelines and workflows',
    icon: TrendingUp,
    category: 'analysis',
    prompt: 'Show me the current status of all data pipelines and any that require attention.',
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100'
  },
  {
    id: 'create-request',
    title: 'Create Access Request',
    description: 'Generate data access or modification requests',
    icon: FileText,
    category: 'automation',
    prompt: 'I need to create an access request for sensitive customer data. Guide me through the process.',
    color: 'bg-orange-50 border-orange-200 hover:bg-orange-100'
  },
  {
    id: 'usage-analytics',
    title: 'Usage Analytics',
    description: 'View data usage patterns and popular datasets',
    icon: BarChart3,
    category: 'analysis',
    prompt: 'Show me usage analytics for our data catalog and identify the most popular datasets.',
    color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
  },
  {
    id: 'automate-workflow',
    title: 'Automate Workflow',
    description: 'Set up automated data governance workflows',
    icon: Zap,
    category: 'automation',
    prompt: 'Help me set up an automated workflow for data quality monitoring and alerting.',
    color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
  }
];

const mockRecentConversations: RecentConversation[] = [
  {
    id: '1',
    title: 'Customer Data Analysis',
    timestamp: '2 hours ago',
    preview: 'Analyzed customer segmentation data and identified quality issues...'
  },
  {
    id: '2',
    title: 'Pipeline Configuration',
    timestamp: '1 day ago',
    preview: 'Set up automated quality checks for the sales pipeline...'
  },
  {
    id: '3',
    title: 'Access Request Review',
    timestamp: '3 days ago',
    preview: 'Reviewed and approved access requests for the marketing team...'
  }
];

export const AIAssistant: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const filteredActions = selectedCategory === 'all' 
    ? quickActions 
    : quickActions.filter(action => action.category === selectedCategory);

  const categories = [
    { id: 'all', name: 'All', icon: Sparkles },
    { id: 'query', name: 'Query', icon: Search },
    { id: 'analysis', name: 'Analysis', icon: BarChart3 },
    { id: 'automation', name: 'Automation', icon: Zap },
    { id: 'governance', name: 'Governance', icon: Shield }
  ];

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleQuickAction = (action: QuickAction) => {
    // Hide quick actions and potentially pass the prompt to ChatInterface
    setShowQuickActions(false);
    
    // If your ChatInterface has a method to inject messages, you could:
    // chatInterfaceRef.current?.sendMessage(action.prompt);
    
    console.log('Quick action selected:', action.prompt);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                <Bot className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  AI Data Assistant
                </h1>
                <p className="text-gray-600 mt-1">
                  {getGreeting()}! How can I help you with your data today?
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Current Time</p>
                <p className="text-lg font-semibold text-gray-700">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
          
          {/* Capabilities Banner */}
          <div className="bg-white/60 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="flex items-center space-x-3">
                <Database className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold text-gray-800">Data Discovery</p>
                  <p className="text-sm text-gray-600">Find any field or dataset</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-semibold text-gray-800">Quality Analysis</p>
                  <p className="text-sm text-gray-600">Monitor data health</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Zap className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-semibold text-gray-800">Automation</p>
                  <p className="text-sm text-gray-600">Streamline workflows</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-semibold text-gray-800">Analytics</p>
                  <p className="text-sm text-gray-600">Usage insights</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Actions */}
            {showQuickActions && (
              <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800 flex items-center">
                      <Sparkles className="h-4 w-4 mr-2 text-blue-600" />
                      Quick Actions
                    </h3>
                  </div>

                  {/* Category Filter */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {categories.map((category) => {
                      const IconComponent = category.icon;
                      return (
                        <button
                          key={category.id}
                          onClick={() => setSelectedCategory(category.id)}
                          className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            selectedCategory === category.id
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <IconComponent className="h-3 w-3" />
                          <span>{category.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Action Cards */}
                  <div className="space-y-3">
                    {filteredActions.map((action) => {
                      const IconComponent = action.icon;
                      return (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action)}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-200 group ${action.color}`}
                        >
                          <div className="flex items-start space-x-3">
                            <IconComponent className="h-5 w-5 mt-0.5 text-gray-700 group-hover:scale-110 transition-transform" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 text-sm">{action.title}</p>
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{action.description}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Conversations */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-gray-600" />
                  Recent Conversations
                </h3>
                <div className="space-y-3">
                  {mockRecentConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm truncate">{conversation.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{conversation.timestamp}</p>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{conversation.preview}</p>
                        </div>
                        <MessageSquare className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors ml-2" />
                      </div>
                    </button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-3 text-blue-600 hover:text-blue-700">
                  View All Conversations
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Chat Interface */}
          <div className="lg:col-span-3">
            <Card className="h-[700px] bg-white/90 backdrop-blur-sm border-white/20 shadow-lg">
              <CardContent className="h-full p-0 relative overflow-hidden">
                {/* Decorative gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none" />
                
                {showQuickActions && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                    <div className="text-center max-w-md">
                      <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full inline-block mb-4">
                        <Bot className="h-12 w-12 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">Ready to Assist</h3>
                      <p className="text-gray-600 mb-6">
                        Select a quick action from the sidebar or start typing your question below.
                      </p>
                      <Button 
                        onClick={() => setShowQuickActions(false)}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      >
                        Start Chatting
                      </Button>
                    </div>
                  </div>
                )}
                
                <ChatInterface 
                  showHeader={false} 
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">1,247</div>
            <div className="text-sm text-gray-600">Assets Managed</div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600">98.5%</div>
            <div className="text-sm text-gray-600">Quality Score</div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">156</div>
            <div className="text-sm text-gray-600">Active Pipelines</div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">23</div>
            <div className="text-sm text-gray-600">Users Online</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
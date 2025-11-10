import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

interface UniversalContextData {
  // Current page context
  currentPage: string;
  currentModule: string;
  pageTitle: string;

  // User activity tracking
  userActions: UserAction[];
  recentViews: RecentView[];

  // System state
  systemMetrics: SystemMetrics;
  activeInsights: AIInsight[];

  // Data context
  selectedAssets: string[];
  activeFilters: Record<string, any>;
  searchHistory: string[];
}

interface UserAction {
  id: string;
  type: 'navigation' | 'search' | 'create' | 'update' | 'delete' | 'execute';
  module: string;
  target: string;
  timestamp: Date;
  details?: any;
}

interface RecentView {
  id: string;
  type: 'table' | 'rule' | 'pipeline' | 'request';
  name: string;
  path: string;
  timestamp: Date;
}

interface SystemMetrics {
  dataQualityScore: number;
  activeRules: number;
  criticalIssues: number;
  assetsCount: number;
  pipelinesRunning: number;
}

interface AIInsight {
  id: string;
  type: 'suggestion' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  module?: string;
  action?: () => void;
  actionLabel?: string;
  timestamp: Date;
  priority: 'high' | 'medium' | 'low';
}

interface UniversalAIContextValue {
  context: UniversalContextData;
  trackAction: (action: Omit<UserAction, 'id' | 'timestamp'>) => void;
  trackView: (view: Omit<RecentView, 'id' | 'timestamp'>) => void;
  updateMetrics: (metrics: Partial<SystemMetrics>) => void;
  addInsight: (insight: Omit<AIInsight, 'id' | 'timestamp'>) => void;
  dismissInsight: (id: string) => void;
  setSelectedAssets: (assets: string[]) => void;
  setActiveFilters: (filters: Record<string, any>) => void;
  addToSearchHistory: (query: string) => void;
  getContextForAI: () => string; // Generates context string for AI
}

const UniversalAIContext = createContext<UniversalAIContextValue | undefined>(undefined);

export const useUniversalAI = () => {
  const context = useContext(UniversalAIContext);
  if (!context) {
    throw new Error('useUniversalAI must be used within UniversalAIProvider');
  }
  return context;
};

interface UniversalAIProviderProps {
  children: ReactNode;
}

export const UniversalAIProvider: React.FC<UniversalAIProviderProps> = ({ children }) => {
  const location = useLocation();

  const [context, setContext] = useState<UniversalContextData>({
    currentPage: '',
    currentModule: '',
    pageTitle: '',
    userActions: [],
    recentViews: [],
    systemMetrics: {
      dataQualityScore: 0,
      activeRules: 0,
      criticalIssues: 0,
      assetsCount: 0,
      pipelinesRunning: 0
    },
    activeInsights: [],
    selectedAssets: [],
    activeFilters: {},
    searchHistory: []
  });

  // Update page context when route changes
  useEffect(() => {
    const path = location.pathname;
    let module = '';
    let title = '';

    if (path.includes('/data-catalog')) {
      module = 'catalog';
      title = 'Data Catalog';
    } else if (path.includes('/data-quality')) {
      module = 'quality';
      title = 'Data Quality';
    } else if (path.includes('/data-lineage')) {
      module = 'lineage';
      title = 'Data Lineage';
    } else if (path.includes('/pipelines')) {
      module = 'pipelines';
      title = 'Pipelines';
    } else if (path.includes('/ai-assistant')) {
      module = 'ai';
      title = 'AI Assistant';
    }

    setContext(prev => ({
      ...prev,
      currentPage: path,
      currentModule: module,
      pageTitle: title
    }));

    // Track navigation
    trackAction({
      type: 'navigation',
      module,
      target: path
    });
  }, [location]);

  const trackAction = useCallback((action: Omit<UserAction, 'id' | 'timestamp'>) => {
    const newAction: UserAction = {
      ...action,
      id: `action_${Date.now()}_${Math.random()}`,
      timestamp: new Date()
    };

    setContext(prev => ({
      ...prev,
      userActions: [newAction, ...prev.userActions].slice(0, 100) // Keep last 100 actions
    }));
  }, []);

  const trackView = useCallback((view: Omit<RecentView, 'id' | 'timestamp'>) => {
    const newView: RecentView = {
      ...view,
      id: `view_${Date.now()}_${Math.random()}`,
      timestamp: new Date()
    };

    setContext(prev => ({
      ...prev,
      recentViews: [newView, ...prev.recentViews.filter(v => v.name !== view.name)].slice(0, 20)
    }));
  }, []);

  const updateMetrics = useCallback((metrics: Partial<SystemMetrics>) => {
    setContext(prev => ({
      ...prev,
      systemMetrics: {
        ...prev.systemMetrics,
        ...metrics
      }
    }));
  }, []);

  const addInsight = useCallback((insight: Omit<AIInsight, 'id' | 'timestamp'>) => {
    const newInsight: AIInsight = {
      ...insight,
      id: `insight_${Date.now()}_${Math.random()}`,
      timestamp: new Date()
    };

    setContext(prev => ({
      ...prev,
      activeInsights: [newInsight, ...prev.activeInsights]
    }));
  }, []);

  const dismissInsight = useCallback((id: string) => {
    setContext(prev => ({
      ...prev,
      activeInsights: prev.activeInsights.filter(i => i.id !== id)
    }));
  }, []);

  const setSelectedAssets = useCallback((assets: string[]) => {
    setContext(prev => ({
      ...prev,
      selectedAssets: assets
    }));
  }, []);

  const setActiveFilters = useCallback((filters: Record<string, any>) => {
    setContext(prev => ({
      ...prev,
      activeFilters: filters
    }));
  }, []);

  const addToSearchHistory = useCallback((query: string) => {
    setContext(prev => ({
      ...prev,
      searchHistory: [query, ...prev.searchHistory.filter(q => q !== query)].slice(0, 10)
    }));
  }, []);

  const getContextForAI = useCallback((): string => {
    const {
      currentModule,
      pageTitle,
      userActions,
      recentViews,
      systemMetrics,
      selectedAssets,
      activeFilters,
      searchHistory
    } = context;

    // Build context string for AI
    let contextStr = `# Current Context\n\n`;
    contextStr += `**Page:** ${pageTitle}\n`;
    contextStr += `**Module:** ${currentModule}\n\n`;

    if (selectedAssets.length > 0) {
      contextStr += `**Selected Assets:** ${selectedAssets.join(', ')}\n`;
    }

    if (Object.keys(activeFilters).length > 0) {
      contextStr += `**Active Filters:** ${JSON.stringify(activeFilters)}\n`;
    }

    contextStr += `\n# System Metrics\n`;
    contextStr += `- Data Quality Score: ${systemMetrics.dataQualityScore}%\n`;
    contextStr += `- Active Rules: ${systemMetrics.activeRules}\n`;
    contextStr += `- Critical Issues: ${systemMetrics.criticalIssues}\n`;
    contextStr += `- Total Assets: ${systemMetrics.assetsCount}\n`;
    contextStr += `- Running Pipelines: ${systemMetrics.pipelinesRunning}\n`;

    if (recentViews.length > 0) {
      contextStr += `\n# Recent Views\n`;
      recentViews.slice(0, 5).forEach(view => {
        contextStr += `- ${view.type}: ${view.name}\n`;
      });
    }

    if (userActions.length > 0) {
      contextStr += `\n# Recent Actions\n`;
      userActions.slice(0, 5).forEach(action => {
        contextStr += `- ${action.type} in ${action.module}: ${action.target}\n`;
      });
    }

    if (searchHistory.length > 0) {
      contextStr += `\n# Search History\n`;
      searchHistory.slice(0, 3).forEach(query => {
        contextStr += `- "${query}"\n`;
      });
    }

    return contextStr;
  }, [context]);

  // Simulate periodic metrics updates (in production, this would come from real APIs)
  useEffect(() => {
    const interval = setInterval(() => {
      // You would fetch real metrics here
      updateMetrics({
        dataQualityScore: Math.floor(Math.random() * 10) + 90, // 90-100
        activeRules: Math.floor(Math.random() * 20) + 50, // 50-70
        criticalIssues: Math.floor(Math.random() * 5), // 0-5
        assetsCount: 1247,
        pipelinesRunning: Math.floor(Math.random() * 10) + 5 // 5-15
      });
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Generate proactive insights based on context
  useEffect(() => {
    // Example: Low quality score warning
    if (context.systemMetrics.dataQualityScore < 92) {
      addInsight({
        type: 'warning',
        title: 'Quality Score Below Target',
        message: `Data quality score is ${context.systemMetrics.dataQualityScore}%. Consider reviewing critical rules.`,
        module: 'quality',
        priority: 'high',
        actionLabel: 'View Rules'
      });
    }

    // Example: Critical issues alert
    if (context.systemMetrics.criticalIssues > 3) {
      addInsight({
        type: 'warning',
        title: 'Multiple Critical Issues',
        message: `${context.systemMetrics.criticalIssues} critical issues require attention.`,
        module: 'quality',
        priority: 'high',
        actionLabel: 'Review Issues'
      });
    }
  }, [context.systemMetrics]);

  const value: UniversalAIContextValue = {
    context,
    trackAction,
    trackView,
    updateMetrics,
    addInsight,
    dismissInsight,
    setSelectedAssets,
    setActiveFilters,
    addToSearchHistory,
    getContextForAI
  };

  return (
    <UniversalAIContext.Provider value={value}>
      {children}
    </UniversalAIContext.Provider>
  );
};

export default UniversalAIProvider;

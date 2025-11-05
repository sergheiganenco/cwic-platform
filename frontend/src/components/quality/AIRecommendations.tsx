import React, { useState } from 'react';
import { Sparkles, Zap, TrendingUp, Clock, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reasoning: string;
  impact: {
    timesSaved?: string;
    riskReduced?: string;
    scoreImprovement?: string;
  };
  actionable: boolean;
  actionLabel?: string;
  estimatedEffort?: string;
}

interface AIRecommendationsProps {
  recommendations: Recommendation[];
  onTakeAction?: (recommendationId: string) => void;
  onDismiss?: (recommendationId: string) => void;
}

export const AIRecommendations: React.FC<AIRecommendationsProps> = ({
  recommendations,
  onTakeAction,
  onDismiss
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
    onDismiss?.(id);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-blue-500 bg-blue-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <Zap className="w-5 h-5 text-red-600" />;
      case 'medium': return <TrendingUp className="w-5 h-5 text-yellow-600" />;
      case 'low': return <Sparkles className="w-5 h-5 text-blue-600" />;
      default: return <Sparkles className="w-5 h-5 text-gray-600" />;
    }
  };

  const visibleRecommendations = recommendations.filter(r => !dismissedIds.has(r.id));
  const highPriority = visibleRecommendations.filter(r => r.priority === 'high');
  const mediumPriority = visibleRecommendations.filter(r => r.priority === 'medium');
  const lowPriority = visibleRecommendations.filter(r => r.priority === 'low');

  const RecommendationCard: React.FC<{ recommendation: Recommendation; index: number }> = ({
    recommendation,
    index
  }) => {
    const isExpanded = expandedIds.has(recommendation.id);

    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ x: 100, opacity: 0 }}
        transition={{ delay: index * 0.05 }}
        className={`border-l-4 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow ${getPriorityColor(recommendation.priority)}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-0.5">
              {getPriorityIcon(recommendation.priority)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">{recommendation.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded uppercase font-medium ${getPriorityBadgeColor(recommendation.priority)}`}>
                  {recommendation.priority}
                </span>
              </div>
              <p className="text-sm text-gray-700">{recommendation.description}</p>
            </div>
          </div>

          {/* Expand/Collapse Button */}
          <button
            onClick={() => toggleExpanded(recommendation.id)}
            className="ml-2 p-1 hover:bg-white rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>
        </div>

        {/* Impact Metrics */}
        <div className="flex gap-4 mb-3 text-sm">
          {recommendation.impact.timesSaved && (
            <div className="flex items-center gap-1 text-gray-600">
              <Clock className="w-4 h-4" />
              <span>Saves {recommendation.impact.timesSaved}</span>
            </div>
          )}
          {recommendation.impact.riskReduced && (
            <div className="flex items-center gap-1 text-gray-600">
              <TrendingUp className="w-4 h-4" />
              <span>Reduces risk by {recommendation.impact.riskReduced}</span>
            </div>
          )}
          {recommendation.impact.scoreImprovement && (
            <div className="flex items-center gap-1 text-gray-600">
              <CheckCircle className="w-4 h-4" />
              <span>+{recommendation.impact.scoreImprovement} score</span>
            </div>
          )}
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-white bg-opacity-50 rounded-lg p-3 mb-3">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">Why this matters:</span>
                </p>
                <p className="text-sm text-gray-600">{recommendation.reasoning}</p>
              </div>

              {recommendation.estimatedEffort && (
                <div className="text-xs text-gray-500 mb-3">
                  <span className="font-semibold">Estimated effort:</span> {recommendation.estimatedEffort}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {recommendation.actionable && (
            <button
              onClick={() => onTakeAction?.(recommendation.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                recommendation.priority === 'high'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : recommendation.priority === 'medium'
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              {recommendation.actionLabel || 'Take Action'}
            </button>
          )}
          <button
            onClick={() => handleDismiss(recommendation.id)}
            className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg font-medium transition-colors text-sm"
          >
            Dismiss
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            AI Recommendations
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Proactive insights to improve your data quality
          </p>
        </div>

        {/* Summary Badge */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-semibold rounded-full">
            {visibleRecommendations.length} active
          </span>
        </div>
      </div>

      {/* High Priority Section */}
      {highPriority.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              High Priority ({highPriority.length})
            </h3>
          </div>
          <div className="space-y-3">
            {highPriority.map((rec, idx) => (
              <RecommendationCard key={rec.id} recommendation={rec} index={idx} />
            ))}
          </div>
        </div>
      )}

      {/* Medium Priority Section */}
      {mediumPriority.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Medium Priority ({mediumPriority.length})
            </h3>
          </div>
          <div className="space-y-3">
            {mediumPriority.map((rec, idx) => (
              <RecommendationCard key={rec.id} recommendation={rec} index={idx} />
            ))}
          </div>
        </div>
      )}

      {/* Low Priority Section */}
      {lowPriority.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Optimization Opportunities ({lowPriority.length})
            </h3>
          </div>
          <div className="space-y-3">
            {lowPriority.map((rec, idx) => (
              <RecommendationCard key={rec.id} recommendation={rec} index={idx} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {visibleRecommendations.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 bg-purple-50 rounded-xl border-2 border-purple-200"
        >
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-purple-100 rounded-full">
              <Sparkles className="w-12 h-12 text-purple-600" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Recommendations
          </h3>
          <p className="text-gray-600">
            Your data quality is in great shape! AI will notify you when there are optimization opportunities.
          </p>
        </motion.div>
      )}
    </div>
  );
};

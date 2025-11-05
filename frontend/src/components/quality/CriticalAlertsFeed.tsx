import React, { useState } from 'react';
import { Flame, AlertTriangle, Clock, Users, DollarSign, Zap, Eye, BellOff, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium';
  table: string;
  issue: string;
  timestamp: string;
  impact: {
    users?: number;
    revenue?: string;
    downstream?: string;
  };
  autoFixAvailable?: boolean;
  confidence?: number;
}

interface PredictiveAlert {
  id: string;
  table: string;
  prediction: string;
  confidence: number;
  timeframe: string;
  reasoning: string;
}

interface CriticalAlertsFeedProps {
  alerts: Alert[];
  predictions?: PredictiveAlert[];
  onAutoFix?: (alertId: string) => void;
  onInvestigate?: (alertId: string) => void;
  onSnooze?: (alertId: string) => void;
  onPreventiveAction?: (predictionId: string) => void;
}

export const CriticalAlertsFeed: React.FC<CriticalAlertsFeedProps> = ({
  alerts,
  predictions = [],
  onAutoFix,
  onInvestigate,
  onSnooze,
  onPreventiveAction
}) => {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [dismissedPredictions, setDismissedPredictions] = useState<Set<string>>(new Set());

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <Flame className="w-5 h-5 text-red-600" />;
      case 'high': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      default: return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const visibleAlerts = alerts.filter(a => !dismissedAlerts.has(a.id));
  const visiblePredictions = predictions.filter(p => !dismissedPredictions.has(p.id));

  return (
    <div className="space-y-6">
      {/* Critical Alerts Section */}
      {visibleAlerts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Flame className="w-6 h-6 text-orange-500" />
              Critical Alerts
              <span className="ml-2 px-3 py-1 bg-red-500 text-white text-sm font-semibold rounded-full">
                {visibleAlerts.length} require action
              </span>
            </h2>
            <button className="text-sm text-gray-500 hover:text-gray-700">
              View All →
            </button>
          </div>

          <AnimatePresence>
            <div className="space-y-3">
              {visibleAlerts.map((alert, index) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                  className={`border-l-4 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow ${getSeverityColor(alert.severity)}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-0.5">
                        {getSeverityIcon(alert.severity)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">
                            {alert.table}
                          </h3>
                          <span className="text-sm px-2 py-0.5 bg-white rounded uppercase font-medium text-gray-600">
                            {alert.severity}
                          </span>
                        </div>
                        <p className="text-gray-700 font-medium">{alert.issue}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {alert.timestamp}
                          </span>
                          {alert.impact.users && (
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {alert.impact.users} users affected
                            </span>
                          )}
                          {alert.impact.revenue && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              {alert.impact.revenue} at risk
                            </span>
                          )}
                        </div>
                        {alert.impact.downstream && (
                          <div className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">Downstream: </span>
                            {alert.impact.downstream}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    {alert.autoFixAvailable && (
                      <button
                        onClick={() => onAutoFix?.(alert.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
                      >
                        <Zap className="w-4 h-4" />
                        Auto-Fix Available
                        {alert.confidence && (
                          <span className="text-xs bg-green-500 px-2 py-0.5 rounded">
                            {Math.round(alert.confidence * 100)}% confidence
                          </span>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => onInvestigate?.(alert.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      Investigate
                    </button>
                    <button
                      onClick={() => {
                        onSnooze?.(alert.id);
                        setDismissedAlerts(prev => new Set(prev).add(alert.id));
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                    >
                      <BellOff className="w-4 h-4" />
                      Snooze 1h
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        </div>
      )}

      {/* Predictive Alerts Section */}
      {visiblePredictions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI Predictions
              <span className="ml-2 px-3 py-1 bg-purple-500 text-white text-sm font-semibold rounded-full">
                {visiblePredictions.length} forecasted
              </span>
            </h2>
          </div>

          <AnimatePresence>
            <div className="space-y-3">
              {visiblePredictions.map((prediction, index) => (
                <motion.div
                  key={prediction.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                  className="border-l-4 border-purple-500 bg-purple-50 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-purple-600" />
                        <h3 className="font-semibold text-gray-900">
                          PREDICTED: {prediction.table}
                        </h3>
                        <span className="text-sm px-2 py-0.5 bg-white rounded font-medium text-purple-600">
                          {Math.round(prediction.confidence * 100)}% confidence
                        </span>
                      </div>
                      <p className="text-gray-700 font-medium mb-2">
                        {prediction.prediction} in {prediction.timeframe}
                      </p>
                      <p className="text-sm text-gray-600 mb-3">
                        {prediction.reasoning}
                      </p>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            onPreventiveAction?.(prediction.id);
                            setDismissedPredictions(prev => new Set(prev).add(prediction.id));
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                        >
                          <Zap className="w-4 h-4" />
                          Take Preventive Action
                        </button>
                        <button
                          onClick={() => setDismissedPredictions(prev => new Set(prev).add(prediction.id))}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                        >
                          Ignore
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        </div>
      )}

      {/* Empty State */}
      {visibleAlerts.length === 0 && visiblePredictions.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 bg-green-50 rounded-xl border-2 border-green-200"
        >
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-green-100 rounded-full">
              <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            All Clear!
          </h3>
          <p className="text-gray-600">
            No critical alerts or predictions at this time. Your data quality is excellent.
          </p>
        </motion.div>
      )}
    </div>
  );
};

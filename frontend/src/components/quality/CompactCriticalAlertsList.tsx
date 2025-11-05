import React, { useState } from 'react';
import {
  Flame,
  AlertTriangle,
  Info,
  Clock,
  Users,
  DollarSign,
  Zap,
  Eye,
  BellOff,
  ChevronDown,
  ChevronRight,
  Database,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  table: string;
  database: string;
  issue: string;
  timestamp: string;
  impact: {
    users?: number;
    revenue?: string;
    downstream?: string;
  };
  autoFixAvailable?: boolean;
  confidence?: number;
  criticalityScore?: number;
  isEmptyTableAlert?: boolean;
  ruleId?: string;
  assetId?: string;
}

interface CompactCriticalAlertsListProps {
  alerts: Alert[];
  onAutoFix?: (alertId: string) => void;
  onInvestigate?: (alertId: string) => void;
  onSnooze?: (alertId: string, duration: string) => void;
}

export const CompactCriticalAlertsList: React.FC<CompactCriticalAlertsListProps> = ({
  alerts,
  onAutoFix,
  onInvestigate,
  onSnooze
}) => {
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Group alerts by criticality
  const criticalAlerts = alerts.filter(a => !a.isEmptyTableAlert && (a.criticalityScore || 0) >= 60);
  const mediumAlerts = alerts.filter(a => !a.isEmptyTableAlert && (a.criticalityScore || 0) >= 40 && (a.criticalityScore || 0) < 60);
  const lowAlerts = alerts.filter(a => !a.isEmptyTableAlert && (a.criticalityScore || 0) < 40);
  const informationalAlerts = alerts.filter(a => a.isEmptyTableAlert);

  const getCriticalityColor = (score: number) => {
    if (score >= 80) return 'bg-red-600 text-white';
    if (score >= 60) return 'bg-orange-500 text-white';
    if (score >= 40) return 'bg-yellow-500 text-white';
    if (score >= 25) return 'bg-blue-500 text-white';
    return 'bg-gray-400 text-white';
  };

  const getCriticalityBorderColor = (score: number) => {
    if (score >= 80) return 'border-l-red-600';
    if (score >= 60) return 'border-l-orange-500';
    if (score >= 40) return 'border-l-yellow-500';
    if (score >= 25) return 'border-l-blue-500';
    return 'border-l-gray-400';
  };

  const getCriticalityBgColor = (score: number, isExpanded: boolean) => {
    if (isExpanded) {
      if (score >= 80) return 'bg-red-50';
      if (score >= 60) return 'bg-orange-50';
      if (score >= 40) return 'bg-yellow-50';
      if (score >= 25) return 'bg-blue-50';
      return 'bg-gray-50';
    }
    return 'hover:bg-gray-50';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <Flame className="w-4 h-4 text-red-600" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'medium': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default: return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const toggleExpand = (alertId: string) => {
    setExpandedAlertId(expandedAlertId === alertId ? null : alertId);
  };

  const renderAlertRow = (alert: Alert) => {
    const isExpanded = expandedAlertId === alert.id;
    const isDismissed = dismissedAlerts.has(alert.id);
    const criticalityScore = alert.criticalityScore || 0;

    if (isDismissed) return null;

    return (
      <motion.div
        key={alert.id}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className={`border-l-4 ${getCriticalityBorderColor(criticalityScore)} ${getCriticalityBgColor(criticalityScore, isExpanded)} transition-all`}
      >
        {/* Compact Row */}
        <div
          onClick={() => toggleExpand(alert.id)}
          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        >
          {/* Expand Icon */}
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </div>

          {/* Criticality Score Badge */}
          <div className="flex-shrink-0">
            <div className={`w-12 h-12 rounded-lg ${getCriticalityColor(criticalityScore)} flex items-center justify-center font-bold text-lg shadow-md`}>
              {criticalityScore}
            </div>
          </div>

          {/* Severity Icon */}
          <div className="flex-shrink-0">
            {getSeverityIcon(alert.severity)}
          </div>

          {/* Alert Info (Compact) */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 truncate">
                {alert.database}.{alert.table}
              </span>
              {alert.isEmptyTableAlert && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                  INFORMATIONAL
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 truncate">{alert.issue}</p>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {alert.timestamp}
            </span>
            {alert.impact.users && alert.impact.users > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {alert.impact.users}
              </span>
            )}
            {alert.impact.revenue && alert.impact.revenue !== '$0K' && (
              <span className="flex items-center gap-1 text-red-600 font-medium">
                <DollarSign className="w-3 h-3" />
                {alert.impact.revenue}
              </span>
            )}
          </div>

          {/* Auto-Fix Badge */}
          {alert.autoFixAvailable && (
            <div className="flex-shrink-0">
              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                <Zap className="w-3 h-3" />
                Auto-Fix
              </div>
            </div>
          )}
        </div>

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-gray-200 px-4 py-4 bg-white"
            >
              {/* Full Issue Description */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Issue Details</h4>
                <p className="text-sm text-gray-600">{alert.issue}</p>

                {alert.impact.downstream && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-xs text-yellow-800">
                      <span className="font-semibold">Downstream Impact:</span> {alert.impact.downstream}
                    </p>
                  </div>
                )}
              </div>

              {/* Criticality Breakdown */}
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Criticality Assessment</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Score</p>
                    <p className="font-bold text-lg">{criticalityScore}/100</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Severity</p>
                    <p className="font-semibold uppercase">{alert.severity}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Type</p>
                    <p className="font-semibold">
                      {alert.isEmptyTableAlert ? 'Empty Table' : 'Data Quality'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {alert.autoFixAvailable && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAutoFix?.(alert.id);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors text-sm"
                  >
                    <Zap className="w-4 h-4" />
                    Auto-Fix Available
                    {alert.confidence && (
                      <span className="text-xs bg-green-500 px-2 py-0.5 rounded">
                        {Math.round(alert.confidence * 100)}%
                      </span>
                    )}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onInvestigate?.(alert.id);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  <Eye className="w-4 h-4" />
                  Investigate
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSnooze?.(alert.id, '1h');
                    setDismissedAlerts(prev => new Set(prev).add(alert.id));
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors text-sm"
                >
                  <BellOff className="w-4 h-4" />
                  Snooze 1h
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const renderSection = (title: string, alerts: Alert[], icon: React.ReactNode, description: string) => {
    if (alerts.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded">
              {alerts.length}
            </span>
          </div>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-200">
          {alerts.map(renderAlertRow)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Critical</p>
              <p className="text-3xl font-bold text-red-700">{criticalAlerts.length}</p>
            </div>
            <Flame className="w-8 h-8 text-red-500 opacity-50" />
          </div>
          <p className="text-xs text-red-600 mt-1">Score 60-100</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 font-medium">Medium</p>
              <p className="text-3xl font-bold text-yellow-700">{mediumAlerts.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500 opacity-50" />
          </div>
          <p className="text-xs text-yellow-600 mt-1">Score 40-59</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Low Priority</p>
              <p className="text-3xl font-bold text-blue-700">{lowAlerts.length}</p>
            </div>
            <Info className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
          <p className="text-xs text-blue-600 mt-1">Score 26-39</p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Informational</p>
              <p className="text-3xl font-bold text-gray-700">{informationalAlerts.length}</p>
            </div>
            <Database className="w-8 h-8 text-gray-500 opacity-50" />
          </div>
          <p className="text-xs text-gray-600 mt-1">Empty Tables</p>
        </div>
      </div>

      {/* Alerts by Priority */}
      {renderSection(
        'Critical Alerts',
        criticalAlerts,
        <Flame className="w-5 h-5 text-red-600" />,
        'Immediate attention required'
      )}

      {renderSection(
        'Medium Priority',
        mediumAlerts,
        <AlertTriangle className="w-5 h-5 text-yellow-600" />,
        'Address within 24 hours'
      )}

      {renderSection(
        'Low Priority',
        lowAlerts,
        <Info className="w-5 h-5 text-blue-600" />,
        'Monitor and address as needed'
      )}

      {renderSection(
        'Informational',
        informationalAlerts,
        <Database className="w-5 h-5 text-gray-600" />,
        'Empty tables - not actionable quality issues'
      )}

      {/* Empty State */}
      {alerts.length === 0 && (
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
            No critical alerts at this time. Your data quality is excellent.
          </p>
        </motion.div>
      )}
    </div>
  );
};

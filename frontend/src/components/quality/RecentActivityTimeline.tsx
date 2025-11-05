import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Zap,
  User,
  Clock,
  ExternalLink,
  Play,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';

interface ActivityItem {
  id: string;
  type: 'scan' | 'fix' | 'alert' | 'rule_created' | 'rule_updated' | 'manual_action';
  status: 'success' | 'warning' | 'error' | 'info';
  title: string;
  description: string;
  timestamp: string;
  user?: string;
  metrics?: {
    label: string;
    value: string | number;
  }[];
  actionable?: boolean;
  actionLabel?: string;
}

interface RecentActivityTimelineProps {
  activities: ActivityItem[];
  maxItems?: number;
  onViewAll?: () => void;
  onAction?: (activityId: string) => void;
}

export const RecentActivityTimeline: React.FC<RecentActivityTimelineProps> = ({
  activities,
  maxItems = 10,
  onViewAll,
  onAction
}) => {
  const visibleActivities = activities.slice(0, maxItems);

  const getActivityIcon = (type: string, status: string) => {
    const iconClasses = "w-5 h-5";

    if (status === 'success') {
      switch (type) {
        case 'scan': return <CheckCircle className={`${iconClasses} text-green-600`} />;
        case 'fix': return <Zap className={`${iconClasses} text-green-600`} />;
        case 'rule_created': return <CheckCircle className={`${iconClasses} text-green-600`} />;
        default: return <CheckCircle className={`${iconClasses} text-green-600`} />;
      }
    } else if (status === 'warning') {
      return <AlertTriangle className={`${iconClasses} text-yellow-600`} />;
    } else if (status === 'error') {
      return <XCircle className={`${iconClasses} text-red-600`} />;
    } else {
      return <Clock className={`${iconClasses} text-blue-600`} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 border-green-300';
      case 'warning': return 'bg-yellow-100 border-yellow-300';
      case 'error': return 'bg-red-100 border-red-300';
      case 'info': return 'bg-blue-100 border-blue-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  const getTimelineColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
              <Clock className="w-5 h-5 text-white" />
            </div>
            Recent Activity
          </h2>
          <p className="text-sm text-gray-500 mt-1">Latest quality events and actions</p>
        </div>

        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline flex items-center gap-1"
          >
            View All
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />

        {/* Activity Items */}
        <div className="space-y-6">
          {visibleActivities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className="relative pl-14"
            >
              {/* Timeline Icon */}
              <div className={`absolute left-0 w-10 h-10 rounded-full ${getTimelineColor(activity.status)} flex items-center justify-center shadow-md`}>
                {getActivityIcon(activity.type, activity.status)}
              </div>

              {/* Content Card */}
              <div className={`border-2 rounded-lg p-4 ${getStatusColor(activity.status)} hover:shadow-md transition-shadow`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{activity.title}</h3>
                    <p className="text-sm text-gray-700">{activity.description}</p>
                  </div>
                  <div className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                    {formatTimestamp(activity.timestamp)}
                  </div>
                </div>

                {/* Metrics */}
                {activity.metrics && activity.metrics.length > 0 && (
                  <div className="flex gap-4 mt-3 pt-3 border-t border-gray-200">
                    {activity.metrics.map((metric, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{metric.label}:</span>
                        <span className="text-sm font-semibold text-gray-900">{metric.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* User */}
                {activity.user && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                    <User className="w-3 h-3" />
                    <span>{activity.user}</span>
                  </div>
                )}

                {/* Action Button */}
                {activity.actionable && (
                  <div className="mt-3">
                    <button
                      onClick={() => onAction?.(activity.id)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg font-medium transition-colors text-sm"
                    >
                      {activity.type === 'scan' && <RefreshCw className="w-3 h-3" />}
                      {activity.type === 'fix' && <Zap className="w-3 h-3" />}
                      {activity.type === 'alert' && <Play className="w-3 h-3" />}
                      {activity.actionLabel || 'View Details'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      {activities.length > maxItems && (
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            Showing {maxItems} of {activities.length} activities
          </p>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
            >
              Load More
            </button>
          )}
        </div>
      )}

      {/* Empty State */}
      {activities.length === 0 && (
        <div className="text-center py-12">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <Clock className="w-12 h-12 text-gray-400" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recent Activity</h3>
          <p className="text-gray-600">
            Activity will appear here as quality scans, fixes, and rule changes occur.
          </p>
        </div>
      )}
    </div>
  );
};

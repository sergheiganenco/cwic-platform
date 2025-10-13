import { AlertCircle, CheckCircle, Loader, XCircle } from 'lucide-react';
import React from 'react';
import type { ScanProgress, ScanStatus } from '@/types/advancedCatalog';

interface ScanProgressBarProps {
  progress: ScanProgress;
  onDismiss?: () => void;
}

export const ScanProgressBar: React.FC<ScanProgressBarProps> = ({ progress, onDismiss }) => {
  const getStatusIcon = (status: ScanStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
      case 'connecting':
      case 'discovering':
      case 'profiling':
      case 'classifying':
        return <Loader className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <Loader className="h-5 w-5 text-gray-600 animate-spin" />;
    }
  };

  const getStatusColor = (status: ScanStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      case 'pending':
      case 'connecting':
      case 'discovering':
      case 'profiling':
      case 'classifying':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusText = (status: ScanStatus) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'connecting':
        return 'Connecting to data source';
      case 'discovering':
        return 'Discovering objects';
      case 'profiling':
        return 'Profiling data';
      case 'classifying':
        return 'Classifying data';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  const progressPercentage = Math.min(100, Math.max(0, progress.progress));

  return (
    <div className={`rounded-lg border p-4 ${getStatusColor(progress.status)}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">{getStatusIcon(progress.status)}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                {getStatusText(progress.status)}
                {progress.currentPhase && ` - ${progress.currentPhase}`}
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">Scan ID: {progress.scanId}</p>
            </div>

            {onDismiss && progress.status === 'completed' && (
              <button
                onClick={onDismiss}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                progress.status === 'completed'
                  ? 'bg-green-600'
                  : progress.status === 'failed'
                  ? 'bg-red-600'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {progress.stats.databasesDiscovered}
              </div>
              <div className="text-xs text-gray-600">Databases</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {progress.stats.schemasDiscovered}
              </div>
              <div className="text-xs text-gray-600">Schemas</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {progress.stats.objectsDiscovered}
              </div>
              <div className="text-xs text-gray-600">Objects</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {progress.stats.columnsDiscovered}
              </div>
              <div className="text-xs text-gray-600">Columns</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {progress.stats.objectsProfiled}
              </div>
              <div className="text-xs text-gray-600">Profiled</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {progress.stats.objectsClassified}
              </div>
              <div className="text-xs text-gray-600">Classified</div>
            </div>
          </div>

          {/* Message */}
          {progress.message && (
            <div className="mt-3 text-xs text-gray-700 bg-white bg-opacity-50 rounded px-2 py-1">
              {progress.message}
            </div>
          )}

          {/* Errors */}
          {progress.errors.length > 0 && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-1 text-xs font-medium text-red-700">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{progress.errors.length} Error(s)</span>
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {progress.errors.slice(0, 5).map((error, index) => (
                  <div
                    key={index}
                    className="text-xs text-red-700 bg-red-100 rounded px-2 py-1"
                  >
                    <span className="font-medium">{error.objectName}:</span> {error.error}
                  </div>
                ))}
                {progress.errors.length > 5 && (
                  <div className="text-xs text-gray-600">
                    And {progress.errors.length - 5} more error(s)...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timing */}
          <div className="mt-3 flex items-center gap-3 text-xs text-gray-600">
            <span>Started: {new Date(progress.startedAt).toLocaleString()}</span>
            {progress.completedAt && (
              <span>Completed: {new Date(progress.completedAt).toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

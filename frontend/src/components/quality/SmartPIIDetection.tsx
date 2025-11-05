// frontend/src/components/quality/SmartPIIDetection.tsx
import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Info,
  Brain,
  Zap,
  TrendingUp,
} from 'lucide-react';
import axios from 'axios';
import { notifyPIIConfigUpdate } from '@utils/crossTabSync';

interface PIIDetectionResult {
  columnName: string;
  isPII: boolean;
  piiType: string | null;
  confidence: number;
  reason: string;
  manualOverride?: boolean;
  trainingSource?: 'rule' | 'pattern' | 'manual' | 'ml';
}

interface SmartPIIDetectionProps {
  dataSourceId: string;
  databaseName: string;
  schemaName: string;
  tableName: string;
  onDetectionComplete?: (results: PIIDetectionResult[]) => void;
}

export const SmartPIIDetection: React.FC<SmartPIIDetectionProps> = ({
  dataSourceId,
  databaseName,
  schemaName,
  tableName,
  onDetectionComplete,
}) => {
  const [detecting, setDetecting] = useState(false);
  const [results, setResults] = useState<PIIDetectionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);

  const runDetection = async () => {
    try {
      setDetecting(true);
      setError(null);

      console.log('[SmartPII] Running detection for:', {
        dataSourceId,
        databaseName,
        schemaName,
        tableName,
      });

      const response = await axios.post('http://localhost:3000/api/catalog/pii/detect', {
        dataSourceId,
        databaseName,
        schemaName,
        tableName,
      });

      if (response.data.success) {
        setResults(response.data.columns);
        if (onDetectionComplete) {
          onDetectionComplete(response.data.columns);
        }
        console.log('[SmartPII] Detection complete:', response.data);
      } else {
        setError(response.data.error || 'Detection failed');
      }
    } catch (err: any) {
      console.error('[SmartPII] Detection error:', err);
      const errorMessage = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.message || 'Failed to detect PII';
      setError(errorMessage);
    } finally {
      setDetecting(false);
    }
  };

  const handleManualOverride = async (
    columnName: string,
    isPII: boolean,
    piiType: string | null
  ) => {
    try {
      await axios.post('http://localhost:3000/api/catalog/pii/classify', {
        dataSourceId,
        databaseName,
        schemaName,
        tableName,
        columnName,
        dataType: 'varchar', // TODO: Get actual data type
        isPII,
        piiType,
        reason: `Manual classification by user`,
        userId: 'current-user', // TODO: Get from auth
      });

      // Notify all tabs that PII configuration has changed
      notifyPIIConfigUpdate();

      // Re-run detection to get updated results
      await runDetection();
      setEditingColumn(null);
    } catch (err: any) {
      console.error('[SmartPII] Manual override error:', err);
      setError(err.response?.data?.error || 'Failed to save classification');
    }
  };

  // Auto-run detection on mount
  useEffect(() => {
    runDetection();
  }, [dataSourceId, databaseName, schemaName, tableName]);

  const piiColumns = results.filter(r => r.isPII);
  const nonPIIColumns = results.filter(r => !r.isPII);
  const avgConfidence =
    results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length)
      : 0;

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-green-100 text-green-800';
    if (confidence >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-100 text-orange-800';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-900">Smart PII Detection</h3>
          </div>
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
            AI-Powered
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
          >
            {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
          <button
            onClick={runDetection}
            disabled={detecting}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
          >
            {detecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Re-scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-900">Detection Error</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {results.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-600">Total Columns</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{results.length}</div>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <span className="text-sm text-red-600">PII Detected</span>
            </div>
            <div className="text-2xl font-bold text-red-700">{piiColumns.length}</div>
          </div>

          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-600">Safe Columns</span>
            </div>
            <div className="text-2xl font-bold text-green-700">{nonPIIColumns.length}</div>
          </div>

          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <span className="text-sm text-indigo-600">Avg Confidence</span>
            </div>
            <div className={`text-2xl font-bold ${getConfidenceColor(avgConfidence)}`}>
              {avgConfidence}%
            </div>
          </div>
        </div>
      )}

      {/* PII Columns */}
      {piiColumns.length > 0 && (
        <div className="bg-white border border-red-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <h4 className="font-semibold text-red-900">
              PII Columns Detected ({piiColumns.length})
            </h4>
          </div>
          <div className="divide-y divide-gray-200">
            {piiColumns.map((result) => (
              <div key={result.columnName} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <code className="px-2 py-1 bg-gray-100 text-gray-900 rounded font-mono text-sm">
                        {result.columnName}
                      </code>
                      {result.piiType && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                          {result.piiType}
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${getConfidenceBadgeColor(
                          result.confidence
                        )}`}
                      >
                        {result.confidence}% confident
                      </span>
                      {result.manualOverride && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          Manual Override
                        </span>
                      )}
                    </div>
                    {showDetails && (
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{result.reason}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      handleManualOverride(result.columnName, false, null)
                    }
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    Mark as NOT PII
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-PII Columns */}
      {nonPIIColumns.length > 0 && showDetails && (
        <div className="bg-white border border-green-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b border-green-200 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold text-green-900">
              Safe Columns ({nonPIIColumns.length})
            </h4>
          </div>
          <div className="divide-y divide-gray-200">
            {nonPIIColumns.map((result) => (
              <div key={result.columnName} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <code className="px-2 py-1 bg-gray-100 text-gray-900 rounded font-mono text-sm">
                        {result.columnName}
                      </code>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${getConfidenceBadgeColor(
                          result.confidence
                        )}`}
                      >
                        {result.confidence}% confident
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{result.reason}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingColumn(result.columnName)}
                    className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  >
                    Mark as PII
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Brain className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-indigo-900">
            <p className="font-semibold mb-1">Smart PII Detection</p>
            <p className="text-indigo-700">
              This AI-powered system analyzes <strong>actual data content</strong>, not just column
              names. It understands context - for example, <code className="px-1 bg-indigo-100 rounded">table_name</code> in
              an audit table contains table names like "customers" or "orders", not person names, so
              it's correctly identified as metadata, not PII.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartPIIDetection;

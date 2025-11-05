// PII Rule Rescan Prompt - Shows impact and offers to rescan after rule changes
import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Database,
  Table as TableIcon,
  CheckCircle2,
  Loader2,
  Info,
  X,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';

interface PIIRuleRescanPromptProps {
  isOpen: boolean;
  ruleId: number;
  ruleName: string;
  onClose: () => void;
  onRescanComplete?: () => void;
}

interface RuleImpact {
  affectedColumns: number;
  affectedTables: number;
  affectedDataSources: number;
  sampleColumns: Array<{
    column_name: string;
    table_name: string;
    schema_name: string;
    database_name: string;
    data_source_name: string;
  }>;
}

export const PIIRuleRescanPrompt: React.FC<PIIRuleRescanPromptProps> = ({
  isOpen,
  ruleId,
  ruleName,
  onClose,
  onRescanComplete,
}) => {
  const [impact, setImpact] = useState<RuleImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState(false);
  const [rescanComplete, setRescanComplete] = useState(false);
  const [rescanResult, setRescanResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchImpact();
    }
  }, [isOpen, ruleId]);

  const fetchImpact = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/pii-rules/${ruleId}/impact`);
      const result = await response.json();

      if (result.success) {
        setImpact(result.data);
      } else {
        setError('Failed to fetch impact data');
      }
    } catch (err) {
      console.error('Error fetching impact:', err);
      setError('Failed to fetch impact data');
    } finally {
      setLoading(false);
    }
  };

  const handleRescan = async (clearExisting: boolean) => {
    setRescanning(true);
    setError(null);

    try {
      const response = await fetch(`/api/pii-rules/${ruleId}/rescan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearExisting }),
      });

      const result = await response.json();

      if (result.success) {
        setRescanResult(result.data.result);
        setRescanComplete(true);

        // Notify parent
        if (onRescanComplete) {
          setTimeout(() => {
            onRescanComplete();
          }, 2000);
        }
      } else {
        setError(result.error || 'Rescan failed');
      }
    } catch (err: any) {
      console.error('Error rescanning:', err);
      setError(err.message || 'Rescan failed');
    } finally {
      setRescanning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">PII Rule Changed</h2>
              <p className="text-orange-100 text-sm mt-1">
                Re-apply classifications to existing data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Rule Info */}
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h3 className="font-semibold text-orange-900 mb-2">Rule: {ruleName}</h3>
            <p className="text-sm text-orange-800">
              You've just modified this PII detection rule. Existing data in your catalog may still
              have old PII classifications that don't match the new rule settings.
            </p>
          </div>

          {/* Impact Assessment */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              <span className="ml-3 text-gray-600">Analyzing impact...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          ) : rescanComplete ? (
            /* Rescan Complete */
            <div className="space-y-4">
              <div className="p-6 bg-green-50 border-2 border-green-500 rounded-lg text-center">
                <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-900 mb-2">Rescan Complete!</h3>
                <p className="text-green-800 mb-4">
                  PII classifications have been updated to match the new rule settings.
                </p>

                {rescanResult && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-white p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {rescanResult.columnsClassified}
                      </div>
                      <div className="text-sm text-gray-600">Columns Re-classified</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {rescanResult.tablesAffected}
                      </div>
                      <div className="text-sm text-gray-600">Tables Affected</div>
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={onClose}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Done
              </Button>
            </div>
          ) : (
            /* Show Impact and Rescan Options */
            <div className="space-y-6">
              {/* Impact Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-white border-2 border-gray-200 rounded-lg text-center">
                  <Database className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900">
                    {impact?.affectedColumns || 0}
                  </div>
                  <div className="text-sm text-gray-600">Columns</div>
                </div>

                <div className="p-4 bg-white border-2 border-gray-200 rounded-lg text-center">
                  <TableIcon className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900">
                    {impact?.affectedTables || 0}
                  </div>
                  <div className="text-sm text-gray-600">Tables</div>
                </div>

                <div className="p-4 bg-white border-2 border-gray-200 rounded-lg text-center">
                  <Database className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900">
                    {impact?.affectedDataSources || 0}
                  </div>
                  <div className="text-sm text-gray-600">Data Sources</div>
                </div>
              </div>

              {/* Sample Columns */}
              {impact && impact.sampleColumns.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    Sample Affected Columns:
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {impact.sampleColumns.map((col, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-gray-50 border border-gray-200 rounded text-sm"
                      >
                        <div className="font-mono text-gray-900">{col.column_name}</div>
                        <div className="text-xs text-gray-600">
                          {col.data_source_name} → {col.database_name} → {col.schema_name}.
                          {col.table_name}
                        </div>
                      </div>
                    ))}
                    {impact.affectedColumns > impact.sampleColumns.length && (
                      <div className="text-xs text-gray-500 italic text-center py-2">
                        ...and {impact.affectedColumns - impact.sampleColumns.length} more columns
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Info Banner */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <strong>What happens during rescan:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Removes old PII classifications for this rule</li>
                    <li>Applies updated rule settings to all data</li>
                    <li>Matches columns based on name hints and regex patterns</li>
                    <li>Updates PII indicators across the platform</li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={() => handleRescan(true)}
                  disabled={rescanning}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-2 py-3"
                >
                  {rescanning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Rescanning...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      Rescan & Update Classifications
                    </>
                  )}
                </Button>

                <Button
                  onClick={onClose}
                  disabled={rescanning}
                  className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Skip for Now
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  You can always rescan later from the rule settings
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PIIRuleRescanPrompt;

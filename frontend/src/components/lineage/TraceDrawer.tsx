/**
 * Trace Drawer - Shows row-level lineage evidence
 * Displays sample pairs, coverage, confidence, and validation
 */
import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Play,
  RefreshCcw,
  Eye,
  EyeOff,
  Download,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import axios from 'axios';

interface SamplePair {
  sourceRowHash: string;
  targetRowHash: string;
  sourceValues: Record<string, any>;
  targetValues: Record<string, any>;
  matchedAt: string;
  confidence: number;
}

interface TraceEvidence {
  edgeId: string;
  sourceTable: string;
  targetTable: string;
  coveragePct: number;
  confidence: number;
  samplePairs: SamplePair[];
  evidenceSources: string[];
  timeWindow: {
    start: string;
    end: string;
  };
  metadata?: Record<string, any>;
}

interface ValidationResult {
  isValid: boolean;
  matchedRows: number;
  totalRows: number;
  confidence: number;
  discrepancies: Array<{
    issue: string;
    affectedRows: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  executionTime: number;
}

interface TraceDrawerProps {
  edgeId: string | null;
  edgeLabel?: string;
  onClose: () => void;
}

export function TraceDrawer({ edgeId, edgeLabel, onClose }: TraceDrawerProps): JSX.Element | null {
  const [evidence, setEvidence] = useState<TraceEvidence | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showMasked, setShowMasked] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch trace evidence
  useEffect(() => {
    if (!edgeId) return;

    const fetchEvidence = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`http://localhost:3002/api/trace/${edgeId}`, {
          params: {
            sampleSize: 10,
            maskPII: showMasked,
            timeWindowDays: 30,
          },
        });

        if (response.data.success) {
          setEvidence(response.data.data);
        }
      } catch (err: any) {
        console.error('Failed to fetch trace evidence:', err);
        setError(err.response?.data?.error?.message || 'Failed to load trace evidence');
      } finally {
        setLoading(false);
      }
    };

    void fetchEvidence();
  }, [edgeId, showMasked]);

  // Validate join
  const handleValidateJoin = async () => {
    if (!evidence) return;

    setValidating(true);
    try {
      // Extract join column from metadata or use a default
      const joinColumn = evidence.metadata?.joinColumn || 'id';

      const response = await axios.post('http://localhost:3002/api/trace/validate', {
        sourceTable: evidence.sourceTable,
        targetTable: evidence.targetTable,
        joinColumn,
      });

      if (response.data.success) {
        setValidation(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to validate join:', err);
      setError(err.response?.data?.error?.message || 'Failed to validate join');
    } finally {
      setValidating(false);
    }
  };

  // Export evidence
  const handleExport = () => {
    if (!evidence) return;

    const dataStr = JSON.stringify(evidence, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trace-${edgeId}-${new Date().toISOString()}.json`;
    link.click();
  };

  if (!edgeId) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-2/3 bg-white shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Eye className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Row-Level Trace</h2>
              <p className="text-indigo-100 text-sm">
                {edgeLabel || 'Evidence for data lineage connection'}
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Quick Stats */}
        {evidence && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-indigo-100 mb-1">Coverage</div>
              <div className="text-2xl font-bold">{evidence.coveragePct.toFixed(1)}%</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-indigo-100 mb-1">Confidence</div>
              <div className="text-2xl font-bold">{(evidence.confidence * 100).toFixed(0)}%</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-indigo-100 mb-1">Samples</div>
              <div className="text-2xl font-bold">{evidence.samplePairs.length}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-indigo-100 mb-1">Sources</div>
              <div className="text-2xl font-bold">{evidence.evidenceSources.length}</div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCcw className="h-12 w-12 animate-spin text-indigo-500 mx-auto mb-4" />
              <p className="text-gray-600">Loading trace evidence...</p>
            </div>
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-900">Error</div>
                  <div className="text-sm text-red-800">{error}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {evidence && !loading && (
          <>
            {/* Evidence Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5 text-indigo-600" />
                  Evidence Sources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {evidence.evidenceSources.map((source) => (
                    <Badge key={source} className="bg-indigo-100 text-indigo-800">
                      {source.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  <div>
                    <strong>Time Window:</strong>{' '}
                    {new Date(evidence.timeWindow.start).toLocaleDateString()} -{' '}
                    {new Date(evidence.timeWindow.end).toLocaleDateString()}
                  </div>
                  <div>
                    <strong>Source:</strong> {evidence.sourceTable}
                  </div>
                  <div>
                    <strong>Target:</strong> {evidence.targetTable}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleValidateJoin}
                disabled={validating}
                className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600"
              >
                {validating ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Prove This Join
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowMasked(!showMasked)}
                className="gap-2"
              >
                {showMasked ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {showMasked ? 'Show Raw' : 'Mask PII'}
              </Button>
              <Button variant="outline" onClick={handleExport} className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>

            {/* Validation Results */}
            {validation && (
              <Card className={validation.isValid ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {validation.isValid ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                    )}
                    Validation Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-600">Matched Rows</div>
                      <div className="text-2xl font-bold">{validation.matchedRows.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Total Rows</div>
                      <div className="text-2xl font-bold">{validation.totalRows.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Execution Time</div>
                      <div className="text-2xl font-bold">{validation.executionTime}ms</div>
                    </div>
                  </div>

                  {validation.discrepancies.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-semibold text-sm">Discrepancies:</div>
                      {validation.discrepancies.map((disc, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg ${
                            disc.severity === 'critical'
                              ? 'bg-red-100 text-red-900'
                              : disc.severity === 'high'
                              ? 'bg-orange-100 text-orange-900'
                              : 'bg-yellow-100 text-yellow-900'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <Badge className="mt-0.5">{disc.severity}</Badge>
                            <div className="flex-1">
                              <div className="font-medium">{disc.issue}</div>
                              <div className="text-sm">{disc.affectedRows.toLocaleString()} rows affected</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sample Pairs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sample Row Pairs</CardTitle>
              </CardHeader>
              <CardContent>
                {evidence.samplePairs.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No sample pairs available
                  </div>
                ) : (
                  <div className="space-y-4">
                    {evidence.samplePairs.map((pair, idx) => (
                      <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-sm font-semibold text-gray-700">Pair #{idx + 1}</div>
                          <Badge className="bg-green-100 text-green-800">
                            {(pair.confidence * 100).toFixed(0)}% match
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs font-semibold text-gray-600 mb-2">Source Row</div>
                            <div className="bg-white rounded p-3 text-xs font-mono space-y-1">
                              {Object.entries(pair.sourceValues).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="text-gray-600">{key}:</span>
                                  <span className="font-semibold">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-gray-600 mb-2">Target Row</div>
                            <div className="bg-white rounded p-3 text-xs font-mono space-y-1">
                              {Object.entries(pair.targetValues).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="text-gray-600">{key}:</span>
                                  <span className="font-semibold">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-gray-500">
                          Matched at: {new Date(pair.matchedAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

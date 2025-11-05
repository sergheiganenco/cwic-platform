// Rule Impact Simulator - Preview rule impact before running
import React, { useState, useEffect } from 'react';
import { X, Play, AlertCircle, CheckCircle, Zap, Clock, Database, TrendingUp } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Progress } from '@components/ui/Progress';
import { Badge } from '@components/ui/Badge';
import { Alert, AlertDescription } from '@components/ui/Alert';
import type { QualityRule } from '@services/api/quality';

interface RuleImpactSimulatorProps {
  rule: QualityRule | null;
  onClose: () => void;
}

export const RuleImpactSimulator: React.FC<RuleImpactSimulatorProps> = ({ rule, onClose }) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    if (rule) {
      runSimulation();
    }
  }, [rule]);

  const runSimulation = () => {
    setIsSimulating(true);

    // Simulate impact analysis
    setTimeout(() => {
      setResults({
        estimatedRowsAffected: Math.floor(Math.random() * 10000) + 1000,
        totalRows: 50000,
        executionTime: (Math.random() * 5).toFixed(1),
        performanceCost: Math.random() > 0.7 ? 'high' : 'low',
        autoFixable: Math.floor(Math.random() * 90) + 10,
        similarIssues: Math.floor(Math.random() * 50),
        impact: {
          dataQualityScore: (Math.random() * 10).toFixed(1),
          affectedTables: Math.floor(Math.random() * 5) + 1,
          affectedColumns: Math.floor(Math.random() * 10) + 1
        },
        sampleIssues: [
          { id: 1, value: 'null', severity: 'high' },
          { id: 5, value: 'invalid@', severity: 'medium' },
          { id: 12, value: '', severity: 'high' }
        ]
      });
      setIsSimulating(false);
    }, 2000);
  };

  if (!rule) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-6 h-6 text-blue-600" />
              Impact Simulator
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Preview what this rule will catch before running it
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Rule Info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{rule.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{rule.description}</p>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="secondary">{rule.severity}</Badge>
                <Badge variant="secondary">{rule.dimension}</Badge>
                {rule.table_name && (
                  <span className="text-xs text-gray-500">
                    Target: {rule.table_name}.{rule.column_name}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {isSimulating ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Analyzing impact...</p>
            </div>
          ) : results ? (
            <div className="space-y-6">
              {/* Impact Overview */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-red-600">
                      {results.estimatedRowsAffected.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Rows Affected</div>
                    <div className="text-xs text-gray-500">
                      {((results.estimatedRowsAffected / results.totalRows) * 100).toFixed(1)}% of total
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600 flex items-center justify-center gap-1">
                      <Clock className="w-6 h-6" />
                      {results.executionTime}s
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Est. Time</div>
                    <Badge
                      className={`mt-1 ${
                        results.performanceCost === 'high'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {results.performanceCost} cost
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{results.autoFixable}%</div>
                    <div className="text-xs text-gray-600 mt-1">Auto-fixable</div>
                    <div className="text-xs text-gray-500">Can be fixed automatically</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-purple-600">{results.similarIssues}</div>
                    <div className="text-xs text-gray-600 mt-1">Related Issues</div>
                    <div className="text-xs text-gray-500">Similar problems found</div>
                  </CardContent>
                </Card>
              </div>

              {/* Quality Impact */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    Expected Quality Improvement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Data Quality Score</span>
                        <span className="font-medium text-green-600">+{results.impact.dataQualityScore}%</span>
                      </div>
                      <Progress value={parseFloat(results.impact.dataQualityScore) * 10} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Affected Tables</div>
                        <div className="font-medium text-gray-900">{results.impact.affectedTables}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Affected Columns</div>
                        <div className="font-medium text-gray-900">{results.impact.affectedColumns}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Auto-fix Capability */}
              {results.autoFixable > 70 && (
                <Alert className="border-green-200 bg-green-50">
                  <Zap className="w-4 h-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    {results.autoFixable}% of issues can be automatically fixed. Enable auto-fix to improve data quality instantly.
                  </AlertDescription>
                </Alert>
              )}

              {/* Sample Issues */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sample Issues Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {results.sampleIssues.map((issue: any) => (
                      <div key={issue.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <AlertCircle className={`w-4 h-4 ${
                            issue.severity === 'high' ? 'text-red-500' : 'text-yellow-500'
                          }`} />
                          <div>
                            <div className="text-sm font-medium text-gray-900">Row {issue.id}</div>
                            <div className="text-xs text-gray-600">
                              Value: <code className="bg-white px-1 py-0.5 rounded">{issue.value || 'null'}</code>
                            </div>
                          </div>
                        </div>
                        <Badge variant={issue.severity === 'high' ? 'destructive' : 'secondary'}>
                          {issue.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            This is a simulated preview. Actual results may vary.
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {results && (
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Play className="w-4 h-4 mr-2" />
                Run Rule
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

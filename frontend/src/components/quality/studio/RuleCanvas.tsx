// Rule Canvas - Interactive graph view of rules
import React from 'react';
import { Play, Edit, Trash2, MoreVertical, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';
import { Progress } from '@components/ui/Progress';
import type { QualityRule } from '@services/api/quality';

interface RuleCanvasProps {
  rules: QualityRule[];
  selectedRules: Set<string>;
  onRuleSelect: (id: string) => void;
  onRuleEdit: (rule: QualityRule) => void;
  onRuleExecute?: (id: string) => Promise<void>;
  onRuleView?: (rule: QualityRule) => void;
}

export const RuleCanvas: React.FC<RuleCanvasProps> = ({
  rules,
  selectedRules,
  onRuleSelect,
  onRuleEdit,
  onRuleExecute,
  onRuleView
}) => {
  const getStatusIcon = (rule: QualityRule) => {
    if (!rule.last_result) return <AlertCircle className="w-5 h-5 text-gray-400" />;

    if (rule.last_result.status === 'passed') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (rule.last_result.status === 'failed') {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    return <AlertCircle className="w-5 h-5 text-yellow-500" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  if (rules.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No rules found</h3>
          <p className="text-gray-600">Create your first quality rule to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {rules.map(rule => {
        const severityColor = getSeverityColor(rule.severity);
        const isSelected = selectedRules.has(rule.id);

        return (
          <Card
            key={rule.id}
            className={`transition-all hover:shadow-lg cursor-pointer ${
              isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
            }`}
            onClick={() => onRuleView?.(rule)}
          >
            <CardContent className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      onRuleSelect(rule.id);
                    }}
                    className="rounded border-gray-300"
                  />
                  {getStatusIcon(rule)}
                </div>
                <Badge className={`bg-${severityColor}-100 text-${severityColor}-700 border-${severityColor}-200`}>
                  {rule.severity}
                </Badge>
              </div>

              {/* Title */}
              <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">
                {rule.name}
              </h3>
              <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                {rule.description || 'No description'}
              </p>

              {/* Metrics */}
              {rule.last_result && (
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Pass Rate</span>
                    <span className="font-medium text-gray-900">
                      {rule.last_result.pass_rate?.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={rule.last_result.pass_rate || 0} className="h-1" />

                  {rule.last_result.issues_found !== undefined && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Issues</span>
                      <span className="font-medium text-red-600">
                        {rule.last_result.issues_found}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Target */}
              <div className="text-xs text-gray-500 mb-3">
                {rule.table_name && (
                  <div className="flex items-center gap-1">
                    <span className="font-mono">{rule.table_name}</span>
                    {rule.column_name && (
                      <>
                        <span>.</span>
                        <span className="font-mono">{rule.column_name}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 border-t border-gray-100 pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRuleExecute?.(rule.id);
                  }}
                >
                  <Play className="w-3 h-3 mr-1" />
                  Run
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRuleEdit(rule);
                  }}
                >
                  <Edit className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

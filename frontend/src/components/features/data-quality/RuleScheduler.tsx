// RuleScheduler.tsx - Production-Grade Rule Scheduling & Orchestration
import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';

// ============================================================================
// TYPES
// ============================================================================

interface Schedule {
  id: string;
  name: string;
  ruleIds: string[];
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  cronExpression?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  successCount: number;
  failureCount: number;
}

interface RuleSchedulerProps {
  availableRules: Array<{ id: string; name: string }>;
  onClose?: () => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const RuleScheduler: React.FC<RuleSchedulerProps> = ({ availableRules, onClose }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [newSchedule, setNewSchedule] = useState<Partial<Schedule>>({
    name: '',
    ruleIds: [],
    frequency: 'daily',
    enabled: true,
  });

  // Load schedules
  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    // TODO: Replace with actual API call
    setSchedules([
      {
        id: '1',
        name: 'Daily Quality Check',
        ruleIds: ['rule1', 'rule2'],
        frequency: 'daily',
        enabled: true,
        lastRun: new Date(Date.now() - 3600000).toISOString(),
        nextRun: new Date(Date.now() + 82800000).toISOString(),
        successCount: 45,
        failureCount: 2,
      },
      {
        id: '2',
        name: 'Hourly Freshness Check',
        ruleIds: ['rule3'],
        frequency: 'hourly',
        enabled: true,
        lastRun: new Date(Date.now() - 1800000).toISOString(),
        nextRun: new Date(Date.now() + 1800000).toISOString(),
        successCount: 120,
        failureCount: 0,
      },
    ]);
  };

  const createSchedule = async () => {
    if (!newSchedule.name || !newSchedule.ruleIds || newSchedule.ruleIds.length === 0) {
      return;
    }

    const schedule: Schedule = {
      id: Date.now().toString(),
      name: newSchedule.name,
      ruleIds: newSchedule.ruleIds,
      frequency: newSchedule.frequency || 'daily',
      cronExpression: newSchedule.cronExpression,
      enabled: newSchedule.enabled ?? true,
      successCount: 0,
      failureCount: 0,
    };

    setSchedules((prev) => [...prev, schedule]);
    setIsCreating(false);
    setNewSchedule({
      name: '',
      ruleIds: [],
      frequency: 'daily',
      enabled: true,
    });
  };

  const toggleSchedule = async (scheduleId: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === scheduleId ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const deleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      hourly: 'Every Hour',
      daily: 'Every Day',
      weekly: 'Every Week',
      monthly: 'Every Month',
      custom: 'Custom Cron',
    };
    return labels[frequency] || frequency;
  };

  const getFrequencyColor = (frequency: string) => {
    const colors: Record<string, string> = {
      hourly: 'bg-purple-100 text-purple-800',
      daily: 'bg-blue-100 text-blue-800',
      weekly: 'bg-green-100 text-green-800',
      monthly: 'bg-amber-100 text-amber-800',
      custom: 'bg-gray-100 text-gray-800',
    };
    return colors[frequency] || 'bg-gray-100 text-gray-800';
  };

  // ============================================================================
  // RENDER: SCHEDULE FORM
  // ============================================================================

  const renderScheduleForm = () => (
    <Card className="border-2 border-blue-200">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsCreating(false);
              setEditingSchedule(null);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Schedule Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={newSchedule.name || ''}
            onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
            placeholder="e.g., Daily Completeness Check"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Select Rules <span className="text-red-500">*</span>
          </label>
          <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
            {availableRules.map((rule) => (
              <label key={rule.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newSchedule.ruleIds?.includes(rule.id)}
                  onChange={(e) => {
                    const ruleIds = newSchedule.ruleIds || [];
                    setNewSchedule({
                      ...newSchedule,
                      ruleIds: e.target.checked
                        ? [...ruleIds, rule.id]
                        : ruleIds.filter((id) => id !== rule.id),
                    });
                  }}
                  className="rounded"
                />
                <span className="text-sm">{rule.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {newSchedule.ruleIds?.length || 0} rule(s) selected
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Frequency</label>
          <select
            value={newSchedule.frequency || 'daily'}
            onChange={(e) =>
              setNewSchedule({
                ...newSchedule,
                frequency: e.target.value as any,
              })
            }
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom (Cron)</option>
          </select>
        </div>

        {newSchedule.frequency === 'custom' && (
          <div>
            <label className="block text-sm font-medium mb-2">Cron Expression</label>
            <input
              type="text"
              value={newSchedule.cronExpression || ''}
              onChange={(e) =>
                setNewSchedule({ ...newSchedule, cronExpression: e.target.value })
              }
              placeholder="0 0 * * *"
              className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
            />
            <p className="text-xs text-gray-600 mt-1">
              Example: "0 0 * * *" runs daily at midnight
            </p>
          </div>
        )}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={newSchedule.enabled ?? true}
            onChange={(e) => setNewSchedule({ ...newSchedule, enabled: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm">Enable schedule immediately</span>
        </label>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setIsCreating(false);
              setEditingSchedule(null);
            }}
          >
            Cancel
          </Button>
          <Button onClick={createSchedule}>
            <Save className="mr-2 h-4 w-4" />
            {editingSchedule ? 'Save Changes' : 'Create Schedule'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Rule Scheduler</h2>
          <p className="text-sm text-gray-600">
            Automate quality checks with scheduled rule execution
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      {/* Create Form */}
      {isCreating && renderScheduleForm()}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{schedules.length}</p>
                <p className="text-xs text-gray-600">Total Schedules</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {schedules.filter((s) => s.enabled).length}
                </p>
                <p className="text-xs text-gray-600">Active</p>
              </div>
              <Play className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {schedules.reduce((sum, s) => sum + s.successCount, 0)}
                </p>
                <p className="text-xs text-gray-600">Successful Runs</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {schedules.reduce((sum, s) => sum + s.failureCount, 0)}
                </p>
                <p className="text-xs text-gray-600">Failed Runs</p>
              </div>
              <X className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedules List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured Schedules</CardTitle>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No schedules configured yet</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreating(true)}
                className="mt-4"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Schedule
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            schedule.enabled ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        />
                        <h4 className="font-medium">{schedule.name}</h4>
                        <Badge className={getFrequencyColor(schedule.frequency)}>
                          {getFrequencyLabel(schedule.frequency)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
                        <div>
                          <p className="font-medium text-gray-900">Rules</p>
                          <p>{schedule.ruleIds.length} selected</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Last Run</p>
                          <p>
                            {schedule.lastRun
                              ? new Date(schedule.lastRun).toLocaleString()
                              : 'Never'}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Next Run</p>
                          <p>
                            {schedule.nextRun
                              ? new Date(schedule.nextRun).toLocaleString()
                              : 'Not scheduled'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-green-600">
                          {schedule.successCount} successes
                        </span>
                        {schedule.failureCount > 0 && (
                          <span className="text-xs text-red-600">
                            {schedule.failureCount} failures
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSchedule(schedule.id)}
                      >
                        {schedule.enabled ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingSchedule(schedule);
                          setNewSchedule(schedule);
                          setIsCreating(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSchedule(schedule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

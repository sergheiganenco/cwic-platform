// src/components/features/data-catalog/BulkActionModal.tsx - Fixed version
import { Button } from '@/components/ui/Button';
import type { BulkAction, BulkActionResult } from '@/types/bulkActions';
import { AlertTriangle, Archive, CheckCircle, Clock, Play, Tag, Trash2, Users, X } from 'lucide-react';
import React, { useState } from 'react';

interface BulkActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: string[];
  onAction: (action: BulkAction) => Promise<void>;
  isProcessing: boolean;
  progress?: {
    total: number;
    completed: number;
    current?: string;
  };
  results?: BulkActionResult;
}

export const BulkActionModal: React.FC<BulkActionModalProps> = ({
  isOpen,
  onClose,
  selectedAssets,
  onAction,
  isProcessing,
  progress,
  results
}) => {
  const [selectedAction, setSelectedAction] = useState<BulkAction['type']>('update_tags');
  const [actionParams, setActionParams] = useState<Record<string, any>>({});
  const [confirmAction, setConfirmAction] = useState(false);

  if (!isOpen) return null;

  const actions: Array<{
    type: BulkAction['type'];
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    destructive?: boolean;
    requiresConfirmation?: boolean;
  }> = [
    {
      type: 'update_tags',
      label: 'Update Tags',
      description: 'Add or remove tags from selected assets',
      icon: Tag
    },
    {
      type: 'update_classification',
      label: 'Update Classification',
      description: 'Change data classification level',
      icon: Users,
      requiresConfirmation: true
    },
    {
      type: 'archive',
      label: 'Archive Assets',
      description: 'Move assets to archived state',
      icon: Archive,
      requiresConfirmation: true
    },
    {
      type: 'delete',
      label: 'Delete Assets',
      description: 'Permanently delete selected assets',
      icon: Trash2,
      destructive: true,
      requiresConfirmation: true
    }
  ];

  const handleSubmit = async () => {
    const action: BulkAction = {
      type: selectedAction,
      assetIds: selectedAssets,
      params: actionParams
    };

    await onAction(action);
  };

  const renderActionForm = () => {
    switch (selectedAction) {
      case 'update_tags':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action Type
              </label>
              <select
                value={actionParams.operation || 'add'}
                onChange={(e) => setActionParams(prev => ({ ...prev, operation: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="add">Add Tags</option>
                <option value="remove">Remove Tags</option>
                <option value="replace">Replace All Tags</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <input
                type="text"
                value={actionParams.tags || ''}
                onChange={(e) => setActionParams(prev => ({ 
                  ...prev, 
                  tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="tag1, tag2, tag3"
              />
              <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
            </div>
          </div>
        );

      case 'update_classification':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Classification Level
            </label>
            <select
              value={actionParams.classification || ''}
              onChange={(e) => setActionParams(prev => ({ ...prev, classification: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select classification</option>
              <option value="public">Public</option>
              <option value="internal">Internal</option>
              <option value="confidential">Confidential</option>
              <option value="restricted">Restricted</option>
            </select>
          </div>
        );

      case 'archive':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Archive Reason
            </label>
            <textarea
              value={actionParams.reason || ''}
              onChange={(e) => setActionParams(prev => ({ ...prev, reason: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Explain why these assets are being archived"
            />
          </div>
        );

      case 'delete':
        return (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">
                    Permanent Deletion Warning
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    This action cannot be undone. All data and metadata associated with these assets will be permanently deleted.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deletion Reason (Required)
              </label>
              <textarea
                value={actionParams.reason || ''}
                onChange={(e) => setActionParams(prev => ({ ...prev, reason: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Explain why these assets are being deleted"
                required
              />
            </div>
            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="confirm-delete"
                checked={confirmAction}
                onChange={(e) => setConfirmAction(e.target.checked)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded mt-0.5"
              />
              <label htmlFor="confirm-delete" className="text-sm text-gray-700">
                I understand this action is permanent and cannot be undone
              </label>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderProgressView = () => {
    if (!isProcessing || !progress) return null;

    const progressPercentage = (progress.completed / progress.total) * 100;

    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <Clock className="h-5 w-5 text-blue-600 animate-spin" />
          <span className="text-sm font-medium text-gray-900">
            Processing {selectedAssets.length} assets...
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm text-gray-600">
          <span>
            {progress.completed} of {progress.total} completed
          </span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>
        
        {progress.current && (
          <p className="text-sm text-gray-500">
            Currently processing: {progress.current}
          </p>
        )}
      </div>
    );
  };

  const renderResultsView = () => {
    if (!results) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-gray-900">
            Bulk action completed
          </span>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total processed:</span>
            <span className="font-medium">{results.total}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-green-600">Successful:</span>
            <span className="font-medium text-green-600">{results.successful}</span>
          </div>
          {results.failed > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-red-600">Failed:</span>
              <span className="font-medium text-red-600">{results.failed}</span>
            </div>
          )}
        </div>
        
        {results.errors && results.errors.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Errors:</h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {results.errors.map((error, index) => (
                <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  {error.assetId}: {error.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const selectedActionConfig = actions.find(a => a.type === selectedAction);
  const canExecute = selectedActionConfig?.destructive ? 
    confirmAction && actionParams.reason?.trim() :
    true;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b">
            <h3 className="text-lg font-medium text-gray-900">
              Bulk Actions ({selectedAssets.length} assets)
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
              disabled={isProcessing}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-6">
            {isProcessing ? (
              renderProgressView()
            ) : results ? (
              renderResultsView()
            ) : (
              <div className="space-y-6">
                {/* Action Selection */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Select Action
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {actions.map((action) => {
                      const IconComponent = action.icon;
                      return (
                        <label
                          key={action.type}
                          className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors ${
                            selectedAction === action.type
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="bulkAction"
                            value={action.type}
                            checked={selectedAction === action.type}
                            onChange={(e) => {
                              setSelectedAction(e.target.value as BulkAction['type']);
                              setActionParams({});
                              setConfirmAction(false);
                            }}
                            className="mt-1"
                          />
                          <IconComponent 
                            className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                              action.destructive ? 'text-red-600' : 'text-gray-600'
                            }`} 
                          />
                          <div className="flex-1">
                            <div className={`text-sm font-medium ${
                              action.destructive ? 'text-red-900' : 'text-gray-900'
                            }`}>
                              {action.label}
                            </div>
                            <div className="text-sm text-gray-500">
                              {action.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Action Configuration */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Configuration
                  </h4>
                  {renderActionForm()}
                </div>

                {/* Actions - Fixed variant types */}
                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!canExecute || isProcessing}
                    variant={selectedActionConfig?.destructive ? 'destructive' : 'default'}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Execute Action
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

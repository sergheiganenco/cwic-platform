import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, File, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@components/ui/Button';
import { toast } from 'sonner';
import { useDataQualityFilters } from '@/contexts/DataQualityContext';

interface DataQualityExportProps {
  onClose?: () => void;
}

type ExportFormat = 'excel' | 'pdf' | 'word';

export const DataQualityExport: React.FC<DataQualityExportProps> = ({ onClose }) => {
  const { filters } = useDataQualityFilters();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel');
  const [exporting, setExporting] = useState(false);
  const [includeOverview, setIncludeOverview] = useState(true);
  const [includeProfiling, setIncludeProfiling] = useState(true);
  const [includeRules, setIncludeRules] = useState(true);
  const [includeViolations, setIncludeViolations] = useState(true);
  const [includeTrends, setIncludeTrends] = useState(true);

  const formatOptions: Array<{ type: ExportFormat; icon: React.ElementType; label: string; description: string; color: string }> = [
    {
      type: 'excel',
      icon: FileSpreadsheet,
      label: 'Excel (.xlsx)',
      description: 'Detailed spreadsheet with multiple tabs',
      color: 'from-green-500 to-emerald-600'
    },
    {
      type: 'pdf',
      icon: FileText,
      label: 'PDF Document',
      description: 'Professional report for sharing',
      color: 'from-red-500 to-rose-600'
    },
    {
      type: 'word',
      icon: File,
      label: 'Word (.docx)',
      description: 'Editable document format',
      color: 'from-blue-500 to-indigo-600'
    }
  ];

  const handleExport = async () => {
    setExporting(true);

    try {
      // Prepare export data
      const exportData = {
        format: selectedFormat,
        filters: {
          dataSource: filters.selectedServer,
          databases: filters.selectedDatabases
        },
        sections: {
          overview: includeOverview,
          profiling: includeProfiling,
          rules: includeRules,
          violations: includeViolations,
          trends: includeTrends
        },
        timestamp: new Date().toISOString()
      };

      // Call export API
      const response = await fetch('/api/quality/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-quality-report-${new Date().toISOString().split('T')[0]}.${
        selectedFormat === 'excel' ? 'xlsx' : selectedFormat === 'pdf' ? 'pdf' : 'docx'
      }`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Export completed successfully!');
      if (onClose) onClose();
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <Download className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Export Data Quality Report</h2>
              <p className="text-sm opacity-90 mt-1">Generate comprehensive report across all tabs</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Export Format Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Format</h3>
            <div className="grid grid-cols-3 gap-4">
              {formatOptions.map((format) => (
                <button
                  key={format.type}
                  onClick={() => setSelectedFormat(format.type)}
                  className={`relative p-4 border-2 rounded-xl transition-all ${
                    selectedFormat === format.type
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {selectedFormat === format.type && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                    </div>
                  )}
                  <div className={`w-12 h-12 mx-auto mb-3 bg-gradient-to-br ${format.color} rounded-xl flex items-center justify-center`}>
                    <format.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">{format.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{format.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sections to Include */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Include Sections</h3>
            <div className="space-y-3">
              {[
                { label: 'Overview', state: includeOverview, setState: setIncludeOverview, description: 'Quality summary and metrics' },
                { label: 'Profiling', state: includeProfiling, setState: setIncludeProfiling, description: 'Data profiling results' },
                { label: 'Rules', state: includeRules, setState: setIncludeRules, description: 'Quality rules and configurations' },
                { label: 'Violations', state: includeViolations, setState: setIncludeViolations, description: 'Issues and violations found' },
                { label: 'Trends', state: includeTrends, setState: setIncludeTrends, description: 'Quality trends over time' }
              ].map((section) => (
                <label
                  key={section.label}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={section.state}
                    onChange={(e) => section.setState(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{section.label}</div>
                    <div className="text-sm text-gray-500">{section.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Active Filters Info */}
          {(filters.selectedServer || (filters.selectedDatabases && filters.selectedDatabases.length > 0)) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Active Filters</h4>
              <div className="text-sm text-blue-700 space-y-1">
                {filters.selectedServer && (
                  <div>Server: <span className="font-medium">{filters.selectedServer}</span></div>
                )}
                {filters.selectedDatabases && filters.selectedDatabases.length > 0 && (
                  <div>Databases: <span className="font-medium">{filters.selectedDatabases.join(', ')}</span></div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
          >
            Cancel
          </button>
          <Button
            onClick={handleExport}
            disabled={exporting || (!includeOverview && !includeProfiling && !includeRules && !includeViolations && !includeTrends)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-all flex items-center gap-2"
          >
            {exporting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Export Report
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

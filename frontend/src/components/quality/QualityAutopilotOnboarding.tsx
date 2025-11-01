import React, { useState } from 'react';
import { CheckCircle, Loader2, Sparkles, Shield, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Alert, AlertDescription, AlertTitle } from '../ui/Alert';

interface AutopilotProgress {
  status: 'idle' | 'profiling' | 'generating' | 'completed' | 'error';
  rulesGenerated?: number;
  nextScan?: string;
  summary?: {
    nullChecks: number;
    formatValidators: number;
    uniquenessRules: number;
    piiRules: number;
    freshnessChecks: number;
  };
  error?: string;
}

interface Props {
  dataSourceId: string;
  dataSourceName: string;
  onComplete?: () => void;
  onSkip?: () => void;
}

export function QualityAutopilotOnboarding({ dataSourceId, dataSourceName, onComplete, onSkip }: Props) {
  const [progress, setProgress] = useState<AutopilotProgress>({ status: 'idle' });

  const handleEnableAutopilot = async () => {
    setProgress({ status: 'profiling' });

    try {
      // Step 1: Enable autopilot
      const response = await fetch('/api/quality/autopilot/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataSourceId })
      });

      const result = await response.json();

      if (result.success) {
        setProgress({
          status: 'completed',
          rulesGenerated: result.data.rulesGenerated,
          nextScan: result.data.nextScan,
          summary: result.data.summary
        });

        // Wait 2 seconds then redirect
        setTimeout(() => {
          if (onComplete) {
            onComplete();
          }
        }, 2000);
      } else {
        setProgress({
          status: 'error',
          error: result.message || 'Failed to enable Quality Autopilot'
        });
      }
    } catch (error: any) {
      console.error('Failed to enable autopilot:', error);
      setProgress({
        status: 'error',
        error: error.message || 'An unexpected error occurred'
      });
    }
  };

  const isProcessing = progress.status === 'profiling' || progress.status === 'generating';

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Quality Autopilot</h1>
        <p className="text-lg text-gray-600">
          Let AI monitor <span className="font-semibold text-gray-900">{dataSourceName}</span> automatically
        </p>
      </div>

      <Card className="shadow-lg">
        <CardContent className="p-8">
          {progress.status === 'idle' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">Analyze your database</h3>
                    <p className="text-gray-600">
                      AI profiles all tables, analyzes data patterns, and identifies quality risks
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">Generate smart rules</h3>
                    <p className="text-gray-600">
                      Creates 100+ quality rules automatically based on your data characteristics
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">Monitor continuously</h3>
                    <p className="text-gray-600">
                      Automatic daily scans with instant alerts when quality issues are detected
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 font-medium mb-2">What you'll get:</p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>✓ NULL value checks for important columns</li>
                  <li>✓ Format validators (emails, phones, dates)</li>
                  <li>✓ Duplicate detection in unique fields</li>
                  <li>✓ PII identification and protection</li>
                  <li>✓ Data freshness monitoring</li>
                  <li>✓ Referential integrity checks</li>
                </ul>
              </div>

              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                onClick={handleEnableAutopilot}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Enable Quality Autopilot
              </Button>

              <p className="text-center text-sm text-gray-500">
                Takes approximately 2-3 minutes to analyze your database
              </p>
            </div>
          )}

          {isProcessing && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
              <h3 className="text-xl font-semibold mb-2">
                {progress.status === 'profiling' ? 'Analyzing your database...' : 'Generating quality rules...'}
              </h3>
              <p className="text-gray-600 mb-6">
                This may take a few minutes. Please don't close this window.
              </p>
              <div className="max-w-md mx-auto bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-full rounded-full animate-pulse w-2/3"></div>
              </div>
            </div>
          )}

          {progress.status === 'completed' && progress.summary && (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>

              <Alert className="bg-green-50 border-green-200 mb-6">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-900">Quality Autopilot Enabled!</AlertTitle>
                <AlertDescription className="text-green-800">
                  Created {progress.rulesGenerated} smart rules for comprehensive monitoring.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-2xl font-bold text-blue-600">{progress.summary.nullChecks}</p>
                  <p className="text-sm text-gray-600">NULL checks</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-2xl font-bold text-purple-600">{progress.summary.formatValidators}</p>
                  <p className="text-sm text-gray-600">Format validators</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-2xl font-bold text-indigo-600">{progress.summary.uniquenessRules}</p>
                  <p className="text-sm text-gray-600">Uniqueness rules</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-2xl font-bold text-red-600">{progress.summary.piiRules}</p>
                  <p className="text-sm text-gray-600">PII protection</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-2xl font-bold text-green-600">{progress.summary.freshnessChecks}</p>
                  <p className="text-sm text-gray-600">Freshness checks</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-2xl font-bold text-gray-900">{progress.rulesGenerated}</p>
                  <p className="text-sm text-gray-600">Total rules</p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Next scan: {progress.nextScan}
              </p>

              <Button
                size="lg"
                onClick={onComplete}
                className="bg-green-600 hover:bg-green-700"
              >
                View Dashboard
              </Button>
            </div>
          )}

          {progress.status === 'error' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <AlertTriangle className="h-10 w-10 text-red-600" />
              </div>

              <Alert className="bg-red-50 border-red-200 mb-6">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-900">Failed to Enable Autopilot</AlertTitle>
                <AlertDescription className="text-red-800">
                  {progress.error}
                </AlertDescription>
              </Alert>

              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setProgress({ status: 'idle' })}
                >
                  Try Again
                </Button>
                {onSkip && (
                  <Button
                    variant="outline"
                    onClick={onSkip}
                  >
                    Configure Manually
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {progress.status === 'idle' && onSkip && (
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 mb-4">Or configure rules manually:</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={onSkip}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline"
            >
              Configure per table →
            </button>
            <button
              onClick={onSkip}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline"
            >
              Create custom rules →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// src/components/ui/ErrorBoundary.tsx
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

interface ErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode;
  error?: string;
  onRetry?: () => void;
  title?: string;
  description?: string;
  actionLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Send error to monitoring service
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.message,
        fatal: false
      });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    // If there's an error prop (for controlled error display)
    if (this.props.error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-600 mb-4" />
          <h2 className="text-lg font-semibold text-red-900 mb-2">
            {this.props.title || 'Something went wrong'}
          </h2>
          <p className="text-red-700 mb-6 max-w-md mx-auto">
            {this.props.description || this.props.error}
          </p>
          {this.props.onRetry && (
            <Button
              onClick={this.props.onRetry}
              className="bg-red-600 hover:bg-red-700"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {this.props.actionLabel || 'Try Again'}
            </Button>
          )}
        </div>
      );
    }

    // If there's a component error
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-600 mb-4" />
          <h2 className="text-lg font-semibold text-red-900 mb-2">
            Oops! Something went wrong
          </h2>
          <p className="text-red-700 mb-6 max-w-md mx-auto">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <Button
            onClick={this.handleRetry}
            className="bg-red-600 hover:bg-red-700"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
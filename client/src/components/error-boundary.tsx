import React, { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  showHomeLink?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error boundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center" data-testid="error-boundary">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            An unexpected error occurred. You can try refreshing the page or going back to the home screen.
          </p>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleReset} data-testid="button-try-again">
              <RefreshCw size={16} className="mr-2" />
              Try Again
            </Button>
            <Button variant="outline" onClick={this.handleReload} data-testid="button-refresh-page">
              Refresh Page
            </Button>
            {this.props.showHomeLink && (
              <Button onClick={this.handleGoHome} data-testid="button-go-home">
                <Home size={16} className="mr-2" />
                Go Home
              </Button>
            )}
          </div>

          {process.env.NODE_ENV === "development" && this.state.error && (
            <details className="mt-6 p-4 bg-muted rounded-lg text-left w-full max-w-2xl">
              <summary className="cursor-pointer text-sm font-medium">Error Details</summary>
              <pre className="mt-2 text-xs overflow-auto whitespace-pre-wrap text-destructive">
                {this.state.error.message}
              </pre>
              {this.state.errorInfo && (
                <pre className="mt-2 text-xs overflow-auto whitespace-pre-wrap text-muted-foreground">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

interface QueryErrorFallbackProps {
  error: Error;
  resetErrorBoundary?: () => void;
  message?: string;
}

export function QueryErrorFallback({ 
  error, 
  resetErrorBoundary, 
  message = "Failed to load data" 
}: QueryErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center" data-testid="query-error">
      <AlertTriangle className="w-8 h-8 text-destructive mb-3" />
      <h3 className="font-medium mb-1">{message}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        {error.message || "An unexpected error occurred"}
      </p>
      {resetErrorBoundary && (
        <Button variant="outline" size="sm" onClick={resetErrorBoundary} data-testid="button-retry">
          <RefreshCw size={14} className="mr-2" />
          Retry
        </Button>
      )}
    </div>
  );
}

interface AsyncBoundaryProps {
  children: ReactNode;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  loadingFallback?: ReactNode;
  errorMessage?: string;
}

export function AsyncBoundary({
  children,
  isLoading,
  error,
  onRetry,
  loadingFallback,
  errorMessage,
}: AsyncBoundaryProps) {
  if (isLoading) {
    return loadingFallback || (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <QueryErrorFallback 
        error={error} 
        resetErrorBoundary={onRetry}
        message={errorMessage}
      />
    );
  }

  return <>{children}</>;
}

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-dark-card border border-dark-border rounded-xl m-4">
          <div className="w-16 h-16 rounded-full bg-signal-sell/10 border border-signal-sell/20 flex items-center justify-center mb-4">
            <AlertTriangle size={28} className="text-signal-sell" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Chart unavailable</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-sm text-center px-4">
            {this.state.error?.message
              ? `Failed to load chart: ${this.state.error.message}`
              : 'An unexpected error occurred while loading the chart.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="bg-accent-primary hover:bg-accent-glow text-white font-medium px-4 py-2 rounded-lg transition-colors duration-150 flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

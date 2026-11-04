import React from 'react';
import { ErrorState } from '@/components/ui/ErrorState';

/** FROZEN. Catches render-time crashes anywhere below and shows a recoverable
 * error screen instead of a white void. */
type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info?: React.ErrorInfo) {
    console.error('App crashed:', error);
    // The screen check's record (App.tsx publishes the handle); absent everywhere else.
    if (typeof window !== 'undefined') {
      // @ts-ignore
      const handle = window.__naapyScreens;
      if (handle && Array.isArray(handle.crashes)) {
        handle.crashes.push({
          message: String(error?.message ?? error).slice(0, 1000),
          componentStack: String(info?.componentStack ?? '').slice(0, 2000),
        });
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorState message={this.state.message} onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

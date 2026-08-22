import React from 'react';

export class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[Vexoryl] Live experience crashed', { error, info });
  }

  render() {
    if (this.state.hasError) {
      return <section className="app-error" role="alert"><h1>Live room unavailable</h1><p>Reconnect and try again.</p><button type="button" onClick={() => window.location.reload()}>Reload room</button></section>;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
import ErrorBoundary from './ErrorBoundary.jsx';

// Every screen fades in on arrival and sits inside its own error boundary.
export default function Page({ children }) {
  return (
    <ErrorBoundary>
      <div className="ts-page-enter">{children}</div>
    </ErrorBoundary>
  );
}

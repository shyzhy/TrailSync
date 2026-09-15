import { Spinner } from './Spinner.jsx';

// Both labels share one grid cell so the button keeps its width; pair with disabled={busy}.
export function BusyLabel({ busy, busyLabel, children }) {
  return (
    <span className="ts-busy-label" data-busy={busy ? '1' : '0'}>
      <span className="ts-busy-off">{children}</span>
      <span className="ts-busy-on">
        <Spinner />
        {busyLabel || children}
      </span>
    </span>
  );
}

import { InboxIcon } from './icons.jsx';

// What a list shows when it is legitimately empty: icon, headline, one sentence, and an action when one helps.
export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  message,
  action,
  className = '',
  boxed = true,
}) {
  return (
    <div
      className={`flex flex-col items-center px-6 py-14 text-center ${boxed ? 'ts-card' : ''} ${className}`}
    >
      <span className="ts-empty-icon" aria-hidden="true">
        <Icon />
      </span>
      <p className="ts-ink mt-4 text-base font-semibold">{title}</p>
      {message && <p className="ts-soft mt-1.5 max-w-sm text-sm leading-relaxed">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

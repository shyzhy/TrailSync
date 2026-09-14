import { FONT_SERIF } from './trailsyncUI.jsx';

const WEEKDAYS = [
  ['S', 'Sunday'],
  ['M', 'Monday'],
  ['T', 'Tuesday'],
  ['W', 'Wednesday'],
  ['T', 'Thursday'],
  ['F', 'Friday'],
  ['S', 'Saturday'],
];

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD' for a year, a 0-based month and a day, with no timezone shift. */
export function isoDate(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

/** Today as 'YYYY-MM-DD' in the browser's own timezone. */
export function todayIso() {
  const d = new Date();
  return isoDate(d.getFullYear(), d.getMonth(), d.getDate());
}

export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

/** Leading blanks for the days before the 1st, then 1..N, then trailing blanks. */
function buildGrid(year, month) {
  const cells = Array(new Date(year, month, 1).getDay()).fill(null);
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function Chevron({ direction }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d={direction === 'prev' ? 'M12.5 5 7.5 10l5 5' : 'M7.5 5l5 5-5 5'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A month of releases, view-only.
 *
 * Shared by the full Release Calendar page and the Dashboard's mini version,
 * so the two can never draw the same month differently. Each day with at
 * least one release carries a numbered badge - the volume at a glance -
 * rather than a bare dot that would say "something" without saying how much.
 *
 * Nothing here schedules anything. Days are buttons only so a date can be
 * opened; scheduling stays on the Request Review page.
 *
 * @param month      0-based, like Date.
 * @param counts     { 'YYYY-MM-DD': number } for the visible month.
 * @param selected   'YYYY-MM-DD' or null.
 * @param onSelect   (iso) => void.
 * @param onMonthChange  (delta) => void. Omit to hide month navigation.
 * @param size       'full' | 'mini'.
 */
export default function ReleaseCalendar({
  year,
  month,
  counts = {},
  selected = null,
  onSelect,
  onMonthChange,
  onToday,
  loading = false,
  size = 'full',
}) {
  const today = todayIso();
  const cells = buildGrid(year, month);
  const mini = size === 'mini';

  return (
    <div className={`ts-relcal ${mini ? 'ts-relcal-mini' : ''}`} aria-busy={loading || undefined}>
      <div className="flex items-center justify-between gap-2">
        <p className={`ts-ink font-semibold ${mini ? 'text-sm' : 'text-lg'}`} style={FONT_SERIF} aria-live="polite">
          {monthLabel(year, month)}
        </p>
        {onMonthChange && (
          <div className="flex items-center gap-1.5">
            {onToday && (
              <button type="button" onClick={onToday} className="ts-btn-glass mr-1 px-3.5 py-2 text-sm font-medium">
                Today
              </button>
            )}
            <button type="button" onClick={() => onMonthChange(-1)} className="ts-relcal-nav" aria-label="Previous month">
              <Chevron direction="prev" />
            </button>
            <button type="button" onClick={() => onMonthChange(1)} className="ts-relcal-nav" aria-label="Next month">
              <Chevron direction="next" />
            </button>
          </div>
        )}
      </div>

      <div className={`ts-relcal-grid ${mini ? 'mt-3' : 'mt-5'}`} role="group" aria-label={`Releases in ${monthLabel(year, month)}`}>
        {/* Visual only: every day button's own name already says its weekday. */}
        {WEEKDAYS.map(([short, long]) => (
          <span key={long} className="ts-relcal-weekday" aria-hidden="true" title={long}>
            {short}
          </span>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <span key={i} aria-hidden="true" />;
          const iso = isoDate(year, month, day);
          const count = counts[iso] || 0;
          const isToday = iso === today;
          const isSelected = iso === selected;
          const label = new Date(year, month, day).toLocaleDateString('en-PH', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          });
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect?.(iso)}
              aria-pressed={isSelected}
              aria-label={`${label}${isToday ? ', today' : ''}: ${
                count === 0 ? 'nothing scheduled' : `${count} release${count === 1 ? '' : 's'}`
              }`}
              className={`ts-relcal-day ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${
                count ? 'has-releases' : ''
              }`}
            >
              <span className="ts-relcal-num">{day}</span>
              {count > 0 && (
                <span className="ts-relcal-count" aria-hidden="true">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

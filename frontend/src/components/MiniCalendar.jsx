import { FONT_SERIF } from './trailsyncUI.jsx';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toISODate(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

// One leading `null` per empty cell before the 1st, then 1..daysInMonth,
// then trailing `null`s to round out the final week — a plain data grid,
// no js library needed for a view this simple.
function buildMonthGrid(year, month) {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(startWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * At-a-glance current-month view — not a scheduler. `highlightDates` is an
 * optional array of 'YYYY-MM-DD' strings (e.g. upcoming release-slot dates);
 * days with no data just render with no dot, so this works fine even before
 * that endpoint exists.
 */
export default function MiniCalendar({ highlightDates = [] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();

  const cells = buildMonthGrid(year, month);
  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const highlightSet = new Set(highlightDates);

  return (
    <div className="ts-card p-5">
      <p className="ts-ink text-sm font-semibold" style={FONT_SERIF}>
        {monthLabel}
      </p>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i} className="ts-soft text-[11px] font-medium uppercase">
            {label}
          </span>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const isToday = day === todayDate;
          const hasEvent = highlightSet.has(toISODate(year, month, day));
          return (
            <div key={i} className="flex flex-col items-center">
              <span className={`ts-cal-day ${isToday ? 'ts-cal-day-today' : 'ts-ink'}`}>{day}</span>
              <span className={`ts-cal-dot ${hasEvent ? 'ts-cal-dot-active' : ''}`} aria-hidden="true" />
            </div>
          );
        })}
      </div>

      {/* Without this, the dots are a puzzle to anyone who hasn't been told. */}
      <p className="ts-soft mt-3 flex items-start gap-2 text-xs">
        <span className="ts-cal-dot ts-cal-dot-active mt-1.5 shrink-0" aria-hidden="true" style={{ margin: '6px 0 0' }} />
        A dot marks a day you&rsquo;re scheduled to pick up a document at Window 6.
      </p>

      <div className="ts-hairline mt-4 h-px" />
      <p className="ts-ink mt-3 text-sm font-semibold" style={FONT_SERIF}>
        Today — {todayLabel}
      </p>
    </div>
  );
}

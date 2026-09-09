import { ChevronIcon, FONT_SERIF } from './trailsyncUI.jsx';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toISODate(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function buildMonthGrid(year, month) {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(startWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Interactive month calendar for Release Slots — unlike the read-only
 * MiniCalendar on the student dashboard, this one navigates months and lets
 * staff click a date. `dotDates`/`selectedDate` are ISO strings; the parent
 * owns all state and refetches on change (see ReleaseSlotsPage).
 */
export default function ReleaseSlotCalendar({ year, month, onMonthChange, selectedDate, onSelectDate, dotDates = [] }) {
  const cells = buildMonthGrid(year, month);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dotSet = new Set(dotDates);

  const today = new Date();
  const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  const goPrev = () => (month === 0 ? onMonthChange(year - 1, 11) : onMonthChange(year, month - 1));
  const goNext = () => (month === 11 ? onMonthChange(year + 1, 0) : onMonthChange(year, month + 1));

  return (
    <div className="ts-card p-5">
      <div className="flex items-center justify-between">
        <p className="ts-ink text-sm font-semibold" style={FONT_SERIF}>
          {monthLabel}
        </p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={goPrev} aria-label="Previous month" className="ts-cal-nav-btn">
            <span className="inline-block rotate-90">
              <ChevronIcon />
            </span>
          </button>
          <button type="button" onClick={goNext} aria-label="Next month" className="ts-cal-nav-btn">
            <span className="inline-block -rotate-90">
              <ChevronIcon />
            </span>
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i} className="ts-soft text-[11px] font-medium uppercase">
            {label}
          </span>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const iso = toISODate(year, month, day);
          const isToday = iso === todayISO;
          const isSelected = iso === selectedDate;
          const hasEvent = dotSet.has(iso);
          return (
            <div key={i} className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => onSelectDate(iso)}
                aria-pressed={isSelected}
                className={`ts-cal-day ts-cal-day-btn ${
                  isSelected ? 'ts-cal-day-selected' : isToday ? 'ts-cal-day-today' : 'ts-ink'
                }`}
              >
                {day}
              </button>
              <span className={`ts-cal-dot ${hasEvent ? 'ts-cal-dot-active' : ''}`} aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

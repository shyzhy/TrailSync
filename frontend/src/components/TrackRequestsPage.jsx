import { useCallback, useEffect, useState } from 'react';
import {
  FONT_SERIF,
  InboxIcon,
  SearchIcon,
} from './trailsyncUI.jsx';
import StudentShell from './StudentShell.jsx';
import TicketCard from './TicketCard.jsx';
import { LIFECYCLE, STATUS, studentStatusLabel } from '../lib/requestStatus.js';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';

const LOGIN_PATH = '/';

// Built from the shared lifecycle so a new stage cannot go missing here.
// "All" is a UI-only value the backend maps to "no status filter" (see
// api/form-requests/ ?status=).
const FILTER_TABS = [
  { value: 'All', label: 'All' },
  ...LIFECYCLE.map((value) => ({ value, label: studentStatusLabel(value) })),
  { value: STATUS.REJECTED, label: studentStatusLabel(STATUS.REJECTED) },
];

function TicketSkeleton() {
  return (
    <div className="ts-card flex overflow-hidden">
      <div className="ts-skeleton m-3 h-20 w-24 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2 p-4">
        <div className="ts-skeleton h-4 w-48" />
        <div className="ts-skeleton h-3 w-32" />
        <div className="ts-skeleton mt-3 h-2 w-full" />
      </div>
    </div>
  );
}

export default function TrackRequestsPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());

  const [activeFilter, setActiveFilter] = useState('All');
  // ?search= arrives from a notification, the dashboard's recent list, or the
  // "See my request" button after submitting - so those links open straight
  // onto the request they're about instead of a list to hunt through.
  const [initialSearch] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch); // debounced value actually sent to the server
  const [page, setPage] = useState(1);

  const [results, setResults] = useState([]);
  const [pageInfo, setPageInfo] = useState({ count: 0, start: 0, end: 0, next: null, previous: null });
  const [expandedId, setExpandedId] = useState(null);

  // Debounce search input -> server query, and reset to page 1 whenever the
  // filter or the (debounced) search term changes, so a new search/filter
  // never lands on a now-nonexistent later page.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [activeFilter, search]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const params = new URLSearchParams();
      if (activeFilter !== 'All') params.set('status', activeFilter);
      if (search) params.set('search', search);
      params.set('page', String(page));

      const [meRes, listRes] = await Promise.all([authFetch('/api/me/'), authFetch(`/api/form-requests/?${params}`)]);

      if ([meRes, listRes].some((r) => r.status === 401)) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      if (!meRes.ok || !listRes.ok) throw new Error('One or more requests failed.');

      const [meData, listData] = await Promise.all([meRes.json(), listRes.json()]);
      setMe(meData);
      setResults(listData.results || []);
      // Arrived via a link to one specific request: open it, rather than
      // making a first-time user work out that the card can be expanded.
      if (initialSearch && search === initialSearch && listData.results?.length === 1) {
        setExpandedId(listData.results[0].id);
      }
      setPageInfo({
        count: listData.count ?? 0,
        start: listData.start ?? 0,
        end: listData.end ?? 0,
        next: listData.next,
        previous: listData.previous,
      });
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [activeFilter, search, page, initialSearch]);

  const clearFilters = () => {
    setActiveFilter('All');
    setSearchInput('');
    setSearch('');
  };

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = LOGIN_PATH;
      return;
    }
    load();
  }, [load]);

  const handleLogout = () => {
    clearSession();
    window.location.href = LOGIN_PATH;
  };

  return (
    <StudentShell active="track" me={me} onLogout={handleLogout} onMeChange={setMe}>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-8 pt-4 sm:pb-10 sm:pt-6 lg:pt-3 lg:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              Track my requests
            </h1>
            <p className="ts-soft mt-1.5 text-base">
              See how far along each request is. Tap one to see its details and download your forms.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            {/* "Tracking number" is what the printed form and claim stub call
                it; "request code" was the database's name for the same thing. */}
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tracking number, e.g. W6-002"
              aria-label="Search by tracking number"
              className="ts-input w-full py-2.5 pl-9 pr-3 text-sm"
            />
            <span className="ts-soft pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <SearchIcon />
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveFilter(tab.value)}
              aria-pressed={activeFilter === tab.value}
              className={`ts-filter-tab ${activeFilter === tab.value ? 'ts-filter-tab-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {status === 'error' && (
          <div className="ts-banner ts-banner-error mt-6 flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>We couldn&rsquo;t load your requests. Please check your internet connection.</span>
            <button type="button" onClick={load} className="ts-link shrink-0 font-medium">
              Try again
            </button>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {status === 'loading' && (
            <>
              <TicketSkeleton />
              <TicketSkeleton />
              <TicketSkeleton />
            </>
          )}

          {status === 'ready' && results.length === 0 && (
            <div className="ts-card flex flex-col items-center px-6 py-14 text-center">
              <InboxIcon />
              {/* Two different situations that used to share one message: a
                  filter hiding everything needs "show all", not "request". */}
              {activeFilter !== 'All' || search ? (
                <>
                  <p className="ts-ink mt-4 text-base font-semibold">
                    {search ? `No requests match “${search}”` : 'No requests here yet'}
                  </p>
                  <p className="ts-soft mt-1.5 max-w-sm text-sm">
                    {search
                      ? 'Check the tracking number on your form or claim stub, or show all your requests instead.'
                      : 'None of your requests are at this step right now.'}
                  </p>
                  <button type="button" onClick={clearFilters} className="ts-btn-primary mt-5 px-6 py-2.5 text-sm font-medium">
                    Show all my requests
                  </button>
                </>
              ) : (
                <>
                  <p className="ts-ink mt-4 text-base font-semibold">No requests yet</p>
                  <p className="ts-soft mt-1.5 max-w-sm text-sm">
                    You haven&rsquo;t requested any documents yet. Tap below to request your first one.
                  </p>
                  <a href="/request-form" className="ts-btn-primary mt-5 px-6 py-2.5 text-sm font-medium">
                    Request my first document
                  </a>
                </>
              )}
            </div>
          )}

          {status === 'ready' &&
            results.map((r) => (
              <TicketCard
                key={r.id}
                request={r}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
              />
            ))}
        </div>

        {status === 'ready' && results.length > 0 && (
          <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="ts-soft text-sm">
              {pageInfo.count === 1
                ? 'Showing 1 request'
                : `Showing ${pageInfo.start}–${pageInfo.end} of ${pageInfo.count} requests`}
            </p>
            {/* Two dead buttons on a single page read as broken, not as "that's everything". */}
            {(pageInfo.previous || pageInfo.next) && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!pageInfo.previous}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="ts-btn-glass px-4 py-2 text-sm font-medium"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!pageInfo.next}
                onClick={() => setPage((p) => p + 1)}
                className="ts-btn-glass px-4 py-2 text-sm font-medium"
              >
                Next
              </button>
            </div>
            )}
          </div>
        )}
      </main>
    </StudentShell>
  );
}

import { useCallback, useEffect, useState } from 'react';
import StudentShell from '../../components/layout/StudentShell.jsx';
import {
  EmptyState,
  ErrorState,
  SearchIcon,
  SkeletonGroup,
  TicketIcon,
  TicketSkeleton,
} from '../../components/ui/index.js';
import TicketCard from '../../components/student/TicketCard.jsx';
import { FONT_SERIF } from '../../styles/fonts.js';
import { errorFromResponse, toApiError } from '../../lib/api.js';
import {
  authFetch,
  clearSession,
  getAccessToken,
  getStoredUser,
  STUDENT_LOGIN_PATH,
} from '../../lib/auth.js';
import { useLatestOnly } from '../../lib/latestOnly.js';
import { LIFECYCLE, STATUS, studentStatusLabel } from '../../lib/requestStatus.js';

const LOGIN_PATH = STUDENT_LOGIN_PATH;

// Built from the shared lifecycle; "All" is a UI-only value meaning no status filter.
const FILTER_TABS = [
  { value: 'All', label: 'All' },
  ...LIFECYCLE.map((value) => ({ value, label: studentStatusLabel(value) })),
  { value: STATUS.REJECTED, label: studentStatusLabel(STATUS.REJECTED) },
  { value: STATUS.CANCELLED, label: studentStatusLabel(STATUS.CANCELLED) },
];

export default function TrackRequestsPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());

  const [activeFilter, setActiveFilter] = useState('All');
  // ?search= from a notification or the dashboard opens straight onto that request.
  const [initialSearch] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch); // The debounced value actually sent to the server.
  const [page, setPage] = useState(1);

  const [results, setResults] = useState([]);
  const [pageInfo, setPageInfo] = useState({ count: 0, start: 0, end: 0, next: null, previous: null });
  const [expandedId, setExpandedId] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // Debounce the search box, and reset to page 1 whenever the filter or search changes.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [activeFilter, search]);

  const startLoad = useLatestOnly();
  const load = useCallback(async () => {
    const isCurrent = startLoad();
    setStatus('loading');
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (activeFilter !== 'All') params.set('status', activeFilter);
      if (search) params.set('search', search);
      params.set('page', String(page));

      const [meRes, listRes] = await Promise.all([authFetch('/api/me/'), authFetch(`/api/form-requests/?${params}`)]);
      const failed = [meRes, listRes].find((r) => !r.ok);
      if (failed) throw await errorFromResponse(failed);

      const [meData, listData] = await Promise.all([meRes.json(), listRes.json()]);
      if (!isCurrent()) return;
      setMe(meData);
      setResults(listData.results || []);
      // Arrived via a link to one request: open it.
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
    } catch (error) {
      if (!isCurrent()) return;
      setLoadError(toApiError(error));
      setStatus('error');
    }
  }, [activeFilter, search, page, initialSearch, startLoad]);

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
    <StudentShell active="track" title="Track my requests" me={me} onLogout={handleLogout} onMeChange={setMe}>
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
            {/* "Tracking number" is what the printed form and claim stub call the request code. */}
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

        {/* Swipes sideways on a phone, where wrapped chips would push the requests off screen. */}
        <div className="ts-tab-scroller mt-6" role="group" aria-label="Filter by stage">
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
          <ErrorState className="mt-6" error={loadError} title="We couldn&rsquo;t load your requests" onRetry={load} />
        )}

        <div className="mt-6 space-y-4">
          {status === 'loading' && (
            <SkeletonGroup label="Loading your requests" className="space-y-4">
              <TicketSkeleton />
              <TicketSkeleton />
              <TicketSkeleton />
            </SkeletonGroup>
          )}

          {status === 'ready' && results.length === 0 && (
            // A filter hiding everything needs "show all", not "request".
            activeFilter !== 'All' || search ? (
              <EmptyState
                icon={SearchIcon}
                title="No requests found"
                message={
                  search
                    ? 'Check the tracking number on your form or claim stub, or show all your requests instead.'
                    : 'None of your requests are at this step right now. Try another step, or show them all.'
                }
                action={
                  <button type="button" onClick={clearFilters} className="ts-btn-primary px-6 py-2.5 text-sm font-medium">
                    Show all my requests
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={TicketIcon}
                title="You haven&rsquo;t requested anything yet"
                message="Your first request takes a few taps, and you can follow it right here afterwards."
                action={
                  <a href="/request-form" className="ts-btn-primary px-6 py-2.5 text-sm font-medium">
                    Request my first document
                  </a>
                }
              />
            )
          )}

          {status === 'ready' &&
            results.map((r) => (
              <TicketCard
                key={r.id}
                request={r}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
                onChanged={(updated) =>
                  updated ? setResults((list) => list.map((x) => (x.id === updated.id ? updated : x))) : load()
                }
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
            {/* Two dead buttons on a single page read as broken. */}
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

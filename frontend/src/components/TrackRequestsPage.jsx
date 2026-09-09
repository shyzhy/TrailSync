import { useCallback, useEffect, useState } from 'react';
import {
  APP_CSS,
  AppMobileHeader,
  AppSidebar,
  FONT_SANS,
  FONT_SERIF,
  InboxIcon,
  SearchIcon,
} from './trailsyncUI.jsx';
import TicketCard from './TicketCard.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';

const LOGIN_PATH = '/';

// Matches FormRequest.RequestStatus exactly — "All" is a UI-only value the
// backend maps to "no status filter" (see api/form-requests/ ?status=).
const FILTER_TABS = [
  { value: 'All', label: 'All' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Verified', label: 'Verified' },
  { value: 'Ready', label: 'Ready for Release' },
  { value: 'Released', label: 'Released' },
  { value: 'Rejected', label: 'Rejected' },
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
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState(''); // debounced value actually sent to the server
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
  }, [activeFilter, search, page]);

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
    <div className="ts-app-shell lg:flex" style={FONT_SANS}>
      <style>{APP_CSS}</style>
      <AppSidebar active="track" onLogout={handleLogout} me={me} />
      <AppMobileHeader onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 sm:py-10 lg:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              Track your requests
            </h1>
            <p className="ts-soft mt-1.5 text-sm">Your ticket is called at Window 6 once it's ready for release.</p>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search request code..."
              aria-label="Search request code"
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
            <span>Something went wrong loading your requests.</span>
            <button type="button" onClick={load} className="ts-link shrink-0 font-medium">
              Retry
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
              <p className="ts-ink mt-4 text-sm font-semibold">No requests found</p>
              <p className="ts-soft mt-1 text-sm">
                {activeFilter !== 'All' || search
                  ? "Try a different filter or search term, or submit a new request."
                  : "You haven't submitted any requests yet."}
              </p>
              <a href="/request-form" className="ts-btn-primary mt-5 px-5 py-2.5 text-sm font-medium">
                Request a form
              </a>
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
              Showing {pageInfo.start}–{pageInfo.end} of {pageInfo.count} requests
            </p>
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
          </div>
        )}
      </main>
    </div>
  );
}

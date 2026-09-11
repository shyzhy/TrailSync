import { useCallback, useEffect, useState } from 'react';
import {
  APP_CSS,
  ChevronIcon,
  FONT_SANS,
  FONT_SERIF,
  RegistrarMobileHeader,
  RegistrarSidebar,
} from './trailsyncUI.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';
import { STATUS, STATUS_FILTER_OPTIONS, statusLabel, statusPillClass } from '../lib/requestStatus.js';

const LOGIN_PATH = '/';

/** Where Review goes. Real navigation now rather than inline selection — a
 *  review is a page of its own, so it can be linked, reloaded and shared. */
const reviewPath = (id) => `/registrar/queue/${id}`;

function RowSkeleton() {
  return (
    <div className="grid grid-cols-12 items-center gap-3 px-5 py-4">
      <div className="ts-skeleton col-span-2 h-4" />
      <div className="ts-skeleton col-span-4 h-4" />
      <div className="ts-skeleton col-span-2 h-4" />
      <div className="ts-skeleton col-span-3 h-5 rounded-full" />
      <div className="ts-skeleton col-span-1 h-7 rounded-md" />
    </div>
  );
}

export default function ProcessingQueuePage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());

  const [statusFilter, setStatusFilter] = useState(STATUS.SUBMITTED);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [results, setResults] = useState([]);
  const [pageInfo, setPageInfo] = useState({ count: 0, start: 0, end: 0, next: null, previous: null });

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateFrom, dateTo, search]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (search) params.set('search', search);
      params.set('page', String(page));

      const [meRes, queueRes] = await Promise.all([
        authFetch('/api/me/'),
        authFetch(`/api/registrar/queue/?${params}`),
      ]);

      if ([meRes, queueRes].some((r) => r.status === 401)) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      if ([meRes, queueRes].some((r) => r.status === 403)) throw new Error('forbidden');
      if (!meRes.ok || !queueRes.ok) throw new Error('One or more requests failed.');

      const [meData, queueData] = await Promise.all([meRes.json(), queueRes.json()]);
      setMe(meData);
      setResults(queueData.results || []);
      setPageInfo({
        count: queueData.count ?? 0,
        start: queueData.start ?? 0,
        end: queueData.end ?? 0,
        next: queueData.next,
        previous: queueData.previous,
      });
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [statusFilter, dateFrom, dateTo, search, page]);

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
      <RegistrarSidebar active="queue" onLogout={handleLogout} me={me} />
      <RegistrarMobileHeader onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:py-10">
        <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
          Processing Queue — Window 6
        </h1>
        <p className="ts-soft mt-1.5 text-sm">
          Review pending submissions, log Cashier payments, and release documents.
        </p>

        {/* Filter row */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="ts-input ts-select w-full py-2.5 pl-3.5 pr-9 text-sm sm:w-56"
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="ts-soft pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <ChevronIcon />
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Date from"
              className="ts-input px-3 py-2.5 text-sm"
            />
            <span className="ts-soft text-sm">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Date to"
              className="ts-input px-3 py-2.5 text-sm"
            />
          </div>

          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search student name or request code..."
            className="ts-input min-w-0 flex-1 px-3.5 py-2.5 text-sm sm:min-w-[220px]"
          />
        </div>

        {status === 'error' && (
          <div className="ts-banner ts-banner-error mt-6 flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>Something went wrong loading the queue.</span>
            <button type="button" onClick={load} className="ts-link shrink-0 font-medium">
              Retry
            </button>
          </div>
        )}

        <div className="ts-card mt-6 overflow-hidden">
          <div
            className="hidden grid-cols-12 gap-3 px-5 py-3 text-xs font-semibold uppercase tracking-wide sm:grid"
            style={{ color: '#5B6474' }}
          >
            <span className="col-span-2">Req Code</span>
            <span className="col-span-4">Student</span>
            <span className="col-span-2">Document Type</span>
            <span className="col-span-3">Status</span>
            <span className="col-span-1">Action</span>
          </div>

          {status === 'loading' && (
            <>
              <div className="ts-row-divider" />
              <RowSkeleton />
              <div className="ts-row-divider" />
              <RowSkeleton />
              <div className="ts-row-divider" />
              <RowSkeleton />
            </>
          )}

          {status === 'ready' && results.length === 0 && (
            <div className="px-6 py-14 text-center">
              <p className="ts-ink text-sm font-semibold">No requests match these filters</p>
              <p className="ts-soft mt-1 text-sm">Try a different status, date range, or search term.</p>
            </div>
          )}

          {status === 'ready' &&
            results.map((r) => (
              <a
                key={r.id}
                href={reviewPath(r.id)}
                className="ts-row-hover ts-row-divider grid w-full grid-cols-1 gap-2 px-5 py-4 text-left sm:grid-cols-12 sm:items-center sm:gap-3"
              >
                <span className="ts-ink text-sm font-semibold sm:col-span-2">{r.request_code}</span>

                <div className="sm:col-span-4">
                  <p className="ts-ink truncate text-sm font-medium">
                    {r.student_first_name} {r.student_last_name}
                  </p>
                  <p className="ts-soft mt-0.5 truncate text-xs">
                    ID: {r.student_school_id_number} · {r.student_course}
                    {r.student_year_level ? `-${r.student_year_level}` : ''}
                  </p>
                </div>

                <span className="ts-soft truncate text-sm sm:col-span-2">{r.transaction_type}</span>

                {/* The lifecycle stage is the useful column now that the queue
                    spans every stage. Incomplete requirements ride alongside it
                    rather than replacing it — a request can be Ready for Pickup
                    and still have had a missing upload earlier. */}
                <span className="flex flex-wrap items-center gap-1.5 sm:col-span-3">
                  <span className={`ts-pill ${statusPillClass(r.request_status)}`}>
                    {statusLabel(r.request_status)}
                  </span>
                  {r.requirements_status === 'Incomplete' && (
                    <span className="ts-pill ts-pill-danger">Incomplete</span>
                  )}
                  {r.is_rush && <span className="ts-pill ts-pill-processing">Rush</span>}
                </span>

                <span className="sm:col-span-1">
                  <span className="ts-btn-primary inline-flex px-4 py-1.5 text-xs font-medium">Review</span>
                </span>
              </a>
            ))}
        </div>

        {status === 'ready' && results.length > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
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

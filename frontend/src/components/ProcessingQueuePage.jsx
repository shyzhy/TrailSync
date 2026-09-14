import { useCallback, useEffect, useState } from 'react';
import {
  APP_CSS,
  ChevronIcon,
  DocumentIcon,
  EmptyState,
  ErrorState,
  FONT_SANS,
  FONT_SERIF,
  InboxIcon,
  RegistrarMobileHeader,
  RegistrarSidebar,
  SkeletonGroup,
  TableRowSkeleton,
} from './trailsyncUI.jsx';
import { STAFF_LOGIN_PATH, authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';
import { errorFromResponse, toApiError } from '../lib/api.js';
import {
  STAFF_NEXT_STEP,
  STATUS,
  STATUS_FILTER_OPTIONS,
  statusLabel,
  statusPillClass,
} from '../lib/requestStatus.js';

const LOGIN_PATH = STAFF_LOGIN_PATH;

/** Where Review goes. Real navigation now rather than inline selection — a
 *  review is a page of its own, so it can be linked, reloaded and shared. */
const reviewPath = (id) => `/registrar/queue/${id}`;

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
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateFrom, dateTo, search]);

  const load = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
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

      const failed = [meRes, queueRes].find((r) => !r.ok);
      if (failed) throw await errorFromResponse(failed);

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
    } catch (error) {
      setLoadError(toApiError(error));
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
      <RegistrarMobileHeader active="queue" onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:py-10">
        <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
          Processing Queue
        </h1>
        <p className="ts-soft mt-1.5 text-base">
          Every request at Window 6. Pick a stage below to see what is waiting there, then click Review.
        </p>

        {/* Filters. Labelled rather than placeholder-only: a placeholder
            disappears the moment someone types, taking the only explanation
            of the field with it. */}
        <div className="ts-card mt-6 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div>
              <label htmlFor="stageFilter" className="ts-ink mb-1.5 block text-sm font-medium">
                Show requests that are
              </label>
              <div className="relative">
                <select
                  id="stageFilter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="ts-input ts-select w-full py-2.5 pl-3.5 pr-9 text-sm lg:w-60"
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
            </div>

            <div>
              <label htmlFor="queueDateFrom" className="ts-ink mb-1.5 block text-sm font-medium">
                Requested between
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="queueDateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="ts-input px-3 py-2.5 text-sm"
                />
                <span className="ts-soft text-sm">and</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label="Requested up to"
                  className="ts-input px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="lg:flex-1">
              <label htmlFor="queueSearch" className="ts-ink mb-1.5 block text-sm font-medium">
                Search
              </label>
              <input
                id="queueSearch"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Student name or request code"
                className="ts-input w-full px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* What this stage means, so the filter teaches the process. */}
          {STAFF_NEXT_STEP[statusFilter] && (
            <p className="ts-soft mt-3 text-sm">{STAFF_NEXT_STEP[statusFilter]}</p>
          )}
        </div>

        {/* Replaces the table rather than sitting above an empty one, which
            would read as "nothing waiting". */}
        {status === 'error' && (
          <ErrorState className="mt-6" error={loadError} title="We couldn&rsquo;t load the requests" onRetry={load} />
        )}

        {status !== 'error' && (
        <div className="ts-card mt-6 overflow-hidden">
          <div
            className="hidden grid-cols-12 gap-3 px-5 py-3 text-xs font-semibold uppercase tracking-wide sm:grid"
            style={{ color: '#5B6474' }}
          >
            <span className="col-span-2">Code</span>
            <span className="col-span-4">Student</span>
            <span className="col-span-2">Document</span>
            <span className="col-span-3">Stage</span>
            <span className="col-span-1" />
          </div>

          {status === 'loading' && (
            <SkeletonGroup label="Loading requests">
              {/* Column spans match the real table's, so rows do not jump
                  sideways when the data arrives. */}
              <div className="ts-row-divider" />
              <TableRowSkeleton widths={[2, 4, 2, 3, 1]} />
              <div className="ts-row-divider" />
              <TableRowSkeleton widths={[2, 4, 2, 3, 1]} />
              <div className="ts-row-divider" />
              <TableRowSkeleton widths={[2, 4, 2, 3, 1]} />
            </SkeletonGroup>
          )}

          {status === 'ready' && results.length === 0 && (
            statusFilter === STATUS.SUBMITTED && !search && !dateFrom && !dateTo ? (
              <EmptyState
                boxed={false}
                icon={InboxIcon}
                title="No pending reviews right now"
                message="New submissions will appear here as students send them."
              />
            ) : (
              <EmptyState
                boxed={false}
                icon={DocumentIcon}
                title="Nothing at this stage"
                message="No requests are here right now. Try another stage, a wider date range, or a different search."
              />
            )
          )}

          {status === 'ready' &&
            results.map((r) => (
              <a
                key={r.id}
                href={reviewPath(r.id)}
                className="ts-row-hover ts-row-divider grid w-full grid-cols-1 gap-2 px-5 py-5 text-left sm:grid-cols-12 sm:items-center sm:gap-3"
              >
                <span className="ts-ink text-sm font-semibold sm:col-span-2">{r.request_code}</span>

                <div className="sm:col-span-4">
                  <p className="ts-ink truncate text-base font-medium">
                    {r.student_first_name} {r.student_last_name}
                  </p>
                  {/* Wraps rather than truncating: the year level was being
                      cut off mid-word on a laptop screen. */}
                  <p className="ts-soft mt-0.5 text-sm">
                    {r.student_school_id_number} · {r.student_course}
                    {r.student_year_level ? ` · ${r.student_year_level}` : ''}
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
                    <span className="ts-pill ts-pill-danger">Missing requirement</span>
                  )}
                  {r.is_rush && <span className="ts-pill ts-pill-processing">Rush</span>}
                  {r.duplicate_flag && <span className="ts-pill ts-pill-danger">Possible duplicate</span>}
                </span>

                <span className="sm:col-span-1">
                  <span className="ts-btn-primary inline-flex px-5 py-2.5 text-sm font-medium">Review</span>
                </span>
              </a>
            ))}
        </div>
        )}

        {status === 'ready' && results.length > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="ts-soft text-sm">
              {pageInfo.count === 1
                ? 'Showing 1 request'
                : `Showing ${pageInfo.start}–${pageInfo.end} of ${pageInfo.count} requests`}
            </p>
            {(pageInfo.previous || pageInfo.next) && (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!pageInfo.previous}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="ts-btn-glass px-5 py-2.5 text-sm font-medium"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!pageInfo.next}
                  onClick={() => setPage((p) => p + 1)}
                  className="ts-btn-glass px-5 py-2.5 text-sm font-medium"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

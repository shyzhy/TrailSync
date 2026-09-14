import { useCallback, useEffect, useState } from 'react';
import {
  APP_CSS,
  ArchiveIcon,
  DownloadIcon,
  FONT_SANS,
  FONT_SERIF,
  RegistrarMobileHeader,
  RegistrarSidebar,
  SearchIcon,
  Spinner,
} from './trailsyncUI.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';

const LOGIN_PATH = '/';

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function formatAmount(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return Number.isNaN(n) ? '—' : PESO.format(n);
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return value;
  }
}

/** Local YYYY-MM-DD — toISOString() would shift a Manila date back a day. */
function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The current month, which is what the office is usually looking for. */
function thisMonth() {
  const now = new Date();
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
}

const COLUMNS = [
  'Date Released',
  'Request Code',
  'Student Name',
  'Course',
  'Document Type',
  'Amount',
  'O.R. Number',
  'Claimed By',
];

export default function ReleasedDocumentsPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());

  const [{ from: defaultFrom, to: defaultTo }] = useState(thisMonth);
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState([]);
  const [pageInfo, setPageInfo] = useState({ count: 0, start: 0, end: 0, next: null, previous: null });
  const [exportState, setExportState] = useState(null); // null | 'working' | 'error'

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, search]);

  /** The filters, in one place: the table and the export must never disagree. */
  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (search) params.set('search', search);
    return params;
  }, [dateFrom, dateTo, search]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const params = filterParams();
      params.set('page', String(page));

      const [meRes, listRes] = await Promise.all([
        authFetch('/api/me/'),
        authFetch(`/api/registrar/released/?${params}`),
      ]);

      if ([meRes, listRes].some((r) => r.status === 401)) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      if ([meRes, listRes].some((r) => r.status === 403)) throw new Error('forbidden');
      if (!meRes.ok || !listRes.ok) throw new Error('failed');

      const [meData, listData] = await Promise.all([meRes.json(), listRes.json()]);
      setMe(meData);
      setRows(listData.results || []);
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
  }, [filterParams, page]);

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

  /**
   * Download the spreadsheet.
   *
   * Fetched rather than linked: the endpoint is JWT-guarded and a plain href
   * cannot carry the Authorization header. The blob is clicked through a
   * throwaway anchor rather than opened in a tab, since a popup opened after
   * an await has lost its user-gesture context and gets blocked.
   */
  const exportToExcel = async () => {
    setExportState('working');
    try {
      const res = await authFetch(`/api/registrar/released/export/?${filterParams()}`);
      if (res.status === 401) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      if (!res.ok) throw new Error(String(res.status));

      const url = URL.createObjectURL(await res.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Released-Documents-${dateFrom || 'all'}-to-${dateTo || 'today'}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setExportState(null);
    } catch {
      setExportState('error');
    }
  };

  const filtered = Boolean(search) || dateFrom !== defaultFrom || dateTo !== defaultTo;

  const resetFilters = () => {
    setDateFrom(defaultFrom);
    setDateTo(defaultTo);
    setSearchInput('');
    setSearch('');
  };

  return (
    <div className="ts-app-shell lg:flex" style={FONT_SANS}>
      <style>{APP_CSS}</style>
      <RegistrarSidebar active="released" onLogout={handleLogout} me={me} />
      <RegistrarMobileHeader active="released" onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              Released Documents
            </h1>
            <p className="ts-soft mt-1.5 text-base">A record of everything claimed at Window 6.</p>
          </div>

          {/* The one main action on this page. */}
          <button
            type="button"
            onClick={exportToExcel}
            disabled={exportState === 'working' || (status === 'ready' && rows.length === 0)}
            className="ts-btn-primary flex shrink-0 items-center justify-center gap-2 px-5 py-3 text-sm font-medium"
          >
            {exportState === 'working' ? <Spinner /> : <DownloadIcon />}
            {exportState === 'working' ? 'Preparing…' : 'Export to Excel'}
          </button>
        </div>

        {exportState === 'error' && (
          <div role="alert" className="ts-banner ts-banner-error mt-5 px-4 py-3 text-sm">
            We couldn&rsquo;t create the file just now. Please try again.
          </div>
        )}

        {/* Two filters, not five. */}
        <div className="ts-card mt-6 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div>
              <label htmlFor="dateFrom" className="ts-ink mb-1.5 block text-sm font-medium">
                Released between
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="dateFrom"
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
                  aria-label="Released up to"
                  className="ts-input px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="lg:flex-1">
              <label htmlFor="releasedSearch" className="ts-ink mb-1.5 block text-sm font-medium">
                Search
              </label>
              <div className="relative">
                <input
                  id="releasedSearch"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Student name or request code"
                  className="ts-input w-full py-2.5 pl-9 pr-3 text-sm"
                />
                <span className="ts-soft pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                  <SearchIcon />
                </span>
              </div>
            </div>

            {filtered && (
              <button type="button" onClick={resetFilters} className="ts-btn-glass px-4 py-2.5 text-sm font-medium">
                This month
              </button>
            )}
          </div>
          <p className="ts-soft mt-3 text-sm">
            The Excel file contains whatever is shown here, so set the dates first, then export.
          </p>
        </div>

        {status === 'error' && (
          <div className="ts-banner ts-banner-error mt-6 flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>We couldn&rsquo;t load the records. Please check your internet connection.</span>
            <button type="button" onClick={load} className="ts-link shrink-0 font-medium">
              Try again
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div className="ts-card mt-6 space-y-4 p-6">
            <div className="ts-skeleton h-4 w-48" />
            <div className="ts-skeleton h-4 w-full" />
            <div className="ts-skeleton h-4 w-full" />
            <div className="ts-skeleton h-4 w-2/3" />
          </div>
        )}

        {status === 'ready' && rows.length === 0 && (
          <div className="ts-card mt-6 flex flex-col items-center px-6 py-16 text-center">
            <ArchiveIcon />
            <p className="ts-ink mt-4 text-base font-semibold">
              {filtered ? 'Nothing matches these filters' : 'No documents released this month yet'}
            </p>
            <p className="ts-soft mt-1.5 max-w-md text-sm">
              {filtered
                ? 'Try a wider date range, or a different name or request code.'
                : 'Documents appear here as soon as you release them at Window 6.'}
            </p>
            {filtered && (
              <button type="button" onClick={resetFilters} className="ts-btn-primary mt-5 px-6 py-2.5 text-sm font-medium">
                Show this month
              </button>
            )}
          </div>
        )}

        {status === 'ready' && rows.length > 0 && (
          <>
            {/* A table on wide screens; the same rows as cards on a phone,
                where eight columns cannot be read side by side. */}
            <div className="ts-card mt-6 hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    {COLUMNS.map((c) => (
                      <th
                        key={c}
                        scope="col"
                        className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: '#5B6474', borderBottom: '1px solid #E3DFD2' }}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="ts-row-hover" style={{ borderBottom: '1px solid rgba(227,223,210,0.6)' }}>
                      <td className="ts-ink whitespace-nowrap px-4 py-4 text-sm">{formatDate(r.date_released)}</td>
                      <td className="px-4 py-4 text-sm font-semibold">
                        <a href={`/registrar/queue/${r.id}`} className="ts-link">
                          {r.request_code}
                        </a>
                      </td>
                      <td className="ts-ink px-4 py-4 text-sm">{r.student_name}</td>
                      <td className="ts-soft px-4 py-4 text-sm">{r.student_course || '—'}</td>
                      <td className="ts-ink px-4 py-4 text-sm">{r.transaction_type}</td>
                      <td className="ts-ink whitespace-nowrap px-4 py-4 text-sm">{formatAmount(r.amount_due)}</td>
                      <td className="ts-soft whitespace-nowrap px-4 py-4 text-sm">{r.or_number || '—'}</td>
                      <td className="ts-ink px-4 py-4 text-sm">
                        {r.claimed_by || '—'}
                        {r.claimed_by_proxy && (
                          <span className="ts-soft block text-xs">Someone else collected it</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 space-y-3 lg:hidden">
              {rows.map((r) => (
                <div key={r.id} className="ts-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="ts-ink text-base font-semibold">{r.student_name}</p>
                      <p className="ts-soft mt-0.5 text-sm">{r.transaction_type}</p>
                    </div>
                    <a href={`/registrar/queue/${r.id}`} className="ts-link shrink-0 text-sm font-semibold">
                      {r.request_code}
                    </a>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <dt className="ts-review-label">Date released</dt>
                      <dd className="ts-review-value">{formatDate(r.date_released)}</dd>
                    </div>
                    <div>
                      <dt className="ts-review-label">Amount</dt>
                      <dd className="ts-review-value">{formatAmount(r.amount_due)}</dd>
                    </div>
                    <div>
                      <dt className="ts-review-label">O.R. number</dt>
                      <dd className="ts-review-value">{r.or_number || '—'}</dd>
                    </div>
                    <div>
                      <dt className="ts-review-label">Claimed by</dt>
                      <dd className="ts-review-value">{r.claimed_by || '—'}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="ts-soft text-sm">
                {pageInfo.count === 1
                  ? 'Showing 1 document'
                  : `Showing ${pageInfo.start}–${pageInfo.end} of ${pageInfo.count} documents`}
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
          </>
        )}
      </main>
    </div>
  );
}

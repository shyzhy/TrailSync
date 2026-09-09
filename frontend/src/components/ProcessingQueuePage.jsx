import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APP_CSS,
  ChevronIcon,
  DocumentIcon,
  DownloadIcon,
  FONT_SANS,
  FONT_SERIF,
  RegistrarMobileHeader,
  RegistrarSidebar,
  Spinner,
} from './trailsyncUI.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';

const LOGIN_PATH = '/';

// "Pending" in the UI maps to the Submitted status value — there's no
// literal "Pending" in RequestStatus (see backend notes on the still-
// unresolved 9-stage flow), Submitted is the closest existing analog.
const STATUS_OPTIONS = [
  { value: 'Submitted', label: 'Pending' },
  { value: 'Verified', label: 'Verified' },
  { value: 'Ready', label: 'Ready for Pickup' },
  { value: 'Released', label: 'Released' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'all', label: 'All statuses' },
];

function formatFileSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function RowSkeleton() {
  return (
    <div className="grid grid-cols-12 items-center gap-3 px-5 py-4">
      <div className="ts-skeleton col-span-2 h-4" />
      <div className="ts-skeleton col-span-4 h-4" />
      <div className="ts-skeleton col-span-3 h-4" />
      <div className="ts-skeleton col-span-2 h-5 rounded-full" />
      <div className="ts-skeleton col-span-1 h-7 rounded-md" />
    </div>
  );
}

export default function ProcessingQueuePage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());

  const [statusFilter, setStatusFilter] = useState('Submitted');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [results, setResults] = useState([]);
  const [pageInfo, setPageInfo] = useState({ count: 0, start: 0, end: 0, next: null, previous: null });

  const [selectedId, setSelectedId] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // 'verify' | 'reject' | null
  const [actionError, setActionError] = useState('');

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

      const [meRes, queueRes] = await Promise.all([authFetch('/api/me/'), authFetch(`/api/registrar/queue/?${params}`)]);

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

  const selected = useMemo(() => results.find((r) => r.id === selectedId) || null, [results, selectedId]);

  const handleSelect = (row) => {
    setSelectedId(row.id);
    setRemarks('');
    setActionError('');
  };

  const runAction = async (action) => {
    if (!selected) return;
    setActionLoading(action);
    setActionError('');
    try {
      const res = await authFetch(`/api/registrar/queue/${selected.id}/${action}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remarks: remarks.trim() }),
      });
      if (res.status === 401) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.remarks?.[0] || data.detail || 'Could not save this decision.');
        return;
      }
      setSelectedId(null);
      setRemarks('');
      await load();
    } catch {
      setActionError('Unable to reach the server. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="ts-app-shell lg:flex" style={FONT_SANS}>
      <style>{APP_CSS}</style>
      <RegistrarSidebar active="queue" onLogout={handleLogout} me={me} />
      <RegistrarMobileHeader onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 sm:py-10">
        <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
          Processing Queue — Window 6
        </h1>
        <p className="ts-soft mt-1.5 text-sm">
          Review pending submissions, verify uploaded requirements, and schedule release slots.
        </p>

        {/* Filter row */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ts-input ts-select w-full py-2.5 pl-3.5 pr-9 text-sm sm:w-48"
            >
              {STATUS_OPTIONS.map((o) => (
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

        {/* Two-column layout */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
          {/* Left: request list */}
          <div className="xl:col-span-3">
            <div className="ts-card overflow-hidden">
              <div className="hidden grid-cols-12 gap-3 px-5 py-3 text-xs font-semibold uppercase tracking-wide sm:grid" style={{ color: '#5B6474' }}>
                <span className="col-span-2">Req Code</span>
                <span className="col-span-4">Student</span>
                <span className="col-span-3">Document Type</span>
                <span className="col-span-2">Req Status</span>
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
                results.map((r) => {
                  const complete = r.requirements_status === 'Complete';
                  const isSelected = r.id === selectedId;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleSelect(r)}
                      className="ts-row-hover ts-row-divider grid w-full grid-cols-1 gap-2 px-5 py-4 text-left sm:grid-cols-12 sm:items-center sm:gap-3"
                      style={isSelected ? { background: 'rgba(36,64,107,0.06)' } : undefined}
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
                      <span className="ts-soft truncate text-sm sm:col-span-3">{r.transaction_type}</span>
                      <span className="sm:col-span-2">
                        <span className={`ts-pill ${complete ? 'ts-pill-ready' : 'ts-pill-released'}`} style={complete ? undefined : { color: '#991B1B', background: 'rgba(220,38,38,0.10)', borderColor: 'rgba(220,38,38,0.35)' }}>
                          {r.requirements_status}
                        </span>
                      </span>
                      <span className="sm:col-span-1">
                        <span className="ts-btn-primary inline-flex px-4 py-1.5 text-xs font-medium">Review</span>
                      </span>
                    </button>
                  );
                })}
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
          </div>

          {/* Right: request details panel */}
          <div className="xl:col-span-2">
            <div className="ts-card p-6">
              {!selected && (
                <p className="ts-soft py-10 text-center text-sm">Select a request to review its details.</p>
              )}

              {selected && (
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="ts-ink text-base font-semibold" style={FONT_SERIF}>
                      Request Details
                    </h2>
                    <span className="ts-soft text-sm font-medium">{selected.request_code}</span>
                  </div>

                  <div className="mt-4">
                    <p className="ts-review-label">Student</p>
                    <p className="ts-review-value">
                      {selected.student_first_name} {selected.student_last_name}
                    </p>
                    <p className="ts-soft mt-0.5 text-xs">
                      ID: {selected.student_school_id_number} · {selected.student_course}
                      {selected.student_year_level ? `-${selected.student_year_level}` : ''}
                    </p>
                  </div>

                  <div className="mt-4">
                    <p className="ts-review-label">Transaction Type</p>
                    <p className="ts-review-value">{selected.transaction_type}</p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="ts-review-label">Purpose</p>
                      <p className="ts-review-value">
                        {selected.purpose === 'Other' ? selected.purpose_other || 'Other' : selected.purpose || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="ts-review-label">Copies</p>
                      <p className="ts-review-value">{selected.number_of_copies ?? '—'}</p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="ts-review-label">Uploaded Requirements</p>
                    {selected.uploaded_files.length === 0 ? (
                      <p className="ts-soft mt-1.5 text-xs leading-relaxed">
                        No files tracked for this request. TRANSACTION_TYPES.required_documents lists what's
                        needed, but there is currently no table storing multiple student-uploaded files per
                        request — see the SUBMISSION_ATTACHMENTS note.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {selected.uploaded_files.map((f) => (
                          <li key={f.file_url} className="ts-slot-card flex items-center gap-3 px-3 py-2.5">
                            <span className="ts-soft shrink-0">
                              <DocumentIcon />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="ts-ink truncate text-xs font-medium">{f.file_name}</p>
                              {f.file_size != null && <p className="ts-soft text-xs">{formatFileSize(f.file_size)}</p>}
                            </div>
                            <a
                              href={f.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="ts-icon-chip shrink-0"
                              aria-label={`Download ${f.file_name}`}
                            >
                              <DownloadIcon />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-5">
                    <label htmlFor="reviewRemarks" className="ts-ink mb-1.5 block text-sm font-medium">
                      Review Remarks
                    </label>
                    <textarea
                      id="reviewRemarks"
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add review notes or rejected explanations here..."
                      className="ts-input w-full px-3.5 py-2.5 text-sm"
                    />
                  </div>

                  {actionError && (
                    <div role="alert" className="ts-banner ts-banner-error mt-3 px-3.5 py-2.5 text-sm">
                      {actionError}
                    </div>
                  )}

                  <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                    <button
                      type="button"
                      disabled={Boolean(actionLoading)}
                      onClick={() => runAction('verify')}
                      className="ts-btn-sage flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium"
                    >
                      {actionLoading === 'verify' && <Spinner />}
                      Verify &amp; Approve
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(actionLoading) || !remarks.trim()}
                      onClick={() => runAction('reject')}
                      className="ts-btn-outline-danger flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium"
                    >
                      {actionLoading === 'reject' && <Spinner />}
                      Reject with Remarks
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

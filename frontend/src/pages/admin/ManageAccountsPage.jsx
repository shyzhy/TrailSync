import { useCallback, useEffect, useState } from 'react';
import AdminShell from '../../components/layout/AdminShell.jsx';
import {
  EmptyState,
  ErrorState,
  SearchIcon,
  SkeletonGroup,
  TableRowSkeleton,
  UserPlusIcon,
  UsersIcon,
} from '../../components/ui/index.js';
import { FONT_SERIF } from '../../styles/fonts.js';
import { errorFromResponse, toApiError } from '../../lib/api.js';
import { ADMIN_LOGIN_PATH, authFetch, clearSession, getAccessToken, getStoredUser } from '../../lib/auth.js';
import { useLatestOnly } from '../../lib/latestOnly.js';
import AccountDetailsDialog from './AccountDetailsDialog.jsx';
import AddRegistrarDialog from './AddRegistrarDialog.jsx';
import StatusChangeDialog from './StatusChangeDialog.jsx';
import { formatDate, ROLE_TAG, STATE_PILL } from './accountDisplay.js';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'student', label: 'Students' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'staff', label: 'Staff' },
];
const COLUMNS = ['Name', 'Email', 'Role', 'Status', 'Date joined', 'Actions'];

// ?view=<id> opens an account's details and ?add=1 opens the add form, so the dashboard can link straight to either.
function initialDialogs() {
  const params = new URLSearchParams(window.location.search);
  const view = Number(params.get('view'));
  return { view: Number.isInteger(view) && view > 0 ? view : null, add: params.get('add') === '1' };
}

function RowActions({ account, onView, onChangeStatus, isSelf }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <button type="button" onClick={() => onView(account.id)} className="ts-link ts-tap text-sm font-semibold">
        View details
      </button>
      {account.can_change_status ? (
        <button
          type="button"
          onClick={() => onChangeStatus(account)}
          className={`ts-tap text-sm font-semibold ${account.status === 'Active' ? 'ts-error-text' : 'ts-link'}`}
        >
          {account.status === 'Active' ? 'Suspend' : 'Reactivate'}
        </button>
      ) : (
        <span className="ts-soft text-sm">{isSelf ? 'You' : 'Administrator'}</span>
      )}
    </div>
  );
}

// /admin/accounts: every account, filterable by role and searchable, with details, suspension and adding staff.
export default function ManageAccountsPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());
  const [tab, setTab] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pageInfo, setPageInfo] = useState({ count: 0, start: 0, end: 0, next: null, previous: null });
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);

  const [dialogs] = useState(initialDialogs);
  const [viewingId, setViewingId] = useState(dialogs.view);
  const [adding, setAdding] = useState(dialogs.add);
  const [statusTarget, setStatusTarget] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [tab, search]);

  const startLoad = useLatestOnly();
  const load = useCallback(async () => {
    const isCurrent = startLoad();
    setStatus('loading');
    setLoadError(null);
    try {
      const params = new URLSearchParams({ role: tab, page: String(page) });
      if (search) params.set('search', search);
      const [meRes, listRes] = await Promise.all([authFetch('/api/me/'), authFetch(`/api/admin/accounts/?${params}`)]);
      const failed = [meRes, listRes].find((r) => !r.ok);
      if (failed) throw await errorFromResponse(failed);
      const [meData, listData] = await Promise.all([meRes.json(), listRes.json()]);
      if (!isCurrent()) return;
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
    } catch (error) {
      if (!isCurrent()) return;
      setLoadError(toApiError(error));
      setStatus('error');
    }
  }, [tab, search, page, startLoad]);

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = ADMIN_LOGIN_PATH;
      return;
    }
    load();
  }, [load]);

  const handleLogout = () => {
    clearSession();
    window.location.href = ADMIN_LOGIN_PATH;
  };

  const notify = useCallback((message, tone = 'success') => setToast({ message, tone }), []);
  const closeDetails = useCallback(() => setViewingId(null), []);
  const closeAdd = useCallback(() => setAdding(false), []);
  const closeStatus = useCallback(() => setStatusTarget(null), []);

  const statusChanged = (account) => {
    setRows((list) => list.map((r) => (r.id === account.id ? account : r)));
    setStatusTarget(null);
    setViewingId(null);
    notify(
      account.status === 'Active'
        ? `${account.name || account.email} can log in again.`
        : `${account.name || account.email} is suspended and has been signed out.`,
    );
  };

  const filtered = tab !== 'all' || Boolean(search);

  return (
    <AdminShell active="accounts" me={me} onLogout={handleLogout} toast={toast} onToastDismiss={() => setToast(null)}>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              Manage Accounts
            </h1>
            <p className="ts-soft mt-1.5 text-base">
              Everyone with a TrailSync account. Suspending an account signs it out and stops it logging in.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="ts-btn-primary flex shrink-0 items-center justify-center gap-2 px-5 py-3 text-sm font-medium"
          >
            <UserPlusIcon />
            Add Registrar Account
          </button>
        </div>

        <div className="ts-card mt-6 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="ts-tab-scroller" role="group" aria-label="Filter by role">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  aria-pressed={tab === t.value}
                  className={`ts-filter-tab ${tab === t.value ? 'ts-filter-tab-active' : ''}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="lg:w-80">
              <label htmlFor="accountSearch" className="sr-only">
                Search by name or email
              </label>
              <div className="relative">
                <input
                  id="accountSearch"
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by name or email"
                  className="ts-input w-full py-2.5 pl-9 pr-3 text-sm"
                />
                <span className="ts-soft pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                  <SearchIcon />
                </span>
              </div>
            </div>
          </div>
        </div>

        {status === 'error' && (
          <ErrorState className="mt-6" error={loadError} title="We couldn&rsquo;t load the accounts" onRetry={load} />
        )}

        {status === 'loading' && (
          <SkeletonGroup label="Loading accounts" className="ts-card mt-6 overflow-hidden">
            <TableRowSkeleton widths={[3, 3, 2, 2, 2, 2]} />
            <div className="ts-row-divider" />
            <TableRowSkeleton widths={[3, 3, 2, 2, 2, 2]} />
            <div className="ts-row-divider" />
            <TableRowSkeleton widths={[3, 3, 2, 2, 2, 2]} />
          </SkeletonGroup>
        )}

        {status === 'ready' && rows.length === 0 && (
          <EmptyState
            className="mt-6"
            icon={filtered ? SearchIcon : UsersIcon}
            title={filtered ? 'No accounts match' : 'No accounts yet'}
            message={filtered ? 'Try another name or email, or show every role.' : 'Accounts appear here as people sign up or you add staff.'}
            action={
              filtered ? (
                <button
                  type="button"
                  onClick={() => {
                    setTab('all');
                    setSearchInput('');
                    setSearch('');
                  }}
                  className="ts-btn-primary px-6 py-2.5 text-sm font-medium"
                >
                  Show all accounts
                </button>
              ) : null
            }
          />
        )}

        {status === 'ready' && rows.length > 0 && (
          <>
            {/* A table on wide screens; the same rows as cards on a phone. */}
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
                      <td className="ts-ink px-4 py-3.5 text-sm font-medium">{r.name || <span className="ts-soft">No name yet</span>}</td>
                      <td className="ts-soft break-all px-4 py-3.5 text-sm">{r.email}</td>
                      <td className="px-4 py-3.5">
                        <span className={ROLE_TAG[r.role] || 'ts-tag ts-tag-muted'}>{r.role || 'No role'}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`ts-pill ${STATE_PILL[r.account_state] || 'ts-pill-released'}`}>{r.account_state}</span>
                      </td>
                      <td className="ts-soft whitespace-nowrap px-4 py-3.5 text-sm">{formatDate(r.date_joined)}</td>
                      <td className="px-4 py-2">
                        <RowActions account={r} onView={setViewingId} onChangeStatus={setStatusTarget} isSelf={r.id === me?.id} />
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
                      <p className="ts-ink text-base font-semibold">{r.name || 'No name yet'}</p>
                      <p className="ts-soft mt-0.5 break-all text-sm">{r.email}</p>
                    </div>
                    <span className={`ts-pill ${STATE_PILL[r.account_state] || 'ts-pill-released'} shrink-0`}>{r.account_state}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={ROLE_TAG[r.role] || 'ts-tag ts-tag-muted'}>{r.role || 'No role'}</span>
                    <span className="ts-soft text-sm">Joined {formatDate(r.date_joined)}</span>
                  </div>
                  <div className="ts-hairline my-3 h-px" />
                  <RowActions account={r} onView={setViewingId} onChangeStatus={setStatusTarget} isSelf={r.id === me?.id} />
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="ts-soft text-sm">
                {pageInfo.count === 1 ? 'Showing 1 account' : `Showing ${pageInfo.start}–${pageInfo.end} of ${pageInfo.count} accounts`}
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

      {viewingId && !statusTarget && (
        <AccountDetailsDialog accountId={viewingId} onClose={closeDetails} onChangeStatus={setStatusTarget} notify={notify} />
      )}
      {statusTarget && <StatusChangeDialog account={statusTarget} onClose={closeStatus} onChanged={statusChanged} />}
      {adding && (
        <AddRegistrarDialog
          onClose={closeAdd}
          onCreated={() => {
            if (page === 1) load();
            else setPage(1);
          }}
        />
      )}
    </AdminShell>
  );
}

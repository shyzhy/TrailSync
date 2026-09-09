import { useEffect, useMemo, useState } from 'react';
import {
  APP_CSS,
  AppMobileHeader,
  AppSidebar,
  CloseIcon,
  DocumentIcon,
  FONT_SANS,
  FONT_SERIF,
  SearchIcon,
} from './trailsyncUI.jsx';
import CredentialDetailCard, { formatFee } from './CredentialDetailCard.jsx';
import { authFetch, clearSession, getAccessToken, getStoredUser } from '../lib/auth.js';

const LOGIN_PATH = '/';

function truncate(text, max = 90) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function CredentialGuidePage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [me, setMe] = useState(() => getStoredUser());
  const [types, setTypes] = useState([]);

  const [search, setSearch] = useState('');
  const [activePurpose, setActivePurpose] = useState('All');
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setStatus('loading');
    try {
      // Same GET /api/transaction-types/ the Request Form's Step 1 uses —
      // one admin-editable source, no separately hardcoded catalog content.
      const res = await authFetch('/api/transaction-types/');
      if (res.status === 401) {
        clearSession();
        window.location.href = LOGIN_PATH;
        return;
      }
      if (!res.ok) throw new Error('Request failed.');
      setTypes(await res.json());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = LOGIN_PATH;
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogout = () => {
    clearSession();
    window.location.href = LOGIN_PATH;
  };

  // Derived from the actual fetched data — never a hardcoded list — so the
  // chip row automatically stays in sync with whatever purposes admins have
  // actually tagged documents with.
  const purposeOptions = useMemo(() => {
    const set = new Set();
    types.forEach((t) => (t.common_purposes || []).forEach((p) => set.add(p)));
    return Array.from(set).sort();
  }, [types]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return types.filter((t) => {
      const matchesPurpose = activePurpose === 'All' || (t.common_purposes || []).includes(activePurpose);
      if (!matchesPurpose) return false;
      if (!q) return true;
      const haystack = [t.name, t.description, ...(t.common_purposes || [])].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [types, search, activePurpose]);

  return (
    <div className="ts-app-shell lg:flex" style={FONT_SANS}>
      <style>{APP_CSS}</style>
      <AppSidebar active="guide" onLogout={handleLogout} me={me} />
      <AppMobileHeader onLogout={handleLogout} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 sm:py-10 lg:px-10">
        <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
          Credential Guide
        </h1>
        <p className="ts-soft mt-1.5 text-sm">Everything you need to know before you request a document.</p>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by document name or purpose..."
              aria-label="Search the credential guide"
              className="ts-input w-full py-2.5 pl-9 pr-3 text-sm"
            />
            <span className="ts-soft pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <SearchIcon />
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActivePurpose('All')}
            aria-pressed={activePurpose === 'All'}
            className={`ts-filter-tab ${activePurpose === 'All' ? 'ts-filter-tab-active' : ''}`}
          >
            All
          </button>
          {purposeOptions.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setActivePurpose(p)}
              aria-pressed={activePurpose === p}
              className={`ts-filter-tab ${activePurpose === p ? 'ts-filter-tab-active' : ''}`}
            >
              {p}
            </button>
          ))}
        </div>

        {status === 'error' && (
          <div className="ts-banner ts-banner-error mt-6 flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>Something went wrong loading the credential guide.</span>
            <button type="button" onClick={load} className="ts-link shrink-0 font-medium">
              Retry
            </button>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {status === 'loading' &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ts-card space-y-3 p-5">
                <div className="ts-skeleton h-5 w-40" />
                <div className="ts-skeleton h-3 w-full" />
                <div className="ts-skeleton h-6 w-32" />
              </div>
            ))}

          {status === 'ready' &&
            filtered.map((t) => (
              <button key={t.id} type="button" onClick={() => setSelected(t)} className="ts-guide-card p-5">
                <div className="ts-stat-icon ts-stat-icon-blue">
                  <DocumentIcon />
                </div>
                <p className="ts-ink mt-3 text-sm font-semibold">{t.name}</p>
                <p className="ts-soft mt-1 text-xs leading-relaxed">{truncate(t.description)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="ts-tag">{formatFee(t.fee_amount) || 'No fee'}</span>
                  {t.processing_time && <span className="ts-tag ts-tag-sage">{t.processing_time}</span>}
                </div>
              </button>
            ))}
        </div>

        {status === 'ready' && filtered.length === 0 && (
          <div className="ts-card mt-2 flex flex-col items-center px-6 py-14 text-center">
            <p className="ts-ink text-sm font-semibold">No documents match your search</p>
            <p className="ts-soft mt-1 text-sm">
              Try clearing your filters, or contact Window 6 if you're not sure which document you need.
            </p>
          </div>
        )}
      </main>

      {selected && (
        <div className="ts-modal-overlay" onClick={() => setSelected(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={selected.name}
            className="ts-modal-panel p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="ts-modal-close"
            >
              <CloseIcon />
            </button>
            <CredentialDetailCard transactionType={selected} />
          </div>
        </div>
      )}
    </div>
  );
}

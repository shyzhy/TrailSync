import { useEffect, useMemo, useState } from 'react';
import {
  CloseIcon,
  DocumentIcon,
  FONT_SERIF,
  SearchIcon,
} from './trailsyncUI.jsx';
import StudentShell from './StudentShell.jsx';
import CredentialDetailCard, { formatFeeWithUnit } from './CredentialDetailCard.jsx';
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
    <StudentShell active="guide" me={me} onLogout={handleLogout} onMeChange={setMe}>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-8 pt-4 sm:pb-10 sm:pt-6 lg:pt-3 lg:px-10">
        <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
          Credential Guide
        </h1>
        {/* The page keeps its name: "Credential Guide" is what the sidebar,
            the tour and the help menu all call it. */}
        <p className="ts-soft mt-1.5 max-w-2xl text-base">
          Not sure which document you need? Tap any document to see what it&rsquo;s for, what to bring, and how much
          it costs.
        </p>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search, e.g. transfer or abroad"
              aria-label="Search documents by name or what they're for"
              className="ts-input w-full py-2.5 pl-9 pr-3 text-sm"
            />
            <span className="ts-soft pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <SearchIcon />
            </span>
          </div>
        </div>

        {purposeOptions.length > 0 && (
          <p className="ts-soft mt-5 text-sm font-medium">What do you need it for?</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
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
            <span>We couldn&rsquo;t load the list of documents. Please check your internet connection.</span>
            <button type="button" onClick={load} className="ts-link shrink-0 font-medium">
              Try again
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
                {/* Names stay exactly as printed on FM-USTP-RGTR-09. */}
                <p className="ts-ink mt-3 text-base font-semibold">{t.name}</p>
                <p className="ts-soft mt-1 text-sm leading-relaxed">{truncate(t.description, 110)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="ts-tag">{formatFeeWithUnit(t)}</span>
                  {t.processing_time && <span className="ts-tag ts-tag-sage">{t.processing_time}</span>}
                  <span className="ts-link ml-auto text-xs font-medium">See details</span>
                </div>
              </button>
            ))}
        </div>

        {status === 'ready' && filtered.length === 0 && (
          <div className="ts-card mt-2 flex flex-col items-center px-6 py-14 text-center">
            <p className="ts-ink text-base font-semibold">
              {search.trim() ? `Nothing matches “${search.trim()}”` : 'No documents for this purpose'}
            </p>
            <p className="ts-soft mt-1.5 max-w-sm text-sm">
              Try a shorter word, or show every document and browse. Still unsure? Ask at Window 6 &mdash; they can
              tell you which one you need.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setActivePurpose('All');
              }}
              className="ts-btn-primary mt-5 px-6 py-2.5 text-sm font-medium"
            >
              Show all documents
            </button>
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
    </StudentShell>
  );
}

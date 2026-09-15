import { useEffect, useMemo, useState } from 'react';
import StudentShell from '../../components/layout/StudentShell.jsx';
import {
  CloseIcon,
  DocumentIcon,
  EmptyState,
  ErrorState,
  GuideCardSkeleton,
  SearchIcon,
} from '../../components/ui/index.js';
import CredentialDetailCard, { formatFeeWithUnit } from '../../components/student/CredentialDetailCard.jsx';
import { FONT_SERIF } from '../../styles/fonts.js';
import { errorFromResponse, toApiError } from '../../lib/api.js';
import {
  authFetch,
  clearSession,
  getAccessToken,
  getStoredUser,
  STUDENT_LOGIN_PATH,
} from '../../lib/auth.js';
import { useBackButton } from '../../lib/backButton.js';

const LOGIN_PATH = STUDENT_LOGIN_PATH;

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
  useBackButton(Boolean(selected), () => setSelected(null), { overlay: true });
  const [loadError, setLoadError] = useState(null);

  const load = async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      // Same catalogue as the Request Form, so there is one admin-editable source.
      const res = await authFetch('/api/transaction-types/');
      if (!res.ok) throw await errorFromResponse(res);
      setTypes(await res.json());
      setStatus('ready');
    } catch (error) {
      setLoadError(toApiError(error));
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

  // Derived from the fetched data, so the chips match whatever purposes admins have tagged.
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
    <StudentShell active="guide" title="Credential Guide" me={me} onLogout={handleLogout} onMeChange={setMe}>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-8 pt-4 sm:pb-10 sm:pt-6 lg:pt-3 lg:px-10">
        <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
          Credential Guide
        </h1>
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
        <div className="ts-tab-scroller mt-2" role="group" aria-label="Filter by purpose">
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
          <ErrorState className="mt-6" error={loadError} title="We couldn&rsquo;t load the list of documents" onRetry={load} />
        )}

        <div
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
          role={status === 'loading' ? 'status' : undefined}
          aria-busy={status === 'loading' ? 'true' : undefined}
          aria-label={status === 'loading' ? 'Loading documents' : undefined}
        >
          {status === 'loading' &&
            Array.from({ length: 4 }).map((_, i) => <GuideCardSkeleton key={i} />)}

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
                  {t.is_available === false && <span className="ts-tag ts-tag-muted">Not available right now</span>}
                  <span className="ts-tag">{formatFeeWithUnit(t)}</span>
                  {t.processing_time && <span className="ts-tag ts-tag-sage">{t.processing_time}</span>}
                  <span className="ts-link ml-auto text-xs font-medium">See details</span>
                </div>
              </button>
            ))}
        </div>

        {status === 'ready' && filtered.length === 0 && (
          <EmptyState
            className="mt-2"
            icon={SearchIcon}
            title="No documents match your search"
            message="Try a shorter word or clear your filters. Still unsure? Ask at Window 6 — they can tell you which one you need."
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setActivePurpose('All');
                }}
                className="ts-btn-primary px-6 py-2.5 text-sm font-medium"
              >
                Show all documents
              </button>
            }
          />
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

import { useEffect, useRef, useState } from 'react';
import { BookIcon, ChatIcon, PlusCircleIcon, TicketIcon } from '../components/ui/index.js';
import { SHARED_CSS } from '../styles/authCss.js';
import { FONT_SANS, FONT_SERIF } from '../styles/fonts.js';
import { STAFF_LOGIN_PATH, STUDENT_LOGIN_PATH } from '../lib/auth.js';

// The public front door at "/": the usual palette and type, with motion that stops under reduced motion.

// Only contact details the system already states elsewhere; there's no phone or email on record to publish.
const OFFICE = {
  name: 'Office of the Registrar',
  window: 'Window 6',
  campus: 'University of Science and Technology of Southern Philippines — Cagayan de Oro',
  hours: 'Monday to Friday, 8:00 AM – 5:00 PM',
  release: 'Documents are released 3:00 – 5:00 PM',
  contact: 'Questions? Ask in person at Window 6.',
};

const FEATURES = [
  {
    Icon: PlusCircleIcon,
    title: 'Request documents online',
    body: 'Transcripts, certifications, CAV and more — sent from your phone instead of queuing just to ask for a form.',
  },
  {
    Icon: TicketIcon,
    title: 'Track every step',
    body: 'See exactly where your request is, and get a notification the moment the Registrar moves it forward.',
  },
  {
    Icon: BookIcon,
    title: 'Credential Guide',
    body: 'Not sure which document you need? See what each one is for, what to bring and what it costs.',
  },
  {
    Icon: ChatIcon,
    title: 'Ask TrailSync',
    body: 'An assistant for quick answers about requirements, fees and pickup.',
    // Not built yet, listed honestly rather than promised.
    soon: true,
  },
];

const LIFECYCLE = [
  {
    key: 'request',
    label: 'Request',
    who: 'You',
    body: 'Choose the document you need and send your request online. It takes a few taps, and you get a tracking number straight away.',
  },
  {
    key: 'verify',
    label: 'Verify',
    who: 'Window 6',
    body: 'Window 6 checks your requirements, then the Registrar approves the request and works out the fee.',
  },
  {
    key: 'pay',
    label: 'Pay',
    who: 'You',
    body: 'Print your form and pay at the Cashier. Your claim stub unlocks as soon as the payment is recorded.',
  },
  {
    key: 'release',
    label: 'Release',
    who: 'You',
    body: 'Bring your claim stub and a valid ID to Window 6 on your release date, between 3:00 and 5:00 PM.',
  },
];

// The same stages a student sees.
const EXAMPLE_STAGES = ['Submitted', 'Under Review', 'Ready to Print', 'Processing', 'Ready for Pickup', 'Released'];

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// Reveal [data-reveal] sections once as they scroll into view; without IntersectionObserver or with reduced motion, show everything.
function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const targets = [...root.querySelectorAll('[data-reveal]')];
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      targets.forEach((el) => el.setAttribute('data-revealed', ''));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-revealed', '');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rootRef]);
}

// Calls back with true/false as an element enters or leaves the viewport.
function useInView(ref, threshold = 0.35) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return inView;
}

function Wordmark({ size = 'md', light = false }) {
  const big = size === 'lg';
  return (
    <span className="flex items-center gap-1.5">
      <img
        src="/trailsync-logo.png"
        alt=""
        aria-hidden="true"
        style={{ height: big ? 72 : 40, width: 'auto', margin: big ? '-12px -4px' : '-7px -2px' }}
      />
      <span
        className={`${big ? 'text-5xl sm:text-6xl' : 'text-xl'} font-semibold tracking-tight`}
        style={{ ...FONT_SERIF, color: light ? '#FAF8F3' : '#1F2937' }}
      >
        TrailSync
      </span>
    </span>
  );
}

// A looping stand-in for a real ticket, so the hero shows the product moving.
function ExampleTicket() {
  const [stage, setStage] = useState(1);
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const t = setInterval(() => setStage((s) => (s + 1) % EXAMPLE_STAGES.length), 1700);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="ts-land-ticket" aria-hidden="true">
      <div className="ts-land-ticket-stub">
        <span className="text-base font-semibold" style={FONT_SERIF}>
          W6-0142
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.12em] opacity-70">Window 6</span>
      </div>
      <div className="ts-land-ticket-body">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: '#1F2937' }}>
            Transcript of Records
          </p>
          <span className="ts-land-example">Example</span>
        </div>
        <p className="mt-0.5 text-xs" style={{ color: '#5B6474' }}>
          2 copies · For employment
        </p>
        <div className="mt-3.5 flex items-center">
          {EXAMPLE_STAGES.map((s, i) => (
            <span key={s} className="flex flex-1 items-center last:flex-none">
              <span className={`ts-land-dot ${i < stage ? 'is-done' : ''} ${i === stage ? 'is-current' : ''}`} />
              {i < EXAMPLE_STAGES.length - 1 && <span className={`ts-land-line ${i < stage ? 'is-done' : ''}`} />}
            </span>
          ))}
        </div>
        <p key={stage} className="ts-land-stage mt-2.5 text-xs font-semibold" style={{ color: '#24406B' }}>
          {EXAMPLE_STAGES[stage]}
        </p>
      </div>
    </div>
  );
}

function Lifecycle() {
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Walks the steps on its own while on screen, and stops for good once someone picks a step.
  useEffect(() => {
    if (!inView || paused || prefersReducedMotion()) return undefined;
    const t = setInterval(() => setActive((a) => (a + 1) % LIFECYCLE.length), 2800);
    return () => clearInterval(t);
  }, [inView, paused]);

  const pick = (i) => {
    setPaused(true);
    setActive(i);
  };

  const step = LIFECYCLE[active];
  return (
    <section ref={sectionRef} id="how" className="ts-land-section scroll-mt-20 px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <div data-reveal className="text-center">
          <p className="ts-land-kicker">How it works</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ ...FONT_SERIF, color: '#1F2937' }}>
            From request to release
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed" style={{ color: '#5B6474' }}>
            Four steps, and TrailSync tells you which one you&rsquo;re on.
          </p>
        </div>

        <div data-reveal style={{ '--reveal-delay': '120ms' }} className="ts-land-track mt-14">
          {/* The rail, the part already travelled, and the ticket moving along it. */}
          <div className="ts-land-rail" aria-hidden="true">
            <div className="ts-land-rail-fill" style={{ '--progress': active / (LIFECYCLE.length - 1) }} />
            <div className="ts-land-marker" style={{ '--progress': active / (LIFECYCLE.length - 1) }}>
              <TicketIcon />
            </div>
          </div>

          <ol className="ts-land-steps" aria-label="The four steps">
            {LIFECYCLE.map((s, i) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => pick(i)}
                  onFocus={() => pick(i)}
                  aria-current={i === active ? 'step' : undefined}
                  className={`ts-land-step ${i <= active ? 'is-reached' : ''} ${i === active ? 'is-active' : ''}`}
                >
                  <span className="ts-land-step-stub" style={FONT_SERIF}>
                    {i + 1}
                  </span>
                  <span className="ts-land-step-label">{s.label}</span>
                  <span className="ts-land-step-who">{s.who}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div data-reveal style={{ '--reveal-delay': '220ms' }} className="mx-auto mt-10 max-w-2xl">
          <div key={step.key} className="ts-land-detail">
            <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: '#B8872B' }}>
              Step {active + 1} · {step.label}
            </p>
            <p className="mt-2 text-lg leading-relaxed" style={{ color: '#1F2937' }}>
              {step.body}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const rootRef = useRef(null);
  const photoRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  useReveal(rootRef);

  // Smooth anchor scrolling on this page only, and not under reduced motion.
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = 'smooth';
    return () => {
      html.style.scrollBehavior = previous;
    };
  }, []);

  // Parallax via a CSS variable written once per frame, so scrolling never re-renders; the nav turns glassy past the fold.
  useEffect(() => {
    const reduce = prefersReducedMotion();
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        setScrolled(y > 24);
        if (!reduce && photoRef.current && y < window.innerHeight * 1.2) {
          photoRef.current.style.setProperty('--shift', `${Math.round(y * 0.25)}px`);
        }
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const year = new Date().getFullYear();

  return (
    <div ref={rootRef} className="ts-landing" style={FONT_SANS}>
      <style>{SHARED_CSS + LANDING_CSS}</style>

      {/* Kept outside everything that animates: a transformed ancestor would stop it being fixed. */}
      <header className={`ts-land-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <a href="/" className="flex min-h-[44px] items-center" aria-label="TrailSync home">
            <Wordmark light={!scrolled} />
          </a>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Site">
            <a href="#how" className={`ts-land-navlink hidden md:inline-flex ${scrolled ? '' : 'is-light'}`}>
              How it works
            </a>
            <a href="#features" className={`ts-land-navlink hidden md:inline-flex ${scrolled ? '' : 'is-light'}`}>
              Features
            </a>
            {/* Staff know where they're going; this stays small on purpose. */}
            <a href={STAFF_LOGIN_PATH} className={`ts-land-navlink ${scrolled ? '' : 'is-light'}`}>
              Staff login
            </a>
            <a href={STUDENT_LOGIN_PATH} className="ts-btn-primary ml-1 inline-flex min-h-[44px] items-center px-4 text-sm font-medium sm:px-5">
              Log in
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="ts-land-hero">
          <div ref={photoRef} className="ts-land-photo" aria-hidden="true">
            <div className="ts-land-photo-inner" />
          </div>
          <div className="ts-land-mesh" aria-hidden="true">
            <span className="ts-land-blob ts-land-blob-a" />
            <span className="ts-land-blob ts-land-blob-b" />
            <span className="ts-land-blob ts-land-blob-c" />
          </div>
          <div className="ts-land-hero-fade" aria-hidden="true" />

          <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-24 pt-28 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:pb-32 lg:pt-36">
            <div className="ts-land-hero-card">
              <p className="ts-land-pill">USTP–CDO Registrar · Window 6</p>
              <h1 className="mt-5">
                <span className="sr-only">TrailSync</span>
                <span aria-hidden="true">
                  <Wordmark size="lg" />
                </span>
              </h1>
              <div className="ts-rule mt-4" />
              <p className="mt-5 max-w-md text-lg leading-relaxed sm:text-xl" style={{ color: '#1F2937' }}>
                Request your registrar documents online, and follow them all the way to Window 6.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={STUDENT_LOGIN_PATH}
                  className="ts-btn-primary ts-land-cta inline-flex min-h-[48px] items-center justify-center px-7 text-base font-medium"
                >
                  Log in to get started
                </a>
                <a
                  href="/create-account"
                  className="ts-btn-glass inline-flex min-h-[48px] items-center justify-center px-6 text-base font-medium"
                >
                  Create an account
                </a>
              </div>
              <a href="#how" className="ts-land-scrollcue mt-8 inline-flex min-h-[44px] items-center gap-2 text-sm font-medium">
                See how it works
                <span aria-hidden="true" className="ts-land-scrollcue-arrow">
                  &darr;
                </span>
              </a>
            </div>

            <div className="hidden justify-center lg:flex">
              <div className="ts-land-float">
                <ExampleTicket />
              </div>
            </div>
          </div>
        </section>

        {/* Lifecycle */}
        <Lifecycle />

        {/* Features */}
        <section id="features" className="scroll-mt-20 px-6 pb-24 sm:pb-28">
          <div className="mx-auto max-w-6xl">
            <div data-reveal className="text-center">
              <p className="ts-land-kicker">What you can do</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ ...FONT_SERIF, color: '#1F2937' }}>
                Everything Window 6, in one place
              </h2>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => (
                <article
                  key={f.title}
                  data-reveal
                  style={{ '--reveal-delay': `${i * 90}ms` }}
                  className="ts-land-feature"
                >
                  <span className="ts-land-feature-icon">
                    <f.Icon />
                  </span>
                  <h3 className="mt-5 flex flex-wrap items-center gap-2 text-lg font-semibold" style={{ color: '#1F2937' }}>
                    {f.title}
                    {f.soon && <span className="ts-land-soon">Coming soon</span>}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: '#5B6474' }}>
                    {f.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="px-6 pb-24">
          <div data-reveal className="ts-land-band mx-auto max-w-5xl">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ ...FONT_SERIF, color: '#FAF8F3' }}>
                Ready when you are
              </h2>
              <p className="mt-2 text-base" style={{ color: 'rgba(250,248,243,0.78)' }}>
                Log in with your USTP email or School ID number.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={STUDENT_LOGIN_PATH} className="ts-land-btn-light inline-flex min-h-[48px] items-center justify-center px-7 text-base font-semibold">
                Log in
              </a>
              <a href="/create-account" className="ts-land-btn-outline inline-flex min-h-[48px] items-center justify-center px-6 text-base font-medium">
                Create an account
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="ts-land-footer px-6 pb-10 pt-14">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Wordmark light />
            <p className="mt-4 max-w-sm text-sm leading-relaxed" style={{ color: 'rgba(250,248,243,0.72)' }}>
              {OFFICE.name}, {OFFICE.window}
              <br />
              {OFFICE.campus}
            </p>
          </div>
          <div>
            <p className="ts-land-footer-head">Window 6 hours</p>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: 'rgba(250,248,243,0.85)' }}>
              {OFFICE.hours}
              <br />
              {OFFICE.release}
            </p>
            <p className="mt-3 text-sm" style={{ color: 'rgba(250,248,243,0.72)' }}>
              {OFFICE.contact}
            </p>
          </div>
          <div>
            <p className="ts-land-footer-head">Get in</p>
            <ul className="mt-2 space-y-0.5 text-sm">
              <li>
                <a href={STUDENT_LOGIN_PATH} className="ts-land-footer-link">
                  Student &amp; alumni login
                </a>
              </li>
              <li>
                <a href="/create-account" className="ts-land-footer-link">
                  Create an account
                </a>
              </li>
              <li>
                <a href={STAFF_LOGIN_PATH} className="ts-land-footer-link">
                  Registrar staff login
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-12 max-w-6xl border-t pt-6 text-xs" style={{ borderColor: 'rgba(250,248,243,0.14)', color: 'rgba(250,248,243,0.55)' }}>
          © {year} TrailSync · USTP–CDO Office of the Registrar
        </div>
      </footer>
    </div>
  );
}

const LANDING_CSS = `
  .ts-landing { background: #FAF8F3; color: #1F2937; overflow-x: clip; }

  /* Nav: clear over the photo, frosted paper once scrolled */
  .ts-land-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 50;
    transition: background 250ms ease, box-shadow 250ms ease, backdrop-filter 250ms ease;
  }
  .ts-land-nav.is-scrolled {
    background: linear-gradient(180deg, rgba(250,248,243,0.92) 0%, rgba(250,248,243,0.78) 100%);
    -webkit-backdrop-filter: blur(14px) saturate(1.2);
    backdrop-filter: blur(14px) saturate(1.2);
    box-shadow: 0 1px 0 rgba(227,223,210,0.9), 0 10px 30px -22px rgba(31,41,55,0.35);
  }
  .ts-land-navlink {
    align-items: center; min-height: 44px; padding: 0 12px;
    border-radius: 10px;
    font-size: 14px; font-weight: 500;
    color: #24406B;
    transition: background 150ms ease, color 150ms ease;
  }
  .ts-land-navlink:hover { background: rgba(36,64,107,0.07); }
  .ts-land-navlink.is-light { color: rgba(250,248,243,0.95); text-shadow: 0 1px 3px rgba(15,23,42,0.6); }
  .ts-land-navlink.is-light:hover { background: rgba(250,248,243,0.12); }
  .ts-land-navlink:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.6); }
  .ts-land-navlink { display: inline-flex; }
  @media (max-width: 767px) { .ts-land-navlink.hidden { display: none; } }

  /* Hero: the photo (slow zoom and parallax), a drifting light, and a fade into the paper below */
  .ts-land-hero { position: relative; min-height: 100svh; display: flex; align-items: center; overflow: hidden; background: #24406B; }
  .ts-land-photo {
    position: absolute; left: 0; right: 0; top: -8%; bottom: -8%;
    transform: translate3d(0, var(--shift, 0px), 0);
    will-change: transform;
  }
  .ts-land-photo-inner {
    position: absolute; inset: 0;
    background-image: url('/ustp-cdo-campus.jpg'), linear-gradient(180deg, #A9C2DC 0%, #D8E1E8 40%, #93AC8E 66%, #4F7A6A 100%);
    background-size: cover;
    background-position: 60% center;
    animation: ts-land-breathe 32s ease-in-out infinite alternate;
  }
  @keyframes ts-land-breathe {
    from { transform: scale(1.04); }
    to   { transform: scale(1.13) translate3d(-1.5%, -1%, 0); }
  }
  .ts-land-mesh {
    position: absolute; inset: 0; overflow: hidden;
    background:
      /* Keeps the light nav links readable over a pale sky or building. */
      linear-gradient(180deg, rgba(23,41,74,0.62) 0%, rgba(23,41,74,0) 150px),
      linear-gradient(100deg, rgba(23,41,74,0.78) 0%, rgba(36,64,107,0.55) 38%, rgba(36,64,107,0.18) 72%, rgba(23,41,74,0.35) 100%);
  }
  .ts-land-blob {
    position: absolute; border-radius: 999px; filter: blur(60px);
    will-change: transform;
  }
  .ts-land-blob-a {
    width: 46vw; height: 46vw; left: -12vw; top: -10vw;
    background: radial-gradient(circle, rgba(62,93,143,0.75) 0%, rgba(62,93,143,0) 70%);
    animation: ts-land-drift-a 22s ease-in-out infinite alternate;
  }
  .ts-land-blob-b {
    width: 38vw; height: 38vw; right: -8vw; bottom: -14vw;
    background: radial-gradient(circle, rgba(220,169,72,0.38) 0%, rgba(220,169,72,0) 70%);
    animation: ts-land-drift-b 26s ease-in-out infinite alternate;
  }
  .ts-land-blob-c {
    width: 30vw; height: 30vw; left: 38vw; top: 24vh;
    background: radial-gradient(circle, rgba(250,248,243,0.20) 0%, rgba(250,248,243,0) 70%);
    animation: ts-land-drift-c 30s ease-in-out infinite alternate;
  }
  @keyframes ts-land-drift-a { to { transform: translate3d(14vw, 8vh, 0) scale(1.12); } }
  @keyframes ts-land-drift-b { to { transform: translate3d(-12vw, -10vh, 0) scale(0.92); } }
  @keyframes ts-land-drift-c { to { transform: translate3d(-10vw, 12vh, 0) scale(1.2); } }
  .ts-land-hero-fade {
    position: absolute; left: 0; right: 0; bottom: 0; height: 22%;
    background: linear-gradient(180deg, rgba(250,248,243,0) 0%, #FAF8F3 100%);
  }

  /* The same frosted paper as the login pages. */
  .ts-land-hero-card {
    position: relative;
    padding: 2rem 1.5rem;
    border-radius: 22px;
    background: linear-gradient(160deg, rgba(250,248,243,0.90) 0%, rgba(250,248,243,0.74) 100%);
    -webkit-backdrop-filter: blur(22px) saturate(160%);
    backdrop-filter: blur(22px) saturate(160%);
    border: 1px solid rgba(255,255,255,0.7);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 30px 70px -30px rgba(15,23,42,0.55);
    animation: ts-land-rise 0.7s cubic-bezier(0.2, 0.9, 0.3, 1) both;
  }
  @media (min-width: 640px) { .ts-land-hero-card { padding: 2.75rem 2.75rem 2.25rem; } }
  @keyframes ts-land-rise {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: none; }
  }
  .ts-land-pill {
    display: inline-flex; align-items: center;
    padding: 6px 12px; border-radius: 999px;
    font-size: 12px; font-weight: 600; letter-spacing: 0.04em;
    color: #24406B;
    background: rgba(36,64,107,0.08);
    border: 1px solid rgba(36,64,107,0.18);
  }
  .ts-land-cta { box-shadow: 0 14px 30px -10px rgba(23,41,74,0.55), 0 2px 4px rgba(23,41,74,0.24), inset 0 1px 0 rgba(255,255,255,0.35); }
  .ts-land-scrollcue { color: #24406B; }
  .ts-land-scrollcue-arrow { display: inline-block; animation: ts-land-nudge 1.8s ease-in-out infinite; }
  @keyframes ts-land-nudge { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(4px); } }

  /* Example ticket, gently floating */
  .ts-land-float { animation: ts-land-float 7s ease-in-out infinite; }
  @keyframes ts-land-float { 0%, 100% { transform: translateY(0) rotate(-1.5deg); } 50% { transform: translateY(-12px) rotate(-0.5deg); } }
  .ts-land-ticket {
    display: flex; width: 360px; overflow: hidden;
    border-radius: 16px;
    background: linear-gradient(165deg, rgba(255,255,255,0.95) 0%, rgba(250,248,243,0.86) 100%);
    border: 1px solid rgba(255,255,255,0.8);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 40px 70px -28px rgba(15,23,42,0.6);
  }
  .ts-land-ticket-stub {
    width: 96px; flex-shrink: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: #fff;
    background: linear-gradient(180deg, #3E5D8F 0%, #24406B 60%, #17294A 100%);
  }
  .ts-land-ticket-body { flex: 1; min-width: 0; padding: 16px 18px; border-left: 2px dashed rgba(31,41,55,0.18); }
  .ts-land-example {
    font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    color: #8C6620; background: rgba(184,135,43,0.14);
    padding: 2px 7px; border-radius: 999px;
  }
  .ts-land-dot { width: 9px; height: 9px; border-radius: 999px; background: #E3DFD2; flex-shrink: 0; transition: background 300ms ease, box-shadow 300ms ease; }
  .ts-land-dot.is-done { background: #4F7A6A; }
  .ts-land-dot.is-current { background: #24406B; box-shadow: 0 0 0 4px rgba(36,64,107,0.18); }
  .ts-land-line { flex: 1; height: 2px; margin: 0 3px; background: #E3DFD2; transition: background 300ms ease; }
  .ts-land-line.is-done { background: #4F7A6A; }
  .ts-land-stage { animation: ts-land-fadein 0.35s ease both; }
  @keyframes ts-land-fadein { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }

  /* Scroll reveal */
  [data-reveal] {
    opacity: 0;
    transform: translateY(22px);
    transition: opacity 0.65s ease, transform 0.65s cubic-bezier(0.2, 0.9, 0.3, 1);
    transition-delay: var(--reveal-delay, 0ms);
  }
  [data-reveal][data-revealed] { opacity: 1; transform: none; }

  .ts-land-kicker {
    font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;
    color: #B8872B;
  }

  /* Lifecycle: a ticket travelling along a rail */
  .ts-land-track { position: relative; }
  .ts-land-rail {
    position: absolute; left: 12.5%; right: 12.5%; top: 34px; height: 3px;
    border-radius: 3px;
    background: repeating-linear-gradient(90deg, rgba(31,41,55,0.18) 0 8px, transparent 8px 14px);
  }
  .ts-land-rail-fill {
    position: absolute; left: 0; top: 0; bottom: 0;
    width: calc(var(--progress) * 100%);
    border-radius: 3px;
    background: linear-gradient(90deg, #DCA948, #B8872B);
    transition: width 0.7s cubic-bezier(0.2, 0.9, 0.3, 1);
  }
  .ts-land-marker {
    position: absolute; top: 50%;
    left: calc(var(--progress) * 100%);
    width: 34px; height: 34px; margin: -17px 0 0 -17px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 999px;
    color: #FAF8F3;
    background: linear-gradient(180deg, #DCA948 0%, #B8872B 100%);
    box-shadow: 0 6px 16px rgba(140,102,32,0.45), inset 0 1px 0 rgba(255,255,255,0.5);
    transition: left 0.7s cubic-bezier(0.2, 0.9, 0.3, 1);
    z-index: 2;
  }
  .ts-land-marker svg { width: 16px; height: 16px; }
  .ts-land-steps { position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .ts-land-step {
    width: 100%;
    display: flex; flex-direction: column; align-items: center;
    padding: 0 4px 8px;
    border-radius: 16px;
    cursor: pointer;
    background: transparent;
  }
  .ts-land-step:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(184,135,43,0.6); }
  .ts-land-step-stub {
    width: 68px; height: 68px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 18px;
    font-size: 26px; font-weight: 600;
    color: #5B6474;
    background: linear-gradient(165deg, rgba(255,255,255,0.95) 0%, rgba(250,248,243,0.8) 100%);
    border: 1px solid rgba(227,223,210,0.95);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 22px -14px rgba(31,41,55,0.35);
    transition: color 300ms ease, background 300ms ease, transform 300ms ease, box-shadow 300ms ease;
    position: relative; z-index: 3;
  }
  .ts-land-step.is-reached .ts-land-step-stub {
    color: #fff;
    background: linear-gradient(180deg, #3E5D8F 0%, #24406B 60%, #17294A 100%);
    border-color: rgba(23,41,74,0.6);
  }
  .ts-land-step.is-active .ts-land-step-stub {
    transform: translateY(-4px) scale(1.06);
    box-shadow: 0 0 0 5px rgba(184,135,43,0.28), 0 16px 30px -12px rgba(23,41,74,0.55), inset 0 1px 0 rgba(255,255,255,0.35);
  }
  .ts-land-step:hover .ts-land-step-stub { transform: translateY(-3px); }
  .ts-land-step-label { margin-top: 14px; font-size: 16px; font-weight: 600; color: #1F2937; }
  .ts-land-step-who { margin-top: 2px; font-size: 12px; color: #5B6474; }
  .ts-land-detail {
    text-align: center;
    padding: 22px 24px;
    border-radius: 18px;
    background: linear-gradient(165deg, rgba(255,255,255,0.86) 0%, rgba(250,248,243,0.7) 100%);
    border: 1px solid rgba(255,255,255,0.7);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 18px 36px -24px rgba(31,41,55,0.3);
    animation: ts-land-fadein 0.35s ease both;
  }
  /* Phones: the rail turns vertical, beside a single column of steps. */
  @media (max-width: 639px) {
    .ts-land-rail { left: 33px; right: auto; top: 34px; bottom: 34px; width: 3px; height: auto;
      background: repeating-linear-gradient(180deg, rgba(31,41,55,0.18) 0 8px, transparent 8px 14px); }
    .ts-land-rail-fill { width: auto; right: 0; height: calc(var(--progress) * 100%); bottom: auto;
      transition: height 0.7s cubic-bezier(0.2, 0.9, 0.3, 1);
      background: linear-gradient(180deg, #DCA948, #B8872B); }
    .ts-land-marker { top: calc(var(--progress) * 100%); left: 50%; transition: top 0.7s cubic-bezier(0.2, 0.9, 0.3, 1); }
    .ts-land-steps { grid-template-columns: 1fr; gap: 18px; }
    .ts-land-step { flex-direction: row; align-items: center; gap: 16px; padding: 0; text-align: left; }
    .ts-land-step-label { margin-top: 0; }
    .ts-land-step-who { margin-top: 0; margin-left: auto; padding-right: 4px; }
  }

  /* Feature cards */
  .ts-land-feature {
    padding: 26px 24px;
    border-radius: 18px;
    background: linear-gradient(165deg, rgba(255,255,255,0.9) 0%, rgba(250,248,243,0.72) 100%);
    border: 1px solid rgba(255,255,255,0.7);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.85), 0 16px 32px -22px rgba(31,41,55,0.3);
  }
  .ts-land-feature[data-revealed] { transition: opacity 0.65s ease, transform 0.25s ease, box-shadow 0.25s ease; transition-delay: var(--reveal-delay, 0ms), 0ms, 0ms; }
  .ts-land-feature[data-revealed]:hover { transform: translateY(-4px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 26px 44px -24px rgba(31,41,55,0.38); }
  .ts-land-feature-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 48px; height: 48px; border-radius: 14px;
    color: #FAF8F3;
    background: linear-gradient(180deg, #3E5D8F 0%, #24406B 60%, #17294A 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 8px 18px -8px rgba(23,41,74,0.5);
  }
  .ts-land-feature-icon svg { width: 22px; height: 22px; }
  .ts-land-soon {
    font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    color: #8C6620; background: rgba(184,135,43,0.14); border: 1px solid rgba(184,135,43,0.35);
    padding: 2px 8px; border-radius: 999px;
  }

  /* CTA band */
  .ts-land-band {
    display: flex; flex-direction: column; gap: 22px;
    padding: 32px 28px;
    border-radius: 24px;
    background: linear-gradient(135deg, #35548F 0%, #24406B 55%, #17294A 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 30px 60px -30px rgba(23,41,74,0.7);
  }
  @media (min-width: 768px) { .ts-land-band { flex-direction: row; align-items: center; justify-content: space-between; padding: 40px 44px; } }
  .ts-land-btn-light {
    border-radius: 10px;
    color: #17294A;
    background: linear-gradient(180deg, #FFFFFF 0%, #EFEBE1 100%);
    border: 1px solid rgba(255,255,255,0.9);
    box-shadow: 0 10px 22px -8px rgba(0,0,0,0.4), inset 0 1px 0 #FFFFFF;
    transition: transform 80ms ease, filter 150ms ease;
  }
  .ts-land-btn-light:hover { filter: brightness(1.03); }
  .ts-land-btn-light:active { transform: translateY(1px); box-shadow: inset 0 2px 6px rgba(0,0,0,0.2); }
  .ts-land-btn-outline {
    border-radius: 10px;
    color: #FAF8F3;
    border: 1px solid rgba(250,248,243,0.4);
    background: rgba(250,248,243,0.06);
    transition: background 150ms ease;
  }
  .ts-land-btn-outline:hover { background: rgba(250,248,243,0.14); }
  .ts-land-btn-light:focus-visible, .ts-land-btn-outline:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(228,180,92,0.75); }

  /* Footer */
  .ts-land-footer { background: linear-gradient(180deg, #1B2F52 0%, #13223D 100%); }
  .ts-land-footer-head { font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #E4B45C; }
  .ts-land-footer-link {
    display: inline-flex; align-items: center; min-height: 40px;
    color: rgba(250,248,243,0.85);
  }
  .ts-land-footer-link:hover { color: #FFFFFF; text-decoration: underline; }
  .ts-land-footer-link:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(228,180,92,0.7); border-radius: 4px; }

  /* Everything above, stilled for reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .ts-land-photo { transform: none; }
    .ts-land-photo-inner, .ts-land-blob, .ts-land-float, .ts-land-scrollcue-arrow,
    .ts-land-hero-card, .ts-land-stage, .ts-land-detail { animation: none; }
    [data-reveal] { opacity: 1; transform: none; transition: none; }
    .ts-land-rail-fill, .ts-land-marker, .ts-land-step-stub, .ts-land-dot, .ts-land-line { transition: none; }
    .ts-land-step.is-active .ts-land-step-stub, .ts-land-step:hover .ts-land-step-stub,
    .ts-land-feature[data-revealed]:hover { transform: none; }
  }
`;

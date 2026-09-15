import { SHARED_CSS } from '../../styles/authCss.js';
import { FONT_SANS } from '../../styles/fonts.js';

// The split-screen auth scene: photo on the right, glass fading into it on the left, content on the glass.
export function GlassScene({ children, maxWidth = '420px', variant = 'student' }) {
  return (
    <div
      className={`ts-page relative flex min-h-screen w-full flex-col lg:flex-row ${variant === 'staff' ? 'ts-scene-staff' : ''}`}
      style={FONT_SANS}
    >
      <style>{SHARED_CSS}</style>

      <div className="ts-photo" aria-hidden="true" />
      <div className="ts-photo-tint" aria-hidden="true" />
      <div className="ts-glass ts-glass-a" aria-hidden="true" />
      <div className="ts-glass ts-glass-b" aria-hidden="true" />
      <div className="ts-glass ts-glass-c" aria-hidden="true" />

      {/* Narrow viewports: photo banner across the top. */}
      <div className="h-[30vh] shrink-0 lg:hidden" aria-hidden="true" />

      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:w-[42%] lg:flex-none lg:px-12 lg:py-16 xl:px-16">
        <div className="mx-auto w-full" style={{ maxWidth }}>
          {children}
        </div>
      </div>

      <div className="hidden lg:block lg:flex-1" aria-hidden="true" />
    </div>
  );
}

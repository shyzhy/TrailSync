import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `--mode mobile` builds the student app that Capacitor wraps: its own entry and output folder, so the website's
// `npm run dev` and `npm run build` are untouched.
export default defineConfig(({ mode }) => {
  const mobile = mode === 'mobile';
  return {
    plugins: [react(), tailwindcss(), mobile && mobileEntry()],
    build: mobile ? { outDir: 'dist-mobile', emptyOutDir: true } : {},
  };
});

// Boots src/mobile/main.jsx instead of the website's entry, and lets the page draw under the phone's system bars.
function mobileEntry() {
  return {
    name: 'trailsync-mobile-entry',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html
          .replace('/src/main.jsx', '/src/mobile/main.jsx')
          .replace('initial-scale=1.0"', 'initial-scale=1.0, viewport-fit=cover"')
          .replace('<title>TrailSync · Login</title>', '<title>TrailSync</title>'),
    },
  };
}

// True only in the student mobile app build (`vite build --mode mobile`). Vite inlines the mode, so code behind a
// false check is dropped from that bundle entirely rather than just skipped at runtime.
export const IS_MOBILE_APP = import.meta.env.MODE === 'mobile';

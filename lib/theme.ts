const rgb = (h: string) => h.match(/[\da-f]{2}/gi)!.map((x) => parseInt(x, 16));
const luminance = (c: number[]) =>
  c
    .map((v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a: number[], b: number[]) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'profile-theme';
// Runs synchronously in the document head, before the first body paint.
// Only a fixed storage key is interpolated; no user-provided script content.
export const themeBootstrap = `(()=>{const root=document.documentElement;let theme=root.dataset.theme==='dark'?'dark':'light';try{const saved=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(saved==='light'||saved==='dark')theme=saved;}catch{}root.dataset.theme=theme;root.style.colorScheme=theme;})();`;
export function readTheme(fallback: string = 'light'): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* The server-provided theme works without storage. */
  }
  return fallback === 'dark' ? 'dark' : 'light';
}
export function saveTheme(accent: string, theme: Theme) {
  applyTheme(accent, theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Optional preference. */
  }
}
export function applyTheme(accent: string, theme: string) {
  const color = /^#[\da-f]{6}$/i.test(accent) ? accent : '#4264da',
    base = rgb(color),
    bg = theme === 'dark' ? [36, 43, 59] : [255, 255, 255];
  let text = [...base];
  const towards = theme === 'dark' ? 255 : 0;
  for (let i = 0; i < 30 && ratio(text, bg) < 4.5; i++)
    text = text.map((v) => Math.round(v + (towards - v) * 0.12));
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.style.setProperty('--accent', color);
  root.style.setProperty('--link-color', `rgb(${text.join(',')})`);
  root.style.setProperty(
    '--primary-ink',
    ratio(base, [255, 255, 255]) >= 4.5 ? '#ffffff' : '#000000',
  );
}

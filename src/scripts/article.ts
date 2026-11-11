/**
 * Progressive enhancement for article pages. Everything here is optional:
 * without JS the article is still fully readable.
 *  - reading progress (article body only)
 *  - active table-of-contents section
 *  - copy buttons for code blocks
 *  - reader preferences (size / width)
 */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const article = document.querySelector<HTMLElement>('#article-body');

/* ---------- Progress + active TOC section (one rAF-throttled scroll handler) ---------- */
const bar = document.querySelector<HTMLElement>('[data-reading-progress]');
const tocLinks = [...document.querySelectorAll<HTMLAnchorElement>('.toc a[href^="#"]')];
const headings = article
  ? [...article.querySelectorAll<HTMLElement>('h2[id], h3[id]')]
  : [];

let ticking = false;
function update() {
  if (!article) return;
  const rect = article.getBoundingClientRect();
  const top = rect.top + scrollY;
  const end = top + rect.height;

  if (bar) {
    const span = end - innerHeight - top;
    const p = span > 0 ? (scrollY - top) / span : scrollY + innerHeight >= end - 4 ? 1 : 0;
    bar.style.setProperty('--p', String(Math.min(1, Math.max(0, p))));
  }

  if (tocLinks.length && headings.length) {
    // The active section is the last heading that has passed the top ~third of the viewport.
    const line = innerHeight * 0.3;
    let current: HTMLElement | undefined;
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= line) current = h;
      else break;
    }
    // At the very bottom, the final section is active even if it is too short to reach the line.
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) current = headings[headings.length - 1];
    const id = current?.id;
    for (const a of tocLinks) {
      if (a.hash.slice(1) === id) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    }
  }
}
// Run once per frame, but never rely on rAF alone: it is paused in background tabs and some
// embedded views, which would otherwise leave the progress bar and TOC highlight stuck.
const run = () => {
  if (!ticking) return;
  ticking = false;
  update();
};
const schedule = () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(run);
  setTimeout(run, 100);
};
addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', schedule);
if (article && 'ResizeObserver' in window) new ResizeObserver(schedule).observe(article);
update();

/* ---------- Copy buttons ---------- */
const status = document.querySelector<HTMLElement>('#copy-status');
document.querySelectorAll<HTMLButtonElement>('.code-copy').forEach((b) => (b.hidden = false));

function legacyCopy(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.append(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy failed');
}

// Clipboard API first; fall back to execCommand where it is unavailable or denied.
async function copyText(text: string) {
  try {
    if (!navigator.clipboard) throw new Error('no clipboard api');
    await navigator.clipboard.writeText(text);
  } catch {
    legacyCopy(text);
  }
}

// The button holds three icons (shown per data-state) plus a text label.
const setLabel = (btn: HTMLButtonElement, label: string) => {
  const el = btn.querySelector('.code-copy__label');
  if (el) el.textContent = label;
};

const timers = new WeakMap<HTMLButtonElement, number>();
document.addEventListener('click', async (e) => {
  const btn = (e.target as Element).closest<HTMLButtonElement>('.code-copy');
  if (!btn) return;
  const pre = btn.closest('.code-block')?.querySelector('pre');
  if (!pre) return;
  const label = btn.closest('.code-block')?.querySelector('.code-block__label')?.textContent ?? 'code';
  let state: 'copied' | 'failed' = 'copied';
  try {
    await copyText((pre.textContent ?? '').replace(/\n$/, ''));
  } catch {
    state = 'failed';
  }
  btn.dataset.state = state;
  setLabel(btn, state === 'copied' ? 'Copied' : 'Copy failed');
  if (status) status.textContent = state === 'copied' ? `${label} code copied to clipboard` : `Could not copy ${label} code`;
  clearTimeout(timers.get(btn));
  timers.set(btn, window.setTimeout(() => {
    delete btn.dataset.state;
    setLabel(btn, 'Copy');
    if (status) status.textContent = '';
  }, 2200));
});

/* ---------- Reader preferences ---------- */
const prefsRoot = document.querySelector<HTMLElement>('[data-prefs]');
if (prefsRoot) {
  prefsRoot.hidden = false;
  const root = document.documentElement;
  const read = (): Record<string, string> => {
    try { return JSON.parse(localStorage.getItem('reading') || '{}'); } catch { return {}; }
  };
  const write = (v: Record<string, string>) => {
    try { localStorage.setItem('reading', JSON.stringify(v)); } catch { /* storage unavailable */ }
  };
  const sync = () => {
    const state = read();
    const known: Record<string, string[]> = { size: ['sm', 'lg'], width: ['narrow', 'full'] };
    for (const kind of ['size', 'width'] as const) {
      // Ignore anything saved by an older version (e.g. width "wide") and fall back to the default.
      const saved = state[kind];
      const value = saved && known[kind].includes(saved) ? saved : 'md';
      if (value === 'md') root.removeAttribute(`data-${kind}`);
      else root.setAttribute(`data-${kind}`, value);
      prefsRoot.querySelectorAll<HTMLButtonElement>(`[data-pref="${kind}"]`).forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.value === value)),
      );
    }
    schedule();
  };
  prefsRoot.addEventListener('click', (e) => {
    const t = e.target as Element;
    const b = t.closest<HTMLButtonElement>('[data-pref]');
    if (b) {
      const state = read();
      state[b.dataset.pref!] = b.dataset.value!;
      write(state);
      sync();
    } else if (t.closest('[data-prefs-reset]')) {
      try { localStorage.removeItem('reading'); } catch { /* ignore */ }
      sync();
    }
  });
  const details = prefsRoot.querySelector('details')!;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && details.open) { details.open = false; details.querySelector('summary')?.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (details.open && !prefsRoot.contains(e.target as Node)) details.open = false;
  });
  sync();
}
void reduceMotion; // smooth scrolling is handled purely in CSS behind prefers-reduced-motion

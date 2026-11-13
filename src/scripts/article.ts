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
const rootEl = document.documentElement;
const wide = matchMedia('(min-width: 1280px)');
// The article body is its own scroll container on wide screens, and in reading mode on any screen.
const innerScroll = () => wide.matches || rootEl.classList.contains('reading-mode');
function update() {
  if (!article) return;
  const reading = innerScroll();
  const rect = article.getBoundingClientRect();
  const top = rect.top + scrollY;
  const end = top + rect.height;

  if (bar) {
    let p: number;
    if (reading) {
      const span = article.scrollHeight - article.clientHeight;
      p = span > 0 ? article.scrollTop / span : 1;
    } else {
      const span = end - innerHeight - top;
      p = span > 0 ? (scrollY - top) / span : scrollY + innerHeight >= end - 4 ? 1 : 0;
    }
    bar.style.setProperty('--p', String(Math.min(1, Math.max(0, p))));
  }

  if (tocLinks.length && headings.length) {
    // The active section is the last heading that has passed the top ~third of the viewport (or of the reading pane).
    const line = reading ? rect.top + article.clientHeight * 0.3 : innerHeight * 0.3;
    let current: HTMLElement | undefined;
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= line) current = h;
      else break;
    }
    // At the very bottom, the final section is active even if it is too short to reach the line.
    const atEnd = reading
      ? article.scrollTop + article.clientHeight >= article.scrollHeight - 2
      : innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    if (atEnd) current = headings[headings.length - 1];
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
wide.addEventListener('change', schedule);
article?.addEventListener('scroll', schedule, { passive: true });
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

/* ---------- Share ---------- */
const shareRoot = document.querySelector<HTMLElement>('[data-share]');
if (shareRoot) {
  const shareUrl = shareRoot.dataset.url || location.href;
  const shareTitle = shareRoot.dataset.title || document.title;
  const nativeBtn = shareRoot.querySelector<HTMLButtonElement>('[data-share-native]');
  const copyBtn = shareRoot.querySelector<HTMLButtonElement>('[data-share-copy]');

  if (nativeBtn && typeof navigator.share === 'function') {
    nativeBtn.hidden = false;
    nativeBtn.addEventListener('click', async () => {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl });
      } catch { /* dismissed by the user */ }
    });
  }

  if (copyBtn) {
    copyBtn.hidden = false;
    let timer: number | undefined;
    copyBtn.addEventListener('click', async () => {
      let ok = true;
      try { await copyText(shareUrl); } catch { ok = false; }
      if (ok) copyBtn.dataset.state = 'copied';
      if (status) status.textContent = ok ? 'Link copied to clipboard' : 'Could not copy link';
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        delete copyBtn.dataset.state;
        if (status) status.textContent = '';
      }, 2200);
    });
  }
}

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

  /* ---------- Reading mode: blur everything but the article (styles live in article.css) ---------- */
  const modeBtn = prefsRoot.querySelector<HTMLButtonElement>('[data-reading-mode]');
  const modeLabel = prefsRoot.querySelector<HTMLElement>('[data-reading-mode-label]');
  let animTimer: number | undefined;

  // "Press ESC to exit" hint: shown for a moment once reading mode has finished loading (2s transition + 0.5s),
  // then only while the pointer is over the article.
  const hint = document.querySelector<HTMLElement>('.reading-hint');
  const articleCard = document.querySelector<HTMLElement>('.article-main');
  let intro = false;
  let hovering = false;
  let introTimer: number | undefined;
  const renderHint = () => {
    if (!hint) return;
    const visible = root.classList.contains('reading-mode') && (intro || hovering);
    hint.classList.toggle('is-quick', !intro); // the intro uses the page's 2s ease; hover in/out is quicker
    hint.classList.toggle('is-visible', visible);
  };
  articleCard?.addEventListener('mouseenter', () => { hovering = true; renderHint(); });
  articleCard?.addEventListener('mouseleave', () => { hovering = false; renderHint(); });

  const setReadingMode = (on: boolean) => {
    clearTimeout(introTimer);
    intro = on;
    if (on) {
      // The pointer is usually still over the card (the toggle lives in it), so require a fresh hover to bring the hint back.
      hovering = false;
      introTimer = window.setTimeout(() => { intro = false; renderHint(); }, 2500);
    }
    // rm-anim enables the 2s colour cross-fade only while switching, so normal hover effects stay snappy.
    root.classList.add('rm-anim');
    clearTimeout(animTimer);
    animTimer = window.setTimeout(() => root.classList.remove('rm-anim'), 2100);
    // Hand the reading position over between the page scroll and the article's own scroll, so nothing jumps.
    const gap = (document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 0) + 16;
    // On wide screens the article scrolls inside the card either way, so there is no position to hand over.
    const handOver = !!article && !wide.matches;
    const carried = !handOver ? 0 : on
      ? Math.max(0, gap - article!.getBoundingClientRect().top)
      : article!.scrollTop;
    root.classList.toggle('reading-mode', on);
    if (handOver) {
      if (on) {
        article!.scrollTop = carried;
        scrollTo({ top: 0, behavior: 'instant' });
      } else {
        scrollTo({ top: Math.max(0, article!.getBoundingClientRect().top + scrollY - gap + carried), behavior: 'instant' });
      }
    }
    schedule();
    modeBtn?.setAttribute('aria-pressed', String(on));
    if (modeLabel) modeLabel.textContent = on ? 'Exit reading mode' : 'Reading mode';
    if (status) status.textContent = on ? 'Reading mode on. Press Escape to exit.' : 'Reading mode off';
    renderHint();
  };
  modeBtn?.addEventListener('click', () => setReadingMode(!root.classList.contains('reading-mode')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('reading-mode') && !details.open) setReadingMode(false);
  });
}
void reduceMotion; // smooth scrolling is handled purely in CSS behind prefers-reduced-motion

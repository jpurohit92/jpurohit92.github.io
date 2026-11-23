/* Image zoom (site-wide): hover an article image to reveal an expand button; click the image or the
   button to view it full screen. Applies to every image inside `.prose` plus any <img data-zoomable>.
   Skips images that are already links. Styles live in global.css (.zoom-wrap, .lightbox). */

const SELECTOR = '.prose img, img[data-zoomable]';
const ICON_EXPAND =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="currentColor"><path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v3.5a.75.75 0 0 1-1.5 0v-3.5C2 2.784 2.784 2 3.75 2Zm6.5 0h3.5c.966 0 1.75.784 1.75 1.75v3.5a.75.75 0 0 1-1.5 0v-3.5a.25.25 0 0 0-.25-.25h-3.5a.75.75 0 0 1 0-1.5ZM2.75 9a.75.75 0 0 1 .75.75v3.5c0 .138.112.25.25.25h3.5a.75.75 0 0 1 0 1.5h-3.5A1.75 1.75 0 0 1 2 13.25v-3.5A.75.75 0 0 1 2.75 9Zm10.5 0a.75.75 0 0 1 .75.75v3.5A1.75 1.75 0 0 1 12.25 15h-3.5a.75.75 0 0 1 0-1.5h3.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 .75-.75Z"/></svg>';
const ICON_CLOSE =
  '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" focusable="false" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>';

const images = Array.from(document.querySelectorAll<HTMLImageElement>(SELECTOR)).filter(
  (img) => !img.closest('a') && !img.closest('.zoom-wrap'),
);

if (images.length > 0) {
  let lightbox: HTMLDivElement | null = null;
  let lightboxImg: HTMLImageElement;
  let closeBtn: HTMLButtonElement;
  let opener: HTMLElement | null = null;

  const isOpen = () => !!lightbox && !lightbox.hidden;

  const build = () => {
    lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.hidden = true;
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.innerHTML = `<button type="button" class="lightbox__close" aria-label="Close full-screen image">${ICON_CLOSE}</button><img class="lightbox__img" alt="" />`;
    lightboxImg = lightbox.querySelector('.lightbox__img')!;
    closeBtn = lightbox.querySelector('.lightbox__close')!;
    // Clicking anywhere except the image itself (backdrop or the close button) closes it.
    lightbox.addEventListener('click', (e) => {
      if (e.target !== lightboxImg) close();
    });
    document.body.appendChild(lightbox);
  };

  const open = (img: HTMLImageElement, trigger: HTMLElement) => {
    if (!lightbox) build();
    opener = trigger;
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt;
    // Size the image to fill the screen (aspect ratio kept, upscaled at most 3x); see .lightbox__img in global.css.
    const nw = img.naturalWidth || Number(img.getAttribute('width')) || img.width;
    const nh = img.naturalHeight || Number(img.getAttribute('height')) || img.height;
    lightboxImg.style.setProperty('--ar', String(nw && nh ? nw / nh : 1.5));
    lightboxImg.style.setProperty('--max-w', `${(nw || 1000) * 3}px`);
    lightbox!.setAttribute('aria-label', 'Full-screen image');
    lightbox!.hidden = false;
    document.documentElement.classList.add('lightbox-open');
    void lightbox!.offsetWidth; // force a reflow so the opacity transition runs
    lightbox!.classList.add('is-open');
    closeBtn.focus();
  };

  const close = () => {
    if (!isOpen()) return;
    lightbox!.classList.remove('is-open');
    lightbox!.hidden = true;
    lightboxImg.removeAttribute('src');
    document.documentElement.classList.remove('lightbox-open');
    opener?.focus();
    opener = null;
  };

  // Capture phase: while the viewer is open, Escape closes it and does not also exit reading mode.
  document.addEventListener(
    'keydown',
    (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === 'Tab') {
        // Only one focusable control in the dialog: keep focus on it.
        e.preventDefault();
        closeBtn.focus();
      }
    },
    true,
  );

  for (const img of images) {
    const wrap = document.createElement('span');
    wrap.className = 'zoom-wrap';
    img.replaceWith(wrap);
    wrap.appendChild(img);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'zoom-btn';
    btn.setAttribute('aria-label', 'View image full screen');
    btn.innerHTML = ICON_EXPAND;
    wrap.appendChild(btn);

    btn.addEventListener('click', () => open(img, btn));
    img.addEventListener('click', () => open(img, btn));
  }
}

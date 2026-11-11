/**
 * Octicons (GitHub Primer) helpers. Icons are flat, single-colour glyphs that inherit
 * `currentColor`, so they follow the text colour in light/dark mode and on hover.
 * Used by <Icon /> (Astro) and by the Shiki code-block transformer (hast).
 */
import { createRequire } from 'node:module';

const octicons = createRequire(import.meta.url)('@primer/octicons');

/**
 * Brand marks Octicons doesn't have (only GitHub's is included there). Single-colour, 24x24 viewBox.
 * LinkedIn "in" bug: official glyph shape, drawn in currentColor.
 */
export const BRAND_ICONS = {
  linkedin:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
};

/** Returns the SVG `d` path data for an icon at 16 or 24 px. */
export function iconPath(name, size = 16) {
  const icon = octicons[name];
  if (!icon) throw new Error(`Unknown octicon "${name}"`);
  const glyph = icon.heights[size] ?? icon.heights[16];
  // `path` is a string of one or more <path d="..."/> elements; keep the raw markup.
  return glyph.path;
}

/** Octicon as a hast element (for build-time transformers). */
export function iconHast(name, className = [], size = 16) {
  const markup = iconPath(name, size);
  const paths = [...markup.matchAll(/<path\b([^>]*?)\/?>/g)].map((m) => {
    const properties = {};
    for (const a of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) {
      const key = a[1] === 'fill-rule' ? 'fillRule' : a[1] === 'clip-rule' ? 'clipRule' : a[1];
      properties[key] = a[2];
    }
    return { type: 'element', tagName: 'path', properties, children: [] };
  });
  return {
    type: 'element',
    tagName: 'svg',
    properties: {
      className: ['octicon', ...className],
      viewBox: `0 0 ${size} ${size}`,
      width: size,
      height: size,
      fill: 'currentColor',
      ariaHidden: 'true',
      focusable: 'false',
    },
    children: paths,
  };
}

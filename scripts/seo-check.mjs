#!/usr/bin/env node
// SEO validation for the built site (dist/) and the blog content metadata.
//
//   npm run build && npm run seo:check          # errors fail the run, recommendations do not
//   npm run seo:check -- --strict               # recommendations fail the run too
//
// Errors are hard technical problems (missing canonical, broken link, draft in the sitemap...).
// Recommendations are editorial advice (title length, thin posts, no internal links...).
// No dependencies: Node built-ins plus the shared config in src/lib.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { SEO } from '../src/lib/seo-config.mjs';
import { readBlogPosts } from '../src/lib/frontmatter.mjs';
import taxonomy from '../src/data/taxonomy.json' with { type: 'json' };

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const STRICT = process.argv.includes('--strict');
const ORIGIN = new URL(SEO.siteUrl).origin;
const { titleMax, descriptionMin, descriptionMax } = SEO.limits;

const errors = [];
const warnings = [];
const error = (where, code, message) => errors.push({ where, code, message });
const warn = (where, code, message) => warnings.push({ where, code, message });

if (!existsSync(DIST)) {
  console.error('seo:check: dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

// ---------- tiny HTML helpers (the output is Astro-generated, well-formed static HTML) ----------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
const text = (html) => decode(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const words = (s) => (s.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    if (m.index === 0) continue; // tag name
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}
const tagsOf = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => attrs(m[0]));

// ---------- load pages ----------
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const distFiles = walk(DIST).map((f) => f.slice(DIST.length).replace(/\\/g, '/'));
const fileSet = new Set(distFiles);

const urlPathOf = (file) => (file === '/index.html' ? '/' : file.endsWith('/index.html') ? file.slice(0, -'index.html'.length) : file);

const pages = distFiles
  .filter((f) => f.endsWith('.html'))
  .map((file) => {
    const html = readFileSync(join(DIST, file), 'utf8');
    const headEnd = html.indexOf('</head>');
    const head = headEnd === -1 ? html : html.slice(0, headEnd); // Astro's redirect stubs have no </head>
    const body = headEnd === -1 ? html : html.slice(headEnd);
    const stripped = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    const metas = tagsOf(head, 'meta');
    const meta = (key) => metas.filter((m) => m.name === key || m.property === key).map((m) => m.content ?? '');
    const robots = meta('robots').join(',').toLowerCase();
    const jsonLd = [...head.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
    return {
      file,
      urlPath: urlPathOf(file),
      html,
      head,
      body: stripped,
      title: (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim(),
      lang: html.match(/<html[^>]*\blang=["']?([\w-]+)/i)?.[1],
      description: meta('description')[0],
      canonicals: tagsOf(head, 'link').filter((l) => l.rel === 'canonical').map((l) => l.href),
      noindex: robots.includes('noindex'),
      redirect: tagsOf(head, 'meta').find((m) => m['http-equiv']?.toLowerCase() === 'refresh')?.content?.match(/url=(\S+)/i)?.[1],
      meta,
      jsonLd,
      headings: [...stripped.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ level: Number(m[1]), text: text(m[2]) })),
      ids: new Set([...html.matchAll(/\sid=["']?([^\s"'>]+)/g)].map((m) => m[1])),
    };
  });
const pageByPath = new Map(pages.map((p) => [p.urlPath, p]));
const is404 = (p) => p.file === '/404.html';
const redirects = pages.filter((p) => p.redirect);
const indexable = pages.filter((p) => !p.noindex && !is404(p) && !p.redirect);

// ---------- blog content (source of truth for published/draft/noindex/canonical) ----------
const posts = readBlogPosts(ROOT);
const published = posts.filter((p) => !p.draft);
const postPath = (p) => `/blog/${p.id}/`;
const postByPath = new Map(published.map((p) => [postPath(p), p]));
const categories = new Set(taxonomy.categories.map((c) => c.name));
const tags = new Set(taxonomy.tags);
const today = new Date().toISOString().slice(0, 10);

// ---------- helpers ----------
const isoDay = (v) => (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);
const validDate = (v) => /^\d{4}-\d{2}-\d{2}/.test(String(v)) && !Number.isNaN(Date.parse(String(v)));
const isAbsoluteUrl = (v) => {
  try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; }
};
/** Resolve a link to a file in dist. Returns { path, exists, hasSlash } or null when external. */
function resolveInternal(href, fromPath) {
  if (!href || /^(mailto:|tel:|javascript:|data:)/i.test(href)) return null;
  let u;
  try { u = new URL(href, `${ORIGIN}${fromPath}`); } catch { return { broken: true, path: href }; }
  if (u.origin !== ORIGIN) return null;
  const hasSlash = u.pathname.endsWith('/') || extname(u.pathname) !== '';
  const clean = hasSlash ? u.pathname : `${u.pathname}/`;
  const exists = fileSet.has(clean.endsWith('/') ? `${clean}index.html` : clean) || (extname(clean) !== '' && fileSet.has(clean));
  return { path: clean, hash: u.hash.slice(1), hasSlash, exists };
}

// ---------- per-page checks ----------
const inbound = new Map(); // path -> Set of pages linking to it
const titles = new Map();
const descriptions = new Map();

for (const p of pages) {
  const where = p.file;
  if (p.redirect) {
    // Static redirect for a retired URL: the target must exist; nothing else applies.
    const target = resolveInternal(p.redirect, p.urlPath);
    if (!target || !target.exists) error(where, 'REDIRECT_BROKEN', `Redirects to ${p.redirect}, which does not exist.`);
    else if (pageByPath.get(target.path)?.redirect) error(where, 'REDIRECT_CHAIN', `Redirects to ${p.redirect}, which is itself a redirect.`);
    continue;
  }
  const page404 = is404(p);
  const post = postByPath.get(p.urlPath);
  const isArticle = Boolean(post);

  if (!p.lang) error(where, 'HTML_LANG', 'Missing lang attribute on <html>.');
  if (!p.meta('viewport').length) error(where, 'VIEWPORT', 'Missing <meta name="viewport">.');

  // Titles
  if (!p.title) error(where, 'TITLE_MISSING', 'Missing or empty <title>.');
  else if (!page404) {
    if (p.title.length > titleMax) warn(where, 'TITLE_LONG', `<title> is ${p.title.length} characters (recommended ≤ ${titleMax}); search results may truncate it.${isArticle ? ' Set `seoTitle` in the post frontmatter for a shorter search title.' : ''}`);
    if (!p.noindex) titles.set(p.title, [...(titles.get(p.title) ?? []), where]);
  }

  // Descriptions
  if (!p.description?.trim()) error(where, 'DESC_MISSING', 'Missing meta description.');
  else if (!page404) {
    const n = p.description.length;
    if (n < descriptionMin || n > descriptionMax) warn(where, 'DESC_LENGTH', `Meta description is ${n} characters (recommended ${descriptionMin}-${descriptionMax}).`);
    if (!p.noindex) descriptions.set(p.description, [...(descriptions.get(p.description) ?? []), where]);
  }

  // H1 and heading structure
  const h1s = p.headings.filter((h) => h.level === 1);
  if (h1s.length === 0) error(where, 'H1_MISSING', 'Page has no <h1>.');
  if (h1s.length > 1) error(where, 'H1_MULTIPLE', `Page has ${h1s.length} <h1> elements: ${h1s.map((h) => `"${h.text}"`).join(', ')}.`);
  if (h1s.some((h) => !h.text)) error(where, 'H1_EMPTY', '<h1> has no text.');
  let prev = 0;
  for (const h of p.headings) {
    if (prev && h.level > prev + 1) warn(where, 'HEADING_SKIP', `Heading level jumps from h${prev} to h${h.level} ("${h.text}").`);
    prev = h.level;
  }

  // Canonical
  if (!p.noindex && !page404) {
    const expected = post?.data.canonical || `${ORIGIN}${p.urlPath}`;
    if (p.canonicals.length === 0) error(where, 'CANONICAL_MISSING', 'Missing <link rel="canonical">.');
    else if (p.canonicals.length > 1) error(where, 'CANONICAL_MULTIPLE', `${p.canonicals.length} canonical links found.`);
    else if (!isAbsoluteUrl(p.canonicals[0])) error(where, 'CANONICAL_RELATIVE', `Canonical must be absolute: ${p.canonicals[0]}`);
    else if (p.canonicals[0] !== expected) error(where, 'CANONICAL_MISMATCH', `Canonical is ${p.canonicals[0]} but expected ${expected}.`);
  }

  // Open Graph / Twitter
  if (!page404 && !p.noindex) {
    for (const key of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'twitter:card']) {
      if (!p.meta(key).filter(Boolean).length) error(where, 'OG_MISSING', `Missing <meta ${key}>.`);
    }
    const [ogUrl] = p.meta('og:url');
    if (ogUrl && p.canonicals[0] && ogUrl !== p.canonicals[0]) error(where, 'OG_URL_MISMATCH', `og:url (${ogUrl}) differs from the canonical (${p.canonicals[0]}).`);
    const [ogImage] = p.meta('og:image');
    if (ogImage) {
      if (!isAbsoluteUrl(ogImage)) error(where, 'OG_IMAGE_RELATIVE', `og:image must be an absolute URL: ${ogImage}`);
      else {
        const local = resolveInternal(ogImage, p.urlPath);
        if (local && !local.exists) error(where, 'OG_IMAGE_MISSING', `og:image points to a file that is not in the build: ${ogImage}`);
      }
      if (!p.meta('og:image:alt').length) warn(where, 'OG_IMAGE_ALT', 'og:image has no og:image:alt.');
    }
    const [card] = p.meta('twitter:card');
    if (card && !['summary', 'summary_large_image'].includes(card)) error(where, 'TWITTER_CARD', `Unexpected twitter:card "${card}".`);
  }
  if (isArticle) {
    if (p.meta('og:type')[0] !== 'article') error(where, 'OG_TYPE', 'Blog posts must use og:type "article".');
    if (!p.meta('article:published_time').length) error(where, 'OG_PUBLISHED', 'Missing article:published_time.');
    if (post.data.updated && isoDay(post.data.updated) !== isoDay(post.data.date) && !p.meta('article:modified_time').length) {
      error(where, 'OG_MODIFIED', 'Post has an `updated` date but no article:modified_time.');
    }
  }

  // JSON-LD
  const nodes = [];
  p.jsonLd.forEach((raw, i) => {
    let doc;
    try { doc = JSON.parse(raw); } catch (e) { return error(where, 'JSONLD_INVALID', `JSON-LD block #${i + 1} is not valid JSON: ${e.message}`); }
    for (const d of Array.isArray(doc) ? doc : [doc]) {
      if (!String(d['@context'] ?? '').includes('schema.org')) error(where, 'JSONLD_CONTEXT', `JSON-LD block #${i + 1} has no schema.org @context.`);
      for (const n of d['@graph'] ?? [d]) {
        if (!n['@type']) error(where, 'JSONLD_TYPE', `JSON-LD block #${i + 1} has a node without @type.`);
        else nodes.push(n);
      }
    }
  });
  const ofType = (t) => nodes.filter((n) => [].concat(n['@type']).includes(t));
  if (p.urlPath === '/') {
    if (!ofType('WebSite').length) error(where, 'JSONLD_WEBSITE', 'Home page is missing WebSite structured data.');
    if (!ofType('Person').length) error(where, 'JSONLD_PERSON', 'Home page is missing Person structured data.');
  }
  for (const n of ofType('Person')) {
    if (!n.name) error(where, 'JSONLD_PERSON', 'Person has no name.');
    for (const url of n.sameAs ?? []) if (!isAbsoluteUrl(url)) error(where, 'JSONLD_SAMEAS', `Person.sameAs contains an invalid URL: ${url}`);
  }
  for (const b of ofType('BreadcrumbList')) {
    (b.itemListElement ?? []).forEach((item, i) => {
      if (item.position !== i + 1) error(where, 'JSONLD_BREADCRUMB', `BreadcrumbList position ${item.position} should be ${i + 1}.`);
      const target = resolveInternal(item.item, p.urlPath);
      if (!item.name) error(where, 'JSONLD_BREADCRUMB', `BreadcrumbList item ${i + 1} has no name.`);
      if (!target || !target.exists) error(where, 'JSONLD_BREADCRUMB', `BreadcrumbList item ${i + 1} does not resolve to a page: ${item.item}`);
    });
  }
  if (isArticle) {
    const [bp] = ofType('BlogPosting');
    if (!bp) error(where, 'JSONLD_BLOGPOSTING', 'Blog post is missing BlogPosting structured data.');
    else {
      for (const k of ['headline', 'description', 'author', 'datePublished', 'mainEntityOfPage']) {
        if (!bp[k]) error(where, 'JSONLD_BLOGPOSTING', `BlogPosting is missing "${k}".`);
      }
      if (bp.headline && bp.headline !== h1s[0]?.text) error(where, 'JSONLD_MISMATCH', `BlogPosting headline "${bp.headline}" differs from the visible <h1> "${h1s[0]?.text}".`);
      if (bp.author?.name && !text(p.body).includes(bp.author.name)) error(where, 'JSONLD_MISMATCH', `BlogPosting author "${bp.author.name}" is not shown on the page.`);
      if (bp.description && bp.description !== p.description) error(where, 'JSONLD_MISMATCH', 'BlogPosting description differs from the meta description.');
      if (bp.datePublished && isoDay(bp.datePublished) !== isoDay(post.data.date)) error(where, 'JSONLD_MISMATCH', `datePublished ${bp.datePublished} does not match the post date ${isoDay(post.data.date)}.`);
      const visibleDates = [...p.body.matchAll(/<time\b[^>]*datetime=["']?([\d-]+)/gi)].map((m) => m[1]);
      if (bp.datePublished && !visibleDates.includes(isoDay(bp.datePublished))) error(where, 'JSONLD_MISMATCH', 'datePublished is not shown on the page.');
      if (bp.dateModified && !visibleDates.includes(isoDay(bp.dateModified))) error(where, 'JSONLD_MISMATCH', 'dateModified is not shown on the page.');
      if (bp.dateModified && !post.data.updated) error(where, 'JSONLD_MISMATCH', 'dateModified is set but the post has no `updated` date.');
      if (bp.image && !isAbsoluteUrl([].concat(bp.image)[0])) error(where, 'JSONLD_IMAGE', 'BlogPosting image must be an absolute URL.');
      if (bp.image && !post.data.cover) error(where, 'JSONLD_MISMATCH', 'BlogPosting has an image but the post has no `cover`.');
      const id = bp.mainEntityOfPage?.['@id'] ?? bp.mainEntityOfPage;
      const expected = post.data.canonical || `${ORIGIN}${p.urlPath}`;
      if (id && id !== expected) error(where, 'JSONLD_MISMATCH', `mainEntityOfPage (${id}) should be ${expected}.`);
    }
  }

  // Client-side-only content would be invisible to crawlers.
  if (/<astro-island[^>]*client=["']?only/i.test(p.body)) error(where, 'CLIENT_ONLY', 'Page contains a client:only component; its content is not in the static HTML.');
  if (isArticle) {
    const article = p.body.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? '';
    const expectedWords = words(post.body.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`|\-[\]()]/g, ' '));
    if (words(text(article)) < Math.min(expectedWords, 100) * 0.6) error(where, 'BODY_MISSING', 'Article body text is missing from the generated HTML.');
  }

  // Images
  for (const img of tagsOf(p.body, 'img')) {
    if (!('alt' in img)) error(where, 'IMG_ALT', `<img src="${img.src}"> has no alt attribute (use alt="" only for decorative images).`);
    if (!img.width || !img.height) warn(where, 'IMG_SIZE', `<img src="${img.src}"> has no width/height, which can cause layout shift.`);
  }

  // Links and assets
  const refs = [
    ...tagsOf(p.body, 'a').map((a) => ({ href: a.href, kind: 'link' })),
    ...tagsOf(p.head + p.body, 'link').filter((l) => l.rel !== 'canonical' && l.rel !== 'alternate').map((l) => ({ href: l.href, kind: 'asset' })),
    ...tagsOf(p.html, 'script').filter((s) => s.src).map((s) => ({ href: s.src, kind: 'asset' })),
    ...tagsOf(p.body, 'img').flatMap((i) => [{ href: i.src, kind: 'asset' }, ...(i.srcset ?? '').split(',').map((s) => ({ href: s.trim().split(/\s+/)[0], kind: 'asset' }))]),
  ].filter((r) => r.href);
  const seen = new Set();
  for (const { href, kind } of refs) {
    if (seen.has(`${kind}:${href}`)) continue;
    seen.add(`${kind}:${href}`);
    if (href.startsWith('#')) {
      if (href.length > 1 && !p.ids.has(decodeURIComponent(href.slice(1)))) warn(where, 'ANCHOR_MISSING', `In-page link ${href} has no matching id.`);
      continue;
    }
    const r = resolveInternal(href, p.urlPath);
    if (!r) continue;
    if (r.broken || !r.exists) { error(where, 'LINK_BROKEN', `Broken internal ${kind}: ${href}`); continue; }
    if (kind === 'link' && !r.hasSlash) warn(where, 'LINK_SLASH', `Link ${href} lacks a trailing slash and will redirect on GitHub Pages; use ${r.path}.`);
    if (kind === 'link') {
      if (r.path !== p.urlPath) inbound.set(r.path, (inbound.get(r.path) ?? new Set()).add(p.urlPath));
      const target = pageByPath.get(r.path);
      if (r.hash && target && !target.ids.has(decodeURIComponent(r.hash))) warn(where, 'ANCHOR_MISSING', `Link ${href} points to #${r.hash}, which does not exist on ${r.path}.`);
    }
  }
}

for (const [value, where] of titles) if (where.length > 1) error(where.join(', '), 'TITLE_DUPLICATE', `Duplicate <title> "${value}".`);
for (const [value, where] of descriptions) if (where.length > 1) warn(where.join(', '), 'DESC_DUPLICATE', `Duplicate meta description: "${value.slice(0, 70)}…"`);

// Orphans: every indexable page except the home page should be linked from somewhere else.
for (const p of indexable) {
  if (p.urlPath !== '/' && !inbound.get(p.urlPath)?.size) error(p.file, 'ORPHAN', 'No other page links to this page.');
}

// ---------- blog content ----------
for (const post of posts) {
  const where = post.file;
  const d = post.data;
  if (!d.title) error(where, 'FM_TITLE', 'Missing `title`.');
  if (!d.description) error(where, 'FM_DESCRIPTION', 'Missing `description`.');
  if (!validDate(d.date)) error(where, 'FM_DATE', 'Missing or invalid `date` (use YYYY-MM-DD).');
  if (d.updated && !validDate(d.updated)) error(where, 'FM_UPDATED', 'Invalid `updated` date.');
  if (d.updated && validDate(d.date) && isoDay(d.updated) < isoDay(d.date)) error(where, 'FM_UPDATED', '`updated` is earlier than `date`.');
  if (d.category && !categories.has(d.category)) error(where, 'FM_CATEGORY', `Unknown category "${d.category}" (add it to src/data/taxonomy.json).`);
  for (const t of [].concat(d.tags || [])) if (!tags.has(t)) error(where, 'FM_TAG', `Unknown tag "${t}" (add it to src/data/taxonomy.json).`);
  if (d.cover && !d.coverAlt) error(where, 'FM_COVER_ALT', '`cover` is set without `coverAlt`.');
  if (d.canonical && !isAbsoluteUrl(d.canonical)) error(where, 'FM_CANONICAL', '`canonical` must be an absolute URL.');
  if (d.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug)) error(where, 'FM_SLUG', '`slug` must be lowercase and hyphenated.');
  if (post.draft) continue;

  if (!d.category) error(where, 'FM_CATEGORY', 'Published posts need a `category`.');
  const page = pageByPath.get(postPath(post));
  if (!page) error(where, 'POST_NOT_BUILT', `No page was generated for ${postPath(post)}.`);
  if (page && Boolean(d.noindex) !== page.noindex) error(where, 'NOINDEX_MISMATCH', `Frontmatter noindex=${Boolean(d.noindex)} but the page ${page.noindex ? 'has' : 'lacks'} a noindex robots tag.`);

  // Editorial recommendations
  if (validDate(d.date) && isoDay(d.date) > today) warn(where, 'DATE_FUTURE', `Post date ${isoDay(d.date)} is in the future; it is published immediately on build.`);
  const effectiveTitle = d.seoTitle || d.title;
  if (effectiveTitle && effectiveTitle.length + SEO.titleSeparator.length + SEO.siteName.length > titleMax) {
    warn(where, 'TITLE_LONG', `Search title is ${effectiveTitle.length + SEO.titleSeparator.length + SEO.siteName.length} characters with the site name (recommended ≤ ${titleMax}). Consider adding a shorter \`seoTitle\`; the visible title stays as is.`);
  }
  if (d.description && (d.description.length < descriptionMin || d.description.length > descriptionMax)) {
    warn(where, 'DESC_LENGTH', `Description is ${d.description.length} characters (recommended ${descriptionMin}-${descriptionMax}).`);
  }
  if (![].concat(d.tags || []).length) warn(where, 'NO_TAGS', 'No tags set.');
  if (!d.cover) warn(where, 'NO_COVER', 'No `cover` image; the default social preview is used.');
  const prose = post.body.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '');
  if (words(prose) < 300) warn(where, 'THIN_CONTENT', `Only ~${words(prose)} words; very short posts rarely rank.`);
  if (published.length > 2 && !/\]\((\/|https?:\/\/jpurohit92\.github\.io)|href=["']\//.test(prose)) {
    warn(where, 'NO_INTERNAL_LINKS', 'No links to other pages on this site; link related posts where it is natural.');
  }
  let last = 1;
  for (const line of prose.split('\n')) {
    const m = line.match(/^(#{1,6})\s+\S/);
    if (!m) continue;
    if (m[1].length === 1) error(where, 'BODY_H1', `Body contains an H1 ("${line}"); the title is already the page H1. Start with ##.`);
    else if (m[1].length > last + 1) warn(where, 'HEADING_SKIP', `Heading "${line.trim()}" skips a level.`);
    last = m[1].length;
  }
}

// ---------- robots.txt and sitemap ----------
const sitemapUrls = [];
const robotsPath = join(DIST, 'robots.txt');
const sitemapIndexUrl = `${ORIGIN}${SEO.sitemapIndexPath}`;
if (!existsSync(robotsPath)) error('robots.txt', 'ROBOTS_MISSING', 'dist/robots.txt was not generated.');
else {
  const robots = readFileSync(robotsPath, 'utf8');
  const refs = [...robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  if (!refs.length) error('robots.txt', 'ROBOTS_SITEMAP', 'robots.txt has no Sitemap line.');
  for (const ref of refs) {
    const r = resolveInternal(ref, '/');
    if (!r) error('robots.txt', 'ROBOTS_SITEMAP', `Sitemap ${ref} is not on ${ORIGIN}.`);
    else if (!r.exists) error('robots.txt', 'ROBOTS_SITEMAP', `Sitemap ${ref} does not exist in the build output.`);
  }
  if (refs.length && !refs.includes(sitemapIndexUrl)) error('robots.txt', 'ROBOTS_SITEMAP', `robots.txt should reference ${sitemapIndexUrl}.`);
  if (/^\s*disallow:\s*\/\s*$/im.test(robots)) error('robots.txt', 'ROBOTS_BLOCKS_ALL', 'robots.txt disallows the whole site.');
}

const readXml = (file) => (fileSet.has(file) ? readFileSync(join(DIST, file), 'utf8') : null);
const indexXml = readXml(SEO.sitemapIndexPath);
if (!indexXml) error('sitemap', 'SITEMAP_INDEX_MISSING', `${SEO.sitemapIndexPath} was not generated by @astrojs/sitemap.`);
else {
  const children = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1].trim()));
  if (!children.length) error('sitemap', 'SITEMAP_EMPTY', 'Sitemap index lists no sitemaps.');
  for (const child of children) {
    const r = resolveInternal(child, '/');
    if (!r || !r.exists) { error(SEO.sitemapIndexPath, 'SITEMAP_CHILD_MISSING', `Listed sitemap does not exist: ${child}`); continue; }
    const xml = readXml(new URL(child).pathname) ?? '';
    sitemapUrls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1].trim())));
  }
}
const listed = new Set();
for (const u of sitemapUrls) {
  if (listed.has(u)) error('sitemap', 'SITEMAP_DUPLICATE', `URL listed twice: ${u}`);
  listed.add(u);
  const url = new URL(u);
  if (url.origin !== ORIGIN) { error('sitemap', 'SITEMAP_ORIGIN', `URL is not on ${ORIGIN}: ${u}`); continue; }
  const page = pageByPath.get(url.pathname);
  if (!page) error('sitemap', 'SITEMAP_DEAD_URL', `Sitemap lists a URL with no generated page: ${u}`);
  else if (page.noindex || is404(page) || page.redirect) error('sitemap', 'SITEMAP_NOINDEX', `Sitemap lists a noindex or redirect page: ${u}`);
  const post = postByPath.get(url.pathname);
  if (post?.data.canonical) error('sitemap', 'SITEMAP_NONCANONICAL', `Sitemap lists a post whose canonical is elsewhere: ${u}`);
  if (url.search || url.hash) error('sitemap', 'SITEMAP_PARAMS', `Sitemap URL has a query or fragment: ${u}`);
}
for (const post of posts.filter((p) => p.draft)) {
  if (listed.has(`${ORIGIN}${postPath(post)}`)) error('sitemap', 'SITEMAP_DRAFT', `Draft is listed in the sitemap: ${postPath(post)}`);
  if (pageByPath.has(postPath(post))) error(post.file, 'DRAFT_BUILT', `Draft was built to ${postPath(post)}.`);
}
for (const p of indexable) {
  const post = postByPath.get(p.urlPath);
  if (post?.data.canonical) continue;
  if (!listed.has(`${ORIGIN}${p.urlPath}`)) error(p.file, 'SITEMAP_MISSING', `Indexable page is missing from the sitemap: ${ORIGIN}${p.urlPath}`);
}

// ---------- report ----------
const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const print = (list, label, colour) => {
  if (!list.length) return;
  console.log(`\n${c(colour, c(1, `${label} (${list.length})`))}`);
  const byWhere = new Map();
  for (const i of list) byWhere.set(i.where, [...(byWhere.get(i.where) ?? []), i]);
  for (const [where, items] of byWhere) {
    console.log(`\n  ${where}`);
    for (const i of items) console.log(`    ${c(colour, i.code)}  ${i.message}`);
  }
};

console.log(`SEO check: ${pages.length} pages (${indexable.length} indexable), ${published.length} published and ${posts.length - published.length} draft posts, ${listed.size} sitemap URLs${redirects.length ? `, ${redirects.length} redirect(s)` : ''}`);
print(errors, 'ERRORS (technical, fail the check)', '31');
print(warnings, STRICT ? 'RECOMMENDATIONS (failing: --strict)' : 'RECOMMENDATIONS (editorial, do not fail the check)', '33');

const failed = errors.length > 0 || (STRICT && warnings.length > 0);
console.log(`\n${failed ? c('31', '✖ FAILED') : c('32', '✔ PASSED')}: ${errors.length} error(s), ${warnings.length} recommendation(s)`);
process.exit(failed ? 1 : 0);

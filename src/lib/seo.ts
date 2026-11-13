// SEO helpers: canonical URLs and Schema.org JSON-LD builders. Site facts come from seo-config.mjs.
import { SEO } from './seo-config.mjs';
import { url } from '../site';

export type JsonLd = Record<string, unknown>;

/** Absolute URL for a site path (already base-prefixed) or an absolute URL. */
export const absoluteUrl = (pathOrUrl: string): string => new URL(pathOrUrl, SEO.siteUrl).href;

/**
 * Canonical URL for a page path. Pages are built as `<path>/index.html`, so the served URL ends
 * with a slash (GitHub Pages redirects the slashless form). Files with an extension are left as is.
 */
export function canonicalFor(pathname: string): string {
  const withSlash = /\.[a-z0-9]+$/i.test(pathname) || pathname.endsWith('/') ? pathname : `${pathname}/`;
  return absoluteUrl(withSlash);
}

/** ISO calendar date (YYYY-MM-DD). Dates in this site are stored as UTC midnight. */
export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

export const personId = `${SEO.siteUrl}/#person`;
export const websiteId = `${SEO.siteUrl}/#website`;

/** <title> text: "Page title · Jatin Purohit", or the default title for the home page. */
export const fullTitle = (title?: string): string =>
  title ? `${title}${SEO.titleSeparator}${SEO.siteName}` : SEO.defaultTitle;

const profileUrls = (): string[] => Object.values(SEO.profiles).filter(Boolean);

/** The site author. Same @id everywhere so search engines join the entities. */
export function personSchema(extra: JsonLd = {}): JsonLd {
  return {
    '@type': 'Person',
    '@id': personId,
    name: SEO.authorName,
    jobTitle: 'Principal Technical Marketing Engineer',
    worksFor: { '@type': 'Organization', name: 'Broadcom' },
    url: absoluteUrl(url('/')),
    image: absoluteUrl(url('/profile.jpg')),
    sameAs: profileUrls(),
    ...extra,
  };
}

export function websiteSchema(): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': websiteId,
    name: SEO.siteName,
    url: absoluteUrl(url('/')),
    description: SEO.defaultDescription,
    inLanguage: SEO.language,
    author: { '@id': personId },
    publisher: { '@id': personId },
  };
}

export function breadcrumbSchema(trail: { name: string; path: string }[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: absoluteUrl(t.path),
    })),
  };
}

export interface BlogPostingInput {
  headline: string;
  description: string;
  pageUrl: string;
  datePublished: Date;
  /** Only when the post has an explicit `updated` date. Never defaulted to the publish date. */
  dateModified?: Date;
  author: string;
  image?: string;
  section?: string;
  keywords?: string[];
}

export function blogPostingSchema(p: BlogPostingInput): JsonLd {
  // The site author is the Person entity; a different author name is described inline.
  const author =
    p.author === SEO.authorName
      ? { '@type': 'Person', '@id': personId, name: SEO.authorName, url: absoluteUrl(url('/about/')) }
      : { '@type': 'Person', name: p.author };
  return {
    '@type': 'BlogPosting',
    headline: p.headline,
    description: p.description,
    author,
    datePublished: isoDate(p.datePublished),
    ...(p.dateModified ? { dateModified: isoDate(p.dateModified) } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': p.pageUrl },
    url: p.pageUrl,
    inLanguage: SEO.language,
    isPartOf: { '@id': websiteId },
    ...(p.image ? { image: p.image } : {}),
    ...(p.section ? { articleSection: p.section } : {}),
    ...(p.keywords?.length ? { keywords: p.keywords.join(', ') } : {}),
  };
}

/** Wrap one or more entities in a single @graph document. */
export const graph = (...nodes: JsonLd[]): JsonLd => ({ '@context': 'https://schema.org', '@graph': nodes });

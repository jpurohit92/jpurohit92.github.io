// Single source of truth for site-wide SEO facts.
//
// Plain .mjs on purpose: it is imported by astro.config.mjs, by Astro pages (via src/site.ts and
// src/lib/seo.ts) and by Node scripts (scripts/seo-check.mjs), none of which share a bundler.
// Edit values here; do not repeat them anywhere else.

export const SEO = {
  /** Production origin, no trailing slash. Also used as Astro's `site`. */
  siteUrl: 'https://jpurohit92.github.io',
  siteName: 'Jatin Purohit',
  authorName: 'Jatin Purohit',
  /** <title> of the home page. */
  defaultTitle: 'Jatin Purohit · Principal Technical Marketing Engineer',
  /** Appended to every other page title: "Page title · Jatin Purohit". */
  titleSeparator: ' · ',
  /** Used by pages that do not provide their own description (kept under ~160 characters). */
  defaultDescription:
    'Jatin Purohit is a Principal Technical Marketing Engineer at VMware by Broadcom. Notes on cloud infrastructure, automation, APIs and developer experience.',
  language: 'en',
  locale: 'en_US',
  /** Default social preview (1200x630, in /public). Used when a page has no image of its own. */
  defaultImage: {
    path: '/og-default.png',
    width: 1200,
    height: 630,
    alt: 'Jatin Purohit, Principal Technical Marketing Engineer at VMware by Broadcom',
  },
  /** Real, verified profile URLs only. Used for Person.sameAs and the footer/home links. */
  profiles: {
    linkedin: 'https://www.linkedin.com/in/jatinpurohit92/',
    github: 'https://github.com/jpurohit92',
  },
  /** Sitemap index written by @astrojs/sitemap (verified against the build output by seo:check). */
  sitemapIndexPath: '/sitemap-index.xml',
  /** Recommended limits used by seo:check (editorial warnings, not errors). */
  limits: { titleMax: 60, descriptionMin: 70, descriptionMax: 160 },
};

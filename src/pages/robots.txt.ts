import type { APIRoute } from 'astro';
import { SEO } from '../lib/seo-config.mjs';

// The sitemap URL comes from the same config the build uses (@astrojs/sitemap writes
// `sitemap-index.xml`; `npm run seo:check` fails if that file or this reference goes missing).
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL(SEO.sitemapIndexPath, site ?? SEO.siteUrl).href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};

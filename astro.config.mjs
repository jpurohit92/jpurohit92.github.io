import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { headingAnchors, wrapTables } from './src/lib/markdown-plugins.mjs';
import { codeBlockChrome } from './src/lib/shiki-code-block.mjs';
import { SEO } from './src/lib/seo-config.mjs';
import { readBlogPosts } from './src/lib/frontmatter.mjs';

// Removed pages keep working: GitHub Pages cannot send 301s, so Astro writes a static redirect page
// (meta refresh + canonical to the target) at the old URL.
const redirects = {
  '/projects': '/about/', // the Projects page was retired
};

// Sitemap: only pages that should be indexed. Drafts are never built; noindex posts, posts whose
// canonical points elsewhere, and the 404 page are built but must not be listed.
const posts = readBlogPosts();
const postPath = (id) => `/blog/${id}/`;
const excluded = new Set(['/404/', ...Object.keys(redirects).map((from) => `${from}/`), ...posts.filter((p) => p.data.noindex === true || p.data.canonical).map((p) => postPath(p.id))]);
const lastmod = new Map(
  posts.filter((p) => !p.draft).map((p) => [postPath(p.id), p.data.updated || p.data.date]),
);

// Hosted on GitHub Pages as a *user site*: repo named `jpurohit92.github.io`.
// If you use a project repo instead, add `base: '/<repo-name>'` below.
export default defineConfig({
  site: SEO.siteUrl,
  redirects,
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !excluded.has(new URL(page).pathname),
      // <lastmod> only where a real date exists (the post's `updated`, else its publication date).
      serialize: (item) => {
        const date = lastmod.get(new URL(item.url).pathname);
        return date ? { ...item, lastmod: new Date(date).toISOString() } : item;
      },
    }),
  ],
  markdown: {
    // Astro 7's Markdown engine (Sätteri): anchors on headings, scrollable tables.
    processor: satteri({ hastPlugins: [headingAnchors, wrapTables] }),
    shikiConfig: {
      // "default" variants are the higher-contrast GitHub palettes (AA for comments).
      themes: { light: 'github-light-default', dark: 'github-dark-default' },
      transformers: [codeBlockChrome()],
    },
  },
});

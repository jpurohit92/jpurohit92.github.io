import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { headingAnchors, wrapTables } from './src/lib/markdown-plugins.mjs';
import { codeBlockChrome } from './src/lib/shiki-code-block.mjs';

// Hosted on GitHub Pages as a *user site*: repo named `jpurohit92.github.io`.
// If you use a project repo instead, add `base: '/<repo-name>'` below.
export default defineConfig({
  site: 'https://jpurohit92.github.io',
  integrations: [mdx(), sitemap()],
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

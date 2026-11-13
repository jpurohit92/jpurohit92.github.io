import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import taxonomy from './data/taxonomy.json';
import { SEO } from './lib/seo-config.mjs';
import linkedPosts from './data/linked-posts.json';

// Categories and tags come only from src/data/taxonomy.json. Anything else fails the build,
// so a typo can never create a stray category or tag.
const categoryNames = taxonomy.categories.map((c) => c.name) as [string, ...string[]];
const tagNames = taxonomy.tags as [string, ...string[]];
const category = z.enum(categoryNames);
const tags = z.array(z.enum(tagNames)).default([]);

// SEO-relevant metadata lives in the frontmatter below; see docs/SEO.md for what each field does.
// The file name is the URL slug unless `slug` is set. `updated` is only published when you set it
// (it is never defaulted to `date`).
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z
      .object({
        // Optional URL slug override (lowercase, hyphenated). Default: the file name. Changing it changes the URL.
        slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
        title: z.string(), // visible H1
        description: z.string(), // meta description, social description, listing text
        date: z.coerce.date(), // publication date
        updated: z.coerce.date().optional(), // last substantive update
        author: z.string().default(SEO.authorName),
        tags,
        category: category.optional(), // required for published posts (checked below)
        draft: z.boolean().default(false),
        // Optional SEO-only title for <title>/og:title. The visible H1 stays `title`.
        seoTitle: z.string().optional(),
        // Only when the post was first published elsewhere: absolute URL of the original.
        canonical: z.string().url().optional(),
        // Keep the page out of search results (it is also dropped from the sitemap).
        noindex: z.boolean().default(false),
        // Social/schema image. Path relative to the post, e.g. ../../assets/my-cover.png (1200x630 ideal).
        cover: image().optional(),
        coverAlt: z.string().optional(),
      })
      .superRefine((p, ctx) => {
        if (p.cover && !p.coverAlt) {
          ctx.addIssue({ code: 'custom', path: ['coverAlt'], message: '`coverAlt` is required when `cover` is set.' });
        }
        if (!p.draft && !p.category) {
          ctx.addIssue({ code: 'custom', path: ['category'], message: 'Published posts need a `category`.' });
        }
        if (p.updated && p.updated.valueOf() < p.date.valueOf()) {
          ctx.addIssue({ code: 'custom', path: ['updated'], message: '`updated` cannot be earlier than `date`.' });
        }
      }),
});

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// Posts published elsewhere. Maintained in src/data/linked-posts.json and listed under Blog
// next to regular posts; they link out instead of opening a page on this site.
const linked = defineCollection({
  loader: () =>
    (linkedPosts as Record<string, unknown>[]).map((p, i) => ({ ...p, id: `${slugify(String(p.title ?? '')) || 'link'}-${i}` })),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    url: z.string().url(),
    source: z.string(), // where it is published, e.g. "VMware Blog"
    tags,
    category,
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, linked };

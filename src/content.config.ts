import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import taxonomy from './data/taxonomy.json';
import linkedPosts from './data/linked-posts.json';

// Categories and tags come only from src/data/taxonomy.json. Anything else fails the build,
// so a typo can never create a stray category or tag.
const categoryNames = taxonomy.categories.map((c) => c.name) as [string, ...string[]];
const tagNames = taxonomy.tags as [string, ...string[]];
const category = z.enum(categoryNames);
const tags = z.array(z.enum(tagNames)).default([]);

// All new fields are optional so existing articles keep working unchanged.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags,
    category: category.optional(),
    draft: z.boolean().default(false),
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

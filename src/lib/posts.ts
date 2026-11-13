import { getCollection, type CollectionEntry } from 'astro:content';
import { url } from '../site';

export type Post = CollectionEntry<'blog'>;

/** Published posts, newest first. */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', (p) => !p.data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** One row in a blog listing: either a post on this site or a link to content published elsewhere. */
export interface ListingItem {
  kind: 'post' | 'link';
  id: string;
  title: string;
  description: string;
  date: Date;
  category?: string;
  tags: string[];
  /** Page on this site for posts, external URL for links. */
  href: string;
  external: boolean;
  /** Links only: where it is published (e.g. "VMware Blog"). */
  source?: string;
  /** Posts only: estimated reading time. */
  minutes?: number;
}

/** Posts and linked posts together, newest first. Used by the blog list, the home page and RSS. */
export async function getListing(): Promise<ListingItem[]> {
  const [posts, links] = await Promise.all([
    getPublishedPosts(),
    getCollection('linked', (l) => !l.data.draft),
  ]);
  const items: ListingItem[] = [
    ...posts.map((p): ListingItem => ({
      kind: 'post',
      id: p.id,
      title: p.data.title,
      description: p.data.description,
      date: p.data.date,
      category: p.data.category,
      tags: p.data.tags,
      href: url(`/blog/${p.id}/`),
      external: false,
      minutes: readingMinutes(p.body),
    })),
    ...links.map((l): ListingItem => ({
      kind: 'link',
      id: l.id,
      title: l.data.title,
      description: l.data.description,
      date: l.data.date,
      category: l.data.category,
      tags: l.data.tags,
      href: l.data.url,
      external: true,
      source: l.data.source,
    })),
  ];
  return items.sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

/** Dates are stored as UTC midnight, so format in UTC to avoid off-by-one days. */
export function formatDate(date: Date, style: 'long' | 'short' = 'long'): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const WORDS_PER_MINUTE = 200;

/**
 * Estimated reading time in whole minutes (minimum 1), computed from the raw
 * article source. Prose is counted at 200 wpm; code is skimmed, so it counts
 * at roughly a third of the weight.
 */
export function readingMinutes(body: string | undefined): number {
  if (!body) return 1;
  let codeTokens = 0;
  const prose = body
    .replace(/^(import|export)\s.+$/gm, ' ') // MDX imports / exports
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, (block) => {
      codeTokens += block.split(/\s+/).filter(Boolean).length;
      return ' ';
    })
    .replace(/<[^>]+>/g, ' ') // HTML / JSX tags
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images -> label
    .replace(/[#>*_`~|-]+/g, ' '); // markdown punctuation
  const words = prose.split(/\s+/).filter(Boolean).length + codeTokens / 3;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export const readingLabel = (minutes: number) => `${minutes} min read`;

export interface Facet { name: string; count: number }

type Tagged = { category?: string; tags: string[] };

const facets = (values: string[], sort: 'alpha' | 'count'): Facet[] => {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const list = [...counts].map(([name, count]) => ({ name, count }));
  return list.sort((a, b) => (sort === 'count' && b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name)));
};

/** Categories with item counts, A-Z. */
export const categoryFacets = (items: Tagged[]): Facet[] =>
  facets(items.map((i) => i.category).filter((c): c is string => Boolean(c)), 'alpha');

/** Tags with item counts, most used first (then A-Z). */
export const tagFacets = (items: Tagged[]): Facet[] => facets(items.flatMap((i) => i.tags), 'count');

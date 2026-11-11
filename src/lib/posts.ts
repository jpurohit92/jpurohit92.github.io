import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** Published posts, newest first. */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', (p) => !p.data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** Up to `limit` posts: those marked `featured`, topped up with the newest posts. */
export function pickFeatured(posts: Post[], limit = 3): Post[] {
  const featured = posts.filter((p) => p.data.featured);
  const rest = posts.filter((p) => !p.data.featured);
  return [...featured, ...rest].slice(0, limit);
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

export function categoriesOf(posts: Post[]): string[] {
  return [...new Set(posts.map((p) => p.data.category).filter((c): c is string => Boolean(c)))].sort();
}

export interface Facet { name: string; count: number }

const facets = (values: string[], sort: 'alpha' | 'count'): Facet[] => {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const list = [...counts].map(([name, count]) => ({ name, count }));
  return list.sort((a, b) => (sort === 'count' && b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name)));
};

/** Categories with post counts, A-Z. */
export const categoryFacets = (posts: Post[]): Facet[] =>
  facets(posts.map((p) => p.data.category).filter((c): c is string => Boolean(c)), 'alpha');

/** Tags with post counts, most used first (then A-Z). */
export const tagFacets = (posts: Post[]): Facet[] => facets(posts.flatMap((p) => p.data.tags), 'count');

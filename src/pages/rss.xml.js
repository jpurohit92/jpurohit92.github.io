import rss from '@astrojs/rss';
import { getListing } from '../lib/posts';
import { SITE } from '../site';

export async function GET(context) {
  const items = await getListing();
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site,
    items: items.map((p) => ({
      title: p.title,
      description: p.description,
      pubDate: p.date,
      // Posts are already base-prefixed paths; linked posts are absolute external URLs.
      link: p.href,
      categories: [...(p.category ? [p.category] : []), ...p.tags],
    })),
  });
}

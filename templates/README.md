# Content templates

## Categories and tags

Edit `src/data/taxonomy.json`. It is the only place categories and tags are defined.
Blog posts and linked posts can only use values listed there. Anything else fails the
build with an error naming the file and the bad value.

- `categories`: `{ "name": "...", "icon": "<octicon name>" }`. They appear in the blog sidebar in this order.
- `tags`: a list of strings (lowercase, hyphenated works well).

## Blog post

`blog-post.mdx` is the doc template for new articles.

```bash
cp templates/blog-post.mdx src/content/blog/my-new-post.mdx
```

Then edit the frontmatter and body. Only files under `src/content/blog/` are published (unless `draft: true`).
Before pushing, run `npm run build && npm run seo:check`. SEO fields and the publishing checklist are in [`docs/SEO.md`](../docs/SEO.md).

## Linked post (published elsewhere)

Add an object to the list in `src/data/linked-posts.json`. It shows up under Blog (and on the
home page if it is among the newest two), looks like a normal post, and opens the external URL
in a new tab.

```json
{
  "title": "Automating VCF with PowerCLI",
  "description": "One or two sentences shown on the listing.",
  "date": "2026-11-10",
  "url": "https://blogs.vmware.com/...",
  "source": "VMware Blog",
  "category": "Automation",
  "tags": ["powercli", "vcf"]
}
```

`draft: true` hides an entry. `category` is required for linked posts; `tags` is optional.

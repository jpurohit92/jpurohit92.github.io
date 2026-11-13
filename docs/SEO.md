# SEO guide

How SEO works on https://jpurohit92.github.io, how to publish an article without breaking it, and how to verify it in Google.

The site is fully static (Astro on GitHub Pages). Everything below is generated at build time; there is no server.

## Architecture

| Concern | Where it lives |
| --- | --- |
| Site URL, name, author, default description, default social image, profile URLs, sitemap path, length limits | `src/lib/seo-config.mjs` (the only place to edit them) |
| All `<head>` SEO tags: title, description, canonical, robots, Open Graph, Twitter, JSON-LD | `src/components/Seo.astro`, rendered by `src/layouts/BaseLayout.astro` |
| Canonical URL generation and JSON-LD builders (WebSite, Person, BlogPosting, BreadcrumbList) | `src/lib/seo.ts` |
| Blog metadata schema | `src/content.config.ts` |
| Sitemap (`@astrojs/sitemap`), sitemap filtering, redirects | `astro.config.mjs` |
| `robots.txt` | `src/pages/robots.txt.ts` (generated, points to the sitemap index) |
| 404 page (`noindex`) | `src/pages/404.astro` |
| Default social preview (1200x630) | `public/og-default.png` (regenerate with `node scripts/generate-og-image.mjs`) |
| Validation | `scripts/seo-check.mjs` (`npm run seo:check`) |
| Optional analytics / Search Console tags | `src/components/Analytics.astro`, `Seo.astro` (off unless env vars are set) |

Key behaviours:

- **One URL per page, with a trailing slash.** Pages build to `<path>/index.html`, so `/blog/` is canonical and `/blog` only redirects. Always link with the slash.
- **Canonical** is generated from the page path and `site`. Only posts first published elsewhere should override it (`canonical` frontmatter).
- **Titles:** `<title>` is `Page title · Jatin Purohit` (home uses the default title). `og:title` and `twitter:title` use the page title without the site name; `og:site_name` carries the name.
- **Social images:** a post's `cover` (resized to 1200x630 by Astro) if set, otherwise `og-default.png`. Always absolute URLs.
- **Category and tag filters** (`/blog/?category=...&tag=...`) are client-side views of `/blog/`. They canonicalize to `/blog/`, are not in the sitemap, and every post is already in the static HTML of `/blog/`. Posts link to these filtered views from their category and tags.
- **Reading mode** only toggles CSS classes on the same URL. It does not create new pages or duplicate indexable content. The extra title shown in reading mode is `aria-hidden` and `data-nosnippet`.
- **Retired pages** get a static redirect page via `redirects` in `astro.config.mjs` (for example `/projects/` redirects to `/about/`). GitHub Pages cannot send real 301s, so this is a meta-refresh page with a canonical to the target.

## Structured data

| Page | JSON-LD |
| --- | --- |
| Home | `WebSite` and `Person` (one `@graph`) |
| About | `Person` |
| Blog index | `BreadcrumbList` (Home > Blog) |
| Blog post | `BlogPosting` and `BreadcrumbList` (Home > Blog > Post) |

Rules: every value must be real and visible on the page. `dateModified` is only emitted when the post has an `updated` date after `date`. `image` is only emitted when the post has a `cover`. The Person `sameAs` list comes from `SEO.profiles` (LinkedIn, GitHub). Do not add profiles you do not own.

There are no per-project pages, so no `SoftwareSourceCode` / `CreativeWork` markup is generated. If project pages are added later, add a builder in `src/lib/seo.ts` and use it from the page.

## Blog metadata

Defined in `src/content.config.ts`; the template is `templates/blog-post.mdx`.

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | Visible H1. Not rewritten for SEO. |
| `description` | yes | Meta description, social description and listing text. 70-160 characters is ideal. |
| `date` | yes | Publication date, `YYYY-MM-DD`. |
| `category` | yes (published) | Must exist in `src/data/taxonomy.json`. |
| `tags` | recommended | Must exist in `src/data/taxonomy.json`. |
| `updated` | no | Only for substantive revisions. Must not be earlier than `date`. Never copy `date` into it. |
| `author` | no | Defaults to Jatin Purohit. |
| `draft` | no | `true` = not built, not in the sitemap, not in RSS. |
| `slug` | no | URL override. By default the file name is the URL (`my-post.mdx` is `/blog/my-post/`). |
| `seoTitle` | no | Shorter title for `<title>` and social previews. The visible H1 stays `title`. |
| `cover`, `coverAlt` | no | Image path relative to the post (for example `../../assets/cover.png`) and its alt text. `coverAlt` is required with `cover`. Used for link previews and `BlogPosting.image`; it is not shown inside the article. |
| `canonical` | no | Absolute URL, only if the post was first published elsewhere. The post is then left out of the sitemap. |
| `noindex` | no | Adds `noindex, follow` and leaves the post out of the sitemap. |

Posts published elsewhere (`src/data/linked-posts.json`) are listed on the blog and in RSS but link out; they have no page on this site and are not in the sitemap.

## Publishing a new article

1. Copy `templates/blog-post.mdx` to `src/content/blog/<slug>.mdx`. The file name becomes the permanent URL.
2. Fill in the frontmatter. Write the description as one or two plain sentences. If the title is long, add a `seoTitle` instead of shortening the title.
3. Write the body starting at `##` (the title is already the H1). Do not skip heading levels. Add descriptive alt text to images.
4. Link to related posts or pages where it helps the reader: `[text](/blog/other-post/)`.
5. Preview: `npm run dev`.
6. Validate: `npm run build && npm run seo:check`. Fix errors; read the recommendations.
7. Commit and push to `main`. GitHub Actions builds, runs the SEO check, then deploys.
8. After deploy, open the live URL and, in Search Console, use URL Inspection > Request indexing (optional; the sitemap also covers it).

Never rename or delete a published post without adding a redirect in `astro.config.mjs`.

## How the SEO check works

`npm run seo:check` reads the built `dist/` folder and the frontmatter of `src/content/blog/`. Build first (`npm run build`). It has no dependencies.

**Errors** (technical, exit code 1, block deployment):

- missing or duplicate `<title>`; missing meta description; missing `lang` or viewport
- missing, duplicate, relative or wrong canonical (including the canonical override rules)
- missing `<h1>`, multiple `<h1>`
- missing Open Graph / Twitter fields, `og:url` not equal to canonical, relative or missing `og:image`, wrong `og:type` or missing `article:published_time` on posts
- invalid JSON-LD; missing `WebSite`/`Person` on the home page; `BlogPosting` missing required fields or not matching the visible title, description and dates; invalid `BreadcrumbList`
- broken internal links, scripts, stylesheets and images; `<img>` without `alt`; orphaned pages
- published posts with no generated page; drafts that were built or listed in the sitemap; frontmatter errors (unknown category/tag, `cover` without `coverAlt`, `updated` before `date`)
- `robots.txt` missing, blocking the whole site, or not pointing at the real sitemap index; sitemap index or child sitemap missing; sitemap listing dead, duplicate, `noindex`, redirect, 404 or non-canonical URLs; indexable pages missing from the sitemap
- content that exists only client-side (`client:only`) or article text missing from the HTML

**Recommendations** (editorial, never fail the check unless you pass `--strict`):

- title longer than 60 characters; description outside 70-160 characters; duplicate descriptions
- skipped heading levels; links without a trailing slash; missing image `width`/`height`
- posts with no tags, no cover image, fewer than 300 words, future date, or no internal links (once there are three or more posts)

Run `npm run seo:check -- --strict` to treat recommendations as failures.

In CI, `.github/workflows/deploy.yml` runs `npm run build && npm run seo:check` inside the existing `withastro/action` build step. If it fails, the artifact is not uploaded and the deploy job never runs.

## How sitemap generation works

- `@astrojs/sitemap` (configured in `astro.config.mjs`) writes `dist/sitemap-index.xml` and `dist/sitemap-0.xml` after every build. The index is the file to submit.
- `filter` removes the 404 page, redirect pages, posts with `noindex: true`, and posts with a `canonical` override. Drafts are never built, so they are never listed.
- `serialize` adds `<lastmod>` to posts from the real `updated` (or else `date`) value.
- `robots.txt` is generated from `SEO.sitemapIndexPath` (`/sitemap-index.xml`). `seo:check` verifies that the file it points to exists in the build output, so a rename in a future Astro version is caught.

## Validate structured data

- Google Rich Results Test: https://search.google.com/test/rich-results (paste the live URL, or paste the HTML from `dist/`). Blog posts are detected as Article/BlogPosting; breadcrumbs as Breadcrumb.
- Schema Markup Validator: https://validator.schema.org (checks all schema.org types, including `Person` and `WebSite`).
- Locally: `npm run seo:check` parses every JSON-LD block and checks it against the visible page.

## Google Search Console

1. Go to https://search.google.com/search-console and click **Add property**.
2. Choose **URL prefix** and enter `https://jpurohit92.github.io/`. (A Domain property needs DNS access, which `github.io` does not give you.)
3. Verify ownership with one of:
   - **HTML tag:** copy the `content` value of the `google-site-verification` meta tag. In GitHub: Settings > Secrets and variables > Actions > Variables > New repository variable named `PUBLIC_GSC_VERIFICATION`. Re-run the deploy workflow. The tag is then added to every page.
   - **HTML file:** download the file Google gives you, put it in `public/`, deploy, then verify.
4. Open **Sitemaps** and submit `sitemap-index.xml`. Status should become "Success" with the discovered pages listed.
5. Optional: URL Inspection > paste a post URL > Request indexing.

## Google Analytics 4

1. In https://analytics.google.com create a property and a **Web** data stream for `https://jpurohit92.github.io`.
2. Copy the Measurement ID (looks like `G-XXXXXXXXXX`).
3. In GitHub: Settings > Secrets and variables > Actions > Variables > New repository variable `PUBLIC_GA_MEASUREMENT_ID`.
4. Re-run the deploy workflow. `src/components/Analytics.astro` then adds the standard gtag snippet to every page. Without the variable, no analytics script is included.
5. Check Reports > Realtime while visiting the live site. If you target visitors who need consent (for example the EU/UK), add a consent banner before enabling this.

Local testing: `PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX npm run build`.

## Verify production indexing

After a deploy:

1. `curl -s https://jpurohit92.github.io/robots.txt` shows `Sitemap: https://jpurohit92.github.io/sitemap-index.xml`.
2. `curl -s https://jpurohit92.github.io/sitemap-index.xml` lists `sitemap-0.xml`, which lists every published page.
3. View source on a post and check the canonical, `og:*`, and JSON-LD. Or run the Rich Results Test against it.
4. Search Console > **Sitemaps**: submitted and discovered counts match.
5. Search Console > **Pages**: pages should be "Indexed". "Discovered, currently not indexed" and "Crawled, currently not indexed" are normal for a new site; they resolve as the site earns links and publishes more.
6. Search Console > **URL Inspection** for one post: "URL is on Google", and the user-declared canonical equals the Google-selected canonical.
7. Search for `site:jpurohit92.github.io` (indexing can take days to weeks).
8. Social previews: paste a post URL into the LinkedIn Post Inspector (https://www.linkedin.com/post-inspector/) or Facebook Sharing Debugger to refresh the cached preview.

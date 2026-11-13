// Minimal frontmatter reader for the blog content files.
//
// Used where Astro's content layer is not available: the sitemap filter in astro.config.mjs and
// scripts/seo-check.mjs. It understands the YAML subset used in src/content/blog (scalars, quoted
// strings, inline and block lists, folded/literal blocks). Astro itself still validates the
// frontmatter against the schema in src/content.config.ts at build time.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { slug } from 'github-slugger';

const unquote = (v) => {
  const s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/''/g, "'");
  }
  return s;
};

const scalar = (raw) => {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v.startsWith('[') && v.endsWith(']')) {
    return v.slice(1, -1).split(',').map((x) => unquote(x)).filter((x) => x !== '');
  }
  // A quoted value may be followed by " # comment"; an unquoted one may end in one.
  const quoted = v.match(/^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*')\s*(?:#.*)?$/);
  return quoted ? unquote(quoted[1]) : v.replace(/\s+#.*$/, '');
};

export function parseFrontmatter(source) {
  const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) return { data: {}, body: source };
  const lines = m[1].split(/\r?\n/);
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const km = lines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!km) continue;
    const key = km[1];
    const rest = km[2].trim();
    if (/^[>|][+-]?$/.test(rest)) {
      const parts = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || lines[i + 1] === '')) parts.push(lines[++i].trim());
      data[key] = parts.join(rest.startsWith('>') ? ' ' : '\n').trim();
    } else if (rest === '') {
      const items = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) items.push(scalar(lines[++i].replace(/^\s*-\s+/, '')));
      data[key] = items.length ? items : '';
    } else {
      data[key] = scalar(rest);
    }
  }
  return { data, body: source.slice(m[0].length) };
}

/** Same id Astro's glob loader gives an entry: `slug` frontmatter, else the slugified path. */
export function postId(relativeFile, data) {
  if (typeof data.slug === 'string' && data.slug) return data.slug;
  return relativeFile
    .replace(/\.(md|mdx)$/, '')
    .split('/')
    .map((segment) => slug(segment))
    .join('/');
}

/** Every blog source file with parsed frontmatter, drafts included. */
export function readBlogPosts(rootDir = process.cwd()) {
  const base = join(rootDir, 'src/content/blog');
  const walk = (dir, prefix = '') =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? walk(join(dir, e.name), `${prefix}${e.name}/`)
        : /\.(md|mdx)$/.test(e.name)
          ? [`${prefix}${e.name}`]
          : [],
    );
  return walk(base).map((file) => {
    const { data, body } = parseFrontmatter(readFileSync(join(base, file), 'utf8'));
    return { file: `src/content/blog/${file}`, id: postId(file, data), data, body, draft: data.draft === true };
  });
}

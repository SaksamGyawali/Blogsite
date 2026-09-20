// Reads Markdown from content/, writes static HTML to dist/.
// Run with: npm run build
import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import matter from 'gray-matter';
import site from './site.config.mjs';
import * as T from './src/templates.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(ROOT, 'content');
const PUBLIC = path.join(ROOT, 'public');
const DIST = path.join(ROOT, 'dist');
const DEV = process.env.BLOG_DEV === '1';

marked.setOptions({ gfm: true, breaks: false });

/* ---------------------------------------------------------------- helpers */

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const fmt = (date, opts) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(date);

/** Give h2/h3 stable ids so sections are linkable. */
const addHeadingIds = (html) =>
  html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, level, inner) => {
    const id = slugify(inner.replace(/<[^>]+>/g, ''));
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });

/**
 * Sidenotes. Write them with footnote syntax — `[^1]` where the mark goes and
 * `[^1]: the note` on its own line — and they are set in the right margin
 * beside the paragraph that refers to them, rather than collected at the foot
 * of the page. The checkbox is what lets a narrow screen open one inline
 * without any JavaScript.
 */
// A definition runs to the first blank line, so a note can wrap over several
// lines in the source without being cut off at the first one.
const NOTE_DEF = /^\[\^([^\]\s]+)\]:[ \t]*(.*(?:\n(?![ \t]*$|\[\^).*)*)/gm;

function extractNotes(md) {
  const notes = new Map();
  const body = md.replace(NOTE_DEF, (_m, id, text) => {
    notes.set(id, text.trim().replace(/\n[ \t]*/g, ' '));
    return '';
  });
  return { body, notes };
}

function injectNotes(md, notes, slug) {
  let n = 0;
  return md.replace(/\[\^([^\]\s]+)\]/g, (whole, id) => {
    if (!notes.has(id)) return whole;
    const num = ++n;
    const key = `${slug}-${num}`;
    return (
      `<label class="note-mark" for="${key}">${num}</label>` +
      `<input class="note-toggle" type="checkbox" id="${key}">` +
      `<span class="sidenote"><span class="note-num">${num}</span>` +
      `${marked.parseInline(notes.get(id))}</span>`
    );
  });
}

/** First paragraph of the Markdown, flattened to plain text. */
const deriveExcerpt = (md, limit = 180) => {
  const para = md
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .find((b) => b && !b.startsWith('#') && !b.startsWith('```') && !b.startsWith('!['));
  if (!para) return '';
  const text = para
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[\^[^\]\s]+\]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > limit ? text.slice(0, limit).replace(/\s+\S*$/, '') + '…' : text;
};

const write = async (relPath, contents) => {
  const out = path.join(DIST, relPath);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, contents, 'utf8');
};

const page = (opts) => T.layout({ site, dev: DEV, ...opts });

/* ------------------------------------------------------------ read content */

async function readMarkdownDir(dir) {
  if (!existsSync(dir)) return [];
  const names = (await readdir(dir)).filter((n) => n.endsWith('.md'));
  return Promise.all(
    names.map(async (name) => ({
      name,
      // Normalise CRLF so line-based patterns behave the same on Windows.
      raw: (await readFile(path.join(dir, name), 'utf8')).replace(/\r\n/g, '\n'),
    }))
  );
}

function parsePost({ name, raw }) {
  const { data, content } = matter(raw);

  // Slug comes from the filename, minus an optional leading YYYY-MM-DD-.
  const base = name.replace(/\.md$/, '');
  const dateFromName = base.match(/^(\d{4}-\d{2}-\d{2})-/);
  const slug = data.slug || slugify(base.replace(/^\d{4}-\d{2}-\d{2}-/, ''));

  const dateValue = data.date || (dateFromName && dateFromName[1]);
  if (!dateValue) {
    throw new Error(`${name}: needs a "date:" in front matter, or a YYYY-MM-DD- filename prefix`);
  }
  const date = dateValue instanceof Date ? dateValue : new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${name}: could not parse the date "${dateValue}"`);
  }
  if (!data.title) throw new Error(`${name}: needs a "title:" in front matter`);

  const { body, notes } = extractNotes(content);
  const words = body.split(/\s+/).filter(Boolean).length;
  const tagNames = Array.isArray(data.tags)
    ? data.tags
    : typeof data.tags === 'string'
      ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

  return {
    slug,
    title: String(data.title),
    draft: data.draft === true,
    date,
    isoDate: date.toISOString(),
    shortDate: fmt(date, { month: 'short', day: '2-digit', year: 'numeric' }),
    stamp: date.toISOString().slice(0, 10),
    longDate: fmt(date, { month: 'long', day: 'numeric', year: 'numeric' }),
    path: `/posts/${slug}/`,
    url: `${site.url}/posts/${slug}/`,
    excerpt: data.description ? String(data.description) : deriveExcerpt(body),
    readingTime: Math.max(1, Math.round(words / site.wordsPerMinute)),
    tags: tagNames.map((t) => ({ name: String(t), slug: slugify(t) })),
    html: addHeadingIds(marked.parse(injectNotes(body, notes, slug))),
  };
}

function parsePage({ name, raw }) {
  const { data, content } = matter(raw);
  const slug = data.slug || slugify(name.replace(/\.md$/, ''));
  const { body, notes } = extractNotes(content);
  return {
    slug,
    title: String(data.title || slug),
    description: data.description ? String(data.description) : '',
    path: `/${slug}/`,
    html: addHeadingIds(marked.parse(injectNotes(body, notes, slug))),
  };
}

/* ------------------------------------------------------------------ feeds */

/**
 * A feed reader has no idea what "/tags/essay/" points at, so every
 * root-relative link and image in the full-text copy is made absolute.
 */
const absolutise = (html) =>
  html
    .replace(/href="\//g, `href="${site.url}/`)
    .replace(/src="\//g, `src="${site.url}/`);

/** Wrap post HTML for CDATA, escaping any literal ]]> inside it. */
const cdata = (html) => `<![CDATA[${html.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

function renderFeed(posts) {
  const items = posts
    .slice(0, 20)
    .map(
      (p) => `  <item>
    <title>${T.esc(p.title)}</title>
    <link>${T.esc(p.url)}</link>
    <guid isPermaLink="true">${T.esc(p.url)}</guid>
    <pubDate>${p.date.toUTCString()}</pubDate>
${p.tags.map((t) => `    <category>${T.esc(t.name)}</category>`).join('\n')}
    <description>${T.esc(p.excerpt)}</description>
    <content:encoded>${cdata(absolutise(p.html))}</content:encoded>
  </item>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>${T.esc(site.title)}</title>
  <link>${T.esc(site.url)}</link>
  <description>${T.esc(site.tagline)}</description>
  <language>${T.esc(site.language)}</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${T.esc(site.url)}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;
}

const renderSitemap = (paths) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${T.esc(site.url)}${T.esc(p)}</loc></url>`).join('\n')}
</urlset>
`;

/* ------------------------------------------------------------------ build */

export default async function build() {
  const started = Date.now();
  // On Windows a font or image the browser still holds can make the delete
  // fail with EBUSY/ENOTEMPTY; retry rather than leaving dist/ half-built.
  await rm(DIST, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  await mkdir(DIST, { recursive: true });

  const posts = (await readMarkdownDir(path.join(CONTENT, 'posts')))
    .map(parsePost)
    .filter((p) => DEV || !p.draft)
    .sort((a, b) => b.date - a.date);

  const pages = (await readMarkdownDir(path.join(CONTENT, 'pages'))).map(parsePage);

  // Home
  await write(
    'index.html',
    page({ title: site.title, path: '/', body: T.indexPage({ site, posts }) })
  );

  // Posts. The list is newest-first, so the newer neighbour is at i - 1.
  for (const [i, post] of posts.entries()) {
    await write(
      `posts/${post.slug}/index.html`,
      page({
        title: post.title,
        description: post.excerpt,
        path: post.path,
        body: T.postPage({ post, prev: posts[i + 1], next: posts[i - 1] }),
      })
    );
  }

  // Standalone pages (about, uses, ...)
  for (const p of pages) {
    await write(
      `${p.slug}/index.html`,
      page({
        title: p.title,
        description: p.description,
        path: p.path,
        body: T.staticPage({ page: p }),
      })
    );
  }

  // Tags
  const byTag = new Map();
  for (const post of posts) {
    for (const tag of post.tags) {
      if (!byTag.has(tag.slug)) byTag.set(tag.slug, { ...tag, posts: [] });
      byTag.get(tag.slug).posts.push(post);
    }
  }
  const tags = [...byTag.values()]
    .map((t) => ({ ...t, count: t.posts.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  await write('tags/index.html', page({ title: 'Tags', path: '/tags/', body: T.tagsPage({ tags }) }));

  for (const tag of tags) {
    await write(
      `tags/${tag.slug}/index.html`,
      page({
        title: `#${tag.name}`,
        description: `Posts tagged ${tag.name}.`,
        path: `/tags/${tag.slug}/`,
        body: T.tagPage({ tag, posts: tag.posts }),
      })
    );
  }

  // 404, feed, sitemap, robots
  await write('404.html', page({ title: 'Not found', path: '/404.html', body: T.notFoundPage() }));
  await write('feed.xml', renderFeed(posts));
  await write(
    'sitemap.xml',
    renderSitemap([
      '/',
      '/tags/',
      ...pages.map((p) => p.path),
      ...tags.map((t) => `/tags/${t.slug}/`),
      ...posts.map((p) => p.path),
    ])
  );
  await write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);

  // Static assets: everything in public/ is copied to the site root.
  if (existsSync(PUBLIC)) await cp(PUBLIC, DIST, { recursive: true });

  const draftCount = DEV ? posts.filter((p) => p.draft).length : 0;
  console.log(
    `built ${posts.length} post${posts.length === 1 ? '' : 's'}` +
      `${draftCount ? ` (${draftCount} draft)` : ''}, ` +
      `${pages.length} page${pages.length === 1 ? '' : 's'}, ` +
      `${tags.length} tag${tags.length === 1 ? '' : 's'} in ${Date.now() - started}ms`
  );
}

// Only build when this file is the entry point, so serve.mjs can import it.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch((err) => {
    console.error(`\nBuild failed: ${err.message}\n`);
    process.exit(1);
  });
}

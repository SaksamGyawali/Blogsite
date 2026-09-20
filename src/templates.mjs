// All HTML lives here. Plain template literals, no template engine.
//
// Every page is three zones across: a standing masthead column on the left
// (name, nav, colophon — it stays put while you read), the text at a reading
// measure in the middle, and an annotation margin on the right holding dates,
// article metadata and sidenotes. No zone is decorative; if there is nothing
// to put in one, it is not drawn.

export const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const LIVE_RELOAD = `
<script>
  new EventSource('/__reload').onmessage = () => location.reload();
</script>`;

/**
 * Runs in <head>, before anything paints, so a reader who chose dark never
 * sees a white flash on the way in. It also marks the document as scripted,
 * which is what reveals the switch — it is never shown as a dead control.
 */
const THEME_BOOT = `<script>
(function () {
  var d = document.documentElement;
  d.className += ' js';
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') d.dataset.theme = t;
  } catch (e) {}
})();
</script>`;

/** The switch itself. Remembers the choice; falls back to the system setting. */
const THEME_SWITCH = `<script>
(function () {
  var d = document.documentElement;
  var system = matchMedia('(prefers-color-scheme: dark)');
  var buttons = [].slice.call(document.querySelectorAll('[data-theme-set]'));

  function active() {
    return d.dataset.theme || (system.matches ? 'dark' : 'light');
  }

  function sync() {
    var now = active();
    buttons.forEach(function (b) {
      var on = b.dataset.themeSet === now;
      b.classList.toggle('is-current', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      d.dataset.theme = b.dataset.themeSet;
      try { localStorage.setItem('theme', b.dataset.themeSet); } catch (e) {}
      sync();
    });
  });

  system.addEventListener('change', sync);
  sync();
})();
</script>`;

/** A nav item is "current" on its own page; Posts also covers every post. */
const isCurrent = (href, pagePath) =>
  href === pagePath || (href === '/' && pagePath.startsWith('/posts/'));

/** The shared page shell: <head>, masthead, footer. */
export function layout({ site, title, description, path: pagePath, body, dev }) {
  const fullTitle = title === site.title ? site.title : `${title} · ${site.title}`;
  const canonical = `${site.url}${pagePath}`;
  const desc = description || site.tagline;
  const home = pagePath === '/';

  const nav = site.nav
    .map((l) => {
      const current = isCurrent(l.href, pagePath);
      return `<a href="${esc(l.href)}"${current ? ' class="is-current" aria-current="page"' : ''}>${esc(l.label)}</a>`;
    })
    .join('');

  const social = site.social
    .map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('');

  const wordmark = `<a href="/">${esc(site.title)}</a>`;

  return `<!doctype html>
<html lang="${esc(site.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
${THEME_BOOT}
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="/feed.xml">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/newsreader-normal-400-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/ibmplexmono-normal-400-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/fonts.css">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="page">
  <header class="masthead">
    ${home ? `<h1 class="wordmark">${wordmark}</h1>` : `<p class="wordmark">${wordmark}</p>`}
    <p class="tagline">${esc(site.tagline)}</p>
    <nav class="masthead-nav">${nav}</nav>
  </header>
  <main id="main">
${body}
  </main>
  <footer class="colophon">
    <nav>${social}</nav>
    <div class="theme" role="group" aria-label="Colour scheme">
      <button type="button" data-theme-set="light">Light</button>
      <button type="button" data-theme-set="dark">Dark</button>
    </div>
    <p>&copy; ${new Date().getFullYear()} ${esc(site.author)}</p>
  </footer>
</div>
${THEME_SWITCH}
${dev ? LIVE_RELOAD : ''}
</body>
</html>
`;
}

/** Anything set in the right-hand margin, level with the block it precedes. */
const marginNote = (inner, cls = '') =>
  `<aside class="margin${cls ? ` ${cls}` : ''}">${inner}</aside>`;

const stamp = (post) =>
  `<time class="stamp" datetime="${esc(post.isoDate)}">${esc(post.stamp)}</time>`;

const tagList = (tags) =>
  `<ul class="margin-tags">${tags
    .map((t) => `<li><a href="/tags/${esc(t.slug)}/">${esc(t.name)}</a></li>`)
    .join('')}</ul>`;

/** What the margin carries beside a post: when, how long, what about. */
const postMeta = (post, cls = '') =>
  marginNote(
    `${stamp(post)}<p class="margin-read">${post.readingTime} min</p>` +
      (post.tags.length ? tagList(post.tags) : ''),
    cls
  );

/**
 * The index is set as a table of contents: title and date on one baseline,
 * joined by a leader, the way a book's contents page does it. The leader is
 * what ties a date to its title instead of leaving it floating nearby.
 */
const entry = (post, lead = false) => `  <li class="entry">
    <h2 class="entry-heading">
      <a class="leader" href="${esc(post.path)}">
        <span class="leader-title ${lead ? 'display' : 'entry-title'}">${esc(post.title)}</span>
        <span class="leader-fill" aria-hidden="true"></span>
        <span class="leader-meta">
          <time class="leader-date" datetime="${esc(post.isoDate)}">${esc(post.stamp)}</time>
          <span class="leader-read">${post.readingTime} min</span>
        </span>
      </a>
    </h2>
    ${post.excerpt ? `<p class="entry-excerpt">${esc(post.excerpt)}</p>` : ''}
  </li>`;

const entries = (posts, withLead = false) => `<ol class="entries">
${posts.map((p, i) => entry(p, withLead && i === 0)).join('\n')}
</ol>`;

export function indexPage({ posts }) {
  if (!posts.length) return `<p class="empty">No posts yet.</p>`;
  const [lead, ...rest] = posts;
  return [
    `<ol class="entries entries-lead">\n${entry(lead, true)}\n</ol>`,
    rest.length ? entries(rest) : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function postPage({ post, prev, next }) {
  const meta = postMeta(post, 'margin-meta');

  const pager =
    prev || next
      ? `<nav class="pager">
  ${prev ? `<a class="pager-prev" href="${esc(prev.path)}"><span>Older</span>${esc(prev.title)}</a>` : '<span></span>'}
  ${next ? `<a class="pager-next" href="${esc(next.path)}"><span>Newer</span>${esc(next.title)}</a>` : '<span></span>'}
</nav>`
      : '';

  return `<article class="post">
  <h1 class="display">${esc(post.title)}</h1>
  <div class="prose">
    ${meta}
${post.html}
  </div>
</article>
${pager}`;
}

export function staticPage({ page }) {
  return `<article class="post">
  <h1 class="display">${esc(page.title)}</h1>
  <div class="prose">
${page.html}
  </div>
</article>`;
}

export function tagsPage({ tags }) {
  if (!tags.length) return `<p class="empty">No tags yet.</p>`;
  // The nav already says "Tags"; this heading is here for structure, not sight.
  return `<h1 class="sr-only">Tags</h1>
<ol class="entries">
${tags
  .map(
    (t) => `  <li class="entry">
    <h2 class="entry-heading">
      <a class="leader" href="/tags/${esc(t.slug)}/">
        <span class="leader-title entry-title">${esc(t.name)}</span>
        <span class="leader-fill" aria-hidden="true"></span>
        <span class="leader-meta"><span class="leader-date">${t.count} post${t.count === 1 ? '' : 's'}</span></span>
      </a>
    </h2>
  </li>`
  )
  .join('\n')}
</ol>`;
}

export function tagPage({ tag, posts }) {
  return `<h1 class="display tag-title">${esc(tag.name)}</h1>
<p class="tag-count">${posts.length} post${posts.length === 1 ? '' : 's'}</p>
${entries(posts)}`;
}

export function notFoundPage() {
  return `<h1 class="display">Not found</h1>
<div class="prose"><p>That page does not exist. <a href="/">Back to the posts</a>.</p></div>`;
}

# blog

A minimal Markdown blog. Posts are files in `content/`, a build script turns
them into static HTML in `dist/`. No database, no framework. The only
JavaScript in the output is the ~20 inline lines that run the light/dark
switch.

## Commands

```bash
npm install                    # once
npm run dev                    # http://localhost:3000, rebuilds + reloads on save
npm run new -- "Post title"    # scaffold content/posts/YYYY-MM-DD-post-title.md
npm run build                  # write the finished site to dist/
```

## Layout

```
content/posts/   one .md file per post   ->  /posts/<slug>/
content/pages/   standalone pages        ->  /<slug>/
public/          copied to the site root (style.css, images, favicon)
src/templates.mjs   all the HTML
site.config.mjs     title, nav, links, site URL
build.mjs           the generator (~250 lines)
serve.mjs           dev server with live reload
dist/               build output — generated, not committed
```

## Front matter

Every post starts with a metadata block between `---` fences:

```markdown
---
title: "How this blog works"
date: 2026-09-17
tags: [meta, markdown]
description: "Optional. Overrides the auto excerpt and the meta description."
draft: false
slug: "optional-custom-url"
---
```

`title` is required. `date` is required too, but a `YYYY-MM-DD-` filename
prefix supplies it. `draft: true` posts appear in `npm run dev` and are left
out of `npm run build`.

## Sidenotes

Notes are set in the right margin beside the line that refers to them, not
collected at the foot of the page. Write them with footnote syntax:

```markdown
...and a build script turns that folder into plain HTML.[^1]

[^1]: The note text. Leave a blank line after it.
```

A definition runs until the first blank line, so **always leave a blank line
after one** — otherwise it swallows the rest of the paragraph. On a narrow
screen the margin disappears and tapping the number opens the note inline; that
is a checkbox and a CSS rule, not JavaScript.

## What gets generated

Home page, one page per post, one page per tag plus a tag index, standalone
pages, `404.html`, `feed.xml` (RSS), `sitemap.xml`, and `robots.txt`.

## The RSS feed

`feed.xml` is a machine-readable copy of your posts. Someone pastes your site
into a reader app (NetNewsWire, Feedly, Reeder, Thunderbird) and your new posts
show up there — no account, no algorithm, no email list. It is the oldest and
quietest way to let people follow a blog, and it costs you nothing: the build
writes it every time.

It is wired up in three places, all automatic:

- `feed.xml` at the site root, rebuilt on every `npm run build`
- a `<link rel="alternate">` in every page's `<head>`, so readers and browser
  extensions find it without being told
- the **RSS** link in the footer, for people who want to copy the address

Each item carries the full post, not just an excerpt, so it can be read inside
the reader. Root-relative links are rewritten to absolute ones on the way in,
because a reader has no idea what `/tags/essay/` would mean.

Nothing to maintain. Write a post, push, and subscribers get it.

## Deploying

The build output is a plain folder of files, so any static host works. This
repo is set up for Vercel (`vercel.json` sets the build command, output folder
and cache headers).

**First time — push the repo:**

```bash
cd C:\Users\Dell\Desktop\blog
git add -A
git commit -m "My blog"
git remote add origin https://github.com/sg03230122-spec/blog.git
git push -u origin main
```

Create the empty `blog` repo on GitHub first — no README and no .gitignore,
since this repo already has both.

**Then connect Vercel:** vercel.com → Add New → Project → import `blog`. It
reads `vercel.json`, so leave every field alone and press Deploy. About a
minute later you get a `*.vercel.app` address.

**Every time after that:** `git push`. Vercel rebuilds and publishes by itself.

### One thing to keep in sync

`url` in `site.config.mjs` must match the address the site is actually served
from. It is what the RSS feed, the sitemap and `robots.txt` use to write
absolute links — get it wrong and they point at the wrong domain. Update it
whenever the domain changes (for example when you attach a custom one), then
push.

### Other hosts

**Cloudflare Pages / Netlify** — connect the repo, set build command
`npm run build` and output directory `dist`.

**GitHub Pages** — needs a workflow file, and on a project site the blog is
served from `/<repo>/`, which breaks the root-relative links in the templates.
Use a `<username>.github.io` repo or a custom domain if you go that way.

## Styling

One stylesheet: `public/style.css`. Everything is driven by custom properties
at the top.

| Variable | Light | Dark | Role |
| --- | --- | --- | --- |
| `--paper` | `#fcfcfa` | `#0f0f0e` | The page |
| `--ink` | `#171612` | `#edebe5` | Body text |
| `--muted` | `#6f6a5e` | `#918c81` | Excerpts, dates, chrome |
| `--faint` | `#e3e0d8` | `#2a2926` | Hairlines |
| `--tint` | `#f4f3ef` | `#181815` | Raised surfaces |
| `--accent` | `#c1391c` | `#ff7a4d` | One job: links and sidenote marks |
| `--code-bg` | `#16161a` | `#131317` | Code, dark in **both** modes |

The palette is taken from
[backend-from-first-principle.vercel.app](https://backend-from-first-principle.vercel.app/):
a near-neutral warm paper, a brick accent that brightens to coral in the dark,
and code blocks that keep their own dark ground on a light page. Every pair
clears WCAG AA against its background. For warm cream paper instead, the old
values were `#fdfbf7` / `#241a12` / `#8b7c6c` / `#e6ded1` / `#f1ebdf` with a
`#94361b` accent, and `--code-bg` set to `var(--tint)`.

Sizing tokens:

| Variable | Role |
| --- | --- |
| `--measure` | The text column (33rem) |
| `--margin` | The annotation column to its right (9rem) |
| `--masthead` | The standing left column (10.5rem) |
| `--f0`…`--f7` | A 1.25 type ladder; nothing is sized off it |

Two faces, one rule: **serif is prose, monospace is structure** — dates,
reading time, tags, section heads, code and table headers are all mono.
Newsreader and IBM Plex Mono are self-hosted in `public/fonts` (392 KB, latin
subsets), so the site makes no external requests. To change them, drop new
`.woff2` files in that folder and edit `public/fonts.css`.

The layout is three zones across: the masthead column stands on the left, the
text sets at a reading measure, and the right margin carries annotations. If a
zone has nothing to hold on a given page, it is not drawn.

Below 64rem the three zones fold into one column.

## Light and dark

Both palettes live at the top of `style.css` as `--*-light` and `--*-dark`
pairs, defined once. The three blocks under them only map those onto the
working tokens:

| Reader state | What applies |
| --- | --- |
| No choice made | Follows `prefers-color-scheme` |
| Picked Light | Stays light even if the system is dark |
| Picked Dark | Stays dark even if the system is light |

The choice is stored in `localStorage` under `theme` and shown by the switch in
the bottom-left, which marks the active mode the same way the nav marks the
current page. A small script in `<head>` applies the stored choice before the
page paints, so there is no flash of the wrong palette; it also adds a `js`
class to `<html>`, which is what reveals the switch — with JavaScript off the
control is hidden rather than dead, and the site simply follows the system.

To change a colour, edit one line in the pair at the top. To rename the
buttons, edit `THEME_SWITCH`'s markup in `src/templates.mjs`.

// Development server: builds the site, serves dist/, rebuilds on change,
// and reloads the browser. Run with: npm run dev
import http from 'node:http';
import path from 'node:path';
import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const WATCHED = ['content', 'public', 'src', 'site.config.mjs', 'build.mjs'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

/* ------------------------------------------------------------------ build */

const clients = new Set();

function spawnBuild() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'build.mjs')], {
      cwd: ROOT,
      env: { ...process.env, BLOG_DEV: '1' },
      stdio: 'inherit',
    });
    child.on('close', (code) => resolve(code === 0));
  });
}

// A build clears dist/ before writing it, so two running at once will delete
// each other's output. Only ever run one, and remember if another was asked
// for while it was busy.
let building = null;
let queued = false;

function rebuild() {
  if (building) {
    queued = true;
    return building;
  }
  building = spawnBuild().then(async (ok) => {
    building = null;
    if (queued) {
      queued = false;
      return rebuild();
    }
    return ok;
  });
  return building;
}

async function rebuildAndReload() {
  const ok = await rebuild();
  if (!ok) return;
  for (const res of clients) res.write('data: reload\n\n');
}

/* ----------------------------------------------------------------- server */

/** Map a URL path to a file in dist/, honouring clean URLs. */
async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  let target = path.join(DIST, normalized);

  // Never serve outside dist/.
  if (!target.startsWith(DIST)) return null;

  try {
    const info = await stat(target);
    if (info.isDirectory()) target = path.join(target, 'index.html');
  } catch {
    // /about -> /about/index.html, /feed.xml -> as written
    if (!path.extname(target)) target = path.join(target, 'index.html');
  }

  try {
    await stat(target);
    return target;
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/__reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 500\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  const file = await resolveFile(req.url || '/');

  if (!file) {
    const notFound = await readFile(path.join(DIST, '404.html')).catch(() => 'Not found');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(notFound);
    return;
  }

  const body = await readFile(file);
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(body);
});

/* ------------------------------------------------------------------ watch */

let timer = null;
const scheduleRebuild = () => {
  clearTimeout(timer);
  timer = setTimeout(rebuildAndReload, 80);
};

for (const entry of WATCHED) {
  try {
    watch(path.join(ROOT, entry), { recursive: true }, scheduleRebuild);
  } catch {
    // The entry may not exist yet; that is fine.
  }
}

await rebuild();
server.listen(PORT, () => {
  console.log(`\n  Blog running at http://localhost:${PORT}`);
  console.log('  Editing content/ rebuilds and reloads the page. Ctrl+C to stop.\n');
});

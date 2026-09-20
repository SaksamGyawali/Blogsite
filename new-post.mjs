// Scaffolds a new post file. Run with: npm run new -- "My post title"
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const title = process.argv.slice(2).join(' ').trim();

if (!title) {
  console.error('Usage: npm run new -- "My post title"');
  process.exit(1);
}

const slug = title
  .toLowerCase()
  .replace(/[^\w\s-]/g, '')
  .replace(/[\s_-]+/g, '-')
  .replace(/^-+|-+$/g, '');

const date = new Date().toISOString().slice(0, 10);
const file = path.join(ROOT, 'content', 'posts', `${date}-${slug}.md`);

if (existsSync(file)) {
  console.error(`Already exists: ${path.relative(ROOT, file)}`);
  process.exit(1);
}

const template = `---
title: "${title.replace(/"/g, '\\"')}"
date: ${date}
tags: []
draft: true
---

Write the post here. Drafts are visible with \`npm run dev\` but are left out of
\`npm run build\`, so flip \`draft\` to \`false\` when it is ready to publish.
`;

await mkdir(path.dirname(file), { recursive: true });
await writeFile(file, template, 'utf8');
console.log(`Created ${path.relative(ROOT, file)}`);

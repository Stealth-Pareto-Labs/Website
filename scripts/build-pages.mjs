import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');

async function copyTree(source, destination) {
  if (relative(root, source).replaceAll('\\', '/') === 'assets/build-modal.js') return;
  const sourceStat = await stat(source);
  if (sourceStat.isDirectory()) {
    await mkdir(destination, { recursive: true });
    for (const item of await readdir(source)) {
      await copyTree(join(source, item), join(destination, item));
    }
  } else {
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination);
  }
}

function cleanPageUrl(value) {
  const absolutePrefix = 'https://www.trypareto.ai';
  const prefix = value.startsWith(absolutePrefix) ? absolutePrefix : '';
  const pathValue = prefix ? value.slice(prefix.length) : value;
  if (!prefix && /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) return value;
  const suffixIndex = pathValue.search(/[?#]/);
  const pathname = suffixIndex === -1 ? pathValue : pathValue.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : pathValue.slice(suffixIndex);
  if (!pathname.endsWith('.html')) return value;
  let cleanPath = pathname.replace(/\.html$/, '');
  if (cleanPath.endsWith('/index')) cleanPath = cleanPath.slice(0, -5);
  return prefix + cleanPath + suffix;
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const item of await readdir(root)) {
  const source = join(root, item);
  if ((await stat(source)).isFile() && item.endsWith('.html')) {
    await copyTree(source, join(output, item));
  }
}

for (const directory of ['assets', 'industries', 'research', 'og']) {
  await copyTree(join(root, directory), join(output, directory));
}

for (const file of ['robots.txt', 'sitemap.xml', '_m.png']) {
  await copyTree(join(root, file), join(output, file));
}

const pageFiles = [];
async function collect(directory) {
  for (const item of await readdir(directory)) {
    const path = join(directory, item);
    if ((await stat(path)).isDirectory()) await collect(path);
    else pageFiles.push(relative(output, path));
  }
}
await collect(output);

const htmlFiles = pageFiles.filter((file) => file.endsWith('.html'));
const followMarkup = [
  '<div class="nl-follow-footer">',
  '  <span class="nl-follow-label">Follow Pareto</span>',
  '  <nav class="nl-social" aria-label="Follow Pareto Labs">',
  '    <a href="https://www.linkedin.com/company/trypareto-ai/" target="_blank" rel="noopener noreferrer">LinkedIn</a>',
  '    <a href="https://x.com/paretolabsx" target="_blank" rel="noopener noreferrer">X</a>',
  '    <a href="https://discord.gg/z3fgyDuGM" target="_blank" rel="noopener noreferrer">Discord</a>',
  '  </nav>',
  '</div>',
].join('\n');
for (const file of htmlFiles) {
  const path = join(output, file);
  const html = await (await import('node:fs/promises')).readFile(path, 'utf8');
  const cleanLinks = html.replace(/\b(href|content)=(['"])(.*?)\2/g, (match, attribute, quote, value) => {
    const cleaned = cleanPageUrl(value);
    return cleaned === value ? match : `${attribute}=${quote}${cleaned}${quote}`;
  });
  const withFollowFooter = cleanLinks.includes('class="nl-follow-footer"')
    ? cleanLinks
    : cleanLinks.replace(/(<p\b[^>]*class="[^"]*\bfoot-copy\b[^"]*"[^>]*>)/, `${followMarkup}\n$1`);
  await writeFile(path, withFollowFooter
    .replace(/\s*<script\b[^>]*src="\/assets\/build-modal\.js[^"]*"[^>]*><\/script>/g, '')
    .replace(/\s*<script defer src="\/_vercel\/insights\/script\.js"><\/script>/g, ''), 'utf8');
}

const sitemapPath = join(output, 'sitemap.xml');
const sitemap = await (await import('node:fs/promises')).readFile(sitemapPath, 'utf8');
await writeFile(sitemapPath, sitemap.replace(/https:\/\/www\.trypareto\.ai\/[^<\s]+/g, (url) => cleanPageUrl(url)), 'utf8');

await writeFile(join(output, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | Pareto Labs</title><body><main><h1>Page not found</h1><p>The page you requested could not be found.</p><a href="/">Return to Pareto Labs</a></main></body></html>\n', 'utf8');
await writeFile(join(output, '_routes.json'), `${JSON.stringify({ version: 1, include: ['/api/site-intake'], exclude: [] }, null, 2)}\n`, 'utf8');
await writeFile(join(output, '_redirects'), [
  '/industries/consumer-brands-retail.html /industries 307',
  '/industries/healthcare.html /industries 307',
  '/industries/legal.html /industries 307',
  '/private-equity.html / 307',
].join('\n') + '\n', 'utf8');

console.log(`Built ${pageFiles.length} public files into ${relative(root, output)}.`);

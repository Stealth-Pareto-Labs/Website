import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');

test('Pages build publishes only public site files with Pages routing rules', () => {
  rmSync(dist, { recursive: true, force: true });
  execFileSync(process.execPath, ['scripts/build-pages.mjs'], { cwd: root, stdio: 'pipe' });

  for (const file of ['index.html', 'experts.html', 'privacy.html', 'terms.html', 'assets/site-intake.js', 'assets/industries/hero.mp4', 'industries/healthcare.html', 'research/the-learning-layer/index.html', 'og/pareto-labs-v2.png', 'robots.txt', 'sitemap.xml', '404.html', '_routes.json', '_redirects']) {
    assert.ok(existsSync(join(dist, file)), `expected public file ${file}`);
  }
  for (const forbidden of ['api', 'backend', 'docs', 'scripts', 'supabase', '.git', '.env', 'vercel.json', 'README.md']) {
    assert.ok(!existsSync(join(dist, forbidden)), `source-only path ${forbidden} must not be deployed`);
  }
  assert.ok(!existsSync(join(dist, 'assets/build-modal.js')), 'the unused legacy modal with a hard-coded Apps Script URL must not be deployed');

  const routes = JSON.parse(readFileSync(join(dist, '_routes.json'), 'utf8'));
  assert.deepEqual(routes, { version: 1, include: ['/api/site-intake'], exclude: [] });
  const redirects = readFileSync(join(dist, '_redirects'), 'utf8');
  assert.match(redirects, /^\/industries\/healthcare\.html \/industries 307$/m);
  assert.match(redirects, /^\/private-equity\.html \/ 307$/m);
  assert.doesNotMatch(redirects, / 200(?:\s|$)/m, 'Pages clean URLs handle HTML aliases without costly Function rewrites');

  const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
  assert.doesNotMatch(sitemap, /\.html(?:<|\/)/, 'sitemap URLs must use Cloudflare Pages clean URLs');
  const homepage = readFileSync(join(dist, 'index.html'), 'utf8');
  const followStart = homepage.indexOf('<div class="nl-follow-footer"');
  const navEnd = homepage.indexOf('</nav>', homepage.indexOf('<nav id="nav">'));
  const footerCopy = homepage.indexOf('<p class="foot-copy">');
  assert.ok(followStart > navEnd && followStart < footerCopy, 'Follow Pareto must be in the page footer, before the copyright');
  assert.match(homepage.slice(followStart, footerCopy), /LinkedIn[\s\S]*>X</);
  assert.match(homepage.slice(followStart, footerCopy), /Discord/);
  const newsletterScript = readFileSync(join(dist, 'assets/newsletter.js'), 'utf8');
  assert.doesNotMatch(newsletterScript, /nl-follow-footer|linkedin\.com\/company|paretolabsx|discord\.gg/, 'newsletter script must not inject social links at runtime');
  const htmlFiles = [];
  const collectHtml = (directory, prefix = '') => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) collectHtml(join(directory, entry.name), join(prefix, entry.name));
      else if (entry.name.endsWith('.html')) htmlFiles.push(join(prefix, entry.name));
    }
  };
  collectHtml(dist);
  for (const file of htmlFiles) {
    const html = readFileSync(join(dist, file), 'utf8');
    assert.doesNotMatch(html, /<link rel="canonical" href="[^"]*\.html/i, `${file} canonical must use a clean URL`);
    assert.doesNotMatch(html, /href="(?:https:\/\/www\.trypareto\.ai)?[^"]*\.html(?:[?#][^"]*)?"/i, `${file} internal links must use clean URLs`);
    assert.doesNotMatch(html, /\/_vercel\/insights\/script\.js/, `${file} must not load Vercel analytics on Pages`);
  }
});

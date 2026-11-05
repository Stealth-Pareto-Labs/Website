# Cloudflare Pages Migration Design

## Intent
Move the static Website and its same-origin intake API from Vercel hosting to Cloudflare Pages, reduce reliance on Vercel's free quota, and preserve page access and form behavior.

## Approved architecture
- Build a restricted static artifact in `dist/`; only public HTML, assets, industry/research pages, sitemap, robots file, and Cloudflare routing files are deployed.
- Serve company, expert, and newsletter submissions through a Cloudflare Pages Function at `/api/site-intake`.
- Keep one shared validation/proxy implementation for both the existing Vercel adapter and the Cloudflare adapter during migration.
- Route Pages Functions only for `/api/site-intake`; static requests stay on Pages static delivery.
- Use Cloudflare Pages clean URLs as canonical routes; rewrite internal links, canonical/OG URLs, and sitemap entries in the deploy artifact. Legacy `.html` requests use Pages' built-in extensionless redirects.
- Preserve explicit retired-page 307 redirects through Pages `_redirects`.
- Create a preview Pages project and verify preview URLs before attaching production hostnames or changing DNS.

## Constraints and gates
- Do not change production DNS or attach `trypareto.ai` / `www.trypareto.ai` until the preview and live intake integrations are verified.
- Do not put HubSpot, Resend, Apps Script, or shared-secret credentials into the static build, git, command output, or browser code.
- Keep receipt emails disabled pending the user's approval of the two email drafts.
- Preserve explicit-only newsletter consent and the current `/api/site-intake` request contract.
- Cloudflare account access is through Wrangler OAuth. Current access includes Pages write and zone read but not zone write or DNS record read. Browser access is unavailable in this session.
- Cloudflare Pages direct upload is the CLI deployment path available here. The deploy process must remain reproducible from this repository.
- Analytics must not keep referencing Vercel. Enable Cloudflare Web Analytics after the Pages project is connected, using an account method with the required analytics permission.
- Do not route static HTML pages through Functions just to preserve `.html` spelling; static requests remain outside Workers request quotas.

## Acceptance criteria
- A clean build creates a `dist/` containing only public site output, `_redirects`, and `_routes.json`; internal links, canonical/OG URLs, and sitemap use clean paths.
- Pages Function validates requests, handles POST only, supports company/expert/newsletter payloads, and uses Pages environment bindings.
- Local Pages preview serves the site, forms' same-origin API route, static pages, 404 behavior, legacy redirects, and clean URLs.
- CLI preview deployment passes HTTP checks for the homepage and representative nested pages. API validation/error behavior is checked without making real CRM or email submissions.
- Production custom domains and DNS remain untouched until credentials and access allow a real controlled HubSpot smoke test and Cloudflare analytics setup.

## Migration ruling

Cloudflare Pages automatically redirects `.html` paths to extensionless paths. Pages `_redirects` 200 proxy rules did not preserve the `.html` request in the local runtime and could loop with the built-in behavior. The deploy artifact therefore uses Cloudflare clean URLs as canonicals and updates internal links and the sitemap; legacy `.html` requests continue resolving through Cloudflare's native redirect. This avoids charging static page views to a Pages Function.

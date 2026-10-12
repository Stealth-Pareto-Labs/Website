#!/usr/bin/env python3
"""Structural and editorial checks for trypareto.ai.

Run from the repo root:  python scripts/check-site.py
Exits non-zero if any check fails.

This is the site's test suite. It encodes the rules that are easy to break by
hand across ~24 pages: balanced markup, resolvable assets, a consistent nav,
pages that are meant to be unreachable staying unreachable, and the editorial
constraints on the infrastructure pages.
"""
import glob
import json
import os
import re
import sys
import xml.dom.minidom
from html.parser import HTMLParser

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
        'meta', 'param', 'source', 'track', 'wbr'}

# Pages removed from the live site but kept in the repo.
RETIRED = ['industries/consumer-brands-retail.html', 'industries/healthcare.html',
           'industries/legal.html', 'private-equity.html']

NEW_PAGES = ['infrastructure.html', 'inference.html', 'cloud.html']

# Exactly these, in this order, on every page.
NAV = ['/infrastructure.html', '/platform.html', '/industries.html',
       '/experts.html', '/research.html']

FOOTER_MUST_HAVE = ['/infrastructure.html', '/inference.html', '/cloud.html']

# Standalone pages that deliberately carry no site nav or footer.
NO_CHROME = {'research/the-learning-layer/index.html'}

# Em dashes are banned in body copy on the marketing and product pages. The two
# research essays and the legal pages are long-form authored prose where the dash
# is a legitimate choice, so they are exempt until the owner says otherwise.
# Only the retired page is exempt now. The two research essays and the legal
# pages were done last, by hand, one dash at a time; private-equity.html is
# unreachable (307 to /) and kept only so restoring it stays a one-line change.
DASH_EXEMPT = {'private-equity.html'}

# Gold belongs on DARK backgrounds, where it measures 9.11:1 and is the brand.
# On cream it measured 1.92:1 and never passed, so cream uses the slate accent.
# A gold rule is allowed when its selector names a dark context or an illustration.
GOLD_OK_FILES = {'assets/sensors.css'}
DARK_CONTEXT = ('dark', 'on-dark', 'cta-final', 'ih ', '.ih', 'ind-hero', 'ind-cta',
                'icard-dark', 'nav-links a:hover', 'btn-ghost-cream', 'c-key',
                'lrow', 'lbar', 'plw', 'eyebrow', 'cta ', 'prog',
                'icard-num', 'icard-cta', 'principle', 'scroll-cue', 'os-',
                'section-ink')

# Selectors allowed to keep gold: the animated comet/orbit illustration on
# industries.html and the sensor markers. Both are illustration, not UI.
GOLD_OK_SELECTORS = ('loop-', 'comet', 'orbit', 'pulse-ring', 'sx-')

# Models the catalogue marks blocked, or whose licence forbids commercial use.
# Advertising these is a factual error and, for NLLB, a licence exposure.
BLOCKED_MODELS = ['NLLB', 'LLaVA']

# The inference gateway must only ever be shown on a domain Pareto controls.
ALLOWED_API_HOSTS = ['trypareto.ai', 'pareto.ci']

# Editorial rules for the infrastructure pages + the homepage.
FORBIDDEN = [
    (r'ci-abj', 'internal region code'),
    (r'(?i)\bnvidia\b', 'NVIDIA'),
    (r'(?i)\babidjan\b', 'pins the platform to one city'),
    (r'(?i)\bcoming soon\b', 'roadmap language'),
    (r'(?i)\broadmap\b', 'roadmap language'),
    (r'(?i)\bwaitlist\b', 'roadmap language'),
    (r'(?i)\bin preview\b', 'roadmap language'),
    (r'(?i)\bwill (?:soon|be able|support|offer)\b', 'future tense'),
    (r'\$\s?\d', 'pricing'),
    (r'(?i)per million tokens', 'pricing'),
    (r'(?i)/\s?M tokens', 'pricing'),
]

failures = []
checked = {'pages': 0, 'checks': 0}


def fail(where, msg):
    failures.append('%-46s %s' % (where, msg))


def pages():
    found = (glob.glob('*.html') + glob.glob('industries/*.html') +
             glob.glob('research/**/*.html', recursive=True))
    return sorted(p.replace(os.sep, '/') for p in found)


def strip_comments(s):
    return re.sub(r'<!--.*?-->', '', s, flags=re.S)


def check_balance(path, src):
    stack = []

    class P(HTMLParser):
        def handle_starttag(self, tag, attrs):
            if tag not in VOID:
                stack.append(tag)

        def handle_endtag(self, tag):
            if tag in VOID:
                return
            if stack and stack[-1] == tag:
                stack.pop()
            elif tag in stack:
                while stack and stack.pop() != tag:
                    pass
            else:
                stack.append('!unmatched</%s>' % tag)

    p = P(convert_charrefs=True)
    p.feed(src)
    left = [t for t in stack if t not in ('html', 'body', 'head')]
    if left:
        fail(path, 'unbalanced markup: %s' % left[:5])


def check_assets(path, live):
    pat = r'(?:href|src)="(/assets/[^"#?]+)"|url\((/assets/[^)]+)\)'
    for m in re.finditer(pat, live):
        ref = (m.group(1) or m.group(2)).lstrip('/')
        if not os.path.exists(ref):
            fail(path, 'missing asset %s' % ref)


def check_retired(path, live):
    for r in RETIRED:
        if re.search(r'href="/%s"' % re.escape(r), live):
            fail(path, 'live link to retired page %s' % r)


def check_nav(path, live):
    if path in NO_CHROME:
        return
    nav = re.search(r'<ul class="nav-links">(.*?)</ul>', live, re.S)
    if not nav:
        fail(path, 'no nav-links block')
        return
    block = nav.group(1)
    hrefs = [h for h in re.findall(r'href="([^"]+)"', block) if h in NAV]
    if hrefs != NAV:
        fail(path, 'nav is %s, expected %s' % (hrefs, NAV))
    active = len(re.findall(r'class="active"', block))
    if active > 1:
        fail(path, '%d nav items marked active, expected at most 1' % active)


def check_footer(path, live):
    foot = re.search(r'<ul class="foot(?:er)?-links">(.*?)</ul>', live, re.S)
    if not foot:
        return  # not every page carries the long footer
    hrefs = set(re.findall(r'href="([^"]+)"', foot.group(1)))
    for needed in FOOTER_MUST_HAVE:
        if needed not in hrefs:
            fail(path, 'footer missing %s' % needed)


def _mp4_tables(b):
    """Return (sample_sizes, chunk_offsets, samples_per_chunk, nal_len) or None."""
    import struct

    def walk(start, end, want, depth=0):
        i = start
        while i + 8 <= end:
            size, typ = struct.unpack_from('>I4s', b, i)
            hs = 8
            if size == 1:
                size = struct.unpack_from('>Q', b, i + 8)[0]
                hs = 16
            elif size == 0:
                size = end - i
            if size < hs or i + size > end:
                return
            typ = typ.decode('latin1')
            if typ == want:
                yield i + hs, i + size
            elif typ in ('moov', 'trak', 'mdia', 'minf', 'stbl'):
                for r in walk(i + hs, i + size, want, depth + 1):
                    yield r
            elif typ == 'stsd':
                for r in walk(i + hs + 8, i + size, want, depth + 1):
                    yield r
            elif typ == 'avc1':
                for r in walk(i + hs + 78, i + size, want, depth + 1):
                    yield r
            i += size

    end = len(b)
    nal = None
    for o, e in walk(0, end, 'avcC'):
        nal = (b[o + 4] & 3) + 1
        break
    if nal is None:
        return None
    sizes = []
    for o, e in walk(0, end, 'stsz'):
        import struct as st
        uniform, count = st.unpack_from('>II', b, o + 4)
        if uniform:
            sizes = [uniform] * count
        else:
            sizes = list(st.unpack_from('>%dI' % count, b, o + 12))
        break
    offs = []
    for o, e in walk(0, end, 'stco'):
        import struct as st
        n = st.unpack_from('>I', b, o + 4)[0]
        offs = list(st.unpack_from('>%dI' % n, b, o + 8))
        break
    if not offs:
        for o, e in walk(0, end, 'co64'):
            import struct as st
            n = st.unpack_from('>I', b, o + 4)[0]
            offs = list(st.unpack_from('>%dQ' % n, b, o + 8))
            break
    spc = []
    for o, e in walk(0, end, 'stsc'):
        import struct as st
        n = st.unpack_from('>I', b, o + 4)[0]
        spc = [st.unpack_from('>III', b, o + 8 + 12 * k) for k in range(n)]
        break
    if not (sizes and offs and spc):
        return None
    return sizes, offs, spc, nal


def check_media(path):
    """A sample whose NAL prefixes do not chain to its size is a shifted file.

    This is what core.autocrlf did to every background video: each CRLF in the
    stream lost a byte, every offset after it moved, and Chrome decoded a
    handful of frames before giving up. The page still looked right in a still.
    """
    import struct
    b = open(path, 'rb').read()
    t = _mp4_tables(b)
    if t is None:
        fail(path, 'no readable H.264 sample table')
        return
    sizes, offs, spc, nal = t

    # expand stsc into samples-per-chunk for the chunks we are going to test
    per = []
    for k, (first, count, _desc) in enumerate(spc):
        last = spc[k + 1][0] - 1 if k + 1 < len(spc) else len(offs)
        per.extend([count] * max(0, last - first + 1))
    if not per:
        fail(path, 'empty chunk table')
        return

    si = 0
    checked = 0
    for ci, off in enumerate(offs):
        n = per[ci] if ci < len(per) else per[-1]
        for _ in range(n):
            if si >= len(sizes):
                break
            size = sizes[si]
            p, remaining = off, size
            while remaining > nal:
                ln = int.from_bytes(b[p:p + nal], 'big')
                if ln <= 0 or ln > remaining - nal:
                    fail(path, 'sample %d: NAL length %d does not fit in %d bytes '
                               '(file shifted; re-copy it in binary mode)'
                         % (si, ln, remaining - nal))
                    return
                p += nal + ln
                remaining -= nal + ln
            if remaining != 0:
                fail(path, 'sample %d: %d bytes left over after its NAL units'
                     % (si, remaining))
                return
            off += size
            si += 1
            checked += 1
        if checked >= 40:        # the damage shows up in the first chunk or two
            break
    if checked == 0:
        fail(path, 'no samples to check')


def check_endcap(path, live):
    """Every page that carries the long footer must also carry the end-cap.

    The end-cap and the subscription band are injected by newsletter.js, so a
    page that forgets the tag simply stops at the footer while every other page
    closes on the wordmark. industries.html did exactly that and nothing caught
    it, because the omission is invisible in the markup.
    """
    if '<ul class="foot-links">' not in live and '<ul class="footer-links">' not in live:
        return
    for asset, what in (('/assets/newsletter.css', 'stylesheet'),
                        ('/assets/newsletter.js', 'script')):
        if asset not in live:
            fail(path, 'has the long footer but not the end-cap %s (%s)'
                 % (what, asset))


def check_models(path, live):
    for m in BLOCKED_MODELS:
        if re.search(r'\b%s' % re.escape(m), live):
            fail(path, 'advertises %s, which the catalogue blocks' % m)


def check_api_host(path, live):
    for m in re.finditer(r'https://([a-z0-9.\-]+)/v1', live):
        host = m.group(1)
        if not any(host.endswith(d) for d in ALLOWED_API_HOSTS):
            fail(path, 'API base URL on a host Pareto may not control: %s' % host)


def check_dashes(path, src):
    if path in DASH_EXEMPT:
        return
    src = re.sub(r'<!--.*?-->', '', src, flags=re.S)   # code comments are not copy
    n = src.count('—') + src.count('&mdash;')
    if n:
        m = re.search(r'.{45}(?:—|&mdash;).{45}', src, re.S)
        fail(path, '%d em dash%s in copy, e.g. ...%s...'
             % (n, '' if n == 1 else 'es',
                (m.group(0).replace(chr(10), chr(32)) if m else '')))


def check_gold(path, text):
    if path in GOLD_OK_FILES:
        return
    live = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    live = re.sub(r'<!--.*?-->', '', live, flags=re.S)
    # walk back from each hit to the selector that owns it, so multi-line
    # rules are judged by their selector and not by the line of the hit
    bad = []
    for m in re.finditer(r'var\(--(?:gold|sig)\)', live):
        head = live[:m.start()]
        brace = head.rfind('{')
        sel = head[head.rfind('}', 0, brace) + 1:brace] if brace > 0 else ''
        sel = sel.replace(chr(10), ' ').strip()[-90:]
        if not any(tok in sel for tok in GOLD_OK_SELECTORS + DARK_CONTEXT):
            bad.append(sel or m.group(0))
    n = len(bad)
    if n:
        fail(path, '%d gold reference%s on a light context; use --ac: %s'
             % (n, '' if n == 1 else 's', bad[0].strip()[:70]))


def check_editorial(path, live):
    text = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', live, flags=re.S | re.I)
    for pattern, why in FORBIDDEN:
        m = re.search(pattern, text)
        if m:
            ctx = text[max(0, m.start() - 40):m.end() + 40].replace('\n', ' ')
            fail(path, '%s: ...%s...' % (why, ctx.strip()))


def main():
    if not os.path.exists('index.html'):
        print('run me from the repo root', file=sys.stderr)
        return 1

    for p in NEW_PAGES:
        checked['checks'] += 1
        if not os.path.exists(p):
            fail(p, 'page does not exist')

    for path in pages():
        checked['pages'] += 1
        src = open(path, encoding='utf-8').read()
        live = strip_comments(src)
        check_balance(path, src)
        check_dashes(path, src)
        check_gold(path, src)
        check_assets(path, live)
        check_retired(path, live)
        check_nav(path, live)
        check_footer(path, live)
        check_endcap(path, live)
        if path in NEW_PAGES or path in ('index.html', 'platform.html',
                                         'industries/government.html'):
            check_editorial(path, live)
        if path in NEW_PAGES or path == 'index.html':
            check_models(path, live)
            check_api_host(path, live)

    # every background video, byte-shifted or whole
    import glob as _glob
    for mp4 in sorted(_glob.glob('assets/**/*.mp4', recursive=True)):
        checked['checks'] += 1
        check_media(mp4)

    # stylesheets carry colour too
    for css in ('assets/site.css', 'assets/infra.css', 'assets/newsletter.css'):
        checked['checks'] += 1
        check_gold(css, open(css, encoding='utf-8').read())

    # the modal every CTA opens is shared markup in JS, not in any page
    checked['checks'] += 1
    try:
        modal = open('assets/build-modal.js', encoding='utf-8').read()
        if re.search(r'(?i)private[ -]equity|PE portfolio', modal):
            fail('assets/build-modal.js',
                 'modal still offers Private Equity after its removal')
    except FileNotFoundError:
        fail('assets/build-modal.js', 'missing')

    # sitemap: valid, and retired pages absent
    checked['checks'] += 1
    try:
        doc = xml.dom.minidom.parse('sitemap.xml')
        locs = [n.firstChild.data for n in doc.getElementsByTagName('loc')]
        for r in RETIRED:
            if any(l.endswith('/' + r) for l in locs):
                fail('sitemap.xml', 'retired page listed: %s' % r)
        for n in NEW_PAGES:
            if not any(l.endswith('/' + n) for l in locs):
                fail('sitemap.xml', 'missing new page: %s' % n)
    except Exception as e:
        fail('sitemap.xml', 'invalid XML: %s' % e)

    # vercel.json: valid, and every retired page redirected
    checked['checks'] += 1
    try:
        cfg = json.load(open('vercel.json'))
        sources = {r['source'] for r in cfg.get('redirects', [])}
        for r in RETIRED:
            if '/' + r not in sources:
                fail('vercel.json', 'no redirect for retired page /%s' % r)
        for r in cfg.get('redirects', []):
            if r.get('permanent'):
                fail('vercel.json', '%s is a permanent redirect; '
                                    'these are temporary' % r['source'])
    except Exception as e:
        fail('vercel.json', 'invalid JSON: %s' % e)

    print('pages checked: %d   extra checks: %d' %
          (checked['pages'], checked['checks']))
    if failures:
        print('\nFAILURES (%d)\n' % len(failures))
        for f in failures:
            print('  ' + f)
        return 1
    print('all checks passed')
    return 0


if __name__ == '__main__':
    sys.exit(main())

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
    foot = re.search(r'<ul class="footer?-links">(.*?)</ul>', live, re.S)
    if not foot:
        return  # not every page carries the long footer
    hrefs = set(re.findall(r'href="([^"]+)"', foot.group(1)))
    for needed in FOOTER_MUST_HAVE:
        if needed not in hrefs:
            fail(path, 'footer missing %s' % needed)


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
        check_assets(path, live)
        check_retired(path, live)
        check_nav(path, live)
        check_footer(path, live)
        if path in NEW_PAGES or path == 'index.html':
            check_editorial(path, live)

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

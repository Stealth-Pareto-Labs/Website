/* ============================================================
   Pareto Labs — newsletter subscription.
   Injects a band above the footer and posts {form:'newsletter', email}
   to the same Apps Script web app used by the Build form.
   ============================================================ */
(function () {
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var HTML =
    '<section class="nl-band" aria-labelledby="nl-title"><div class="nl-inner">' +
      '<div class="nl-copy">' +
        '<p class="nl-eyebrow">Pareto &nbsp;/&nbsp; Research letter</p>' +
        '<h2 class="nl-title" id="nl-title">What we learn, <em>we share.</em></h2>' +
        '<p class="nl-sub">Research, field lessons, and ideas from building AI for real operations. A few considered updates each year, grounded in the work.</p>' +
        '<nav class="nl-social" aria-label="Follow Pareto Labs">' +
          '<span class="nl-social-label">Follow Pareto</span>' +
          '<a href="https://www.linkedin.com/company/trypareto-ai/" target="_blank" rel="noopener noreferrer">LinkedIn</a>' +
          '<a href="https://x.com/paretolabsx" target="_blank" rel="noopener noreferrer">X</a>' +
          '<a href="https://discord.gg/z3fgyDuGM" target="_blank" rel="noopener noreferrer">Discord</a>' +
        '</nav>' +
      '</div>' +
      '<div class="nl-signup">' +
        '<p class="nl-signup-label">Occasional research updates</p>' +
        '<form class="nl-form" novalidate>' +
          '<div class="nl-row">' +
            '<label class="nl-label" for="nl-email">Email address</label>' +
            '<input class="nl-input" id="nl-email" type="email" name="email" autocomplete="email" placeholder="you@company.com" aria-describedby="nl-note" required>' +
            '<button class="nl-btn" type="submit">Subscribe <span aria-hidden="true">&rarr;</span></button>' +
          '</div>' +
          '<p class="nl-note" id="nl-note">By subscribing, you agree to receive occasional updates from Pareto Labs. Unsubscribe at any time.</p>' +
        '</form>' +
        '<div class="nl-ok" role="status" aria-live="polite">' +
          '<svg class="nl-ok-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>' +
          '<div><strong>You&rsquo;re on the list.</strong><span>Thanks for joining us. We&rsquo;ll send the next research note when it&rsquo;s ready.</span></div>' +
        '</div>' +
      '</div>' +
    '</div></section>';

  function init() {
    var footer = document.querySelector('footer');
    if (!footer || document.querySelector('.nl-band')) return;
    var holder = document.createElement('div');
    holder.innerHTML = HTML;
    var band = holder.firstChild;
    footer.parentNode.insertBefore(band, footer);

    // End-cap. Two references, measured rather than guessed.
    //
    // The ghost wordmark is legalpareto.com: an oversized serif set almost to
    // the point of invisibility, bleeding off the right edge, closed by a
    // hairline, on the same cream field as the footer.
    //
    // Underneath it is the reveal from legora.com/product/skills, which draws
    // a page-wide grid of monospace characters on a canvas and lights up only
    // the ones near the pointer. Their values, read off the live page: 15px
    // mono, 9px column pitch, 22.5px row pitch, a disc of roughly 64px, glyphs
    // held at 0.10 alpha inside it, briefly brighter as the pointer first
    // reaches them, and a trail that decays over about nine tenths of a second.
    // What the grid spells is their product: an actual skill file. Ours is the
    // runbook the platform is built from, so the thing under the wordmark is
    // the thing the company does.
    var SHEET = [
      '# Runbook: Sovereign Inference and Cloud Node',
      '*Version:* 2.4 *Owner:* Platform Engineering *Category:* Infrastructure',
      '*Applies to:* every country Pareto Labs operates in',
      '--- ## Purpose',
      'Stand up inference and cloud inside one country, so that model weights,',
      'application data and operational records stay under the law that already',
      'applies to the business. One OpenAI compatible API serves the models.',
      'Apps, jobs, databases and storage run on the same nodes as the models',
      'they call, which removes the round trips that make an otherwise fast',
      'product feel slow to the people it was built for.',
      '## Who it serves',
      'A developer with an API key. A startup. A company running critical',
      'operations. A government. The primitives are the same for all of them',
      'and nothing useful sits behind an enterprise tier.',
      '## What runs on the node',
      '| Layer | What it is |',
      '|---|---|',
      '| Compute | Any registry image, autoscaled, optionally on GPUs |',
      '| Inference | Open models, optimized and quantized, behind one endpoint |',
      '| Storage | Objects, volumes and databases beside the models that read them |',
      '| Retrieval | Embeddings and vector search without a round trip offshore |',
      '| Observability | Logs, traces and token accounting on every served request |',
      '## Serving rules',
      '- Publish every precision served, with the memory each one needs.',
      '- Name the model and the precision that answered, on every response.',
      '- Scale an idle endpoint to zero rather than keep it warm.',
      '- Keep post-trained weights with the customer whose data made them.',
      '- Never move a workload across a border to make an operator cheaper.',
      '## The evidence loop',
      '1. Operators work in the system and correct it where it is wrong.',
      '2. Corrections and outcomes are captured as evidence, not as anecdotes.',
      '3. Experts review the cases the system and the operator disagree on.',
      '4. Changes are human gated, versioned and reversible.',
      '5. The next release is measured against the one before it.',
      '## In production',
      'Manufacturing. Oil and gas. Telecom. Mining. Logistics. Financial',
      'services. Government. The shape of the work repeats in each of them:',
      'instrument what actually happens, turn it into evidence, and hand the',
      'operator a system that gets better at the job instead of a demonstration',
      'that stays the same.',
      '## Out of scope',
      'Anything that has not shipped. If it is not running for somebody today,',
      'it does not belong in this document.',
      '--- # End of runbook. '
    ].join(' ').replace(/\s+/g, ' ');

    var WORD = 'Pareto Labs';
    var letters = '';
    for (var i = 0; i < WORD.length; i++) {
      var ch = WORD.charAt(i);
      letters += '<span class="plw-l" style="--i:' + i + '">' +
                 (ch === ' ' ? '&nbsp;' : ch) + '</span>';
    }

    var cap = document.createElement('section');
    cap.className = 'plw';
    cap.setAttribute('aria-label', 'Pareto Labs');
    cap.innerHTML =
      '<canvas class="plw-field" aria-hidden="true"></canvas>' +
      '<div class="plw-stage">' +
        '<span class="plw-eyebrow">Sovereign infrastructure and AI</span>' +
        '<div class="plw-word" aria-hidden="true">' + letters + '</div>' +
        '<span class="plw-tag">Diffusing AI into the real economy</span>' +
      '</div>';
    footer.parentNode.insertBefore(cap, footer);

    // Size the wordmark to the stage rather than to the viewport. A vw-based
    // clamp cannot know how wide "Pareto Labs" actually is in Newsreader, and
    // at 1440 it overflowed the right edge by 89px, clipping the final letter.
    // Solve it: measure the word at a probe size, then scale to the stage.
    function fitWord() {
      var stage = cap.querySelector('.plw-stage');
      var word = cap.querySelector('.plw-word');
      if (!stage || !word) return;
      var cs = getComputedStyle(stage);
      var avail = stage.clientWidth -
                  parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
      if (!(avail > 0)) return;
      var probe = 200;
      word.style.fontSize = probe + 'px';
      // scrollWidth on a block-level flex box reports the box, not the content,
      // so a word narrower than the stage measures as exactly the stage and the
      // fit never moves. max-content gives the width the letters actually need.
      word.style.width = 'max-content';
      var natural = word.offsetWidth;
      word.style.width = '';
      if (!natural) { word.style.fontSize = ''; return; }
      word.style.fontSize = (probe * (avail / natural)).toFixed(2) + 'px';
    }
    fitWord();

    // --- the character field ------------------------------------------------
    (function () {
      var cv = cap.querySelector('.plw-field');
      if (!cv || !cv.getContext) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
          !window.matchMedia('(hover: hover)').matches) { cv.remove(); return; }

      var ctx = cv.getContext('2d');
      var FS = 15;            // font size, as measured on the reference
      var ROW = 22.5;         // row pitch
      var R = 64;             // reveal radius
      var BASE = 0.10;        // alpha of a glyph sitting inside the disc
      var FLASH = 0.13;       // extra alpha the moment the disc first reaches it
      var DECAY = 0.930;      // per frame once the disc has moved on (~0.9s to nothing)
      var FDECAY = 0.86;      // the flash fades faster than the trail
      var FONT = FS + 'px ui-monospace,"JetBrains Mono","SFMono-Regular",' +
                 'Menlo,Consolas,"Liberation Mono",monospace';

      // slate, never gold: this band is cream, where gold measures 1.92:1
      var INK = (getComputedStyle(document.documentElement)
                   .getPropertyValue('--ac') || '#2C3C60').trim();
      var RGB = (function (hex) {
        var m = /^#?([0-9a-f]{6})$/i.exec(hex);
        var n = m ? parseInt(m[1], 16) : 0x2C3C60;
        return (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255);
      })(INK);

      var W = 0, H = 0, cols = 0, rows = 0, colw = 9, glyph = null;
      var e = null, f = null;        // energy and flash, one per cell
      var px = -1e4, py = -1e4, raf = 0, awake = 0;

      function layout() {
        var r = cap.getBoundingClientRect();
        W = Math.round(r.width); H = Math.round(r.height);
        if (!W || !H) return false;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        cv.style.width = W + 'px'; cv.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        colw = ctx.measureText('M').width || 9;

        cols = Math.ceil(W / colw) + 1;
        rows = Math.ceil(H / ROW) + 1;

        // one continuous word-wrapped stream, repeated until the band is full
        var words = SHEET.split(' '), wi = 0, line = '', out = [];
        while (out.length < rows) {
          var w = words[wi++ % words.length];
          if (line.length + w.length + (line ? 1 : 0) > cols) { out.push(line); line = ''; }
          line += (line ? ' ' : '') + w;
        }
        glyph = out;
        e = new Float32Array(cols * rows);
        f = new Float32Array(cols * rows);
        return true;
      }

      function frame() {
        raf = 0;
        ctx.clearRect(0, 0, W, H);
        var live = 0;
        var r0 = Math.max(0, Math.floor((py - R) / ROW));
        var r1 = Math.min(rows - 1, Math.ceil((py + R) / ROW));
        var c0 = Math.max(0, Math.floor((px - R) / colw));
        var c1 = Math.min(cols - 1, Math.ceil((px + R) / colw));

        for (var r = 0; r < rows; r++) {
          var line = glyph[r]; if (!line) continue;
          var cy = r * ROW + ROW / 2;
          var inRow = r >= r0 && r <= r1;
          for (var c = 0, n = line.length; c < n; c++) {
            var k = r * cols + c;
            var ev = e[k], fv = f[k] * FDECAY;   // the flash always fades
            if (inRow && c >= c0 && c <= c1) {
              var cx0 = c * colw + colw / 2, dx = cx0 - px, dy = cy - py;
              if (dx * dx + dy * dy <= R * R) {
                if (ev < 0.06) fv = 1;     // the disc has just reached it
                ev = 1;                    // and holds it while the disc stays
              } else { ev *= DECAY; }
            } else if (ev) { ev *= DECAY; }
            if (ev < 0.02) { if (ev) { e[k] = 0; f[k] = 0; } continue; }
            e[k] = ev; f[k] = fv; live++;
            var ch = line.charAt(c);
            if (ch === ' ') continue;
            ctx.fillStyle = 'rgba(' + RGB + ',' +
              (BASE * ev + FLASH * fv).toFixed(3) + ')';
            ctx.fillText(ch, c * colw + colw / 2, cy);
          }
        }
        // keep animating while anything is still fading or the pointer is inside
        if (live || awake) raf = requestAnimationFrame(frame);
      }
      function wake() { if (!raf) raf = requestAnimationFrame(frame); }

      cap.addEventListener('pointermove', function (ev2) {
        if (ev2.pointerType === 'touch') return;
        var r = cap.getBoundingClientRect();
        px = ev2.clientX - r.left; py = ev2.clientY - r.top;
        awake = 1; wake();
      }, { passive: true });
      cap.addEventListener('pointerleave', function () {
        awake = 0; px = py = -1e4; wake();
      });

      // The band's height is not settled at injection time: the wordmark is a
      // clamp() on a webfont that has not loaded yet, so sizing the grid here
      // and trusting it leaves a field five rows deep in a 545px band. Re-lay
      // it out whenever the band actually changes size.
      layout();
      if (window.ResizeObserver) {
        var rt;
        new ResizeObserver(function () {
          clearTimeout(rt);
          rt = setTimeout(function () { fitWord(); if (layout()) wake(); }, 80);
        }).observe(cap);
      } else {
        var rt2;
        window.addEventListener('resize', function () {
          clearTimeout(rt2);
          rt2 = setTimeout(function () { fitWord(); if (layout()) wake(); }, 150);
        });
      }
      if (document.fonts && document.fonts.ready)
        document.fonts.ready.then(function () { fitWord(); if (layout()) wake(); });
    })();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      cap.classList.add('in');
    } else {
      var io2 = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { cap.classList.add('in'); io2.unobserve(e.target); } });
      }, { threshold: 0.25 });
      io2.observe(cap);
    }

    var form = band.querySelector('.nl-form');
    var ok = band.querySelector('.nl-ok');
    function showErr(msg) {
      var el = form.querySelector('.nl-err');
      if (!el) { el = document.createElement('p'); el.className = 'nl-err'; el.setAttribute('role', 'alert'); form.appendChild(el); }
      el.textContent = msg || '';
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showErr('');
      var email = (form.elements['email'].value || '').trim();
      if (!EMAIL_RE.test(email)) { form.elements['email'].setAttribute('aria-invalid', 'true'); showErr('Please enter a valid email address.'); return; }
      form.elements['email'].removeAttribute('aria-invalid');
      var btn = form.querySelector('.nl-btn'); btn.disabled = true; btn.textContent = 'Subscribing…';
      function done() { form.style.display = 'none'; ok.classList.add('show'); }
      fetch('/api/site-intake', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ formType: 'newsletter', email: email, page: location.pathname }) })
        .then(function (response) { return response.json().then(function (result) { if (!response.ok || !result.ok) throw new Error(result.error || 'We could not add you to the update list. Please try again.'); }); })
        .then(done)
        .catch(function (err) { showErr(err.message || 'We could not add you to the update list. Please try again.'); btn.disabled = false; btn.textContent = 'Subscribe'; });
    });
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();

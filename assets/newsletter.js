/* ============================================================
   Pareto Labs — newsletter subscription.
   Injects a band above the footer and posts {form:'newsletter', email}
   to the same Apps Script web app used by the Build form.
   ============================================================ */
(function () {
  var NL_ENDPOINT = 'https://script.google.com/macros/s/AKfycbylgzQLs7NDiLvxldpmbwFMfjURjqNJIOA_iocBK141-PekIyGC51WmKIuA1dZHo8aS/exec';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var HTML =
    '<section class="nl-band" aria-labelledby="nl-title"><div class="nl-inner">' +
      '<div>' +
        '<p class="nl-eyebrow">Research &amp; Notes</p>' +
        '<h2 class="nl-title" id="nl-title">The latest from <em>Pareto Labs.</em></h2>' +
        '<p class="nl-sub">Research notes, field lessons, and what we&rsquo;re learning as we deploy continuous-learning AI into the real economy. No noise, a few emails a quarter.</p>' +
      '</div>' +
      '<div>' +
        '<form class="nl-form" novalidate>' +
          '<div class="nl-row">' +
            '<input class="nl-input" type="email" name="email" autocomplete="email" placeholder="you@company.com" aria-label="Email address" required>' +
            '<button class="nl-btn" type="submit">Subscribe</button>' +
          '</div>' +
          '<p class="nl-note">By subscribing you agree to receive occasional emails from Pareto Labs. Unsubscribe anytime.</p>' +
        '</form>' +
        '<div class="nl-ok">You&rsquo;re subscribed.<span>We&rsquo;ll be in touch with what we&rsquo;re learning.</span></div>' +
      '</div>' +
    '</div></section>';

  function init() {
    var footer = document.querySelector('footer');
    if (!footer || document.querySelector('.nl-band')) return;
    var holder = document.createElement('div');
    holder.innerHTML = HTML;
    var band = holder.firstChild;
    footer.parentNode.insertBefore(band, footer);

    // End-cap: a quiet ghost wordmark, in the manner of legalpareto.com. Moving
    // the pointer across it writes letters wherever the cursor goes; each one
    // lands, holds for a beat and fades. The word spells itself out under your
    // hand instead of being animated at you.
    var TRAIL = 'PARETOLABS';
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
      '<div class="plw-stage">' +
        '<span class="plw-eyebrow">Sovereign infrastructure and AI</span>' +
        '<div class="plw-word" aria-hidden="true">' + letters + '</div>' +
        '<span class="plw-tag">Diffusing AI into the real economy</span>' +
      '</div>' +
      '<div class="plw-ink" aria-hidden="true"></div>';
    footer.parentNode.insertBefore(cap, footer);

    // --- letters that follow the cursor -------------------------------------
    (function () {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!window.matchMedia('(hover: hover)').matches) return;

      var ink = cap.querySelector('.plw-ink');
      var n = 0, lastX = null, lastY = null, queued = null;
      var GAP = 46;        // px of travel between letters, so it writes rather than smears
      var LIFE = 1500;     // ms before a letter is gone

      function drop(x, y) {
        var el = document.createElement('span');
        el.className = 'plw-c';
        el.textContent = TRAIL.charAt(n % TRAIL.length);
        n++;
        // a little scatter so a straight sweep does not read as a ruler
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.setProperty('--r', (Math.random() * 16 - 8).toFixed(2) + 'deg');
        el.style.setProperty('--dx', (Math.random() * 14 - 7).toFixed(1) + 'px');
        ink.appendChild(el);
        // next frame, so the entry transition actually runs
        requestAnimationFrame(function () { el.classList.add('on'); });
        setTimeout(function () { el.classList.add('off'); }, LIFE * 0.45);
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, LIFE);
      }

      cap.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        if (queued) return;
        queued = requestAnimationFrame(function () {
          queued = null;
          var r = cap.getBoundingClientRect();
          var x = e.clientX - r.left, y = e.clientY - r.top;
          if (lastX !== null) {
            var dx = x - lastX, dy = y - lastY;
            if (dx * dx + dy * dy < GAP * GAP) return;
          }
          lastX = x; lastY = y;
          drop(x, y);
        });
      });

      cap.addEventListener('pointerleave', function () { lastX = lastY = null; });
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
      if (!el) { el = document.createElement('p'); el.className = 'nl-err'; form.appendChild(el); }
      el.textContent = msg || '';
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showErr('');
      var email = (form.elements['email'].value || '').trim();
      if (!EMAIL_RE.test(email)) { showErr('Please enter a valid email address.'); return; }
      var btn = form.querySelector('.nl-btn'); btn.disabled = true; btn.textContent = 'Subscribing…';
      var data = new URLSearchParams();
      data.append('form', 'newsletter');
      data.append('email', email);
      data.append('page', location.pathname);
      function done() { form.style.display = 'none'; ok.classList.add('show'); }
      if (NL_ENDPOINT) {
        fetch(NL_ENDPOINT, { method: 'post', mode: 'no-cors', body: data }).then(done).catch(done);
      } else { setTimeout(done, 400); }
    });
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();

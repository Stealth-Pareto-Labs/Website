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

    // End-cap: the wordmark, flat and quiet. Hovering lifts the letters away in a
    // staggered wave and raises the stack we actually own into their place.
    var LAYERS = ['Silicon', 'Inference', 'Cloud', 'Knowledge', 'Governance', 'Workflow'];
    var WORD = 'Pareto Labs';

    var letters = '';
    for (var i = 0; i < WORD.length; i++) {
      var ch = WORD.charAt(i);
      letters += '<span class="plw-l" style="--i:' + i + '">' +
                 (ch === ' ' ? '&nbsp;' : ch) + '</span>';
    }

    var cap = document.createElement('section');
    cap.className = 'plw';
    cap.setAttribute('aria-label', 'Pareto Labs. Silicon, inference, cloud, knowledge, governance, workflow.');
    cap.innerHTML =
      '<div class="plw-stage">' +
        '<span class="plw-eyebrow">Sovereign infrastructure and AI</span>' +
        '<div class="plw-swap" aria-hidden="true">' +
          '<div class="plw-word">' + letters + '</div>' +
          '<div class="plw-layers">' +
            LAYERS.map(function (l, n) {
              return '<span style="--i:' + n + '">' + l + '</span>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<span class="plw-tag">Diffusing AI into the real economy</span>' +
      '</div>';
    footer.parentNode.insertBefore(cap, footer);

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

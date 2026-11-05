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

    var footerInner = footer.querySelector('.foot-inner');
    if (footerInner) {
      var follow = document.createElement('div');
      follow.className = 'nl-follow-footer';
      follow.innerHTML =
        '<span class="nl-follow-label">Follow Pareto</span>' +
        '<nav class="nl-social" aria-label="Follow Pareto Labs">' +
          '<a href="https://www.linkedin.com/company/trypareto-ai/" target="_blank" rel="noopener noreferrer">LinkedIn</a>' +
          '<a href="https://x.com/paretolabsx" target="_blank" rel="noopener noreferrer">X</a>' +
          '<a href="https://discord.gg/z3fgyDuGM" target="_blank" rel="noopener noreferrer">Discord</a>' +
        '</nav>';
      var footerCopy = footerInner.querySelector('.foot-copy');
      if (footerCopy) footerInner.insertBefore(follow, footerCopy);
      else footerInner.appendChild(follow);
    }

    // Keep the footer closeout static so it does not draw attention away from the Follow Pareto links.

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
    window.addEventListener('resize', fitWord, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWord);

    cap.classList.add('in');

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

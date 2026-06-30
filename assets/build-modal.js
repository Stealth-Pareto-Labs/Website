/* ============================================================
   Pareto Labs — "Build with Pareto" modal + submit handling.
   Opens from any <a href="…#partner"> or [data-build] trigger.
   Posts to a Google Apps Script web app (free) that logs to a
   Sheet, emails the requester, and notifies Slack.
   ------------------------------------------------------------
   >>> TO GO LIVE: paste your deployed Apps Script Web App URL
   >>> into BUILD_ENDPOINT below. Until then the form shows a
   >>> success state but does not deliver (preview only).
   ============================================================ */
(function () {
  var BUILD_ENDPOINT = ''; // e.g. 'https://script.google.com/macros/s/AKfyc.../exec'
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var MODAL_HTML =
  '<div class="bm-overlay" role="dialog" aria-modal="true" aria-labelledby="bm-title" aria-hidden="true">' +
    '<div class="bm-card">' +
      '<button class="bm-close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<p class="bm-eyebrow">Build with Pareto</p>' +
      '<h2 class="bm-title" id="bm-title">Start a conversation.</h2>' +
      '<p class="bm-sub">Tell us where your operations hurt. We’ll show you what continuous-learning AI can do for your business.</p>' +
      '<form class="bm-form" novalidate>' +
        '<div class="bm-fields">' +
          '<div class="bm-field"><label for="bm-name">Your name</label><input id="bm-name" name="name" type="text" autocomplete="name" placeholder="James Wright" required></div>' +
          '<div class="bm-field"><label for="bm-email">Work email</label><input id="bm-email" name="email" type="email" autocomplete="email" placeholder="james@company.com" required></div>' +
          '<div class="bm-field"><label for="bm-company">Company</label><input id="bm-company" name="company" type="text" autocomplete="organization" placeholder="Your company"></div>' +
          '<div class="bm-field"><label for="bm-type">You are</label><select id="bm-type" name="type"><option value="">Select one</option><option>Operating company (SMB / mid-market)</option><option>Private equity firm</option><option>PE portfolio company</option><option>Vertical / industry business</option><option>Other</option></select></div>' +
          '<div class="bm-field"><label for="bm-challenge">Where could AI help your operations?</label><textarea id="bm-challenge" name="challenge" placeholder="e.g. Our customer service team is overwhelmed and our knowledge is scattered across people and docs…"></textarea></div>' +
        '</div>' +
        '<div class="bm-foot">' +
          '<button type="submit" class="bm-btn">Build with Pareto</button>' +
          '<p class="bm-note">We review every inquiry personally and respond within two business days.</p>' +
        '</div>' +
      '</form>' +
      '<div class="bm-ok">' +
        '<span class="ring"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>' +
        '<h3>Thank you.</h3>' +
        '<p>We’ve received your request and emailed you a confirmation. Our team will be in touch within two business days.</p>' +
      '</div>' +
    '</div>' +
  '</div>';

  var overlay = null, lastFocus = null;

  function injectModal() {
    if (overlay) return;
    var root = document.createElement('div');
    root.className = 'bm-root';
    root.innerHTML = MODAL_HTML;
    document.body.appendChild(root);
    overlay = root.querySelector('.bm-overlay');
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.bm-close').addEventListener('click', close);
    wireForm(overlay.querySelector('.bm-form'));
  }

  function open() {
    injectModal();
    lastFocus = document.activeElement;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('bm-lock');
    document.body.classList.add('bm-lock');
    document.addEventListener('keydown', onKey);
    var first = overlay.querySelector('input, select, textarea, button');
    setTimeout(function () { if (first) first.focus(); }, 60);
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('bm-lock');
    document.body.classList.remove('bm-lock');
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    var f = overlay.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
    f = Array.prototype.filter.call(f, function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function showErr(form, msg) {
    var el = form.querySelector('[data-err]');
    if (!el) { el = document.createElement('p'); el.setAttribute('data-err', ''); el.className = 'bm-err'; (form.querySelector('.bm-foot') || form).appendChild(el); }
    el.textContent = msg || '';
  }

  function resolveOk(form) {
    if (form.dataset.ok) return document.getElementById(form.dataset.ok);
    return (form.parentElement || document).querySelector('.bm-ok, .form-ok, .confirm');
  }

  function wireForm(form) {
    if (!form || form._bmWired) return;
    form._bmWired = true;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showErr(form, '');
      var nameEl = form.elements['name'], emailEl = form.elements['email'];
      var name = nameEl ? nameEl.value.trim() : '';
      var email = emailEl ? emailEl.value.trim() : '';
      if (!name) { showErr(form, 'Please enter your name.'); if (nameEl) nameEl.focus(); return; }
      if (!EMAIL_RE.test(email)) { showErr(form, 'Please enter a valid work email.'); if (emailEl) emailEl.focus(); return; }

      var btn = form.querySelector('button[type=submit]');
      var orig = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

      var data = new URLSearchParams();
      ['name', 'email', 'company', 'type', 'challenge'].forEach(function (k) {
        var el = form.elements[k]; if (el) data.append(k, (el.value || '').trim());
      });
      data.append('page', location.pathname);
      data.append('form', 'build_request');

      function done() {
        var ok = resolveOk(form);
        if (ok) { form.style.display = 'none'; ok.classList.add('show'); ok.style.display = 'block'; }
        else if (btn) { btn.disabled = false; btn.textContent = orig; }
      }

      if (BUILD_ENDPOINT) {
        fetch(BUILD_ENDPOINT, { method: 'POST', mode: 'no-cors', body: data }).then(done).catch(done);
      } else {
        setTimeout(done, 400); // preview: no backend wired yet
      }
    });
  }

  function init() {
    var triggers = document.querySelectorAll('a[href$="#partner"], [data-build]');
    Array.prototype.forEach.call(triggers, function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); open(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('form.build-form'), wireForm);
    window.ParetoBuildModal = { open: open, close: close };
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();

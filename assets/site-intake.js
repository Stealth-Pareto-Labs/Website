(function () {
  'use strict';
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function error(form, message) { var node = form.querySelector('[data-error]') || form.querySelector('[data-err]'); if (!node) { node = document.createElement('p'); node.dataset.error = ''; node.className = 'intake-error'; node.setAttribute('role', 'alert'); form.appendChild(node); } node.textContent = message || ''; }
  function showSuccess(form) {
    var target = document.getElementById(form.dataset.ok || '');
    if (!target) return false;
    form.hidden = true;
    form.style.display = 'none';
    target.hidden = false;
    target.classList.add('show');
    target.style.display = 'block';
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }
  function validate(form) {
    var email = form.elements.email;
    if (!emailRe.test((email.value || '').trim())) { error(form, 'Please enter a valid email address.'); email.focus(); return false; }
    var required = form.querySelectorAll('[required]');
    for (var i = 0; i < required.length; i++) {
      if (!String(required[i].value || '').trim()) { error(form, 'Please complete all required fields.'); required[i].focus(); return false; }
    }
    var linkedin = form.elements.linkedin;
    if (linkedin && linkedin.value.trim()) {
      try { var url = new URL(linkedin.value.trim()); if (url.protocol !== 'https:' || !/^(www\.)?linkedin\.com$/i.test(url.hostname) || !url.pathname.startsWith('/in/')) throw new Error(); }
      catch (_) { error(form, 'Enter a valid LinkedIn profile URL or leave it blank.'); linkedin.focus(); return false; }
    }
    return true;
  }
  function submission(form) {
    var data = new FormData(form), body = {};
    data.forEach(function (value, key) { body[key] = String(value).trim(); });
    body.formType = form.dataset.formType;
    var key = 'pareto-intake-pending-' + body.formType;
    var pending = form.dataset.pendingSubmissionId || '';
    try { pending = pending || window.sessionStorage.getItem(key) || ''; } catch (_) {}
    if (!pending) pending = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'web-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    form.dataset.pendingSubmissionId = pending;
    try { window.sessionStorage.setItem(key, pending); } catch (_) {}
    body.submissionId = pending;
    body.page = location.pathname;
    return body;
  }
  function clearPendingId(form) {
    try { window.sessionStorage.removeItem('pareto-intake-pending-' + form.dataset.formType); } catch (_) {}
    delete form.dataset.pendingSubmissionId;
  }
  function wire(form) {
    if (form.dataset.intakeReady) return;
    form.dataset.intakeReady = 'true';
    form.addEventListener('submit', async function (event) {
      event.preventDefault(); error(form, '');
      if (!validate(form)) return;
      var button = form.querySelector('[type="submit"]');
      var original = button ? button.textContent : '';
      if (button) { button.disabled = true; button.textContent = 'Sending…'; }
      try {
        var response = await fetch('/api/site-intake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(submission(form)), credentials: 'same-origin' });
        var result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'We could not send your request. Please try again.');
        if (result.newsletterStatus === 'not_configured' || result.newsletterStatus === 'failed') {
          var warning = document.getElementById(form.dataset.ok || '');
          var message = warning && warning.querySelector('[data-newsletter-status]');
          if (message) { message.hidden = false; message.textContent = 'Your request was received, but we could not save your newsletter preference. You can subscribe using the form below.'; }
        }
        if (!showSuccess(form)) throw new Error('We received your request, but could not display the confirmation.');
        clearPendingId(form);
      } catch (err) {
        error(form, err.message || 'We could not send your request. Please try again.');
        if (button) { button.disabled = false; button.textContent = original; }
      }
    });
  }
  document.querySelectorAll('.site-intake-form').forEach(wire);
})();

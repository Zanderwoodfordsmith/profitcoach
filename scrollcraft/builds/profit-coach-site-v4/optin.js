/* The Profit Coach · free frameworks opt-in. Sends the contact to Pam's account
   through the app's lead capture (the same endpoint the coach websites use),
   then reveals the downloads. Remembers the unlock in this browser. */
(function () {
  'use strict';

  var form = document.querySelector('[data-optin]');
  if (!form) return;
  var done = document.querySelector('[data-optin-done]');
  var error = document.querySelector('[data-optin-error]');
  var button = form.querySelector('button[type="submit"]');
  var KEY = 'pc-frameworks-unlocked';
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function unlock(focus) {
    form.hidden = true;
    done.hidden = false;
    if (focus) done.querySelector('.optin__thanks').focus();
  }
  function fail(msg) {
    error.textContent = msg;
    error.hidden = false;
  }

  try { if (localStorage.getItem(KEY)) unlock(false); } catch (e) { /* private mode */ }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.first_name.value.trim();
    var email = form.email.value.trim().toLowerCase();
    var business = form.business_name.value.trim();
    error.hidden = true;
    if (!name) return fail('Add your first name so we know who they are for.');
    if (!EMAIL.test(email)) return fail('That email address does not look right. Check it and try again.');

    button.disabled = true;
    fetch('/api/leads/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coachSlug: 'pam',
        contact: { first_name: name.slice(0, 80), email: email.slice(0, 200), business_name: business.slice(0, 120) || undefined }
      })
    }).then(function (res) {
      if (!res.ok) throw new Error(String(res.status));
      try { localStorage.setItem(KEY, '1'); } catch (e2) { /* private mode */ }
      unlock(true);
    }).catch(function () {
      button.disabled = false;
      fail('We could not send that just now. Try again in a minute.');
    });
  });
})();

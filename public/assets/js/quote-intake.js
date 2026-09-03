/* ============================================================
   VIABUS · Quote intake
   Wires any <form data-quote-intake> to POST /api/public/quote —
   the same JSON endpoint quote.html uses. Fields are read by their
   `name`, which must match lib/validations/viabus-quote.ts.

   Opt-in attributes on the form:
     data-quote-intake            required — marks the form
     data-success="#selector"     element to reveal after success
     data-ref="#selector"         element to fill with the reference

   Vanilla JS, no dependencies. GSAP is used only if already present.
   ============================================================ */
(function () {
  'use strict';

  var REQUIRED = [
    'pickup_location',
    'destination',
    'contact_name',
    'contact_email',
    'departure_date',
    'passenger_count'
  ];

  var forms = document.querySelectorAll('form[data-quote-intake]');
  for (var i = 0; i < forms.length; i++) wire(forms[i]);

  function wire(form) {
    var submitBtn = form.querySelector('button[type="submit"]');
    var errEl = form.querySelector('.q-err') || form.querySelector('[data-quote-error]');
    var successEl = form.dataset.success
      ? document.querySelector(form.dataset.success)
      : null;
    var refEl = form.dataset.ref ? document.querySelector(form.dataset.ref) : null;
    var origLabel = submitBtn ? submitBtn.innerHTML : '';

    function fieldEl(name) {
      return form.querySelector('[name="' + name + '"]');
    }

    function wrapOf(el) {
      if (!el) return null;
      return (
        el.closest('.q-input') ||
        el.closest('.qp-field') ||
        el.parentElement
      );
    }

    function setBad(name, bad) {
      var w = wrapOf(fieldEl(name));
      if (w) w.classList.toggle('q-bad', !!bad);
    }

    function showError(message) {
      if (!errEl) return;
      errEl.textContent = message || '';
      errEl.hidden = !message;
    }

    function busy(on) {
      if (!submitBtn) return;
      submitBtn.classList.toggle('is-loading', on);
      submitBtn.disabled = on;
      if (on) submitBtn.textContent = 'Sending…';
      else submitBtn.innerHTML = origLabel;
    }

    // Clear a field's error state as soon as the visitor edits it.
    form.addEventListener('input', function (e) {
      if (e.target && e.target.name) setBad(e.target.name, false);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showError('');

      var payload = {};
      var named = form.querySelectorAll('[name]');
      for (var j = 0; j < named.length; j++) {
        var el = named[j];
        payload[el.name] = (el.value || '').trim();
      }

      // Courtesy client check — the server validates the same rules again.
      var missing = false;
      for (var k = 0; k < REQUIRED.length; k++) {
        var name = REQUIRED[k];
        var empty = !payload[name];
        setBad(name, empty);
        if (empty) missing = true;
      }
      if (missing) {
        showError('Please fill in the highlighted fields.');
        return;
      }

      busy(true);

      fetch('/api/public/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res
            .json()
            .catch(function () { return null; })
            .then(function (body) { return { status: res.status, body: body }; });
        })
        .then(function (result) {
          var body = result.body;

          if (!body || body.ok !== true) {
            var fieldErrors = (body && body.fieldErrors) || {};
            var keys = Object.keys(fieldErrors);
            for (var m = 0; m < keys.length; m++) setBad(keys[m], true);

            showError(
              (keys.length && fieldErrors[keys[0]][0]) ||
              (body && body.message) ||
              'Something went wrong. Please try again.'
            );
            busy(false);
            return;
          }

          if (refEl) refEl.textContent = body.reference || 'received';

          form.hidden = true;
          if (successEl) {
            successEl.hidden = false;
            successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (window.gsap) {
              window.gsap.from(successEl, {
                opacity: 0, y: 18, duration: 0.5, ease: 'power3.out'
              });
            }
          }
        })
        .catch(function () {
          showError(
            'We could not reach the server. Check your connection and try again.'
          );
          busy(false);
        });
    });
  }
})();

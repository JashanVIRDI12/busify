/* ============================================================
   VIABUS · Hero Search Form
   Location autocomplete, GPS locate, passengers counter,
   swap button, one-way / round-trip toggle.
   Vanilla JS, no dependencies.
   ============================================================ */
(function () {
  'use strict';

  /* ---- City dataset ---- */
  var CITIES = [
    // Canada
    { name: 'Toronto, ON',         flag: '🇨🇦', cc: 'CA' },
    { name: 'Montréal, QC',        flag: '🇨🇦', cc: 'CA' },
    { name: 'Vancouver, BC',       flag: '🇨🇦', cc: 'CA' },
    { name: 'Calgary, AB',         flag: '🇨🇦', cc: 'CA' },
    { name: 'Ottawa, ON',          flag: '🇨🇦', cc: 'CA' },
    { name: 'Edmonton, AB',        flag: '🇨🇦', cc: 'CA' },
    { name: 'Winnipeg, MB',        flag: '🇨🇦', cc: 'CA' },
    { name: 'Québec City, QC',     flag: '🇨🇦', cc: 'CA' },
    { name: 'Hamilton, ON',        flag: '🇨🇦', cc: 'CA' },
    { name: 'Kitchener, ON',       flag: '🇨🇦', cc: 'CA' },
    { name: 'London, ON',          flag: '🇨🇦', cc: 'CA' },
    { name: 'Halifax, NS',         flag: '🇨🇦', cc: 'CA' },
    { name: 'Victoria, BC',        flag: '🇨🇦', cc: 'CA' },
    { name: 'Kelowna, BC',         flag: '🇨🇦', cc: 'CA' },
    { name: 'Banff, AB',           flag: '🇨🇦', cc: 'CA' },
    { name: 'Niagara Falls, ON',   flag: '🇨🇦', cc: 'CA' },
    { name: 'Kingston, ON',        flag: '🇨🇦', cc: 'CA' },
    { name: 'Windsor, ON',         flag: '🇨🇦', cc: 'CA' },
    { name: 'Saskatoon, SK',       flag: '🇨🇦', cc: 'CA' },
    { name: 'Regina, SK',          flag: '🇨🇦', cc: 'CA' },
    { name: 'St. John\'s, NL',     flag: '🇨🇦', cc: 'CA' },
    { name: 'Sudbury, ON',         flag: '🇨🇦', cc: 'CA' },
    // USA
    { name: 'New York, NY',        flag: '🇺🇸', cc: 'US' },
    { name: 'Boston, MA',          flag: '🇺🇸', cc: 'US' },
    { name: 'Seattle, WA',         flag: '🇺🇸', cc: 'US' },
    { name: 'Buffalo, NY',         flag: '🇺🇸', cc: 'US' },
    { name: 'Detroit, MI',         flag: '🇺🇸', cc: 'US' },
    { name: 'Chicago, IL',         flag: '🇺🇸', cc: 'US' },
    { name: 'Philadelphia, PA',    flag: '🇺🇸', cc: 'US' },
    { name: 'Washington, DC',      flag: '🇺🇸', cc: 'US' },
    { name: 'Portland, OR',        flag: '🇺🇸', cc: 'US' },
    { name: 'Minneapolis, MN',     flag: '🇺🇸', cc: 'US' },
    { name: 'Pittsburgh, PA',      flag: '🇺🇸', cc: 'US' },
    { name: 'Albany, NY',          flag: '🇺🇸', cc: 'US' },
  ];

  var POPULAR = CITIES.slice(0, 6);

  /* ---- Passengers state ---- */
  var pax = { adults: 2, children: 0, infants: 0 };
  var PAX_MIN = { adults: 1, children: 0, infants: 0 };
  var PAX_MAX = 9;

  /* ---- DOM refs ---- */
  var fromInput      = document.getElementById('fromInput');
  var toInput        = document.getElementById('toInput');
  var fromDropdown   = document.getElementById('fromDropdown');
  var toDropdown     = document.getElementById('toDropdown');
  var swapBtn        = document.getElementById('swapBtn');
  var locateBtn      = document.getElementById('locateBtn');
  var paxTrigger     = document.getElementById('paxTrigger');
  var paxPanel       = document.getElementById('paxPanel');
  var paxDisplay     = document.getElementById('paxDisplay');
  var paxDone        = document.getElementById('paxDone');
  var pbPaxWrap      = document.getElementById('pbPaxWrap');
  var tripToggle     = document.getElementById('tripToggle');
  var pbReturnWrap   = document.getElementById('pbReturnWrap');
  var returnSep      = document.getElementById('returnSep');

  if (!fromInput) return;

  /* ============================================================
     AUTOCOMPLETE
     ============================================================ */
  function matchCities(q) {
    if (!q) return POPULAR;
    var lo = q.toLowerCase();
    return CITIES.filter(function (c) {
      return c.name.toLowerCase().indexOf(lo) > -1;
    }).slice(0, 7);
  }

  function renderList(dropdown, cities, activeInput) {
    if (!cities.length) { dropdown.hidden = true; return; }
    dropdown.innerHTML = cities.map(function (c) {
      return '<li data-name="' + c.name + '">'
        + '<span class="dl-flag">' + c.flag + '</span>'
        + '<span class="dl-name">' + c.name + '</span>'
        + '<span class="dl-cc">' + c.cc + '</span>'
        + '</li>';
    }).join('');
    dropdown.hidden = false;
  }

  function wireAutocomplete(input, dropdown) {
    input.addEventListener('focus', function () {
      closeAll(dropdown);
      renderList(dropdown, matchCities(input.value));
    });

    input.addEventListener('input', function () {
      renderList(dropdown, matchCities(input.value));
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') dropdown.hidden = true;
    });

    dropdown.addEventListener('mousedown', function (e) {
      var li = e.target.closest('li');
      if (!li) return;
      e.preventDefault();
      input.value = li.dataset.name;
      dropdown.hidden = true;
      input.blur();
    });
  }

  wireAutocomplete(fromInput, fromDropdown);
  wireAutocomplete(toInput, toDropdown);

  function closeAll(except) {
    if (fromDropdown !== except) fromDropdown.hidden = true;
    if (toDropdown   !== except) toDropdown.hidden   = true;
    if (paxPanel     !== except) closePaxPanel();
  }

  document.addEventListener('click', function (e) {
    var inFrom = document.getElementById('pbFromWrap').contains(e.target);
    var inTo   = document.getElementById('pbToWrap').contains(e.target);
    var inPax  = pbPaxWrap.contains(e.target);
    if (!inFrom) fromDropdown.hidden = true;
    if (!inTo)   toDropdown.hidden   = true;
    if (!inPax)  closePaxPanel();
  });

  /* ============================================================
     GEOLOCATION — "Use my current location"
     ============================================================ */
  locateBtn.addEventListener('click', function () {
    if (!navigator.geolocation) {
      showLocateError('Geolocation not supported by your browser.');
      return;
    }
    locateBtn.classList.add('locating');
    fromInput.value = '';
    fromInput.placeholder = 'Detecting…';

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var lat = pos.coords.latitude.toFixed(5);
        var lon = pos.coords.longitude.toFixed(5);
        fetch(
          'https://nominatim.openstreetmap.org/reverse?lat=' + lat
          + '&lon=' + lon + '&format=json&accept-language=en'
        )
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var a = data.address;
            var city  = a.city || a.town || a.village || a.county || '';
            var state = a.state_code || a.state || '';
            fromInput.value = city
              ? (state ? city + ', ' + state : city)
              : 'Near you';
            fromInput.placeholder = 'City or stop';
            addLocateLabel(fromDropdown, 'Current location', city + (state ? ', ' + state : ''));
          })
          .catch(function () {
            fromInput.value = 'Your location';
            fromInput.placeholder = 'City or stop';
          })
          .finally(function () {
            locateBtn.classList.remove('locating');
          });
      },
      function (err) {
        locateBtn.classList.remove('locating');
        fromInput.placeholder = 'City or stop';
        if (err.code === 1) {
          showLocateError('Location access denied. Enable it in browser settings.');
        } else {
          showLocateError('Unable to get your location.');
        }
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  });

  function addLocateLabel(dropdown, label, value) {
    dropdown.innerHTML = '<li data-name="' + value + '">'
      + '<span class="dl-flag">📍</span>'
      + '<span class="dl-name">' + label + '</span>'
      + '<span class="dl-loc">Found</span>'
      + '</li>';
    dropdown.hidden = false;
  }

  function showLocateError(msg) {
    fromDropdown.innerHTML = '<li style="color:rgba(255,90,70,.85);cursor:default;pointer-events:none">'
      + '<span class="dl-flag">⚠</span><span class="dl-name">' + msg + '</span></li>';
    fromDropdown.hidden = false;
    setTimeout(function () { fromDropdown.hidden = true; }, 3500);
  }

  /* ============================================================
     SWAP FROM ↔ TO
     ============================================================ */
  swapBtn.addEventListener('click', function () {
    var a = fromInput.value;
    fromInput.value = toInput.value;
    toInput.value = a;
    fromDropdown.hidden = true;
    toDropdown.hidden = true;
  });

  /* ============================================================
     PASSENGERS PANEL
     ============================================================ */
  function paxTotal() {
    return pax.adults + pax.children + pax.infants;
  }

  function refreshPaxDisplay() {
    var parts = [pax.adults + ' Adult' + (pax.adults !== 1 ? 's' : '')];
    if (pax.children) parts.push(pax.children + ' Child' + (pax.children !== 1 ? 'ren' : ''));
    if (pax.infants)  parts.push(pax.infants  + ' Infant' + (pax.infants  !== 1 ? 's'   : ''));
    paxDisplay.textContent = parts.join(', ');

    document.getElementById('paxAdults').textContent   = pax.adults;
    document.getElementById('paxChildren').textContent = pax.children;
    document.getElementById('paxInfants').textContent  = pax.infants;

    var total = paxTotal();
    document.getElementById('paxTotal').textContent =
      total >= PAX_MAX
        ? 'Maximum passengers reached'
        : 'Max ' + PAX_MAX + ' passengers per booking';

    document.querySelectorAll('.pax-btn').forEach(function (btn) {
      var type = btn.dataset.type;
      var dir  = parseInt(btn.dataset.dir, 10);
      if (dir === -1) {
        btn.disabled = pax[type] <= PAX_MIN[type];
      } else {
        btn.disabled = total >= PAX_MAX;
      }
    });
  }

  paxTrigger.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = !paxPanel.hidden;
    fromDropdown.hidden = true;
    toDropdown.hidden   = true;
    if (open) {
      closePaxPanel();
    } else {
      paxPanel.hidden = false;
      pbPaxWrap.classList.add('open');
    }
  });

  function closePaxPanel() {
    paxPanel.hidden = true;
    pbPaxWrap.classList.remove('open');
  }

  document.querySelectorAll('.pax-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var type = btn.dataset.type;
      var dir  = parseInt(btn.dataset.dir, 10);
      var next = pax[type] + dir;
      if (next < PAX_MIN[type] || paxTotal() + dir > PAX_MAX) return;
      pax[type] = next;
      refreshPaxDisplay();
    });
  });

  paxDone.addEventListener('click', closePaxPanel);

  refreshPaxDisplay();

  /* ============================================================
     ONE WAY / ROUND TRIP TOGGLE
     ============================================================ */
  var isRoundTrip = true;

  if (tripToggle) {
    tripToggle.addEventListener('click', function (e) {
      e.preventDefault();
      isRoundTrip = !isRoundTrip;
      var label = tripToggle.querySelector('.trip-label');
      if (label) {
        label.textContent = isRoundTrip ? 'One way · Round trip' : 'One way';
      }
      if (pbReturnWrap) {
        pbReturnWrap.hidden = !isRoundTrip;
        pbReturnWrap.style.display = isRoundTrip ? '' : 'none';
      }
      if (returnSep) {
        returnSep.hidden = !isRoundTrip;
        returnSep.style.display = isRoundTrip ? '' : 'none';
      }
    });
  }

})();

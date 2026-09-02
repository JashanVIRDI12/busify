/* ============================================================
   VIABUS · Routes GSAP — premium animations + filter logic

   Anti-double-fire:
   ① window.__viabusRoutes module guard
   ② { once: true } on load listener
   ③ ScrollTrigger.batch processes each element once
   ④ Per-card overwrite: 'auto' on filter tweens
   ============================================================ */
(function () {
  'use strict';

  if (window.__viabusRoutes) return;
  window.__viabusRoutes = true;

  var E  = 'power3.out';
  var E2 = 'power2.out';
  var EX = 'expo.out';

  var allCards = [];

  function bootstrap() {
    if (!window.gsap || !window.ScrollTrigger) {
      requestAnimationFrame(bootstrap);
      return;
    }
    init();
  }

  if (document.readyState === 'complete') {
    bootstrap();
  } else {
    window.addEventListener('load', bootstrap, { once: true });
  }

  /* ── Main init ──────────────────────────────────────────── */
  function init() {
    gsap.registerPlugin(ScrollTrigger);
    window.__viabusGSAP = true;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
      return;
    }

    allCards = Array.from(document.querySelectorAll('#rpGrid .rc'));

    splitHeroLines();    // must run before setInitialStates
    setInitialStates();
    initHero();
    initFilterBar();
    initCardGrid();
    initFilterLogic();
    initHeroGlow();

    ScrollTrigger.refresh();
  }

  /* ── Apple-style clip-mask line reveal ─────────────────── */
  function splitHeroLines() {
    var h1 = document.querySelector('.rp-h1');
    if (!h1) return;
    var parts = h1.innerHTML.split(/<br\s*\/?>/i);
    h1.innerHTML = parts.map(function (part) {
      return '<span class="rp-line-mask"><span class="rp-line-inner">' + part + '</span></span>';
    }).join('');
  }

  /* ── Set every animated element to its hidden state ────── */
  function setInitialStates() {
    gsap.set('.rp-eyebrow',    { opacity: 0, x: -20 });
    gsap.set('.rp-line-inner', { y: '115%' });
    gsap.set('.rp-sub',        { opacity: 0, y: 24 });
    gsap.set('.rp-stat',       { opacity: 0, y: 16 });
    gsap.set('.rp-bar',        { opacity: 0, y: 20 });
    gsap.set('.rp-tally',      { opacity: 0 });
    gsap.set(allCards,         { opacity: 0, y: 32, scale: 0.97 });
  }

  /* ── 1. Hero entrance ────────────────────────────────────
     Eyebrow slides in ← h1 lines clip up → sub fades → stats stagger */
  function initHero() {
    var tl = gsap.timeline({ delay: 0.3 });

    tl
      .to('.rp-eyebrow',    { opacity: 1, x: 0, duration: 0.65, ease: E       }, 0)
      .to('.rp-line-inner', { y: '0%', duration: 0.95, ease: EX, stagger: 0.11 }, 0.16)
      .to('.rp-sub',        { opacity: 1, y: 0, duration: 0.75, ease: E       }, 0.52)
      .to('.rp-stat',       { opacity: 1, y: 0, duration: 0.55, ease: E,
                              stagger: 0.07 },                                   0.68);

    /* Stat number count-up — proxy approach, no innerText parsing */
    document.querySelectorAll('.rp-stat-n').forEach(function (el, i) {
      var em     = el.querySelector('em');
      var suffix = em ? em.textContent : '';
      var endVal = parseFloat(el.textContent);
      var isInt  = Number.isInteger(endVal);

      if (isNaN(endVal)) return;

      var proxy = { val: 0 };
      gsap.to(proxy, {
        val: endVal,
        duration: 1.88,
        ease: 'power2.out',
        delay: 0.82 + i * 0.09,
        immediateRender: false,
        onUpdate: function () {
          el.innerHTML = (isInt ? Math.round(proxy.val) : proxy.val.toFixed(1)) +
                         (suffix ? '<em>' + suffix + '</em>' : '');
        },
        onComplete: function () {
          el.innerHTML = (isInt ? Math.round(endVal) : endVal.toFixed(1)) +
                         (suffix ? '<em>' + suffix + '</em>' : '');
          gsap.fromTo(el, { scale: 1.06 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
        }
      });
    });
  }

  /* ── 2. Filter bar entrance ─────────────────────────────── */
  function initFilterBar() {
    gsap.to('.rp-bar',   { opacity: 1, y: 0, duration: 0.7, ease: E, delay: 1.05 });
    gsap.to('.rp-tally', { opacity: 1,        duration: 0.5,           delay: 1.25 });
  }

  /* ── 3. Card grid — batch reveal as rows enter viewport ── */
  function initCardGrid() {
    ScrollTrigger.batch(allCards, {
      onEnter: function (batch) {
        gsap.to(batch, {
          opacity: 1, y: 0, scale: 1,
          duration: 0.72, ease: E,
          stagger: 0.05,
          overwrite: 'auto'
        });
      },
      start: 'top 92%',
      once: true
    });
  }

  /* ── 4. Filter + sort — replaces the inline script ────────
     Cards animate out before being hidden, animate in after
     being revealed. sort order determines stagger sequence.  */
  function initFilterLogic() {
    var pills  = document.querySelectorAll('.rp-pill');
    var sortEl = document.getElementById('rpSort');
    var tally  = document.getElementById('rpTally');
    var grid   = document.getElementById('rpGrid');
    var active = 'all';

    function countLabel(n, f) {
      var word = f === 'all'         ? 'route' :
                 f === 'domestic'    ? 'Canada → Canada route' :
                                       'Canada → USA route';
      return 'Showing ' + n + ' ' + word + (n !== 1 ? 's' : '');
    }

    function applySort(visible) {
      if (!sortEl) return;
      var key = sortEl.value;
      visible.sort(function (a, b) {
        if (key === 'price')    return +a.dataset.price - +b.dataset.price;
        if (key === 'duration') return +a.dataset.dur   - +b.dataset.dur;
        return +b.dataset.pop - +a.dataset.pop;
      });
      /* Reorder in DOM so visual stagger matches sort order */
      visible.forEach(function (c) { grid.appendChild(c); });
    }

    function updateTally(n, f) {
      if (!tally) return;
      gsap.to(tally, {
        opacity: 0, y: -5, duration: 0.18,
        onComplete: function () {
          tally.textContent = countLabel(n, f);
          gsap.to(tally, { opacity: 1, y: 0, duration: 0.28 });
        }
      });
    }

    function applyFilter() {
      var toShow = [];
      var toHide = [];

      allCards.forEach(function (c) {
        (active === 'all' || c.dataset.cat === active ? toShow : toHide).push(c);
      });

      /* Sort first so the stagger index matches what the user sees */
      applySort(toShow);

      /* Kill any in-flight card tweens */
      gsap.killTweensOf(allCards);

      /* Animate out and then hide */
      toHide.forEach(function (c) {
        if (c.classList.contains('hide')) return;
        gsap.to(c, {
          opacity: 0, scale: 0.94, y: 8,
          duration: 0.22, ease: 'power2.in',
          overwrite: 'auto',
          onComplete: function () { c.classList.add('hide'); }
        });
      });

      /* Brief gap so hide-out leads the show-in */
      var gap = toHide.length ? 0.1 : 0;

      toShow.forEach(function (c, i) {
        /* Ensure display is restored before GSAP can reach the element */
        if (c.classList.contains('hide')) {
          c.classList.remove('hide');
          gsap.set(c, { opacity: 0, y: 22, scale: 0.97 });
        }
        gsap.to(c, {
          opacity: 1, y: 0, scale: 1,
          duration: 0.65, ease: E,
          delay: gap + i * 0.038,
          overwrite: 'auto'
        });
      });

      updateTally(toShow.length, active);
    }

    pills.forEach(function (btn) {
      btn.addEventListener('click', function () {
        pills.forEach(function (p) { p.classList.remove('on'); });
        btn.classList.add('on');
        active = btn.dataset.filter;
        applyFilter();
      });
    });

    if (sortEl) sortEl.addEventListener('change', applyFilter);
  }

  /* ── 5. Hero ambient glow follows mouse (subtle depth) ─── */
  function initHeroGlow() {
    var hero = document.querySelector('.rp-hero');
    var glow = document.querySelector('.rp-hero-glow');
    if (!hero || !glow) return;

    var qX = gsap.quickTo(glow, 'xPercent', { duration: 1.2, ease: E2 });
    var qY = gsap.quickTo(glow, 'yPercent', { duration: 1.2, ease: E2 });

    hero.addEventListener('mousemove', function (e) {
      var r  = hero.getBoundingClientRect();
      var px = (e.clientX - r.left)  / r.width  - 0.5;
      var py = (e.clientY - r.top)   / r.height - 0.5;
      qX(px * 18);
      qY(py * 14);
    });

    hero.addEventListener('mouseleave', function () {
      qX(0); qY(0);
    });
  }

})();

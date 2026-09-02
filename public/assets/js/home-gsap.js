/* ============================================================
   VIABUS · Home GSAP — single animation module
   Consolidates: inline home script + why-gsap.js

   Anti-double-fire guarantees:
   ① window.__viabusHome module guard
   ② { once: true } on every ScrollTrigger
   ③ { once: true } on the load listener
   ④ `driven` flag per route card (bus journey)
   ⑤ idempotency guard on route-journey DOM injection
   ============================================================ */
(function () {
  'use strict';

  /* ── ① Module guard ─────────────────────────────────────── */
  if (window.__viabusHome) return;
  window.__viabusHome = true;

  /* ── Module-level ease palette ──────────────────────────── */
  var E   = 'power3.out';   // snappy default
  var E2  = 'power2.out';   // softer, secondary
  var EX  = 'expo.out';     // ultra-snappy hero entrance

  /* ── Bootstrap ──────────────────────────────────────────── */
  function bootstrap() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      requestAnimationFrame(bootstrap);
      return;
    }
    init();
  }

  if (document.readyState === 'complete') {
    bootstrap();
  } else {
    /* ③ once: true prevents double-fire if load fires twice */
    window.addEventListener('load', bootstrap, { once: true });
  }

  /* ── Main init ──────────────────────────────────────────── */
  function init() {
    gsap.registerPlugin(ScrollTrigger);

    /* Tell ui.js to skip its IntersectionObserver counter —
       we handle count-up here with the correct proxy approach. */
    window.__viabusGSAP = true;

    /* Reduced-motion: skip all animation, just show everything. */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal').forEach(function (el) {
        el.classList.add('in');
      });
      return;
    }

    /* Set every animated element to its hidden initial state
       synchronously — GSAP inline styles beat CSS .reveal/.reveal.in,
       so the IntersectionObserver in ui.js adding .in has no effect
       on elements we own. */
    setInitialStates();

    initHero();
    initIntro();
    initRoutes();
    initFleet();
    initWhy();
    initVoices();
    initFinale();
    initMagnetic();

    ScrollTrigger.refresh();
  }

  /* ── Set initial hidden states ──────────────────────────── */
  function setInitialStates() {
    /* Hero */
    gsap.set('.hero-copy h1',        { opacity: 0, y: 44 });
    gsap.set('.hero-ctas',           { opacity: 0, y: 28 });
    gsap.set('.hero-stats',          { opacity: 0, y: 18 });
    gsap.set('.hs-item, .hs-div',    { opacity: 0, y: 10 });

    /* Intro */
    gsap.set('.intro-lead',          { opacity: 0, y: 34 });
    gsap.set('.intro-aside',         { opacity: 0, y: 34 });
    gsap.set('.mosaic figure',       { opacity: 0, y: 46, scale: 0.96 });
    gsap.set('.proof .gcard',        { opacity: 0, y: 30 });

    /* Routes */
    gsap.set('#routes .lead, #routes .side', { opacity: 0, y: 22 });
    gsap.set('.routes-grid .route',  { opacity: 0, y: 42, scale: 0.985 });

    /* Fleet */
    gsap.set('.fleet-row .fleet-text', { opacity: 0, y: 34 });
    gsap.set('.fleet-row .frame',      { opacity: 0.5, scale: 0.985 });
    gsap.set('.spec-list .s',          { opacity: 0, x: -18 });

    /* Why */
    gsap.set('#whyEyebrow',          { opacity: 0, y: 14 });
    gsap.set('#whyHed',              { opacity: 0, y: 24 });
    gsap.set('#whySubrow',           { opacity: 0, y: 14 });
    gsap.set('#whyGrid .wc',         { opacity: 0, y: 28 });
    gsap.set('#whySplit',            { opacity: 0, y: 18 });

    /* Voices */
    gsap.set('.voices-head',         { opacity: 0, y: 28 });
    gsap.set('.vcard',               { opacity: 0, y: 48, scale: 0.97 });

    /* Finale */
    gsap.set('.ch-intro',            { opacity: 0, y: 26 });
    gsap.set('.ch-card',             { opacity: 0, y: 38, scale: 0.985 });
    gsap.set('.closing-copy',        { opacity: 0, y: 24 });
    gsap.set('.an-app',              { opacity: 0, y: 32 });
    gsap.set('.an-chips li',         { opacity: 0, y: 10 });
  }

  /* ── 1. Hero entrance ─────────────────────────────────────
     Runs immediately on load — no scroll needed.
     Timeline keeps each step locked to an absolute position
     so timings are explicit, not drift-accumulating.        */
  function initHero() {
    var h1    = document.querySelector('.hero-copy h1');
    var ctas  = document.querySelector('.hero-ctas');
    var stats = document.querySelector('.hero-stats');
    var items = document.querySelectorAll('.hs-item, .hs-div');

    if (!h1) return;

    gsap.timeline({ delay: 0.45 })
      .to(h1,    { opacity: 1, y: 0, duration: 1.05, ease: EX },   0)
      .to(ctas,  { opacity: 1, y: 0, duration: 0.9,  ease: E  },   0.46)
      .to(stats, { opacity: 1, y: 0, duration: 0.8,  ease: E2 },   0.72)
      .to(items, { opacity: 1, y: 0, duration: 0.5,  ease: E2,
                   stagger: 0.055 },                                0.84);
  }

  /* ── 2. Intro: lead text + mosaic + proof stats ───────── */
  function initIntro() {
    var intro = document.getElementById('intro');
    if (!intro) return;

    /* --- Intro text --- */
    ScrollTrigger.create({
      trigger: intro,
      start: 'top 78%',
      once: true,
      onEnter: function () {
        gsap.to('.intro-lead',  { opacity: 1, y: 0, duration: 0.9,  ease: E });
        gsap.to('.intro-aside', { opacity: 1, y: 0, duration: 0.85, ease: E, delay: 0.1 });
      }
    });

    /* --- Mosaic figures --- */
    var mosaic  = intro.querySelector('.mosaic');
    var figures = mosaic ? mosaic.querySelectorAll('figure') : [];

    if (figures.length) {
      ScrollTrigger.create({
        trigger: mosaic,
        start: 'top 80%',
        once: true,
        onEnter: function () {
          gsap.to(figures, {
            opacity: 1, y: 0, scale: 1,
            duration: 0.92, ease: E,
            stagger: { each: 0.065, from: 'start' }
          });
        }
      });

      /* 3-D mouse tilt — Apple's depth trick */
      figures.forEach(function (fig) {
        var img = fig.querySelector('img');
        var cap = fig.querySelector('figcaption');
        if (!img) return;

        gsap.set(fig, { transformPerspective: 900, transformStyle: 'preserve-3d' });

        var qRY = gsap.quickTo(img, 'rotationY', { duration: 0.55, ease: E2, overwrite: 'auto' });
        var qRX = gsap.quickTo(img, 'rotationX', { duration: 0.55, ease: E2, overwrite: 'auto' });

        fig.addEventListener('mousemove', function (e) {
          var r  = fig.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width  - 0.5;
          var py = (e.clientY - r.top)  / r.height - 0.5;
          qRY(px * 8);
          qRX(-py * 7);
          if (cap) gsap.to(cap, { x: px * 5, duration: 0.35, ease: E2, overwrite: 'auto' });
        });

        fig.addEventListener('mouseleave', function () {
          qRY(0); qRX(0);
          if (cap) gsap.to(cap, { x: 0, duration: 0.5, ease: E2, overwrite: 'auto' });
        });
      });
    }

    /* --- Proof stat cards + GSAP counters --- */
    var proof    = intro.querySelector('.proof');
    var gcards   = proof ? proof.querySelectorAll('.gcard') : [];
    var countEls = proof ? proof.querySelectorAll('.gcard .n[data-count]') : [];

    if (proof && gcards.length) {
      ScrollTrigger.create({
        trigger: proof,
        start: 'top 72%',
        once: true,
        onEnter: function () {
          proof.classList.add('in-view');

          /* Card entrance stagger */
          gsap.to(gcards, { opacity: 1, y: 0, duration: 0.72, ease: E, stagger: 0.07 });

          /* GSAP counter — proxy object approach (never parse innerText) */
          countEls.forEach(function (el, i) {
            var endVal = parseFloat(el.dataset.count);
            var dec    = parseInt(el.dataset.dec  || '0', 10);
            var suffix = el.dataset.suffix || '';
            var proxy  = { val: 0 };

            gsap.to(proxy, {
              val: endVal,
              duration: 1.9,
              ease: 'power2.out',
              delay: i * 0.12,
              immediateRender: false,
              onUpdate: function () {
                el.textContent = (dec ? proxy.val.toFixed(dec) : Math.round(proxy.val)) + suffix;
              },
              onComplete: function () {
                /* Set authoritative final value, then micro-pop */
                el.textContent = (dec ? endVal.toFixed(dec) : Math.round(endVal)) + suffix;
                gsap.fromTo(el, { scale: 1.06 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
              }
            });
          });

          /* CSS shimmer sweep (class-based, timed to match card entrance) */
          gcards.forEach(function (card, idx) {
            gsap.delayedCall(0.6 + idx * 0.1, function () {
              card.classList.add('in-view');
            });
          });
        }
      });
    }
  }

  /* ── 3. Routes: stagger + bus journey surprise ─────────── */
  function initRoutes() {
    var section = document.getElementById('routes');
    if (!section) return;

    var cards = section.querySelectorAll('.routes-grid .route');
    var head  = section.querySelectorAll('#routes .lead, #routes .side');

    /* ② once: true */
    ScrollTrigger.create({
      trigger: section,
      start: 'top 78%',
      once: true,
      onEnter: function () {
        gsap.to(head,  { opacity: 1, y: 0, duration: 0.72, ease: E, stagger: 0.08 });
        gsap.to(cards, { opacity: 1, y: 0, scale: 1, duration: 0.82, ease: E,
                         stagger: 0.065, delay: 0.05 });
      }
    });

    cards.forEach(function (route, idx) {
      /* ⑤ Idempotency guard — never inject twice */
      if (route.querySelector('.route-journey')) return;

      /* Inject bus journey SVG */
      var journey = document.createElement('div');
      journey.className = 'route-journey';
      journey.innerHTML =
        '<svg viewBox="0 0 120 3" preserveAspectRatio="none">' +
          '<path class="rj-path" d="M2 1.5 L118 1.5"/>' +
        '</svg>' +
        '<div class="rj-bus">' +
          '<svg viewBox="0 0 14 10" fill="none" stroke="currentColor" stroke-width="1.1">' +
            '<rect x="1" y="1.5" width="10" height="6" rx="1"/>' +
            '<circle cx="3.8" cy="8.3" r="1"/>' +
            '<circle cx="10.2" cy="8.3" r="1"/>' +
          '</svg>' +
        '</div>';
      route.appendChild(journey);

      var path = journey.querySelector('.rj-path');
      var bus  = journey.querySelector('.rj-bus');
      var len  = path.getTotalLength();

      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      gsap.set(bus,  { opacity: 0, x: 0 });

      /* ④ Per-card flag: scroll drive fires only once */
      var driven = false;

      ScrollTrigger.create({               /* ② once: true */
        trigger: route,
        start: 'top 82%',
        once: true,
        onEnter: function () {
          if (driven) return;
          driven = true;
          driveJourney(journey, path, bus, len, idx * 0.055, false);
        }
      });

      /* Hover always replays — gives delight on every visit */
      route.addEventListener('mouseenter', function () {
        driveJourney(journey, path, bus, len, 0, true);
      });

      /* Subtle Y-axis card tilt */
      var qTilt = gsap.quickTo(route, 'rotationY',
                               { duration: 0.45, ease: 'power1.out', overwrite: 'auto' });
      route.addEventListener('mousemove', function (e) {
        var r = route.getBoundingClientRect();
        qTilt(((e.clientX - r.left) / r.width - 0.5) * 5.5);
      });
      route.addEventListener('mouseleave', function () { qTilt(0); });
    });
  }

  /* ── 4. Fleet: text + image + spec stagger + parallax ─── */
  function initFleet() {
    document.querySelectorAll('.fleet-row').forEach(function (row) {
      var fleetText = row.querySelector('.fleet-text');
      var frame     = row.querySelector('.frame');
      var specItems = row.querySelectorAll('.spec-list .s');
      var img       = frame && frame.querySelector('img');

      ScrollTrigger.create({
        trigger: row,
        start: 'top 78%',
        once: true,
        onEnter: function () {
          if (fleetText) gsap.to(fleetText, { opacity: 1, y: 0, duration: 0.9, ease: E });
          if (frame)     gsap.to(frame,     { opacity: 1, scale: 1, duration: 1.0, ease: E });
          if (specItems.length) {
            gsap.to(specItems, {
              opacity: 1, x: 0, duration: 0.55, ease: E2, stagger: 0.08, delay: 0.35
            });
          }
        }
      });

      /* Scrub parallax — smooth depth on fleet imagery */
      if (img) {
        gsap.to(img, {
          yPercent: -8, ease: 'none',
          scrollTrigger: {
            trigger: row, start: 'top bottom', end: 'bottom top', scrub: 1.2
          }
        });
      }
    });
  }

  /* ── 5. Why section (absorbed from why-gsap.js) ─────────── */
  function initWhy() {
    var section = document.getElementById('why');
    if (!section) return;

    var eyebrow = document.getElementById('whyEyebrow');
    var hed     = document.getElementById('whyHed');
    var subrow  = document.getElementById('whySubrow');
    var cards   = section.querySelectorAll('#whyGrid .wc');
    var ghosts  = section.querySelectorAll('.wc-ghost');
    var split   = document.getElementById('whySplit');

    /* Headline cascade */
    ScrollTrigger.create({
      trigger: section,
      start: 'top 72%',
      once: true,
      onEnter: function () {
        var tl = gsap.timeline();
        if (eyebrow) tl.to(eyebrow, { opacity: 1, y: 0, duration: 0.4,  ease: E });
        if (hed)     tl.to(hed,     { opacity: 1, y: 0, duration: 0.45, ease: E }, '-=0.24');
        if (subrow)  tl.to(subrow,  { opacity: 1, y: 0, duration: 0.38, ease: E }, '-=0.22');
      }
    });

    /* Grid cards — tight stagger */
    if (cards.length) {
      ScrollTrigger.create({
        trigger: '#whyGrid',
        start: 'top 80%',
        once: true,
        onEnter: function () {
          gsap.to(cards, { opacity: 1, y: 0, duration: 0.35, ease: E2, stagger: 0.035 });
        }
      });
    }

    /* Ghost number parallax — subtle depth per card */
    ghosts.forEach(function (ghost) {
      gsap.to(ghost, {
        y: -20, ease: 'none',
        immediateRender: false,
        scrollTrigger: {
          trigger: ghost.closest('.wc'),
          start: 'top bottom', end: 'bottom top', scrub: true
        }
      });
    });

    /* Duality split reveal */
    if (split) {
      ScrollTrigger.create({
        trigger: split,
        start: 'top 88%',
        once: true,
        onEnter: function () {
          gsap.to(split, { opacity: 1, y: 0, duration: 0.42, ease: E2 });
        }
      });
    }
  }

  /* ── 6. Voices / testimonials: 3-D tilt cards ──────────── */
  function initVoices() {
    var section = document.getElementById('voices');
    if (!section) return;

    var head  = section.querySelector('.voices-head');
    var cards = section.querySelectorAll('.vcard');

    ScrollTrigger.create({
      trigger: section,
      start: 'top 74%',
      once: true,
      onEnter: function () {
        if (head) gsap.to(head, { opacity: 1, y: 0, duration: 0.82, ease: E });
        if (cards.length) {
          gsap.to(cards, {
            opacity: 1, y: 0, scale: 1,
            duration: 0.88, ease: E, stagger: 0.1, delay: 0.12
          });
        }
      }
    });

    /* 3-D tilt interaction */
    cards.forEach(function (card) {
      gsap.set(card, { transformPerspective: 1000 });

      var qRY = gsap.quickTo(card, 'rotationY', { duration: 0.55, ease: E2, overwrite: 'auto' });
      var qRX = gsap.quickTo(card, 'rotationX', { duration: 0.55, ease: E2, overwrite: 'auto' });

      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        qRY(((e.clientX - r.left) / r.width  - 0.5) * 11);
        qRX(((e.clientY - r.top)  / r.height - 0.5) * -9);
        gsap.to(card, { scale: 1.015, duration: 0.2, ease: E2, overwrite: 'auto' });
      });

      card.addEventListener('mouseleave', function () {
        qRY(0); qRX(0);
        gsap.to(card, { scale: 1, duration: 0.5, ease: E2, overwrite: 'auto' });
      });
    });
  }

  /* ── 7. Charter, Closing, App ─────────────────────────── */
  function initFinale() {
    var charter = document.querySelector('.charter-section');
    if (charter) {
      ScrollTrigger.create({
        trigger: charter,
        start: 'top 70%',
        once: true,
        onEnter: function () {
          gsap.to('.ch-intro', { opacity: 1, y: 0, duration: 0.88, ease: E });
          gsap.to('.ch-card',  { opacity: 1, y: 0, scale: 1, duration: 1.05, ease: E, delay: 0.12 });
        }
      });
    }

    var closing = document.querySelector('.closing');
    if (closing) {
      ScrollTrigger.create({
        trigger: closing,
        start: 'top 80%',
        once: true,
        onEnter: function () {
          gsap.to('.closing-copy', { opacity: 1, y: 0, duration: 1.1, ease: E });
        }
      });
    }

    var appSection = document.querySelector('.appnews');
    if (appSection) {
      ScrollTrigger.create({
        trigger: appSection,
        start: 'top 82%',
        once: true,
        onEnter: function () {
          gsap.to('.an-app',      { opacity: 1, y: 0, duration: 0.9, ease: E });
          gsap.to('.an-chips li', { opacity: 1, y: 0, duration: 0.5, ease: E,
                                    stagger: 0.06, delay: 0.38 });
        }
      });
    }
  }

  /* ── 8. Magnetic buttons ────────────────────────────────── */
  function initMagnetic() {
    document.querySelectorAll('.glass-button, .hero-quote-btn').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        gsap.to(btn, {
          x: (e.clientX - (r.left + r.width  / 2)) * 0.28,
          y: (e.clientY - (r.top  + r.height / 2)) * 0.28,
          duration: 0.28, ease: E2, overwrite: 'auto'
        });
      });

      btn.addEventListener('mouseleave', function () {
        gsap.to(btn, { x: 0, y: 0, duration: 0.6,
                       ease: 'elastic.out(1, 0.6)', overwrite: 'auto' });
      });
    });
  }

  /* ── Bus drive helper ───────────────────────────────────────
     Shared by scroll-reveal (isHover=false) and mouseenter
     (isHover=true). Uses GPU-accelerated `x` transform, not
     the layout property `left`, for guaranteed 60 fps.      */
  function driveJourney(container, path, bus, len, delay, isHover) {
    /* Measure travel distance at call-time (element is in DOM, so non-zero). */
    var trackW = container.offsetWidth;
    var busW   = bus.offsetWidth || 14;
    var travel = Math.max(trackW - busW, 0);
    var speed  = isHover ? 0.62 : 1.15;

    gsap.killTweensOf([path, bus]);
    gsap.set(path, { strokeDashoffset: len });
    gsap.set(bus,  { opacity: 0, x: 0 });

    gsap.to(path, {
      strokeDashoffset: 0,
      duration: speed * 1.2,
      ease: 'power2.inOut',
      delay: delay
    });

    gsap.to(bus, {
      opacity: 1,
      x: travel,
      duration: speed * 1.55,
      ease: 'power2.inOut',
      delay: delay + (isHover ? 0.06 : 0.18),
      onComplete: isHover ? null : function () {
        gsap.to(bus, { opacity: 0.28, duration: 0.45, delay: 0.55 });
      }
    });
  }

})();

/* ============================================================
   VIABUS · Quote Page GSAP — premium entrance animations

   Anti-double-fire:
   ① window.__viabusQuote module guard
   ② { once: true } on load listener
   ③ ScrollTrigger used with once:true on sidebar items
   ============================================================ */
(function () {
  'use strict';

  if (window.__viabusQuote) return;
  window.__viabusQuote = true;

  var E  = 'power3.out';
  var E2 = 'power2.out';
  var EX = 'expo.out';

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

  /* ── Main init ────────────────────────────────────────────── */
  function init() {
    gsap.registerPlugin(ScrollTrigger);
    window.__viabusGSAP = true;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
      return;
    }

    setInitialStates();
    initHero();
    initForm();
    initSidebar();
    initGlow();
    initServiceCards();

    ScrollTrigger.refresh();
  }

  /* ── Set hidden initial states ───────────────────────────── */
  function setInitialStates() {
    gsap.set('.qp-eyebrow',     { opacity: 0, x: -18 });
    gsap.set('.qp-line-inner',  { y: '115%' });
    gsap.set('.qp-sub',         { opacity: 0, y: 20 });
    gsap.set('.qp-section',     { opacity: 0, y: 28 });
    gsap.set('.qp-form-foot',   { opacity: 0, y: 16 });
    gsap.set('.qp-next-card',   { opacity: 0, y: 24 });
    gsap.set('.qp-trust-row',   { opacity: 0, y: 20 });
    gsap.set('.qp-popular',     { opacity: 0, y: 20 });
  }

  /* ── 1. Hero entrance ─────────────────────────────────────── */
  function initHero() {
    gsap.timeline({ delay: 0.28 })
      .to('.qp-eyebrow',    { opacity: 1, x: 0, duration: 0.6, ease: E    }, 0)
      .to('.qp-line-inner', { y: '0%', duration: 0.92, ease: EX, stagger: 0.12 }, 0.14)
      .to('.qp-sub',        { opacity: 1, y: 0, duration: 0.7, ease: E    }, 0.55);
  }

  /* ── 2. Form sections cascade in ─────────────────────────── */
  function initForm() {
    var sections = document.querySelectorAll('.qp-section');
    sections.forEach(function (sec, i) {
      ScrollTrigger.create({
        trigger: sec,
        start: 'top 88%',
        once: true,
        onEnter: function () {
          gsap.to(sec, {
            opacity: 1, y: 0,
            duration: 0.65, ease: E,
            delay: i * 0.04
          });
        }
      });
    });

    /* Form foot (submit button) */
    var foot = document.querySelector('.qp-form-foot');
    if (foot) {
      ScrollTrigger.create({
        trigger: foot,
        start: 'top 92%',
        once: true,
        onEnter: function () {
          gsap.to(foot, { opacity: 1, y: 0, duration: 0.55, ease: E });
        }
      });
    }

    /* Field focus glow */
    document.querySelectorAll('.qp-field input, .qp-field select, .qp-field textarea')
      .forEach(function (inp) {
        inp.addEventListener('focus', function () {
          gsap.to(inp, { scale: 1.009, duration: 0.22, ease: E2, overwrite: 'auto' });
        });
        inp.addEventListener('blur', function () {
          gsap.to(inp, { scale: 1, duration: 0.22, ease: E2, overwrite: 'auto' });
        });
      });
  }

  /* ── 3. Sidebar scroll reveals ───────────────────────────── */
  function initSidebar() {
    var items = ['.qp-next-card', '.qp-trust-row', '.qp-popular'];
    items.forEach(function (sel, i) {
      var el = document.querySelector(sel);
      if (!el) return;
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: function () {
          gsap.to(el, {
            opacity: 1, y: 0,
            duration: 0.65, ease: E,
            delay: i * 0.07
          });
        }
      });
    });

    /* Step numbers bounce in */
    ScrollTrigger.batch('.qp-step-num', {
      onEnter: function (batch) {
        gsap.from(batch, {
          scale: 0.5, opacity: 0, duration: 0.5, ease: 'back.out(2.2)',
          stagger: 0.08, overwrite: 'auto'
        });
      },
      start: 'top 90%',
      once: true
    });
  }

  /* ── 4. Service card hover lift ──────────────────────────── */
  function initServiceCards() {
    document.querySelectorAll('.qp-svc').forEach(function (label) {
      var radio = label.querySelector('input[type="radio"]');
      if (!radio) return;

      radio.addEventListener('change', function () {
        if (radio.checked) {
          gsap.fromTo(label.querySelector('.qp-svc-card'),
            { scale: 0.97 },
            { scale: 1, duration: 0.38, ease: 'back.out(2)' }
          );
        }
      });
    });
  }

  /* ── 5. Hero ambient glow follows mouse ──────────────────── */
  function initGlow() {
    var hero = document.getElementById('qpHero');
    var glow = document.querySelector('.qp-hero-glow');
    if (!hero || !glow) return;

    var qX = gsap.quickTo(glow, 'xPercent', { duration: 1.3, ease: E2 });
    var qY = gsap.quickTo(glow, 'yPercent', { duration: 1.3, ease: E2 });

    hero.addEventListener('mousemove', function (e) {
      var r  = hero.getBoundingClientRect();
      var px = (e.clientX - r.left)  / r.width  - 0.5;
      var py = (e.clientY - r.top)   / r.height - 0.5;
      qX(px * 16);
      qY(py * 10);
    });

    hero.addEventListener('mouseleave', function () {
      qX(0); qY(0);
    });
  }

})();

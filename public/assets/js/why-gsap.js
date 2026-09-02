/* ============================================================
   VIABUS · Why section — GSAP scroll-triggered reveals
   ============================================================ */
(function () {
  'use strict';

  function init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    var section = document.getElementById('why');
    if (!section) return;

    var sectionTrigger = { trigger: section, start: 'top 72%', toggleActions: 'play none none none' };

    /* eyebrow */
    gsap.fromTo('#whyEyebrow',
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.38, ease: 'power3.out', immediateRender: false, scrollTrigger: sectionTrigger }
    );

    /* headline */
    gsap.fromTo('#whyHed',
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: 0.45, delay: 0.05, ease: 'power3.out', immediateRender: false, scrollTrigger: sectionTrigger }
    );

    /* sub row */
    gsap.fromTo('#whySubrow',
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.38, delay: 0.11, ease: 'power3.out', immediateRender: false, scrollTrigger: sectionTrigger }
    );

    /* grid cells — staggered */
    gsap.fromTo('#whyGrid .wc',
      { opacity: 0, y: 26 },
      {
        opacity: 1, y: 0,
        duration: 0.33,
        ease: 'power2.out',
        stagger: 0.035,
        immediateRender: false,
        scrollTrigger: {
          trigger: '#whyGrid',
          start: 'top 80%',
          toggleActions: 'play none none none'
        }
      }
    );

    /* ghost number subtle parallax per card */
    gsap.utils.toArray('.wc-ghost').forEach(function (ghost) {
      gsap.to(ghost, {
        y: -20,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: {
          trigger: ghost.closest('.wc'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });

    /* duality split */
    gsap.fromTo('#whySplit',
      { opacity: 0, y: 16 },
      {
        opacity: 1, y: 0, duration: 0.4, ease: 'power2.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: '#whySplit',
          start: 'top 88%',
          toggleActions: 'play none none none'
        }
      }
    );
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();

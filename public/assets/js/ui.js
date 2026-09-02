/* ============================================================
   VIABUS · UI
   ------------------------------------------------------------
   Global interface behaviour, independent of the scroll film:
   • Nav colour toggle (white over the hero film → solid over cream)
   • Fullscreen menu open/close
   • Reveal-on-scroll
   • Stat count-up
   ============================================================ */
(function () {
  "use strict";

  /* ---- image fallback ----
     Photos point at local generated files (assets/img/...). Until those
     files exist, fall back to the placeholder URL in data-fallback so the
     page always renders; auto-upgrades the moment the real files are added. */
  (function () {
    function swap(img) {
      if (img.dataset.fbDone || !img.dataset.fallback) return;
      img.dataset.fbDone = "1";
      img.src = img.dataset.fallback;
    }
    document.querySelectorAll("img[data-fallback]").forEach(function (img) {
      img.addEventListener("error", function () { swap(img); });
      if (img.complete && img.naturalWidth === 0) swap(img); // already failed pre-JS
    });
  })();

  var nav = document.getElementById("nav");
  /* home page: #hero / .seq  |  inner pages: first <header> or <section> with a class */
  var heroFilm = document.getElementById("hero")
    || document.querySelector(".seq")
    || document.querySelector("header[class], section[class]");

  /* ---- nav colour: white while over the (tall, dark) hero,
          solid cream once that section has scrolled past ---- */
  if (nav && heroFilm) {
    var navState = function () {
      var threshold = heroFilm.offsetHeight - 110;
      nav.classList.toggle("solid", window.scrollY > threshold);
    };
    window.addEventListener("scroll", navState, { passive: true });
    window.addEventListener("resize", navState);
    navState();
  } else if (nav) {
    nav.classList.add("solid");
  }

  /* ---- reveal on scroll ---- */
  if ("IntersectionObserver" in window) {
    var rObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          rObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -6% 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { rObs.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- stat count-up ---- */
  /* Skip if premium GSAP home counters are active (smoother version) */
  if ("IntersectionObserver" in window && !window.__viabusGSAP) {
    var cObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        cObs.unobserve(e.target);
        var el = e.target;
        var end = parseFloat(el.dataset.count);
        var dec = parseInt(el.dataset.dec, 10) || 0;
        var suffix = el.dataset.suffix || "";
        var t0 = null;
        var duration = 1400;
        function step(t) {
          if (!t0) t0 = t;
          var p = Math.min((t - t0) / duration, 1);
          var v = end * (1 - Math.pow(1 - p, 3));
          el.textContent = (dec ? v.toFixed(dec) : Math.round(v)) + suffix;
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll("[data-count]").forEach(function (el) { cObs.observe(el); });
  }
})();

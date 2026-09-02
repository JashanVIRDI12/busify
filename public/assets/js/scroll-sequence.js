/* ============================================================
   VIABUS · Scroll Sequence Controller
   ------------------------------------------------------------
   Renders a 145-frame image sequence onto a <canvas>, scrubbed
   by scroll position through a tall pinned section.

   • 60fps: a requestAnimationFrame loop eases the displayed
     frame toward the scroll-derived target every tick, so the
     145 source frames scrub smoothly regardless of scroll speed.
   • Performance: the rAF loop only runs while the section is
     near the viewport (IntersectionObserver gate).
   • Resilience: draws frame 0 as soon as it loads; falls back
     to a static poster on prefers-reduced-motion or no canvas.

   Config is data-driven via the markup (see index.html #journey).
   ============================================================ */
(function () {
  "use strict";

  var wrap = document.querySelector(".seq");
  var canvas = document.getElementById("seqCanvas");
  if (!wrap || !canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");

  /* ---- config (overridable via data-* on #journey) ---- */
  var FRAMES = parseInt(wrap.dataset.frames, 10) || 145;
  var PATH   = wrap.dataset.path || "assets/img/sequence/frame_";
  var EXT    = wrap.dataset.ext || ".jpg";
  var PAD    = parseInt(wrap.dataset.pad, 10) || 4;
  var EASE   = 0.82; // frame easing factor — higher = snappier scrub

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- state ---- */
  var images = new Array(FRAMES);
  var loaded = 0;
  var current = 0;   // currently displayed (eased) frame
  var target = 0;    // scroll-derived target frame
  var active = false;
  var rafId = null;

  /* ---- elements ---- */
  var bar = document.getElementById("seqBar");
  var loadingEl = document.getElementById("seqLoading");
  var pctEl = document.getElementById("seqPct");
  var counterEl = document.getElementById("seqCounter");
  // every element with data-from is a scroll-timed fade target:
  // hero copy + brand mark (mode "out") and chapter captions (mode "inout")
  var fades = Array.prototype.slice.call(wrap.querySelectorAll("[data-from]"));

  /* ---- helpers ---- */
  function frameSrc(i) {
    var n = String(i + 1);
    while (n.length < PAD) n = "0" + n;
    return PATH + n + EXT;
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // cover-fit draw (like background-size:cover)
  function draw(frameFloat) {
    var idx = clamp(Math.round(frameFloat), 0, FRAMES - 1);
    var img = images[idx];
    if (!img || !img.complete || !img.naturalWidth) return;

    var cw = canvas.clientWidth;
    var ch = canvas.clientHeight;
    var ir = img.naturalWidth / img.naturalHeight;
    var cr = cw / ch;
    var dw, dh, dx, dy;

    if (cr > ir) { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
    else { dh = ch; dw = ch * ir; dy = 0; dx = (cw - dw) / 2; }

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // scroll progress (0..1) through the pinned wrapper
  function progress() {
    var rect = wrap.getBoundingClientRect();
    var distance = wrap.offsetHeight - window.innerHeight;
    if (distance <= 0) return 0;
    return clamp(-rect.top / distance, 0, 1);
  }

  function updateFades(p) {
    for (var i = 0; i < fades.length; i++) {
      var el = fades[i];
      var from = parseFloat(el.dataset.from) || 0;
      var to = parseFloat(el.dataset.to);
      if (isNaN(to)) to = 1;
      var mode = el.dataset.mode || "inout";
      var o, lift;

      if (mode === "out") {
        // visible from the very start, fades out over the last 40% of its range
        if (p <= from) o = 1;
        else if (p >= to) o = 0;
        else { var lo = (p - from) / (to - from || 1); o = lo < 0.6 ? 1 : (1 - lo) / 0.4; }
        lift = -(1 - o) * 24;           // lifts up and away as it leaves
      } else {
        // fade in over first 25%, hold, fade out over last 25%
        o = 0;
        if (p >= from && p <= to) {
          var li = (p - from) / (to - from || 1);
          o = li < 0.25 ? li / 0.25 : li > 0.75 ? (1 - li) / 0.25 : 1;
        }
        lift = (1 - o) * 18;            // rises up from below into place
      }

      o = o < 0 ? 0 : o > 1 ? 1 : o;
      el.style.opacity = o.toFixed(3);
      el.style.transform = "translateY(" + lift.toFixed(1) + "px)";
      if (el.hasAttribute("data-interactive")) {
        el.style.pointerEvents = o > 0.05 ? "auto" : "none";
      }
    }
  }

  function loop() {
    var p = progress();
    target = p * (FRAMES - 1);

    // ease current → target for 60fps smoothness
    current += (target - current) * EASE;
    if (Math.abs(target - current) < 0.05) current = target;

    draw(current);
    updateFades(p);

    if (bar) bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    if (counterEl) {
      var n = String(clamp(Math.round(current) + 1, 1, FRAMES));
      while (n.length < 3) n = "0" + n;
      counterEl.textContent = n + " / " + FRAMES;
    }
    if (p > 0.02) wrap.classList.add("is-scrolled");

    if (active) rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (active) return;
    active = true;
    rafId = requestAnimationFrame(loop);
  }
  function stop() {
    active = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  /* ---- loading ---- */
  function onProgress() {
    var pct = Math.round((loaded / FRAMES) * 100);
    if (pctEl) pctEl.textContent = pct;
    // reveal the canvas once a small buffer is ready
    if (loaded >= Math.min(10, FRAMES) && loadingEl) {
      loadingEl.classList.add("hide");
    }
  }

  function preload() {
    for (var i = 0; i < FRAMES; i++) {
      (function (i) {
        var img = new Image();
        img.decoding = "async";
        img.onload = function () {
          loaded++;
          if (i === 0) draw(0);          // first paint asap
          onProgress();
        };
        img.onerror = function () { loaded++; onProgress(); };
        img.src = frameSrc(i);
        images[i] = img;
      })(i);
    }
  }

  /* ---- reduced-motion / static fallback ---- */
  function runStatic() {
    wrap.classList.add("seq-static");
    if (loadingEl) loadingEl.classList.add("hide");
    var img = new Image();
    img.onload = function () {
      images[0] = img;
      sizeCanvas();
      draw(0);
    };
    img.src = frameSrc(0);
    window.addEventListener("resize", function () { sizeCanvas(); draw(0); }, { passive: true });
  }

  /* ---- init ---- */
  function init() {
    sizeCanvas();

    if (reduceMotion) { runStatic(); return; }

    preload();

    window.addEventListener("resize", function () {
      sizeCanvas();
      draw(current);
    }, { passive: true });

    // gate the rAF loop to when the section is on/near screen
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }, { rootMargin: "300px 0px" });
      io.observe(wrap);
    } else {
      start();
    }
  }

  init();
})();

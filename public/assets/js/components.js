/* ============================================================
   VIABUS · Universal Components
   Injects the shared nav and footer into every page.
   Loaded as a synchronous script (no defer) so ui.js finds
   #nav and #menu when it runs.
   ============================================================ */
(function () {
  'use strict';

  /* ── NAV ──────────────────────────────────────────────────── */
  var NAV = `
<nav class="nav" id="nav">
  <div class="nav-left">
    <button class="burger" id="burger" aria-label="Open menu"><span></span></button>
    <div class="nav-links">
      <a href="routes.html">Routes</a>
      <a href="fleet.html">Fleet</a>
      <a href="experience.html">Experience</a>
      <a href="corporate.html">Corporate</a>
    </div>
  </div>
  <a href="index.html" class="wordmark">VIABUS</a>
  <div class="nav-right">
    <a href="about.html" class="ghost exp">About</a>
    <div class="glass-button-wrap nav-glass-btn">
      <a href="quote.html" class="glass-button glass-button--sm">
        <span class="glass-button-text">Get a quote</span>
      </a>
      <div class="glass-button-shadow"></div>
    </div>
  </div>
</nav>

<div class="menu-overlay" id="menu">
  <div class="menu-top">
    <a href="index.html" class="wordmark" style="letter-spacing:.42em;font-size:16px">VIABUS</a>
    <button class="menu-close" id="menuClose">Close
      <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
    </button>
  </div>
  <nav class="menu-list">
    <a href="index.html">The Journey<em>01</em></a>
    <a href="routes.html">Routes<em>02</em></a>
    <a href="fleet.html">Fleet<em>03</em></a>
    <a href="experience.html">Experience<em>04</em></a>
    <a href="corporate.html">Corporate<em>05</em></a>
    <a href="about.html">About<em>06</em></a>
    <a href="quote.html">Get a quote<em>07</em></a>
  </nav>
  <div class="menu-foot">
    <span>support@viabus.com</span>
    <span>500+ cities</span>
    <span>Est. 2026</span>
  </div>
</div>`;

  /* ── FOOTER ───────────────────────────────────────────────── */
  var FOOTER = `
<footer class="foot-shell">
  <div class="container foot">
    <div class="foot-top">
      <div class="foot-brand">
        <div class="wordmark">VIABUS</div>
        <p>Premium intercity coach travel across Canada and the USA — engineered for comfort, built on trust, tracked every mile.</p>
        <form class="foot-news" onsubmit="return false">
          <input type="email" placeholder="Get route deals" />
          <button type="submit">Subscribe</button>
        </form>
      </div>
      <div class="foot-col"><h4>Company</h4><a href="about.html">About</a><a href="#">Careers</a><a href="#">Newsroom</a><a href="#">Operators</a><a href="#">Sustainability</a></div>
      <div class="foot-col"><h4>Travel</h4><a href="routes.html">Routes</a><a href="fleet.html">Fleet</a><a href="experience.html">Experience</a><a href="corporate.html">Corporate</a><a href="quote.html">Get a quote</a></div>
      <div class="foot-col"><h4>Support</h4><a href="#">Help center</a><a href="#">Manage booking</a><a href="#">Refunds</a><a href="#">Accessibility</a><a href="#">Contact</a></div>
    </div>
    <div class="foot-bot">
      <div class="copy">© 2026 VIABUS Travel, Inc. · Terms · Privacy · Cookies</div>
      <div class="socials">
        <a href="#" aria-label="X"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3l-7 8 8.2 10h-6.4l-5-6.1L4 21H1l7.5-8.6L.6 3H7l4.5 5.6L17.5 3Zm-1.1 16h1.7L7.7 4.8H5.9L16.4 19Z"/></svg></a>
        <a href="#" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.6"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor"/></svg></a>
        <a href="#" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4M11 17v-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></a>
      </div>
    </div>
  </div>
</footer>`;

  /* ── INJECT ───────────────────────────────────────────────── */
  document.body.insertAdjacentHTML('afterbegin', NAV);
  document.body.insertAdjacentHTML('beforeend', FOOTER);

  /* ── ACTIVE LINK ──────────────────────────────────────────── */
  var page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .menu-list a').forEach(function (a) {
    if (a.getAttribute('href') === page) {
      a.setAttribute('aria-current', 'page');
    }
  });

  /* ── MENU TOGGLE ──────────────────────────────────────────── */
  var menu    = document.getElementById('menu');
  var burger  = document.getElementById('burger');
  var menuClose = document.getElementById('menuClose');

  function openMenu()  { if (menu) { menu.classList.add('open');    document.body.style.overflow = 'hidden'; } }
  function closeMenu() { if (menu) { menu.classList.remove('open'); document.body.style.overflow = '';       } }

  if (burger)    burger.addEventListener('click', openMenu);
  if (menuClose) menuClose.addEventListener('click', closeMenu);
  if (menu)      menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

})();

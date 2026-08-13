/* ============================================================
   0x4ea · interactions
   - theme toggle (persisted)
   - mobile nav
   - staggered scroll reveal (IntersectionObserver, a11y-safe)
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---- Theme ---- */
  var toggle = document.getElementById('themeToggle');
  var stored = null;
  try { stored = localStorage.getItem('0x4ea-theme'); } catch (e) {}

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (toggle) toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  // Initial: stored > system preference
  if (stored === 'dark' || stored === 'light') {
    applyTheme(stored);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
  } else {
    applyTheme('light');
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('0x4ea-theme', next); } catch (e) {}
    });
  }

  /* ---- Mobile menu ---- */
  var menuBtn = document.getElementById('menuBtn');
  var mobileMenu = document.getElementById('mobileMenu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', function () {
      var open = mobileMenu.hasAttribute('hidden');
      if (open) {
        mobileMenu.removeAttribute('hidden');
        mobileMenu.style.display = 'flex';
      } else {
        mobileMenu.style.display = 'none';
        mobileMenu.setAttribute('hidden', '');
      }
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        mobileMenu.style.display = 'none';
        mobileMenu.setAttribute('hidden', '');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---- Scroll reveal ---- */
  var reveals = document.querySelectorAll('.reveal');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    reveals.forEach(function (el) { io.observe(el); });
  }
})();

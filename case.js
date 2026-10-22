/* ==================================================================
   case.js · Pages d'étude de cas (Sameva, TicketFlow)
   Barre d'XP, mémorisation de la langue, succès « Sous le capot ».
   ================================================================== */
(function () {
  'use strict';
  var xp = document.querySelector('.xp');
  function onScroll() {
    var max = document.documentElement.scrollHeight - innerHeight;
    var p = max > 0 ? scrollY / max : 0;
    if (xp) xp.style.setProperty('--p', p.toFixed(4));
    if (p > 0.45) unlock();
  }
  var done = false;
  function unlock() {
    if (done || !window.achievements) return;
    done = true;
    window.achievements.unlock('case_study');
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  document.querySelectorAll('[data-setlang]').forEach(function (a) {
    a.addEventListener('click', function () {
      try { localStorage.setItem('sb-lang', a.dataset.setlang); } catch (e) { /* stockage indisponible */ }
    });
  });
})();

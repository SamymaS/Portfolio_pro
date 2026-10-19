/* ================================================================
   achievements.js — Succès débloquables pour les mini-jeux
   Persistance via localStorage, notification toast à l'unlock.
   ================================================================ */
(function () {
  'use strict';

  // Définition des succès (id → icône + titre + description)
  const DEFS = {
    champion:     { game: 'connect4', title: 'Champion',        desc: 'Battre l’IA au Puissance 4' },
    snake_50:     { game: 'snake', title: 'Charmeur',        desc: 'Atteindre 50 pts à Snake' },
    quiz_master:  { game: 'quiz', title: 'Quiz Master',     desc: 'Sans-faute au Quiz Tech' },
    memory_king:  { game: 'memory', title: 'Roi du Memory',   desc: 'Memory en 20 coups max' },
    tictac_master:{ game: 'tictactoe', title: 'Stratège',        desc: 'Battre l’IA au Morpion' },
    pong_win:     { game: 'pong', title: 'Smash',           desc: 'Gagner un match de Pong' },
    flappy_20:    { game: 'flappy', title: 'Envolée',         desc: 'Passer 20 portes à Envol' },
    reflex_pro:   { game: 'reflex', title: 'Éclair',          desc: 'Réagir en moins de 250 ms' },
    mine_sweeper: { game: 'minesweeper', title: 'Démineur',        desc: 'Résoudre le Démineur' },
    tetris_10:    { game: 'tetris', title: 'Tetromino',       desc: 'Effacer 10 lignes à Blocs' },
    whack_25:     { game: 'whack', title: 'Marteau',         desc: '25 taupes en 30 s' },
    taquin_win:   { game: 'taquin', title: 'Taquin résolu',   desc: 'Remettre le taquin en ordre' },
    rps_streak:   { game: 'rps', title: 'Série gagnante',  desc: '5 victoires d’affilée' },
  };

  const STORAGE_KEY = 'sb-achievements';

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { /* stockage indisponible */ }
  }

  let unlocked = load();

  // Conteneur des toasts (créé à la volée)
  let toastWrap = null;
  function ensureWrap() {
    if (toastWrap) return toastWrap;
    toastWrap = document.createElement('div');
    toastWrap.className = 'ach-toasts';
    toastWrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastWrap);
    return toastWrap;
  }

  function showToast(def) {
    const wrap = ensureWrap();
    const el = document.createElement('div');
    el.className = 'ach-toast';
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<span class="ach-toast-icon"></span>' +
      '<span class="ach-toast-body">' +
        '<span class="ach-toast-label">Succès débloqué</span>' +
        '<span class="ach-toast-title"></span>' +
        '<span class="ach-toast-desc"></span>' +
      '</span>';
    // icône du jeu, reprise de son bouton dans le labo
    const ico = document.querySelector('[data-game="' + def.game + '"] svg');
    if (ico) el.querySelector('.ach-toast-icon').appendChild(ico.cloneNode(true));
    // textContent pour éviter toute injection
    el.querySelector('.ach-toast-title').textContent = def.title;
    el.querySelector('.ach-toast-desc').textContent = def.desc;
    wrap.appendChild(el);

    requestAnimationFrame(() => el.classList.add('show'));
    const remove = () => {
      el.classList.remove('show');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 600); // filet de sécurité
    };
    const timer = setTimeout(remove, 4200);
    el.addEventListener('click', () => { clearTimeout(timer); remove(); });
  }

  function unlock(id) {
    const def = DEFS[id];
    if (!def) return false;              // id inconnu
    if (unlocked[id]) return false;      // déjà obtenu
    unlocked[id] = Date.now();
    save(unlocked);
    showToast(def);
    return true;
  }

  function reset() { unlocked = {}; save(unlocked); }

  window.achievements = {
    unlock,
    reset,
    has: (id) => !!unlocked[id],
    all: () => Object.keys(DEFS),
    unlockedCount: () => Object.keys(unlocked).length,
    total: () => Object.keys(DEFS).length,
    defs: DEFS,
  };
})();

/* ================================================================
   achievements.js — Succès débloquables pour les mini-jeux
   Persistance via localStorage, notification toast à l'unlock.
   ================================================================ */
(function () {
  'use strict';

  // Définition des succès (id → icône + titre + description)
  // Icônes des succès d'exploration (même trait que les icônes des jeux)
  const I = (d) => '<svg class="g-ico" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const L = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const ICONS = {
    reader:   I('<path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" ' + L + '/><path class="s1" d="M15 9h3M15 12h3" fill="none" stroke-width="1.8" stroke-linecap="round"/>'),
    terminal: I('<rect x="3" y="5" width="18" height="14" rx="2" ' + L + '/><path class="s1" d="M7 10l3 2-3 2M12 15h5" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
    lang:     I('<circle cx="12" cy="12" r="8.5" ' + L + '/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17" ' + L + '/><circle class="a1" cx="18" cy="6" r="2.2"/>'),
    lost:     I('<path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z" ' + L + '/><path class="s1" d="M10.3 9.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M12 14.3v.1" fill="none" stroke-width="1.8" stroke-linecap="round"/>'),
    study:    I('<rect x="4" y="3" width="16" height="18" rx="2" ' + L + '/><path d="M8 8h8M8 12h8M8 16h5" ' + L + '/><circle class="a1" cx="17.5" cy="17.5" r="2.4"/>'),
    spin:     I('<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5" ' + L + '/><rect class="a1" x="9.5" y="8.5" width="5" height="7" rx="1"/>'),
    stats:    I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" ' + L + '/><rect class="a1" x="14.6" y="9" width="2.8" height="3" rx=".5"/>'),
    arcade:   I('<rect x="3" y="8" width="18" height="10" rx="3" ' + L + '/><path d="M7 11v4M5 13h4" ' + L + '/><circle class="a1" cx="15.5" cy="12" r="1.3"/><circle class="a2" cx="18" cy="14.5" r="1.3"/>'),
  };

  // Définition des succès : jeu (icône reprise de son bouton) ou icône propre, textes FR et EN
  const DEFS = {
    champion:     { game: 'connect4', title: 'Champion', desc: 'Battre l’IA au Puissance 4', en: ['Champion', 'Beat the Connect Four AI'] },
    snake_50:     { game: 'snake', title: 'Charmeur', desc: 'Atteindre 50 pts à Snake', en: ['Charmer', 'Reach 50 points in Snake'] },
    quiz_master:  { game: 'quiz', title: 'Quiz Master', desc: 'Sans-faute au Quiz Tech', en: ['Quiz Master', 'Perfect score on the tech quiz'] },
    memory_king:  { game: 'memory', title: 'Roi du Memory', desc: 'Memory en 20 coups max', en: ['Memory King', 'Finish Memory in 20 moves or fewer'] },
    tictac_master:{ game: 'tictactoe', title: 'Stratège', desc: 'Battre l’IA au Morpion', en: ['Strategist', 'Beat the tic-tac-toe AI'] },
    pong_win:     { game: 'pong', title: 'Smash', desc: 'Gagner un match de Pong', en: ['Smash', 'Win a game of Pong'] },
    flappy_20:    { game: 'flappy', title: 'Envolée', desc: 'Passer 20 portes à Envol', en: ['Lift-off', 'Clear 20 gates in Glide'] },
    reflex_pro:   { game: 'reflex', title: 'Éclair', desc: 'Réagir en moins de 250 ms', en: ['Lightning', 'React in under 250 ms'] },
    mine_sweeper: { game: 'minesweeper', title: 'Démineur', desc: 'Résoudre le Démineur', en: ['Sweeper', 'Clear the minefield'] },
    tetris_10:    { game: 'tetris', title: 'Tetromino', desc: 'Effacer 10 lignes à Blocs', en: ['Tetromino', 'Clear 10 lines in Blocks'] },
    whack_25:     { game: 'whack', title: 'Marteau', desc: '25 taupes en 30 s', en: ['Hammer', '25 moles in 30 seconds'] },
    taquin_win:   { game: 'taquin', title: 'Taquin résolu', desc: 'Remettre le taquin en ordre', en: ['Solved', 'Put the 15 puzzle back in order'] },
    rps_streak:   { game: 'rps', title: 'Série gagnante', desc: '5 victoires d’affilée', en: ['Winning streak', '5 wins in a row'] },
    invaders_wave3: { game: 'invaders', title: 'Défenseur', desc: 'Atteindre la vague 3 à Invasion', en: ['Defender', 'Reach wave 3 in Invasion'] },
    bubbles_clear: { game: 'bubbles', title: 'Plateau net', desc: 'Vider un plateau aux Bulles', en: ['Clean sweep', 'Clear a board in Bubbles'] },
    gems_5000:    { game: 'gems', title: 'Mineur', desc: 'Atteindre 5000 points aux Minerais', en: ['Miner', 'Reach 5000 points in Ores'] },
    crossy_50:    { game: 'crossy', title: 'Voyageur', desc: 'Franchir 50 rangées à la Traversée', en: ['Traveller', 'Cross 50 rows in Crossing'] },
    fruits_melon: { game: 'fruits', title: 'Melon !', desc: 'Faire pousser un melon aux Fruits', en: ['Melon!', 'Grow a melon in Fruits'] },
    runner_1000:  { game: 'runner', title: 'Marathon', desc: 'Atteindre 1000 points à la Course', en: ['Marathon', 'Reach 1000 points in Run'] },
    asteroids_wave3: { game: 'asteroids', title: 'Pilote', desc: 'Atteindre la vague 3 aux Astéroïdes', en: ['Pilot', 'Reach wave 3 in Asteroids'] },
    stack_20:     { game: 'stack', title: 'Bâtisseur', desc: 'Empiler 20 blocs à la Pile', en: ['Builder', 'Stack 20 blocks'] },
    // exploration du site
    reader:       { icon: 'reader', title: 'Lecteur assidu', desc: 'Ouvrir 5 projets des archives', en: ['Bookworm', 'Open 5 projects in the archive'] },
    case_study:   { icon: 'study', title: 'Sous le capot', desc: 'Lire une étude de cas', en: ['Under the hood', 'Read a case study'] },
    stats_all:    { icon: 'stats', title: 'Curieux', desc: 'Parcourir les 5 onglets de statistiques', en: ['Curious', 'Browse all 5 stats tabs'] },
    polyglot:     { icon: 'lang', title: 'Polyglotte', desc: 'Changer la langue du site', en: ['Polyglot', 'Switch the site language'] },
    hacker:       { icon: 'terminal', title: 'Hacker', desc: 'Trouver le terminal caché', en: ['Hacker', 'Find the hidden terminal'] },
    spin:         { icon: 'spin', title: 'Tournis', desc: 'Faire faire un tour complet à l’avatar', en: ['Dizzy', 'Spin the avatar all the way round'] },
    arcade_5:     { icon: 'arcade', title: 'Touche-à-tout', desc: 'Lancer 5 jeux différents', en: ['Jack of all games', 'Launch 5 different games'] },
    lost:         { icon: 'lost', title: 'Perdu ?', desc: 'Tomber sur la page 404', en: ['Lost?', 'Land on the 404 page'] },
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
  const en = () => document.documentElement.lang === 'en';

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
        '<span class="ach-toast-label">' + (en() ? 'Achievement unlocked' : 'Succès débloqué') + '</span>' +
        '<span class="ach-toast-title"></span>' +
        '<span class="ach-toast-desc"></span>' +
      '</span>';
    // icône du jeu, reprise de son bouton dans le labo
    const ico = def.game && document.querySelector('[data-game="' + def.game + '"] svg');
    if (ico) el.querySelector('.ach-toast-icon').appendChild(ico.cloneNode(true));
    else if (def.icon) el.querySelector('.ach-toast-icon').innerHTML = ICONS[def.icon];
    // textContent pour éviter toute injection
    el.querySelector('.ach-toast-title').textContent = en() ? def.en[0] : def.title;
    el.querySelector('.ach-toast-desc').textContent = en() ? def.en[1] : def.desc;
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
    try { document.dispatchEvent(new CustomEvent('achievement', { detail: { id } })); } catch (e) { /* ancien navigateur */ }
    return true;
  }

  function reset() { unlocked = {}; save(unlocked); }

  window.achievements = {
    unlock,
    reset,
    has: (id) => !!unlocked[id],
    all: () => Object.keys(DEFS),
    unlockedCount: () => Object.keys(unlocked).filter((k) => DEFS[k]).length,
    total: () => Object.keys(DEFS).length,
    defs: DEFS,
  };
})();

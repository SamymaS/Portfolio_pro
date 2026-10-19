/* ==================================================================
   games/core.js · Moteur commun des mini-jeux
   Chargé au premier clic sur un jeu. Chaque jeu vit dans
   games/<id>.js et s'enregistre avec SBG.register(id, { create }).

   Ce que le moteur fournit à chaque jeu (objet `api`) :
     api.stage                 élément conteneur du jeu
     api.canvas(w, h)          canvas net sur écran Retina, taille logique w×h
     api.loop({update, render}) boucle à pas fixe (1/120 s), pause automatique
     api.onKey(fn)             clavier (retiré à la fermeture)
     api.on(el, type, fn, o)   écouteur retiré à la fermeture
     api.swipe(el, fn)         glisser au doigt : fn('up'|'down'|'left'|'right')
     api.after(ms, fn)         minuterie annulée à la fermeture
     api.hud({score, best})    pastilles de l'en-tête
     api.best / api.setBest(n) record (localStorage)
     api.status(texte)         ligne d'état sous le jeu
     api.overlay({...})        panneau de début / fin, api.hideOverlay()
     api.sfx(nom), api.tone()  sons synthétisés (coupables)
     api.particles()           petit système de particules pour canvas
     api.shake(force)          secousse de la scène
     api.unlock(id)            succès
     api.t(fr, en), api.lang   langue
     api.C                     palette, api.font
     api.reduced               mouvement réduit demandé
   ================================================================== */
(function () {
  'use strict';
  if (window.SBG) return;

  const root = document.documentElement;
  const $ = (s, c) => (c || document).querySelector(s);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* indisponible */ } },
  };

  /* ── Palette commune ─────────────────────────────────────────── */
  const C = {
    bg: '#070912', bg2: '#0C0F1C', panel: '#111527', line: 'rgba(255,255,255,0.08)',
    grid: 'rgba(255,255,255,0.045)', ink: '#EEF1F7', muted: '#9AA1B4', faint: '#5D6477',
    cyan: '#38E6FF', violet: '#B07CFF', blue: '#6E8BFF',
    good: '#5FE3A1', bad: '#FF7A6B', warm: '#FFC56B',
  };
  const FONT = "'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif";

  /* ── Catalogue : titres, consignes ───────────────────────────── */
  const GAMES = {
    connect4:    { fr: 'Puissance 4', en: 'Connect Four', hfr: 'Cliquez une colonne ou ← → puis Entrée. L\'IA réfléchit en minimax alpha-bêta.', hen: 'Click a column, or ← → then Enter. The AI plays minimax with alpha-beta.' },
    tictactoe:   { fr: 'Morpion', en: 'Tic-tac-toe', hfr: 'Cliquez une case, ou flèches puis Entrée. L\'IA est solide, mais pas infaillible.', hen: 'Click a square, or arrows then Enter. The AI is strong, but not flawless.' },
    tetris:      { fr: 'Blocs', en: 'Blocks', hfr: '← → déplacer, ↑ tourner, ↓ accélérer, Espace pour poser. Au doigt : glisser et toucher.', hen: '← → move, ↑ rotate, ↓ soft drop, Space hard drop. Touch: swipe and tap.' },
    snake:       { fr: 'Snake', en: 'Snake', hfr: 'Flèches ou ZQSD. Au doigt : glisser.', hen: 'Arrow keys or WASD. Touch: swipe.' },
    '2048':      { fr: '2048', en: '2048', hfr: 'Flèches ou glisser pour pousser les tuiles.', hen: 'Arrow keys or swipe to slide the tiles.' },
    minesweeper: { fr: 'Démineur', en: 'Minesweeper', hfr: 'Clic pour révéler, clic droit ou appui long pour poser un drapeau.', hen: 'Click to reveal, right-click or long-press to flag.' },
    breakout:    { fr: 'Casse-briques', en: 'Breakout', hfr: 'Souris, doigt ou ← →. Espace pour lancer.', hen: 'Mouse, finger or ← →. Space to launch.' },
    pong:        { fr: 'Pong', en: 'Pong', hfr: 'Souris, doigt ou ↑ ↓. Premier à 5.', hen: 'Mouse, finger or ↑ ↓. First to 5.' },
    flappy:      { fr: 'Envol', en: 'Glide', hfr: 'Espace, clic ou toucher pour remonter.', hen: 'Space, click or tap to climb.' },
    memory:      { fr: 'Memory', en: 'Memory', hfr: 'Retournez deux cartes, trouvez les paires.', hen: 'Flip two cards, find the pairs.' },
    simon:       { fr: 'Séquence', en: 'Sequence', hfr: 'Regardez la séquence, puis rejouez-la. Touches 1 à 4 possibles.', hen: 'Watch the sequence, then repeat it. Keys 1 to 4 work too.' },
    taquin:      { fr: 'Taquin', en: '15 puzzle', hfr: 'Cliquez une tuile voisine de la case vide, ou flèches.', hen: 'Click a tile next to the gap, or use arrow keys.' },
    whack:       { fr: 'Tape-taupe', en: 'Whack-a-mole', hfr: 'Touchez les signaux avant qu\'ils s\'éteignent. 30 secondes.', hen: 'Hit the signals before they fade. 30 seconds.' },
    rps:         { fr: 'Pierre-feuille-ciseaux', en: 'Rock paper scissors', hfr: 'Choisissez, ou touches 1, 2, 3. L\'ordinateur apprend vos habitudes.', hen: 'Pick, or keys 1, 2, 3. The computer learns your habits.' },
    reflex:      { fr: 'Réflexes', en: 'Reaction time', hfr: 'Attendez le signal, puis cliquez ou appuyez sur Espace.', hen: 'Wait for the signal, then click or press Space.' },
    quiz:        { fr: 'Quiz tech', en: 'Tech quiz', hfr: 'Dix questions, quinze secondes chacune. Touches 1 à 4 possibles.', hen: 'Ten questions, fifteen seconds each. Keys 1 to 4 work too.' },
  };

  /* ── Sons : petit synthétiseur WebAudio ──────────────────────── */
  let actx = null, master = null;
  let muted = store.get('sbg-muted') === '1';
  function audio() {
    if (muted) return null;
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0.16;
      master.connect(actx.destination);
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, type, vol, slide) {
    const a = audio(); if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.6, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol) {
    const a = audio(); if (!a) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1800;
    g.gain.value = vol || 0.25;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  const SFX = {
    tick:  () => tone(880, 0.04, 'square', 0.18),
    move:  () => tone(520, 0.05, 'triangle', 0.3),
    drop:  () => tone(220, 0.12, 'sine', 0.7, 0.55),
    pop:   () => tone(660, 0.09, 'sine', 0.5, 1.6),
    flip:  () => tone(420, 0.06, 'triangle', 0.35, 1.3),
    hit:   () => tone(300, 0.07, 'square', 0.25, 0.8),
    score: () => { tone(660, 0.08, 'triangle', 0.4); setTimeout(() => tone(990, 0.12, 'triangle', 0.4), 70); },
    win:   () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.45), i * 90)); },
    lose:  () => { tone(330, 0.18, 'sawtooth', 0.22, 0.6); setTimeout(() => tone(220, 0.28, 'sawtooth', 0.2, 0.6), 140); },
    error: () => tone(160, 0.12, 'square', 0.22),
    boom:  () => noise(0.35, 0.35),
  };

  /* ── Fenêtre de jeu ──────────────────────────────────────────── */
  const modal = $('#gameModal');
  const el = {
    icon: $('#gameIcon'), title: $('#gameTitle'), score: $('#gameScore'), best: $('#gameBest'),
    restart: $('#gameRestart'), mute: $('#gameMute'), close: $('#gameClose'),
    body: $('#gameContainer'), help: $('#gameHelp'), status: $('#gameStatus'),
  };
  const lang = () => (root.lang === 'en' ? 'en' : 'fr');
  const t = (fr, en) => (lang() === 'en' ? en : fr);

  function syncMute() {
    el.mute.setAttribute('aria-pressed', String(muted));
    el.mute.setAttribute('aria-label', muted ? t('Activer le son', 'Unmute') : t('Couper le son', 'Mute'));
    el.mute.classList.toggle('off', muted);
  }
  el.mute.addEventListener('click', () => {
    muted = !muted; store.set('sbg-muted', muted ? '1' : '0'); syncMute();
    if (!muted) SFX.tick();
  });

  const registry = {};
  const loading = {};
  let current = null;   // { id, api, inst, cleanups }

  function loadGame(id) {
    if (registry[id]) return Promise.resolve(registry[id]);
    if (!loading[id]) {
      loading[id] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'games/' + id + '.js?v=' + (window.SBG_VERSION || '1');
        s.onload = () => (registry[id] ? resolve(registry[id]) : reject(new Error('not registered: ' + id)));
        s.onerror = () => { delete loading[id]; reject(new Error('load failed: ' + id)); };
        document.head.appendChild(s);
      });
    }
    return loading[id];
  }

  function makeApi(id) {
    const cleanups = [];
    const loops = [];
    let restartFn = null;
    const meta = GAMES[id] || { fr: id, en: id };
    const bestKey = 'sbg-best-' + id;

    const api = {
      id, C, font: FONT, reduced, t, get lang() { return lang(); },
      stage: el.body,

      canvas(w, h, opts) {
        const c = document.createElement('canvas');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
        c.className = 'g-canvas' + (opts && opts.className ? ' ' + opts.className : '');
        c.style.aspectRatio = w + ' / ' + h;
        c.style.maxWidth = (opts && opts.maxWidth ? opts.maxWidth : w) + 'px';
        const ctx = c.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        el.body.appendChild(c);
        return {
          el: c, ctx, w, h, dpr,
          // coordonnées écran → coordonnées logiques du jeu
          // tient compte du letterboxing (object-fit: contain quand la hauteur limite)
          toLocal(clientX, clientY) {
            const r = c.getBoundingClientRect();
            const s = Math.min(r.width / w, r.height / h);
            const ox = (r.width - w * s) / 2, oy = (r.height - h * s) / 2;
            return { x: (clientX - r.left - ox) / s, y: (clientY - r.top - oy) / s };
          },
          clear(color) { ctx.fillStyle = color || C.bg; ctx.fillRect(0, 0, w, h); },
        };
      },

      // Boucle à pas fixe : update(dt) 120 fois par seconde, render() à chaque image
      loop(handlers) {
        const STEP = 1 / 120;
        let acc = 0, last = 0, raf = 0, running = false, hidden = false;
        function frame(now) {
          raf = requestAnimationFrame(frame);
          let dt = (now - last) / 1000; last = now;
          if (dt > 0.25) dt = 0.25;           // onglet revenu : pas de saut géant
          acc += dt;
          let n = 0;
          while (acc >= STEP && n < 30) { handlers.update && handlers.update(STEP); acc -= STEP; n++; }
          handlers.render && handlers.render(acc / STEP);
        }
        const L = {
          start() { if (running) return; running = true; if (hidden) return; last = performance.now(); acc = 0; raf = requestAnimationFrame(frame); },
          stop() { running = false; cancelAnimationFrame(raf); },
          get running() { return running; },
          _hide(h) { hidden = h; if (h) cancelAnimationFrame(raf); else if (running) { last = performance.now(); raf = requestAnimationFrame(frame); } },
        };
        loops.push(L);
        return L;
      },

      on(target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        cleanups.push(() => target.removeEventListener(type, fn, opts));
      },
      onKey(fn) {
        const h = (e) => {
          if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
          // Entrée ou Espace sur un bouton de panneau : le bouton s'en charge, le jeu ne doit pas le recevoir aussi
          const ae = document.activeElement;
          if ((e.key === 'Enter' || e.key === ' ') && ae && ae.closest && ae.closest('.g-overlay, .g-btn:not(:disabled), #gameRestart, #gameMute, #gameClose')) return;
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
          fn(e);
        };
        api.on(document, 'keydown', h);
      },
      swipe(target, fn) {
        let sx = 0, sy = 0, st = 0, active = false;
        api.on(target, 'touchstart', (e) => { const p = e.changedTouches[0]; sx = p.clientX; sy = p.clientY; st = performance.now(); active = true; }, { passive: true });
        api.on(target, 'touchmove', (e) => { if (active) e.preventDefault(); }, { passive: false });
        api.on(target, 'touchend', (e) => {
          if (!active) return; active = false;
          const p = e.changedTouches[0], dx = p.clientX - sx, dy = p.clientY - sy;
          const ad = Math.max(Math.abs(dx), Math.abs(dy));
          if (ad < 22) { fn('tap', e); return; }
          if (performance.now() - st > 700) return;
          fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), e);
        });
      },
      after(ms, fn) {
        const id2 = setTimeout(fn, ms);
        cleanups.push(() => clearTimeout(id2));
        return id2;
      },
      every(ms, fn) {
        const id2 = setInterval(fn, ms);
        cleanups.push(() => clearInterval(id2));
        return id2;
      },

      hud(o) {
        if (o.score !== undefined) { el.score.textContent = o.score; bump(el.score); }
        if (o.best !== undefined) el.best.textContent = o.best || '–';
        if (o.scoreLabel) el.score.previousElementSibling.textContent = o.scoreLabel;
      },
      get best() { const v = store.get(bestKey); return v === null ? null : +v; },
      // lowerIsBetter : pour les temps (réflexes, taquin, démineur)
      setBest(v, lowerIsBetter) {
        const b = api.best;
        const better = b === null || (lowerIsBetter ? v < b : v > b);
        if (better) { store.set(bestKey, String(v)); el.best.textContent = v; bump(el.best); }
        return better;
      },
      status(text) { el.status.textContent = text || ''; },

      overlay(o) {
        api.hideOverlay();
        const ov = document.createElement('div');
        ov.className = 'g-overlay' + (o.tone ? ' ' + o.tone : '');
        const box = document.createElement('div');
        box.className = 'g-overlay-box';
        if (o.kicker) { const k = document.createElement('p'); k.className = 'g-kicker'; k.textContent = o.kicker; box.appendChild(k); }
        const h = document.createElement('p'); h.className = 'g-ov-title'; h.textContent = o.title || ''; box.appendChild(h);
        if (o.text) { const p = document.createElement('p'); p.className = 'g-ov-text'; p.textContent = o.text; box.appendChild(p); }
        if (o.action) {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'g-btn'; b.textContent = o.action;
          b.addEventListener('click', () => { api.hideOverlay(); o.onAction && o.onAction(); });
          box.appendChild(b);
          setTimeout(() => b.focus({ preventScroll: true }), 30);
        }
        ov.appendChild(box);
        (o.target || el.body).appendChild(ov);
        requestAnimationFrame(() => ov.classList.add('on'));
        return ov;
      },
      hideOverlay() { el.body.querySelectorAll('.g-overlay').forEach((n) => n.remove()); },

      sfx(name) { const f = SFX[name]; if (f) f(); },
      tone,
      shake(force) {
        if (reduced) return;
        const f = force || 6;
        el.body.animate([
          { transform: 'translate(0,0)' }, { transform: `translate(${-f}px,${f * 0.4}px)` },
          { transform: `translate(${f * 0.8}px,${-f * 0.5}px)` }, { transform: `translate(${-f * 0.4}px,${f * 0.3}px)` },
          { transform: 'translate(0,0)' },
        ], { duration: 260, easing: 'ease-out' });
      },
      particles() {
        const ps = [];
        return {
          burst(x, y, o) {
            const n = (o && o.n) || 14, sp = (o && o.speed) || 160, col = (o && o.color) || C.cyan, life = (o && o.life) || 0.6, size = (o && o.size) || 2.6;
            for (let i = 0; i < n; i++) {
              const a = Math.random() * Math.PI * 2, v = sp * (0.35 + Math.random() * 0.65);
              ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, col: Array.isArray(col) ? col[i % col.length] : col, s: size * (0.6 + Math.random() * 0.8), g: (o && o.gravity) || 0 });
            }
          },
          update(dt) {
            for (let i = ps.length - 1; i >= 0; i--) {
              const p = ps[i];
              p.life -= dt; if (p.life <= 0) { ps.splice(i, 1); continue; }
              p.vx *= 1 - 2.2 * dt; p.vy = p.vy * (1 - 2.2 * dt) + p.g * dt;
              p.x += p.vx * dt; p.y += p.vy * dt;
            }
          },
          draw(ctx) {
            for (const p of ps) {
              ctx.globalAlpha = Math.max(0, p.life / p.max);
              ctx.fillStyle = p.col;
              ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
          },
          get count() { return ps.length; },
          clear() { ps.length = 0; },
        };
      },
      unlock(achId) { if (window.achievements) window.achievements.unlock(achId); },
      onRestart(fn) { restartFn = fn; },

      // utilitaires de dessin
      roundRect(ctx, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
      },
      ease: {
        out: (k) => 1 - Math.pow(1 - k, 3),
        inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
        back: (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
        bounce: (k) => { const n = 7.5625, d = 2.75; if (k < 1 / d) return n * k * k; if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75; if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375; return n * (k -= 2.625 / d) * k + 0.984375; },
      },
      lerp: (a, b, k) => a + (b - a) * k,
      clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    };

    return {
      api, meta,
      cleanup() {
        loops.forEach((L) => L.stop());
        cleanups.splice(0).forEach((f) => { try { f(); } catch (e) { /* rien */ } });
      },
      hide(h) { loops.forEach((L) => L._hide(h)); },
      restart() { if (restartFn) restartFn(); },
    };
  }

  function bump(node) {
    if (reduced || !node.animate) return;
    node.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
  }

  let trapRelease = null;
  function openGame(id) {
    if (current) closeGame(true);
    const meta = GAMES[id] || { fr: id, en: id, hfr: '', hen: '' };
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    el.title.textContent = t(meta.fr, meta.en);
    el.help.textContent = t(meta.hfr, meta.hen);
    el.status.textContent = '';
    el.score.textContent = '0';
    el.score.previousElementSibling.textContent = t('Score', 'Score');
    el.body.innerHTML = '<div class="g-loading" role="status">' + t('Chargement…', 'Loading…') + '</div>';
    const btnIcon = document.querySelector('[data-game="' + id + '"] svg');
    el.icon.innerHTML = btnIcon ? btnIcon.outerHTML : '';
    modal.dataset.game = id;
    syncMute();
    if (window.focusTrap) trapRelease = window.focusTrap(modal);

    loadGame(id).then((def) => {
      if (modal.dataset.game !== id || modal.classList.contains('hidden')) return;
      el.body.innerHTML = '';
      const ctl = makeApi(id);
      const b = ctl.api.best;
      el.best.textContent = b === null ? '–' : b;
      current = { id, ctl, inst: null };
      try { current.inst = def.create(ctl.api) || {}; }
      catch (err) { el.body.innerHTML = '<p class="g-error">' + t('Ce jeu n\'a pas pu démarrer.', 'This game could not start.') + '</p>'; console.error(err); }
    }).catch(() => {
      el.body.innerHTML = '<p class="g-error">' + t('Le jeu ne s\'est pas chargé. Vérifiez votre connexion puis réessayez.', 'The game did not load. Check your connection and try again.') + '</p>';
    });
  }

  function closeGame(switching) {
    if (current) {
      try { current.inst && current.inst.destroy && current.inst.destroy(); } catch (e) { /* rien */ }
      current.ctl.cleanup();
      current = null;
    }
    el.body.innerHTML = '';
    if (switching) return;
    modal.classList.add('hidden');
    delete modal.dataset.game;
    document.body.style.overflow = '';
    if (trapRelease) { trapRelease(); trapRelease = null; }
  }

  el.restart.addEventListener('click', () => {
    if (!current) return;
    current.ctl.api.hideOverlay();
    if (current.inst && current.inst.restart) current.inst.restart(); else current.ctl.restart();
  });
  el.close.addEventListener('click', () => closeGame());
  modal.addEventListener('click', (e) => { if (e.target === modal) closeGame(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeGame(); });
  document.addEventListener('visibilitychange', () => { if (current) current.ctl.hide(document.hidden); });

  document.querySelectorAll('[data-game]').forEach((b) => b.addEventListener('click', () => openGame(b.dataset.game)));

  window.SBG = {
    register(id, def) { registry[id] = def; },
    open: openGame, close: closeGame, games: GAMES, C, FONT,
  };
  window.openGame = openGame;
})();

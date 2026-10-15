/* ==================================================================
   site.js · Portfolio Samy Boudaoud
   Aucune dépendance. Les jeux (games.js) et EmailJS ne sont chargés
   qu'à la première utilisation.
   ================================================================== */
(function () {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } },
  };

  /* ── Textes dynamiques ──────────────────────────────────────── */
  const T = {
    fr: {
      title: 'Samy Boudaoud, ingénieur logiciel',
      copied: 'Adresse copiée', copy: "Copier l'adresse",
      sending: 'Envoi…', sent: 'Message envoyé. Je vous réponds rapidement.',
      errName: 'Indiquez votre nom.', errEmail: 'Cette adresse e-mail semble incomplète.',
      errMsg: 'Écrivez votre message.', errSend: "L'envoi a échoué. Réessayez, ou écrivez directement à samyboudaoud95@gmail.com.",
      ach: (n, t) => n + '/' + t + ' succès débloqués.',
      gamesErr: 'Les jeux ne se sont pas chargés. Vérifiez votre connexion puis réessayez.',
    },
    en: {
      title: 'Samy Boudaoud, software engineer',
      copied: 'Address copied', copy: 'Copy address',
      sending: 'Sending…', sent: 'Message sent. I will get back to you soon.',
      errName: 'Please enter your name.', errEmail: 'This email address looks incomplete.',
      errMsg: 'Please write your message.', errSend: 'Sending failed. Try again, or email samyboudaoud95@gmail.com directly.',
      ach: (n, t) => n + '/' + t + ' achievements unlocked.',
      gamesErr: 'The games did not load. Check your connection and try again.',
    },
  };
  const t = (k) => T[root.lang === 'en' ? 'en' : 'fr'][k];

  /* ── Langue ─────────────────────────────────────────────────── */
  function applyLang() {
    const l = root.lang === 'en' ? 'en' : 'fr';
    document.title = t('title');
    $$('[data-aria-fr]').forEach((el) => el.setAttribute('aria-label', el.dataset['aria' + (l === 'en' ? 'En' : 'Fr')]));
    const copy = $('#copyMail');
    if (copy) copy.dataset.state = '';
    updateAchievements();
  }
  $('#langBtn').addEventListener('click', () => {
    root.lang = root.lang === 'en' ? 'fr' : 'en';
    store.set('sb-lang', root.lang);
    applyLang();
  });

  /* ── Thème ──────────────────────────────────────────────────── */
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => {
    const forced = root.getAttribute('data-theme');
    return forced ? forced === 'dark' : darkQuery.matches;
  };
  function syncThemeMeta() {
    const c = isDark() ? '#12171D' : '#E9EDF1';
    $$('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', c));
  }
  $('#themeBtn').addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    store.set('sb-theme', next);
    syncThemeMeta();
    scope.refreshColors();
  });
  darkQuery.addEventListener('change', () => { syncThemeMeta(); scope.refreshColors(); });

  /* ── En-tête et menu mobile ─────────────────────────────────── */
  const top = $('#top');
  const onScroll = () => top.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const nav = $('#nav');
  const menuBtn = $('#menuBtn');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  }
  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // Lien de navigation actif selon la section visible
  const navLinks = $$('.nav a');
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + en.target.id)));
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  $$('main section[id]').forEach((s) => spy.observe(s));

  /* ── Oscilloscope : trame TDMA à quatre intervalles ─────────── */
  const scope = (function () {
    const canvas = $('#scopeCanvas');
    const ctx = canvas.getContext('2d');
    const SLOTS = 4;
    const FREQ = [9, 14, 6.5, 11];     // cycles de porteuse par intervalle
    const GUARD = 0.09;                // période de garde de chaque côté
    let W = 0, H = 0, dpr = 1;
    let colors = {};
    let active = -1;                   // intervalle filtré (-1 = tous)
    let hover = -1;                    // intervalle survolé
    let phase = 0;
    let sweep = 0;                     // 0 → 1 pendant l'animation d'ouverture
    let running = false, visible = true, last = 0, raf = 0;

    function refreshColors() {
      const cs = getComputedStyle(root);
      colors = {
        grid: cs.getPropertyValue('--grid').trim(),
        rule: cs.getPropertyValue('--rule').trim(),
        trace: cs.getPropertyValue('--trace').trim(),
        muted: cs.getPropertyValue('--muted').trim(),
      };
      draw();
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.round(r.width); H = Math.round(r.height);
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    const smooth = (e0, e1, x) => { const k = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return k * k * (3 - 2 * k); };

    // Enveloppe d'une salve dans son intervalle (u entre 0 et 1)
    function envelope(u) {
      return smooth(GUARD, GUARD + 0.06, u) * (1 - smooth(1 - GUARD - 0.06, 1 - GUARD, u));
    }

    function y(x, slot, u) {
      const mid = H * 0.4, amp = H * 0.25;
      const env = envelope(u);
      // modulation de données : petites variations d'amplitude pseudo-aléatoires
      const data = 0.78 + 0.22 * Math.sin(u * 47 + slot * 3.1 + phase * 0.6) * Math.sin(u * 13 + slot);
      const carrier = Math.sin(2 * Math.PI * FREQ[slot] * u + phase * (1.2 + slot * 0.15));
      const noise = (Math.sin(x * 0.9 + phase * 3) + Math.sin(x * 0.37 - phase * 2)) * H * 0.004;
      return mid - env * amp * data * carrier + noise;
    }

    function draw() {
      if (!W) return;
      ctx.clearRect(0, 0, W, H);
      const sw = W / SLOTS;

      // graticule
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      const cols = 16, rows = 6;
      for (let i = 1; i < cols; i++) { const gx = Math.round((W / cols) * i) + 0.5; ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
      for (let j = 1; j < rows; j++) { const gy = Math.round((H / rows) * j) + 0.5; ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
      ctx.stroke();

      // séparations des intervalles
      ctx.strokeStyle = colors.rule;
      ctx.beginPath();
      for (let s = 1; s < SLOTS; s++) { const sx = Math.round(sw * s) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, H); }
      ctx.stroke();

      // trace, intervalle par intervalle
      const limit = W * sweep;
      for (let s = 0; s < SLOTS; s++) {
        const x0 = sw * s, x1 = Math.min(sw * (s + 1), limit);
        if (x1 <= x0) break;
        const focus = active === -1 ? (hover === -1 || hover === s) : (active === s || hover === s);
        ctx.strokeStyle = focus ? colors.trace : colors.muted;
        ctx.globalAlpha = focus ? 1 : 0.35;
        ctx.lineWidth = focus ? 2 : 1.25;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let x = x0; x <= x1; x += 1) {
          const yy = y(x, s, (x - x0) / sw);
          if (x === x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // point du faisceau pendant le balayage
      if (sweep < 1 && limit > 0) {
        const s = Math.min(Math.floor(limit / sw), SLOTS - 1);
        const by = y(limit, s, (limit - sw * s) / sw);
        ctx.fillStyle = colors.trace;
        ctx.beginPath(); ctx.arc(limit, by, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    function frame(now) {
      raf = 0;
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      if (sweep < 1) {
        sweep = Math.min(1, sweep + dt / 1.4);
        last = now; draw();
      } else if (now - last >= 33) {           // ralenti à 30 images/s une fois posé
        phase += dt * 0.9;
        last = now; draw();
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || reduceMotion.matches || !visible || document.hidden) return;
      running = true; last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

    function init() {
      refreshColors();
      if (reduceMotion.matches) sweep = 1;
      resize();
      new ResizeObserver(resize).observe(canvas);
      new IntersectionObserver((e) => { visible = e[0].isIntersecting; visible ? start() : stop(); }).observe(canvas);
      document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
      reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) { stop(); sweep = 1; draw(); } else start(); });
      // Laisse le temps à la police d'arriver avant de lancer le balayage
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
    }

    return {
      init, refreshColors,
      setActive(i) { active = i; draw(); },
      setHover(i) { hover = i; draw(); },
    };
  })();
  scope.init();

  /* ── Filtrage des projets ───────────────────────────────────── */
  const SLOT_OF = { critical: 0, mobile: 1, iot: 2, web: 3 };
  const items = $$('.feat, .row');
  const chips = $$('.chip');
  const slots = $$('.slot');
  const empty = $('.index-empty');

  chips.forEach((c) => {
    const f = c.dataset.filter;
    const n = f === 'all' ? $$('.row').length + $$('.feat').length : items.filter((it) => it.dataset.dom.split(' ').includes(f)).length;
    $('.count', c).textContent = n;
  });

  function setFilter(f) {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === f)));
    slots.forEach((s) => {
      const on = s.dataset.filter === f;
      s.classList.toggle('on', on);
      s.setAttribute('aria-pressed', String(on));
    });
    items.forEach((it) => { it.hidden = f !== 'all' && !it.dataset.dom.split(' ').includes(f); });
    empty.hidden = $$('.row').some((r) => !r.hidden);
    scope.setActive(f === 'all' ? -1 : SLOT_OF[f]);
  }
  chips.forEach((c) => c.addEventListener('click', () => setFilter(c.dataset.filter)));
  slots.forEach((s, i) => {
    s.setAttribute('aria-pressed', 'false');
    s.addEventListener('click', () => {
      const already = s.classList.contains('on');
      setFilter(already ? 'all' : s.dataset.filter);
      if (!already) $('#projets').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    });
    s.addEventListener('pointerenter', () => scope.setHover(i));
    s.addEventListener('pointerleave', () => scope.setHover(-1));
    s.addEventListener('focus', () => scope.setHover(i));
    s.addEventListener('blur', () => scope.setHover(-1));
  });

  /* ── Piège de focus (utilisé par games.js) ──────────────────── */
  window.focusTrap = function (container) {
    const prev = document.activeElement;
    const sel = 'a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])';
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const f = $$(sel, container).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    };
    container.addEventListener('keydown', onKey);
    const close = $('#gameClose', container) || $(sel, container);
    if (close) close.focus();
    return () => { container.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); };
  };

  /* ── Jeux : chargés au premier clic ─────────────────────────── */
  let gamesPromise = null;
  function loadGames() {
    if (window.openGame) return Promise.resolve();
    if (!gamesPromise) {
      gamesPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'games.js';
        s.onload = resolve;
        s.onerror = () => { gamesPromise = null; reject(); };
        document.body.appendChild(s);
      });
    }
    return gamesPromise;
  }
  const gamesEl = $('#games');
  gamesEl.addEventListener('pointerenter', () => { loadGames().catch(() => {}); }, { once: true });
  gamesEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-game]');
    if (!b || window.openGame) return;      // une fois chargé, games.js gère ses boutons
    loadGames().then(() => window.openGame(b.dataset.game)).catch(() => {
      $('.lab-foot').textContent = t('gamesErr');
    });
  });

  /* ── Succès ─────────────────────────────────────────────────── */
  const GAME_ACH = {
    connect4: 'champion', snake: 'snake_50', quiz: 'quiz_master', memory: 'memory_king',
    tictactoe: 'tictac_master', pong: 'pong_win', flappy: 'flappy_20', reflex: 'reflex_pro',
    minesweeper: 'mine_sweeper', tetris: 'tetris_10', whack: 'whack_25', taquin: 'taquin_win', rps: 'rps_streak',
  };
  function updateAchievements() {
    const a = window.achievements;
    const out = $('#achCount');
    if (!a || !out) return;
    const n = a.unlockedCount();
    out.textContent = n ? t('ach')(n, a.total()) : '';
    $$('[data-game]').forEach((b) => b.classList.toggle('won', !!(GAME_ACH[b.dataset.game] && a.has(GAME_ACH[b.dataset.game]))));
  }
  if (window.achievements) {
    const orig = window.achievements.unlock;
    window.achievements.unlock = function (id) { const r = orig(id); if (r) updateAchievements(); return r; };
  }

  /* ── Contact ────────────────────────────────────────────────── */
  const copyBtn = $('#copyMail');
  copyBtn.addEventListener('click', () => {
    const mail = copyBtn.dataset.mail;
    const done = () => {
      const label = $$('span', copyBtn);
      label.forEach((s) => { s.dataset.orig = s.dataset.orig || s.textContent; });
      label.forEach((s) => { s.textContent = T[s.dataset.l].copied; });
      setTimeout(() => label.forEach((s) => { s.textContent = s.dataset.orig; }), 2200);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(mail).then(done, () => { location.href = 'mailto:' + mail; });
    else location.href = 'mailto:' + mail;
  });

  const EMAILJS = { service: 'service_w9mc9od', template: 'template_jh6ptam', key: 'kvrIDeCmjxUFxlP6O' };
  let emailjsPromise = null;
  function loadEmailJS() {
    if (window.emailjs) return Promise.resolve(window.emailjs);
    if (!emailjsPromise) {
      emailjsPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
        s.onload = () => { try { window.emailjs.init({ publicKey: EMAILJS.key }); resolve(window.emailjs); } catch (e) { reject(e); } };
        s.onerror = () => { emailjsPromise = null; reject(new Error('load')); };
        document.head.appendChild(s);
      });
    }
    return emailjsPromise;
  }
  const form = $('#contactForm');
  const msg = $('#formMsg');
  form.addEventListener('focusin', () => { loadEmailJS().catch(() => {}); }, { once: true });

  function check() {
    const f = form.elements;
    const rules = [
      [f.name, f.name.value.trim().length > 0, 'errName'],
      [f.email, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim()), 'errEmail'],
      [f.message, f.message.value.trim().length > 2, 'errMsg'],
    ];
    let firstBad = null;
    rules.forEach(([el, ok, key]) => {
      el.setAttribute('aria-invalid', String(!ok));
      if (!ok && !firstBad) firstBad = [el, key];
    });
    return firstBad;
  }
  form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid') === 'true') check(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = check();
    if (bad) { msg.className = 'form-msg err'; msg.textContent = t(bad[1]); bad[0].focus(); return; }
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    msg.className = 'form-msg'; msg.textContent = t('sending');
    try {
      const ejs = await loadEmailJS();
      const f = form.elements;
      await ejs.send(EMAILJS.service, EMAILJS.template, {
        name: f.name.value.trim(), email: f.email.value.trim(), reply_to: f.email.value.trim(),
        message: f.message.value.trim(), to_name: 'Samy Boudaoud',
        time: new Date().toLocaleString(root.lang === 'en' ? 'en-GB' : 'fr-FR'),
      });
      msg.className = 'form-msg ok'; msg.textContent = t('sent');
      form.reset();
      $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
    } catch (err) {
      msg.className = 'form-msg err'; msg.textContent = t('errSend');
    } finally {
      btn.disabled = false;
    }
  });

  /* ── Terminal caché : taper « sb » ──────────────────────────── */
  (function terminal() {
    let el = null, out, input, buf = '';
    const say = (text, cls) => { const p = document.createElement('div'); if (cls) p.className = cls; p.textContent = text; out.appendChild(p); out.scrollTop = out.scrollHeight; };
    const en = () => root.lang === 'en';
    const cmds = {
      help: () => say(en()
        ? 'whoami  work  stack  contact  cv  github  linkedin  games  theme  lang  clear  exit'
        : 'whoami  projets  stack  contact  cv  github  linkedin  jeux  theme  lang  clear  exit', 'a'),
      whoami: () => say(en()
        ? 'Samy Boudaoud, software engineer at CS GROUP. Aix-en-Provence, France.'
        : 'Samy Boudaoud, ingénieur logiciel chez CS GROUP. Aix-en-Provence.'),
      stack: () => say('C++/Qt  .NET  Java/Kotlin  Dart/Flutter  Python  TypeScript\nPostgreSQL  Redis  Docker  Kubernetes  Terraform\nESP32  Modbus RTU  MQTT  BLE'),
      projets: () => { close(); $('#projets').scrollIntoView(); },
      contact: () => say('samyboudaoud95@gmail.com'),
      cv: () => { const a = document.createElement('a'); a.href = 'CV_Samy_Boudaoud.pdf'; a.download = ''; a.click(); },
      github: () => window.open('https://github.com/SamymaS', '_blank', 'noopener'),
      linkedin: () => window.open('https://www.linkedin.com/in/samy-boudaoud', '_blank', 'noopener'),
      jeux: () => { close(); $('#labo').scrollIntoView(); },
      theme: () => $('#themeBtn').click(),
      lang: () => $('#langBtn').click(),
      sudo: () => say(en() ? 'Nice try.' : 'Bien tenté.', 'e'),
      clear: () => { out.textContent = ''; },
      exit: () => close(),
    };
    cmds.work = cmds.projets; cmds.games = cmds.jeux; cmds.ls = cmds.help;

    function build() {
      el = document.createElement('div');
      el.className = 'term';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'Terminal');
      el.innerHTML = '<div class="term-hd"><span>samy@portfolio:~</span><button type="button" aria-label="Fermer">✕</button></div><div class="term-out" aria-live="polite"></div><label class="term-in"><span aria-hidden="true">$</span><input autocomplete="off" spellcheck="false" aria-label="Commande"></label>';
      document.body.appendChild(el);
      out = $('.term-out', el); input = $('input', el);
      $('button', el).addEventListener('click', close);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') return close();
        if (e.key !== 'Enter') return;
        const v = input.value.trim().toLowerCase(); input.value = '';
        if (!v) return;
        say('$ ' + v);
        (cmds[v] || (() => say((en() ? 'Unknown command: ' : 'Commande inconnue : ') + v + '. help', 'e')))();
      });
    }
    function open() {
      if (!el) build();
      el.hidden = false; out.textContent = '';
      say(en() ? "Hi. Type 'help'." : "Salut. Tapez 'help'.", 'a');
      input.focus();
    }
    function close() { if (el) el.hidden = true; }
    document.addEventListener('keydown', (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!$('#gameModal').classList.contains('hidden')) return;
      buf = (buf + e.key.toLowerCase()).slice(-2);
      if (buf === 'sb') { buf = ''; e.preventDefault(); open(); }
    });
  })();

  /* ── Démarrage ──────────────────────────────────────────────── */
  applyLang();
  syncThemeMeta();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
})();

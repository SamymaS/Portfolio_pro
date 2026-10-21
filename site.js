/* ==================================================================
   site.js · Portfolio Samy Boudaoud
   Défilement fluide (Lenis), animations (GSAP + ScrollTrigger),
   avatar 3D tiré du skin (avatar.js, chargé en module), barre d'XP,
   et tout le reste : langue,
   filtres, jeux chargés à la demande, formulaire, terminal caché.
   ================================================================== */
(function () {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine) and (hover: hover)').matches;
  const isNarrow = () => window.innerWidth < 860;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } },
  };
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const gsap = window.gsap;
  if (hasGsap) gsap.registerPlugin(window.ScrollTrigger);
  const ST = window.ScrollTrigger;

  /* ── Textes dynamiques ──────────────────────────────────────── */
  const T = {
    fr: {
      title: 'Samy Boudaoud, ingénieur logiciel', copied: 'Adresse copiée',
      sending: 'Envoi…', sent: 'Message envoyé. Je vous réponds rapidement.',
      errName: 'Indiquez votre nom.', errEmail: 'Cette adresse e-mail semble incomplète.',
      errMsg: 'Écrivez votre message.', errSend: "L'envoi a échoué. Réessayez, ou écrivez directement à samyboudaoud95@gmail.com.",
      ach: (n, t) => n + '/' + t + ' succès débloqués.',
      gamesErr: 'Les jeux ne se sont pas chargés. Vérifiez votre connexion puis réessayez.',
      scroll: 'Défiler',
    },
    en: {
      title: 'Samy Boudaoud, software engineer', copied: 'Address copied',
      sending: 'Sending…', sent: 'Message sent. I will get back to you soon.',
      errName: 'Please enter your name.', errEmail: 'This email address looks incomplete.',
      errMsg: 'Please write your message.', errSend: 'Sending failed. Try again, or email samyboudaoud95@gmail.com directly.',
      ach: (n, t) => n + '/' + t + ' achievements unlocked.',
      gamesErr: 'The games did not load. Check your connection and try again.',
      scroll: 'Scroll',
    },
  };
  const t = (k) => T[root.lang === 'en' ? 'en' : 'fr'][k];

  /* ── Langue ─────────────────────────────────────────────────── */
  function applyLang() {
    const en = root.lang === 'en';
    document.title = t('title');
    $$('[data-aria-fr]').forEach((el) => el.setAttribute('aria-label', el.dataset[en ? 'ariaEn' : 'ariaFr']));
    $$('[data-l-alt-fr]').forEach((el) => { el.alt = el.dataset[en ? 'lAltEn' : 'lAltFr']; });
    updateAchievements();
  }
  $('#langBtn').addEventListener('click', () => {
    root.lang = root.lang === 'en' ? 'fr' : 'en';
    store.set('sb-lang', root.lang);
    applyLang();
    if (hasGsap) ST.refresh();
  });

  /* ── Défilement fluide ──────────────────────────────────────── */
  let lenis = null;
  if (!reduce && hasGsap && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ST.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  function scrollToEl(el) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: el.id === 'main' ? 0 : -40, duration: 1.6 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const el = id.length > 1 && document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    setMenu(false);
    scrollToEl(el);
    history.replaceState(null, '', id);
  });

  /* ── En-tête : verre au défilement, masqué en descendant ────── */
  const top = $('#top');
  const bar = $('.xp');
  let lastY = 0;
  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    top.classList.toggle('solid', y > 40);
    top.classList.toggle('away', y > 400 && y > lastY && !nav.classList.contains('open'));
    lastY = y;
    bar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  const nav = $('#nav');
  const menuBtn = $('#menuBtn');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (lenis) open ? lenis.stop() : lenis.start();
  }
  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  onScroll();

  // Section courante : lien actif et niveau affiché dans l'en-tête
  const navLinks = $$('.nav a');
  const lvl = $('#lvl');
  const sections = $$('main section');
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const id = en.target.id === 'index-projets' ? 'projets' : en.target.id;
      navLinks.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + id)));
      if (lvl) lvl.textContent = 'LVL ' + String(sections.indexOf(en.target) + 1).padStart(2, '0');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));

  /* ── Avatar 3D ──────────────────────────────────────────────── */
  let avatar = null;
  function webglOK() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
    catch (e) { return false; }
  }
  const avatarEl = $('#avatar');
  if (avatarEl && webglOK()) {
    import('./avatar.js').then(({ createAvatar }) => {
      avatar = createAvatar(avatarEl, { reduceMotion: reduce });
    }).catch(() => root.classList.add('no-gl'));
  } else {
    root.classList.add('no-gl');
  }

  /* ── Découpage du texte en mots ─────────────────────────────── */
  function splitWords(el, wrapInner) {
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            const w = document.createElement('span');
            w.className = 'word';
            if (wrapInner) { const i = document.createElement('span'); i.textContent = p; w.appendChild(i); }
            else w.textContent = p;
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains('word')) walk(n);
      });
    };
    walk(el);
  }

  /* ── Animations ─────────────────────────────────────────────── */
  if (hasGsap && !reduce) {
    // Ouverture : lettres du nom par paliers (façon pixel), puis le reste,
    // et le code s'écrit ligne par ligne
    const chars = $$('.name .c');
    const intro = $$('[data-intro]');
    const lines = $$('#heroCode .ln');
    gsap.set(chars, { yPercent: 110 });
    gsap.set(intro, { y: 20, opacity: 0 });
    gsap.set(lines, { opacity: 0 });
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      gsap.timeline({ delay: .1 })
        .to(chars, { yPercent: 0, duration: .9, ease: 'steps(6)', stagger: .04 })
        .to(intro, { y: 0, opacity: 1, duration: .9, ease: 'expo.out', stagger: .08 }, '-=.6')
        .to(lines, { opacity: 1, duration: .01, stagger: .11 }, '-=.9');
    });
    // L'ouverture s'efface doucement quand on la quitte
    gsap.to('.hero-copy', {
      yPercent: -10, opacity: .2, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });

    // Titres : mots qui montent de derrière un masque
    $$('[data-split]').forEach((h) => {
      splitWords(h, true);
      const inner = $$('.word > span', h);
      gsap.set(inner, { yPercent: 110 });
      ST.create({
        trigger: h, start: 'top 88%', once: true,
        onEnter: () => gsap.to(inner, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: .06 }),
      });
    });

    // Blocs : fondu et montée, par lots
    const reveals = $$('[data-reveal]');
    gsap.set(reveals, { y: 36, opacity: 0 });
    ST.batch(reveals, {
      start: 'top 90%', once: true,
      onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: .08 }),
    });

    // Lignes de projets : apparition en cascade
    ST.batch('.row', {
      start: 'top 92%', once: true,
      onEnter: (batch) => gsap.fromTo(batch, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .9, ease: 'expo.out', stagger: .05 }),
    });

    // Manifeste : les mots s'allument au fil du défilement
    $$('[data-scrub]').forEach((p) => {
      splitWords(p, false);
      gsap.to($$('.word', p), {
        opacity: 1, ease: 'none', stagger: .08,
        scrollTrigger: { trigger: p, start: 'top 82%', end: 'bottom 50%', scrub: .6 },
      });
    });

    // Compteurs
    $$('[data-count]').forEach((el) => {
      const end = +el.dataset.count, o = { v: 0 };
      el.textContent = '0';
      ST.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: () => gsap.to(o, { v: end, duration: 2, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v); } }),
      });
    });

    // Frise : la ligne se dessine, les points s'allument
    const tl = $('.timeline');
    ST.create({
      trigger: tl, start: 'top 70%', end: 'bottom 60%', scrub: .5,
      onUpdate: (self) => tl.style.setProperty('--p', self.progress.toFixed(3)),
    });
    $$('.job').forEach((job) => ST.create({ trigger: job, start: 'top 62%', onEnter: () => job.classList.add('lit'), onLeaveBack: () => job.classList.remove('lit') }));

    // Les ouvertures de lignes changent la hauteur de page
    let refreshT;
    $$('.row').forEach((d) => d.addEventListener('toggle', () => { clearTimeout(refreshT); refreshT = setTimeout(() => ST.refresh(), 650); }));
    window.addEventListener('load', () => ST.refresh());
  } else {
    $$('.big .word').forEach((w) => { w.style.opacity = 1; });
  }

  // Défilement infini des technologies : on double le contenu
  $$('.marquee-track').forEach((tr) => { tr.innerHTML += tr.innerHTML; });

  /* ── Visuels : parallaxe au défilement et à la souris ───────── */
  if (hasGsap && !reduce) {
    // L'image glisse dans son cadre pendant que le cadre défile
    $$('.feat-media .shot > img:not(.paco), .job-visual img').forEach((img) => {
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: img.closest('figure'), start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
    // Sameva : les écrans s'écartent à l'arrivée, puis suivent la souris en profondeur
    const stage = $('.sameva-stage');
    if (stage) {
      const layers = $$('[data-depth]', stage);
      gsap.from($$('.phone', stage), {
        y: 60, opacity: 0, duration: 1.4, ease: 'expo.out', stagger: .12,
        scrollTrigger: { trigger: stage, start: 'top 80%', once: true },
      });
      gsap.from($('.paco', stage), {
        y: 80, rotate: -12, opacity: 0, duration: 1.6, ease: 'elastic.out(1,.55)', delay: .35,
        scrollTrigger: { trigger: stage, start: 'top 80%', once: true },
      });
      if (finePointer) {
        const movers = layers.map((el) => ({
          x: gsap.quickTo(el, 'x', { duration: .9, ease: 'power3' }),
          y: gsap.quickTo(el, 'y', { duration: .9, ease: 'power3' }),
          d: +el.dataset.depth,
        }));
        stage.addEventListener('pointermove', (e) => {
          const r = stage.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5;
          movers.forEach((m) => { m.x(nx * 14 * m.d); m.y(ny * 10 * m.d); });
        });
        stage.addEventListener('pointerleave', () => movers.forEach((m) => { m.x(0); m.y(0); }));
      }
    }
  }

  /* ── Index : aperçu qui suit la souris ──────────────────────── */
  if (finePointer) {
    root.classList.add('has-preview');
    const pv = document.createElement('div');
    pv.className = 'preview';
    pv.setAttribute('aria-hidden', 'true');
    const pvImg = document.createElement('img');
    pvImg.alt = '';
    pv.appendChild(pvImg);
    document.body.appendChild(pv);
    let px = 0, py = 0, tx = 0, ty = 0, raf = 0;
    const follow = () => {
      px += (tx - px) * .16; py += (ty - py) * .16;
      pv.style.left = (px + 28) + 'px'; pv.style.top = (py - 110) + 'px';
      raf = Math.abs(tx - px) + Math.abs(ty - py) > .5 ? requestAnimationFrame(follow) : 0;
    };
    const move = (e) => { tx = e.clientX; ty = e.clientY; if (!raf) raf = requestAnimationFrame(follow); };
    // Préchargement discret des vignettes quand l'index approche
    new IntersectionObserver((en, obs) => {
      if (!en[0].isIntersecting) return;
      $$('.row[data-thumb]').forEach((r) => { const i = new Image(); i.src = r.dataset.thumb; });
      obs.disconnect();
    }, { rootMargin: '400px' }).observe($('#index'));
    $$('.row summary').forEach((sm) => {
      const row = sm.parentElement;
      sm.addEventListener('pointerenter', (e) => {
        if (!row.dataset.thumb) return;
        if (pvImg.getAttribute('src') !== row.dataset.thumb) pvImg.src = row.dataset.thumb;
        px = tx = e.clientX; py = ty = e.clientY; follow();
        pv.classList.add('on');
      });
      sm.addEventListener('pointermove', move);
      sm.addEventListener('pointerleave', () => pv.classList.remove('on'));
    });
    window.addEventListener('scroll', () => pv.classList.remove('on'), { passive: true });
  }

  /* ── Filtres de l'index ─────────────────────────────────────── */
  const rows = $$('.row');
  $$('.chip-btn').forEach((c) => c.addEventListener('click', () => {
    const f = c.dataset.filter;
    $$('.chip-btn').forEach((b) => b.setAttribute('aria-pressed', String(b === c)));
    const show = rows.filter((r) => f === 'all' || r.dataset.dom.split(' ').includes(f));
    rows.forEach((r) => { r.hidden = !show.includes(r); });
    if (hasGsap && !reduce) gsap.fromTo(show, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: 'expo.out', stagger: .035 });
    if (hasGsap) ST.refresh();
  }));

  /* ── Piège de focus (utilisé par games/core.js) ──────────────────── */
  window.focusTrap = function (container) {
    const prev = document.activeElement;
    const sel = 'a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])';
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const f = $$(sel, container).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    container.addEventListener('keydown', onKey);
    const close = $('#gameClose', container);
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
        s.src = 'games/core.js?v=1';
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
    if (!b || window.openGame) return;
    loadGames().then(() => window.openGame(b.dataset.game)).catch(() => { $('.lab-foot').textContent = t('gamesErr'); });
  });
  // Bloque le défilement fluide derrière la fenêtre de jeu
  const modal = $('#gameModal');
  new MutationObserver(() => {
    const open = !modal.classList.contains('hidden');
    if (lenis) open ? lenis.stop() : lenis.start();
    if (avatar) open ? avatar.stop() : avatar.start();
  }).observe(modal, { attributes: true, attributeFilter: ['class'] });

  /* ── Succès ─────────────────────────────────────────────────── */
  const GAME_ACH = {
    connect4: 'champion', snake: 'snake_50', quiz: 'quiz_master', memory: 'memory_king',
    tictactoe: 'tictac_master', pong: 'pong_win', flappy: 'flappy_20', reflex: 'reflex_pro',
    minesweeper: 'mine_sweeper', tetris: 'tetris_10', whack: 'whack_25', taquin: 'taquin_win', rps: 'rps_streak',
  };
  function updateAchievements() {
    const a = window.achievements, out = $('#achCount');
    if (!a || !out) return;
    const n = a.unlockedCount(), tot = a.total();
    out.textContent = n ? t('ach')(n, tot) : '';
    const barEl = $('#achBar'), line = $('#achLine');
    if (barEl) barEl.style.setProperty('--a', (tot ? (n / tot) * 100 : 0) + '%');
    if (line) line.innerHTML = '<b>' + n + '</b>/' + tot + (root.lang === 'en' ? ' unlocked' : ' débloqués');
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
      const spans = $$('span', copyBtn);
      spans.forEach((s) => { s.dataset.orig = s.dataset.orig || s.textContent; s.textContent = T[s.dataset.l].copied; });
      setTimeout(() => spans.forEach((s) => { s.textContent = s.dataset.orig; }), 2200);
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
    let bad = null;
    rules.forEach(([el, ok, key]) => { el.setAttribute('aria-invalid', String(!ok)); if (!ok && !bad) bad = [el, key]; });
    return bad;
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
    const go = (sel) => { close(); scrollToEl($(sel)); };
    const cmds = {
      help: () => say(en()
        ? 'whoami  work  stack  contact  cv  github  linkedin  games  lang  clear  exit'
        : 'whoami  projets  stack  contact  cv  github  linkedin  jeux  lang  clear  exit', 'a'),
      whoami: () => say(en() ? 'Samy Boudaoud, software engineer at CS GROUP. Aix-en-Provence, France.' : 'Samy Boudaoud, ingénieur logiciel chez CS GROUP. Aix-en-Provence.'),
      stack: () => say('C++/Qt  .NET  Java/Kotlin  Dart/Flutter  Python  TypeScript\nPostgreSQL  Redis  Docker  Kubernetes  Terraform\nESP32  Modbus RTU  MQTT  BLE'),
      projets: () => go('#projets'),
      contact: () => say('samyboudaoud95@gmail.com'),
      cv: () => { const a = document.createElement('a'); a.href = 'CV_Samy_Boudaoud.pdf'; a.download = ''; a.click(); },
      github: () => window.open('https://github.com/SamymaS', '_blank', 'noopener'),
      linkedin: () => window.open('https://www.linkedin.com/in/samy-boudaoud', '_blank', 'noopener'),
      jeux: () => go('#labo'),
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
      if (!modal.classList.contains('hidden')) return;
      buf = (buf + e.key.toLowerCase()).slice(-2);
      if (buf === 'sb') { buf = ''; e.preventDefault(); open(); }
    });
  })();

  /* ── Démarrage ──────────────────────────────────────────────── */
  applyLang();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
})();

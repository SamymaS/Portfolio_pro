/* ==================================================================
   games/memory.js · Memory
   Seize cartes, huit glyphes géométriques dessinés au canvas.
   Le retournement est un vrai demi-tour : la carte se comprime sur
   l'axe X selon cos(angle), se soulève légèrement et s'assombrit
   quand elle passe par la tranche. Un coup = une paire retournée.
   ================================================================== */
SBG.register('memory', {
  create(api) {
    const { C } = api;
    const COLS = 4, ROWS = 4;
    const CW = 94, CH = 112, GAP = 12, PAD = 18;
    const W = COLS * CW + (COLS - 1) * GAP + PAD * 2;
    const H = ROWS * CH + (ROWS - 1) * GAP + PAD * 2;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();
    const FLIP = 0.3;           // durée d'un retournement (s)
    const MISS_DELAY = 0.65;    // une paire fausse se referme après 650 ms

    // huit glyphes, teintes du cyan au violet
    const GLYPHS = ['ring', 'triangle', 'diamond', 'hexagon', 'cross', 'wave', 'bolt', 'star'];
    const TINTS = GLYPHS.map((_, i) => mix3(C.cyan, C.blue, C.violet, i / (GLYPHS.length - 1)));

    // sprites pré-rendus (dos, faces, cadre lumineux, ombre) : les lueurs
    // sont calculées une seule fois, chaque image ne fait que les recopier.
    const M = 30;
    const SPR = {};
    function spr(key, draw) {
      if (SPR[key]) return SPR[key];
      const c = document.createElement('canvas');
      c.width = Math.ceil((CW + M * 2) * cv.dpr); c.height = Math.ceil((CH + M * 2) * cv.dpr);
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr); g.translate(CW / 2 + M, CH / 2 + M);
      draw(g);
      return (SPR[key] = c);
    }
    const blit = (im, dx, dy) => ctx.drawImage(im, -CW / 2 - M + (dx || 0), -CH / 2 - M + (dy || 0), CW + M * 2, CH + M * 2);

    let cards, open, moves, pairs, state, clock, cursor, kbd, hover, missAt, endT;

    function reset(deal) {
      const deck = [];
      for (let g = 0; g < GLYPHS.length; g++) deck.push(g, g);
      for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      clock = 0;
      cards = deck.map((g, i) => ({
        g, i, col: i % COLS, row: Math.floor(i / COLS),
        up: false, p: 0,                  // p : 0 dos, 1 face (animé)
        matched: false, matchT: -1, missT: -1,
        dealT: deal ? 0.05 + ((i % COLS) + Math.floor(i / COLS)) * 0.045 : -1,
      }));
      open = []; moves = 0; pairs = 0; missAt = -1; endT = -1;
      cursor = 5; kbd = false; hover = -1;
      fx.clear();
      api.hud({ score: 0, scoreLabel: api.t('Coups', 'Moves') });
      api.status('');
    }

    function start() {
      reset(true);
      state = 'play';
      api.status(api.t('Paires 0 / 8', 'Pairs 0 / 8'));
      loop.start();
    }

    const pos = (c) => ({ x: PAD + c.col * (CW + GAP), y: PAD + c.row * (CH + GAP) });

    /* ── Logique ─────────────────────────────────────────────────── */
    function flip(i) {
      if (state !== 'play') return;
      const c = cards[i];
      if (!c || c.up || c.matched) return;
      // une paire fausse attend encore : on la referme tout de suite
      if (open.length === 2) closeMiss();
      c.up = true;
      open.push(c);
      api.sfx('flip');
      if (open.length < 2) return;

      moves++;
      api.hud({ score: moves });
      const [a, b] = open;
      if (a.g === b.g) {
        a.matched = b.matched = true;
        a.matchT = b.matchT = clock + FLIP * 0.9;
        open = [];
        pairs++;
        api.status(api.t('Paires ', 'Pairs ') + pairs + ' / 8');
        api.after(FLIP * 900, () => {
          api.sfx('score');
          for (const c2 of [a, b]) {
            const p = pos(c2);
            fx.burst(p.x + CW / 2, p.y + CH / 2, { n: 14, color: [TINTS[c2.g], '#fff'], speed: 150, life: 0.6 });
          }
        });
        if (pairs === GLYPHS.length) win();
      } else {
        missAt = clock + MISS_DELAY;
        a.missT = b.missT = clock + FLIP;
      }
    }

    function closeMiss() {
      for (const c of open) c.up = false;
      open = []; missAt = -1;
    }

    function win() {
      state = 'won';
      endT = clock;
      if (moves <= 20) api.unlock('memory_king');
      const record = api.setBest(moves, true);
      api.after(700, () => {
        api.sfx('win');
        fx.burst(W / 2, H / 2, { n: 40, color: [C.cyan, C.violet, '#fff'], speed: 300, life: 1 });
      });
      api.after(1700, () => api.overlay({
        kicker: record ? api.t('Nouveau record', 'New best') : (moves <= 20 ? api.t('Mémoire d\'acier', 'Steel memory') : ''),
        title: api.t('Toutes les paires', 'All pairs found'),
        text: api.t(moves + ' coups', moves + ' moves'),
        action: api.t('Rejouer', 'Play again'),
        tone: record || moves <= 20 ? 'good' : '',
        onAction: start,
      }));
    }

    /* ── Boucle ──────────────────────────────────────────────────── */
    const loop = api.loop({
      update(dt) {
        clock += dt;
        fx.update(dt);
        for (const c of cards) {
          const target = c.up || c.matched ? 1 : 0;
          if (c.p !== target) c.p = target > c.p ? Math.min(1, c.p + dt / FLIP) : Math.max(0, c.p - dt / FLIP);
        }
        if (missAt > 0 && clock >= missAt) { closeMiss(); api.sfx('tick'); }
      },
      render() {
        cv.clear(C.bg);
        for (const c of cards) drawCard(c);
        fx.draw(ctx);
      },
    });

    function drawCard(c) {
      const { x, y } = pos(c);
      const cx = x + CW / 2, cy = y + CH / 2;

      // distribution : chute douce et fondu
      let deal = 1;
      if (c.dealT >= 0) deal = api.clamp((clock - c.dealT) / 0.38, 0, 1);
      if (deal <= 0) return;
      const de = api.ease.out(deal);

      const k = api.ease.inOut(c.p);
      const ang = k * Math.PI;
      const sx = api.reduced ? 1 : Math.abs(Math.cos(ang));
      const showFace = api.reduced ? c.p > 0.5 : ang > Math.PI / 2;
      const lift = api.reduced ? 0 : Math.sin(ang);
      const isHover = !kbd && hover === c.i && state === 'play' && !c.matched && !c.up;
      const isCursor = kbd && cursor === c.i && state === 'play';

      // secousse d'une paire fausse
      let wob = 0;
      if (c.missT >= 0 && !api.reduced) {
        const m = clock - c.missT;
        if (m > 0 && m < 0.3) wob = Math.sin(m * 50) * 3 * (1 - m / 0.3);
      }

      // éclat de la paire trouvée, qui retombe vers une lueur stable
      let glow = 0;
      if (c.matched && c.matchT >= 0 && clock >= c.matchT) {
        const m = clock - c.matchT;
        glow = 0.35 + 0.65 * Math.exp(-m * 3.2);
      }
      // vague finale
      if (endT >= 0) {
        const r = (clock - endT - 0.3) * 900;
        const d = Math.hypot(cx - W / 2, cy - H / 2);
        glow = Math.max(glow, Math.max(0, 1 - Math.abs(d - r) / 90));
      }

      ctx.save();
      ctx.translate(cx + wob, cy + (1 - de) * 18 - lift * 4 - (isHover ? 2 : 0));
      const sc = (0.92 + 0.08 * de) * (1 + lift * 0.06);
      ctx.scale(sc * Math.max(sx, 0.02), sc);
      ctx.globalAlpha = de;

      // ombre portée, plus diffuse quand la carte est soulevée
      ctx.save();
      ctx.globalAlpha *= 0.85 - lift * 0.25;
      blit(spr('shadow', (g) => {
        g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 16 * cv.dpr; g.shadowOffsetY = 1000 * cv.dpr;
        g.fillStyle = '#000';
        api.roundRect(g, -CW / 2, -CH / 2 - 1000, CW, CH, 14); g.fill();
      }), 0, 6 + lift * 10);
      ctx.restore();

      if (showFace) {
        blit(spr('face' + c.g, (g) => drawFace(g, c.g)));
        if (glow > 0) {
          ctx.save();
          ctx.globalAlpha *= Math.min(1, glow);
          blit(spr('glow' + c.g, (g) => drawGlow(g, c.g)));
          ctx.restore();
        }
      } else {
        blit(spr(isHover ? 'backh' : 'back', (g) => drawBack(g, isHover)));
      }

      // assombrissement sur la tranche
      if (lift > 0.02) {
        ctx.fillStyle = 'rgba(4,6,12,' + (lift * 0.45) + ')';
        api.roundRect(ctx, -CW / 2, -CH / 2, CW, CH, 14); ctx.fill();
      }
      if (isCursor) {
        ctx.strokeStyle = C.cyan; ctx.lineWidth = 2;
        api.roundRect(ctx, -CW / 2 - 4, -CH / 2 - 4, CW + 8, CH + 8, 17); ctx.stroke();
        ctx.strokeStyle = 'rgba(56,189,248,0.25)'; ctx.lineWidth = 6;
        api.roundRect(ctx, -CW / 2 - 4, -CH / 2 - 4, CW + 8, CH + 8, 17); ctx.stroke();
      }
      ctx.restore();
    }

    function drawBack(g, isHover) {
      const gr = g.createLinearGradient(0, -CH / 2, 0, CH / 2);
      gr.addColorStop(0, isHover ? '#1C2440' : '#161C32');
      gr.addColorStop(1, '#0F1324');
      g.fillStyle = gr;
      api.roundRect(g, -CW / 2, -CH / 2, CW, CH, 14); g.fill();
      g.strokeStyle = isHover ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.08)';
      g.lineWidth = 1; g.stroke();
      // motif : fines diagonales, coupées au cadre
      g.save();
      api.roundRect(g, -CW / 2 + 7, -CH / 2 + 7, CW - 14, CH - 14, 9);
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.035)';
      for (let d = 0; d < CW + CH; d += 9) {
        g.beginPath(); g.moveTo(-CW / 2 + d, -CH / 2); g.lineTo(-CW / 2 + d - CH, CH / 2); g.stroke();
      }
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.06)';
      api.roundRect(g, -CW / 2 + 7, -CH / 2 + 7, CW - 14, CH - 14, 9); g.stroke();
      // emblème central : pastille et quatre points (neutre, ne ressemble à aucun glyphe)
      g.fillStyle = C.bg2;
      api.roundRect(g, -13, -13, 26, 26, 8); g.fill();
      g.strokeStyle = isHover ? 'rgba(56,189,248,0.55)' : 'rgba(255,255,255,0.08)';
      g.lineWidth = 1; g.stroke();
      g.fillStyle = isHover ? 'rgba(56,189,248,0.9)' : 'rgba(56,189,248,0.45)';
      for (const [px, py] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
        g.beginPath(); g.arc(px, py, 1.9, 0, Math.PI * 2); g.fill();
      }
    }

    function drawFace(g, gi) {
      const tint = TINTS[gi];
      const gr = g.createLinearGradient(0, -CH / 2, 0, CH / 2);
      gr.addColorStop(0, '#1A2036');
      gr.addColorStop(1, '#121628');
      g.fillStyle = gr;
      api.roundRect(g, -CW / 2, -CH / 2, CW, CH, 14); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 1;
      api.roundRect(g, -CW / 2 + 0.5, -CH / 2 + 0.5, CW - 1, CH - 1, 14); g.stroke();
      // halo doux derrière le glyphe
      const halo = g.createRadialGradient(0, 0, 0, 0, 0, 42);
      halo.addColorStop(0, hexA(tint, 0.2));
      halo.addColorStop(1, hexA(tint, 0));
      g.fillStyle = halo;
      g.fillRect(-42, -42, 84, 84);
      g.strokeStyle = tint; g.fillStyle = tint;
      g.lineWidth = 3; g.lineJoin = 'round'; g.lineCap = 'round';
      g.shadowColor = tint; g.shadowBlur = 12 * cv.dpr;
      glyph(g, GLYPHS[gi], 22);
    }

    // cadre lumineux d'une paire trouvée (dessiné avec une opacité variable)
    function drawGlow(g, gi) {
      const tint = TINTS[gi];
      g.fillStyle = hexA(tint, 0.1);
      api.roundRect(g, -CW / 2, -CH / 2, CW, CH, 14); g.fill();
      g.strokeStyle = tint; g.lineWidth = 1.5;
      g.shadowColor = tint; g.shadowBlur = 18 * cv.dpr;
      api.roundRect(g, -CW / 2 + 0.75, -CH / 2 + 0.75, CW - 1.5, CH - 1.5, 14); g.stroke();
      g.shadowBlur = 8 * cv.dpr;
      g.lineWidth = 3;
      glyph(g, GLYPHS[gi], 22);
    }

    // les huit glyphes, centrés sur l'origine, rayon r
    function glyph(ctx, name, r) {
      ctx.beginPath();
      switch (name) {
        case 'ring':
          ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2); ctx.fill();
          return;
        case 'triangle': poly(ctx, 3, r * 1.08, -Math.PI / 2, r * 0.12); ctx.stroke(); return;
        case 'diamond':
          poly(ctx, 4, r * 1.05, -Math.PI / 2, 0); ctx.stroke();
          ctx.beginPath(); poly(ctx, 4, r * 0.42, -Math.PI / 2, 0); ctx.fill();
          return;
        case 'hexagon': poly(ctx, 6, r, 0, 0); ctx.stroke(); return;
        case 'cross': {
          const a = r * 0.34, b = r * 0.95;
          ctx.moveTo(-a, -b); ctx.lineTo(a, -b); ctx.lineTo(a, -a); ctx.lineTo(b, -a); ctx.lineTo(b, a); ctx.lineTo(a, a);
          ctx.lineTo(a, b); ctx.lineTo(-a, b); ctx.lineTo(-a, a); ctx.lineTo(-b, a); ctx.lineTo(-b, -a); ctx.lineTo(-a, -a); ctx.closePath();
          ctx.stroke(); return;
        }
        case 'wave':
          for (let row = -1; row <= 1; row++) {
            const yy = row * r * 0.55;
            ctx.moveTo(-r, yy);
            for (let t = 0; t <= 1.0001; t += 0.05) ctx.lineTo(-r + t * 2 * r, yy + Math.sin(t * Math.PI * 2) * r * 0.2);
          }
          ctx.stroke(); return;
        case 'bolt':
          ctx.moveTo(r * 0.25, -r); ctx.lineTo(-r * 0.55, r * 0.12); ctx.lineTo(-r * 0.02, r * 0.12);
          ctx.lineTo(-r * 0.25, r); ctx.lineTo(r * 0.55, -r * 0.14); ctx.lineTo(r * 0.02, -r * 0.14); ctx.closePath();
          ctx.stroke(); return;
        case 'star': {
          for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.44 : r * 1.05;
            i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.closePath(); ctx.stroke(); return;
        }
      }
    }
    function poly(ctx, n, r, rot) {
      for (let i = 0; i < n; i++) {
        const a = rot + (i * Math.PI * 2) / n;
        i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
    }

    /* ── Couleurs ────────────────────────────────────────────────── */
    function rgb(h) { const p = parseInt(h.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; }
    function mix3(a, b, c, k) {
      const [A, B] = k < 0.5 ? [rgb(a), rgb(b)] : [rgb(b), rgb(c)];
      const t = k < 0.5 ? k * 2 : (k - 0.5) * 2;
      return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
    }
    function hexA(h, a) { const [r, g, b] = rgb(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }

    /* ── Entrées ─────────────────────────────────────────────────── */
    function local(e) {
      const r = cv.el.getBoundingClientRect();
      const s = Math.min(r.width / W, r.height / H);
      return { x: (e.clientX - r.left - (r.width - W * s) / 2) / s, y: (e.clientY - r.top - (r.height - H * s) / 2) / s };
    }
    function cardAt(e) {
      const p = local(e);
      for (const c of cards) {
        const q = pos(c);
        if (p.x >= q.x && p.x <= q.x + CW && p.y >= q.y && p.y <= q.y + CH) return c.i;
      }
      return -1;
    }
    api.on(cv.el, 'pointerdown', (e) => {
      if (e.button !== 0 || state !== 'play') return;
      const i = cardAt(e);
      if (i < 0) return;
      kbd = false; cursor = i;
      flip(i);
    });
    api.on(cv.el, 'pointermove', (e) => { if (e.pointerType === 'mouse') { hover = cardAt(e); if (hover >= 0) kbd = false; } });
    api.on(cv.el, 'pointerleave', () => { hover = -1; });
    api.on(cv.el, 'contextmenu', (e) => e.preventDefault());

    api.onKey((e) => {
      if (state !== 'play') return;
      const mv = { ArrowUp: -COLS, ArrowDown: COLS, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (mv) {
        if (kbd) {
          const col = cursor % COLS, row = Math.floor(cursor / COLS);
          if (mv === -1 && col > 0) cursor--;
          else if (mv === 1 && col < COLS - 1) cursor++;
          else if (mv === -COLS && row > 0) cursor -= COLS;
          else if (mv === COLS && row < ROWS - 1) cursor += COLS;
        }
        kbd = true;
        return;
      }
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        if (document.activeElement && document.activeElement.classList.contains('g-btn')) return;
        e.preventDefault();
        kbd = true; flip(cursor);
      }
    });

    // écran d'accueil : cartes face cachée derrière le panneau
    reset(false); state = 'ready';
    loop.start();
    api.overlay({
      title: 'Memory',
      text: api.t('Huit paires de glyphes. Trouvez-les en 20 coups ou moins.', 'Eight pairs of glyphs. Find them in 20 moves or fewer.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart: start };
  },
});

/* ==================================================================
   games/2048.js · 2048
   Chaque tuile garde son identité : on interpole sa position entre
   l'ancienne et la nouvelle case (110 ms), puis les fusions gonflent
   brièvement et la nouvelle tuile apparaît en douceur. Un coup joué
   pendant l'animation est mis en attente (un seul à la fois).
   ================================================================== */
SBG.register('2048', {
  create(api) {
    const { C } = api;
    const N = 4, W = 480, H = 480, PAD = 16, GAP = 12;
    const CELL = (W - PAD * 2 - GAP * (N - 1)) / N;
    const SLIDE = 0.11, POP = 0.18, SPAWN = 0.16;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();

    // tons : du bleu nuit au cyan, puis violet, puis chaud pour 2048
    const TILE = {
      2: ['#283253', C.ink], 4: ['#2F3D68', C.ink], 8: ['#1F5279', '#fff'], 16: ['#18678F', '#fff'],
      32: ['#1280A8', '#fff'], 64: ['#0E9AC4', '#fff'], 128: ['#38C9E6', '#06202A'], 256: ['#6E8BFF', '#0B1030'],
      512: ['#8F7CFF', '#fff'], 1024: ['#B07CFF', '#fff'], 2048: ['#FFC56B', '#2A1A00'],
    };
    const tileStyle = (v) => TILE[v] || ['#FF7A6B', '#2A0A06'];

    let tiles, grid, score, state, animT, queued, nextId, floats, reached, startBest, moved;

    const px = (c) => PAD + c * (CELL + GAP);

    function reset() {
      tiles = []; floats = []; grid = emptyGrid();
      score = 0; animT = 0; queued = null; nextId = 1; reached = false;
      startBest = api.best || 0;
      fx.clear();
      api.hud({ score: 0, scoreLabel: api.t('Score', 'Score') });
    }
    function emptyGrid() { return Array.from({ length: N }, () => new Array(N).fill(null)); }

    function spawn(animate) {
      const free = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) free.push([r, c]);
      if (!free.length) return;
      const [r, c] = free[Math.floor(Math.random() * free.length)];
      const t = { id: nextId++, v: Math.random() < 0.9 ? 2 : 4, r, c, fr: r, fc: c, born: animate ? 0 : SPAWN, pop: POP, absorbed: null, nv: 0 };
      grid[r][c] = t; tiles.push(t);
    }

    function start() {
      reset();
      spawn(true); spawn(true);
      state = 'play';
      api.status(api.t('Visez la tuile 2048', 'Aim for the 2048 tile'));
      loop.start();
    }

    // ── Logique d'un coup ────────────────────────────────────
    const VEC = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] };
    function move(dir) {
      if (state === 'anim') { queued = dir; return; }
      if (state !== 'play') return;
      const [dr, dc] = VEC[dir];
      const rows = [...Array(N).keys()], cols = [...Array(N).keys()];
      if (dr > 0) rows.reverse();
      if (dc > 0) cols.reverse();
      const next = emptyGrid();
      let gained = 0, best = null;
      moved = false;
      for (const t of tiles) { t.fr = t.r; t.fc = t.c; }
      for (const r of rows) for (const c of cols) {
        const t = grid[r][c];
        if (!t) continue;
        let nr = r, nc = c;
        while (true) {
          const rr = nr + dr, cc = nc + dc;
          if (rr < 0 || rr >= N || cc < 0 || cc >= N) break;
          const o = next[rr][cc];
          if (!o) { nr = rr; nc = cc; continue; }
          if (o.v === t.v && !o.nv) {
            // fusion : t glisse sous o puis disparaît, o double à la fin
            o.nv = o.v * 2; t.absorbed = o;
            nr = rr; nc = cc;
            gained += o.nv;
            if (!best || o.nv > best.nv) best = o;
          }
          break;
        }
        if (t.absorbed) { t.r = nr; t.c = nc; moved = true; continue; }
        next[nr][nc] = t;
        if (nr !== r || nc !== c) moved = true;
        t.r = nr; t.c = nc;
      }
      if (!moved) { return; }
      grid = next;
      animT = 0; state = 'anim';
      api.sfx('move');
      if (gained) {
        score += gained;
        api.hud({ score });
        floats.length = 0;   // un seul gain affiché à la fois : pas d'empilement
        floats.push({ text: '+' + gained, x: px(best.c) + CELL / 2, y: px(best.r) + CELL / 2, t: 0 });
      }
    }

    function endSlide() {
      let merged = false, top = 0;
      tiles = tiles.filter((t) => !t.absorbed);
      for (const t of tiles) {
        t.fr = t.r; t.fc = t.c;
        if (t.nv) {
          t.v = t.nv; t.nv = 0; t.pop = 0; merged = true;
          if (!api.reduced && t.v >= 64) fx.burst(px(t.c) + CELL / 2, px(t.r) + CELL / 2, { n: 10, color: [tileStyle(t.v)[0], '#fff'], speed: 130, life: 0.45, size: 2 });
        }
        top = Math.max(top, t.v);
      }
      if (merged) api.sfx('pop');
      spawn(true);
      if (score > startBest) api.setBest(score);
      state = 'play';
      if (top >= 2048 && !reached) { reached = true; return win(); }
      if (!canMove()) return gameOver();
      if (queued) { const q = queued; queued = null; move(q); }
    }

    function canMove() {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const t = grid[r][c];
        if (!t) return true;
        if (c < N - 1 && grid[r][c + 1] && grid[r][c + 1].v === t.v) return true;
        if (r < N - 1 && grid[r + 1][c] && grid[r + 1][c].v === t.v) return true;
      }
      return false;
    }

    function win() {
      state = 'paused'; queued = null;
      api.sfx('win');
      api.status(api.t('Tuile 2048 atteinte', '2048 tile reached'));
      if (!api.reduced) fx.burst(W / 2, H / 2, { n: 40, color: [C.warm, C.cyan, C.violet, '#fff'], speed: 300, life: 1 });
      api.after(api.reduced ? 300 : 900, () => api.overlay({
        kicker: api.t('Objectif atteint', 'Goal reached'),
        title: '2048',
        text: api.t(score + ' points. Vous pouvez continuer.', score + ' points. You can keep going.'),
        action: api.t('Continuer', 'Keep going'),
        tone: 'good',
        onAction: () => { state = 'play'; api.status(''); },
      }));
    }

    function gameOver() {
      state = 'over'; queued = null;
      api.sfx('lose'); api.shake(5);
      api.status(api.t('Plus aucun coup possible', 'No moves left'));
      const record = score > startBest && score > 0;
      api.after(api.reduced ? 400 : 900, () => api.overlay({
        kicker: record ? api.t('Nouveau record', 'New best') : '',
        title: api.t('Partie terminée', 'Game over'),
        text: api.t(score + ' points', score + ' points'),
        action: api.t('Rejouer', 'Play again'),
        tone: record ? 'good' : '',
        onAction: start,
      }));
    }

    // ── Boucle ────────────────────────────────────────────────
    const loop = api.loop({
      update(dt) {
        fx.update(dt);
        for (const t of tiles) {
          if (t.born < SPAWN) t.born = Math.min(SPAWN, t.born + dt);
          if (t.pop < POP) t.pop = Math.min(POP, t.pop + dt);
        }
        for (let i = floats.length - 1; i >= 0; i--) { floats[i].t += dt; if (floats[i].t > 0.8) floats.splice(i, 1); }
        if (state === 'anim') {
          animT += dt;
          if (animT >= SLIDE) endSlide();
        }
      },
      render() {
        cv.clear(C.bg);
        // plateau
        ctx.fillStyle = C.panel;
        api.roundRect(ctx, 4, 4, W - 8, H - 8, 18); ctx.fill();
        ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { api.roundRect(ctx, px(c), px(r), CELL, CELL, 12); ctx.fill(); }

        const k = state === 'anim' ? api.ease.out(Math.min(1, animT / SLIDE)) : 1;
        // tuiles absorbées dessous, puis les autres
        const order = tiles.slice().sort((a, b) => (b.absorbed ? 1 : 0) - (a.absorbed ? 1 : 0));
        for (const t of order) {
          const x = api.lerp(px(t.fc), px(t.c), k), y = api.lerp(px(t.fr), px(t.r), k);
          let s = 1;
          if (t.born < SPAWN) s = t.born <= 0 ? 0 : api.ease.back(t.born / SPAWN);
          if (t.pop < POP) s = 1 + 0.1 * Math.sin(Math.PI * t.pop / POP);
          if (s <= 0.01) continue;
          drawTile(x, y, t.v, s);
        }

        // gains qui montent
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `700 20px ${api.font}`;
        for (const f of floats) {
          const p = f.t / 0.8;
          const y = Math.max(20, f.y - 22 - api.ease.out(p) * 34);
          ctx.globalAlpha = (1 - p * p) * 0.95;
          ctx.fillStyle = 'rgba(7,9,18,0.55)';
          api.roundRect(ctx, f.x - 26, y - 13, 52, 26, 13); ctx.fill();
          ctx.fillStyle = C.warm;
          ctx.fillText(f.text, f.x, y + 1);
        }
        ctx.globalAlpha = 1;
        fx.draw(ctx);
      },
    });

    function drawTile(x, y, v, s) {
      const [bg, ink] = tileStyle(v);
      const cxp = x + CELL / 2, cyp = y + CELL / 2, w = CELL * s;
      if (v >= 128) {
        const g = ctx.createRadialGradient(cxp, cyp, CELL * 0.2, cxp, cyp, CELL * 0.85);
        g.addColorStop(0, hexA(bg, 0.22)); g.addColorStop(1, hexA(bg, 0));
        ctx.fillStyle = g; ctx.fillRect(cxp - CELL, cyp - CELL, CELL * 2, CELL * 2);
      }
      ctx.fillStyle = bg;
      api.roundRect(ctx, cxp - w / 2, cyp - w / 2, w, w, 12 * s); ctx.fill();
      const sheen = ctx.createLinearGradient(0, cyp - w / 2, 0, cyp + w / 2);
      sheen.addColorStop(0, 'rgba(255,255,255,0.10)'); sheen.addColorStop(0.55, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.stroke();
      const digits = String(v).length;
      const fs = (digits <= 2 ? 40 : digits === 3 ? 34 : digits === 4 ? 27 : 22) * s;
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `750 ${fs}px ${api.font}`;
      ctx.fillText(String(v), cxp, cyp + 1.5 * s);
    }
    function hexA(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }

    // ── Entrées ───────────────────────────────────────────────
    const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', z: 'up', s: 'down', a: 'left', q: 'left', d: 'right' };
    api.onKey((e) => {
      const d = KEYS[e.key] || KEYS[e.key.toLowerCase()];
      if (d) { if (e.ctrlKey || e.metaKey || e.altKey) return; move(d); return; }
      if ((e.key === 'Enter' || e.key === ' ') && state === 'ready' && !(document.activeElement && document.activeElement.classList.contains('g-btn'))) { api.hideOverlay(); start(); }
    });
    api.swipe(cv.el, (d) => { if (VEC[d]) move(d); });

    // ── Accueil ───────────────────────────────────────────────
    reset();
    spawn(false); spawn(false);
    state = 'ready';
    loop.start();
    api.overlay({
      title: '2048',
      text: api.t('Faites glisser les tuiles. Deux tuiles égales fusionnent.', 'Slide the tiles. Two equal tiles merge.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart: start };
  },
});

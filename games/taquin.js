/* ==================================================================
   games/taquin.js · Taquin 4×4
   Mélange par coups légaux depuis la position résolue : toujours
   soluble. Cliquer une tuile alignée avec la case vide fait glisser
   toute la rangée. Chaque tuile est animée depuis sa position
   affichée, donc les coups rapides s'enchaînent sans à-coups.
   ================================================================== */
SBG.register('taquin', {
  create(api) {
    const { C } = api;
    const N = 4, W = 480, H = 480, PAD = 16, GAP = 8;
    const CELL = (W - PAD * 2 - GAP * (N - 1)) / N;
    const SLIDE = 0.1;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();

    let board, tiles, moves, state, solvedT, appearT, gen, startBest, hover;

    const px = (i) => PAD + (i % N) * (CELL + GAP);
    const py = (i) => PAD + Math.floor(i / N) * (CELL + GAP);

    function shuffle() {
      board = [...Array(N * N - 1).keys()].map((i) => i + 1).concat(0);
      let z = N * N - 1, prev = -1;
      do {
        for (let k = 0; k < 200; k++) {
          const opts = neighbours(z).filter((n) => n !== prev);
          const pick = opts[Math.floor(Math.random() * opts.length)];
          board[z] = board[pick]; board[pick] = 0;
          prev = z; z = pick;
        }
      } while (correctCount() > 6);   // jamais presque résolu au départ
    }
    function neighbours(i) {
      const r = Math.floor(i / N), c = i % N, out = [];
      if (r > 0) out.push(i - N);
      if (r < N - 1) out.push(i + N);
      if (c > 0) out.push(i - 1);
      if (c < N - 1) out.push(i + 1);
      return out;
    }
    function correctCount() { let n = 0; for (let i = 0; i < N * N - 1; i++) if (board[i] === i + 1) n++; return n; }

    function reset() {
      shuffle();
      tiles = {};
      board.forEach((v, i) => { if (v) tiles[v] = { x: px(i), y: py(i), fx: px(i), fy: py(i), t: SLIDE }; });
      moves = 0; solvedT = 0; appearT = 0; hover = -1;
      gen = (gen || 0) + 1;
      startBest = api.best;
      fx.clear();
      api.hud({ score: 0, scoreLabel: api.t('Coups', 'Moves') });
    }

    function start() {
      reset();
      state = 'play';
      updateStatus();
      loop.start();
    }

    function updateStatus() {
      api.status(api.t('Tuiles en place : ', 'Tiles in place: ') + correctCount() + ' / 15');
    }

    // fait glisser une tuile (ou une rangée) vers la case vide
    function slideFrom(i) {
      if (state !== 'play' || i < 0) return false;
      const z = board.indexOf(0);
      const r = Math.floor(i / N), c = i % N, zr = Math.floor(z / N), zc = z % N;
      if (i === z || (r !== zr && c !== zc)) { api.sfx('error'); return false; }
      const step = r === zr ? (c < zc ? -1 : 1) : (r < zr ? -N : N);
      // du voisin de la case vide jusqu'à la tuile cliquée
      let gap = z;
      while (gap !== i) {
        const src = gap + step;
        moveTile(src, gap);
        gap = src;
      }
      api.sfx('move');
      api.hud({ score: moves });
      updateStatus();
      if (correctCount() === N * N - 1) solved();
      return true;
    }
    function moveTile(src, dst) {
      const v = board[src];
      const t = tiles[v];
      // part de la position affichée : pas de saut si un glissement est en cours
      const k = api.ease.out(Math.min(1, t.t / SLIDE));
      t.fx = api.lerp(t.fx, t.x, k); t.fy = api.lerp(t.fy, t.y, k);
      t.x = px(dst); t.y = py(dst); t.t = 0;
      board[dst] = v; board[src] = 0;
      moves++;
    }

    function solved() {
      state = 'solved'; solvedT = 0;
      api.unlock('taquin_win');
      const record = api.setBest(moves, true);
      api.sfx('win');
      api.status(api.t('Résolu en ' + moves + ' coups', 'Solved in ' + moves + ' moves'));
      const g = gen;
      api.after(api.reduced ? 120 : 260, () => {
        if (g !== gen || api.reduced) return;
        fx.burst(W / 2, H / 2, { n: 46, color: [C.cyan, C.violet, '#fff'], speed: 320, life: 1.1 });
      });
      api.after(api.reduced ? 500 : 1500, () => {
        if (g !== gen) return;
        api.overlay({
          kicker: record ? api.t('Nouveau record', 'New best') : api.t('Résolu', 'Solved'),
          title: api.t('Bien joué', 'Well played'),
          text: api.t(moves + ' coups', moves + ' moves') + (startBest !== null && !record ? api.t(' · record : ' + startBest, ' · best: ' + startBest) : ''),
          action: api.t('Rejouer', 'Play again'),
          tone: 'good',
          onAction: start,
        });
      });
    }

    // ── Boucle ────────────────────────────────────────────────
    const loop = api.loop({
      update(dt) {
        fx.update(dt);
        appearT += dt;
        for (const v in tiles) { const t = tiles[v]; if (t.t < SLIDE) t.t = Math.min(SLIDE, t.t + dt); }
        if (state === 'solved') solvedT += dt;
      },
      render() {
        cv.clear(C.bg);
        ctx.fillStyle = C.panel;
        api.roundRect(ctx, 4, 4, W - 8, H - 8, 18); ctx.fill();
        ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        for (let i = 0; i < N * N; i++) { api.roundRect(ctx, px(i), py(i), CELL, CELL, 12); ctx.fill(); }

        // case vide complétée à la fin
        if (state === 'solved') {
          const k = api.ease.out(Math.min(1, solvedT / 0.4));
          const i = N * N - 1, x = px(i) + CELL / 2, y = py(i) + CELL / 2, w = CELL * (0.6 + 0.4 * k);
          ctx.globalAlpha = k * 0.9;
          const g = ctx.createLinearGradient(x - w / 2, y - w / 2, x + w / 2, y + w / 2);
          g.addColorStop(0, C.cyan); g.addColorStop(1, C.violet);
          ctx.fillStyle = g;
          api.roundRect(ctx, x - w / 2, y - w / 2, w, w, 12); ctx.fill();
          ctx.globalAlpha = 1;
        }

        const zi = board.indexOf(0);
        for (let i = 0; i < N * N; i++) {
          const v = board[i];
          if (!v) continue;
          const t = tiles[v];
          const k = api.ease.out(Math.min(1, t.t / SLIDE));
          const x = api.lerp(t.fx, t.x, k), y = api.lerp(t.fy, t.y, k);
          let s = 1;
          if (!api.reduced) {
            const a = (appearT - i * 0.022) / 0.24;
            if (a < 1) s = a <= 0 ? 0 : api.ease.back(a);
            if (state === 'solved') {
              const w = solvedT * 2.6 - (Math.floor(i / N) + (i % N)) * 0.18;
              if (w > 0 && w < 1) s *= 1 + 0.08 * Math.sin(Math.PI * w);
            }
          }
          if (s <= 0.01) continue;
          const movable = state === 'play' && (Math.floor(i / N) === Math.floor(zi / N) || i % N === zi % N);
          drawTile(x, y, v, s, board[v - 1] === v || i === v - 1, hover === i && movable);
        }
        fx.draw(ctx);
      },
    });

    function drawTile(x, y, v, s, inPlace, hot) {
      const cx = x + CELL / 2, cy = y + CELL / 2, w = CELL * s;
      ctx.fillStyle = hot ? '#1B2442' : '#151C34';
      api.roundRect(ctx, cx - w / 2, cy - w / 2, w, w, 12 * s); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      api.roundRect(ctx, cx - w / 2, cy - w / 2, w, w * 0.48, 12 * s); ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = inPlace ? 'rgba(56,230,255,0.45)' : hot ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
      api.roundRect(ctx, cx - w / 2 + 0.6, cy - w / 2 + 0.6, w - 1.2, w - 1.2, 12 * s); ctx.stroke();
      if (inPlace) {
        ctx.fillStyle = C.cyan; ctx.globalAlpha *= 0.8;
        api.roundRect(ctx, cx - 9 * s, cy + w / 2 - 14 * s, 18 * s, 3 * s, 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = inPlace ? C.cyan : C.ink;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${38 * s}px ${api.font}`;
      ctx.fillText(String(v), cx, cy + 1);
    }

    // ── Entrées ───────────────────────────────────────────────
    function cellAt(e) {
      const p = cv.toLocal(e.clientX, e.clientY);
      for (let i = 0; i < N * N; i++) {
        if (p.x >= px(i) - GAP / 2 && p.x < px(i) + CELL + GAP / 2 && p.y >= py(i) - GAP / 2 && p.y < py(i) + CELL + GAP / 2) return i;
      }
      return -1;
    }
    api.on(cv.el, 'pointermove', (e) => { hover = e.pointerType === 'touch' ? -1 : cellAt(e); });
    api.on(cv.el, 'pointerleave', () => { hover = -1; });
    api.on(cv.el, 'click', (e) => slideFrom(cellAt(e)));
    // la flèche indique le sens du déplacement de la tuile
    const KEYS = { ArrowLeft: [0, 1], ArrowRight: [0, -1], ArrowUp: [1, 0], ArrowDown: [-1, 0] };
    api.onKey((e) => {
      const m = KEYS[e.key];
      if (m) {
        if (state !== 'play') return;
        const z = board.indexOf(0), r = Math.floor(z / N) + m[0], c = (z % N) + m[1];
        if (r < 0 || r >= N || c < 0 || c >= N) { api.sfx('error'); return; }
        hover = -1;
        slideFrom(r * N + c);
        return;
      }
      if ((e.key === 'Enter' || e.key === ' ') && state === 'ready' && !(document.activeElement && document.activeElement.classList.contains('g-btn'))) { api.hideOverlay(); start(); }
    });

    // ── Accueil ───────────────────────────────────────────────
    reset(); state = 'ready';
    loop.start();
    api.overlay({
      title: api.t('Taquin', '15 puzzle'),
      text: api.t('Remettez les tuiles de 1 à 15 dans l\'ordre, en un minimum de coups.', 'Put the tiles back in order from 1 to 15, in as few moves as you can.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart: start };
  },
});

/* ==================================================================
   games/minesweeper.js · Démineur
   Grille 10×10, 14 mines. Le premier clic et ses voisins sont
   toujours sûrs. La logique est immédiate, l'affichage suit : chaque
   case révélée porte une date d'apparition qui dépend de sa distance
   au clic, d'où l'onde qui se propage. Même principe pour la chaîne
   d'explosions en cas de défaite.
   ================================================================== */
SBG.register('minesweeper', {
  create(api) {
    const { C } = api;
    const N = 10, MINES = 14, CELL = 44, PAD = 14;
    const W = N * CELL + PAD * 2, H = W;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();
    const LONG_PRESS = 0.35;

    // teintes des chiffres : du cyan au corail, en restant dans la palette
    const NUM = [null, C.cyan, C.blue, C.violet, '#E08BFF', C.warm, '#FF9F7A', C.bad, C.ink];

    let cells, state, clock, startAt, elapsed, flags, opened, cursor, kbd, hover, press, firstMove;
    let winWave, shownSec;

    const idx = (x, y) => y * N + x;
    const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
    function around(x, y) {
      const out = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && inside(x + dx, y + dy)) out.push(cells[idx(x + dx, y + dy)]);
      }
      return out;
    }

    function reset() {
      cells = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        cells.push({ x, y, mine: false, n: 0, open: false, flag: false, showAt: 0, flagT: -1, boomAt: -1, wrong: false, nudge: -1 });
      }
      clock = 0; startAt = -1; elapsed = 0; flags = 0; opened = 0;
      cursor = { x: 4, y: 4 }; kbd = false; hover = null; press = null; firstMove = true;
      winWave = -1; shownSec = -1;
      fx.clear();
      api.hud({ score: MINES, scoreLabel: api.t('Mines', 'Mines') });
      api.status(api.t('Premier clic sans risque', 'First click is always safe'));
    }

    function plantMines(sx, sy) {
      const pool = cells.filter((c) => Math.abs(c.x - sx) > 1 || Math.abs(c.y - sy) > 1);
      for (let i = 0; i < MINES; i++) {
        const j = i + Math.floor(Math.random() * (pool.length - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
        pool[i].mine = true;
      }
      for (const c of cells) c.n = around(c.x, c.y).filter((o) => o.mine).length;
    }

    function start() {
      reset();
      state = 'play';
      loop.start();
    }

    /* ── Actions ─────────────────────────────────────────────────── */
    function reveal(x, y) {
      if (state !== 'play') return;
      const c = cells[idx(x, y)];
      if (c.flag) return;
      if (c.open) { chord(c); return; }
      if (firstMove) { plantMines(x, y); firstMove = false; startAt = clock; }
      if (c.mine) return lose(c);
      api.sfx(flood([c], x, y) > 6 ? 'pop' : 'flip');
      checkWin(x, y);
    }

    // révélation en largeur, chaque case datée selon sa distance à l'origine
    function flood(seeds, ox, oy) {
      const q = [];
      for (const s of seeds) if (!s.open && !s.flag && !s.mine) { s.open = true; q.push(s); }
      let count = 0;
      while (q.length) {
        const c = q.shift();
        count++;
        const d = Math.hypot(c.x - ox, c.y - oy);
        c.showAt = clock + (api.reduced ? 0 : d * 0.038);
        if (c.n === 0) {
          for (const o of around(c.x, c.y)) if (!o.open && !o.flag && !o.mine) { o.open = true; q.push(o); }
        }
      }
      opened += count;
      return count;
    }

    // clic sur un chiffre satisfait : ouvre tous ses voisins libres
    function chord(c) {
      if (!c.n) return;
      const nb = around(c.x, c.y);
      const flagged = nb.filter((o) => o.flag).length;
      const closed = nb.filter((o) => !o.open && !o.flag);
      if (!closed.length) return;
      if (flagged !== c.n) {
        closed.forEach((o) => { o.nudge = clock; });
        api.sfx('tick');
        return;
      }
      const mine = closed.find((o) => o.mine);
      if (mine) return lose(mine);
      flood(closed, c.x, c.y);
      api.sfx('flip');
      checkWin(c.x, c.y);
    }

    function toggleFlag(x, y) {
      if (state !== 'play') return;
      const c = cells[idx(x, y)];
      if (c.open) return;
      c.flag = !c.flag;
      c.flagT = clock;
      flags += c.flag ? 1 : -1;
      api.hud({ score: MINES - flags });
      api.sfx(c.flag ? 'move' : 'tick');
    }

    function checkWin(x, y) {
      if (opened < N * N - MINES) return;
      state = 'won';
      const secs = Math.max(1, Math.round(clock - startAt));
      elapsed = clock - startAt;
      for (const c of cells) if (c.mine && !c.flag) { c.flag = true; c.flagT = clock + 0.3; }
      flags = MINES; api.hud({ score: 0 });
      winWave = clock + 0.25;
      api.unlock('mine_sweeper');
      const record = api.setBest(secs, true);
      api.after(380, () => {
        api.sfx('win');
        fx.burst(PAD + (x + 0.5) * CELL, PAD + (y + 0.5) * CELL, { n: 34, color: [C.cyan, C.violet, '#fff'], speed: 260, life: 0.9 });
      });
      api.status(api.t('Grille nettoyée en ' + secs + ' s', 'Board cleared in ' + secs + ' s'));
      api.after(1500, () => api.overlay({
        kicker: record ? api.t('Nouveau record', 'New best') : '',
        title: api.t('Grille nettoyée', 'Board cleared'),
        text: api.t(secs + ' secondes', secs + ' seconds'),
        action: api.t('Rejouer', 'Play again'),
        tone: 'good',
        onAction: start,
      }));
    }

    function lose(hit) {
      state = 'lost';
      elapsed = clock - startAt;
      const mines = cells.filter((c) => c.mine);
      let last = clock;
      for (const m of mines) {
        if (m === hit) { m.boomAt = clock; continue; }
        if (m.flag) continue;            // les bons drapeaux restent posés
        m.boomAt = clock + 0.22 + Math.hypot(m.x - hit.x, m.y - hit.y) * (api.reduced ? 0.02 : 0.075);
        last = Math.max(last, m.boomAt);
      }
      for (const c of cells) if (c.flag && !c.mine) c.wrong = true;
      api.sfx('boom'); api.shake(8);
      fx.burst(PAD + (hit.x + 0.5) * CELL, PAD + (hit.y + 0.5) * CELL, { n: 28, color: [C.bad, C.warm, '#fff'], speed: 250, life: 0.8 });
      api.status(api.t('Mine touchée', 'Mine hit'));
      api.after((last - clock) * 1000 + 800, () => {
        api.sfx('lose');
        api.overlay({
          title: api.t('Perdu', 'Game over'),
          text: api.t('Il restait ' + (N * N - MINES - opened) + ' cases sûres.', (N * N - MINES - opened) + ' safe cells were left.'),
          action: api.t('Rejouer', 'Play again'),
          onAction: start,
        });
      });
    }

    /* ── Boucle ──────────────────────────────────────────────────── */
    const loop = api.loop({
      update(dt) {
        clock += dt;
        fx.update(dt);
        if (state === 'play' && startAt >= 0) {
          const s = Math.floor(clock - startAt);
          if (s !== shownSec) { shownSec = s; api.status(api.t('Temps ', 'Time ') + fmt(s)); }
        }
        if (state === 'lost') {
          for (const c of cells) {
            if (c.boomAt > 0 && !c.boomed && clock >= c.boomAt) {
              c.boomed = true;
              fx.burst(PAD + (c.x + 0.5) * CELL, PAD + (c.y + 0.5) * CELL, { n: 12, color: [C.bad, C.warm], speed: 170, life: 0.55 });
              api.tone(140 + Math.random() * 60, 0.12, 'triangle', 0.25, 0.5);
            }
          }
        }
        if (press && press.touch && !press.fired && clock - press.t >= LONG_PRESS) {
          press.fired = true;
          toggleFlag(press.x, press.y);
          if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* rien */ } }
        }
      },
      render() {
        cv.clear(C.bg);
        // plateau
        ctx.fillStyle = C.bg2;
        api.roundRect(ctx, 4, 4, W - 8, H - 8, 18); ctx.fill();
        ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();

        for (const c of cells) drawCell(c);

        // curseur clavier
        if (kbd && state === 'play') {
          const px = PAD + cursor.x * CELL, py = PAD + cursor.y * CELL;
          ctx.save();
          ctx.shadowColor = C.cyan; ctx.shadowBlur = 14;
          ctx.strokeStyle = C.cyan; ctx.lineWidth = 2;
          api.roundRect(ctx, px + 1.5, py + 1.5, CELL - 3, CELL - 3, 9); ctx.stroke();
          ctx.restore();
        }
        fx.draw(ctx);
      },
    });

    function drawCell(c) {
      const px = PAD + c.x * CELL, py = PAD + c.y * CELL;
      const cx = px + CELL / 2, cy = py + CELL / 2;
      const s = CELL - 4;
      const k = c.open ? api.clamp((clock - c.showAt) / 0.24, 0, 1) : 0;

      // case ouverte (fond + chiffre)
      if (c.open && k > 0) {
        ctx.globalAlpha = k;
        ctx.fillStyle = 'rgba(255,255,255,0.028)';
        api.roundRect(ctx, px + 2, py + 2, s, s, 8); ctx.fill();
        // onde de victoire
        if (winWave > 0 && clock > winWave) {
          const r = (clock - winWave) * 16;
          const d = Math.hypot(c.x - 4.5, c.y - 4.5);
          const g = Math.max(0, 1 - Math.abs(d - r) / 1.6);
          if (g > 0) {
            ctx.fillStyle = 'rgba(56,230,255,' + (0.22 * g) + ')';
            api.roundRect(ctx, px + 2, py + 2, s, s, 8); ctx.fill();
          }
        }
        if (c.n > 0) {
          const sc = api.reduced ? 1 : 0.55 + 0.45 * api.ease.back(k);
          ctx.save();
          ctx.translate(cx, cy + 1); ctx.scale(sc, sc);
          ctx.fillStyle = NUM[c.n];
          ctx.font = '700 ' + Math.round(CELL * 0.44) + 'px ' + api.font;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.shadowColor = NUM[c.n]; ctx.shadowBlur = 8;
          ctx.fillText(String(c.n), 0, 0);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }

      // mine dévoilée (défaite) ou explosée
      if (state === 'lost' && c.mine && !c.flag) {
        const boomed = c.boomAt >= 0 && clock >= c.boomAt;
        const bk = boomed ? api.clamp((clock - c.boomAt) / 0.3, 0, 1) : 0;
        ctx.fillStyle = boomed ? 'rgba(255,122,107,' + (0.1 + 0.18 * (1 - bk) + 0.08) + ')' : 'rgba(255,255,255,0.03)';
        api.roundRect(ctx, px + 2, py + 2, s, s, 8); ctx.fill();
        if (boomed) {
          ctx.save();
          ctx.globalAlpha = 1 - bk;
          ctx.strokeStyle = C.warm; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy, 8 + bk * 22, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
          drawMine(cx, cy);
        } else {
          drawClosed(c, px, py, s, 1, 1);
        }
        return;
      }

      // case fermée : se rétracte pendant la révélation
      if (!c.open || k < 1) {
        const sc = c.open ? 1 - 0.35 * api.ease.out(k) : 1;
        const al = c.open ? 1 - k : 1;
        drawClosed(c, px, py, s, sc, al);
        if (c.open && k > 0 && k < 1 && !api.reduced) {
          ctx.strokeStyle = 'rgba(56,230,255,' + (0.55 * (1 - k)) + ')';
          ctx.lineWidth = 1.5;
          api.roundRect(ctx, px + 2, py + 2, s, s, 8); ctx.stroke();
        }
      }
    }

    function drawClosed(c, px, py, s, sc, al) {
      const cx = px + CELL / 2, cy = py + CELL / 2;
      const isHover = !kbd && hover && hover.x === c.x && hover.y === c.y && state === 'play';
      const isPress = press && press.x === c.x && press.y === c.y && !press.fired && state === 'play';
      const nudge = c.nudge >= 0 ? Math.max(0, 1 - (clock - c.nudge) / 0.35) : 0;
      let scale = sc * (isPress ? 0.92 : 1);
      ctx.save();
      ctx.globalAlpha = al;
      ctx.translate(cx + (nudge ? Math.sin(nudge * 30) * 2 * nudge : 0), cy);
      ctx.scale(scale, scale);
      const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
      g.addColorStop(0, isHover ? '#1E2742' : '#182036');
      g.addColorStop(1, isHover ? '#161D33' : '#121829');
      ctx.fillStyle = g;
      api.roundRect(ctx, -s / 2, -s / 2, s, s, 8); ctx.fill();
      ctx.strokeStyle = isHover ? 'rgba(56,230,255,0.35)' : 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // reflet supérieur
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      api.roundRect(ctx, -s / 2 + 3, -s / 2 + 2, s - 6, 2, 1); ctx.fill();
      if (nudge) {
        ctx.strokeStyle = 'rgba(255,197,107,' + (0.6 * nudge) + ')';
        api.roundRect(ctx, -s / 2, -s / 2, s, s, 8); ctx.stroke();
      }
      if (c.flag) drawFlag(c);
      ctx.restore();
    }

    // drapeau : un fanion géométrique qui se plante avec un léger rebond
    function drawFlag(c) {
      const k = c.flagT >= 0 ? api.clamp((clock - c.flagT) / 0.26, 0, 1) : 1;
      if (k <= 0) return;
      const sc = api.reduced ? 1 : api.ease.back(k);
      ctx.save();
      ctx.scale(sc, sc);
      const col = c.wrong ? C.bad : (state === 'won' ? C.good : C.warm);
      ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(-5, -10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, -10); ctx.lineTo(9, -4.5); ctx.lineTo(-4, 1); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha *= 0.5;
      ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(0, 10); ctx.stroke();
      if (c.wrong) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-11, -11); ctx.lineTo(11, 11); ctx.moveTo(11, -11); ctx.lineTo(-11, 11); ctx.stroke();
      }
      ctx.restore();
    }

    function drawMine(cx, cy) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.lineTo(Math.cos(a) * 11.5, Math.sin(a) * 11.5); ctx.stroke();
      }
      ctx.fillStyle = C.ink;
      ctx.shadowColor = C.bad; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = C.bad;
      ctx.beginPath(); ctx.arc(-2.4, -2.4, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function fmt(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

    /* ── Entrées ─────────────────────────────────────────────────── */
    // coordonnées canvas, en tenant compte d'un éventuel letterbox (object-fit: contain)
    function local(e) {
      const r = cv.el.getBoundingClientRect();
      const s = Math.min(r.width / W, r.height / H);
      const ox = (r.width - W * s) / 2, oy = (r.height - H * s) / 2;
      return { x: (e.clientX - r.left - ox) / s, y: (e.clientY - r.top - oy) / s };
    }
    function cellAt(e) {
      const p = local(e);
      const x = Math.floor((p.x - PAD) / CELL), y = Math.floor((p.y - PAD) / CELL);
      return inside(x, y) ? { x, y } : null;
    }

    let lastPointer = 'mouse';
    api.on(cv.el, 'contextmenu', (e) => e.preventDefault());
    api.on(cv.el, 'pointerdown', (e) => {
      lastPointer = e.pointerType;
      if (state !== 'play') return;
      const c = cellAt(e);
      if (!c) return;
      kbd = false;
      cursor = { x: c.x, y: c.y };
      if (e.button === 2) { toggleFlag(c.x, c.y); return; }
      if (e.button !== 0) return;
      try { cv.el.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
      press = { x: c.x, y: c.y, t: clock, touch: e.pointerType !== 'mouse', fired: false, sx: e.clientX, sy: e.clientY };
    });
    api.on(cv.el, 'pointermove', (e) => {
      if (e.pointerType === 'mouse') { hover = cellAt(e); if (hover) kbd = false; }
      if (press && Math.hypot(e.clientX - press.sx, e.clientY - press.sy) > 12) press = null;
    });
    api.on(cv.el, 'pointerleave', () => { hover = null; });
    api.on(cv.el, 'pointercancel', () => { press = null; });
    api.on(cv.el, 'pointerup', (e) => {
      const p = press; press = null;
      if (!p || p.fired || state !== 'play') return;
      const c = cellAt(e);
      if (c && c.x === p.x && c.y === p.y) reveal(c.x, c.y);
    });

    api.onKey((e) => {
      const onBtn = document.activeElement && document.activeElement.classList.contains('g-btn');
      if (state !== 'play') return;   // l'overlay (bouton focalisé) gère départ et relance
      const mv = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
      if (mv) {
        if (kbd) { cursor.x = api.clamp(cursor.x + mv[0], 0, N - 1); cursor.y = api.clamp(cursor.y + mv[1], 0, N - 1); }
        kbd = true;
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (onBtn || e.repeat) return;
        e.preventDefault();
        kbd = true; reveal(cursor.x, cursor.y);
      } else if (e.key === 'f' || e.key === 'F') {
        kbd = true; toggleFlag(cursor.x, cursor.y);
      }
    });

    // écran d'accueil
    reset(); state = 'ready';
    loop.start();
    api.overlay({
      title: api.t('Démineur', 'Minesweeper'),
      text: api.t('14 mines sur 100 cases. Les chiffres comptent les mines voisines.', '14 mines in 100 cells. Numbers count the adjacent mines.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart: start };
  },
});

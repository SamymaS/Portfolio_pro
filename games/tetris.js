/* ==================================================================
   games/tetris.js · Blocs
   Logique sur grille 10×20 (+2 rangées cachées), rotations SRS avec
   décalages muraux, sac de 7, réserve, délai de verrouillage 0,5 s.
   Tout le temps de jeu (gravité, DAS/ARR, verrouillage) avance dans
   le pas fixe ; le rendu interpole la chute et la rotation.
   ================================================================== */
SBG.register('tetris', {
  create(api) {
    const { C } = api;
    const COLS = 10, ROWS = 22, HIDDEN = 2, VIS = ROWS - HIDDEN, CELL = 26;
    const W = 480, H = 560;
    const BX = 26, BY = 20;
    const BW = COLS * CELL, BH = VIS * CELL;
    const PX = BX + BW + 26, PW = W - PX - 22;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();
    const MANY = api.reduced ? 0.4 : 1;

    const DAS = 0.15, ARR = 0.038, LOCK = 0.5, SOFT = 0.032, MAX_RESETS = 15;
    const CLEAR_DUR = 0.26, COLLAPSE_DUR = 0.16, ROT_DUR = 0.085;

    const COLORS = { I: C.cyan, O: C.warm, T: C.violet, S: C.good, Z: C.bad, J: C.blue, L: '#FF9F70' };
    const BASE = {
      I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
      J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
      L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
      O: [[1, 1], [1, 1]],
      S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
      T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
      Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    };
    const TYPES = Object.keys(BASE);
    const SIZE = {};
    const SHAPES = {};
    TYPES.forEach((k) => {
      let m = BASE[k];
      SIZE[k] = m.length;
      SHAPES[k] = [];
      for (let r = 0; r < 4; r++) {
        const cells = [];
        m.forEach((row, y) => row.forEach((v, x) => { if (v) cells.push([x, y]); }));
        SHAPES[k].push(cells);
        m = m.map((_, y) => m.map((__, x) => m[m.length - 1 - x][y]));
      }
    });
    // Décalages SRS (x vers la droite, y vers le haut ; inversé à l'usage)
    const KICK = {
      '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
      '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
      '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
      '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    };
    const KICK_I = {
      '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
      '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
      '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
      '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], '03': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    };

    let board, piece, bag, queue, hold, holdUsed, score, lines, level, state;
    let fallAcc, lockT, lockResets, lowest, soft, das, vis, clearRows, clearT, collapse, overT, drops, lands, lastStart = -1e9;
    const held = { left: false, right: false };

    function reset() {
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      bag = []; queue = []; hold = null; holdUsed = false;
      score = 0; lines = 0; level = 1;
      fallAcc = 0; lockT = 0; lockResets = 0; soft = false;
      das = { dir: 0, t: 0, arr: 0 };
      vis = { x: 3, rotT: 0, rotDir: 0 };
      clearRows = null; clearT = 0; collapse = null; overT = 0; drops = []; lands = [];
      fx.clear();
      refill();
      piece = null;
      api.hud({ score: 0 });
    }

    function refill() {
      while (queue.length < 5) {
        if (!bag.length) {
          bag = TYPES.slice();
          for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
        }
        queue.push(bag.pop());
      }
    }

    const cellsOf = (p, rot) => SHAPES[p.type][rot === undefined ? p.rot : rot];
    function fits(p, dx, dy, rot) {
      const cs = cellsOf(p, rot);
      for (let i = 0; i < cs.length; i++) {
        const x = p.x + cs[i][0] + dx, y = p.y + cs[i][1] + dy;
        if (x < 0 || x >= COLS || y >= ROWS) return false;
        if (y >= 0 && board[y][x]) return false;
      }
      return true;
    }
    const gravity = () => Math.max(0.03, Math.pow(0.8 - level * 0.007, level));
    const grounded = () => !fits(piece, 0, 1);

    function makePiece(type) { return { type, rot: 0, x: type === 'O' ? 4 : 3, y: 0 }; }
    function spawn(type) {
      piece = makePiece(type || queue.shift());
      refill();
      if (fits(piece, 0, 1)) piece.y++;
      vis.x = piece.x; vis.rotT = 0;
      fallAcc = 0; lockT = 0; lockResets = 0; lowest = piece.y;
      if (!fits(piece, 0, 0)) gameOver();
    }

    function start() {
      const now = performance.now();
      if (now - lastStart < 350) return;
      lastStart = now;
      reset();
      state = 'play';
      spawn();
      syncStatus();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      loop.start();
    }

    function syncStatus() {
      api.status(api.t('Niveau ' + level + ' · ' + lines + (lines > 1 ? ' lignes' : ' ligne'), 'Level ' + level + ' · ' + lines + (lines === 1 ? ' line' : ' lines')));
    }

    function afterMove() {
      if (grounded() && lockResets < MAX_RESETS) { lockT = 0; lockResets++; }
    }
    function shift(dir) {
      if (state !== 'play' || !fits(piece, dir, 0)) return false;
      piece.x += dir; afterMove();
      return true;
    }
    function rotate(dir) {
      if (state !== 'play' || piece.type === 'O') return;
      const from = piece.rot, to = (from + dir + 4) % 4;
      const kicks = (piece.type === 'I' ? KICK_I : KICK)['' + from + to];
      for (let i = 0; i < kicks.length; i++) {
        const dx = kicks[i][0], dy = -kicks[i][1];
        if (fits(piece, dx, dy, to)) {
          piece.x += dx; piece.y += dy; piece.rot = to;
          if (i > 0) vis.x = piece.x;
          vis.rotT = 1; vis.rotDir = dir;
          if (piece.y > lowest) { lowest = piece.y; lockResets = 0; }
          afterMove();
          api.tone(600 + dir * 40, 0.04, 'triangle', 0.18);
          return;
        }
      }
    }
    function softStep() {
      if (state === 'play' && fits(piece, 0, 1)) { piece.y++; score += 1; fallAcc = 0; api.hud({ score }); return true; }
      return false;
    }
    function hardDrop() {
      if (state !== 'play') return;
      const y0 = piece.y;
      while (fits(piece, 0, 1)) piece.y++;
      const d = piece.y - y0;
      if (d > 0) {
        score += d * 2; api.hud({ score });
        const cs = cellsOf(piece);
        const xs = new Set(cs.map((c) => c[0] + piece.x));
        xs.forEach((x) => {
          const top = Math.min(...cs.filter((c) => c[0] + piece.x === x).map((c) => c[1])) + piece.y;
          drops.push({ x, y0: top - d, y1: top, t: 0, col: COLORS[piece.type] });
        });
      }
      api.sfx('drop');
      lockPiece();
    }
    function doHold() {
      if (state !== 'play' || holdUsed) return;
      const cur = piece.type;
      if (hold) { const h = hold; hold = cur; spawn(h); }
      else { hold = cur; spawn(); }
      holdUsed = true;
      api.sfx('flip');
    }

    function lockPiece() {
      const cs = cellsOf(piece);
      let above = true;
      cs.forEach(([cx, cy]) => {
        const x = piece.x + cx, y = piece.y + cy;
        if (y >= 0) board[y][x] = piece.type;
        if (y >= HIDDEN) above = false;
        lands.push({ x, y, t: 0 });
      });
      if (above) return gameOver();
      const full = [];
      for (let y = 0; y < ROWS; y++) if (board[y].every((v) => v)) full.push(y);
      if (full.length) {
        clearRows = full; clearT = 0; state = 'clear';
        const pts = [0, 100, 300, 500, 800][full.length] * level;
        score += pts; lines += full.length;
        const nl = 1 + Math.floor(lines / 10);
        if (nl > level) { level = nl; api.sfx('win'); } else api.sfx(full.length >= 4 ? 'win' : 'score');
        if (lines >= 10) api.unlock('tetris_10');
        api.hud({ score }); syncStatus();
        full.forEach((y) => {
          const py = BY + (y - HIDDEN) * CELL + CELL / 2;
          for (let i = 0; i < 4; i++) {
            fx.burst(BX + (i + 0.5) * BW / 4, py, { n: Math.round(6 * MANY), speed: 170, color: ['#fff', C.cyan, C.violet], life: 0.55, size: 2.2 });
          }
        });
        if (full.length >= 4) api.shake(4);
      } else {
        api.tone(180, 0.06, 'sine', 0.35, 0.7);
        holdUsed = false;
        spawn();
      }
    }

    function finishClear() {
      const gone = new Set(clearRows);
      const nb = [], shift = Array(ROWS).fill(0);
      let c = 0;
      const kept = [];
      for (let y = ROWS - 1; y >= 0; y--) {
        if (gone.has(y)) { c++; continue; }
        kept.push({ row: board[y], s: c });
      }
      for (let i = 0; i < clearRows.length; i++) kept.push({ row: Array(COLS).fill(null), s: clearRows.length });
      for (let i = 0; i < ROWS; i++) { nb[ROWS - 1 - i] = kept[i].row; shift[ROWS - 1 - i] = kept[i].s; }
      board = nb;
      collapse = { shift, t: 0 };
      clearRows = null;
      state = 'play';
      holdUsed = false;
      spawn();
    }

    function gameOver() {
      state = 'over'; overT = 0;
      das.dir = 0; soft = false;
      api.sfx('lose'); api.shake(6);
      const record = api.setBest(score);
      api.after(900, () => api.overlay({
        kicker: record && score > 0 ? api.t('Nouveau record', 'New best') : '',
        title: api.t('Partie terminée', 'Game over'),
        text: api.t(score + ' points · ' + lines + (lines > 1 ? ' lignes' : ' ligne'), score + ' points · ' + lines + (lines === 1 ? ' line' : ' lines')),
        action: api.t('Rejouer', 'Play again'),
        tone: record && score > 0 ? 'good' : '',
        onAction: start,
      }));
    }

    const loop = api.loop({
      update(dt) {
        fx.update(dt);
        if (collapse) { collapse.t += dt; if (collapse.t >= COLLAPSE_DUR) collapse = null; }
        for (let i = drops.length - 1; i >= 0; i--) { drops[i].t += dt; if (drops[i].t > 0.28) drops.splice(i, 1); }
        for (let i = lands.length - 1; i >= 0; i--) { lands[i].t += dt; if (lands[i].t > 0.3) lands.splice(i, 1); }
        if (state === 'over') { overT += dt; return; }
        if (state === 'clear') { clearT += dt; if (clearT >= CLEAR_DUR) finishClear(); return; }
        if (state !== 'play' || !piece) return;

        vis.rotT = Math.max(0, vis.rotT - dt / ROT_DUR);
        vis.x += (piece.x - vis.x) * Math.min(1, dt * 30);

        if (das.dir) {
          das.t += dt;
          if (das.t >= DAS) {
            das.arr += dt;
            while (das.arr >= ARR) { das.arr -= ARR; if (!shift(das.dir)) { das.arr = 0; break; } }
          }
        }

        const interval = soft ? Math.min(gravity(), SOFT) : gravity();
        if (fits(piece, 0, 1)) {
          fallAcc += dt;
          while (fallAcc >= interval) {
            fallAcc -= interval;
            if (!fits(piece, 0, 1)) { fallAcc = 0; break; }
            piece.y++;
            if (soft) { score += 1; api.hud({ score }); }
            if (piece.y > lowest) { lowest = piece.y; lockResets = 0; lockT = 0; }
          }
        } else {
          fallAcc = 0;
          lockT += dt;
          if (lockT >= LOCK) lockPiece();
        }
      },
      render() {
        cv.clear(C.bg);
        drawWell();
        drawBoard();
        if (piece && state === 'play') { drawGhost(); drawPiece(); }
        drawDrops();
        fx.draw(ctx);
        drawPanel();
      },
    });

    /* ── Dessin ──────────────────────────────────────────────────── */
    function rgba(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function cell(x, y, col, a, s) {
      const sz = (s || CELL);
      ctx.globalAlpha = a;
      ctx.fillStyle = col;
      api.roundRect(ctx, x + 1.5, y + 1.5, sz - 3, sz - 3, sz * 0.2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x + sz * 0.24, y + 3.5, sz * 0.52, Math.max(1.5, sz * 0.07));
      ctx.fillStyle = 'rgba(7,9,18,0.18)';
      ctx.fillRect(x + 3, y + sz - 5, sz - 6, 2);
      ctx.globalAlpha = 1;
    }

    function drawWell() {
      ctx.fillStyle = C.bg2;
      api.roundRect(ctx, BX - 8, BY - 8, BW + 16, BH + 16, 14); ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = C.grid;
      ctx.beginPath();
      for (let x = 1; x < COLS; x++) { ctx.moveTo(BX + x * CELL + 0.5, BY); ctx.lineTo(BX + x * CELL + 0.5, BY + BH); }
      for (let y = 1; y < VIS; y++) { ctx.moveTo(BX, BY + y * CELL + 0.5); ctx.lineTo(BX + BW, BY + y * CELL + 0.5); }
      ctx.stroke();
    }

    function drawBoard() {
      ctx.save();
      ctx.beginPath(); ctx.rect(BX - 2, BY - 2, BW + 4, BH + 4); ctx.clip();
      const k = collapse ? api.ease.out(Math.min(1, collapse.t / COLLAPSE_DUR)) : 1;
      const clearing = clearRows ? new Set(clearRows) : null;
      const ck = clearRows ? clearT / CLEAR_DUR : 0;
      const greyRows = state === 'over' ? Math.floor(overT * 45) : -1;
      for (let y = HIDDEN; y < ROWS; y++) {
        const off = collapse ? -collapse.shift[y] * CELL * (1 - k) : 0;
        const py = BY + (y - HIDDEN) * CELL + off;
        const isClear = clearing && clearing.has(y);
        const grey = greyRows >= 0 && (ROWS - 1 - y) < greyRows;
        for (let x = 0; x < COLS; x++) {
          const v = board[y][x];
          if (!v) continue;
          const px = BX + x * CELL;
          if (isClear) {
            const sx = 1 - api.ease.inOut(Math.min(1, ck * 1.15));
            const cx = BX + BW / 2;
            const w = CELL * sx;
            const nx = cx + (px + CELL / 2 - cx) * sx - w / 2;
            ctx.globalAlpha = 1 - ck * 0.6;
            ctx.fillStyle = ck < 0.35 ? '#fff' : COLORS[v];
            api.roundRect(ctx, nx + 1.5, py + 1.5 + CELL * (1 - sx) * 0.3, Math.max(0, w - 3), (CELL - 3) * (0.4 + 0.6 * sx), 5);
            ctx.fill();
            ctx.globalAlpha = 1;
          } else {
            cell(px, py, grey ? C.faint : COLORS[v], grey ? 0.55 : 0.92);
          }
        }
        if (isClear) {
          const g = ctx.createLinearGradient(BX, 0, BX + BW, 0);
          const a = 0.5 * (1 - ck);
          g.addColorStop(0, 'rgba(56,230,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,' + a + ')'); g.addColorStop(1, 'rgba(176,124,255,0)');
          ctx.fillStyle = g; ctx.fillRect(BX, py + CELL / 2 - 2, BW, 4);
        }
      }
      // éclat bref à la pose
      for (const l of lands) {
        if (l.y < HIDDEN) continue;
        ctx.globalAlpha = 0.35 * (1 - l.t / 0.3);
        ctx.fillStyle = '#fff';
        api.roundRect(ctx, BX + l.x * CELL + 1.5, BY + (l.y - HIDDEN) * CELL + 1.5, CELL - 3, CELL - 3, 5); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function ghostY() {
      let d = 0;
      while (fits(piece, 0, d + 1)) d++;
      return piece.y + d;
    }
    function drawGhost() {
      const gy = ghostY();
      if (gy === piece.y) return;
      const col = COLORS[piece.type];
      ctx.strokeStyle = rgba(col, 0.45); ctx.fillStyle = rgba(col, 0.07); ctx.lineWidth = 1.5;
      for (const [cx, cy] of cellsOf(piece)) {
        const y = gy + cy;
        if (y < HIDDEN) continue;
        api.roundRect(ctx, BX + (piece.x + cx) * CELL + 2.5, BY + (y - HIDDEN) * CELL + 2.5, CELL - 5, CELL - 5, 5);
        ctx.fill(); ctx.stroke();
      }
    }

    function drawPiece() {
      const col = COLORS[piece.type];
      const interval = soft ? Math.min(gravity(), SOFT) : gravity();
      const fy = fits(piece, 0, 1) ? Math.min(1, fallAcc / interval) : 0;
      const px = BX + vis.x * CELL, py = BY + (piece.y + fy - HIDDEN) * CELL;
      const n = SIZE[piece.type];
      const cxp = px + n * CELL / 2, cyp = py + n * CELL / 2;
      // halo doux
      const gr = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, CELL * 3);
      gr.addColorStop(0, rgba(col, 0.16)); gr.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = gr; ctx.fillRect(cxp - CELL * 3, cyp - CELL * 3, CELL * 6, CELL * 6);
      ctx.save();
      ctx.beginPath(); ctx.rect(BX - 2, BY, BW + 4, BH + 2); ctx.clip();
      if (vis.rotT > 0) {
        ctx.translate(cxp, cyp);
        ctx.rotate(-vis.rotDir * Math.PI / 2 * api.ease.inOut(vis.rotT));
        ctx.translate(-cxp, -cyp);
      }
      const lockA = grounded() ? 0.92 - 0.25 * Math.min(1, lockT / LOCK) : 1;
      for (const [cx, cy] of cellsOf(piece)) cell(px + cx * CELL, py + cy * CELL, col, lockA);
      ctx.restore();
    }

    function drawDrops() {
      for (const d of drops) {
        if (d.y1 < HIDDEN) continue;
        const k = d.t / 0.28;
        const top = BY + (Math.max(HIDDEN, d.y0) - HIDDEN) * CELL;
        const bot = BY + (d.y1 - HIDDEN) * CELL;
        if (bot <= top) continue;
        const g = ctx.createLinearGradient(0, top, 0, bot);
        g.addColorStop(0, rgba(d.col, 0)); g.addColorStop(1, rgba(d.col, 0.28 * (1 - k)));
        ctx.fillStyle = g;
        ctx.fillRect(BX + d.x * CELL + 4, top, CELL - 8, bot - top);
      }
    }

    function miniPiece(type, cx, cy, s, a) {
      const cs = SHAPES[type][0];
      let minx = 9, maxx = -9, miny = 9, maxy = -9;
      cs.forEach(([x, y]) => { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); });
      const w = (maxx - minx + 1) * s, h = (maxy - miny + 1) * s;
      cs.forEach(([x, y]) => cell(cx - w / 2 + (x - minx) * s, cy - h / 2 + (y - miny) * s, COLORS[type], a, s));
    }
    function box(x, y, w, h) {
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      api.roundRect(ctx, x, y, w, h, 12); ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
    }
    function label(text, x, y) {
      ctx.fillStyle = C.faint; ctx.font = '600 12px ' + api.font;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, x, y);
    }
    const HOLD_BOX = { x: PX, y: 252, w: PW, h: 82 };
    function drawPanel() {
      label(api.t('Suivante', 'Next'), PX + 2, BY + 6);
      box(PX, BY + 16, PW, 94);
      if (queue && queue.length) {
        miniPiece(queue[0], PX + PW / 2, BY + 16 + 47, 20, 0.95);
        box(PX, BY + 118, PW, 64);
        miniPiece(queue[1], PX + PW * 0.28, BY + 150, 12, 0.6);
        miniPiece(queue[2], PX + PW * 0.72, BY + 150, 12, 0.45);
      }
      label(api.t('Réserve', 'Hold'), PX + 2, HOLD_BOX.y - 10);
      box(HOLD_BOX.x, HOLD_BOX.y, HOLD_BOX.w, HOLD_BOX.h);
      if (hold) miniPiece(hold, PX + PW / 2, HOLD_BOX.y + HOLD_BOX.h / 2, 18, holdUsed ? 0.3 : 0.9);
      else {
        ctx.fillStyle = C.faint; ctx.font = '500 12px ' + api.font; ctx.textAlign = 'center';
        ctx.fillText(api.t('C ou Maj', 'C or Shift'), PX + PW / 2, HOLD_BOX.y + HOLD_BOX.h / 2 + 4);
      }
      const stats = [[api.t('Niveau', 'Level'), level], [api.t('Lignes', 'Lines'), lines]];
      stats.forEach(([l, v], i) => {
        const y = 382 + i * 70;
        label(l, PX + 2, y);
        ctx.fillStyle = C.ink; ctx.font = '700 30px ' + api.font; ctx.textAlign = 'left';
        ctx.fillText(String(v), PX + 2, y + 34);
      });
      // jauge vers le niveau suivant
      const k = (lines % 10) / 10;
      ctx.fillStyle = C.grid; api.roundRect(ctx, PX + 2, 532, PW - 4, 4, 2); ctx.fill();
      if (k > 0) { ctx.fillStyle = C.cyan; api.roundRect(ctx, PX + 2, 532, (PW - 4) * k, 4, 2); ctx.fill(); }
    }

    /* ── Entrées ─────────────────────────────────────────────────── */
    function press(dir) {
      if (state !== 'play') return;
      if (shift(dir)) api.tone(520, 0.03, 'triangle', 0.14);
      das = { dir, t: 0, arr: 0 };
    }
    api.onKey((e) => {
      const k = e.key;
      if ((k === ' ' || k === 'Enter') && state !== 'play' && state !== 'clear') {
        if (state === 'over' && overT < 0.5) return;
        api.hideOverlay(); start(); return;
      }
      if (state !== 'play') return;
      if (k === 'ArrowLeft' || k === 'q' || k === 'a') { e.preventDefault(); if (!e.repeat) { held.left = true; press(-1); } }
      else if (k === 'ArrowRight' || k === 'd') { e.preventDefault(); if (!e.repeat) { held.right = true; press(1); } }
      else if (k === 'ArrowDown' || k === 's') { e.preventDefault(); soft = true; }
      else if (!e.repeat && (k === 'ArrowUp' || k === 'x' || k === 'X' || k === 'w' || k === 'z')) { e.preventDefault(); rotate(k === 'z' ? -1 : 1); }
      else if (!e.repeat && (k === 'Z' || k === 'Control' || k === 'y')) rotate(-1);
      else if (!e.repeat && k === ' ') hardDrop();
      else if (!e.repeat && (k === 'c' || k === 'C' || k === 'Shift')) doHold();
    });
    api.on(document, 'keyup', (e) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'q' || k === 'a') { held.left = false; if (das.dir === -1) das = held.right ? { dir: 1, t: 0, arr: 0 } : { dir: 0, t: 0, arr: 0 }; }
      else if (k === 'ArrowRight' || k === 'd') { held.right = false; if (das.dir === 1) das = held.left ? { dir: -1, t: 0, arr: 0 } : { dir: 0, t: 0, arr: 0 }; }
      else if (k === 'ArrowDown' || k === 's') soft = false;
    });
    api.on(window, 'blur', () => { held.left = held.right = false; das.dir = 0; soft = false; });

    // Souris et doigt : glisser pour déplacer, toucher pour tourner, lancer vers le haut pour poser
    function toLocal(cx, cy) {
      const r = cv.el.getBoundingClientRect();
      const s = Math.min(r.width / W, r.height / H);
      return { x: (cx - (r.left + (r.width - W * s) / 2)) / s, y: (cy - (r.top + (r.height - H * s) / 2)) / s, s };
    }
    let g = null;
    api.on(cv.el, 'pointerdown', (e) => {
      if (state !== 'play' || (e.pointerType === 'mouse' && e.button !== 0)) return;
      g = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, ax: 0, ay: 0, t: performance.now(), moved: false };
      try { cv.el.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
    });
    api.on(cv.el, 'pointermove', (e) => {
      if (!g || e.pointerId !== g.id || state !== 'play') return;
      const step = CELL * toLocal(0, 0).s * 0.9;
      g.ax += e.clientX - g.lx; g.ay += e.clientY - g.ly;
      g.lx = e.clientX; g.ly = e.clientY;
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 12) g.moved = true;
      if (Math.abs(e.clientX - g.sx) > Math.abs(e.clientY - g.sy) * 0.7) {
        while (g.ax > step) { g.ax -= step; shift(1); }
        while (g.ax < -step) { g.ax += step; shift(-1); }
        g.ay = 0;
      } else if (performance.now() - g.t > 90) {
        while (g.ay > step) { g.ay -= step; softStep(); }
        if (g.ay < 0) g.ay = 0;
        g.ax = 0;
      }
    });
    function endGesture(e) {
      if (!g || e.pointerId !== g.id) return;
      const dt = performance.now() - g.t, dx = e.clientX - g.sx, dy = e.clientY - g.sy;
      const cur = g; g = null;
      if (state !== 'play') return;
      if (!cur.moved && dt < 400) {
        const p = toLocal(e.clientX, e.clientY);
        if (p.x >= HOLD_BOX.x && p.x <= HOLD_BOX.x + HOLD_BOX.w && p.y >= HOLD_BOX.y && p.y <= HOLD_BOX.y + HOLD_BOX.h) doHold();
        else rotate(1);
      } else if (dy < -40 && Math.abs(dy) > Math.abs(dx) * 1.2 && dt < 450) hardDrop();
    }
    api.on(cv.el, 'pointerup', endGesture);
    api.on(cv.el, 'pointercancel', () => { g = null; });
    api.on(cv.el, 'contextmenu', (e) => e.preventDefault());

    // écran d'accueil
    reset(); state = 'ready';
    loop.start();
    api.overlay({
      title: api.t('Blocs', 'Blocks'),
      text: api.t('Complétez des lignes pour les effacer. La vitesse augmente toutes les dix lignes.', 'Complete rows to clear them. Speed rises every ten lines.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart() { lastStart = -1e9; start(); } };
  },
});

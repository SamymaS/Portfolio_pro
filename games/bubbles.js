/* ==================================================================
   games/bubbles.js · Bulles (tir de bulles façon Puzzle Bobble)
   Une grille hexagonale de bulles colorées pend du plafond. On vise
   avec la souris, le doigt ou les flèches, la bulle rebondit sur les
   parois puis s'accroche à la grille. Trois bulles de même couleur ou
   plus éclatent, et tout ce qui n'est plus relié au plafond tombe.
   Le plafond descend d'une rangée toutes les N bulles tirées.
   Les bulles sont dessinées une seule fois dans des sprites ; chaque
   couleur porte un petit symbole pour rester lisible sans les couleurs.
   ================================================================== */
SBG.register('bubbles', {
  create(api) {
    const { C } = api;
    const W = 400, H = 600;
    const R = 16, D = R * 2, ROWH = R * Math.sqrt(3);
    const COLS = 12, MAXR = 18;
    const LEFT = 8, RIGHT = W - 8;
    const CEIL0 = 8;
    const LX = W / 2, LY = H - 52;
    const DANGER_Y = H - 104;
    const NX = 58, NY = H - 40;            // emplacement de la bulle suivante
    const SPEED = 920;
    const HIT2 = (D * 0.84) * (D * 0.84);  // distance d'accroche
    const LASER2 = (D * 0.92) * (D * 0.92);
    const AMIN = 0.13;                     // angle minimal par rapport à l'horizontale
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const dpr = cv.dpr;
    cv.el.style.touchAction = 'none';
    const fx = api.particles();
    const PI2 = Math.PI * 2;

    /* ── Couleurs et bonus ───────────────────────────────────────── */
    const COLORS = [C.cyan, C.violet, C.good, C.warm, C.bad, C.ink];
    const BOMB = 10, RAINBOW = 11, LASER = 12;
    const POWERS = {
      10: { fr: 'Bombe', en: 'Bomb', col: C.warm },
      11: { fr: 'Arc-en-ciel', en: 'Rainbow', col: C.violet },
      12: { fr: 'Laser', en: 'Laser', col: C.cyan },
    };
    const isPower = (k) => k >= 10;
    const colOf = (k) => (isPower(k) ? POWERS[k].col : COLORS[k]);
    const powName = (k) => api.t(POWERS[k].fr, POWERS[k].en);

    function shade(hex, k) {
      const n = parseInt(hex.slice(1), 16);
      let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      const t = k > 0 ? 255 : 0, a = Math.abs(k);
      r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
      return `rgb(${r},${g},${b})`;
    }
    function rgba(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }

    /* ── Sprites pré-rendus ──────────────────────────────────────── */
    function sprite(size, draw) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(size * dpr); c.height = Math.ceil(size * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, size / 2 * dpr, size / 2 * dpr);
      draw(g);
      return { c, size };
    }

    // symbole discret au centre de chaque bulle (lisible sans les couleurs)
    function glyph(g, i, s) {
      g.beginPath();
      if (i === 0) { g.arc(0, 0, s * 0.8, 0, PI2); }
      else if (i === 1) { g.moveTo(0, -s); g.lineTo(s, 0); g.lineTo(0, s); g.lineTo(-s, 0); g.closePath(); }
      else if (i === 2) { g.moveTo(0, -s); g.lineTo(s * 0.95, s * 0.7); g.lineTo(-s * 0.95, s * 0.7); g.closePath(); }
      else if (i === 3) { g.rect(-s * 0.75, -s * 0.75, s * 1.5, s * 1.5); }
      else if (i === 4) { g.moveTo(-s * 0.7, -s * 0.7); g.lineTo(s * 0.7, s * 0.7); g.moveTo(s * 0.7, -s * 0.7); g.lineTo(-s * 0.7, s * 0.7); }
      else {
        for (let a = 0; a < 5; a++) {
          const o = -Math.PI / 2 + a * PI2 / 5, m = o + Math.PI / 5;
          g.lineTo(Math.cos(o) * s, Math.sin(o) * s);
          g.lineTo(Math.cos(m) * s * 0.45, Math.sin(m) * s * 0.45);
        }
        g.closePath();
      }
    }

    function drawBubble(g, col, i) {
      const r = R - 0.5;
      const body = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.08, 0, 0, r);
      body.addColorStop(0, shade(col, 0.45));
      body.addColorStop(0.55, col);
      body.addColorStop(1, shade(col, -0.35));
      g.fillStyle = body;
      g.beginPath(); g.arc(0, 0, r, 0, PI2); g.fill();
      // lumière rasante en bas
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1.4;
      g.beginPath(); g.arc(0, 0, r - 2.5, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();
      // symbole
      if (i >= 0) {
        g.strokeStyle = shade(col, -0.55); g.globalAlpha = 0.62; g.lineWidth = 2; g.lineJoin = 'round'; g.lineCap = 'round';
        glyph(g, i, 5.4); g.stroke();
        g.globalAlpha = 1;
      }
      // reflet principal
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.beginPath(); g.ellipse(-r * 0.4, -r * 0.45, r * 0.24, r * 0.14, -0.7, 0, PI2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(-r * 0.12, -r * 0.62, 1.3, 0, PI2); g.fill();
      // contour
      g.strokeStyle = shade(col, -0.5); g.lineWidth = 1.2;
      g.beginPath(); g.arc(0, 0, r - 0.6, 0, PI2); g.stroke();
    }

    const BS = D + 4;
    const SPR = COLORS.map((col, i) => sprite(BS, (g) => drawBubble(g, col, i)));
    const DEAD = sprite(BS, (g) => drawBubble(g, '#3A414B', -1));

    // bonus : capsule ronde sombre, liseré plus clair, halo doux, symbole tracé
    const PS = D + 22;
    function drawPower(g, k) {
      const col = POWERS[k].col, r = R - 0.5;
      const halo = g.createRadialGradient(0, 0, r * 0.6, 0, 0, PS / 2);
      halo.addColorStop(0, rgba(col, 0.45)); halo.addColorStop(1, rgba(col, 0));
      g.fillStyle = halo; g.beginPath(); g.arc(0, 0, PS / 2, 0, PI2); g.fill();
      if (k === RAINBOW) {
        for (let a = 0; a < 6; a++) {
          g.fillStyle = COLORS[a];
          g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, a * PI2 / 6, (a + 1) * PI2 / 6); g.closePath(); g.fill();
        }
        g.fillStyle = 'rgba(13,17,23,0.55)';
        g.beginPath(); g.arc(0, 0, r * 0.58, 0, PI2); g.fill();
      } else {
        const body = g.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
        body.addColorStop(0, '#2D333B'); body.addColorStop(1, '#0F1319');
        g.fillStyle = body; g.beginPath(); g.arc(0, 0, r, 0, PI2); g.fill();
      }
      g.strokeStyle = shade(col, 0.4); g.lineWidth = 1;
      g.beginPath(); g.arc(0, 0, r - 0.5, 0, PI2); g.stroke();
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2; g.lineCap = 'round'; g.lineJoin = 'round';
      if (k === BOMB) {
        // bombe ronde, mèche, étincelle
        g.beginPath(); g.arc(-1, 2, 6.2, 0, PI2); g.fill();
        g.beginPath(); g.moveTo(3, -3); g.quadraticCurveTo(6, -8, 9, -7); g.stroke();
        g.fillStyle = '#FFF4D6';
        g.beginPath(); g.arc(9.5, -7.5, 1.8, 0, PI2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.beginPath(); g.arc(-3.5, -0.5, 1.6, 0, PI2); g.fill();
      } else if (k === RAINBOW) {
        g.strokeStyle = '#FFFFFF';
        g.beginPath(); g.arc(0, 0, 5, 0, PI2); g.stroke();
        g.beginPath(); g.moveTo(0, -8.5); g.lineTo(0, -6.5); g.moveTo(0, 8.5); g.lineTo(0, 6.5);
        g.moveTo(-8.5, 0); g.lineTo(-6.5, 0); g.moveTo(8.5, 0); g.lineTo(6.5, 0); g.stroke();
      } else {
        // laser : faisceau vertical et chevrons
        g.beginPath(); g.moveTo(0, 9); g.lineTo(0, -9); g.stroke();
        g.beginPath(); g.moveTo(-5, -3); g.lineTo(0, -9); g.lineTo(5, -3); g.stroke();
        g.beginPath(); g.moveTo(-5, 4); g.lineTo(0, -2); g.lineTo(5, 4); g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.ellipse(-r * 0.42, -r * 0.48, r * 0.2, r * 0.11, -0.7, 0, PI2); g.fill();
    }
    const PSPR = {};
    [BOMB, RAINBOW, LASER].forEach((k) => { PSPR[k] = sprite(PS, (g) => drawPower(g, k)); });

    /* ── Décor pré-rendu ─────────────────────────────────────────── */
    function layer(w, h, draw) {
      const c = document.createElement('canvas');
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(g);
      return c;
    }
    const bgLayer = layer(W, H, (g) => {
      g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = C.grid; g.lineWidth = 1;
      for (let x = 0; x <= W; x += 20) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
      for (let y = 0; y <= H; y += 20) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
      // zone de tir, sous la ligne de danger
      g.fillStyle = 'rgba(22,27,34,0.75)'; g.fillRect(LEFT, DANGER_Y, RIGHT - LEFT, H - DANGER_Y);
      // parois en blocs
      g.fillStyle = '#21262D';
      g.fillRect(0, 0, LEFT, H); g.fillRect(RIGHT, 0, W - RIGHT, H);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0; y < H; y += 16) { g.fillRect(0, y, LEFT, 1); g.fillRect(RIGHT, y, W - RIGHT, 1); }
      g.fillStyle = 'rgba(56,189,248,0.32)';
      g.fillRect(LEFT - 1, 0, 1, H); g.fillRect(RIGHT, 0, 1, H);
      // socle du lanceur
      g.fillStyle = '#1C2129';
      g.beginPath(); g.arc(LX, LY + 18, 38, Math.PI, 0); g.lineTo(LX + 38, H); g.lineTo(LX - 38, H); g.closePath(); g.fill();
      g.strokeStyle = C.line; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#262C35';
      for (let i = -2; i <= 2; i++) g.fillRect(LX + i * 14 - 5, H - 12, 10, 4);
      // case de la bulle suivante
      g.fillStyle = '#161B22';
      api.roundRect(g, NX - 30, NY - 30, 60, 52, 6); g.fill();
      g.strokeStyle = C.line; g.stroke();
      g.fillStyle = C.muted; g.font = '600 9px ' + api.font; g.textAlign = 'center';
      g.fillText(api.t('SUIVANTE', 'NEXT'), NX, NY - 19);
    });
    // plafond : briques alignées sur le bas, pour qu'elles glissent avec lui
    const CEIL_H = H;
    const ceilLayer = layer(W, CEIL_H, (g) => {
      g.fillStyle = '#1A1F27'; g.fillRect(0, 0, W, CEIL_H);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      let row = 0;
      for (let y = CEIL_H - 4; y > -14; y -= 14, row++) {
        g.fillRect(0, y - 1, W, 1);
        for (let x = (row & 1) ? 10 : 0; x < W; x += 40) g.fillRect(x, y - 14, 1, 14);
      }
      g.fillStyle = 'rgba(255,255,255,0.04)';
      for (let y = CEIL_H - 4; y > 0; y -= 28) g.fillRect(0, y - 13, W, 1);
      g.fillStyle = '#2D333B'; g.fillRect(0, CEIL_H - 4, W, 4);
      g.fillStyle = 'rgba(56,189,248,0.55)'; g.fillRect(0, CEIL_H - 1, W, 1);
      g.fillStyle = '#6E7681';
      for (let x = 20; x < W; x += 40) g.fillRect(x, CEIL_H - 3, 2, 2);
    });

    /* ── Grille hexagonale ───────────────────────────────────────── */
    // rangées impaires décalées d'un demi-diamètre, une bulle de moins
    const grid = [];
    for (let r = 0; r < MAXR; r++) grid.push(new Int8Array(COLS).fill(-1));
    const rowLen = (r) => ((r & 1) ? COLS - 1 : COLS);
    const colX = (r, c) => LEFT + R + c * D + ((r & 1) ? R : 0);
    const rowY = (r) => ceil + R + r * ROWH;
    const seen = new Uint8Array(MAXR * 32);
    const counts = new Int16Array(6);

    function neighbours(r, c, out) {
      out.length = 0;
      const odd = r & 1;
      const add = (rr, cc) => { if (rr >= 0 && rr < MAXR && cc >= 0 && cc < rowLen(rr)) out.push(rr * 32 + cc); };
      add(r, c - 1); add(r, c + 1);
      if (odd) { add(r - 1, c); add(r - 1, c + 1); add(r + 1, c); add(r + 1, c + 1); }
      else { add(r - 1, c - 1); add(r - 1, c); add(r + 1, c - 1); add(r + 1, c); }
      return out;
    }
    const nb = [];

    // première bulle touchée près de (x, y), ou -1 ; sans allocation
    function collide(x, y, thr2) {
      const r0 = Math.round((y - ceil - R) / ROWH);
      for (let r = r0 - 1; r <= r0 + 1; r++) {
        if (r < 0 || r >= MAXR) continue;
        const row = grid[r], len = rowLen(r);
        const c0 = Math.round((x - LEFT - R - ((r & 1) ? R : 0)) / D);
        for (let c = c0 - 1; c <= c0 + 1; c++) {
          if (c < 0 || c >= len || row[c] < 0) continue;
          const dx = colX(r, c) - x, dy = rowY(r) - y;
          if (dx * dx + dy * dy < thr2) return r * 32 + c;
        }
      }
      return -1;
    }

    function attached(r, c) {
      if (r === 0) return true;
      neighbours(r, c, nb);
      for (const n of nb) if (grid[n >> 5][n & 31] >= 0) return true;
      return false;
    }

    // case libre la plus proche, de préférence accrochée à quelque chose
    function snap(x, y) {
      const r0 = Math.max(0, Math.round((y - ceil - R) / ROWH));
      let best = -1, bestD = 1e9, bestA = false;
      for (let r = r0 - 1; r <= r0 + 1; r++) {
        if (r < 0 || r >= MAXR) continue;
        const len = rowLen(r);
        const c0 = Math.round((x - LEFT - R - ((r & 1) ? R : 0)) / D);
        for (let c = c0 - 1; c <= c0 + 1; c++) {
          if (c < 0 || c >= len || grid[r][c] >= 0) continue;
          const dx = colX(r, c) - x, dy = rowY(r) - y, d = dx * dx + dy * dy;
          const a = attached(r, c);
          if ((a && !bestA) || (a === bestA && d < bestD)) { best = r * 32 + c; bestD = d; bestA = a; }
        }
      }
      return best;
    }

    function flood(r, c, col) {
      seen.fill(0);
      const out = [], stack = [r * 32 + c];
      seen[r * 32 + c] = 1;
      while (stack.length) {
        const n = stack.pop(); out.push(n);
        neighbours(n >> 5, n & 31, nb);
        for (const m of nb) {
          if (!seen[m] && grid[m >> 5][m & 31] === col) { seen[m] = 1; stack.push(m); }
        }
      }
      return out;
    }

    function countColours() {
      counts.fill(0);
      let total = 0;
      for (let r = 0; r < MAXR; r++) for (let c = 0; c < rowLen(r); c++) {
        const k = grid[r][c]; if (k >= 0) { counts[k]++; total++; }
      }
      return total;
    }

    /* ── État ────────────────────────────────────────────────────── */
    let state, score, level, ceil, ceilTarget, aim, cur, nxt, shot, loadT, time;
    let shotsPerDrop, shotsLeft, sinceSpecial, ncol, clearT, overT, firstPower, hintUntil = 0, hintTimer = false;
    let pops = [], falls = [], labels = [], impact = { x: 0, y: 0, t: 9 };
    const keys = { left: false, right: false };
    const trail = new Float32Array(16); let trailN = 0, trailI = 0;
    const tp = new Float32Array(8); let tpN = 0, ghost = -1;

    function randomColour() {
      const total = countColours();
      if (total === 0) return Math.floor(Math.random() * ncol);
      let pick = Math.floor(Math.random() * 6), guard = 0;
      while (counts[pick] === 0 && guard++ < 30) pick = Math.floor(Math.random() * 6);
      if (counts[pick] === 0) for (let i = 0; i < 6; i++) if (counts[i]) { pick = i; break; }
      return pick;
    }

    function makeNext() {
      sinceSpecial++;
      if (sinceSpecial >= 7 && Math.random() < 0.15) {
        sinceSpecial = 0;
        const k = [BOMB, RAINBOW, LASER][Math.floor(Math.random() * 3)];
        // ramassage : carillon montant, éclat, étiquette flottante
        api.tone(660, 0.1, 'triangle', 0.4, 1.5);
        api.after(80, () => api.tone(990, 0.14, 'triangle', 0.4, 1.3));
        fx.burst(NX, NY + 4, { n: api.reduced ? 5 : 14, color: [POWERS[k].col, '#fff'], speed: 120, life: 0.5 });
        for (let i = labels.length - 1; i >= 0; i--) if (labels[i].x === NX + 6) labels.splice(i, 1);
        label(NX + 6, NY - 34, powName(k), POWERS[k].col, 1.3);
        if (!firstPower) {
          firstPower = true;
          hintUntil = time + 3;
        }
        return k;
      }
      return randomColour();
    }

    function refreshHand() {
      countColours();
      if (!isPower(cur) && counts[cur] === 0) cur = randomColour();
      if (!isPower(nxt) && counts[nxt] === 0) nxt = randomColour();
    }

    function updStatus() {
      if (state !== 'play') return;
      if (time < hintUntil) {
        api.status(api.t('Bonus ! Shift, X ou toucher la bulle suivante pour l\'échanger.', 'Power-up! Shift, X or tap the next bubble to swap it in.'));
        if (!hintTimer) { hintTimer = true; api.after((hintUntil - time) * 1000 + 50, () => { hintTimer = false; updStatus(); }); }
        return;
      }
      let s = api.t('Niveau ', 'Level ') + level + ' · ' +
        api.t('le plafond descend dans ', 'ceiling drops in ') + shotsLeft + (shotsLeft > 1 ? api.t(' tirs', ' shots') : api.t(' tir', ' shot'));
      const p = [];
      if (isPower(cur)) p.push(powName(cur));
      if (isPower(nxt) && nxt !== cur) p.push(powName(nxt));
      if (p.length) s += ' · ' + api.t('Bonus : ', 'Power-up: ') + p.join(', ');
      api.status(s);
    }

    function label(x, y, text, col, life) { labels.push({ x, y, text, col, t: 0, life: life || 0.9 }); }

    function buildLevel() {
      for (let r = 0; r < MAXR; r++) grid[r].fill(-1);
      ncol = level < 3 ? 5 : 6;
      const rows = Math.min(5 + level, 10);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < rowLen(r); c++) {
          let k = Math.floor(Math.random() * ncol);
          // grappes : reprendre souvent la couleur d'une voisine déjà posée
          if (Math.random() < 0.5) {
            neighbours(r, c, nb);
            const prev = nb.filter((n) => (n >> 5) < r || ((n >> 5) === r && (n & 31) < c)).map((n) => grid[n >> 5][n & 31]).filter((v) => v >= 0);
            if (prev.length) k = prev[Math.floor(Math.random() * prev.length)];
          }
          grid[r][c] = k;
        }
      }
      ceilTarget = CEIL0;
      ceil = CEIL0 - rows * ROWH - 40;      // la grille descend depuis le haut
      shotsPerDrop = Math.max(4, 9 - level);
      shotsLeft = shotsPerDrop;
      shot = null; trailN = 0;
      cur = randomColour(); nxt = randomColour();
      loadT = 1;
    }

    function reset() {
      score = 0; level = 1; time = 0; sinceSpecial = 2; clearT = 0; overT = 0; firstPower = false; hintUntil = 0;
      aim = -Math.PI / 2;
      pops.length = 0; falls.length = 0; labels.length = 0;
      fx.clear();
      buildLevel();
      api.hud({ score: 0 });
    }

    function start() {
      reset();
      state = 'play';
      updStatus();
      loop.start();
    }

    /* ── Tir ─────────────────────────────────────────────────────── */
    function fire() {
      if (state !== 'play' || shot || loadT < 1 || Math.abs(ceil - ceilTarget) > 3) return;
      const vx = Math.cos(aim) * SPEED, vy = Math.sin(aim) * SPEED;
      shot = { x: LX, y: LY, vx, vy, k: cur };
      trailN = 0;
      cur = nxt; nxt = makeNext(); loadT = 0;
      if (shot.k === LASER) api.tone(1400, 0.35, 'sawtooth', 0.14, 0.35);
      else api.tone(520, 0.07, 'square', 0.18, 1.6);
      updStatus();
    }

    function swap() {
      if (state !== 'play' || loadT < 1) return;
      const k = cur; cur = nxt; nxt = k;
      loadT = 0.35;
      api.sfx('flip');
      updStatus();
    }

    function popCell(n, ox, oy, delayBase) {
      const r = n >> 5, c = n & 31, k = grid[r][c];
      const x = colX(r, c), y = rowY(r);
      const d = Math.hypot(x - ox, y - oy);
      pops.push({ x, y, k, t: -(delayBase + d / D * 0.035), fired: false });
      grid[r][c] = -1;
    }

    function addScore(n, x, y, col) {
      score += n;
      api.hud({ score });
      label(x, y, '+' + n, col);
    }

    // après l'accroche ou le passage d'un bonus : ce qui pend dans le vide tombe
    function dropFloating() {
      seen.fill(0);
      const stack = [];
      for (let c = 0; c < COLS; c++) if (grid[0][c] >= 0) { seen[c] = 1; stack.push(c); }
      while (stack.length) {
        const n = stack.pop();
        neighbours(n >> 5, n & 31, nb);
        for (let i = 0; i < nb.length; i++) {
          const m = nb[i];
          if (!seen[m] && grid[m >> 5][m & 31] >= 0) { seen[m] = 1; stack.push(m); }
        }
      }
      let n = 0, sx = 0, sy = 0;
      for (let r = 0; r < MAXR; r++) for (let c = 0; c < rowLen(r); c++) {
        if (grid[r][c] >= 0 && !seen[r * 32 + c]) {
          const x = colX(r, c), y = rowY(r);
          falls.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 120, k: grid[r][c], rot: 0, vr: (Math.random() - 0.5) * 6 });
          grid[r][c] = -1; n++; sx += x; sy += y;
        }
      }
      if (n) {
        const pts = n * 20 * (n >= 5 ? 2 : 1);
        addScore(pts, sx / n, sy / n + 10, C.warm);
        api.after(140, () => api.tone(420, 0.22, 'triangle', 0.35, 0.5));
      }
      return n;
    }

    function popGroup(cells, ox, oy) {
      for (const n of cells) popCell(n, ox, oy, 0);
      const m = cells.length;
      addScore(m * 10 + Math.max(0, m - 3) * 10, ox, oy - 12, C.ink);
    }

    function attach(x, y) {
      const k = shot.k;
      shot = null;
      const n = snap(x, y);
      if (n < 0) { gameOver(); return; }
      const r = n >> 5, c = n & 31;
      const cx = colX(r, c), cy = rowY(r);
      impact.x = cx; impact.y = cy; impact.t = 0;

      if (k === BOMB) {
        // explosion : tout ce qui est dans le rayon disparaît
        const RAD = D * 2.15, RAD2 = RAD * RAD;
        const cells = [];
        for (let rr = 0; rr < MAXR; rr++) for (let cc = 0; cc < rowLen(rr); cc++) {
          if (grid[rr][cc] < 0) continue;
          const dx = colX(rr, cc) - cx, dy = rowY(rr) - cy;
          if (dx * dx + dy * dy <= RAD2) cells.push(rr * 32 + cc);
        }
        api.sfx('boom'); api.shake(6);
        fx.burst(cx, cy, { n: api.reduced ? 10 : 34, color: [C.warm, '#FFF4D6', C.bad], speed: 300, life: 0.7 });
        pops.push({ x: cx, y: cy, k: BOMB, t: 0, fired: true, ring: true });
        if (cells.length) popGroup(cells, cx, cy);
      } else if (k === RAINBOW) {
        neighbours(r, c, nb);
        const cols = [];
        for (const m of nb) { const v = grid[m >> 5][m & 31]; if (v >= 0 && cols.indexOf(v) < 0) cols.push(v); }
        const hit = new Set();
        let bestCol = -1, bestSize = 0;
        for (const col of cols) {
          grid[r][c] = col;
          const g = flood(r, c, col);
          if (g.length > bestSize) { bestSize = g.length; bestCol = col; }
          if (g.length >= 3) for (const m of g) hit.add(m);
        }
        if (hit.size) {
          grid[r][c] = cols[0];
          popGroup([...hit], cx, cy);
          [523, 659, 784].forEach((f, i) => api.after(i * 60, () => api.tone(f, 0.12, 'triangle', 0.35)));
        } else {
          // rien à faire éclater : elle prend la couleur de la plus grande grappe voisine
          grid[r][c] = bestCol >= 0 ? bestCol : randomColour();
          api.tone(300, 0.06, 'triangle', 0.3);
        }
      } else {
        grid[r][c] = k;
        const g = flood(r, c, k);
        if (g.length >= 3) popGroup(g, cx, cy);
        else api.tone(240, 0.06, 'triangle', 0.3, 0.8);
      }
      finishShot();
    }

    function finishShot() {
      dropFloating();
      const total = countColours();
      if (total === 0) { levelClear(); return; }
      shotsLeft--;
      if (shotsLeft <= 0) {
        shotsLeft = shotsPerDrop;
        ceilTarget += ROWH;
        api.tone(110, 0.28, 'sawtooth', 0.22, 0.7);
        api.shake(3);
        label(W / 2, Math.max(ceilTarget - 10, 24), api.t('Le plafond descend', 'Ceiling drops'), C.bad, 1.1);
      }
      if (lowestBottom(ceilTarget) > DANGER_Y) { gameOver(); return; }
      refreshHand();
      updStatus();
    }

    function lowestBottom(cy) {
      for (let r = MAXR - 1; r >= 0; r--) {
        const row = grid[r];
        for (let c = 0; c < rowLen(r); c++) if (row[c] >= 0) return cy + R + r * ROWH + R;
      }
      return 0;
    }

    function levelClear() {
      state = 'clear'; clearT = 0;
      const bonus = 1000 + (level - 1) * 500;
      score += bonus;
      api.hud({ score });
      api.setBest(score);
      api.unlock('bubbles_clear');
      api.sfx('win');
      fx.burst(W / 2, H / 2 - 60, { n: api.reduced ? 12 : 48, color: COLORS, speed: 340, life: 1 });
      clearBonus = bonus;
      api.status(api.t('Plateau nettoyé ! Bonus ', 'Board cleared! Bonus ') + bonus);
    }
    let clearBonus = 0;

    function gameOver() {
      if (state === 'over') return;
      state = 'over'; overT = 0; shot = null;
      api.sfx('lose'); api.shake(7);
      const record = api.setBest(score);
      api.status(api.t('Niveau atteint : ', 'Reached level: ') + level);
      api.after(1100, () => api.overlay({
        kicker: record && score > 0 ? api.t('Nouveau record', 'New best') : '',
        title: api.t('Partie terminée', 'Game over'),
        text: api.t(score + ' points, niveau ' + level, score + ' points, level ' + level),
        action: api.t('Rejouer', 'Play again'),
        tone: record && score > 0 ? 'good' : '',
        onAction: start,
      }));
    }

    /* ── Aperçu de visée : un rebond au plus ─────────────────────── */
    function trace() {
      let x = LX, y = LY, dx = Math.cos(aim), dy = Math.sin(aim);
      const laser = cur === LASER;
      tp[0] = x; tp[1] = y; tpN = 2; ghost = -1;
      let bounced = false, hit = false;
      for (let i = 0; i < 400; i++) {
        x += dx * 4; y += dy * 4;
        if (x < LEFT + R || x > RIGHT - R) {
          const wx = x < LEFT + R ? LEFT + R : RIGHT - R;
          if (bounced) { x = wx; break; }
          x = 2 * wx - x; dx = -dx; bounced = true;
          tp[tpN++] = wx; tp[tpN++] = y;
        }
        if (y - R <= ceil) { hit = true; break; }
        if (!laser && collide(x, y, HIT2) >= 0) { hit = true; break; }
      }
      tp[tpN++] = x; tp[tpN++] = y;
      if (hit && !laser) ghost = snap(x, y);
    }

    /* ── Boucle ──────────────────────────────────────────────────── */
    const loop = api.loop({
      update(dt) {
        time += dt;
        fx.update(dt);
        // plafond animé
        const dc = ceilTarget - ceil;
        if (Math.abs(dc) > 0.2) ceil += dc * Math.min(1, dt * (dc > 60 ? 5 : 9)); else ceil = ceilTarget;
        if (loadT < 1) loadT = Math.min(1, loadT + dt * 6);
        if (impact.t < 9) impact.t += dt;

        for (let i = labels.length - 1; i >= 0; i--) { const l = labels[i]; l.t += dt; if (l.t > l.life) labels.splice(i, 1); }
        for (let i = pops.length - 1; i >= 0; i--) {
          const p = pops[i];
          p.t += dt;
          if (!p.fired && p.t >= 0) {
            p.fired = true;
            fx.burst(p.x, p.y, { n: api.reduced ? 3 : 8, color: [COLORS[p.k] || C.warm, '#fff'], speed: 150, life: 0.45 });
            if (i % 3 === 0) api.tone(560 + (i % 9) * 45, 0.07, 'sine', 0.35, 1.6);
          }
          if (p.t > (p.ring ? 0.45 : 0.22)) pops.splice(i, 1);
        }
        for (let i = falls.length - 1; i >= 0; i--) {
          const f = falls[i];
          f.vy += 1500 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
          if (f.x < LEFT + R) { f.x = LEFT + R; f.vx = Math.abs(f.vx) * 0.6; }
          else if (f.x > RIGHT - R) { f.x = RIGHT - R; f.vx = -Math.abs(f.vx) * 0.6; }
          if (f.y > H + R) falls.splice(i, 1);
        }

        if (state === 'over') { overT += dt; return; }
        if (state === 'clear') {
          clearT += dt;
          if (clearT > 2.2) { level++; buildLevel(); state = 'play'; updStatus(); }
          return;
        }
        if (state !== 'play') return;

        if (keys.left) aim -= 1.7 * dt;
        if (keys.right) aim += 1.7 * dt;
        aim = api.clamp(aim, -Math.PI + AMIN, -AMIN);

        if (shot) {
          const s = shot;
          for (let sub = 0; sub < 2 && shot; sub++) {
            s.x += s.vx * dt / 2; s.y += s.vy * dt / 2;
            if (s.x < LEFT + R) { s.x = 2 * (LEFT + R) - s.x; s.vx = -s.vx; api.tone(380, 0.03, 'square', 0.12); }
            else if (s.x > RIGHT - R) { s.x = 2 * (RIGHT - R) - s.x; s.vx = -s.vx; api.tone(380, 0.03, 'square', 0.12); }
            if (s.k === LASER) {
              // le laser traverse tout ce qu'il croise
              let n;
              while ((n = collide(s.x, s.y, LASER2)) >= 0) {
                popCell(n, s.x, s.y, 0);
                s.hits = (s.hits || 0) + 1;
              }
              if (s.y - R <= ceil) {
                if (s.hits) addScore(s.hits * 15, s.x, s.y + 24, C.cyan);
                fx.burst(s.x, ceil + 4, { n: api.reduced ? 4 : 12, color: [C.cyan, '#fff'], speed: 160, life: 0.4 });
                shot = null; finishShot(); break;
              }
            } else if (s.y - R <= ceil || collide(s.x, s.y, HIT2) >= 0) {
              attach(s.x, s.y); break;
            }
          }
          if (shot) {
            trail[trailI * 2] = s.x; trail[trailI * 2 + 1] = s.y;
            trailI = (trailI + 1) & 7; if (trailN < 8) trailN++;
          }
        }
      },

      render() {
        ctx.drawImage(bgLayer, 0, 0, W, H);

        // plafond
        if (ceil > 0) ctx.drawImage(ceilLayer, 0, (CEIL_H - ceil) * dpr, W * dpr, ceil * dpr, 0, 0, W, ceil);

        // ligne de danger
        const low = state === 'play' ? lowestBottom(ceil) : 0;
        const near = low > DANGER_Y - ROWH * 2.2 ? 1 : 0;
        ctx.strokeStyle = near ? `rgba(255,123,114,${0.45 + 0.4 * Math.abs(Math.sin(time * 7))})` : 'rgba(255,123,114,0.25)';
        ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(LEFT, DANGER_Y); ctx.lineTo(RIGHT, DANGER_Y); ctx.stroke();
        ctx.setLineDash([]);

        // grille
        const ik = impact.t < 0.35 ? (1 - impact.t / 0.35) : 0;
        const deadRows = state === 'over' ? overT * 14 : -1;
        for (let r = 0; r < MAXR; r++) {
          const row = grid[r], y0 = rowY(r);
          if (y0 < -R) continue;
          const dead = deadRows >= 0 && (MAXR - 1 - r) < deadRows;
          for (let c = 0; c < rowLen(r); c++) {
            const k = row[c]; if (k < 0) continue;
            let x = colX(r, c), y = y0;
            if (ik > 0) {
              const dx = x - impact.x, dy = y - impact.y, d = Math.sqrt(dx * dx + dy * dy);
              if (d > 1 && d < D * 2.6) {
                const push = (1 - d / (D * 2.6)) * 3.2 * ik * Math.sin(impact.t * 30);
                x += dx / d * push; y += dy / d * push;
              }
            }
            const s = dead ? DEAD : SPR[k];
            ctx.drawImage(s.c, x - BS / 2, y - BS / 2, BS, BS);
          }
        }

        // case visée (fantôme) et pointillés
        if (state === 'play' && !shot && Math.abs(ceil - ceilTarget) < 3) {
          trace();
          const col = colOf(cur);
          ctx.fillStyle = col;
          let acc = (time * 42) % 13, total = 0;
          for (let i = 2; i < tpN; i += 2) {
            const ax = tp[i - 2], ay = tp[i - 1], bx = tp[i], by = tp[i + 1];
            const len = Math.hypot(bx - ax, by - ay);
            for (let d = acc; d < len; d += 13) {
              const k = (d) / len, a = 1 - Math.min(0.85, (total + d) / 650);
              ctx.globalAlpha = a * 0.85;
              ctx.fillRect(ax + (bx - ax) * k - 1.5, ay + (by - ay) * k - 1.5, 3, 3);
            }
            acc = (acc - len) % 13; if (acc < 0) acc += 13;
            total += len;
          }
          ctx.globalAlpha = 1;
          if (ghost >= 0) {
            const gx = colX(ghost >> 5, ghost & 31), gy = rowY(ghost >> 5);
            ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
            ctx.beginPath(); ctx.arc(gx, gy, cur === BOMB ? D * 2.15 : R - 1, 0, PI2); ctx.stroke();
            ctx.setLineDash([]); ctx.globalAlpha = 1;
          }
        }

        // lanceur : canon orienté
        ctx.save();
        ctx.translate(LX, LY);
        ctx.rotate(aim + Math.PI / 2);
        ctx.fillStyle = '#2D333B';
        ctx.fillRect(-6, -40, 12, 26);
        ctx.fillStyle = colOf(cur);
        ctx.fillRect(-6, -42, 12, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(-6, -40, 3, 26);
        ctx.restore();
        ctx.strokeStyle = C.line; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(LX, LY, R + 5, 0, PI2); ctx.stroke();

        // bulle courante (glisse depuis la case suivante) et suivante
        if (state === 'play' || state === 'clear') {
          const e = api.ease.out(loadT);
          drawK(cur, api.lerp(NX, LX, e), api.lerp(NY + 4, LY, e), 1, 0);
          if (loadT >= 1) drawK(nxt, NX, NY + 4, 0.82, 0);
        }

        // compteur avant descente du plafond : carrés à droite du lanceur
        if (state === 'play') {
          for (let i = 0; i < shotsPerDrop; i++) {
            const on = i < shotsLeft;
            ctx.fillStyle = on ? (shotsLeft <= 2 ? C.bad : C.muted) : '#262C35';
            ctx.fillRect(W - 30 - i * 11, H - 30, 7, 7);
          }
          ctx.fillStyle = C.faint; ctx.font = '600 9px ' + api.font; ctx.textAlign = 'right';
          ctx.fillText(api.t('PLAFOND', 'CEILING'), W - 23, H - 38);
          ctx.fillText(api.t('NIVEAU ', 'LEVEL ') + level, W - 23, H - 12);
        }

        // tir en vol : traînée
        if (shot) {
          const col = colOf(shot.k);
          if (shot.k === LASER) {
            ctx.strokeStyle = rgba(C.cyan, 0.35); ctx.lineWidth = 8; ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < trailN; i++) {
              const j = ((trailI - 1 - i) & 7) * 2;
              if (i === 0) ctx.moveTo(trail[j], trail[j + 1]); else ctx.lineTo(trail[j], trail[j + 1]);
            }
            ctx.stroke();
            ctx.strokeStyle = '#E0F6FF'; ctx.lineWidth = 2; ctx.stroke();
          } else {
            ctx.fillStyle = col;
            for (let i = 1; i < trailN; i++) {
              const j = ((trailI - 1 - i) & 7) * 2;
              ctx.globalAlpha = 0.28 * (1 - i / 8);
              ctx.beginPath(); ctx.arc(trail[j], trail[j + 1], R * (1 - i / 12), 0, PI2); ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
          drawK(shot.k, shot.x, shot.y, 1, time * 4);
        }

        // éclats
        for (const p of pops) {
          if (p.t < 0) {
            const s = SPR[p.k]; if (s) ctx.drawImage(s.c, p.x - BS / 2, p.y - BS / 2, BS, BS);
            continue;
          }
          if (p.ring) {
            const k = p.t / 0.45;
            ctx.globalAlpha = 1 - k; ctx.strokeStyle = C.warm; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(p.x, p.y, D * 2.15 * api.ease.out(k), 0, PI2); ctx.stroke();
            ctx.globalAlpha = 1;
            continue;
          }
          const k = p.t / 0.22, sc = 1 + k * 0.45;
          ctx.globalAlpha = 1 - k;
          const s = SPR[p.k], sz = BS * sc;
          ctx.drawImage(s.c, p.x - sz / 2, p.y - sz / 2, sz, sz);
          ctx.globalAlpha = 1;
        }
        // bulles qui tombent
        for (const f of falls) {
          const s = SPR[f.k];
          ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
          ctx.drawImage(s.c, -BS / 2, -BS / 2, BS, BS);
          ctx.restore();
        }

        fx.draw(ctx);

        // étiquettes flottantes
        ctx.textAlign = 'center';
        for (const l of labels) {
          const k = l.t / l.life;
          ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
          ctx.font = '700 14px ' + api.font;
          ctx.fillStyle = 'rgba(13,17,23,0.8)';
          ctx.fillText(l.text, l.x + 1, l.y - k * 26 + 1);
          ctx.fillStyle = l.col;
          ctx.fillText(l.text, l.x, l.y - k * 26);
        }
        ctx.globalAlpha = 1;

        // bandeau de fin de niveau
        if (state === 'clear') {
          const k = Math.min(1, clearT / 0.35), a = clearT > 1.8 ? Math.max(0, 1 - (clearT - 1.8) / 0.4) : 1;
          ctx.globalAlpha = a;
          ctx.fillStyle = 'rgba(13,17,23,0.82)';
          ctx.fillRect(LEFT, H / 2 - 110, RIGHT - LEFT, 92);
          ctx.fillStyle = C.good; ctx.fillRect(LEFT, H / 2 - 110, (RIGHT - LEFT) * k, 2); ctx.fillRect(RIGHT - (RIGHT - LEFT) * k, H / 2 - 20, (RIGHT - LEFT) * k, 2);
          ctx.textAlign = 'center';
          ctx.fillStyle = C.ink; ctx.font = '800 26px ' + api.font;
          ctx.fillText(api.t('Plateau nettoyé', 'Board cleared'), W / 2, H / 2 - 70 + (1 - api.ease.back(k)) * 12);
          ctx.fillStyle = C.good; ctx.font = '700 16px ' + api.font;
          ctx.fillText('+' + clearBonus + api.t(' · niveau ', ' · level ') + (level + 1), W / 2, H / 2 - 42);
          ctx.globalAlpha = 1;
        }
      },
    });

    function drawK(k, x, y, sc, rot) {
      if (isPower(k)) {
        const s = PSPR[k], sz = PS * sc;
        const pulse = k === BOMB ? 1 + Math.sin(time * 9) * 0.03 : 1;
        ctx.save(); ctx.translate(x, y);
        if (k === RAINBOW) ctx.rotate(time * 1.5);
        ctx.drawImage(s.c, -sz * pulse / 2, -sz * pulse / 2, sz * pulse, sz * pulse);
        ctx.restore();
      } else {
        const s = SPR[k], sz = BS * sc;
        ctx.drawImage(s.c, x - sz / 2, y - sz / 2, sz, sz);
      }
    }

    /* ── Entrées ─────────────────────────────────────────────────── */
    let pressing = false, onNext = false;
    function setAim(p) {
      const dy = Math.min(p.y - LY, -8);
      aim = api.clamp(Math.atan2(dy, p.x - LX), -Math.PI + AMIN, -AMIN);
    }
    api.on(cv.el, 'pointerdown', (e) => {
      const p = cv.toLocal(e.clientX, e.clientY);
      if (Math.hypot(p.x - NX, p.y - (NY + 4)) < 28) { onNext = true; swap(); return; }
      onNext = false; pressing = true;
      try { cv.el.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
      setAim(p);
    });
    api.on(cv.el, 'pointermove', (e) => {
      if (e.pointerType !== 'mouse' && !pressing) return;
      setAim(cv.toLocal(e.clientX, e.clientY));
    });
    api.on(cv.el, 'pointerup', (e) => {
      if (onNext) { onNext = false; return; }
      if (!pressing) return;
      pressing = false;
      setAim(cv.toLocal(e.clientX, e.clientY));
      fire();
    });
    api.on(cv.el, 'pointercancel', () => { pressing = false; onNext = false; });
    api.onKey((e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'q' || k === 'a') keys.left = true;
      else if (k === 'arrowright' || k === 'd') keys.right = true;
      else if (k === 'shift' || k === 'x') swap();
      else if (k === ' ' || k === 'arrowup' || k === 'z' || k === 'w' || k === 'enter') {
        if (state === 'play') fire();
        else if (state === 'over' && (k === ' ' || k === 'enter')) { api.hideOverlay(); start(); }
      }
    });
    api.on(document, 'keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'q' || k === 'a') keys.left = false;
      else if (k === 'arrowright' || k === 'd') keys.right = false;
    });

    // écran d'accueil : la grille est déjà en place
    reset();
    ceil = ceilTarget;
    state = 'ready';
    loop.start();
    api.overlay({
      title: api.t('Bulles', 'Bubbles'),
      text: api.t('Visez, faites rebondir, groupez trois bulles de même couleur. Ce qui ne tient plus au plafond tombe.', 'Aim, bank off the walls, match three of a colour. Anything cut off from the ceiling falls.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart: start };
  },
});

/* ==================================================================
   games/gems.js · Minerais (match-3 aux couleurs de Minecraft)
   Plateau 8x8 de blocs de minerai. On échange deux blocs voisins pour
   aligner trois minerais identiques ou plus. Chaque bloc est dessiné une
   seule fois en pixel art (pierre sombre, éclats colorés, symbole central
   de forme unique pour rester lisible sans les couleurs).
   Blocs spéciaux : 4 alignés donnent une TNT (explosion 3x3), 5 alignés
   une Balise (ligne et colonne), un L ou un T un Éclair (tout un minerai).
   Deux spéciaux échangés ensemble se combinent. 30 coups par partie.
   ================================================================== */
SBG.register('gems', {
  create(api) {
    const { C } = api;
    const N = 8, CELL = 48, BX = 12, BY = 84;
    const BW = N * CELL;
    const W = BX * 2 + BW, H = BY + BW + 12;
    const MOVES = 30, TARGET = 3000, GOAL = 5000, BAR_MAX = 6000;
    const PTS = 10;                          // points par bloc, x1.5, x2, x2.5... en cascade
    const BONUS = [0, 20, 50, 40];           // création : rien, TNT, Balise, Éclair
    const COMBO_BONUS = 100;
    const SWAP_T = 0.17, CLEAR_T = 0.2, HINT_DELAY = 6;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx, dpr = cv.dpr;
    cv.el.style.touchAction = 'none';
    ctx.imageSmoothingEnabled = false;

    /* ── Les six minerais : nom, palette (contour, ombre, teinte, reflet), forme ── */
    const ORES = [
      { fr: 'Diamant', en: 'Diamond', pal: ['#0B4F57', '#1FA8A8', '#4AEDD9', '#D6FFF9'], shape: 'rhomb' },
      { fr: 'Émeraude', en: 'Emerald', pal: ['#064A1E', '#0F9A44', '#2EE26F', '#C2FFD6'], shape: 'hex' },
      { fr: 'Or', en: 'Gold', pal: ['#5E4300', '#C79A12', '#FCDB4C', '#FFF6C4'], shape: 'ingot' },
      { fr: 'Redstone', en: 'Redstone', pal: ['#4F0707', '#B51515', '#FF3B30', '#FFB3A8'], shape: 'plus' },
      { fr: 'Lapis', en: 'Lapis', pal: ['#0E2366', '#2350C8', '#4F86FF', '#C3D6FF'], shape: 'orb' },
      { fr: 'Améthyste', en: 'Amethyst', pal: ['#3A1A66', '#8350D0', '#BE8CFF', '#F0E0FF'], shape: 'tri' },
    ];
    const BOLT_PAL = ['#3B2A08', '#D9A21B', '#FFE16B', '#FFFDE0'];
    const SPN = [null, ['TNT', 'TNT'], ['Balise', 'Beacon'], ['Éclair', 'Lightning']];
    const spName = (sp) => api.t(SPN[sp][0], SPN[sp][1]);

    /* ── Sprites pixel art (16x16 pixels logiques, pré-rendus) ───── */
    function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
    function newSprite() {
      const c = document.createElement('canvas');
      c.width = c.height = Math.round(CELL * dpr);
      const g = c.getContext('2d');
      const k = c.width / 16;
      g.setTransform(k, 0, 0, k, 0, 0);
      return { c, g };
    }
    function stone(g, rand, pal, hi, lo) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = rand();
        g.fillStyle = v < 0.18 ? pal[0] : v < 0.58 ? pal[1] : v < 0.9 ? pal[2] : pal[3];
        g.fillRect(x, y, 1, 1);
      }
      g.fillStyle = hi; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16);
      g.fillStyle = lo; g.fillRect(0, 15, 16, 1); g.fillRect(15, 0, 1, 16);
    }
    // éclats de minerai dans les marges, autour du symbole
    const SPOTS = [[1, 1], [12, 1], [1, 12], [13, 13], [6, 1], [1, 6], [13, 7], [7, 13]];
    function specks(g, rand, pal) {
      for (let i = 0; i < SPOTS.length; i++) {
        if (i > 3 && rand() < 0.45) continue;
        const [x, y] = SPOTS[i];
        const hz = rand() < 0.5;
        g.fillStyle = pal[2]; g.fillRect(x, y, hz ? 2 : 1, hz ? 1 : 2);
        g.fillStyle = pal[1]; g.fillRect(hz ? x + 1 : x + 1, hz ? y + 1 : y + 1, 1, 1);
      }
    }
    function inside(shape, x, y) {
      const ax = Math.abs(x), ay = Math.abs(y);
      switch (shape) {
        case 'rhomb': return ax + ay <= 0.98;
        case 'hex': return ax <= 0.62 && ay <= 0.98 && ax + ay * 0.55 <= 0.95;
        case 'ingot': return y >= -0.42 && y <= 0.62 && ax <= 0.66 + (y + 0.42) * 0.3;
        case 'plus': return (ax <= 0.32 && ay <= 0.98) || (ay <= 0.32 && ax <= 0.98);
        case 'orb': return x * x + y * y <= 0.86;
        case 'tri': return y <= 0.9 && y >= -0.98 && ax <= (y + 0.98) * 0.52;
      }
      return false;
    }
    // symbole central 10x10, contour sombre, éclairage venant d'en haut à gauche
    function icon(g, mask, pal) {
      const at = (i, j) => i >= 0 && j >= 0 && i < 10 && j < 10 && mask[j * 10 + i];
      g.fillStyle = 'rgba(0,0,0,0.4)';
      for (let j = 0; j < 10; j++) for (let i = 0; i < 10; i++) if (at(i, j)) g.fillRect(4 + i, 4 + j, 1, 1);
      let spec = false;
      for (let j = 0; j < 10; j++) for (let i = 0; i < 10; i++) {
        if (!at(i, j)) continue;
        const x = (i + 0.5) / 5 - 1, y = (j + 0.5) / 5 - 1;
        const edge = !at(i - 1, j) || !at(i + 1, j) || !at(i, j - 1) || !at(i, j + 1);
        const l = x * 0.6 + y;
        let col = edge ? pal[0] : l < -0.5 ? pal[3] : l > 0.45 ? pal[1] : pal[2];
        if (!edge && !spec && l < -0.5) { col = '#FFFFFF'; spec = true; }
        g.fillStyle = col; g.fillRect(3 + i, 3 + j, 1, 1);
      }
    }
    function shapeMask(shape) {
      const m = new Uint8Array(100);
      for (let j = 0; j < 10; j++) for (let i = 0; i < 10; i++) m[j * 10 + i] = inside(shape, (i + 0.5) / 5 - 1, (j + 0.5) / 5 - 1) ? 1 : 0;
      return m;
    }
    const STONE = ['#272C33', '#2F353D', '#373E47', '#424A55'];
    function oreSprite(k, sp) {
      const o = ORES[k];
      const { c, g } = newSprite();
      const rand = rng(97 + k * 31);
      stone(g, rand, STONE, '#535C68', '#171B20');
      specks(g, rand, o.pal);
      icon(g, shapeMask(o.shape), o.pal);
      if (sp === 1) {
        // TNT : cadre rayé rouge et blanc
        for (let i = 0; i < 16; i++) {
          g.fillStyle = (i >> 1) & 1 ? '#EDEDED' : '#D23B2A';
          g.fillRect(i, 0, 1, 1); g.fillRect(i, 15, 1, 1); g.fillRect(0, i, 1, 1); g.fillRect(15, i, 1, 1);
        }
        g.fillStyle = '#7A1A12';
        g.fillRect(1, 1, 14, 1); g.fillRect(1, 14, 14, 1); g.fillRect(1, 1, 1, 14); g.fillRect(14, 1, 1, 14);
      } else if (sp === 2) {
        // Balise : cadre de verre lumineux, émetteurs au milieu des côtés
        g.fillStyle = '#9BE9FF';
        g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
        g.fillStyle = 'rgba(56,189,248,0.55)';
        g.fillRect(1, 1, 14, 1); g.fillRect(1, 14, 14, 1); g.fillRect(1, 1, 1, 14); g.fillRect(14, 1, 1, 14);
        g.fillStyle = '#FFFFFF';
        g.fillRect(0, 0, 1, 1); g.fillRect(15, 0, 1, 1); g.fillRect(0, 15, 1, 1); g.fillRect(15, 15, 1, 1);
        g.fillRect(7, 0, 2, 1); g.fillRect(7, 15, 2, 1); g.fillRect(0, 7, 1, 2); g.fillRect(15, 7, 1, 2);
      }
      return c;
    }
    function boltSprite() {
      const { c, g } = newSprite();
      const rand = rng(4242);
      stone(g, rand, ['#130E1C', '#1A1427', '#221A33', '#2D2343'], '#45385E', '#0A070F');
      const vio = ['#3A1A66', '#8350D0', '#BE8CFF', '#F0E0FF'];
      specks(g, rand, vio);
      const B = [
        '......###.',
        '.....###..',
        '....###...',
        '...###....',
        '..#######.',
        '.....###..',
        '....###...',
        '...###....',
        '..##......',
        '.#........',
      ];
      const at = (i, j) => i >= 0 && j >= 0 && i < 10 && j < 10 && B[j][i] === '#';
      g.fillStyle = BOLT_PAL[0];
      for (let j = -1; j <= 10; j++) for (let i = -1; i <= 10; i++) {
        if (at(i, j)) continue;
        if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) g.fillRect(3 + i, 3 + j, 1, 1);
      }
      for (let j = 0; j < 10; j++) for (let i = 0; i < 10; i++) {
        if (!at(i, j)) continue;
        g.fillStyle = !at(i - 1, j) ? BOLT_PAL[3] : !at(i + 1, j) ? BOLT_PAL[1] : BOLT_PAL[2];
        g.fillRect(3 + i, 3 + j, 1, 1);
      }
      return c;
    }
    const SPR = ORES.map((o, k) => [oreSprite(k, 0), oreSprite(k, 1), oreSprite(k, 2)]);
    const LSPR = boltSprite();

    /* ── Décor pré-rendu : fond, bandeau, cadre et cases du plateau ── */
    const BAR_X = 104, BAR_Y = 44, BAR_W = W - BAR_X - 22, BAR_H = 10;
    const deco = document.createElement('canvas');
    deco.width = cv.el.width; deco.height = cv.el.height;
    {
      const g = deco.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = C.grid; g.lineWidth = 1;
      for (let x = 0; x <= W; x += 24) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
      for (let y = 0; y <= H; y += 24) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
      // bandeau du haut
      g.fillStyle = C.panel; api.roundRect(g, BX, 10, BW, 62, 8); g.fill();
      g.strokeStyle = C.line; g.stroke();
      g.fillStyle = C.line; g.fillRect(BX + 80, 20, 1, 42);
      // piste de la barre de score, repères objectif et 5000
      g.fillStyle = '#0D1117'; g.fillRect(BAR_X, BAR_Y, BAR_W, BAR_H);
      g.strokeStyle = 'rgba(240,246,252,0.14)'; g.strokeRect(BAR_X - 0.5, BAR_Y - 0.5, BAR_W + 1, BAR_H + 1);
      // plateau : cadre façon inventaire, cases en damier
      g.fillStyle = '#0A0D12'; g.fillRect(BX - 4, BY - 4, BW + 8, BW + 8);
      g.fillStyle = 'rgba(240,246,252,0.10)'; g.fillRect(BX - 4, BY + BW + 3, BW + 8, 1); g.fillRect(BX + BW + 3, BY - 4, 1, BW + 8);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        g.fillStyle = (r + c) & 1 ? '#10151C' : '#141A22';
        g.fillRect(BX + c * CELL, BY + r * CELL, CELL, CELL);
      }
    }

    /* ── Particules carrées (réserve pré-allouée, aucune allocation par image) ── */
    const PMAX = 700;
    const parts = [];
    for (let i = 0; i < PMAX; i++) parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, col: '#fff', s: 3 });
    let pNext = 0;
    function spark(x, y, col, sp, life, s) {
      const p = parts[pNext]; pNext = (pNext + 1) % PMAX;
      const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random() * 0.7);
      p.on = true; p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - sp * 0.4;
      p.life = p.max = life * (0.6 + Math.random() * 0.5); p.col = col; p.s = s;
    }
    function burstTile(t, cx, cy) {
      const pal = t.sp === 3 ? BOLT_PAL : ORES[t.k].pal;
      const n = api.reduced ? 3 : 8;
      for (let i = 0; i < n; i++) spark(cx + (Math.random() - 0.5) * 24, cy + (Math.random() - 0.5) * 24, i & 1 ? pal[2] : pal[3], 200, 0.6, 2 + (Math.random() * 3 | 0));
      if (!api.reduced) for (let i = 0; i < 3; i++) spark(cx, cy, STONE[3], 140, 0.5, 3);
    }

    /* ── Effets : anneaux de TNT, faisceaux de Balise, éclairs, lueurs ── */
    const effects = [];
    let lastBoom = 0, lastZap = 0;
    function addFx(type, x, y, delay, life, o) {
      const e = { type, x, y, t: -delay, life, size: 1, ang: 0, pts: null, col: C.ink, snd: '' };
      if (o) Object.assign(e, o);
      effects.push(e);
      return e;
    }
    function boltPts(x0, y0, x1, y1) {
      const p = new Float32Array(12);
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      for (let i = 0; i < 6; i++) {
        const k = i / 5, j = i === 0 || i === 5 ? 0 : (Math.random() - 0.5) * 18;
        p[i * 2] = x0 + dx * k + nx * j; p[i * 2 + 1] = y0 + dy * k + ny * j;
      }
      return p;
    }
    const labels = [];
    function addLabel(x, y, text, col, size, life) {
      labels.push({ x, y, text, col, size: size || 16, t: 0, life: life || 0.9 });
    }

    /* ── État ────────────────────────────────────────────────────── */
    const grid = new Array(N * N).fill(null);
    const mark = new Uint8Array(N * N), keep = new Uint8Array(N * N), dly = new Float32Array(N * N);
    const hRun = new Int16Array(N * N), vRun = new Int16Array(N * N);
    const Q = [], creates = [];
    let score, shown, moves, cascade, maxCascade, phase, pt, clearEnd, time, moving;
    let sel = -1, cursor = 27, kb = false, idleT = 0, hintA = -1, hintB = -1;
    let swapA = -1, swapB = -1, drag = -1, dsx = 0, dsy = 0, desel = false;
    let won, reached, finale, specialsMade;

    const cx = (i) => BX + (i % N) * CELL + CELL / 2;
    const cy = (i) => BY + ((i / N) | 0) * CELL + CELL / 2;
    const randKind = () => (Math.random() * ORES.length) | 0;
    function newTile(k) {
      return { k, sp: 0, x: 0, y: 0, tx: 0, ty: 0, mx0: 0, my0: 0, mt: 0, md: 0, me: 0, sq: 0, pop: 1, dead: false, cd: 0, burst: false, g: -1, used: false };
    }
    // kind d'une case pour les alignements (-1 : vide ou Éclair, qui n'a pas de couleur)
    function kindAt(i) { const t = grid[i]; return t && t.sp !== 3 ? t.k : -1; }
    function move(t, c, r, dur, delay, mode) {
      t.mx0 = t.x; t.my0 = t.y; t.tx = c; t.ty = r; t.mt = -delay; t.md = dur; t.me = mode;
    }
    function fall(t, c, r, delay) {
      const dist = Math.max(0, r - t.y);
      move(t, c, r, 0.12 + Math.sqrt(dist) * 0.085, delay, 1);
    }

    /* ── Recherche des alignements, regroupés en formes (ligne, L, T) ── */
    function findMatches() {
      const runs = [];
      hRun.fill(-1); vRun.fill(-1);
      for (let r = 0; r < N; r++) {
        let c = 0;
        while (c < N) {
          const k = kindAt(r * N + c);
          let e = c + 1;
          if (k >= 0) while (e < N && kindAt(r * N + e) === k) e++;
          if (k >= 0 && e - c >= 3) {
            const cells = [];
            for (let x = c; x < e; x++) { cells.push(r * N + x); hRun[r * N + x] = runs.length; }
            runs.push({ cells, k, h: true });
          }
          c = e;
        }
      }
      for (let c = 0; c < N; c++) {
        let r = 0;
        while (r < N) {
          const k = kindAt(r * N + c);
          let e = r + 1;
          if (k >= 0) while (e < N && kindAt(e * N + c) === k) e++;
          if (k >= 0 && e - r >= 3) {
            const cells = [];
            for (let y = r; y < e; y++) { cells.push(y * N + c); vRun[y * N + c] = runs.length; }
            runs.push({ cells, k, h: false });
          }
          r = e;
        }
      }
      const groups = [];
      if (!runs.length) return groups;
      const gid = new Int16Array(runs.length).fill(-1);
      const seen = new Uint8Array(N * N);
      for (let ri = 0; ri < runs.length; ri++) {
        if (gid[ri] >= 0) continue;
        const gp = { cells: [], k: runs[ri].k, maxLen: 0, h: false, v: false, cross: -1 };
        gid[ri] = groups.length;
        const stack = [ri];
        while (stack.length) {
          const run = runs[stack.pop()];
          gp.maxLen = Math.max(gp.maxLen, run.cells.length);
          if (run.h) gp.h = true; else gp.v = true;
          for (const cell of run.cells) {
            if (!seen[cell]) { seen[cell] = 1; gp.cells.push(cell); }
            const other = run.h ? vRun[cell] : hRun[cell];
            if (other >= 0) {
              gp.cross = cell;
              if (gid[other] < 0) { gid[other] = groups.length; stack.push(other); }
            }
          }
        }
        groups.push(gp);
      }
      return groups;
    }
    function lineAt(i) {
      const k = kindAt(i);
      if (k < 0) return false;
      const r = (i / N) | 0, c = i % N;
      let n = 1;
      for (let x = c - 1; x >= 0 && kindAt(r * N + x) === k; x--) n++;
      for (let x = c + 1; x < N && kindAt(r * N + x) === k; x++) n++;
      if (n >= 3) return true;
      n = 1;
      for (let y = r - 1; y >= 0 && kindAt(y * N + c) === k; y--) n++;
      for (let y = r + 1; y < N && kindAt(y * N + c) === k; y++) n++;
      return n >= 3;
    }
    function validSwap(a, b) {
      const ta = grid[a], tb = grid[b];
      if (!ta || !tb) return false;
      if ((ta.sp && tb.sp) || ta.sp === 3 || tb.sp === 3) return true;
      grid[a] = tb; grid[b] = ta;
      const ok = lineAt(a) || lineAt(b);
      grid[a] = ta; grid[b] = tb;
      return ok;
    }
    // tous les coups possibles, sous forme de paires à plat [a, b, a, b, ...]
    function findMoves() {
      const out = [];
      for (let i = 0; i < N * N; i++) {
        const c = i % N;
        if (c < N - 1 && validSwap(i, i + 1)) out.push(i, i + 1);
        if (i + N < N * N && validSwap(i, i + N)) out.push(i, i + N);
      }
      return out;
    }

    /* ── Vague de destruction : file d'attente, réactions en chaîne ── */
    function beginWave() {
      Q.length = 0; creates.length = 0;
      mark.fill(0); keep.fill(0);
    }
    function push(i, d, gather) {
      const t = grid[i];
      if (!t || keep[i]) return;
      if (!mark[i]) { mark[i] = 1; dly[i] = d; t.g = gather === undefined ? -1 : gather; Q.push(i); }
      else if (d < dly[i]) dly[i] = d;
    }
    const inB = (r, c) => r >= 0 && c >= 0 && r < N && c < N;
    function tnt(r, c, rad, d) {
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
        if (inB(r + dr, c + dc)) push((r + dr) * N + c + dc, d + 0.06 + (Math.abs(dr) + Math.abs(dc)) * 0.03);
      }
      addFx('ring', BX + c * CELL + CELL / 2, BY + r * CELL + CELL / 2, d, 0.42, { size: rad * 2 + 1, snd: 'boom' });
    }
    function beamRow(r, d, c0) {
      for (let c = 0; c < N; c++) push(r * N + c, d + 0.05 + Math.abs(c - c0) * 0.022);
      addFx('beamH', 0, BY + r * CELL + CELL / 2, d, 0.4, { snd: 'zap' });
    }
    function beamCol(c, d, r0) {
      for (let r = 0; r < N; r++) push(r * N + c, d + 0.05 + Math.abs(r - r0) * 0.022);
      addFx('beamV', BX + c * CELL + CELL / 2, 0, d, 0.4, { snd: 'zap' });
    }
    function beamDiag(r, c, d) {
      for (let k = -N; k <= N; k++) {
        if (inB(r + k, c + k)) push((r + k) * N + c + k, d + 0.05 + Math.abs(k) * 0.03);
        if (inB(r + k, c - k)) push((r + k) * N + c - k, d + 0.05 + Math.abs(k) * 0.03);
      }
      const x = BX + c * CELL + CELL / 2, y = BY + r * CELL + CELL / 2;
      addFx('diag', x, y, d, 0.4, { ang: Math.PI / 4 });
      addFx('diag', x, y, d, 0.4, { ang: -Math.PI / 4 });
    }
    function lightning(src, kind, d) {
      const x0 = cx(src), y0 = cy(src);
      let first = true;
      for (let j = 0; j < N * N; j++) {
        const t = grid[j];
        if (!t || t.sp === 3 || t.k !== kind || j === src) continue;
        const dist = Math.hypot((j % N) - (src % N), ((j / N) | 0) - ((src / N) | 0));
        push(j, d + 0.1 + dist * 0.02);
        addFx('bolt', x0, y0, d, 0.45, { pts: boltPts(x0, y0, cx(j), cy(j)), col: ORES[kind].pal[2], snd: first ? 'zap' : '' });
        first = false;
      }
      addFx('glow', x0, y0, d, 0.35, { col: '#FFF6C4' });
    }
    // minerai le plus présent parmi les blocs encore intacts
    function commonKind() {
      const cnt = [0, 0, 0, 0, 0, 0];
      for (let j = 0; j < N * N; j++) { const t = grid[j]; if (t && !mark[j] && t.sp !== 3) cnt[t.k]++; }
      let best = -1, bc = 0;
      for (let k = 0; k < cnt.length; k++) if (cnt[k] > bc) { bc = cnt[k]; best = k; }
      return best;
    }
    function activate(i, t, d) {
      const r = (i / N) | 0, c = i % N;
      if (t.sp === 1) tnt(r, c, 1, d);
      else if (t.sp === 2) { beamRow(r, d, c); beamCol(c, d, r); }
      else if (t.sp === 3) { const k = commonKind(); if (k >= 0) lightning(i, k, d); }
    }
    function processQueue() {
      for (let qi = 0; qi < Q.length; qi++) {
        const i = Q[qi], t = grid[i];
        if (t && t.sp && !t.used) { t.used = true; activate(i, t, dly[i]); }
      }
    }
    function commit(mult, bonus) {
      let n = 0, sx = 0, sy = 0, maxD = 0;
      for (let i = 0; i < N * N; i++) {
        if (!mark[i]) continue;
        const t = grid[i];
        t.dead = true; t.cd = dly[i]; t.burst = false;
        n++; sx += i % N; sy += (i / N) | 0;
        if (dly[i] > maxD) maxD = dly[i];
      }
      for (const cr of creates) bonus += BONUS[cr.sp];
      const gained = Math.round(n * PTS * mult) + bonus;
      score += gained;
      api.hud({ score });
      if (n) addLabel(BX + (sx / n + 0.5) * CELL, BY + (sy / n + 0.5) * CELL, '+' + gained, mult > 1 ? C.warm : C.ink, Math.min(26, 15 + mult * 2 + (gained > 300 ? 4 : 0)));
      // son d'alignement, plus aigu à chaque cascade
      const f = 392 * Math.pow(2, Math.min(cascade, 8) * 2 / 12);
      api.tone(f, 0.09, 'square', 0.22, 1.25);
      api.after(60, () => api.tone(f * 1.5, 0.1, 'square', 0.18, 1.2));
      if (!reached && score >= TARGET) {
        reached = true;
        api.status(api.t('Objectif atteint ! Visez ' + GOAL + ' points.', 'Target reached! Go for ' + GOAL + ' points.'));
        addLabel(W / 2, BY + BW / 2 - 30, api.t('Objectif atteint', 'Target reached'), C.good, 22, 1.4);
      }
      if (!won && score >= GOAL) {
        won = true;
        api.unlock('gems_5000');
        addLabel(W / 2, BY + BW / 2 + 10, api.t(GOAL + ' points !', GOAL + ' points!'), C.violet, 24, 1.6);
      }
      phase = 'clear'; pt = 0; clearEnd = maxD + CLEAR_T + 0.04;
    }

    function resolveMatches(groups) {
      beginWave();
      for (const gp of groups) {
        let sp = 0;
        if (gp.maxLen >= 5) sp = 2; else if (gp.h && gp.v) sp = 3; else if (gp.maxLen === 4) sp = 1;
        let spawn = -1;
        if (sp) {
          const ok = (i) => i >= 0 && gp.cells.indexOf(i) >= 0 && grid[i].sp === 0 && !keep[i];
          if (ok(swapB)) spawn = swapB;
          else if (ok(swapA)) spawn = swapA;
          else if (sp === 3 && ok(gp.cross)) spawn = gp.cross;
          else if (ok(gp.cells[gp.cells.length >> 1])) spawn = gp.cells[gp.cells.length >> 1];
          else for (const i of gp.cells) if (ok(i)) { spawn = i; break; }
          if (spawn >= 0) { keep[spawn] = 1; creates.push({ i: spawn, sp, k: gp.k }); }
        }
        for (const i of gp.cells) if (i !== spawn) push(i, 0, spawn);
      }
      processQueue();
      commit(1 + cascade * 0.5, 0);
    }

    // deux spéciaux échangés : t1 est le bloc déplacé, arrivé en i1
    function comboSpecial(i1, t1, i2, t2) {
      beginWave();
      const r = (i1 / N) | 0, c = i1 % N;
      const s1 = t1.sp, s2 = t2.sp;
      t1.used = t2.used = true;
      push(i1, 0); push(i2, 0);
      let name;
      if (s1 === 3 && s2 === 3) {
        // deux Éclairs : tout le plateau
        for (let j = 0; j < N * N; j++) push(j, 0.12 + Math.hypot((j % N) - c, ((j / N) | 0) - r) * 0.035);
        addFx('flash', 0, 0, 0, 0.6, { snd: 'boom' });
        name = api.t('Orage total', 'Total storm');
      } else if (s1 === 3 || s2 === 3) {
        // Éclair + TNT ou Balise : tous les blocs de ce minerai deviennent ce spécial
        const X = s1 === 3 ? t2 : t1, Li = s1 === 3 ? i1 : i2;
        X.used = false;
        for (let j = 0; j < N * N; j++) {
          const t = grid[j];
          if (t && t.sp === 0 && t.k === X.k) { t.sp = X.sp; t.used = false; addFx('glow', cx(j), cy(j), 0, 0.3, { col: '#FFFFFF' }); }
        }
        lightning(Li, X.k, 0.05);
        name = api.t('Tempête de ', 'Storm of ') + spName(X.sp);
      } else if (s1 === 1 && s2 === 1) {
        tnt(r, c, 2, 0);
        name = api.t('Méga TNT', 'Mega TNT');
      } else if (s1 === 2 && s2 === 2) {
        beamRow(r, 0, c); beamCol(c, 0, r); beamDiag(r, c, 0);
        name = api.t('Étoile', 'Star burst');
      } else {
        for (let d = -1; d <= 1; d++) {
          if (inB(r + d, 0)) beamRow(r + d, 0, c);
          if (inB(0, c + d)) beamCol(c + d, 0, r);
        }
        addFx('ring', cx(i1), cy(i1), 0, 0.42, { size: 3, snd: 'boom' });
        name = api.t('Croix de feu', 'Fire cross');
      }
      processQueue();
      addLabel(cx(i1), cy(i1) - 26, name, C.violet, 20, 1.2);
      commit(1, COMBO_BONUS);
      api.shake(6);
    }
    function lightningSwap(Li, L, kind) {
      beginWave();
      L.used = true;
      push(Li, 0);
      lightning(Li, kind, 0);
      processQueue();
      commit(1, 0);
    }

    function finishClear() {
      for (let i = 0; i < N * N; i++) if (mark[i]) { grid[i] = null; mark[i] = 0; }
      for (const cr of creates) {
        const t = grid[cr.i];
        if (!t) continue;
        t.sp = cr.sp; t.k = cr.sp === 3 ? 6 : cr.k; t.used = false; t.pop = 0;
        const x = cx(cr.i), y = cy(cr.i);
        addFx('glow', x, y, 0, 0.4, { col: '#FFFFFF' });
        const col = cr.sp === 1 ? C.bad : cr.sp === 2 ? C.cyan : '#FFE16B';
        for (let k = 0; k < (api.reduced ? 6 : 16); k++) spark(x, y, k & 1 ? col : '#FFFFFF', 240, 0.6, 3);
        addLabel(x, y - 20, spName(cr.sp), col, 17, 1.1);
        specialsMade++;
        // carillon montant
        api.tone(523, 0.1, 'triangle', 0.35);
        api.after(70, () => api.tone(784, 0.1, 'triangle', 0.35));
        api.after(140, () => api.tone(1046, 0.16, 'triangle', 0.35));
        if (!finale) api.status(cr.sp === 1 ? api.t('TNT : explose en 3x3 quand elle est alignée.', 'TNT: blows up a 3x3 area when matched.')
          : cr.sp === 2 ? api.t('Balise : vide sa ligne et sa colonne quand elle est alignée.', 'Beacon: clears its row and column when matched.')
            : api.t('Éclair : échangez-le avec un bloc pour effacer tout ce minerai.', 'Lightning: swap it with a block to clear every ore of that kind.'));
      }
      creates.length = 0; keep.fill(0);
      gravity();
    }

    function gravity() {
      for (let c = 0; c < N; c++) {
        let w = N - 1;
        for (let r = N - 1; r >= 0; r--) {
          const t = grid[r * N + c];
          if (!t) continue;
          if (r !== w) { grid[w * N + c] = t; grid[r * N + c] = null; fall(t, c, w, c * 0.012); }
          w--;
        }
        const miss = w + 1;
        for (let r = w; r >= 0; r--) {
          const t = newTile(randKind());
          t.x = c; t.y = r - miss - 0.35;
          grid[r * N + c] = t;
          fall(t, c, r, c * 0.012 + 0.03);
        }
      }
      phase = 'fall';
    }

    function afterFall() {
      const groups = findMatches();
      if (groups.length) {
        cascade++;
        if (cascade + 1 > maxCascade) maxCascade = cascade + 1;
        resolveMatches(groups);
      } else settle();
    }

    function settle() {
      cascade = 0; swapA = swapB = -1;
      if (moves <= 0) {
        // bouquet final : les spéciaux restants sautent tous
        let n = 0;
        for (let i = 0; i < N * N; i++) if (grid[i] && grid[i].sp) n++;
        if (n) {
          if (!finale) {
            finale = true;
            addLabel(W / 2, BY + BW / 2, api.t('Bouquet final', 'Grand finale'), C.warm, 24, 1.4);
            api.status(api.t('Plus de coups : les blocs spéciaux restants explosent.', 'Out of moves: the remaining special blocks go off.'));
          }
          beginWave();
          let k = 0;
          for (let i = 0; i < N * N; i++) if (grid[i] && grid[i].sp) push(i, (k++) * 0.16);
          processQueue();
          commit(1, 0);
          return;
        }
        gameOver();
        return;
      }
      if (!findMoves().length) { reshuffle(); return; }
      phase = 'idle'; idleT = 0; hintA = hintB = -1;
    }

    function reshuffle() {
      const tiles = grid.slice();
      let ok = false;
      for (let tries = 0; tries < 300 && !ok; tries++) {
        for (let i = tiles.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const x = tiles[i]; tiles[i] = tiles[j]; tiles[j] = x; }
        for (let i = 0; i < N * N; i++) grid[i] = tiles[i];
        ok = !findMatches().length && findMoves().length > 0;
      }
      if (!ok) fillKinds();
      for (let i = 0; i < N * N; i++) move(grid[i], i % N, (i / N) | 0, 0.5, ((i % N) + ((i / N) | 0)) * 0.012, 0);
      addLabel(W / 2, BY + BW / 2, api.t('Plus de coups : on remélange', 'No moves left: shuffling'), C.cyan, 18, 1.4);
      api.sfx('flip');
      phase = 'shuffle';
    }
    // tire de nouveaux minerais sans alignement, avec au moins quelques coups
    function fillKinds() {
      for (let tries = 0; tries < 60; tries++) {
        for (let i = 0; i < N * N; i++) {
          const t = grid[i];
          if (t.sp) continue;
          const r = (i / N) | 0, c = i % N;
          let k, guard = 0;
          do { k = randKind(); t.k = k; guard++; }
          while (guard < 30 && ((c >= 2 && kindAt(i - 1) === k && kindAt(i - 2) === k) || (r >= 2 && kindAt(i - N) === k && kindAt(i - 2 * N) === k)));
        }
        if (!findMatches().length && findMoves().length >= 5) return;
      }
    }

    /* ── Échange ─────────────────────────────────────────────────── */
    function adjacent(a, b) {
      if (a < 0 || b < 0) return false;
      const d = Math.abs(a - b);
      return (d === 1 && ((a / N) | 0) === ((b / N) | 0)) || d === N;
    }
    function trySwap(a, b) {
      if (phase !== 'idle' || !adjacent(a, b) || !grid[a] || !grid[b]) return false;
      swapA = a; swapB = b;
      move(grid[a], b % N, (b / N) | 0, SWAP_T, 0, 0);
      move(grid[b], a % N, (a / N) | 0, SWAP_T, 0, 0);
      hintA = hintB = -1; idleT = 0;
      phase = 'swap';
      api.sfx('move');
      return true;
    }
    function useMove() {
      moves--;
      if (moves === 5) api.status(api.t('Plus que 5 coups.', 'Only 5 moves left.'));
    }
    function afterSwap() {
      const a = swapA, b = swapB;
      const ta = grid[a], tb = grid[b];
      grid[a] = tb; grid[b] = ta;            // ta est maintenant en b, tb en a
      cascade = 0;
      if (ta.sp && tb.sp) { useMove(); comboSpecial(b, ta, a, tb); return; }
      if (ta.sp === 3 || tb.sp === 3) {
        useMove();
        if (ta.sp === 3) lightningSwap(b, ta, tb.k); else lightningSwap(a, tb, ta.k);
        return;
      }
      const groups = findMatches();
      if (!groups.length) {
        grid[a] = ta; grid[b] = tb;
        move(ta, a % N, (a / N) | 0, SWAP_T, 0.03, 0);
        move(tb, b % N, (b / N) | 0, SWAP_T, 0.03, 0);
        phase = 'back';
        api.sfx('error');
        return;
      }
      useMove();
      resolveMatches(groups);
    }

    /* ── Partie ──────────────────────────────────────────────────── */
    function reset() {
      score = 0; shown = 0; moves = MOVES; cascade = 0; maxCascade = 1; pt = 0; time = 0; moving = 0;
      sel = -1; hintA = hintB = -1; idleT = 0; swapA = swapB = -1; drag = -1;
      won = false; reached = false; finale = false; specialsMade = 0;
      effects.length = 0; labels.length = 0;
      for (const p of parts) p.on = false;
      for (let i = 0; i < N * N; i++) grid[i] = newTile(0);
      fillKinds();
      api.hud({ score: 0 });
    }
    function start() {
      api.hideOverlay();
      reset();
      // les blocs tombent du ciel, colonne par colonne
      for (let i = 0; i < N * N; i++) {
        const t = grid[i], r = (i / N) | 0, c = i % N;
        t.x = c; t.y = r - N - 0.5;
        fall(t, c, r, c * 0.035 + (N - 1 - r) * 0.025);
      }
      phase = 'fall';
      api.status(api.t('Objectif : ' + TARGET + ' points en ' + MOVES + ' coups.', 'Target: ' + TARGET + ' points in ' + MOVES + ' moves.'));
      loop.start();
    }
    function gameOver() {
      phase = 'over';
      sel = -1; hintA = hintB = -1;
      const good = score >= TARGET;
      api.sfx(good ? 'win' : 'lose');
      const record = api.setBest(score);
      api.status(api.t('Plus longue cascade : ' + maxCascade + ', blocs spéciaux : ' + specialsMade, 'Longest cascade: ' + maxCascade + ', special blocks: ' + specialsMade));
      api.after(600, () => api.overlay({
        kicker: record && score > 0 ? api.t('Nouveau record', 'New best') : '',
        title: good ? api.t('Objectif atteint', 'Target reached') : api.t('Plus de coups', 'Out of moves'),
        text: api.t(score + ' points, plus longue cascade : ' + maxCascade, score + ' points, longest cascade: ' + maxCascade),
        action: api.t('Rejouer', 'Play again'),
        tone: record && score > 0 ? 'good' : '',
        onAction: start,
      }));
    }

    /* ── Boucle ──────────────────────────────────────────────────── */
    const loop = api.loop({
      update(dt) {
        time += dt;
        // déplacements des blocs (échange, chute, mélange)
        moving = 0;
        for (let i = 0; i < N * N; i++) {
          const t = grid[i];
          if (!t) continue;
          if (t.md > 0) {
            t.mt += dt;
            if (t.mt > 0) {
              const k = Math.min(1, t.mt / t.md);
              const e = t.me === 1 ? k * k : api.ease.inOut(k);
              t.x = t.mx0 + (t.tx - t.mx0) * e;
              t.y = t.my0 + (t.ty - t.my0) * e;
              if (k >= 1) { t.md = 0; t.x = t.tx; t.y = t.ty; if (t.me === 1) t.sq = 1; }
            }
            if (t.md > 0) moving++;
          }
          if (t.sq > 0) t.sq = Math.max(0, t.sq - dt * 6);
          if (t.pop < 1) t.pop = Math.min(1, t.pop + dt * 3.5);
        }
        // particules, effets, étiquettes
        for (let i = 0; i < PMAX; i++) {
          const p = parts[i];
          if (!p.on) continue;
          p.life -= dt;
          if (p.life <= 0) { p.on = false; continue; }
          p.vy += 820 * dt; p.vx *= 1 - 1.5 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
        }
        for (let i = effects.length - 1; i >= 0; i--) {
          const e = effects[i];
          const before = e.t;
          e.t += dt;
          if (before < 0 && e.t >= 0 && e.snd) {
            if (e.snd === 'boom' && time - lastBoom > 0.09) { lastBoom = time; api.sfx('boom'); api.shake(4); }
            else if (e.snd === 'zap' && time - lastZap > 0.07) { lastZap = time; api.tone(1400, 0.22, 'sawtooth', 0.12, 0.25); }
          }
          if (e.t > e.life) effects.splice(i, 1);
        }
        for (let i = labels.length - 1; i >= 0; i--) { labels[i].t += dt; if (labels[i].t > labels[i].life) labels.splice(i, 1); }
        shown += (score - shown) * Math.min(1, dt * 9);
        if (score - shown < 0.5) shown = score;

        if (phase === 'swap') { if (!moving) afterSwap(); }
        else if (phase === 'back') { if (!moving) phase = 'idle'; }
        else if (phase === 'clear') {
          pt += dt;
          for (let i = 0; i < N * N; i++) {
            const t = grid[i];
            if (t && t.dead && !t.burst && pt >= t.cd) { t.burst = true; burstTile(t, cx(i), cy(i)); }
          }
          if (pt >= clearEnd) finishClear();
        }
        else if (phase === 'fall') { if (!moving) afterFall(); }
        else if (phase === 'shuffle') { if (!moving) settle(); }
        else if (phase === 'idle') {
          idleT += dt;
          if (idleT > HINT_DELAY && hintA < 0) {
            const mv = findMoves();
            if (mv.length) { const k = ((Math.random() * mv.length / 2) | 0) * 2; hintA = mv[k]; hintB = mv[k + 1]; }
          }
        }
      },
      render() {
        ctx.drawImage(deco, 0, 0, W, H);
        drawHud();

        ctx.save();
        ctx.beginPath(); ctx.rect(BX, BY, BW, BW); ctx.clip();
        drawTiles(0);
        drawTiles(1);
        drawEffects();
        ctx.restore();

        // sélection et curseur clavier
        if (sel >= 0 && grid[sel]) brackets(sel, '#FFFFFF', 1 + Math.sin(time * 8) * 1.5);
        if (kb && cursor !== sel && phase !== 'over') brackets(cursor, C.cyan, 0);

        // particules carrées
        for (let i = 0; i < PMAX; i++) {
          const p = parts[i];
          if (!p.on) continue;
          ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5);
          ctx.fillStyle = p.col;
          ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
        }
        ctx.globalAlpha = 1;

        // points et annonces
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        for (const l of labels) {
          const k = l.t / l.life;
          ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
          ctx.font = '800 ' + l.size + 'px ' + api.font;
          const y = l.y - api.ease.out(Math.min(1, k * 1.4)) * 22;
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(13,17,23,0.9)';
          ctx.strokeText(l.text, l.x, y);
          ctx.fillStyle = l.col; ctx.fillText(l.text, l.x, y);
        }
        ctx.globalAlpha = 1;
      },
    });

    function drawHud() {
      ctx.textAlign = 'left';
      ctx.fillStyle = C.muted; ctx.font = '600 10px ' + api.font;
      ctx.fillText(api.t('COUPS', 'MOVES'), BX + 16, 31);
      ctx.fillStyle = moves <= 5 && phase !== 'over' ? (moves <= 2 ? C.bad : C.warm) : C.ink;
      ctx.font = '800 28px ' + api.font;
      ctx.fillText(String(moves), BX + 16, 61);

      ctx.fillStyle = C.muted; ctx.font = '600 10px ' + api.font;
      ctx.fillText(api.t('OBJECTIF ', 'TARGET ') + TARGET, BAR_X, 34);
      ctx.textAlign = 'right';
      ctx.fillStyle = C.ink; ctx.font = '800 15px ' + api.font;
      ctx.fillText(String(Math.round(shown)), BAR_X + BAR_W, 36);
      // barre de progression, découpée en pixels
      const k = Math.min(1, shown / BAR_MAX);
      const fw = Math.floor(BAR_W * k / 4) * 4;
      ctx.fillStyle = shown >= GOAL ? C.violet : shown >= TARGET ? C.good : C.cyan;
      ctx.fillRect(BAR_X, BAR_Y, fw, BAR_H);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(BAR_X, BAR_Y, fw, 2);
      // repères : objectif et 5000
      const tx = BAR_X + BAR_W * TARGET / BAR_MAX, gx = BAR_X + BAR_W * GOAL / BAR_MAX;
      ctx.fillStyle = shown >= TARGET ? '#FFFFFF' : C.good;
      ctx.fillRect(tx - 1, BAR_Y - 3, 2, BAR_H + 6);
      ctx.fillStyle = shown >= GOAL ? '#FFFFFF' : C.violet;
      ctx.fillRect(gx - 2, BAR_Y - 5, 4, 2); ctx.fillRect(gx - 3, BAR_Y - 3, 6, 2); ctx.fillRect(gx - 2, BAR_Y - 1, 4, 2); ctx.fillRect(gx - 1, BAR_Y + 1, 2, 2);
      // ligne du bas : cascade en cours ou rappel
      ctx.textAlign = 'left'; ctx.font = '700 11px ' + api.font;
      if (cascade > 0 && phase !== 'idle') {
        ctx.fillStyle = C.warm;
        ctx.fillText(api.t('Cascade ', 'Cascade ') + (cascade + 1) + '   x' + (1 + cascade * 0.5), BAR_X, 68);
      } else {
        ctx.fillStyle = C.faint;
        ctx.fillText(api.t('4 : TNT   5 : Balise   L ou T : Éclair', '4: TNT   5: Beacon   L or T: Lightning'), BAR_X, 68);
      }
    }

    function drawTiles(pass) {
      for (let i = 0; i < N * N; i++) {
        const t = grid[i];
        if (!t) continue;
        if ((t.md > 0 ? 1 : 0) !== pass) continue;
        let x = BX + t.x * CELL, y = BY + t.y * CELL;
        if (y < BY - CELL) continue;
        let s = 1, a = 1, white = 0;
        if (t.dead) {
          const cl = pt - t.cd;
          if (cl > 0) {
            const k = Math.min(1, cl / CLEAR_T);
            s = 1 - k * k; a = 1 - k * 0.5;
            if (t.g >= 0) { x += (BX + (t.g % N) * CELL - x) * k * 0.75; y += (BY + ((t.g / N) | 0) * CELL - y) * k * 0.75; }
            white = Math.max(0, 0.6 - k);
          } else if (cl > -0.1) white = (cl + 0.1) * 4;
          if (s <= 0.01) continue;
        }
        if (t.pop < 1) s *= 0.3 + 0.7 * api.ease.back(t.pop);
        if (i === sel && !t.dead) s *= 1.07 + Math.sin(time * 8) * 0.02;
        if ((i === hintA || i === hintB) && phase === 'idle') { const h = Math.abs(Math.sin(time * 3.2)); s *= 1 + h * 0.05; white = h * 0.14; }
        const sqy = 1 - 0.14 * t.sq, sqx = 1 + 0.09 * t.sq;
        const w = CELL * s * sqx, h = CELL * s * sqy;
        const dx = x + (CELL - w) / 2, dy = y + (CELL + CELL * s) / 2 - h;
        ctx.globalAlpha = a;
        ctx.drawImage(t.sp === 3 ? LSPR : SPR[t.k][t.sp], dx, dy, w, h);
        if (t.sp && !t.dead) decorate(t, dx, dy, w, h);
        if (white > 0) {
          ctx.globalAlpha = Math.min(1, white) * a;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(dx, dy, w, h);
        }
        ctx.globalAlpha = 1;
      }
    }
    // animations propres aux blocs spéciaux
    function decorate(t, x, y, w, h) {
      const u = w / 16;
      if (t.sp === 1) {
        // mèche qui crépite en haut
        const f = (time * 14) | 0;
        ctx.fillStyle = f & 1 ? '#FFFFFF' : C.warm;
        ctx.fillRect(x + w / 2 - u, y + u * 2, u * 2, u * 2);
        if (f % 3 === 0) { ctx.fillStyle = '#FFE16B'; ctx.fillRect(x + w / 2 + u, y + u, u, u); }
      } else if (t.sp === 2) {
        // émetteurs qui pulsent
        ctx.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(time * 3));
        ctx.fillStyle = '#E0FAFF';
        ctx.fillRect(x + w / 2 - u * 0.5, y, u, u * 2.5); ctx.fillRect(x + w / 2 - u * 0.5, y + h - u * 2.5, u, u * 2.5);
        ctx.fillRect(x, y + h / 2 - u * 0.5, u * 2.5, u); ctx.fillRect(x + w - u * 2.5, y + h / 2 - u * 0.5, u * 2.5, u);
        ctx.globalAlpha = 1;
      } else if (t.sp === 3) {
        // cadre qui passe par toutes les couleurs de minerai
        ctx.strokeStyle = ORES[((time * 6) | 0) % ORES.length].pal[2];
        ctx.lineWidth = u;
        ctx.strokeRect(x + u / 2, y + u / 2, w - u, h - u);
      }
    }
    function brackets(i, col, off) {
      const x = BX + (i % N) * CELL - off, y = BY + ((i / N) | 0) * CELL - off, s = CELL + off * 2, l = 12, th = 3;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, l, th); ctx.fillRect(x, y, th, l);
      ctx.fillRect(x + s - l, y, l, th); ctx.fillRect(x + s - th, y, th, l);
      ctx.fillRect(x, y + s - th, l, th); ctx.fillRect(x, y + s - l, th, l);
      ctx.fillRect(x + s - l, y + s - th, l, th); ctx.fillRect(x + s - th, y + s - l, th, l);
    }
    function drawEffects() {
      for (const e of effects) {
        if (e.t < 0) continue;
        const k = e.t / e.life, inv = 1 - k;
        if (e.type === 'ring') {
          const sz = CELL * e.size * (0.5 + 0.6 * api.ease.out(k));
          if (k < 0.35) { ctx.globalAlpha = (0.35 - k) * 1.6; ctx.fillStyle = '#FFF2D6'; ctx.fillRect(e.x - sz / 2, e.y - sz / 2, sz, sz); }
          ctx.globalAlpha = inv;
          ctx.strokeStyle = C.warm; ctx.lineWidth = 2 + 5 * inv;
          ctx.strokeRect(e.x - sz / 2, e.y - sz / 2, sz, sz);
        } else if (e.type === 'beamH' || e.type === 'beamV' || e.type === 'diag') {
          const th = CELL * 0.85 * inv;
          ctx.globalAlpha = 0.75 * inv;
          if (e.type === 'diag') { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.ang); }
          for (let p = 0; p < 2; p++) {
            const tt = p ? th * 0.32 : th;
            ctx.fillStyle = p ? '#FFFFFF' : C.cyan;
            if (e.type === 'beamH') ctx.fillRect(BX, e.y - tt / 2, BW, tt);
            else if (e.type === 'beamV') ctx.fillRect(e.x - tt / 2, BY, tt, BW);
            else ctx.fillRect(-BW * 1.5, -tt / 2, BW * 3, tt);
          }
          if (e.type === 'diag') ctx.restore();
        } else if (e.type === 'bolt') {
          ctx.globalAlpha = inv;
          ctx.lineJoin = 'miter';
          for (let p = 0; p < 2; p++) {
            ctx.strokeStyle = p ? '#FFFFFF' : e.col; ctx.lineWidth = p ? 1.5 : 4;
            ctx.beginPath(); ctx.moveTo(e.pts[0], e.pts[1]);
            for (let j = 2; j < 12; j += 2) ctx.lineTo(e.pts[j], e.pts[j + 1]);
            ctx.stroke();
          }
        } else if (e.type === 'glow') {
          ctx.globalAlpha = inv * 0.8;
          ctx.fillStyle = e.col;
          const sz = CELL * (1 + k * 0.4);
          ctx.fillRect(e.x - sz / 2, e.y - sz / 2, sz, sz);
        } else if (e.type === 'flash') {
          ctx.globalAlpha = inv * 0.55;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(BX, BY, BW, BW);
        }
      }
      ctx.globalAlpha = 1;
    }

    /* ── Entrées : clic-clic, glisser, clavier ───────────────────── */
    function cellAt(e) {
      const p = cv.toLocal(e.clientX, e.clientY);
      const c = Math.floor((p.x - BX) / CELL), r = Math.floor((p.y - BY) / CELL);
      return { i: inB(r, c) ? r * N + c : -1, x: p.x, y: p.y };
    }
    function poke() { idleT = 0; hintA = hintB = -1; }
    api.on(cv.el, 'pointerdown', (e) => {
      if (phase === 'ready' || phase === 'over') return;
      const p = cellAt(e);
      kb = false; poke();
      if (p.i < 0) { sel = -1; return; }
      cursor = p.i;
      if (cv.el.setPointerCapture) { try { cv.el.setPointerCapture(e.pointerId); } catch (err) { /* rien */ } }
      if (sel >= 0 && adjacent(sel, p.i) && phase === 'idle') {
        trySwap(sel, p.i); sel = -1; drag = -1;
        return;
      }
      desel = sel === p.i;
      sel = p.i; drag = p.i; dsx = p.x; dsy = p.y;
      api.sfx('tick');
    });
    api.on(cv.el, 'pointermove', (e) => {
      if (drag < 0) return;
      const p = cv.toLocal(e.clientX, e.clientY);
      const dx = p.x - dsx, dy = p.y - dsy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL * 0.4) return;
      const r = (drag / N) | 0, c = drag % N;
      const horiz = Math.abs(dx) > Math.abs(dy);
      const nr = r + (horiz ? 0 : dy > 0 ? 1 : -1), nc = c + (horiz ? (dx > 0 ? 1 : -1) : 0);
      if (inB(nr, nc) && trySwap(drag, nr * N + nc)) sel = -1;
      drag = -1;
    });
    const endDrag = () => { if (drag >= 0 && desel) sel = -1; drag = -1; desel = false; };
    api.on(cv.el, 'pointerup', endDrag);
    api.on(cv.el, 'pointercancel', endDrag);

    const DIRS = { ArrowUp: -N, ArrowDown: N, ArrowLeft: -1, ArrowRight: 1, z: -N, w: -N, s: N, q: -1, a: -1, d: 1 };
    api.onKey((e) => {
      const key = e.key;
      if ((key === ' ' || key === 'Enter') && (phase === 'over' || phase === 'ready')) { start(); return; }
      if (phase === 'over' || phase === 'ready') return;
      const d = DIRS[key] !== undefined ? DIRS[key] : DIRS[key.toLowerCase()];
      if (d !== undefined) {
        poke();
        if (!kb) { kb = true; if (sel >= 0) cursor = sel; }
        const from = sel >= 0 ? sel : cursor;
        const to = from + d;
        const okDir = to >= 0 && to < N * N && adjacent(from, to);
        if (sel >= 0) {
          if (okDir && trySwap(sel, to)) { sel = -1; cursor = to; }
          else if (!okDir) api.sfx('error');
        } else if (okDir) { cursor = to; api.sfx('tick'); }
        return;
      }
      if (key === ' ' || key === 'Enter') {
        poke();
        if (!kb) { kb = true; return; }
        sel = sel === cursor ? -1 : cursor;
        api.sfx('tick');
      }
    });

    // écran d'accueil : plateau déjà posé derrière le panneau
    reset();
    for (let i = 0; i < N * N; i++) { grid[i].x = i % N; grid[i].y = (i / N) | 0; }
    phase = 'ready';
    loop.start();
    api.overlay({
      title: api.t('Minerais', 'Ores'),
      text: api.t(
        'Échangez deux blocs voisins pour aligner 3 minerais identiques. Alignez-en 4 pour une TNT, 5 pour une Balise, un L ou un T pour un Éclair. ' + TARGET + ' points en ' + MOVES + ' coups.',
        'Swap two neighbouring blocks to line up 3 matching ores. Line up 4 for TNT, 5 for a Beacon, an L or T shape for Lightning. ' + TARGET + ' points in ' + MOVES + ' moves.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart: start };
  },
});

/* ==================================================================
   games/invaders.js · Invasion
   Une formation d'envahisseurs en pixel art avance par pas, descend
   à chaque bord et accélère à mesure qu'elle se vide. Tous les
   sprites sont dessinés une seule fois depuis de petites cartes de
   pixels vers des canvas hors écran ; les bunkers sont des grilles
   de blocs qui s'érodent et ne sont redessinés que s'ils changent.
   ================================================================== */
SBG.register('invaders', {
  create(api) {
    const { C } = api;
    const W = 520, H = 560;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const dpr = cv.dpr;
    const fx = api.particles();
    const MANY = api.reduced ? 0.4 : 1;
    cv.el.style.touchAction = 'none';

    const PX = 2;                       // taille d'un pixel de sprite
    const TOP = 40;                     // bas de l'en-tête
    const GROUND = H - 32;              // ligne de sol
    const PY = GROUND - 22;             // centre vertical du canon
    const MYS_Y = 58;                   // couloir du vaisseau mystère
    const COLS = 11, ROWS = 5, CW = 34, RH = 28;
    const STEP_X = 5, STEP_Y = 14, EDGE = 12;
    const BK_COLS = 22, BK_ROWS = 16, BK = 3, BK_Y = GROUND - 118;

    const ALIEN_COL = [C.violet, '#9F86FF', '#8E8FFF', '#7FA3FF', '#7FA3FF'];
    const ALIEN_PTS = [30, 20, 20, 10, 10];

    /* ── Cartes de pixels ────────────────────────────────────────── */
    const MAPS = {
      squid: [[
        '...##...', '..####..', '.######.', '##.##.##', '########', '..#..#..', '.#.##.#.', '#.#..#.#',
      ], [
        '...##...', '..####..', '.######.', '##.##.##', '########', '.#.##.#.', '#......#', '.#....#.',
      ]],
      crab: [[
        '..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...',
      ], [
        '..#.....#..', '#..#...#..#', '#.#######.#', '###.###.###', '###########', '.#########.', '..#.....#..', '.#.......#.',
      ]],
      octo: [[
        '....####....', '.##########.', '############', '###..##..###', '############', '...##..##...', '..##.##.##..', '##........##',
      ], [
        '....####....', '.##########.', '############', '###..##..###', '############', '..###..###..', '.##..##..##.', '..##....##..',
      ]],
    };
    const CANNON = ['......#......', '.....###.....', '.....###.....', '.###########.', '#############', '#############', '#############', '##.#######.##'];
    const SHIP = ['.....######.....', '...##########...', '..############..', '.##.##.##.##.##.', '################', '..###..##..###..', '...#........#...'];
    const BOOM = ['....#...#....', '.#...#.#...#.', '..#.......#..', '...#.....#...', '##.........##', '...#.....#...', '..#..#.#..#..', '.#..#...#..#.'];
    const ROW_TYPE = ['squid', 'crab', 'crab', 'octo', 'octo'];

    // dessine une carte de pixels sur un canvas hors écran, avec un liseré clair sur les arêtes hautes
    function sprite(map, col, scale) {
      const s = scale || PX;
      const w = map[0].length * s, h = map.length * s;
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const hi = lighten(col, 0.45);
      for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
          if (map[y][x] !== '#') continue;
          g.fillStyle = col; g.fillRect(x * s, y * s, s, s);
          if (y === 0 || map[y - 1][x] !== '#') { g.fillStyle = hi; g.fillRect(x * s, y * s, s, s / 2); }
        }
      }
      return { c, w, h };
    }
    function glowSprite(col, r, a) {
      const c = document.createElement('canvas');
      c.width = c.height = Math.ceil(r * 2 * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
      return { c, w: r * 2, h: r * 2 };
    }

    const SPR = {};
    for (let r = 0; r < ROWS; r++) {
      const key = ROW_TYPE[r] + r;
      SPR[key] = [sprite(MAPS[ROW_TYPE[r]][0], ALIEN_COL[r]), sprite(MAPS[ROW_TYPE[r]][1], ALIEN_COL[r])];
    }
    const SPR_CANNON = sprite(CANNON, C.cyan);
    const SPR_LIFE = sprite(CANNON, C.cyan, 1);
    const SPR_SHIP = sprite(SHIP, C.bad);
    const SPR_BOOM = sprite(BOOM, '#F0F6FC');
    const SPR_BOOM_P = sprite(BOOM, C.cyan);
    const SPR_BOOM_S = sprite(BOOM, C.bad);
    const GLOW_CANNON = glowSprite(C.cyan, 40, 0.16);
    const GLOW_BOMB = glowSprite(C.warm, 38, 0.38);
    const GLOW_SHIP = glowSprite(C.bad, 34, 0.22);

    /* ── Bonus : capsules pré-rendues ─────────────────────────────── */
    const POWERS = {
      double: { fr: 'Tir double', en: 'Double shot', col: C.cyan, dur: 10 },
      shield: { fr: 'Bouclier', en: 'Shield', col: C.good, dur: 0 },
      pierce: { fr: 'Laser perçant', en: 'Piercing laser', col: C.violet, dur: 8 },
      bomb: { fr: 'Bombe', en: 'Bomb', col: C.warm, dur: 0 },
    };
    const CAP_W = 22, CAP_H = 14, CAP_PAD = 12;
    function capsuleSprite(kind) {
      const col = POWERS[kind].col;
      const w = CAP_W + CAP_PAD * 2, h = CAP_H + CAP_PAD * 2;
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // halo doux
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, rgba(col, 0.42)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const x = CAP_PAD, y = CAP_PAD;
      g.fillStyle = col;
      api.roundRect(g, x, y, CAP_W, CAP_H, 7); g.fill();
      g.strokeStyle = lighten(col, 0.55); g.lineWidth = 1;
      api.roundRect(g, x + 0.5, y + 0.5, CAP_W - 1, CAP_H - 1, 6.5); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 5, y + 2, CAP_W - 10, 1.5);
      // pictogramme
      const cx = x + CAP_W / 2, cy = y + CAP_H / 2;
      g.fillStyle = C.bg; g.strokeStyle = C.bg; g.lineWidth = 1.6; g.lineCap = 'round'; g.lineJoin = 'round';
      if (kind === 'double') {
        for (const dx of [-3.5, 3.5]) {
          g.beginPath(); g.moveTo(cx + dx, cy + 4); g.lineTo(cx + dx, cy - 3); g.stroke();
          g.beginPath(); g.moveTo(cx + dx - 2.2, cy - 1); g.lineTo(cx + dx, cy - 3.6); g.lineTo(cx + dx + 2.2, cy - 1); g.stroke();
        }
      } else if (kind === 'shield') {
        g.beginPath();
        g.moveTo(cx, cy - 4.5); g.lineTo(cx + 4.5, cy - 3); g.lineTo(cx + 4, cy + 1);
        g.quadraticCurveTo(cx + 2.5, cy + 4, cx, cy + 5); g.quadraticCurveTo(cx - 2.5, cy + 4, cx - 4, cy + 1);
        g.lineTo(cx - 4.5, cy - 3); g.closePath(); g.fill();
      } else if (kind === 'pierce') {
        g.beginPath(); g.moveTo(cx - 6, cy); g.lineTo(cx + 5, cy); g.stroke();
        g.beginPath(); g.moveTo(cx + 2, cy - 3); g.lineTo(cx + 5.5, cy); g.lineTo(cx + 2, cy + 3); g.stroke();
        g.beginPath(); g.moveTo(cx - 2, cy - 3); g.lineTo(cx - 2, cy + 3); g.stroke();
      } else {
        g.beginPath(); g.arc(cx - 1, cy + 1, 3.6, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(cx + 1.5, cy - 1.5); g.quadraticCurveTo(cx + 3.5, cy - 4.5, cx + 6, cy - 4); g.stroke();
      }
      return { c, w, h };
    }
    const CAPS = {};
    for (const k in POWERS) CAPS[k] = capsuleSprite(k);

    /* ── Fond pré-rendu : étoiles, en-tête, sol ───────────────────── */
    const bgLayer = document.createElement('canvas');
    bgLayer.width = cv.el.width; bgLayer.height = cv.el.height;
    const stars = [];
    {
      const g = bgLayer.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
      let seed = 7;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let i = 0; i < 80; i++) {
        const x = Math.floor(rnd() * W), y = TOP + 4 + Math.floor(rnd() * (GROUND - TOP - 8));
        const big = rnd() < 0.15;
        g.fillStyle = rnd() < 0.3 ? 'rgba(210,168,255,0.35)' : 'rgba(230,237,243,' + (0.12 + rnd() * 0.22).toFixed(2) + ')';
        g.fillRect(x, y, big ? 2 : 1, big ? 2 : 1);
        if (i % 9 === 0) stars.push({ x, y, p: rnd() * 6.28 });
      }
      g.fillStyle = C.panel; g.fillRect(0, 0, W, TOP);
      g.fillStyle = C.line; g.fillRect(0, TOP, W, 1);
      // sol en pointillés pixel
      g.fillStyle = rgba(C.cyan, 0.35); g.fillRect(0, GROUND, W, 2);
      g.fillStyle = rgba(C.cyan, 0.08);
      for (let x = 0; x < W; x += 8) g.fillRect(x, GROUND + 6, 4, 2);
    }

    /* ── Bunkers : grilles de blocs ──────────────────────────────── */
    function bunkerShape() {
      const m = new Uint8Array(BK_COLS * BK_ROWS);
      for (let y = 0; y < BK_ROWS; y++) {
        for (let x = 0; x < BK_COLS; x++) {
          let on = true;
          const cut = 4 - y;                                   // coins arrondis en haut
          if (cut > 0 && (x < cut || x >= BK_COLS - cut)) on = false;
          // arche en bas au centre
          const ax = Math.abs(x - (BK_COLS - 1) / 2);
          const ay = y - (BK_ROWS - 6);
          if (ay >= 0 && ax < [2, 3.5, 4.5, 5, 5, 5][ay]) on = false;
          m[y * BK_COLS + x] = on ? 1 : 0;
        }
      }
      return m;
    }
    const BW_PX = BK_COLS * BK, BH_PX = BK_ROWS * BK;
    const bunkers = [];
    for (let i = 0; i < 4; i++) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(BW_PX * dpr); c.height = Math.ceil(BH_PX * dpr);
      const span = (W - 80) / 4;
      bunkers.push({ x: Math.round(40 + span * i + span / 2 - BW_PX / 2), y: BK_Y, m: null, c, g: c.getContext('2d'), dirty: true });
    }
    const BK_HI = lighten(C.good, 0.4), BK_LO = '#2EA043';
    function paintBunker(b) {
      const g = b.g;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, BW_PX, BH_PX);
      for (let y = 0; y < BK_ROWS; y++) for (let x = 0; x < BK_COLS; x++) {
        if (!b.m[y * BK_COLS + x]) continue;
        const exposed = y === 0 || !b.m[(y - 1) * BK_COLS + x];
        g.fillStyle = exposed ? BK_HI : ((x + y) % 2 ? C.good : BK_LO);
        g.fillRect(x * BK, y * BK, BK, BK);
      }
      b.dirty = false;
    }
    function bunkerAt(px, py) {
      for (let i = 0; i < bunkers.length; i++) {
        const b = bunkers[i];
        if (px < b.x || px >= b.x + BW_PX || py < b.y || py >= b.y + BH_PX) continue;
        const cx = Math.floor((px - b.x) / BK), cy = Math.floor((py - b.y) / BK);
        if (b.m[cy * BK_COLS + cx]) return { b, cx, cy };
      }
      return null;
    }
    // érosion : un éclat irrégulier autour du point d'impact, plus profond dans le sens du tir
    function erode(hit, dirY) {
      const { b, cx, cy } = hit;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= BK_COLS || y >= BK_ROWS) continue;
        const along = dy * dirY;                       // positif = dans le sens du tir
        const d = Math.abs(dx) * 1.2 + Math.abs(dy) * (along >= 0 ? 0.7 : 1.4);
        const p = d === 0 ? 1 : 1.25 - d * 0.42;
        if (Math.random() < p) b.m[y * BK_COLS + x] = 0;
      }
      b.dirty = true;
      fx.burst(b.x + cx * BK + 1.5, b.y + cy * BK + 1.5, { n: Math.round(5 * MANY), color: [C.good, BK_HI], speed: 80, life: 0.35, size: 1.4 });
    }

    /* ── État ────────────────────────────────────────────────────── */
    let state = 'ready', overAt = 0, lastStart = -1e9, runId = 0;
    let score, lives, wave, aliens, alive, ox, oy, dir, pendingDrop, stepT, stepAcc, frame, beat, beatT;
    let player, pShots, aShots, aFireT, mys, mysT, mysSoundT, caps, dropCd, booms, labels, banner, dieT;
    let dblT, pierceT, shield, bomb, keys, ptr, fireCd, statusStr, t;

    function newFormation() {
      aliens = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) aliens.push({ r, c, alive: true, key: ROW_TYPE[r] + r });
      alive = aliens.length;
      ox = Math.round((W - (COLS - 1) * CW) / 2);
      oy = 92 + Math.min(wave - 1, 6) * 10;
      dir = 1; pendingDrop = false; stepAcc = 0; frame = 0;
      for (const b of bunkers) { b.m = bunkerShape(); b.dirty = true; }
      pShots.length = 0; aShots.length = 0;
      aFireT = 1.4; mys = null; mysT = 14 + Math.random() * 8;
    }
    function reset() {
      score = 0; lives = 3; wave = 1; t = 0;
      pShots = []; aShots = []; caps = []; booms = []; labels = [];
      player = { x: W / 2, inv: 0 };
      keys = { l: false, r: false, fire: false };
      ptr = { on: false, x: W / 2, follow: false };
      dblT = 0; pierceT = 0; shield = false; bomb = false; fireCd = 0; dropCd = 4;
      beat = 0; beatT = 0; banner = null; dieT = 0; statusStr = '';
      fx.clear();
      newFormation();
      api.hud({ score: 0 });
    }
    function start() {
      const now = performance.now();
      if (now - lastStart < 350) return;
      lastStart = now; runId++;
      reset();
      state = 'play';
      banner = { text: api.t('Vague 1', 'Wave 1'), t: 0 };
      syncStatus();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      loop.start();
    }

    function syncStatus() {
      const parts = [api.t('Vague ' + wave, 'Wave ' + wave)];
      if (dblT > 0) parts.push(api.t(POWERS.double.fr, POWERS.double.en));
      if (pierceT > 0) parts.push(api.t(POWERS.pierce.fr, POWERS.pierce.en));
      if (shield) parts.push(api.t(POWERS.shield.fr, POWERS.shield.en));
      if (bomb) parts.push(api.t('Bombe armée', 'Bomb armed'));
      const s = parts.join(' · ');
      if (s !== statusStr) { statusStr = s; api.status(s); }
    }

    const alienX = (a) => ox + a.c * CW;
    const alienY = (a) => oy + a.r * RH;
    const alienW = (a) => SPR[a.key][0].w;

    // intervalle entre deux pas : la formation accélère quand elle se vide
    function stepInterval() {
      const k = alive / (ROWS * COLS);
      const base = 0.018 + 0.52 * Math.pow(k, 1.15);
      return base * Math.max(0.6, 1 - (wave - 1) * 0.07);
    }

    function formationStep() {
      if (pendingDrop) { oy += STEP_Y; dir = -dir; pendingDrop = false; }
      else ox += dir * STEP_X;
      frame ^= 1;
      // bords et bas de la formation
      let minX = 1e9, maxX = -1e9, maxY = -1e9;
      for (let i = 0; i < aliens.length; i++) {
        const a = aliens[i]; if (!a.alive) continue;
        const x = alienX(a), hw = alienW(a) / 2;
        if (x - hw < minX) minX = x - hw;
        if (x + hw > maxX) maxX = x + hw;
        const y = alienY(a) + 8; if (y > maxY) maxY = y;
      }
      if ((dir > 0 && maxX + STEP_X > W - EDGE) || (dir < 0 && minX - STEP_X < EDGE)) pendingDrop = true;
      // les envahisseurs rongent les bunkers qu'ils traversent
      if (maxY >= BK_Y) {
        for (let i = 0; i < aliens.length; i++) {
          const a = aliens[i]; if (!a.alive) continue;
          const ay = alienY(a); if (ay + 8 < BK_Y) continue;
          const ax = alienX(a), hw = alienW(a) / 2;
          for (const b of bunkers) {
            if (ax + hw < b.x || ax - hw > b.x + BW_PX || ay + 8 < b.y || ay - 8 > b.y + BH_PX) continue;
            const x0 = Math.max(0, Math.floor((ax - hw - b.x) / BK)), x1 = Math.min(BK_COLS - 1, Math.floor((ax + hw - b.x) / BK));
            const y0 = Math.max(0, Math.floor((ay - 8 - b.y) / BK)), y1 = Math.min(BK_ROWS - 1, Math.floor((ay + 8 - b.y) / BK));
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) b.m[y * BK_COLS + x] = 0;
            b.dirty = true;
          }
        }
      }
      // rythme de marche : quatre notes graves, jamais trop serrées
      if (t - beatT > 0.11) {
        beatT = t;
        api.tone([98, 87, 78, 73][beat++ % 4], 0.08, 'square', 0.13);
      }
      if (maxY >= PY - 8) invaded();
    }

    function fire() {
      if (fireCd > 0 || state !== 'play') return;
      const pierce = pierceT > 0;
      if (pShots.length >= (dblT > 0 ? 4 : 2)) return;
      const y = PY - 10;
      if (dblT > 0) {
        pShots.push({ x: player.x - 7, y, pierce, hit: pierce ? new Set() : null });
        pShots.push({ x: player.x + 7, y, pierce, hit: pierce ? new Set() : null });
      } else {
        pShots.push({ x: player.x, y, pierce, hit: pierce ? new Set() : null });
      }
      fireCd = 0.4;
      api.tone(pierce ? 1250 : 980, 0.07, pierce ? 'sawtooth' : 'square', 0.1, 0.45);
    }

    function killAlien(a, withPoints) {
      a.alive = false; alive--;
      const x = alienX(a), y = alienY(a);
      booms.push({ x, y, t: 0, spr: SPR_BOOM, col: ALIEN_COL[a.r] });
      fx.burst(x, y, { n: Math.round(9 * MANY), color: [ALIEN_COL[a.r], '#fff'], speed: 150, life: 0.45, size: 1.8 });
      if (withPoints) score += ALIEN_PTS[a.r] * (1 + Math.floor((wave - 1) / 2));
      // chance de lâcher une capsule
      if (dropCd <= 0 && caps.length === 0 && Math.random() < 0.06) spawnCapsule(x, y);
    }

    function hitAlien(a, s) {
      if (bomb) {
        bomb = false;
        let n = 0;
        for (let i = 0; i < aliens.length; i++) {
          const o = aliens[i];
          if (o.alive && Math.abs(o.r - a.r) <= 1 && Math.abs(o.c - a.c) <= 1) { killAlien(o, true); n++; }
        }
        const x = alienX(a), y = alienY(a);
        fx.burst(x, y, { n: Math.round(30 * MANY), color: [C.warm, C.bad, '#fff'], speed: 260, life: 0.7, size: 2.6 });
        booms.push({ x, y, t: 0, spr: SPR_BOOM_S, col: C.warm, big: true });
        api.sfx('boom'); api.shake(4);
        labels.push({ x, y: y - 10, text: '×' + n, col: C.warm, t: 0 });
      } else {
        killAlien(a, true);
        api.tone(200, 0.12, 'square', 0.16, 0.35);
      }
      api.hud({ score });
      syncStatus();
      if (alive <= 0) waveClear();
    }

    function spawnCapsule(x, y) {
      const pool = ['double', 'pierce', 'double', 'pierce'];
      if (!shield) pool.push('shield', 'shield');
      if (!bomb) pool.push('bomb', 'bomb');
      caps.push({ x, y, kind: pool[Math.floor(Math.random() * pool.length)], t: 0 });
      dropCd = 9;
    }
    function pickup(cp) {
      const p = POWERS[cp.kind];
      if (cp.kind === 'double') dblT = p.dur;
      else if (cp.kind === 'pierce') pierceT = p.dur;
      else if (cp.kind === 'shield') shield = true;
      else bomb = true;
      [660, 880, 1175].forEach((f, i) => api.after(i * 60, () => api.tone(f, 0.12, 'triangle', 0.35)));
      fx.burst(cp.x, cp.y, { n: Math.round(14 * MANY), color: [p.col, '#fff'], speed: 150, life: 0.5, size: 2 });
      labels.push({ x: api.clamp(cp.x, 60, W - 60), y: PY - 26, text: api.t(p.fr, p.en), col: p.col, t: 0 });
      syncStatus();
    }

    function hitPlayer() {
      if (player.inv > 0 || state !== 'play') return;
      if (shield) {
        shield = false; player.inv = 0.9;
        fx.burst(player.x, PY, { n: Math.round(18 * MANY), color: [C.good, '#fff'], speed: 200, life: 0.5, size: 2 });
        api.tone(520, 0.18, 'triangle', 0.35, 0.5);
        syncStatus();
        return;
      }
      lives--;
      state = 'dying'; dieT = 0;
      aShots.length = 0;
      api.sfx('boom'); api.shake(7);
      fx.burst(player.x, PY, { n: Math.round(26 * MANY), color: [C.cyan, C.bad, '#fff'], speed: 230, life: 0.7 });
      if (lives <= 0) { gameOver(); }
    }

    function invaded() {
      lives = 0;
      state = 'dying'; dieT = 0;
      api.sfx('boom'); api.shake(8);
      fx.burst(player.x, PY, { n: Math.round(26 * MANY), color: [C.cyan, C.bad, '#fff'], speed: 230, life: 0.7 });
      gameOver(api.t('La formation a touché le sol', 'The formation reached the ground'));
    }

    function waveClear() {
      state = 'between';
      api.sfx('win');
      const bonus = 50 * wave;
      score += bonus; api.hud({ score });
      labels.push({ x: W / 2, y: H * 0.5 + 26, text: '+' + bonus, col: C.good, t: 0 });
      wave++;
      if (wave >= 3) api.unlock('invaders_wave3');
      banner = { text: api.t('Vague ' + wave, 'Wave ' + wave), t: 0 };
      syncStatus();
      const id = runId;
      api.after(1500, () => {
        if (id !== runId || state !== 'between') return;
        newFormation();
        state = 'play';
      });
    }

    function gameOver(reason) {
      state = 'over'; overAt = performance.now();
      api.after(300, () => api.sfx('lose'));
      const record = api.setBest(score);
      const id = runId;
      api.after(1100, () => {
        if (id !== runId || state !== 'over') return;
        api.overlay({
          kicker: record && score > 0 ? api.t('Nouveau record', 'New best') : '',
          title: api.t('Partie terminée', 'Game over'),
          text: (reason ? reason + '. ' : '') + api.t(score + ' points · vague ' + wave, score + ' points · wave ' + wave),
          action: api.t('Rejouer', 'Play again'),
          tone: record && score > 0 ? 'good' : '',
          onAction: start,
        });
      });
    }

    /* ── Mise à jour ─────────────────────────────────────────────── */
    function update(dt) {
      t += dt;
      fx.update(dt);
      for (let i = booms.length - 1; i >= 0; i--) { booms[i].t += dt; if (booms[i].t > 0.3) booms.splice(i, 1); }
      for (let i = labels.length - 1; i >= 0; i--) { labels[i].t += dt; if (labels[i].t > 1.1) labels.splice(i, 1); }
      if (banner) { banner.t += dt; if (banner.t > 1.5) banner = null; }
      for (const b of bunkers) if (b.dirty && b.m) paintBunker(b);
      if (state === 'over') dieT += dt;
      if (state === 'ready' || state === 'over') return;

      if (state === 'dying') {
        dieT += dt;
        if (dieT > 1.3) {
          state = 'play'; player.inv = 1.8; player.x = api.clamp(player.x, 20, W - 20);
          syncStatus();
        }
        return;
      }

      // déplacement du canon
      const SPEED = 290;
      if (keys.l || keys.r) {
        player.x += ((keys.r ? 1 : 0) - (keys.l ? 1 : 0)) * SPEED * dt;
        ptr.x = player.x;
      } else if (ptr.follow) {
        const d = ptr.x - player.x;
        const mv = Math.sign(d) * Math.min(Math.abs(d), Math.max(SPEED, Math.abs(d) * 9) * dt);
        player.x += mv;
      }
      player.x = api.clamp(player.x, 18, W - 18);
      if (player.inv > 0) player.inv = Math.max(0, player.inv - dt);
      fireCd = Math.max(0, fireCd - dt);
      dropCd = Math.max(0, dropCd - dt);

      // bonus temporisés
      if (dblT > 0) { dblT = Math.max(0, dblT - dt); if (dblT === 0) syncStatus(); }
      if (pierceT > 0) { pierceT = Math.max(0, pierceT - dt); if (pierceT === 0) syncStatus(); }

      if (state === 'play' && (keys.fire || ptr.on)) fire();

      // capsules
      for (let i = caps.length - 1; i >= 0; i--) {
        const cp = caps[i];
        cp.t += dt; cp.y += 85 * dt;
        if (Math.abs(cp.x - player.x) < 22 && Math.abs(cp.y - PY) < 15) { caps.splice(i, 1); pickup(cp); continue; }
        if (cp.y > GROUND + 10) caps.splice(i, 1);
      }

      // vaisseau mystère
      if (mys) {
        mys.x += mys.v * dt;
        mysSoundT -= dt;
        if (mysSoundT <= 0) { mysSoundT = 0.16; mys.ph ^= 1; api.tone(mys.ph ? 640 : 520, 0.12, 'sine', 0.06); }
        if (mys.x < -40 || mys.x > W + 40) mys = null;
      } else if (state === 'play') {
        mysT -= dt;
        if (mysT <= 0 && alive > 6) {
          const fromLeft = Math.random() < 0.5;
          mys = { x: fromLeft ? -30 : W + 30, v: (fromLeft ? 1 : -1) * (92 + wave * 6), ph: 0 };
          mysSoundT = 0; mysT = 18 + Math.random() * 10;
        }
      }

      if (state !== 'play') { movePlayerShots(dt); return; }

      // formation
      stepAcc += dt;
      const iv = stepInterval();
      while (stepAcc >= iv && state === 'play') { stepAcc -= iv; formationStep(); }
      if (state !== 'play') return;

      // tirs ennemis
      aFireT -= dt;
      const maxShots = Math.min(5, 2 + Math.floor(wave / 2));
      if (aFireT <= 0) {
        aFireT = (0.45 + Math.random() * 0.8) * Math.max(0.4, 1.05 - wave * 0.08);
        if (aShots.length < maxShots && player.inv < 1.2) alienFire();
      }
      const aSpeed = Math.min(270, 150 + wave * 12);
      for (let i = aShots.length - 1; i >= 0; i--) {
        const s = aShots[i];
        const y0 = s.y;
        s.y += aSpeed * dt;
        s.ph += dt;
        let gone = false;
        for (let y = y0 + 6; y <= s.y + 6; y += 2) {
          const h = bunkerAt(s.x, y);
          if (h) { erode(h, 1); gone = true; break; }
        }
        if (!gone && Math.abs(s.x - player.x) < 12 && s.y + 6 > PY - 6 && s.y - 6 < PY + 8) { gone = true; hitPlayer(); }
        if (!gone && s.y > GROUND - 2) {
          gone = true;
          fx.burst(s.x, GROUND - 1, { n: Math.round(4 * MANY), color: C.warm, speed: 70, life: 0.3, size: 1.4 });
        }
        if (gone) aShots.splice(i, 1);
        if (state !== 'play') return;
      }

      movePlayerShots(dt);
    }

    function alienFire() {
      // colonne choisie : parfois celle au-dessus du joueur
      let col = -1;
      if (Math.random() < 0.38) {
        let best = 1e9;
        for (let c = 0; c < COLS; c++) { const d = Math.abs(ox + c * CW - player.x); if (d < best && columnBottom(c)) { best = d; col = c; } }
      }
      if (col < 0) {
        for (let tries = 0; tries < 12 && col < 0; tries++) { const c = Math.floor(Math.random() * COLS); if (columnBottom(c)) col = c; }
      }
      if (col < 0) return;
      const a = columnBottom(col);
      aShots.push({ x: alienX(a), y: alienY(a) + 10, kind: Math.random() < 0.5 ? 0 : 1, ph: 0 });
    }
    function columnBottom(c) {
      for (let r = ROWS - 1; r >= 0; r--) { const a = aliens[r * COLS + c]; if (a.alive) return a; }
      return null;
    }

    function movePlayerShots(dt) {
      for (let i = pShots.length - 1; i >= 0; i--) {
        const s = pShots[i];
        const y0 = s.y;
        s.y -= 540 * dt;
        let gone = false;
        // bunkers
        for (let y = y0 - 6; y >= s.y - 6; y -= 2) {
          const h = bunkerAt(s.x, y);
          if (h) { erode(h, -1); gone = true; break; }
        }
        // tirs ennemis : on peut les abattre
        if (!gone) {
          for (let j = aShots.length - 1; j >= 0; j--) {
            const e = aShots[j];
            if (Math.abs(e.x - s.x) < 4 && e.y + 6 > s.y - 6 && e.y - 6 < y0 + 4) {
              aShots.splice(j, 1);
              fx.burst(s.x, s.y, { n: Math.round(6 * MANY), color: [C.warm, '#fff'], speed: 110, life: 0.3, size: 1.5 });
              api.tone(700, 0.05, 'square', 0.1, 0.6);
              score += 5; api.hud({ score });
              if (!s.pierce) gone = true;
              break;
            }
          }
        }
        // envahisseurs
        if (!gone && state === 'play') {
          for (let j = 0; j < aliens.length; j++) {
            const a = aliens[j];
            if (!a.alive) continue;
            const ax = alienX(a), ay = alienY(a), hw = alienW(a) / 2 + 1;
            if (s.x < ax - hw || s.x > ax + hw || s.y - 6 > ay + 8 || y0 + 4 < ay - 8) continue;
            if (s.pierce) {
              if (s.hit.has(j)) continue;
              s.hit.add(j);
              hitAlien(a, s);
            } else {
              hitAlien(a, s); gone = true;
            }
            if (state !== 'play' || !s.pierce) break;
          }
        }
        // vaisseau mystère
        if (!gone && mys && Math.abs(s.x - mys.x) < SPR_SHIP.w / 2 + 1 && s.y - 6 < MYS_Y + 7 && y0 > MYS_Y - 7) {
          const pts = [50, 100, 150, 300][Math.floor(Math.random() * 4)];
          score += pts; api.hud({ score });
          booms.push({ x: mys.x, y: MYS_Y, t: 0, spr: SPR_BOOM_S, col: C.bad });
          fx.burst(mys.x, MYS_Y, { n: Math.round(20 * MANY), color: [C.bad, C.warm, '#fff'], speed: 200, life: 0.6 });
          labels.push({ x: mys.x, y: MYS_Y + 4, text: '+' + pts, col: C.bad, t: 0 });
          api.sfx('score');
          spawnCapsule(api.clamp(mys.x, 20, W - 20), MYS_Y + 8);
          mys = null;
          gone = true;
        }
        if (!gone && s.y < TOP + 2) gone = true;
        if (gone) pShots.splice(i, 1);
      }
    }

    /* ── Rendu ───────────────────────────────────────────────────── */
    function blit(spr, x, y) {
      ctx.drawImage(spr.c, Math.round(x - spr.w / 2), Math.round(y - spr.h / 2), spr.w, spr.h);
    }
    function render() {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bgLayer, 0, 0, W, H);
      ctx.imageSmoothingEnabled = true;

      // quelques étoiles qui scintillent
      if (!api.reduced) {
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.7 + s.p));
          ctx.fillStyle = '#E6EDF3'; ctx.fillRect(s.x, s.y, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      drawHeader();
      ctx.imageSmoothingEnabled = false;

      // bunkers
      for (const b of bunkers) ctx.drawImage(b.c, b.x, b.y, BW_PX, BH_PX);

      // formation
      for (let i = 0; i < aliens.length; i++) {
        const a = aliens[i]; if (!a.alive) continue;
        blit(SPR[a.key][frame], alienX(a), alienY(a));
      }
      // explosions
      for (const bm of booms) {
        ctx.globalAlpha = 1 - bm.t / 0.3;
        if (bm.big) { const s = 2; ctx.drawImage(bm.spr.c, Math.round(bm.x - bm.spr.w), Math.round(bm.y - bm.spr.h), bm.spr.w * s, bm.spr.h * s); }
        else blit(bm.spr, bm.x, bm.y);
      }
      ctx.globalAlpha = 1;

      // vaisseau mystère
      if (mys) {
        ctx.imageSmoothingEnabled = true;
        blit(GLOW_SHIP, mys.x, MYS_Y);
        ctx.imageSmoothingEnabled = false;
        blit(SPR_SHIP, mys.x, MYS_Y);
      }

      // tirs du joueur
      for (const s of pShots) {
        if (s.pierce) {
          ctx.fillStyle = rgba(C.violet, 0.28); ctx.fillRect(s.x - 3, s.y - 10, 6, 22);
          ctx.fillStyle = C.violet; ctx.fillRect(s.x - 1.5, s.y - 10, 3, 20);
          ctx.fillStyle = '#fff'; ctx.fillRect(s.x - 0.5, s.y - 10, 1, 14);
        } else {
          ctx.fillStyle = rgba(C.cyan, 0.25); ctx.fillRect(s.x - 2.5, s.y - 7, 5, 14);
          ctx.fillStyle = '#E9FCFF'; ctx.fillRect(s.x - 1, s.y - 6, 2, 11);
        }
      }
      // tirs ennemis : zigzag ou tige
      for (const s of aShots) {
        const x = Math.round(s.x), y = Math.round(s.y);
        if (s.kind === 0) {
          const ph = Math.floor(s.ph * 14) % 2;
          ctx.fillStyle = C.warm;
          for (let k = 0; k < 4; k++) ctx.fillRect(x + ((k + ph) % 2 ? 0 : -2), y - 6 + k * 3, 2, 3);
        } else {
          ctx.fillStyle = C.bad; ctx.fillRect(x - 1, y - 6, 2, 12);
          const cy = y - 4 + (Math.floor(s.ph * 18) % 3) * 4;
          ctx.fillRect(x - 3, cy, 6, 2);
        }
      }

      // capsules
      ctx.imageSmoothingEnabled = true;
      for (const cp of caps) {
        const spr = CAPS[cp.kind];
        blit(spr, cp.x, cp.y + Math.sin(cp.t * 5) * 1.5);
      }

      // canon
      if (state === 'dying' || (state === 'over' && lives <= 0)) {
        const k = state === 'dying' ? dieT : 1;
        if (k < 1.1) {
          ctx.imageSmoothingEnabled = false;
          const sp = Math.floor(t * 12) % 2 ? SPR_BOOM_P : SPR_BOOM_S;
          blit(sp, player.x, PY);
        }
      } else {
        const blink = player.inv > 0 && Math.floor(player.inv * 12) % 2 === 0;
        if (!blink) {
          blit(bomb ? GLOW_BOMB : GLOW_CANNON, player.x, PY);
          ctx.imageSmoothingEnabled = false;
          blit(SPR_CANNON, player.x, PY);
          if (bomb) { ctx.fillStyle = C.warm; ctx.fillRect(Math.round(player.x) - 1, PY - 12, 2, 2); }
        }
        if (shield) {
          ctx.strokeStyle = rgba(C.good, 0.55 + 0.25 * Math.sin(t * 6)); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(player.x, PY + 1, 22, 15, 0, Math.PI, 0); ctx.stroke();
          ctx.fillStyle = rgba(C.good, 0.08);
          ctx.beginPath(); ctx.ellipse(player.x, PY + 1, 22, 15, 0, Math.PI, 0); ctx.fill();
        }
      }
      ctx.imageSmoothingEnabled = true;

      fx.draw(ctx);

      // barres de compte à rebours des bonus (bord haut)
      let by = 0;
      if (dblT > 0) { drawBar(by, dblT / POWERS.double.dur, C.cyan); by += 4; }
      if (pierceT > 0) { drawBar(by, pierceT / POWERS.pierce.dur, C.violet); by += 4; }

      // libellés flottants
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 13px ' + api.font;
      for (const l of labels) {
        const k = l.t / 1.1;
        ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
        ctx.fillStyle = l.col;
        ctx.fillText(l.text, l.x, l.y - api.ease.out(k) * 26);
      }
      ctx.globalAlpha = 1;

      if (banner) {
        const k = banner.t / 1.5;
        const a = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.globalAlpha = a;
        ctx.fillStyle = C.ink; ctx.font = '750 30px ' + api.font;
        ctx.fillText(banner.text, W / 2, H * 0.5 - (1 - api.ease.out(Math.min(1, k * 3))) * 10);
        ctx.globalAlpha = 1;
      }
      ctx.textBaseline = 'alphabetic';
    }
    function drawBar(y, k, col) {
      ctx.fillStyle = rgba(col, 0.18); ctx.fillRect(0, y, W, 3);
      ctx.fillStyle = col; ctx.fillRect(0, y, W * k, 3);
    }
    function drawHeader() {
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.muted; ctx.font = '600 13px ' + api.font; ctx.textAlign = 'left';
      ctx.fillText(api.t('Vague ', 'Wave ') + wave, 20, 21);
      // vies : petits canons
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < 3; i++) {
        const x = W - 30 - i * 22;
        ctx.globalAlpha = i < lives ? 1 : 0.18;
        ctx.drawImage(SPR_LIFE.c, x - SPR_LIFE.w / 2, 17, SPR_LIFE.w, SPR_LIFE.h);
      }
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
      if (bomb) {
        ctx.fillStyle = C.warm; ctx.textAlign = 'right';
        ctx.fillText(api.t('Bombe armée', 'Bomb armed'), W - 108, 21);
      }
      ctx.textBaseline = 'alphabetic';
    }

    const loop = api.loop({ update, render });

    /* ── Entrées ─────────────────────────────────────────────────── */
    const isL = (k) => k === 'ArrowLeft' || k === 'q' || k === 'Q' || k === 'a' || k === 'A';
    const isR = (k) => k === 'ArrowRight' || k === 'd' || k === 'D';
    api.onKey((e) => {
      const k = e.key;
      if (isL(k)) keys.l = true;
      else if (isR(k)) keys.r = true;
      else if (k === ' ' || k === 'Enter') {
        if (state === 'play' || state === 'between' || state === 'dying') { if (k === ' ') keys.fire = true; }
        else if (!e.repeat && (state === 'ready' || (state === 'over' && performance.now() - overAt > 1000))) { api.hideOverlay(); start(); }
      }
    });
    api.on(document, 'keyup', (e) => {
      if (isL(e.key)) keys.l = false;
      else if (isR(e.key)) keys.r = false;
      else if (e.key === ' ') keys.fire = false;
    });
    api.on(window, 'blur', () => { keys.l = keys.r = keys.fire = false; ptr.on = false; });

    const playing = () => state === 'play' || state === 'between' || state === 'dying';
    api.on(cv.el, 'pointerdown', (e) => {
      if (!playing()) return;
      e.preventDefault();
      ptr.on = true; ptr.follow = true;
      ptr.x = cv.toLocal(e.clientX, e.clientY).x;
      try { cv.el.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
    });
    api.on(cv.el, 'pointermove', (e) => {
      if (!playing()) return;
      if (e.pointerType === 'mouse' || ptr.on) { ptr.x = cv.toLocal(e.clientX, e.clientY).x; ptr.follow = true; }
    });
    const up = () => { ptr.on = false; };
    api.on(cv.el, 'pointerup', up);
    api.on(cv.el, 'pointercancel', up);
    api.on(cv.el, 'contextmenu', (e) => e.preventDefault());

    /* ── Couleurs ────────────────────────────────────────────────── */
    function rgba(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function lighten(hex, k) {
      const n = parseInt(hex.slice(1), 16);
      const f = (v) => Math.round(v + (255 - v) * k);
      return 'rgb(' + f((n >> 16) & 255) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
    }

    // écran d'accueil
    reset(); state = 'ready';
    loop.start();
    api.overlay({
      title: api.t('Invasion', 'Invasion'),
      text: api.t('Repoussez la formation avant qu\'elle touche le sol. ← → pour bouger, Espace pour tirer. Trois vies.', 'Stop the formation before it reaches the ground. ← → to move, Space to fire. Three lives.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart() { lastStart = -1e9; api.hideOverlay(); start(); } };
  },
});

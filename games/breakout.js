/* ==================================================================
   games/breakout.js · Casse-briques
   Physique au pas fixe avec sous-pas : chaque balle n'avance jamais
   de plus d'un tiers de son rayon entre deux tests de collision, elle
   ne traverse donc aucune brique, même à pleine vitesse.
   Bonus : certaines briques lâchent une capsule à attraper avec la
   raquette (raquette large, multi-balle, laser, balle lente, balle de
   feu, aimant, vie) et un malus rouge à éviter (raquette courte).
   ================================================================== */
SBG.register('breakout', {
  create(api) {
    const { C } = api;
    const W = 520, H = 440;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();
    const MANY = api.reduced ? 0.4 : 1;
    const DPR = cv.dpr;

    const COLS = 10, MX = 22, GAP = 6, TOP = 62, CEIL = 41;
    const BW = (W - MX * 2 - GAP * (COLS - 1)) / COLS, BH = 16;
    const PADW = 92, PADH = 12, PADY = H - 34, R = 6;
    const ROW_COLS = [C.violet, '#9F86FF', '#8E8FFF', C.blue, '#7FA3FF', '#8FB6FF', '#9CC6FF', '#A8D4FF'];
    const MAX_BALLS = 12, MAX_LIVES = 5, DROP = 0.14, CAP_W = 24, CAP_H = 14, CAP_V = 150;
    const SHOT_V = 640, SHOT_L = 10, SHOT_CD = 0.26, HOLD_MAX = 3;

    /* ── Bonus : nom, couleur, durée (0 = instantané), poids de tirage ── */
    const KINDS = {
      wide:   { fr: 'Raquette large', en: 'Wide paddle', col: C.cyan,   dur: 12, w: 16 },
      multi:  { fr: 'Multi-balle',    en: 'Multiball',   col: C.violet, dur: 0,  w: 13 },
      laser:  { fr: 'Laser',          en: 'Laser',       col: C.blue,   dur: 10, w: 12, sfr: 'Espace ou clic pour tirer', sen: 'Space or click to fire' },
      slow:   { fr: 'Balle lente',    en: 'Slow ball',   col: C.ink,    dur: 10, w: 12 },
      fire:   { fr: 'Balle de feu',   en: 'Fireball',    col: C.warm,   dur: 8,  w: 9 },
      sticky: { fr: 'Aimant',         en: 'Sticky',      col: '#E3B341', dur: 0, w: 11, sfr: '3 prises', sen: '3 catches' },
      life:   { fr: 'Vie',            en: 'Extra life',  col: C.good,   dur: 0,  w: 3 },
      short:  { fr: 'Raquette courte', en: 'Short paddle', col: C.bad,  dur: 8,  w: 7 },
    };
    const KIND_IDS = Object.keys(KINDS);
    const TIMED = ['wide', 'laser', 'slow', 'fire', 'short'];
    const WEIGHT = KIND_IDS.reduce((s, k) => s + KINDS[k].w, 0);

    let overAt = 0, bricks, dying, balls, pad, padW, prevPadX, tx, keys, lives, level, score, state, banner, lastStart = -1e9, runId = 0;
    let pw, sticky, speedMul, caps, shots, shotCd, labels, emberTick;

    /* ── Calques pré-rendus : capsules et halos de balle ─────────── */
    function mix(hex, k) {
      const n = parseInt(hex.slice(1), 16);
      const f = (c) => Math.round(c + (255 - c) * k);
      return 'rgb(' + f((n >> 16) & 255) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
    }
    function rgba(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function offscreen(w, h) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * DPR); c.height = Math.ceil(h * DPR);
      const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
      return { c, g };
    }
    // petit pictogramme tracé au chemin, centré en (0, 0)
    function glyph(g, kind, col) {
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.8; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath();
      if (kind === 'wide') {
        g.moveTo(-6, 0); g.lineTo(6, 0);
        g.moveTo(-3.5, -2.8); g.lineTo(-6.5, 0); g.lineTo(-3.5, 2.8);
        g.moveTo(3.5, -2.8); g.lineTo(6.5, 0); g.lineTo(3.5, 2.8); g.stroke();
      } else if (kind === 'short') {
        g.moveTo(-7, -2.8); g.lineTo(-4, 0); g.lineTo(-7, 2.8);
        g.moveTo(7, -2.8); g.lineTo(4, 0); g.lineTo(7, 2.8);
        g.moveTo(-1.5, 0); g.lineTo(1.5, 0); g.stroke();
      } else if (kind === 'multi') {
        g.arc(0, -2.2, 1.9, 0, Math.PI * 2); g.moveTo(-2.3, 2.4);
        g.arc(-4.2, 2.4, 1.9, 0, Math.PI * 2); g.moveTo(6.1, 2.4);
        g.arc(4.2, 2.4, 1.9, 0, Math.PI * 2); g.fill();
      } else if (kind === 'laser') {
        g.moveTo(-3.5, 3.5); g.lineTo(-3.5, -3.5); g.moveTo(3.5, 3.5); g.lineTo(3.5, -3.5); g.stroke();
        g.beginPath(); g.moveTo(-3.5, -5.5); g.lineTo(-3.5, -4.6); g.moveTo(3.5, -5.5); g.lineTo(3.5, -4.6); g.stroke();
      } else if (kind === 'slow') {
        g.lineWidth = 1.5;
        g.arc(0, 0, 4.6, 0, Math.PI * 2); g.moveTo(0, -2.6); g.lineTo(0, 0); g.lineTo(2.2, 1.2); g.stroke();
      } else if (kind === 'fire') {
        g.moveTo(0, -5.5);
        g.quadraticCurveTo(5, -0.5, 3.4, 3.2); g.quadraticCurveTo(0, 6.4, -3.4, 3.2); g.quadraticCurveTo(-5, -0.5, 0, -5.5);
        g.fill();
      } else if (kind === 'sticky') {
        g.lineWidth = 2.2; g.lineCap = 'butt';
        g.moveTo(-4, -4.5); g.lineTo(-4, 0); g.arc(0, 0, 4, Math.PI, 0, true); g.lineTo(4, -4.5); g.stroke();
      } else if (kind === 'life') {
        g.lineWidth = 2.4;
        g.moveTo(-4.5, 0); g.lineTo(4.5, 0); g.moveTo(0, -4.5); g.lineTo(0, 4.5); g.stroke();
      }
    }
    const SPR = {};
    const SPR_W = CAP_W + 20, SPR_H = CAP_H + 20;
    for (const k of KIND_IDS) {
      const col = KINDS[k].col;
      const o = offscreen(SPR_W, SPR_H), g = o.g;
      g.shadowColor = rgba(col, 0.7); g.shadowBlur = 10;
      g.fillStyle = col;
      api.roundRect(g, 10, 10, CAP_W, CAP_H, CAP_H / 2); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = mix(col, 0.55); g.lineWidth = 1;
      api.roundRect(g, 10.5, 10.5, CAP_W - 1, CAP_H - 1, (CAP_H - 1) / 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(16, 12.5, CAP_W - 12, 1.2);
      if (k === 'short') {
        // hachures sombres : se repère au premier coup d'oeil
        g.save(); api.roundRect(g, 10, 10, CAP_W, CAP_H, CAP_H / 2); g.clip();
        g.strokeStyle = 'rgba(13,17,23,0.22)'; g.lineWidth = 2;
        g.beginPath(); for (let x = 4; x < 40; x += 6) { g.moveTo(x, 26); g.lineTo(x + 14, 8); } g.stroke();
        g.restore();
      }
      g.save(); g.translate(10 + CAP_W / 2, 10 + CAP_H / 2);
      glyph(g, k, k === 'laser' ? '#F2F8FF' : C.bg);
      g.restore();
      SPR[k] = o.c;
    }
    function halo(rgb) {
      const s = R * 8, o = offscreen(s, s);
      const gr = o.g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(' + rgb + ',0.3)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      o.g.fillStyle = gr; o.g.fillRect(0, 0, s, s);
      return o.c;
    }
    const HALO = halo('56,189,248'), HALO_FIRE = halo('255,166,87');

    function layout(n) {
      const rows = Math.min(8, 4 + n);
      const maxHp = Math.min(3, n + 1);
      const out = [];
      let seed = n * 9301 + 49297;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      const holes = {};
      if (n >= 3) {
        for (let r = 0; r < rows; r++) for (let c = 0; c < COLS / 2; c++) if (rnd() < 0.16) { holes[r + ':' + c] = 1; holes[r + ':' + (COLS - 1 - c)] = 1; }
      }
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < COLS; c++) {
          if (holes[r + ':' + c]) continue;
          if (n === 2 && (c === 4 || c === 5) && r > 1) continue;
          const hp = Math.max(1, maxHp - Math.floor(r * maxHp / rows));
          out.push({ x: MX + c * (BW + GAP), y: TOP + r * (BH + GAP), hp, max: hp, row: r, flash: 0 });
        }
      }
      return out;
    }

    const baseSpeed = () => 340 + (level - 1) * 30;
    const padTarget = () => PADW * (pw.wide > 0 ? 1.6 : 1) * (pw.short > 0 ? 0.6 : 1);
    const anyHeld = () => balls.some((b) => b.held);

    function reset() {
      level = 1; lives = 3; score = 0;
      pad = { x: W / 2, v: 0, squash: 0 };
      padW = PADW;
      prevPadX = pad.x; tx = pad.x;
      keys = { l: false, r: false };
      bricks = layout(level); dying = [];
      labels = [];
      fx.clear();
      clearPowers();
      stick();
      api.hud({ score: 0 });
    }
    // retire tous les bonus actifs et les objets en vol
    function clearPowers() {
      pw = { wide: 0, laser: 0, slow: 0, fire: 0, short: 0 };
      sticky = 0; speedMul = 1; caps = []; shots = []; shotCd = 0; emberTick = 0;
    }
    function newBall(x, y, vx, vy, sp) {
      return { x, y, px: x, py: y, vx, vy, sp, held: false, off: 0, holdT: 0, auto: false, trail: [], tt: 0 };
    }
    function stick() {
      const b = newBall(pad.x, PADY - R - 1, 0, 0, baseSpeed());
      b.held = true;
      balls = [b];
    }
    // lâche toutes les balles tenues sur la raquette
    function release() {
      if (state !== 'play') return false;
      let any = false;
      const half = padW / 2;
      for (const b of balls) {
        if (!b.held) continue;
        any = true; b.held = false;
        const rel = api.clamp(b.off / half, -1, 1);
        const a = api.clamp(rel * 1.0 + (Math.random() - 0.5) * 0.4 * (1 - Math.abs(rel)) + pad.v * 0.0004, -1.1, 1.1);
        b.vx = Math.sin(a) * b.sp; b.vy = -Math.cos(a) * b.sp;
      }
      if (any) api.sfx('flip');
      return any;
    }
    function fire() {
      if (state !== 'play' || pw.laser <= 0 || shotCd > 0) return;
      shotCd = SHOT_CD;
      const off = padW / 2 - 6;
      shots.push({ x: pad.x - off, y: PADY - 6, py: PADY - 6 }, { x: pad.x + off, y: PADY - 6, py: PADY - 6 });
      api.tone(1180, 0.05, 'square', 0.12, 0.6);
    }
    function action() {
      if (release()) return;
      fire();
    }

    function syncStatus() {
      let s = api.t('Niveau ' + level + ' · ' + lives + (lives > 1 ? ' vies' : ' vie'), 'Level ' + level + ' · ' + lives + (lives === 1 ? ' life' : ' lives'));
      const on = [];
      for (const k of TIMED) if (pw[k] > 0) on.push(api.t(KINDS[k].fr, KINDS[k].en));
      if (sticky > 0) on.push(api.t(KINDS.sticky.fr, KINDS.sticky.en) + ' x' + sticky);
      if (on.length) s += ' · ' + on.join(', ');
      api.status(s);
    }

    function start() {
      const now = performance.now();
      if (now - lastStart < 350) return;
      lastStart = now; runId++;
      reset();
      state = 'play'; banner = { text: api.t('Niveau 1', 'Level 1'), t: 0 };
      syncStatus();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      loop.start();
    }

    /* ── Bonus ───────────────────────────────────────────────────── */
    function rollKind() {
      let r = Math.random() * WEIGHT;
      for (const k of KIND_IDS) { r -= KINDS[k].w; if (r <= 0) return k; }
      return 'wide';
    }
    function maybeDrop(cx, cy) {
      if (caps.length >= 3 || Math.random() >= DROP) return;
      let k = rollKind();
      if (k === 'multi' && balls.length >= MAX_BALLS) k = 'wide';
      caps.push({ x: api.clamp(cx, CAP_W / 2 + 2, W - CAP_W / 2 - 2), y: cy, py: cy, kind: k, t: 0 });
    }
    function label(x, y, kind, prefix) {
      const K = KINDS[kind];
      // décale vers le haut si un autre libellé vient d'apparaître
      for (const l of labels) if (l.t < 0.5 && Math.abs(l.y - y) < 26) y = l.y - 30;
      labels.push({ x: api.clamp(x, 70, W - 70), y, t: 0, col: mix(K.col, 0.3), text: (prefix || '') + api.t(K.fr, K.en), sub: K.sfr ? api.t(K.sfr, K.sen) : '' });
    }
    function collect(c) {
      const k = c.kind, K = KINDS[k];
      fx.burst(c.x, PADY, { n: Math.round(14 * MANY), color: [K.col, '#fff'], speed: 150, life: 0.5, size: 2 });
      if (k === 'short') {
        api.tone(520, 0.12, 'sawtooth', 0.18, 0.55); api.after(90, () => api.tone(330, 0.16, 'sawtooth', 0.16, 0.6));
      } else {
        api.tone(660, 0.08, 'triangle', 0.35, 1.2); api.after(70, () => api.tone(990, 0.1, 'triangle', 0.32, 1.25)); api.after(140, () => api.tone(1320, 0.12, 'sine', 0.25));
      }
      score += 25; api.hud({ score });
      if (K.dur) {
        pw[k] = K.dur;
        if (k === 'wide') pw.short = 0;
        if (k === 'short') pw.wide = 0;
      }
      if (k === 'multi') split();
      else if (k === 'sticky') sticky = 3;
      else if (k === 'life') {
        if (lives < MAX_LIVES) lives++; else { score += 100; api.hud({ score }); }
      }
      label(c.x, PADY - 22, k);
      syncStatus();
    }
    // chaque balle libre se divise en trois
    function split() {
      if (!balls.some((b) => !b.held)) release();
      const add = [];
      for (const b of balls) {
        if (b.held) continue;
        for (const da of [-0.42, 0.42]) {
          if (balls.length + add.length >= MAX_BALLS) break;
          const c = Math.cos(da), s = Math.sin(da);
          const nb = newBall(b.x, b.y, b.vx * c - b.vy * s, b.vx * s + b.vy * c, b.sp);
          add.push(nb);
        }
      }
      for (const nb of add) balls.push(nb);
    }

    function hitBrick(b, ball, kill) {
      if (kill) b.hp = 1;
      b.hp--; b.flash = 1;
      score += 10;
      const cx = b.x + BW / 2, cy = b.y + BH / 2;
      const col = ROW_COLS[b.row % ROW_COLS.length];
      if (b.hp <= 0) {
        score += 10 * level;
        dying.push({ x: b.x, y: b.y, col, t: 0 });
        fx.burst(cx, cy, { n: Math.round(12 * MANY), color: kill ? [C.warm, '#FFD8A8', col] : [col, '#fff', C.violet], speed: 170, life: 0.55, size: 2.2, gravity: 260 });
        api.tone(520 + (b.row % 5) * 70, 0.07, 'triangle', 0.32, 1.4);
        maybeDrop(cx, cy);
      } else {
        fx.burst(cx, cy, { n: Math.round(4 * MANY), color: col, speed: 90, life: 0.3, size: 1.8 });
        api.tone(380, 0.05, 'square', 0.15);
      }
      if (ball) ball.sp = Math.min(660, ball.sp + (kill ? 1.5 : 3.5));
      api.hud({ score });
    }

    // fait avancer une balle ; renvoie true si elle est tombée
    function stepBall(ball, dt) {
      const sp = ball.sp * speedMul;
      const dist = sp * dt;
      const n = Math.max(1, Math.ceil(dist / (R * 0.33)));
      const h = dt / n;
      const onFire = pw.fire > 0;
      for (let i = 0; i < n; i++) {
        // garde la norme de la vitesse
        const m = Math.hypot(ball.vx, ball.vy) || 1;
        ball.vx = ball.vx / m * sp; ball.vy = ball.vy / m * sp;
        ball.x += ball.vx * h; ball.y += ball.vy * h;

        if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx); wall(); }
        else if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx); wall(); }
        if (ball.y < CEIL + R) { ball.y = CEIL + R; ball.vy = Math.abs(ball.vy); wall(); }

        // raquette
        const half = padW / 2;
        if (ball.vy > 0 && ball.y + R >= PADY && ball.y - R <= PADY + PADH && ball.x >= pad.x - half - R && ball.x <= pad.x + half + R) {
          const rel = api.clamp((ball.x - pad.x) / half, -1, 1);
          const ang = rel * 1.08 + api.clamp(pad.v * 0.00025, -0.18, 0.18);
          const a = api.clamp(ang, -1.15, 1.15);
          ball.vx = Math.sin(a) * sp; ball.vy = -Math.cos(a) * sp;
          ball.y = PADY - R;
          pad.squash = 1;
          api.tone(300 + Math.abs(rel) * 120, 0.06, 'sine', 0.4, 1.3);
          fx.burst(ball.x, PADY, { n: Math.round(5 * MANY), color: C.cyan, speed: 90, life: 0.3, size: 1.6 });
          if (sticky > 0) {
            // aimant : la balle reste collée là où elle a touché
            sticky--;
            ball.held = true; ball.auto = true; ball.holdT = 0;
            ball.off = api.clamp(ball.x - pad.x, -half + R, half - R);
            ball.y = PADY - R - 1;
            api.tone(220, 0.08, 'sine', 0.3, 1.6);
            syncStatus();
            return false;
          }
        }

        if (onFire) {
          // balle de feu : traverse et détruit tout ce qu'elle touche
          for (let j = 0; j < bricks.length; j++) {
            const b = bricks[j];
            if (b.hp <= 0) continue;
            const nx = api.clamp(ball.x, b.x, b.x + BW), ny = api.clamp(ball.y, b.y, b.y + BH);
            const dx = ball.x - nx, dy = ball.y - ny;
            if (dx * dx + dy * dy <= R * R) hitBrick(b, ball, true);
          }
        } else {
          // briques : une seule par sous-pas
          for (let j = 0; j < bricks.length; j++) {
            const b = bricks[j];
            if (b.hp <= 0) continue;
            const nx = api.clamp(ball.x, b.x, b.x + BW), ny = api.clamp(ball.y, b.y, b.y + BH);
            const dx = ball.x - nx, dy = ball.y - ny;
            if (dx * dx + dy * dy > R * R) continue;
            const ox = R + BW / 2 - Math.abs(ball.x - (b.x + BW / 2));
            const oy = R + BH / 2 - Math.abs(ball.y - (b.y + BH / 2));
            if (ox < oy) { ball.vx = ball.x < b.x + BW / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx); ball.x += ball.vx > 0 ? ox : -ox; }
            else { ball.vy = ball.y < b.y + BH / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy); ball.y += ball.vy > 0 ? oy : -oy; }
            hitBrick(b, ball, false);
            break;
          }
        }

        // évite les trajectoires presque horizontales
        if (Math.abs(ball.vy) < sp * 0.22) ball.vy = (ball.vy < 0 ? -1 : 1) * sp * 0.22;

        if (ball.y - R > H) return true;
      }
      return false;
    }
    function wall() { api.tone(240, 0.03, 'sine', 0.18); }

    function loseLife(x) {
      lives--;
      api.shake(5); api.sfx('error');
      fx.burst(api.clamp(x, 10, W - 10), H - 4, { n: Math.round(18 * MANY), color: [C.bad, C.warm], speed: 200, life: 0.6 });
      clearPowers();
      syncStatus();
      if (lives <= 0) return gameOver();
      stick();
    }
    function levelUp() {
      level++;
      state = 'between';
      api.sfx('win');
      banner = { text: api.t('Niveau ' + level, 'Level ' + level), t: 0 };
      clearPowers();
      syncStatus();
      stick();
      const id = runId;
      api.after(1100, () => {
        if (id !== runId || state !== 'between') return;
        bricks = layout(level); dying = [];
        state = 'play';
      });
    }
    function gameOver() {
      state = 'over'; overAt = performance.now();
      api.sfx('lose');
      const record = api.setBest(score);
      const id = runId;
      api.after(800, () => {
        if (id !== runId || state !== 'over') return;
        api.overlay({
          kicker: record && score > 0 ? api.t('Nouveau record', 'New best') : '',
          title: api.t('Partie terminée', 'Game over'),
          text: api.t(score + ' points · niveau ' + level, score + ' points · level ' + level),
          action: api.t('Rejouer', 'Play again'),
          tone: record && score > 0 ? 'good' : '',
          onAction: start,
        });
      });
    }

    function updatePowers(dt) {
      let changed = false;
      for (const k of TIMED) {
        if (pw[k] <= 0) continue;
        pw[k] -= dt;
        if (pw[k] <= 0) { pw[k] = 0; changed = true; }
      }
      if (changed) { syncStatus(); api.tone(440, 0.08, 'sine', 0.2, 0.7); }
      speedMul += ((pw.slow > 0 ? 0.65 : 1) - speedMul) * (1 - Math.exp(-dt * 3));
      shotCd = Math.max(0, shotCd - dt);

      // capsules qui tombent
      for (let i = caps.length - 1; i >= 0; i--) {
        const c = caps[i];
        c.t += dt; c.y += CAP_V * dt;
        if (c.y + CAP_H / 2 >= PADY && c.y - CAP_H / 2 <= PADY + PADH && Math.abs(c.x - pad.x) <= padW / 2 + CAP_W / 2) { caps.splice(i, 1); collect(c); continue; }
        if (c.y - CAP_H > H) caps.splice(i, 1);
      }
      // tirs laser
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.y -= SHOT_V * dt;
        let gone = s.y < CEIL;
        if (!gone) {
          for (let j = 0; j < bricks.length; j++) {
            const b = bricks[j];
            if (b.hp <= 0) continue;
            if (s.x >= b.x && s.x <= b.x + BW && s.y <= b.y + BH && s.y + SHOT_L >= b.y) {
              hitBrick(b, null, false);
              fx.burst(s.x, b.y + BH, { n: Math.round(3 * MANY), color: ['#CFE3FF', C.cyan], speed: 80, life: 0.25, size: 1.5 });
              gone = true; break;
            }
          }
        }
        if (gone) shots.splice(i, 1);
      }
    }

    const loop = api.loop({
      update(dt) {
        fx.update(dt);
        if (banner) { banner.t += dt; if (banner.t > 1.4) banner = null; }
        for (const b of bricks) if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 6);
        for (let i = dying.length - 1; i >= 0; i--) { dying[i].t += dt; if (dying[i].t > 0.22) dying.splice(i, 1); }
        for (let i = labels.length - 1; i >= 0; i--) { labels[i].t += dt; if (labels[i].t > 1.3) labels.splice(i, 1); }
        pad.squash = Math.max(0, pad.squash - dt * 6);
        prevPadX = pad.x;
        for (const b of balls) { b.px = b.x; b.py = b.y; }
        for (const s of shots) s.py = s.y;
        for (const c of caps) c.py = c.y;
        if (state === 'over' || state === 'ready') return;

        // largeur de raquette : transition douce
        padW += (padTarget() - padW) * (1 - Math.exp(-dt * 8));
        if (keys.l) tx -= 620 * dt;
        if (keys.r) tx += 620 * dt;
        tx = api.clamp(tx, padW / 2, W - padW / 2);
        const nx = pad.x + (tx - pad.x) * (1 - Math.exp(-dt * 24));
        pad.v = pad.v * 0.8 + ((nx - pad.x) / dt) * 0.2;
        pad.x = api.clamp(nx, padW / 2, W - padW / 2);

        const half = padW / 2;
        for (const b of balls) {
          if (!b.held) continue;
          b.off = api.clamp(b.off, -half + R, half - R);
          b.x = pad.x + b.off; b.y = PADY - R - 1;
        }
        if (state !== 'play') return;

        updatePowers(dt);

        let lastX = W / 2;
        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i];
          if (b.held) {
            b.holdT += dt;
            if (b.auto && b.holdT > HOLD_MAX) release();
            continue;
          }
          if (stepBall(b, dt)) { lastX = b.x; balls.splice(i, 1); continue; }
          if (++b.tt % 2 === 0) {
            b.trail.push(b.x, b.y);
            const max = api.reduced ? 0 : (pw.fire > 0 ? 13 : 9);
            while (b.trail.length > max * 2) b.trail.splice(0, 2);
          }
        }
        if (balls.length === 0) return loseLife(lastX);

        // braises de la balle de feu
        if (pw.fire > 0 && !api.reduced && ++emberTick % 5 === 0) {
          for (const b of balls) if (!b.held) fx.burst(b.x, b.y, { n: 1, color: [C.warm, '#FFD8A8'], speed: 40, life: 0.35, size: 1.6 });
        }
        if (bricks.every((b) => b.hp <= 0)) levelUp();
      },
      render(alpha) {
        cv.clear(C.bg);
        // fond : lignes fines
        ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 40; x < W; x += 40) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
        ctx.stroke();
        ctx.strokeStyle = C.line;
        ctx.beginPath(); ctx.moveTo(0, 40.5); ctx.lineTo(W, 40.5); ctx.stroke();

        drawHeader();

        // briques
        for (const b of bricks) {
          if (b.hp <= 0) continue;
          const col = ROW_COLS[b.row % ROW_COLS.length];
          const op = [0, 0.38, 0.66, 1][b.hp];
          ctx.globalAlpha = op;
          ctx.fillStyle = col;
          api.roundRect(ctx, b.x, b.y, BW, BH, 5); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(255,255,255,' + (0.1 + 0.12 * op) + ')';
          ctx.fillRect(b.x + 5, b.y + 3, BW - 10, 2);
          if (b.max > 1) {
            ctx.strokeStyle = rgba(col, 0.5); ctx.lineWidth = 1;
            api.roundRect(ctx, b.x + 0.5, b.y + 0.5, BW - 1, BH - 1, 5); ctx.stroke();
          }
          if (b.flash > 0) {
            ctx.globalAlpha = b.flash * 0.7; ctx.fillStyle = '#fff';
            api.roundRect(ctx, b.x, b.y, BW, BH, 5); ctx.fill(); ctx.globalAlpha = 1;
          }
        }
        for (const d of dying) {
          const k = d.t / 0.22, s = 1 + k * 0.25;
          ctx.globalAlpha = 1 - k; ctx.fillStyle = d.col;
          api.roundRect(ctx, d.x + BW / 2 - BW * s / 2, d.y + BH / 2 - BH * s / 2, BW * s, BH * s, 5); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // capsules
        for (const c of caps) {
          const cy = c.py + (c.y - c.py) * alpha;
          const wob = api.reduced ? 0 : Math.sin(c.t * 7) * 0.08;
          ctx.save(); ctx.translate(c.x, cy); ctx.rotate(wob);
          ctx.drawImage(SPR[c.kind], -SPR_W / 2, -SPR_H / 2, SPR_W, SPR_H);
          ctx.restore();
        }

        // tirs laser
        if (shots.length) {
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(56,189,248,0.25)'; ctx.lineWidth = 5;
          ctx.beginPath();
          for (const s of shots) { const sy = s.py + (s.y - s.py) * alpha; ctx.moveTo(s.x, sy); ctx.lineTo(s.x, sy + SHOT_L); }
          ctx.stroke();
          ctx.strokeStyle = '#E9F4FF'; ctx.lineWidth = 2;
          ctx.beginPath();
          for (const s of shots) { const sy = s.py + (s.y - s.py) * alpha; ctx.moveTo(s.x, sy); ctx.lineTo(s.x, sy + SHOT_L); }
          ctx.stroke();
        }

        // raquette
        const px = prevPadX + (pad.x - prevPadX) * alpha;
        const sq = pad.squash;
        const pcol = pw.short > 0 ? C.bad : C.cyan;
        const pw2 = padW * (1 + sq * 0.06), ph = PADH * (1 - sq * 0.25);
        const gr = padW * 0.8;
        const glow = ctx.createRadialGradient(px, PADY + PADH / 2, 0, px, PADY + PADH / 2, gr);
        glow.addColorStop(0, pw.short > 0 ? 'rgba(255,123,114,0.18)' : 'rgba(56,189,248,0.18)'); glow.addColorStop(1, 'rgba(56,189,248,0)');
        ctx.fillStyle = glow; ctx.fillRect(px - gr, PADY + PADH / 2 - gr, gr * 2, gr * 2);
        if (pw.laser > 0) {
          // deux petits canons aux extrémités
          const off = padW / 2 - 6;
          ctx.fillStyle = mix(C.blue, 0.35);
          for (const sx of [px - off, px + off]) { api.roundRect(ctx, sx - 2.5, PADY - 6, 5, 9, 1.5); ctx.fill(); }
          ctx.fillStyle = '#E9F4FF';
          for (const sx of [px - off, px + off]) ctx.fillRect(sx - 1, PADY - 6, 2, 2);
        }
        ctx.fillStyle = pcol;
        api.roundRect(ctx, px - pw2 / 2, PADY + (PADH - ph), pw2, ph, ph / 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(px - pw2 / 2 + 10, PADY + (PADH - ph) + 2, Math.max(0, pw2 - 20), 1.5);
        if (sticky > 0) {
          ctx.fillStyle = KINDS.sticky.col;
          for (let i = 0; i < sticky; i++) ctx.fillRect(px - 9 + i * 7, PADY + PADH - 3, 4, 2);
        }

        // balles et traînées
        if (state !== 'over') {
          const hot = pw.fire > 0;
          const tc = hot ? C.warm : C.cyan;
          ctx.fillStyle = tc;
          for (const b of balls) {
            const tl = b.trail, n = tl.length / 2;
            for (let i = 0; i < n; i++) {
              const k = (i + 1) / (n + 1);
              ctx.globalAlpha = k * (hot ? 0.45 : 0.22);
              ctx.beginPath(); ctx.arc(tl[i * 2], tl[i * 2 + 1], R * (0.4 + 0.6 * k), 0, Math.PI * 2); ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
          for (const b of balls) {
            const bx = b.px + (b.x - b.px) * alpha, by = b.py + (b.y - b.py) * alpha;
            ctx.drawImage(hot ? HALO_FIRE : HALO, bx - R * 4, by - R * 4, R * 8, R * 8);
            ctx.fillStyle = hot ? '#FFE2C2' : '#E9FCFF';
            ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.fill();
            if (hot) { ctx.fillStyle = C.warm; ctx.beginPath(); ctx.arc(bx, by, R * 0.45, 0, Math.PI * 2); ctx.fill(); }
          }
        }

        fx.draw(ctx);

        // libellés flottants des bonus
        ctx.textAlign = 'center';
        for (const l of labels) {
          const k = l.t / 1.3;
          ctx.globalAlpha = k < 0.15 ? k / 0.15 : k > 0.6 ? Math.max(0, (1 - k) / 0.4) : 1;
          const y = l.y - api.ease.out(Math.min(1, k * 1.4)) * 28;
          ctx.fillStyle = l.col; ctx.font = '750 14px ' + api.font;
          ctx.fillText(l.text, l.x, y);
          if (l.sub) { ctx.fillStyle = C.muted; ctx.font = '500 11px ' + api.font; ctx.fillText(l.sub, l.x, y + 14); }
        }
        ctx.globalAlpha = 1;

        if (state === 'play' && !banner && anyHeld()) {
          ctx.fillStyle = C.muted; ctx.font = '500 13px ' + api.font; ctx.textAlign = 'center';
          ctx.fillText(api.t('Espace, clic ou toucher pour lancer', 'Space, click or tap to launch'), W / 2, PADY - 56);
        }
        if (banner) {
          const k = banner.t / 1.4;
          const a = k < 0.2 ? k / 0.2 : k > 0.7 ? (1 - k) / 0.3 : 1;
          ctx.globalAlpha = a;
          ctx.fillStyle = C.ink; ctx.font = '750 30px ' + api.font; ctx.textAlign = 'center';
          ctx.fillText(banner.text, W / 2, H * 0.62 - (1 - api.ease.out(Math.min(1, k * 3))) * 10);
          ctx.globalAlpha = 1;
        }
      },
    });

    function drawHeader() {
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.muted; ctx.font = '600 13px ' + api.font; ctx.textAlign = 'left';
      ctx.fillText(api.t('Niveau ', 'Level ') + level, 22, 21);
      const slots = Math.max(3, lives);
      for (let i = 0; i < slots; i++) {
        const x = W - 26 - i * 18;
        ctx.beginPath(); ctx.arc(x, 21, 4.5, 0, Math.PI * 2);
        if (i < lives) { ctx.fillStyle = C.cyan; ctx.fill(); }
        else { ctx.strokeStyle = C.faint; ctx.lineWidth = 1.2; ctx.stroke(); }
      }
      // bonus actifs : pastilles au centre, barres de temps en haut
      let n = 0;
      for (const k of TIMED) if (pw[k] > 0) n++;
      if (sticky > 0) n++;
      if (n) {
        const step = 32, sw = SPR_W * 0.8, sh = SPR_H * 0.8;
        let x = W / 2 - (n - 1) * step / 2, bar = 0;
        for (const k of TIMED) {
          if (pw[k] <= 0) continue;
          const left = pw[k], blink = left < 2 && !api.reduced ? 0.55 + 0.45 * Math.sin(left * 18) : 1;
          ctx.globalAlpha = blink;
          ctx.drawImage(SPR[k], x - sw / 2, 21 - sh / 2, sw, sh);
          ctx.globalAlpha = 1;
          ctx.fillStyle = KINDS[k].col;
          ctx.fillRect(0, bar * 3.5, W * (left / KINDS[k].dur), 2.5);
          x += step; bar++;
        }
        if (sticky > 0) {
          ctx.drawImage(SPR.sticky, x - sw / 2, 21 - sh / 2, sw, sh);
          ctx.fillStyle = C.ink; ctx.font = '700 10px ' + api.font; ctx.textAlign = 'left';
          ctx.fillText(String(sticky), x + 11, 28);
        }
      }
      ctx.textBaseline = 'alphabetic';
    }

    /* ── Entrées ─────────────────────────────────────────────────── */
    function toLocal(cx, cy) {
      const r = cv.el.getBoundingClientRect();
      const s = Math.min(r.width / W, r.height / H);
      return { x: (cx - (r.left + (r.width - W * s) / 2)) / s, y: (cy - (r.top + (r.height - H * s) / 2)) / s };
    }
    api.on(cv.el, 'pointermove', (e) => { if (state === 'play' || state === 'between') tx = toLocal(e.clientX, e.clientY).x; });
    api.on(cv.el, 'pointerdown', (e) => {
      if (state !== 'play' && state !== 'between') return;
      tx = toLocal(e.clientX, e.clientY).x;
      if (state === 'play') action();
    });
    api.onKey((e) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'q' || k === 'a') keys.l = true;
      else if (k === 'ArrowRight' || k === 'd') keys.r = true;
      else if (k === ' ' || k === 'Enter' || k === 'ArrowUp') {
        if (state === 'play') action();
        else if ((state === 'ready' || (state === 'over' && performance.now() - overAt > 900)) && k !== 'ArrowUp') { api.hideOverlay(); start(); }
      }
    });
    api.on(document, 'keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'q' || e.key === 'a') keys.l = false;
      else if (e.key === 'ArrowRight' || e.key === 'd') keys.r = false;
    });
    api.on(window, 'blur', () => { keys.l = keys.r = false; });

    // écran d'accueil
    reset(); state = 'ready';
    loop.start();
    api.overlay({
      title: api.t('Casse-briques', 'Breakout'),
      text: api.t('Renvoyez la balle et brisez tous les blocs. Trois vies. Des capsules bonus tombent parfois : attrapez-les, mais évitez la rouge.', 'Keep the ball in play and break every block. Three lives. Bonus capsules sometimes drop: catch them, but dodge the red one.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart() { lastStart = -1e9; start(); } };
  },
});

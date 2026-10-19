/* ==================================================================
   games/breakout.js · Casse-briques
   Physique au pas fixe avec sous-pas : la balle n'avance jamais de
   plus d'un tiers de son rayon entre deux tests de collision, elle
   ne traverse donc aucune brique, même à pleine vitesse.
   ================================================================== */
SBG.register('breakout', {
  create(api) {
    const { C } = api;
    const W = 520, H = 440;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();
    const MANY = api.reduced ? 0.4 : 1;

    const COLS = 10, MX = 22, GAP = 6, TOP = 62, CEIL = 41;
    const BW = (W - MX * 2 - GAP * (COLS - 1)) / COLS, BH = 16;
    const PADW = 92, PADH = 12, PADY = H - 34, R = 6;
    const ROW_COLS = [C.violet, '#9F86FF', '#8E8FFF', C.blue, '#7FA3FF', '#8FB6FF', '#9CC6FF', '#A8D4FF'];

    let bricks, dying, ball, prevBall, pad, prevPadX, tx, keys, lives, level, score, state, stuck, trail, trailTick, banner, lastStart = -1e9, runId = 0;

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

    function reset() {
      level = 1; lives = 3; score = 0;
      pad = { x: W / 2, v: 0, squash: 0 };
      prevPadX = pad.x; tx = pad.x;
      keys = { l: false, r: false };
      bricks = layout(level); dying = [];
      fx.clear();
      stick();
      api.hud({ score: 0 });
    }
    function stick() {
      stuck = true;
      ball = { x: pad.x, y: PADY - R - 1, vx: 0, vy: 0, sp: baseSpeed() };
      prevBall = { x: ball.x, y: ball.y };
      trail = []; trailTick = 0;
    }
    function launch() {
      if (state !== 'play' || !stuck) return;
      stuck = false;
      const a = (Math.random() * 0.5 - 0.25) + (pad.v * 0.0004);
      ball.vx = Math.sin(a) * ball.sp; ball.vy = -Math.cos(a) * ball.sp;
      api.sfx('flip');
    }
    function syncStatus() {
      api.status(api.t('Niveau ' + level + ' · ' + lives + (lives > 1 ? ' vies' : ' vie'), 'Level ' + level + ' · ' + lives + (lives === 1 ? ' life' : ' lives')));
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

    function hitBrick(b) {
      b.hp--; b.flash = 1;
      score += 10;
      const cx = b.x + BW / 2, cy = b.y + BH / 2;
      const col = ROW_COLS[b.row % ROW_COLS.length];
      if (b.hp <= 0) {
        score += 10 * level;
        dying.push({ x: b.x, y: b.y, col, t: 0 });
        fx.burst(cx, cy, { n: Math.round(12 * MANY), color: [col, '#fff', C.violet], speed: 170, life: 0.55, size: 2.2, gravity: 260 });
        api.tone(520 + (b.row % 5) * 70, 0.07, 'triangle', 0.32, 1.4);
      } else {
        fx.burst(cx, cy, { n: Math.round(4 * MANY), color: col, speed: 90, life: 0.3, size: 1.8 });
        api.tone(380, 0.05, 'square', 0.15);
      }
      ball.sp = Math.min(660, ball.sp + 3.5);
      api.hud({ score });
    }

    function step(dt) {
      const dist = ball.sp * dt;
      const n = Math.max(1, Math.ceil(dist / (R * 0.33)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        // garde la norme de la vitesse
        const m = Math.hypot(ball.vx, ball.vy) || 1;
        ball.vx = ball.vx / m * ball.sp; ball.vy = ball.vy / m * ball.sp;
        ball.x += ball.vx * h; ball.y += ball.vy * h;

        if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx); wall(); }
        else if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx); wall(); }
        if (ball.y < CEIL + R) { ball.y = CEIL + R; ball.vy = Math.abs(ball.vy); wall(); }

        // raquette
        const half = PADW / 2;
        if (ball.vy > 0 && ball.y + R >= PADY && ball.y - R <= PADY + PADH && ball.x >= pad.x - half - R && ball.x <= pad.x + half + R) {
          const rel = api.clamp((ball.x - pad.x) / half, -1, 1);
          const ang = rel * 1.08 + api.clamp(pad.v * 0.00025, -0.18, 0.18);
          const a = api.clamp(ang, -1.15, 1.15);
          ball.vx = Math.sin(a) * ball.sp; ball.vy = -Math.cos(a) * ball.sp;
          ball.y = PADY - R;
          pad.squash = 1;
          api.tone(300 + Math.abs(rel) * 120, 0.06, 'sine', 0.4, 1.3);
          fx.burst(ball.x, PADY, { n: Math.round(5 * MANY), color: C.cyan, speed: 90, life: 0.3, size: 1.6 });
        }

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
          hitBrick(b);
          break;
        }

        // évite les trajectoires presque horizontales
        if (Math.abs(ball.vy) < ball.sp * 0.22) ball.vy = (ball.vy < 0 ? -1 : 1) * ball.sp * 0.22;

        if (ball.y - R > H) return loseLife();
      }
      if (bricks.every((b) => b.hp <= 0)) levelUp();
    }
    function wall() { api.tone(240, 0.03, 'sine', 0.18); }

    function loseLife() {
      lives--;
      api.shake(5); api.sfx('error');
      fx.burst(api.clamp(ball.x, 10, W - 10), H - 4, { n: Math.round(18 * MANY), color: [C.bad, C.warm], speed: 200, life: 0.6 });
      syncStatus();
      if (lives <= 0) return gameOver();
      stick();
    }
    function levelUp() {
      level++;
      state = 'between';
      api.sfx('win');
      banner = { text: api.t('Niveau ' + level, 'Level ' + level), t: 0 };
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
      state = 'over';
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

    const loop = api.loop({
      update(dt) {
        fx.update(dt);
        if (banner) { banner.t += dt; if (banner.t > 1.4) banner = null; }
        for (const b of bricks) if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 6);
        for (let i = dying.length - 1; i >= 0; i--) { dying[i].t += dt; if (dying[i].t > 0.22) dying.splice(i, 1); }
        pad.squash = Math.max(0, pad.squash - dt * 6);
        prevPadX = pad.x;
        prevBall = { x: ball.x, y: ball.y };
        if (state === 'over' || state === 'ready') return;

        if (keys.l) tx -= 620 * dt;
        if (keys.r) tx += 620 * dt;
        tx = api.clamp(tx, PADW / 2, W - PADW / 2);
        const nx = pad.x + (tx - pad.x) * (1 - Math.exp(-dt * 24));
        pad.v = pad.v * 0.8 + ((nx - pad.x) / dt) * 0.2;
        pad.x = nx;

        if (stuck) { ball.x = pad.x; ball.y = PADY - R - 1; return; }
        if (state !== 'play') return;
        step(dt);
        if (++trailTick % 2 === 0) { trail.push({ x: ball.x, y: ball.y }); if (trail.length > (api.reduced ? 0 : 9)) trail.shift(); }
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

        // raquette
        const px = prevPadX + (pad.x - prevPadX) * alpha;
        const sq = pad.squash;
        const pw = PADW * (1 + sq * 0.06), ph = PADH * (1 - sq * 0.25);
        const glow = ctx.createRadialGradient(px, PADY + PADH / 2, 0, px, PADY + PADH / 2, PADW * 0.8);
        glow.addColorStop(0, 'rgba(56,230,255,0.18)'); glow.addColorStop(1, 'rgba(56,230,255,0)');
        ctx.fillStyle = glow; ctx.fillRect(px - PADW, PADY - 40, PADW * 2, 80);
        ctx.fillStyle = C.cyan;
        api.roundRect(ctx, px - pw / 2, PADY + (PADH - ph), pw, ph, ph / 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(px - pw / 2 + 10, PADY + (PADH - ph) + 2, pw - 20, 1.5);

        // balle et traînée
        if (state !== 'over') {
          const bx = prevBall.x + (ball.x - prevBall.x) * alpha, by = prevBall.y + (ball.y - prevBall.y) * alpha;
          for (let i = 0; i < trail.length; i++) {
            const k = (i + 1) / (trail.length + 1);
            ctx.globalAlpha = k * 0.22; ctx.fillStyle = C.cyan;
            ctx.beginPath(); ctx.arc(trail[i].x, trail[i].y, R * (0.4 + 0.6 * k), 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
          const bg = ctx.createRadialGradient(bx, by, 0, bx, by, R * 4);
          bg.addColorStop(0, 'rgba(56,230,255,0.28)'); bg.addColorStop(1, 'rgba(56,230,255,0)');
          ctx.fillStyle = bg; ctx.fillRect(bx - R * 4, by - R * 4, R * 8, R * 8);
          ctx.fillStyle = '#E9FCFF';
          ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.fill();
        }

        fx.draw(ctx);

        if (state === 'play' && stuck && !banner) {
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
      for (let i = 0; i < 3; i++) {
        const x = W - 26 - i * 18;
        ctx.beginPath(); ctx.arc(x, 21, 4.5, 0, Math.PI * 2);
        if (i < lives) { ctx.fillStyle = C.cyan; ctx.fill(); }
        else { ctx.strokeStyle = C.faint; ctx.lineWidth = 1.2; ctx.stroke(); }
      }
      ctx.textBaseline = 'alphabetic';
    }
    function rgba(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
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
      if (stuck && state === 'play') launch();
    });
    api.onKey((e) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'q' || k === 'a') keys.l = true;
      else if (k === 'ArrowRight' || k === 'd') keys.r = true;
      else if (k === ' ' || k === 'Enter' || k === 'ArrowUp') {
        if (state === 'play') launch();
        else if ((state === 'ready' || state === 'over') && k !== 'ArrowUp') { api.hideOverlay(); start(); }
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
      text: api.t('Renvoyez la balle et brisez tous les blocs. Trois vies.', 'Keep the ball in play and break every block. Three lives.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart() { lastStart = -1e9; start(); } };
  },
});

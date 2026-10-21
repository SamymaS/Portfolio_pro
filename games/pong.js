/* ==================================================================
   games/pong.js · Pong
   L'adversaire ne voit la balle qu'avec un temps de réaction, vise
   avec une petite erreur et plafonne sa vitesse : il est solide,
   mais une balle rapide et bien coupée le passe.
   ================================================================== */
SBG.register('pong', {
  create(api) {
    const { C } = api;
    const W = 540, H = 360;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();
    const MANY = api.reduced ? 0.4 : 1;

    const PW = 10, PH = 72, R = 7, M = 22, WIN = 5;
    const LX = M, RX = W - M - PW;
    const SERVE = 1.35;

    let overAt = 0, me, ai, ball, prevBall, prevMe, prevAi, ps, as, state, serveT, serveDir, rally, ty, keys, aiT, aiReact, aiErr, trail, flashL, flashR, lastStart = -1e9, runId = 0;

    function reset() {
      me = { y: H / 2, v: 0 }; ai = { y: H / 2, v: 0 };
      prevMe = me.y; prevAi = ai.y; ty = H / 2;
      ps = 0; as = 0; rally = 0;
      keys = { u: false, d: false };
      flashL = flashR = 0;
      fx.clear();
      serve(Math.random() < 0.5 ? -1 : 1);
      api.hud({ score: 0 });
    }
    function serve(dir) {
      serveDir = dir; serveT = 0; rally = 0;
      ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, sp: 330 };
      prevBall = { x: ball.x, y: ball.y };
      trail = [];
      aiT = 0; aiErr = 0; aiReact = H / 2;
      if (state === 'play' || state === 'serve') state = 'serve';
    }
    function launch() {
      const a = (Math.random() * 0.7 - 0.35);
      ball.vx = Math.cos(a) * ball.sp * serveDir;
      ball.vy = Math.sin(a) * ball.sp;
      state = 'play';
      api.tone(440, 0.06, 'triangle', 0.3);
    }
    function syncStatus() {
      api.status(api.t('Vous ' + ps + ' · ' + as + ' Ordinateur', 'You ' + ps + ' · ' + as + ' Computer'));
    }

    function start() {
      const now = performance.now();
      if (now - lastStart < 350) return;
      lastStart = now; runId++;
      state = 'serve';
      reset();
      syncStatus();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      loop.start();
    }

    // trajectoire prévue jusqu'à la colonne de l'ordinateur (rebonds compris)
    function predict() {
      if (ball.vx <= 0) return H / 2;
      const t = (RX - R - ball.x) / ball.vx;
      let y = ball.y + ball.vy * t;
      const span = H - 2 * R;
      y -= R;
      y = ((y % (2 * span)) + 2 * span) % (2 * span);
      if (y > span) y = 2 * span - y;
      return y + R;
    }

    function paddleHit(p, left) {
      const rel = api.clamp((ball.y - p.y) / (PH / 2), -1, 1);
      ball.sp = Math.min(880, ball.sp * 1.06 + 6);
      rally++;
      const a = rel * 0.95;
      ball.vx = Math.cos(a) * ball.sp * (left ? 1 : -1);
      ball.vy = Math.sin(a) * ball.sp + api.clamp(p.v * 0.22, -260, 260);
      const m = Math.hypot(ball.vx, ball.vy);
      ball.vx = ball.vx / m * ball.sp; ball.vy = ball.vy / m * ball.sp;
      if (Math.abs(ball.vx) < ball.sp * 0.55) {
        ball.vx = Math.sign(ball.vx) * ball.sp * 0.55;
        ball.vy = Math.sign(ball.vy || 1) * Math.sqrt(ball.sp * ball.sp - ball.vx * ball.vx);
      }
      ball.x = left ? LX + PW + R : RX - R;
      if (left) flashL = 1; else flashR = 1;
      api.tone(left ? 520 : 400, 0.06, 'square', 0.22, 1.2);
      fx.burst(ball.x, ball.y, { n: Math.round(7 * MANY), color: left ? C.cyan : C.violet, speed: 120, life: 0.35, size: 1.8 });
      if (left) aiErr = (Math.random() * 2 - 1) * (16 + ball.sp * 0.06 + Math.abs(ball.vy) * 0.12);
    }

    function point(playerScored) {
      if (playerScored) ps++; else as++;
      api.hud({ score: ps });
      syncStatus();
      const x = playerScored ? W - 4 : 4;
      fx.burst(x, api.clamp(ball.y, 10, H - 10), { n: Math.round(22 * MANY), color: playerScored ? [C.cyan, '#fff'] : [C.violet, C.bad], speed: 220, life: 0.6 });
      if (!playerScored) api.shake(4);
      if (ps >= WIN || as >= WIN) return end(ps >= WIN);
      api.sfx(playerScored ? 'score' : 'error');
      serve(playerScored ? 1 : -1);
    }

    function end(won) {
      state = 'over'; overAt = performance.now();
      if (won) { api.unlock('pong_win'); api.sfx('win'); } else api.sfx('lose');
      const record = api.setBest(ps);
      const id = runId;
      api.after(700, () => {
        if (id !== runId || state !== 'over') return;
        api.overlay({
          kicker: won ? api.t('Match gagné', 'Match won') : '',
          title: won ? api.t('Victoire', 'You win') : api.t('Défaite', 'You lose'),
          text: api.t(ps + ' à ' + as, ps + ' to ' + as),
          action: api.t('Rejouer', 'Play again'),
          tone: won ? 'good' : '',
          onAction: start,
        });
      });
      if (record) { /* record affiché dans l'en-tête */ }
    }

    function step(dt) {
      const dist = ball.sp * dt;
      const n = Math.max(1, Math.ceil(dist / 3));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        ball.x += ball.vx * h; ball.y += ball.vy * h;
        if (ball.y < R) { ball.y = R; ball.vy = Math.abs(ball.vy); api.tone(250, 0.03, 'sine', 0.15); }
        else if (ball.y > H - R) { ball.y = H - R; ball.vy = -Math.abs(ball.vy); api.tone(250, 0.03, 'sine', 0.15); }
        if (ball.vx < 0 && ball.x - R < LX + PW && ball.x + R > LX && Math.abs(ball.y - me.y) < PH / 2 + R) paddleHit(me, true);
        else if (ball.vx > 0 && ball.x + R > RX && ball.x - R < RX + PW && Math.abs(ball.y - ai.y) < PH / 2 + R) paddleHit(ai, false);
        if (ball.x < -R * 2) return point(false);
        if (ball.x > W + R * 2) return point(true);
      }
    }

    function movePaddles(dt) {
      // joueur
      if (keys.u) ty -= 520 * dt;
      if (keys.d) ty += 520 * dt;
      ty = api.clamp(ty, PH / 2, H - PH / 2);
      const ny = me.y + (ty - me.y) * (1 - Math.exp(-dt * 22));
      me.v = me.v * 0.8 + ((ny - me.y) / dt) * 0.2;
      me.y = ny;
      // ordinateur : ne relit la balle que tous les ~0,13 s
      aiT -= dt;
      if (aiT <= 0) {
        aiT = 0.11 + Math.random() * 0.06;
        aiReact = ball.vx > 0 && state === 'play' ? predict() + aiErr : H / 2 + (ball.y - H / 2) * 0.25;
      }
      const maxV = 270 + Math.min(50, rally * 4);
      const want = api.clamp((aiReact - ai.y) * 7, -maxV, maxV);
      ai.v += (want - ai.v) * Math.min(1, dt * 10);
      ai.y = api.clamp(ai.y + ai.v * dt, PH / 2, H - PH / 2);
    }

    const loop = api.loop({
      update(dt) {
        fx.update(dt);
        flashL = Math.max(0, flashL - dt * 4); flashR = Math.max(0, flashR - dt * 4);
        prevMe = me.y; prevAi = ai.y; prevBall = { x: ball.x, y: ball.y };
        if (state === 'ready' || state === 'over') return;
        movePaddles(dt);
        if (state === 'serve') { serveT += dt; if (serveT >= SERVE) launch(); return; }
        step(dt);
        if (!api.reduced) { trail.push({ x: ball.x, y: ball.y }); if (trail.length > 14) trail.shift(); }
      },
      render(alpha) {
        cv.clear(C.bg);
        // chiffres du score en filigrane
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '800 170px ' + api.font;
        ctx.fillStyle = 'rgba(56,189,248,0.055)'; ctx.fillText(String(ps), W / 4, H / 2 + 8);
        ctx.fillStyle = 'rgba(210,168,255,0.06)'; ctx.fillText(String(as), W * 3 / 4, H / 2 + 8);
        // filet
        ctx.fillStyle = C.line;
        for (let y = 8; y < H; y += 22) { api.roundRect(ctx, W / 2 - 1.5, y, 3, 11, 1.5); ctx.fill(); }
        ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 0.5); ctx.lineTo(W, 0.5); ctx.moveTo(0, H - 0.5); ctx.lineTo(W, H - 0.5); ctx.stroke();

        const my = prevMe + (me.y - prevMe) * alpha, ay = prevAi + (ai.y - prevAi) * alpha;
        paddle(LX, my, C.cyan, '56,189,248', flashL);
        paddle(RX, ay, C.violet, '210,168,255', flashR);

        // balle
        if (state === 'play' || state === 'serve') {
          const bx = prevBall.x + (ball.x - prevBall.x) * alpha, by = prevBall.y + (ball.y - prevBall.y) * alpha;
          if (trail.length > 1) {
            ctx.lineCap = 'round';
            for (let i = 1; i < trail.length; i++) {
              const k = i / trail.length;
              ctx.strokeStyle = 'rgba(233,252,255,' + (k * 0.18) + ')';
              ctx.lineWidth = R * 2 * k * 0.9;
              ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
            }
          }
          const pulse = state === 'serve' ? 1 + Math.sin(serveT * 10) * 0.12 : 1;
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, R * 4.5);
          g.addColorStop(0, 'rgba(233,252,255,0.25)'); g.addColorStop(1, 'rgba(233,252,255,0)');
          ctx.fillStyle = g; ctx.fillRect(bx - R * 5, by - R * 5, R * 10, R * 10);
          ctx.fillStyle = '#F2FDFF';
          ctx.beginPath(); ctx.arc(bx, by, R * pulse, 0, Math.PI * 2); ctx.fill();
        }

        if (state === 'serve') {
          const n = Math.ceil((SERVE - serveT) / (SERVE / 3));
          const k = ((SERVE - serveT) % (SERVE / 3)) / (SERVE / 3);
          ctx.globalAlpha = 0.25 + 0.6 * k;
          ctx.fillStyle = C.ink; ctx.font = '700 ' + Math.round(26 + 8 * (1 - k)) + 'px ' + api.font;
          ctx.fillText(String(Math.max(1, n)), W / 2, H / 2 - 44);
          ctx.globalAlpha = 1;
          // flèche de service
          ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
          const sx = W / 2 + serveDir * 22;
          ctx.beginPath(); ctx.moveTo(sx, H / 2 - 6); ctx.lineTo(sx + serveDir * 6, H / 2); ctx.lineTo(sx, H / 2 + 6); ctx.stroke();
        }
        ctx.textBaseline = 'alphabetic';
        fx.draw(ctx);
      },
    });

    function paddle(x, cy, col, rgb, flash) {
      const g = ctx.createRadialGradient(x + PW / 2, cy, 0, x + PW / 2, cy, PH * 0.9);
      g.addColorStop(0, 'rgba(' + rgb + ',' + (0.14 + flash * 0.2) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g; ctx.fillRect(x - PH, cy - PH, PH * 2 + PW, PH * 2);
      ctx.fillStyle = col;
      api.roundRect(ctx, x, cy - PH / 2, PW, PH, PW / 2); ctx.fill();
      if (flash > 0) { ctx.globalAlpha = flash * 0.6; ctx.fillStyle = '#fff'; api.roundRect(ctx, x, cy - PH / 2, PW, PH, PW / 2); ctx.fill(); ctx.globalAlpha = 1; }
    }

    /* ── Entrées ─────────────────────────────────────────────────── */
    function toLocal(cx, cy) {
      const r = cv.el.getBoundingClientRect();
      const s = Math.min(r.width / W, r.height / H);
      return { x: (cx - (r.left + (r.width - W * s) / 2)) / s, y: (cy - (r.top + (r.height - H * s) / 2)) / s };
    }
    const track = (e) => { if (state === 'play' || state === 'serve') ty = api.clamp(toLocal(e.clientX, e.clientY).y, PH / 2, H - PH / 2); };
    api.on(cv.el, 'pointermove', track);
    api.on(cv.el, 'pointerdown', track);
    api.onKey((e) => {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'z' || k === 'w') keys.u = true;
      else if (k === 'ArrowDown' || k === 's') keys.d = true;
      else if ((k === ' ' || k === 'Enter') && (state === 'ready' || (state === 'over' && performance.now() - overAt > 800))) { api.hideOverlay(); start(); }
    });
    api.on(document, 'keyup', (e) => {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'z' || k === 'w') keys.u = false;
      else if (k === 'ArrowDown' || k === 's') keys.d = false;
    });
    api.on(window, 'blur', () => { keys.u = keys.d = false; });

    // écran d'accueil
    state = 'ready';
    reset();
    loop.start();
    api.overlay({
      title: 'Pong',
      text: api.t('Premier à cinq points. La balle accélère à chaque échange.', 'First to five points. The ball speeds up with every rally.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart() { lastStart = -1e9; start(); } };
  },
});

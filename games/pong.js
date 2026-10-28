/* ==================================================================
   games/pong.js · Pong
   L'adversaire ne voit la balle qu'avec un temps de réaction, vise
   avec une petite erreur et plafonne sa vitesse : il est solide,
   mais une balle rapide et bien coupée le passe.
   Bonus : une capsule apparaît parfois dans le tiers central ; elle
   revient au dernier joueur qui a frappé la balle qui la touche
   (grande raquette, smash, multi-balle, bouclier). L'ordinateur
   peut aussi en profiter.
   ================================================================== */
SBG.register('pong', {
  create(api) {
    const { C } = api;
    const W = 540, H = 360;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();
    const MANY = api.reduced ? 0.4 : 1;
    const DPR = cv.dpr;

    const PW = 10, PH = 72, R = 7, M = 22, WIN = 5;
    const LX = M, RX = W - M - PW;
    const SERVE = 1.35;
    const SHL = LX - 9, SHR = RX + PW + 9;          // position des boucliers
    const CAP_R = 9, CAP_LIFE = 9, SMASH = 1.45;

    /* ── Bonus : nom, couleur, durée (0 = instantané ou à usage unique) ── */
    const KINDS = {
      big:    { fr: 'Grande raquette', en: 'Big paddle', col: C.good, dur: 10, w: 10 },
      smash:  { fr: 'Balle rapide',    en: 'Fast ball',  col: C.warm, dur: 0,  w: 10, sfr: 'Prochain coup : smash', sen: 'Next shot is a smash' },
      multi:  { fr: 'Multi-balle',     en: 'Multiball',  col: C.ink,  dur: 0,  w: 8 },
      shield: { fr: 'Bouclier',        en: 'Shield',     col: C.blue, dur: 0,  w: 8, sfr: 'Sauve un point', sen: 'Saves one point' },
    };
    const KIND_IDS = Object.keys(KINDS);

    let overAt = 0, me, ai, balls, prevMe, prevAi, ps, as, state, serveT, serveDir, rally, ty, keys, aiT, aiReact, aiErr, flashL, flashR, lastStart = -1e9, runId = 0;
    let cap, capT, labels, pulse;

    /* ── Calques pré-rendus ──────────────────────────────────────── */
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
    function glyph(g, kind, col) {
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.8; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath();
      if (kind === 'big') {
        g.moveTo(0, -5.5); g.lineTo(0, 5.5);
        g.moveTo(-2.8, -3); g.lineTo(0, -5.8); g.lineTo(2.8, -3);
        g.moveTo(-2.8, 3); g.lineTo(0, 5.8); g.lineTo(2.8, 3); g.stroke();
      } else if (kind === 'smash') {
        g.moveTo(1.5, -5.5); g.lineTo(-3, 0.6); g.lineTo(0.2, 0.6); g.lineTo(-1.5, 5.5); g.lineTo(3, -0.6); g.lineTo(-0.2, -0.6); g.closePath(); g.fill();
      } else if (kind === 'multi') {
        g.arc(-2.6, 0, 2.3, 0, Math.PI * 2); g.moveTo(5.2, 0); g.arc(2.9, 0, 2.3, 0, Math.PI * 2); g.fill();
      } else if (kind === 'shield') {
        g.moveTo(0, -5.2); g.lineTo(4.4, -3.4); g.lineTo(4, 1); g.quadraticCurveTo(3, 4, 0, 5.6); g.quadraticCurveTo(-3, 4, -4, 1); g.lineTo(-4.4, -3.4); g.closePath(); g.fill();
      }
    }
    const SPR_S = CAP_R * 2 + 20;
    const SPR = {};
    for (const k of KIND_IDS) {
      const col = KINDS[k].col;
      const o = offscreen(SPR_S, SPR_S), g = o.g, c = SPR_S / 2;
      g.shadowColor = rgba(col, 0.75); g.shadowBlur = 12;
      g.fillStyle = col; g.beginPath(); g.arc(c, c, CAP_R, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = mix(col, 0.55); g.lineWidth = 1;
      g.beginPath(); g.arc(c, c, CAP_R - 0.5, 0, Math.PI * 2); g.stroke();
      g.save(); g.translate(c, c); glyph(g, k, k === 'shield' ? '#F2F8FF' : C.bg); g.restore();
      SPR[k] = o.c;
    }
    function halo(rgb) {
      const s = R * 10, o = offscreen(s, s);
      const gr = o.g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, R * 4.5);
      gr.addColorStop(0, 'rgba(' + rgb + ',0.25)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      o.g.fillStyle = gr; o.g.fillRect(0, 0, s, s);
      return o.c;
    }
    const HALO = halo('233,252,255'), HALO_HOT = halo('255,166,87');

    function side() { return { y: H / 2, v: 0, ph: PH, big: 0, smash: false, shield: false, shT: 0 }; }
    function reset() {
      me = side(); ai = side();
      prevMe = me.y; prevAi = ai.y; ty = H / 2;
      ps = 0; as = 0; rally = 0;
      keys = { u: false, d: false };
      flashL = flashR = 0; pulse = 0;
      labels = [];
      fx.clear();
      serve(Math.random() < 0.5 ? -1 : 1);
      api.hud({ score: 0 });
    }
    function newBall(x, y, sp, owner) {
      return { x, y, px: x, py: y, vx: 0, vy: 0, sp, boost: 1, owner, trail: [] };
    }
    function serve(dir) {
      serveDir = dir; serveT = 0; rally = 0;
      balls = [newBall(W / 2, H / 2, 330, dir > 0 ? 'me' : 'ai')];
      cap = null; capT = 4 + Math.random() * 4;
      aiT = 0; aiErr = 0; aiReact = H / 2;
      if (state === 'play' || state === 'serve') state = 'serve';
    }
    function launch() {
      const b = balls[0];
      const a = (Math.random() * 0.7 - 0.35);
      b.vx = Math.cos(a) * b.sp * serveDir;
      b.vy = Math.sin(a) * b.sp;
      state = 'play';
      api.tone(440, 0.06, 'triangle', 0.3);
    }
    function powerNames(s) {
      const on = [];
      if (s.big > 0) on.push(api.t(KINDS.big.fr, KINDS.big.en));
      if (s.smash) on.push(api.t(KINDS.smash.fr, KINDS.smash.en));
      if (s.shield) on.push(api.t(KINDS.shield.fr, KINDS.shield.en));
      return on.join(', ');
    }
    function syncStatus() {
      let s = api.t('Vous ' + ps + ' · ' + as + ' Ordinateur', 'You ' + ps + ' · ' + as + ' Computer');
      const a = powerNames(me), b = powerNames(ai);
      if (a) s += ' · ' + api.t('Vous : ', 'You: ') + a;
      if (b) s += ' · ' + api.t('Ordinateur : ', 'Computer: ') + b;
      api.status(s);
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
    function predict(b) {
      if (b.vx <= 0) return H / 2;
      const t = (RX - R - b.x) / b.vx;
      let y = b.y + b.vy * t;
      const span = H - 2 * R;
      y -= R;
      y = ((y % (2 * span)) + 2 * span) % (2 * span);
      if (y > span) y = 2 * span - y;
      return y + R;
    }
    // balle la plus urgente pour l'ordinateur
    function threat() {
      let best = null, bt = Infinity;
      for (const b of balls) {
        if (b.vx <= 0) continue;
        const t = (RX - b.x) / b.vx;
        if (t < bt) { bt = t; best = b; }
      }
      return best;
    }

    function paddleHit(b, p, left) {
      const rel = api.clamp((b.y - p.y) / (p.ph / 2), -1, 1);
      b.sp = Math.min(880, b.sp * 1.06 + 6);
      rally++;
      b.owner = left ? 'me' : 'ai';
      b.boost = 1;
      let smashed = false;
      if (p.smash) { p.smash = false; b.boost = SMASH; smashed = true; syncStatus(); }
      const sp = b.sp * b.boost;
      const a = rel * 0.95;
      b.vx = Math.cos(a) * sp * (left ? 1 : -1);
      b.vy = Math.sin(a) * sp + api.clamp(p.v * 0.22, -260, 260);
      const m = Math.hypot(b.vx, b.vy);
      b.vx = b.vx / m * sp; b.vy = b.vy / m * sp;
      if (Math.abs(b.vx) < sp * 0.55) {
        b.vx = Math.sign(b.vx) * sp * 0.55;
        b.vy = Math.sign(b.vy || 1) * Math.sqrt(sp * sp - b.vx * b.vx);
      }
      b.x = left ? LX + PW + R : RX - R;
      if (left) flashL = 1; else flashR = 1;
      if (smashed) {
        api.tone(left ? 700 : 560, 0.1, 'sawtooth', 0.22, 1.5);
        api.shake(3);
        fx.burst(b.x, b.y, { n: Math.round(16 * MANY), color: [C.warm, '#FFD8A8', '#fff'], speed: 220, life: 0.45, size: 2.2 });
      } else {
        api.tone(left ? 520 : 400, 0.06, 'square', 0.22, 1.2);
        fx.burst(b.x, b.y, { n: Math.round(7 * MANY), color: left ? C.cyan : C.violet, speed: 120, life: 0.35, size: 1.8 });
      }
      if (left) aiErr = (Math.random() * 2 - 1) * (16 + sp * 0.06 + Math.abs(b.vy) * 0.12);
    }

    /* ── Bonus ───────────────────────────────────────────────────── */
    function spawnCap() {
      const pool = KIND_IDS.filter((k) => !(k === 'multi' && balls.length > 1));
      let tot = 0; for (const k of pool) tot += KINDS[k].w;
      let r = Math.random() * tot, kind = pool[0];
      for (const k of pool) { r -= KINDS[k].w; if (r <= 0) { kind = k; break; } }
      cap = { x: W / 3 + 20 + Math.random() * (W / 3 - 40), y: 46 + Math.random() * (H - 92), kind, t: 0 };
      api.tone(880, 0.05, 'sine', 0.18);
    }
    function collect(b) {
      const c = cap; cap = null; capT = 7 + Math.random() * 5;
      const who = b.owner === 'ai' ? ai : me, mine = who === me;
      const K = KINDS[c.kind];
      fx.burst(c.x, c.y, { n: Math.round(16 * MANY), color: [K.col, mine ? C.cyan : C.violet, '#fff'], speed: 170, life: 0.5, size: 2 });
      const base = mine ? 660 : 520;
      api.tone(base, 0.08, 'triangle', 0.32, 1.2); api.after(70, () => api.tone(base * 1.5, 0.1, 'triangle', 0.3, 1.25)); api.after(140, () => api.tone(base * 2, 0.12, 'sine', 0.22));
      if (c.kind === 'big') who.big = K.dur;
      else if (c.kind === 'smash') who.smash = true;
      else if (c.kind === 'shield') { who.shield = true; who.shT = 0; }
      else if (c.kind === 'multi' && balls.length < 2) {
        // seconde balle, lancée vers l'adversaire de celui qui l'a gagnée
        const dir = mine ? 1 : -1;
        const nb = newBall(c.x, c.y, Math.max(330, b.sp * 0.9), b.owner);
        const a = (Math.random() * 0.8 - 0.4);
        nb.vx = Math.cos(a) * nb.sp * dir; nb.vy = Math.sin(a) * nb.sp;
        balls.push(nb);
      }
      label({ x: api.clamp(c.x, 80, W - 80), y: c.y - 16, t: 0, col: mix(K.col, 0.3),
        text: (mine ? '' : api.t('Ordinateur · ', 'Computer · ')) + api.t(K.fr, K.en), sub: K.sfr ? api.t(K.sfr, K.sen) : '' });
      syncStatus();
    }

    // libellé flottant, décalé vers le haut si un autre vient d'apparaître au même endroit
    function label(l) {
      for (const o of labels) if (o.t < 0.5 && Math.abs(o.x - l.x) < 120 && Math.abs(o.y - l.y) < 26) l.y = o.y - 30;
      l.y = Math.max(30, l.y);
      labels.push(l);
    }

    function point(playerScored, y) {
      if (playerScored) ps++; else as++;
      api.hud({ score: ps });
      const x = playerScored ? W - 4 : 4;
      fx.burst(x, api.clamp(y, 10, H - 10), { n: Math.round(22 * MANY), color: playerScored ? [C.cyan, '#fff'] : [C.violet, C.bad], speed: 220, life: 0.6 });
      if (!playerScored) api.shake(4);
      if (ps >= WIN || as >= WIN) { syncStatus(); return end(ps >= WIN); }
      api.sfx(playerScored ? 'score' : 'error');
      serve(playerScored ? 1 : -1);
      syncStatus();
    }
    function saveShield(b, left) {
      const s = left ? me : ai;
      s.shield = false;
      b.vx = left ? Math.abs(b.vx) : -Math.abs(b.vx);
      b.x = left ? SHL + 2 + R : SHR - 2 - R;
      b.owner = left ? 'me' : 'ai';
      api.tone(left ? 760 : 600, 0.12, 'triangle', 0.3, 0.7);
      api.shake(2);
      fx.burst(b.x, b.y, { n: Math.round(18 * MANY), color: [C.blue, mix(C.blue, 0.5), '#fff'], speed: 200, life: 0.5, size: 2 });
      label({ x: left ? 90 : W - 90, y: api.clamp(b.y, 40, H - 30), t: 0, col: mix(C.blue, 0.45), text: api.t('Bouclier', 'Shield'), sub: api.t('Point sauvé', 'Point saved') });
      syncStatus();
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

    // avance chaque balle par petits sous-pas ; renvoie true si un point est marqué
    function step(dt) {
      for (let k = 0; k < balls.length; k++) {
        const b = balls[k];
        const sp = Math.hypot(b.vx, b.vy);
        const n = Math.max(1, Math.ceil(sp * dt / 3));
        const h = dt / n;
        for (let i = 0; i < n; i++) {
          b.x += b.vx * h; b.y += b.vy * h;
          if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); api.tone(250, 0.03, 'sine', 0.15); }
          else if (b.y > H - R) { b.y = H - R; b.vy = -Math.abs(b.vy); api.tone(250, 0.03, 'sine', 0.15); }
          if (b.vx < 0 && b.x - R < LX + PW && b.x + R > LX && Math.abs(b.y - me.y) < me.ph / 2 + R) paddleHit(b, me, true);
          else if (b.vx > 0 && b.x + R > RX && b.x - R < RX + PW && Math.abs(b.y - ai.y) < ai.ph / 2 + R) paddleHit(b, ai, false);
          else if (b.vx < 0 && me.shield && b.x - R < SHL + 1) saveShield(b, true);
          else if (b.vx > 0 && ai.shield && b.x + R > SHR - 1) saveShield(b, false);
          if (cap) {
            const dx = b.x - cap.x, dy = b.y - cap.y, rr = CAP_R + R;
            if (dx * dx + dy * dy < rr * rr) collect(b);
          }
          if (b.x < -R * 2) { point(false, b.y); return true; }
          if (b.x > W + R * 2) { point(true, b.y); return true; }
        }
      }
      return false;
    }

    function movePaddles(dt) {
      // hauteur des raquettes : transition douce
      me.ph += ((me.big > 0 ? PH * 1.5 : PH) - me.ph) * (1 - Math.exp(-dt * 8));
      ai.ph += ((ai.big > 0 ? PH * 1.5 : PH) - ai.ph) * (1 - Math.exp(-dt * 8));
      // joueur
      if (keys.u) ty -= 520 * dt;
      if (keys.d) ty += 520 * dt;
      ty = api.clamp(ty, me.ph / 2, H - me.ph / 2);
      const ny = me.y + (ty - me.y) * (1 - Math.exp(-dt * 22));
      me.v = me.v * 0.8 + ((ny - me.y) / dt) * 0.2;
      me.y = api.clamp(ny, me.ph / 2, H - me.ph / 2);
      // ordinateur : ne relit la balle que tous les ~0,13 s
      aiT -= dt;
      if (aiT <= 0) {
        aiT = 0.11 + Math.random() * 0.06;
        const b = state === 'play' ? threat() : null;
        aiReact = b ? predict(b) + aiErr : H / 2 + (balls[0].y - H / 2) * 0.25;
      }
      const maxV = 270 + Math.min(50, rally * 4);
      const want = api.clamp((aiReact - ai.y) * 7, -maxV, maxV);
      ai.v += (want - ai.v) * Math.min(1, dt * 10);
      ai.y = api.clamp(ai.y + ai.v * dt, ai.ph / 2, H - ai.ph / 2);
    }

    function updatePowers(dt) {
      let changed = false;
      for (const s of [me, ai]) {
        if (s.big > 0) { s.big -= dt; if (s.big <= 0) { s.big = 0; changed = true; } }
        if (s.shield) s.shT += dt;
      }
      if (changed) { syncStatus(); api.tone(440, 0.08, 'sine', 0.18, 0.7); }
      if (cap) {
        cap.t += dt;
        if (cap.t > CAP_LIFE) { cap = null; capT = 5 + Math.random() * 4; }
      } else {
        capT -= dt;
        if (capT <= 0) spawnCap();
      }
    }

    const loop = api.loop({
      update(dt) {
        fx.update(dt);
        pulse += dt;
        flashL = Math.max(0, flashL - dt * 4); flashR = Math.max(0, flashR - dt * 4);
        for (let i = labels.length - 1; i >= 0; i--) { labels[i].t += dt; if (labels[i].t > 1.4) labels.splice(i, 1); }
        prevMe = me.y; prevAi = ai.y;
        for (const b of balls) { b.px = b.x; b.py = b.y; }
        if (state === 'ready' || state === 'over') return;
        movePaddles(dt);
        if (state === 'serve') { serveT += dt; if (serveT >= SERVE) launch(); return; }
        updatePowers(dt);
        if (step(dt)) return;
        if (!api.reduced) {
          for (const b of balls) {
            b.trail.push(b.x, b.y);
            while (b.trail.length > (b.boost > 1 ? 40 : 28)) b.trail.splice(0, 2);
          }
        }
      },
      render(alpha) {
        cv.clear(C.bg);
        // chiffres du score en filigrane
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '800 170px ' + api.font;
        ctx.fillStyle = 'rgba(56,189,248,0.055)'; ctx.fillText(String(ps), W / 4, H / 2 + 8);
        ctx.fillStyle = 'rgba(210,168,255,0.06)'; ctx.fillText(String(as), W * 3 / 4, H / 2 + 8);
        // tiers central : zone d'apparition des bonus
        ctx.fillStyle = 'rgba(240,246,252,0.018)'; ctx.fillRect(W / 3, 0, W / 3, H);
        // filet
        ctx.fillStyle = C.line;
        for (let y = 8; y < H; y += 22) { api.roundRect(ctx, W / 2 - 1.5, y, 3, 11, 1.5); ctx.fill(); }
        ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 0.5); ctx.lineTo(W, 0.5); ctx.moveTo(0, H - 0.5); ctx.lineTo(W, H - 0.5); ctx.stroke();

        // boucliers
        if (me.shield) shield(SHL, C.cyan, me.shT);
        if (ai.shield) shield(SHR, C.violet, ai.shT);

        const my = prevMe + (me.y - prevMe) * alpha, ay = prevAi + (ai.y - prevAi) * alpha;
        paddle(LX, my, me.ph, C.cyan, '56,189,248', flashL, me.smash);
        paddle(RX, ay, ai.ph, C.violet, '210,168,255', flashR, ai.smash);

        // capsule bonus
        if (cap) {
          const k = cap.t;
          const sIn = api.ease.back(Math.min(1, k / 0.35));
          const fade = k > CAP_LIFE - 2 && !api.reduced ? 0.5 + 0.5 * Math.cos((k - (CAP_LIFE - 2)) * 14) : 1;
          const bob = api.reduced ? 0 : Math.sin(k * 3) * 2;
          const s = SPR_S * Math.max(0.01, sIn);
          ctx.globalAlpha = fade;
          ctx.drawImage(SPR[cap.kind], cap.x - s / 2, cap.y + bob - s / 2, s, s);
          ctx.globalAlpha = 1;
        }

        // balles
        if (state === 'play' || state === 'serve') {
          ctx.lineCap = 'round';
          for (const b of balls) {
            const tl = b.trail, n = tl.length / 2;
            const hot = b.boost > 1;
            for (let i = 1; i < n; i++) {
              const k = i / n;
              ctx.strokeStyle = hot ? 'rgba(255,166,87,' + (k * 0.45) + ')' : 'rgba(233,252,255,' + (k * 0.18) + ')';
              ctx.lineWidth = R * 2 * k * 0.9;
              ctx.beginPath(); ctx.moveTo(tl[i * 2 - 2], tl[i * 2 - 1]); ctx.lineTo(tl[i * 2], tl[i * 2 + 1]); ctx.stroke();
            }
          }
          const pz = state === 'serve' ? 1 + Math.sin(serveT * 10) * 0.12 : 1;
          for (const b of balls) {
            const bx = b.px + (b.x - b.px) * alpha, by = b.py + (b.y - b.py) * alpha;
            const hot = b.boost > 1;
            ctx.drawImage(hot ? HALO_HOT : HALO, bx - R * 5, by - R * 5, R * 10, R * 10);
            ctx.fillStyle = hot ? '#FFE2C2' : '#F2FDFF';
            ctx.beginPath(); ctx.arc(bx, by, R * pz, 0, Math.PI * 2); ctx.fill();
          }
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

        // bonus actifs : barres de temps en haut, pastilles dans les coins
        if (me.big > 0) { ctx.fillStyle = C.good; ctx.fillRect(0, 0, (W / 2 - 4) * (me.big / KINDS.big.dur), 3); }
        if (ai.big > 0) { const w = (W / 2 - 4) * (ai.big / KINDS.big.dur); ctx.fillStyle = C.good; ctx.fillRect(W - w, 0, w, 3); }
        icons(me, 18, 1);
        icons(ai, W - 18, -1);

        // libellés flottants
        ctx.textAlign = 'center';
        for (const l of labels) {
          const k = l.t / 1.4;
          ctx.globalAlpha = k < 0.15 ? k / 0.15 : k > 0.6 ? Math.max(0, (1 - k) / 0.4) : 1;
          const y = l.y - api.ease.out(Math.min(1, k * 1.4)) * 26;
          ctx.fillStyle = l.col; ctx.font = '750 14px ' + api.font;
          ctx.fillText(l.text, l.x, y);
          if (l.sub) { ctx.fillStyle = C.muted; ctx.font = '500 11px ' + api.font; ctx.fillText(l.sub, l.x, y + 14); }
        }
        ctx.globalAlpha = 1;
      },
    });

    function icons(s, x, dir) {
      const sz = SPR_S * 0.72;
      let i = 0;
      for (const k of KIND_IDS) {
        const on = k === 'big' ? s.big > 0 : k === 'smash' ? s.smash : k === 'shield' ? s.shield : false;
        if (!on) continue;
        const cx = x + dir * i * 22;
        ctx.globalAlpha = k === 'big' && s.big < 2 && !api.reduced ? 0.55 + 0.45 * Math.sin(s.big * 18) : 1;
        ctx.drawImage(SPR[k], cx - sz / 2, 18 - sz / 2, sz, sz);
        i++;
      }
      ctx.globalAlpha = 1;
    }
    function shield(x, col, t) {
      const a = 0.55 + 0.25 * Math.sin(pulse * 5);
      const k = Math.min(1, t / 0.3);
      const h = H * api.ease.out(k);
      ctx.globalAlpha = a * 0.35; ctx.fillStyle = col;
      ctx.fillRect(x - 3, H / 2 - h / 2, 6, h);
      ctx.globalAlpha = a; ctx.fillStyle = mix(col, 0.35);
      ctx.fillRect(x - 1, H / 2 - h / 2, 2, h);
      ctx.globalAlpha = 1;
    }
    function paddle(x, cy, ph, col, rgb, flash, armed) {
      const g = ctx.createRadialGradient(x + PW / 2, cy, 0, x + PW / 2, cy, ph * 0.9);
      g.addColorStop(0, 'rgba(' + rgb + ',' + (0.14 + flash * 0.2) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g; ctx.fillRect(x - ph, cy - ph, ph * 2 + PW, ph * 2);
      ctx.fillStyle = col;
      api.roundRect(ctx, x, cy - ph / 2, PW, ph, PW / 2); ctx.fill();
      if (armed) {
        // smash prêt : liseré orange qui pulse
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(pulse * 9);
        ctx.strokeStyle = C.warm; ctx.lineWidth = 2;
        api.roundRect(ctx, x - 2, cy - ph / 2 - 2, PW + 4, ph + 4, PW / 2 + 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (flash > 0) { ctx.globalAlpha = flash * 0.6; ctx.fillStyle = '#fff'; api.roundRect(ctx, x, cy - ph / 2, PW, ph, PW / 2); ctx.fill(); ctx.globalAlpha = 1; }
    }

    /* ── Entrées ─────────────────────────────────────────────────── */
    function toLocal(cx, cy) {
      const r = cv.el.getBoundingClientRect();
      const s = Math.min(r.width / W, r.height / H);
      return { x: (cx - (r.left + (r.width - W * s) / 2)) / s, y: (cy - (r.top + (r.height - H * s) / 2)) / s };
    }
    const track = (e) => { if (state === 'play' || state === 'serve') ty = api.clamp(toLocal(e.clientX, e.clientY).y, me.ph / 2, H - me.ph / 2); };
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
      text: api.t('Premier à cinq points. La balle accélère à chaque échange. Touchez les capsules du centre pour gagner un bonus.', 'First to five points. The ball speeds up with every rally. Hit the capsules in the middle to grab a power-up.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart() { lastStart = -1e9; start(); } };
  },
});

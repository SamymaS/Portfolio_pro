/* ==================================================================
   games/asteroids.js · Astéroïdes
   Espace torique : ce qui sort par un bord revient par l'autre. Un
   objet proche d'un bord est dessiné plusieurs fois (deux, ou quatre
   dans un coin) et les collisions mesurent la distance la plus courte
   à travers les bords. Rien de lourd n'est alloué par image : tirs en
   réserve fixe, champ d'étoiles pré-rendu, un seul tracé par taille
   de rocher.
   ================================================================== */
SBG.register('asteroids', {
  create(api) {
    const { C } = api;
    const W = 600, H = 440;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();
    const RED = api.reduced;
    const MANY = RED ? 0.4 : 1;
    const TAU = Math.PI * 2;

    /* ── Réglages ────────────────────────────────────────────────── */
    const TURN = 4.4, THRUST = 270, DRAG = 0.55, VMAX = 310;
    const SHIP_R = 10, INVULN = 2.6, RESPAWN = 1.5;
    const B_MAX = 6, B_SPEED = 500, B_LIFE = 0.85, B_COOL = 0.17, B_COOL_PTR = 0.24;
    const PTR_FAR = 90;
    const EXTRA = 10000, MAX_LIVES = 5;
    // tailles : 0 grand, 1 moyen, 2 petit
    const SIZES = [
      { r: 40, pts: 20, v: 40, stroke: 'rgba(210,168,255,0.55)', fill: 'rgba(210,168,255,0.045)' },
      { r: 22, pts: 50, v: 68, stroke: 'rgba(210,168,255,0.80)', fill: 'rgba(210,168,255,0.07)' },
      { r: 12, pts: 100, v: 98, stroke: 'rgba(232,222,255,0.95)', fill: 'rgba(210,168,255,0.10)' },
    ];

    /* ── Calques pré-rendus ──────────────────────────────────────── */
    // champ d'étoiles : fond, deux nébuleuses très discrètes, étoiles fixes
    const starLayer = document.createElement('canvas');
    starLayer.width = cv.el.width; starLayer.height = cv.el.height;
    {
      const g = starLayer.getContext('2d');
      g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
      g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
      nebula(g, W * 0.8, H * 0.22, 240, '210,168,255', 0.07);
      nebula(g, W * 0.14, H * 0.84, 280, '31,111,235', 0.08);
      const tints = [C.ink, C.ink, C.ink, C.cyan, C.violet];
      for (let i = 0; i < 160; i++) {
        const x = Math.random() * W, y = Math.random() * H;
        const big = Math.random() < 0.12;
        g.globalAlpha = big ? 0.45 + Math.random() * 0.3 : 0.12 + Math.random() * 0.3;
        g.fillStyle = tints[i % tints.length];
        if (big) { g.beginPath(); g.arc(x, y, 0.9, 0, TAU); g.fill(); }
        else g.fillRect(x, y, 0.8, 0.8);
      }
      g.globalAlpha = 1;
    }
    function nebula(g, x, y, r, rgb, a) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // halos : sprites radiaux réutilisés à chaque image
    function glowSprite(rgb, a) {
      const s = 64, c = document.createElement('canvas');
      c.width = c.height = Math.round(s * cv.dpr);
      const g = c.getContext('2d');
      g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      return c;
    }
    const glowCyan = glowSprite('56,189,248', 0.22);
    const glowWarm = glowSprite('255,166,87', 0.5);

    // quelques étoiles scintillantes (positions fixes, phase propre)
    const TW_N = RED ? 0 : 18;
    const tw = new Float32Array(TW_N * 4);
    for (let i = 0; i < TW_N; i++) {
      tw[i * 4] = Math.random() * W; tw[i * 4 + 1] = Math.random() * H;
      tw[i * 4 + 2] = Math.random() * TAU; tw[i * 4 + 3] = 0.8 + Math.random() * 2.2;
    }

    /* ── État ────────────────────────────────────────────────────── */
    const ship = { x: W / 2, y: H / 2, px: W / 2, py: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, pa: -Math.PI / 2, alive: false, inv: 0, thr: 0 };
    const bullets = [];
    for (let i = 0; i < B_MAX; i++) bullets.push({ on: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, life: 0 });
    const debris = [];
    for (let i = 0; i < 3; i++) debris.push({ x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0, len: 0, life: 0 });
    const rings = [];
    for (let i = 0; i < 10; i++) rings.push({ on: false, x: 0, y: 0, r: 0, t: 0 });
    let rocks = [];
    const keys = { l: false, r: false, up: false, fire: false };
    const ptr = { on: false, id: -1, x: 0, y: 0 };

    let state = 'ready', score = 0, lives = 3, wave = 1, waveT = -1, respawnT = 0, cool = 0, puff = 0;
    let banner = null, clock = 0, lastBoom = 0, overAt = 0, lastStart = -1e9, runId = 0;

    // décalages de dessin à travers les bords (tableaux réutilisés)
    const WX = new Float32Array(2), WY = new Float32Array(2), OFF = new Float32Array(8);
    function wrapOffsets(x, y, r) {
      let nx = 1, ny = 1, n = 0;
      WX[0] = 0; WY[0] = 0;
      if (x < r) WX[nx++] = W; else if (x > W - r) WX[nx++] = -W;
      if (y < r) WY[ny++] = H; else if (y > H - r) WY[ny++] = -H;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { OFF[n * 2] = WX[i]; OFF[n * 2 + 1] = WY[j]; n++; }
      return n;
    }
    // différence la plus courte sur un axe torique
    function wd(d, span) { return d > span / 2 ? d - span : d < -span / 2 ? d + span : d; }
    // interpolation qui ignore le saut d'un bord à l'autre
    function lw(p, c, k, span) { const d = c - p; return d > span / 2 || d < -span / 2 ? c : p + d * k; }
    function wrapX(x) { return x < 0 ? x + W : x >= W ? x - W : x; }
    function wrapY(y) { return y < 0 ? y + H : y >= H ? y - H : y; }
    const speedMul = () => 1 + Math.min(0.6, (wave - 1) * 0.07);

    /* ── Rochers ─────────────────────────────────────────────────── */
    function makeRock(x, y, size, vx, vy) {
      const S = SIZES[size];
      const n = 10 + Math.floor(Math.random() * 3);
      const v = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU + (Math.random() - 0.5) * 0.4;
        const rr = S.r * (0.74 + Math.random() * 0.3);
        v[i * 2] = Math.cos(ang) * rr; v[i * 2 + 1] = Math.sin(ang) * rr;
      }
      const rot = Math.random() * TAU;
      return { x, y, px: x, py: y, vx, vy, size, r: S.r, rot, prot: rot, spin: (Math.random() - 0.5) * (0.6 + size * 0.7), v, n };
    }
    function spawnWave(n) {
      const count = Math.min(11, 3 + n);
      const cx = ship.alive ? ship.x : W / 2, cy = ship.alive ? ship.y : H / 2;
      for (let i = 0; i < count; i++) {
        let x, y, tries = 0;
        do { x = Math.random() * W; y = Math.random() * H; tries++; }
        while (tries < 40 && Math.hypot(wd(x - cx, W), wd(y - cy, H)) < 170);
        const a = Math.random() * TAU, sp = SIZES[0].v * speedMul() * (0.7 + Math.random() * 0.6);
        rocks.push(makeRock(x, y, 0, Math.cos(a) * sp, Math.sin(a) * sp));
      }
    }
    function breakRock(i) {
      const r = rocks[i];
      addScore(SIZES[r.size].pts);
      fx.burst(r.x, r.y, { n: Math.round([22, 14, 9][r.size] * MANY), color: [C.violet, C.ink, '#B9A3F5'], speed: 70 + r.r * 3, life: 0.6, size: 1.7 });
      ring(r.x, r.y, r.r * 0.6);
      if (clock - lastBoom > 0.06) { api.sfx('boom'); lastBoom = clock; }
      if (r.size < 2) {
        const s = r.size + 1, base = Math.atan2(r.vy, r.vx);
        for (let k = 0; k < 2; k++) {
          const ang = base + (k ? 1 : -1) * (0.45 + Math.random() * 0.7);
          const mag = SIZES[s].v * speedMul() * (0.8 + Math.random() * 0.5);
          rocks.push(makeRock(r.x, r.y, s, r.vx * 0.35 + Math.cos(ang) * mag, r.vy * 0.35 + Math.sin(ang) * mag));
        }
      }
      rocks[i] = rocks[rocks.length - 1]; rocks.pop();
    }
    function ring(x, y, r) {
      for (const g of rings) if (!g.on) { g.on = true; g.x = x; g.y = y; g.r = r; g.t = 0; return; }
    }

    /* ── Score, vaisseau, tirs ───────────────────────────────────── */
    function addScore(n) {
      const before = score;
      score += n;
      if (Math.floor(score / EXTRA) > Math.floor(before / EXTRA) && lives < MAX_LIVES) { lives++; api.sfx('score'); }
      api.hud({ score });
    }
    function placeShip() {
      ship.x = ship.px = W / 2; ship.y = ship.py = H / 2;
      ship.vx = ship.vy = 0; ship.a = ship.pa = -Math.PI / 2;
      ship.alive = true; ship.inv = INVULN; ship.thr = 0;
    }
    function centerClear() {
      for (const r of rocks) if (Math.hypot(wd(r.x - W / 2, W), wd(r.y - H / 2, H)) < r.r + 70) return false;
      return true;
    }
    function fire() {
      let b = null;
      for (const q of bullets) if (!q.on) { b = q; break; }
      if (!b) return false;
      const ca = Math.cos(ship.a), sa = Math.sin(ship.a);
      b.on = true; b.life = B_LIFE;
      b.x = b.px = wrapX(ship.x + ca * 14); b.y = b.py = wrapY(ship.y + sa * 14);
      b.vx = ship.vx + ca * B_SPEED; b.vy = ship.vy + sa * B_SPEED;
      api.tone(1250, 0.05, 'triangle', 0.09, 0.45);
      return true;
    }
    function killShip() {
      ship.alive = false; lives--;
      // le contour du vaisseau se disloque en trois segments
      const ca = Math.cos(ship.a), sa = Math.sin(ship.a);
      const seg = [[14, 0, -10, -9], [-10, -9, -10, 9], [-10, 9, 14, 0]];
      for (let i = 0; i < 3; i++) {
        const s = seg[i], d = debris[i];
        const mx = (s[0] + s[2]) / 2, my = (s[1] + s[3]) / 2;
        d.x = ship.x + mx * ca - my * sa; d.y = ship.y + mx * sa + my * ca;
        const out = Math.atan2(d.y - ship.y, d.x - ship.x);
        d.vx = ship.vx * 0.3 + Math.cos(out) * (30 + Math.random() * 40);
        d.vy = ship.vy * 0.3 + Math.sin(out) * (30 + Math.random() * 40);
        d.a = ship.a + Math.atan2(s[3] - s[1], s[2] - s[0]); d.va = (Math.random() - 0.5) * 5;
        d.len = Math.hypot(s[2] - s[0], s[3] - s[1]) / 2; d.life = 1.4;
      }
      fx.burst(ship.x, ship.y, { n: Math.round(30 * MANY), color: [C.cyan, C.warm, C.bad, '#fff'], speed: 220, life: 0.9, size: 2 });
      ring(ship.x, ship.y, 8);
      api.sfx('boom'); api.tone(150, 0.35, 'sawtooth', 0.2, 0.45);
      if (!RED) api.shake(8);
      for (const b of bullets) b.on = false;
      if (lives <= 0) gameOver(); else respawnT = RESPAWN;
    }

    /* ── Cycle de partie ─────────────────────────────────────────── */
    function clearField() {
      rocks = [];
      for (const b of bullets) b.on = false;
      for (const d of debris) d.life = 0;
      for (const g of rings) g.on = false;
      fx.clear();
    }
    function start() {
      const now = performance.now();
      if (now - lastStart < 350) return;
      lastStart = now; runId++;
      clearField();
      score = 0; lives = 3; wave = 1; waveT = -1; cool = 0;
      keys.l = keys.r = keys.up = keys.fire = false; ptr.on = false;
      placeShip();
      spawnWave(1);
      banner = { text: api.t('Vague 1', 'Wave 1'), t: 0 };
      api.hud({ score: 0 });
      api.status(api.t('Vague 1', 'Wave 1'));
      state = 'play';
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      loop.start();
    }
    function nextWave() {
      wave++;
      waveT = 1.6;
      banner = { text: api.t('Vague ' + wave, 'Wave ' + wave), t: 0 };
      api.status(api.t('Vague ' + wave, 'Wave ' + wave));
      api.sfx('win');
      if (wave >= 3) api.unlock('asteroids_wave3');
    }
    function gameOver() {
      state = 'over'; overAt = performance.now(); ptr.on = false;
      api.sfx('lose');
      const record = api.setBest(score);
      const id = runId;
      api.after(900, () => {
        if (id !== runId || state !== 'over') return;
        api.overlay({
          kicker: record && score > 0 ? api.t('Nouveau record', 'New best') : '',
          title: api.t('Partie terminée', 'Game over'),
          text: api.t(score + ' points · vague ' + wave, score + ' points · wave ' + wave),
          action: api.t('Rejouer', 'Play again'),
          tone: record && score > 0 ? 'good' : '',
          onAction: start,
        });
      });
    }

    /* ── Simulation (pas fixe) ───────────────────────────────────── */
    function update(dt) {
      clock += dt;
      fx.update(dt);
      if (banner) { banner.t += dt; if (banner.t > 1.6) banner = null; }
      for (const g of rings) if (g.on) { g.t += dt; if (g.t > 0.45) g.on = false; }
      for (const d of debris) if (d.life > 0) {
        d.life -= dt; d.x = wrapX(d.x + d.vx * dt); d.y = wrapY(d.y + d.vy * dt); d.a += d.va * dt;
      }

      // les rochers dérivent toujours, même derrière les panneaux
      for (const r of rocks) {
        r.px = r.x; r.py = r.y; r.prot = r.rot;
        r.x = wrapX(r.x + r.vx * dt); r.y = wrapY(r.y + r.vy * dt); r.rot += r.spin * dt;
      }
      ship.px = ship.x; ship.py = ship.y; ship.pa = ship.a;
      for (const b of bullets) { b.px = b.x; b.py = b.y; }
      if (state !== 'play') return;

      cool -= dt;
      if (ship.alive) steer(dt);
      else if (lives > 0) {
        respawnT -= dt;
        if (respawnT <= 0 && (centerClear() || respawnT < -1.5)) placeShip();
      }

      for (const b of bullets) {
        if (!b.on) continue;
        b.life -= dt;
        if (b.life <= 0) { b.on = false; continue; }
        b.x = wrapX(b.x + b.vx * dt); b.y = wrapY(b.y + b.vy * dt);
      }
      collide();

      if (rocks.length === 0 && waveT < 0) nextWave();
      if (waveT >= 0) { waveT -= dt; if (waveT < 0) spawnWave(wave); }
    }

    function steer(dt) {
      let turn = 0, thr = keys.up, shoot = keys.fire, rate = B_COOL;
      if (keys.l) turn -= 1;
      if (keys.r) turn += 1;
      ship.a += turn * TURN * dt;
      // doigt ou souris : le vaisseau pivote vers le pointeur, pousse s'il est loin, tire en continu
      if (ptr.on) {
        const dx = ptr.x - ship.x, dy = ptr.y - ship.y;
        let d = Math.atan2(dy, dx) - ship.a;
        d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
        const st = TURN * 1.15 * dt;
        ship.a += Math.abs(d) < st ? d : Math.sign(d) * st;
        if (dx * dx + dy * dy > PTR_FAR * PTR_FAR && Math.abs(d) < 1.0) thr = true;
        shoot = true; rate = B_COOL_PTR;
      }
      const ca = Math.cos(ship.a), sa = Math.sin(ship.a);
      if (thr) {
        ship.vx += ca * THRUST * dt; ship.vy += sa * THRUST * dt;
        puff -= dt;
        if (puff <= 0 && !RED) {
          puff = 0.035;
          fx.burst(ship.x - ca * 11, ship.y - sa * 11, { n: 1, color: [C.warm, '#FFD9B3'], speed: 45, life: 0.32, size: 1.3 });
        }
      }
      const drag = Math.exp(-DRAG * dt);
      ship.vx *= drag; ship.vy *= drag;
      const sp = Math.hypot(ship.vx, ship.vy);
      if (sp > VMAX) { ship.vx *= VMAX / sp; ship.vy *= VMAX / sp; }
      ship.x = wrapX(ship.x + ship.vx * dt); ship.y = wrapY(ship.y + ship.vy * dt);
      ship.thr += ((thr ? 1 : 0) - ship.thr) * Math.min(1, dt * 12);
      ship.inv = Math.max(0, ship.inv - dt);
      if (shoot && cool <= 0 && fire()) cool = rate;
    }

    function collide() {
      for (let i = rocks.length - 1; i >= 0; i--) {
        const r = rocks[i];
        let hit = false;
        for (const b of bullets) {
          if (!b.on) continue;
          const dx = wd(b.x - r.x, W), dy = wd(b.y - r.y, H);
          if (dx * dx + dy * dy < r.r * r.r) { b.on = false; hit = true; break; }
        }
        if (!hit && ship.alive && ship.inv <= 0) {
          const dx = wd(ship.x - r.x, W), dy = wd(ship.y - r.y, H), rr = r.r * 0.85 + SHIP_R * 0.8;
          if (dx * dx + dy * dy < rr * rr) { breakRock(i); killShip(); continue; }
        }
        if (hit) breakRock(i);
      }
    }

    /* ── Rendu ───────────────────────────────────────────────────── */
    function render(k) {
      ctx.drawImage(starLayer, 0, 0, W, H);
      if (TW_N) {
        ctx.fillStyle = C.ink;
        for (let i = 0; i < TW_N; i++) {
          ctx.globalAlpha = 0.15 + 0.5 * (0.5 + 0.5 * Math.sin(clock * tw[i * 4 + 3] + tw[i * 4 + 2]));
          ctx.fillRect(tw[i * 4], tw[i * 4 + 1], 1.4, 1.4);
        }
        ctx.globalAlpha = 1;
      }

      // rochers : un tracé par taille (remplissage léger puis contour)
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (let s = 0; s < 3; s++) {
        ctx.beginPath();
        let any = false;
        for (const r of rocks) {
          if (r.size !== s) continue;
          any = true;
          const x = lw(r.px, r.x, k, W), y = lw(r.py, r.y, k, H);
          const rot = r.prot + (r.rot - r.prot) * k;
          const c = Math.cos(rot), sn = Math.sin(rot), v = r.v;
          const n = wrapOffsets(x, y, r.r);
          for (let o = 0; o < n; o++) {
            const ox = x + OFF[o * 2], oy = y + OFF[o * 2 + 1];
            ctx.moveTo(ox + v[0] * c - v[1] * sn, oy + v[0] * sn + v[1] * c);
            for (let j = 1; j < r.n; j++) ctx.lineTo(ox + v[j * 2] * c - v[j * 2 + 1] * sn, oy + v[j * 2] * sn + v[j * 2 + 1] * c);
            ctx.closePath();
          }
        }
        if (!any) continue;
        ctx.fillStyle = SIZES[s].fill; ctx.fill();
        ctx.strokeStyle = SIZES[s].stroke; ctx.lineWidth = s === 2 ? 1.4 : 1.6; ctx.stroke();
      }

      // ondes de choc
      ctx.lineWidth = 1.2;
      for (const g of rings) {
        if (!g.on) continue;
        const q = g.t / 0.45;
        ctx.globalAlpha = (1 - q) * 0.55; ctx.strokeStyle = C.violet;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r + api.ease.out(q) * 26, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // tirs : traînée large et douce, puis cœur clair
      ctx.beginPath();
      let anyB = false;
      for (const b of bullets) {
        if (!b.on) continue;
        anyB = true;
        const x = lw(b.px, b.x, k, W), y = lw(b.py, b.y, k, H);
        ctx.moveTo(x - b.vx * 0.018, y - b.vy * 0.018); ctx.lineTo(x, y);
      }
      if (anyB) {
        ctx.strokeStyle = 'rgba(56,189,248,0.28)'; ctx.lineWidth = 5; ctx.stroke();
        ctx.strokeStyle = '#E9FCFF'; ctx.lineWidth = 1.8; ctx.stroke();
      }

      // vaisseau (clignote pendant l'invulnérabilité)
      if (ship.alive && state !== 'ready') {
        let alpha = 1;
        if (ship.inv > 0) alpha = RED ? 0.5 : (Math.floor(ship.inv * 9) % 2 ? 0.25 : 1);
        const x = lw(ship.px, ship.x, k, W), y = lw(ship.py, ship.y, k, H);
        const a = ship.pa + (ship.a - ship.pa) * k;
        const n = wrapOffsets(x, y, 20);
        for (let o = 0; o < n; o++) drawShip(x + OFF[o * 2], y + OFF[o * 2 + 1], a, 1, alpha, ship.thr, true);
      }

      // débris du vaisseau
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.6;
      for (const d of debris) {
        if (d.life <= 0) continue;
        ctx.globalAlpha = Math.min(1, d.life / 0.8);
        const c = Math.cos(d.a) * d.len, sn = Math.sin(d.a) * d.len;
        ctx.beginPath(); ctx.moveTo(d.x - c, d.y - sn); ctx.lineTo(d.x + c, d.y + sn); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      fx.draw(ctx);

      // repère du pointeur pendant l'appui
      if (ptr.on && state === 'play') {
        ctx.strokeStyle = 'rgba(56,189,248,0.4)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 11, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(56,189,248,0.6)';
        ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 2, 0, TAU); ctx.fill();
      }

      if (state !== 'ready') drawHud();

      if (banner) {
        const q = banner.t / 1.6;
        const a = q < 0.18 ? q / 0.18 : q > 0.7 ? (1 - q) / 0.3 : 1;
        ctx.globalAlpha = a;
        ctx.fillStyle = C.ink; ctx.font = '750 30px ' + api.font; ctx.textAlign = 'center';
        ctx.fillText(banner.text, W / 2, H * 0.36 - (1 - api.ease.out(Math.min(1, q * 3))) * 10);
        ctx.globalAlpha = 1;
      }
    }

    function shipPath(s) {
      ctx.beginPath();
      ctx.moveTo(14 * s, 0); ctx.lineTo(-10 * s, -9 * s); ctx.lineTo(-6 * s, 0); ctx.lineTo(-10 * s, 9 * s);
      ctx.closePath();
    }
    function drawShip(x, y, a, s, alpha, thr, glow) {
      ctx.save();
      ctx.globalAlpha = alpha;
      if (glow) ctx.drawImage(glowCyan, x - 32, y - 32, 64, 64);
      ctx.translate(x, y); ctx.rotate(a);
      if (thr > 0.03) {
        const flick = RED ? 0.5 : Math.random();
        const len = (9 + flick * 7) * thr;
        ctx.globalAlpha = alpha * thr * 0.7;
        ctx.drawImage(glowWarm, -7 - len * 0.6 - 14, -14, 28, 28);
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = C.warm;
        ctx.beginPath(); ctx.moveTo(-7, -4.6); ctx.lineTo(-7 - len, 0); ctx.lineTo(-7, 4.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#FFE7CC';
        ctx.beginPath(); ctx.moveTo(-7, -2.2); ctx.lineTo(-7 - len * 0.55, 0); ctx.lineTo(-7, 2.2); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = alpha;
      }
      shipPath(s);
      ctx.fillStyle = 'rgba(56,189,248,0.12)'; ctx.fill();
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    }

    function drawHud() {
      // vies : petits vaisseaux en haut à gauche
      for (let i = 0; i < lives; i++) drawShip(22 + i * 19, 24, -Math.PI / 2, 0.62, 0.9, 0, false);
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.muted; ctx.font = '600 13px ' + api.font; ctx.textAlign = 'right';
      ctx.fillText(api.t('Vague ', 'Wave ') + wave, W - 18, 24);
      ctx.textBaseline = 'alphabetic';
    }

    const loop = api.loop({ update, render });

    /* ── Entrées ─────────────────────────────────────────────────── */
    function keyOf(e) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'q') return 'l';
      if (k === 'ArrowRight' || k === 'd') return 'r';
      if (k === 'ArrowUp' || k === 'w' || k === 'z') return 'up';
      if (k === ' ') return 'fire';
      return null;
    }
    api.onKey((e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat &&
          (state === 'ready' || (state === 'over' && performance.now() - overAt > 900))) {
        api.hideOverlay(); start(); return;
      }
      const k = keyOf(e);
      if (k && state === 'play') keys[k] = true;
    });
    api.on(document, 'keyup', (e) => { const k = keyOf(e); if (k) keys[k] = false; });
    api.on(window, 'blur', () => { keys.l = keys.r = keys.up = keys.fire = false; ptr.on = false; });

    function setPtr(e) { const p = cv.toLocal(e.clientX, e.clientY); ptr.x = p.x; ptr.y = p.y; }
    api.on(cv.el, 'pointerdown', (e) => {
      if (state !== 'play') return;
      e.preventDefault();
      ptr.on = true; ptr.id = e.pointerId; setPtr(e);
      try { cv.el.setPointerCapture(e.pointerId); } catch (err) { /* sans capture */ }
    });
    api.on(cv.el, 'pointermove', (e) => { if (ptr.on && e.pointerId === ptr.id) setPtr(e); });
    const release = (e) => { if (e.pointerId === ptr.id) ptr.on = false; };
    api.on(cv.el, 'pointerup', release);
    api.on(cv.el, 'pointercancel', release);
    api.on(cv.el, 'lostpointercapture', release);
    api.on(cv.el, 'touchmove', (e) => { if (state === 'play') e.preventDefault(); }, { passive: false });
    api.on(cv.el, 'contextmenu', (e) => e.preventDefault());

    // écran d'accueil : quelques rochers dérivent derrière le panneau
    spawnWave(1);
    api.hud({ score: 0 });
    loop.start();
    api.overlay({
      title: api.t('Astéroïdes', 'Asteroids'),
      text: api.t(
        '← → pour pivoter, ↑ pour avancer, Espace pour tirer. Au doigt ou à la souris : maintenez l\'appui, le vaisseau vise et tire tout seul.',
        '← → to turn, ↑ to thrust, Space to fire. Touch or mouse: hold down, the ship aims and fires on its own.'
      ),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart() { lastStart = -1e9; start(); } };
  },
});

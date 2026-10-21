/* ==================================================================
   games/flappy.js · Envol
   Un avion de papier lumineux plane entre des portiques. Gravité et
   impulsion au pas fixe, inclinaison selon la vitesse verticale,
   deux couches de décor en parallaxe. La zone de collision est un
   peu plus petite que le dessin, pour rester juste.
   ================================================================== */
SBG.register('flappy', {
  create(api) {
    const { C } = api;
    const W = 480, H = 560;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();
    const MANY = api.reduced ? 0.4 : 1;

    const PX = 140, HIT = 8.5, GRAV = 1500, LIFT = -455, VMAX = 640;
    const GW = 56, SPACING = 230, FLOOR = H - 26;

    let plane, prev, gates, speed, score, state, deadT, trail, layers, lastGapY, hoverT, lastStart = -1e9, runId = 0;

    function makeLayers() {
      const far = [], near = [];
      for (let i = 0; i < 70; i++) far.push({ x: Math.random() * W, y: Math.random() * (FLOOR - 10), r: 0.6 + Math.random() * 0.9, a: 0.15 + Math.random() * 0.25 });
      for (let i = 0; i < 14; i++) near.push({ x: Math.random() * W, y: 30 + Math.random() * (FLOOR - 80), len: 18 + Math.random() * 40, a: 0.05 + Math.random() * 0.07 });
      return { far, near, offFar: 0, offNear: 0 };
    }

    // Les couches bouclent sur W : on les dessine une fois sur une tuile répétable
    function makeTiles() {
      const mk = () => { const c = document.createElement('canvas'); c.width = cv.el.width; c.height = cv.el.height; const g = c.getContext('2d'); g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0); return [c, g]; };
      const [far, gf] = mk(), [near, gn] = mk();
      for (const p of layers.far) { gf.globalAlpha = p.a; gf.fillStyle = C.ink; gf.fillRect(p.x, p.y, p.r, p.r); }
      gn.lineWidth = 1; gn.lineCap = 'round'; gn.strokeStyle = C.blue;
      for (const p of layers.near) {
        gn.globalAlpha = p.a;
        for (const dx of [0, -W]) { gn.beginPath(); gn.moveTo(p.x + dx, p.y); gn.lineTo(p.x + dx + p.len, p.y); gn.stroke(); }
      }
      return { far, near };
    }

    function reset() {
      plane = { y: H * 0.45, vy: 0, a: 0 };
      prev = { y: plane.y, a: 0 };
      gates = []; speed = 150; score = 0; deadT = 0; trail = []; hoverT = 0;
      lastGapY = H * 0.45;
      if (!layers) layers = makeLayers();
      fx.clear();
      api.hud({ score: 0 });
    }

    const gapSize = () => Math.max(132, 178 - score * 2);
    function addGate(x) {
      const g = gapSize();
      const lo = 60 + g / 2, hi = FLOOR - 40 - g / 2;
      let y = lo + Math.random() * (hi - lo);
      y = api.clamp(y, lastGapY - 170, lastGapY + 170);
      lastGapY = y;
      gates.push({ x, y, g, passed: false, glow: 0 });
    }

    function start() {
      const now = performance.now();
      if (now - lastStart < 350) return;
      lastStart = now; runId++;
      reset();
      state = 'play';
      addGate(W + 60);
      flap();
      api.status('');
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      loop.start();
    }

    function flap() {
      if (state !== 'play') return;
      plane.vy = LIFT;
      api.tone(560, 0.07, 'sine', 0.28, 1.35);
      fx.burst(PX - 14, plane.y + 3, { n: Math.round(4 * MANY), color: 'rgba(56,189,248,0.8)', speed: 60, life: 0.35, size: 1.5 });
    }

    function crash() {
      state = 'dead'; deadT = 0;
      api.sfx('hit'); api.sfx('lose'); api.shake(6);
      fx.burst(PX, plane.y, { n: Math.round(26 * MANY), color: [C.cyan, '#fff', C.violet], speed: 220, life: 0.7, gravity: 300 });
      plane.vy = Math.min(plane.vy, -180);
      const record = api.setBest(score);
      const id = runId;
      api.after(800, () => {
        if (id !== runId) return;
        api.overlay({
          kicker: record && score > 0 ? api.t('Nouveau record', 'New best') : '',
          title: api.t('Atterrissage forcé', 'Crash landing'),
          text: score === 1 ? api.t('1 portique franchi', '1 gate cleared') : api.t(score + ' portiques franchis', score + ' gates cleared'),
          action: api.t('Rejouer', 'Play again'),
          tone: record && score > 0 ? 'good' : '',
          onAction: start,
        });
      });
    }

    function collides() {
      if (plane.y + HIT > FLOOR) return true;
      for (const g of gates) {
        if (PX + HIT < g.x || PX - HIT > g.x + GW) continue;
        const top = g.y - g.g / 2, bot = g.y + g.g / 2;
        if (circleRect(PX, plane.y, HIT, g.x, -1000, GW, top + 1000)) return true;
        if (circleRect(PX, plane.y, HIT, g.x, bot, GW, 1000)) return true;
      }
      return false;
    }
    function circleRect(cx, cy, r, x, y, w, h) {
      const nx = api.clamp(cx, x, x + w), ny = api.clamp(cy, y, y + h);
      return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
    }

    const loop = api.loop({
      update(dt) {
        fx.update(dt);
        prev.y = plane.y; prev.a = plane.a;
        hoverT += dt;
        const scroll = state === 'play' ? speed : state === 'ready' ? 60 : 0;
        layers.offFar = (layers.offFar + scroll * 0.18 * dt) % W;
        layers.offNear = (layers.offNear + scroll * 0.5 * dt) % W;
        for (const p of trail) p.x -= scroll * dt;

        if (state === 'ready') {
          plane.y = H * 0.45 + Math.sin(hoverT * 2.4) * 8;
          plane.a = Math.cos(hoverT * 2.4) * 0.08;
          return;
        }
        if (state === 'dead') {
          deadT += dt;
          if (plane.y < FLOOR - 6) {
            plane.vy = Math.min(VMAX, plane.vy + GRAV * dt);
            plane.y = Math.min(FLOOR - 6, plane.y + plane.vy * dt);
            plane.a += dt * 5;
          }
          return;
        }
        if (state !== 'play') return;

        plane.vy = Math.min(VMAX, plane.vy + GRAV * dt);
        plane.y += plane.vy * dt;
        if (plane.y < HIT) { plane.y = HIT; plane.vy = Math.max(0, plane.vy); }
        const target = api.clamp(plane.vy / 700, -0.45, 1.05);
        plane.a += (target - plane.a) * Math.min(1, dt * 10);

        for (const g of gates) {
          g.x -= speed * dt;
          g.glow = Math.max(0, g.glow - dt * 2.5);
          if (!g.passed && g.x + GW < PX - HIT) {
            g.passed = true; g.glow = 1;
            score++;
            api.hud({ score });
            api.sfx('score');
            fx.burst(g.x + GW / 2, g.y, { n: Math.round(8 * MANY), color: [C.cyan, C.violet], speed: 110, life: 0.45, size: 1.8 });
            if (score >= 20) api.unlock('flappy_20');
            speed = Math.min(225, 150 + score * 3);
          }
        }
        if (gates.length && gates[0].x + GW < -10) gates.shift();
        const last = gates[gates.length - 1];
        if (!last || last.x < W - SPACING) addGate((last ? last.x : W) + SPACING);

        if (!api.reduced) {
          trail.push({ x: PX - 13 * Math.cos(plane.a), y: plane.y - 13 * Math.sin(plane.a) });
          if (trail.length > 22) trail.shift();
        }
        if (collides()) crash();
      },
      render(alpha) {
        cv.clear(C.bg);
        // deux couches de décor, pré-rendues en tuiles et défilées
        if (!layers.tiles) layers.tiles = makeTiles();
        const fo = layers.offFar % W, no = layers.offNear % W;
        ctx.drawImage(layers.tiles.far, -fo, 0, W, H); ctx.drawImage(layers.tiles.far, W - fo, 0, W, H);
        ctx.drawImage(layers.tiles.near, -no, 0, W, H); ctx.drawImage(layers.tiles.near, W - no, 0, W, H);

        // sol
        ctx.strokeStyle = C.line;
        ctx.beginPath(); ctx.moveTo(0, FLOOR + 0.5); ctx.lineTo(W, FLOOR + 0.5); ctx.stroke();
        ctx.fillStyle = C.grid;
        const off = (layers.offNear * 2) % 24;
        for (let x = -off; x < W; x += 24) ctx.fillRect(x, FLOOR + 8, 10, 1.5);

        // portiques (interpolés entre deux pas fixes)
        const shift = state === 'play' ? speed * (1 - alpha) / 120 : 0;
        for (const g of gates) drawGate(g.x + shift, g);

        // traînée
        if (trail.length > 2) {
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (let i = 1; i < trail.length; i++) {
            const k = i / trail.length;
            ctx.strokeStyle = 'rgba(56,189,248,' + (k * k * 0.35) + ')';
            ctx.lineWidth = 0.5 + k * 2.5;
            ctx.beginPath(); ctx.moveTo(trail[i - 1].x + shift, trail[i - 1].y); ctx.lineTo(trail[i].x + shift, trail[i].y); ctx.stroke();
          }
        }

        const py = prev.y + (plane.y - prev.y) * alpha;
        const pa = prev.a + (plane.a - prev.a) * alpha;
        drawPlane(PX, py, pa);
        fx.draw(ctx);

        // score en grand, discret
        if (state === 'play' || state === 'dead') {
          ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = 'rgba(238,241,247,0.85)'; ctx.font = '750 40px ' + api.font;
          ctx.fillText(String(score), W / 2, 66);
        }
      },
    });

    function drawGate(x, g) {
      const top = g.y - g.g / 2, bot = g.y + g.g / 2;
      const col = g.passed ? '120,140,255' : '210,168,255';
      // piliers
      const grad = ctx.createLinearGradient(x, 0, x + GW, 0);
      grad.addColorStop(0, 'rgba(' + col + ',0.16)'); grad.addColorStop(0.5, 'rgba(' + col + ',0.28)'); grad.addColorStop(1, 'rgba(' + col + ',0.12)');
      ctx.fillStyle = grad;
      api.roundRect(ctx, x, -20, GW, top + 20, 12); ctx.fill();
      api.roundRect(ctx, x, bot, GW, FLOOR - bot + 20, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(' + col + ',0.45)'; ctx.lineWidth = 1;
      api.roundRect(ctx, x + 0.5, -20, GW - 1, top + 20, 12); ctx.stroke();
      api.roundRect(ctx, x + 0.5, bot, GW - 1, FLOOR - bot + 20, 12); ctx.stroke();
      // embouts lumineux
      ctx.fillStyle = 'rgba(' + col + ',0.95)';
      api.roundRect(ctx, x + 6, top - 4, GW - 12, 4, 2); ctx.fill();
      api.roundRect(ctx, x + 6, bot, GW - 12, 4, 2); ctx.fill();
      // halo bref quand le portique est franchi
      if (g.glow > 0) {
        const rg = ctx.createRadialGradient(x + GW / 2, g.y, 0, x + GW / 2, g.y, g.g * 0.5);
        rg.addColorStop(0, 'rgba(' + col + ',' + (g.glow * 0.22) + ')'); rg.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = rg; ctx.fillRect(x + GW / 2 - g.g * 0.5, top, g.g, g.g);
      }
    }

    function drawPlane(x, y, a) {
      const dead = state === 'dead';
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 34);
      glow.addColorStop(0, dead ? 'rgba(255,123,114,0.25)' : 'rgba(56,189,248,0.3)'); glow.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - 34, y - 34, 68, 68);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(a); ctx.scale(1.2, 1.2);
      // aile basse (ombre)
      ctx.fillStyle = dead ? '#B5566B' : '#1FA9C4';
      ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-13, 9); ctx.lineTo(-6, 1.5); ctx.closePath(); ctx.fill();
      // aile haute
      ctx.fillStyle = dead ? C.bad : '#BAE6FD';
      ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-14, -10); ctx.lineTo(-6, 1.5); ctx.closePath(); ctx.fill();
      // pli central
      ctx.strokeStyle = dead ? 'rgba(255,255,255,0.4)' : 'rgba(56,189,248,0.9)'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-6, 1.5); ctx.lineTo(-11, 4); ctx.stroke();
      ctx.restore();
    }

    /* ── Entrées ─────────────────────────────────────────────────── */
    api.on(cv.el, 'pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      flap();
    });
    api.onKey((e) => {
      const k = e.key;
      if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'z' || k === 'Enter') {
        if (state === 'play') { if (!e.repeat) flap(); }
        else if ((state === 'ready' || (state === 'dead' && deadT > 0.5)) && k !== 'ArrowUp' && k !== 'w' && k !== 'z') { api.hideOverlay(); start(); }
      }
    });

    // écran d'accueil
    reset(); state = 'ready';
    loop.start();
    api.overlay({
      title: api.t('Envol', 'Glide'),
      text: api.t('Gardez l\'avion en l\'air et passez entre les portiques.', 'Keep the plane aloft and slip through the gates.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart() { lastStart = -1e9; start(); } };
  },
});

/* ==================================================================
   games/flappy.js · Envol
   Un avion de papier lumineux plane entre des portiques. Gravité et
   impulsion au pas fixe, inclinaison selon la vitesse verticale,
   deux couches de décor en parallaxe. La zone de collision est un
   peu plus petite que le dessin, pour rester juste.
   Bonus : de temps en temps, une capsule flotte entre deux portiques
   (bouclier, mini, aimant à points, ralenti).
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

    // Catalogue des bonus : nom, couleur, durée (0 = tenu jusqu'à usage), poids de tirage
    const POWERS = {
      shield: { fr: 'Bouclier', en: 'Shield', col: C.cyan, rgb: '56,189,248', dur: 0, w: 26 },
      mini:   { fr: 'Mini', en: 'Tiny', col: C.violet, rgb: '210,168,255', dur: 8, w: 24 },
      magnet: { fr: 'Aimant à points', en: 'Score magnet', col: C.warm, rgb: '255,166,87', dur: 10, w: 26 },
      slow:   { fr: 'Ralenti', en: 'Slow motion', col: C.good, rgb: '63,185,80', dur: 6, w: 24 },
    };
    const KINDS = Object.keys(POWERS);
    const TIMED = ['mini', 'magnet', 'slow'];
    const MINI_K = 0.6, SLOW_K = 0.7, INVULN = 1;

    // score = points (aimant x2), passed = portiques réellement franchis (succès, difficulté)
    let plane, prev, gates, speed, score, passed, state, deadT, trail, layers, lastGapY, hoverT, lastStart = -1e9, runId = 0;
    let items, labels, pow, shield, invuln, size, slowK, gateCount, sinceItem, statusMask;

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
      gates = []; speed = 150; score = 0; passed = 0; deadT = 0; trail = []; hoverT = 0;
      items = []; labels = []; pow = { mini: 0, magnet: 0, slow: 0 };
      shield = false; invuln = 0; size = 1; slowK = 1; gateCount = 0; sinceItem = 0; statusMask = -1;
      lastGapY = H * 0.45;
      if (!layers) layers = makeLayers();
      fx.clear();
      api.hud({ score: 0 });
    }

    const gapSize = () => Math.max(132, 178 - passed * 2);
    function addGate(x) {
      const g = gapSize();
      const lo = 60 + g / 2, hi = FLOOR - 40 - g / 2;
      let y = lo + Math.random() * (hi - lo);
      y = api.clamp(y, lastGapY - 170, lastGapY + 170);
      const py = lastGapY;
      lastGapY = y;
      gates.push({ x, y, g, passed: false, glow: 0 });
      gateCount++;
      maybeSpawn(x, py, y);
    }

    // une capsule à mi-chemin entre le portique précédent et celui-ci, sur la trajectoire naturelle
    function maybeSpawn(x, py, y) {
      if (gateCount < 3 || items.length) return;
      sinceItem++;
      if (Math.random() > 0.2 && sinceItem < 9) return;
      const ok = (k) => (k === 'shield' ? !shield : !(pow[k] > 0));
      let total = 0;
      for (const k of KINDS) if (ok(k)) total += POWERS[k].w;
      if (!total) return;
      let r = Math.random() * total, kind = KINDS[0];
      for (const k of KINDS) { if (!ok(k)) continue; r -= POWERS[k].w; if (r <= 0) { kind = k; break; } }
      sinceItem = 0;
      items.push({ kind, x: x - SPACING / 2 + GW / 2, base: api.clamp((py + y) / 2, 60, FLOOR - 60), y: 0, t: Math.random() * 6 });
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
      fx.burst(PX - 14 * size, plane.y + 3, { n: Math.round(4 * MANY), color: 'rgba(56,189,248,0.8)', speed: 60, life: 0.35, size: 1.5 });
    }

    function crash() {
      state = 'dead'; deadT = 0;
      api.sfx('hit'); api.sfx('lose'); api.shake(6);
      api.status(''); statusMask = 0;
      fx.burst(PX, plane.y, { n: Math.round(26 * MANY), color: [C.cyan, '#fff', C.violet], speed: 220, life: 0.7, gravity: 300 });
      plane.vy = Math.min(plane.vy, -180);
      const record = api.setBest(score);
      const id = runId;
      const gatesTxt = passed === 1 ? api.t('1 portique franchi', '1 gate cleared') : api.t(passed + ' portiques franchis', passed + ' gates cleared');
      api.after(800, () => {
        if (id !== runId) return;
        api.overlay({
          kicker: record && score > 0 ? api.t('Nouveau record', 'New best') : '',
          title: api.t('Atterrissage forcé', 'Crash landing'),
          text: score === passed ? gatesTxt : score + ' points, ' + gatesTxt,
          action: api.t('Rejouer', 'Play again'),
          tone: record && score > 0 ? 'good' : '',
          onAction: start,
        });
      });
    }

    // 0 : rien, 1 : sol, 2 : pilier haut, 3 : pilier bas
    function collides(r) {
      if (plane.y + r > FLOOR) return 1;
      for (const g of gates) {
        if (PX + r < g.x || PX - r > g.x + GW) continue;
        const top = g.y - g.g / 2, bot = g.y + g.g / 2;
        if (circleRect(PX, plane.y, r, g.x, -1000, GW, top + 1000)) return 2;
        if (circleRect(PX, plane.y, r, g.x, bot, GW, 1000)) return 3;
      }
      return 0;
    }
    function circleRect(cx, cy, r, x, y, w, h) {
      const nx = api.clamp(cx, x, x + w), ny = api.clamp(cy, y, y + h);
      return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
    }
    // l'avion est-il à hauteur d'un portique (pour ne pas regrandir dedans) ?
    function inGate() {
      const r = HIT + 4;
      for (const g of gates) if (PX + r >= g.x && PX - r <= g.x + GW) return true;
      return false;
    }

    // le bouclier encaisse : rebond vers l'ouverture et invulnérabilité
    function bounce(kind, r) {
      if (kind === 2) plane.vy = 260;
      else { plane.vy = LIFT * 0.85; if (kind === 1) plane.y = FLOOR - r - 1; }
    }
    function shieldBreak(kind, r) {
      shield = false; invuln = INVULN;
      bounce(kind, r);
      api.sfx('hit'); api.tone(420, 0.18, 'triangle', 0.3, 1.8); api.shake(3);
      fx.burst(PX, plane.y, { n: Math.round(22 * MANY), color: [C.cyan, '#fff'], speed: 230, life: 0.55 });
    }

    function chime() {
      api.tone(660, 0.08, 'triangle', 0.32);
      api.after(65, () => api.tone(880, 0.08, 'triangle', 0.32));
      api.after(130, () => api.tone(1320, 0.14, 'triangle', 0.3));
    }

    function collect(it) {
      const P = POWERS[it.kind];
      chime();
      fx.burst(it.x, it.y, { n: Math.round(18 * MANY), color: [P.col, '#fff', P.col], speed: 200, life: 0.55 });
      labels.push({ x: api.clamp(it.x, 70, W - 70), y: it.y - 18, text: api.t(P.fr, P.en), col: P.col, t: 0 });
      if (it.kind === 'shield') shield = true;
      else pow[it.kind] = P.dur;
    }

    function syncStatus() {
      const m = (shield ? 1 : 0) | (pow.mini > 0 ? 2 : 0) | (pow.magnet > 0 ? 4 : 0) | (pow.slow > 0 ? 8 : 0);
      if (m === statusMask) return;
      statusMask = m;
      const names = [];
      if (shield) names.push(api.t(POWERS.shield.fr, POWERS.shield.en));
      for (const k of TIMED) if (pow[k] > 0) names.push(api.t(POWERS[k].fr, POWERS[k].en));
      api.status(names.length ? api.t('Actif : ', 'Active: ') + names.join(' · ') : '');
    }

    const loop = api.loop({
      update(dt) {
        fx.update(dt);
        prev.y = plane.y; prev.a = plane.a;
        hoverT += dt;
        for (let i = labels.length - 1; i >= 0; i--) { labels[i].t += dt; if (labels[i].t > 1.1) labels.splice(i, 1); }
        // ralenti : la vitesse de défilement glisse en douceur vers 70 %
        slowK += ((pow.slow > 0 ? SLOW_K : 1) - slowK) * Math.min(1, dt * 5);
        const sp = speed * slowK;
        const scroll = state === 'play' ? sp : state === 'ready' ? 60 : 0;
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

        // minuteries des bonus ; Mini attend d'être sorti d'un portique pour regrandir
        for (const k of TIMED) {
          if (pow[k] <= 0) continue;
          pow[k] -= dt;
          if (pow[k] <= 0) pow[k] = k === 'mini' && inGate() ? 0.001 : 0;
        }
        if (invuln > 0) invuln = Math.max(0, invuln - dt);
        size += ((pow.mini > 0 ? MINI_K : 1) - size) * Math.min(1, dt * 9);
        const r = HIT * size;

        plane.vy = Math.min(VMAX, plane.vy + GRAV * dt);
        plane.y += plane.vy * dt;
        if (plane.y < r) { plane.y = r; plane.vy = Math.max(0, plane.vy); }
        const target = api.clamp(plane.vy / 700, -0.45, 1.05);
        plane.a += (target - plane.a) * Math.min(1, dt * 10);

        for (const g of gates) {
          g.x -= sp * dt;
          g.glow = Math.max(0, g.glow - dt * 2.5);
          if (!g.passed && g.x + GW < PX - r) {
            g.passed = true; g.glow = 1;
            passed++;
            const gain = pow.magnet > 0 ? 2 : 1;
            score += gain;
            api.hud({ score });
            api.sfx('score');
            fx.burst(g.x + GW / 2, g.y, { n: Math.round(8 * MANY), color: gain > 1 ? [C.warm, C.violet] : [C.cyan, C.violet], speed: 110, life: 0.45, size: 1.8 });
            // le succès compte les portiques franchis, pas les points
            if (passed >= 20) api.unlock('flappy_20');
            speed = Math.min(225, 150 + passed * 3);
          }
        }
        if (gates.length && gates[0].x + GW < -10) gates.shift();
        const last = gates[gates.length - 1];
        if (!last || last.x < W - SPACING) addGate((last ? last.x : W) + SPACING);

        // capsules : défilent, flottent, ramassées au contact
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.t += dt; it.x -= sp * dt;
          it.y = it.base + Math.sin(it.t * 3) * 6;
          const dx = it.x - PX, dy = it.y - plane.y, rr = r + 12;
          if (dx * dx + dy * dy < rr * rr) { collect(it); items.splice(i, 1); }
          else if (it.x < -20) items.splice(i, 1);
        }
        syncStatus();

        if (!api.reduced) {
          trail.push({ x: PX - 13 * size * Math.cos(plane.a), y: plane.y - 13 * size * Math.sin(plane.a) });
          if (trail.length > 22) trail.shift();
        }
        const hit = collides(r);
        if (hit) {
          if (invuln > 0) { if (hit === 1) bounce(1, r); }
          else if (shield) shieldBreak(hit, r);
          else crash();
        }
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
        const shift = state === 'play' ? speed * slowK * (1 - alpha) / 120 : 0;
        for (const g of gates) drawGate(g.x + shift, g);
        for (const it of items) drawItem(it, it.x + shift);

        // traînée
        if (trail.length > 2) {
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (let i = 1; i < trail.length; i++) {
            const k = i / trail.length;
            ctx.strokeStyle = 'rgba(56,189,248,' + (k * k * 0.35) + ')';
            ctx.lineWidth = (0.5 + k * 2.5) * size;
            ctx.beginPath(); ctx.moveTo(trail[i - 1].x + shift, trail[i - 1].y); ctx.lineTo(trail[i].x + shift, trail[i].y); ctx.stroke();
          }
        }

        const py = prev.y + (plane.y - prev.y) * alpha;
        const pa = prev.a + (plane.a - prev.a) * alpha;
        // clignote pendant l'invulnérabilité
        const blink = invuln > 0 && state === 'play' && Math.sin(invuln * 40) < -0.2;
        ctx.globalAlpha = blink ? 0.45 : 1;
        drawPlane(PX, py, pa);
        ctx.globalAlpha = 1;
        if (state === 'play' && (shield || invuln > 0)) drawBubble(PX, py);
        fx.draw(ctx);
        drawLabels();

        // score en grand, discret ; x2 à côté pendant l'aimant
        if (state === 'play' || state === 'dead') {
          ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = 'rgba(238,241,247,0.85)'; ctx.font = '750 40px ' + api.font;
          const s = String(score);
          ctx.fillText(s, W / 2, 66);
          if (pow.magnet > 0 && state === 'play') {
            const wx = W / 2 + ctx.measureText(s).width / 2 + 8;
            ctx.textAlign = 'left'; ctx.font = '750 18px ' + api.font;
            ctx.globalAlpha = pow.magnet < 2 && Math.sin(pow.magnet * 18) < 0 ? 0.35 : 1;
            ctx.fillStyle = C.warm; ctx.fillText('x2', wx, 50);
            ctx.globalAlpha = 1;
          }
        }
        drawBars();
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
      const gr = 34 * size;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, gr);
      glow.addColorStop(0, dead ? 'rgba(255,123,114,0.25)' : 'rgba(56,189,248,0.3)'); glow.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - gr, y - gr, gr * 2, gr * 2);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(a); ctx.scale(1.2 * size, 1.2 * size);
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

    // bulle cyan : stable quand le bouclier est prêt, vacillante pendant l'invulnérabilité
    function drawBubble(x, y) {
      const rad = 25 * size + (invuln > 0 ? (1 - invuln / INVULN) * 6 : Math.sin(hoverT * 4) * 1.2);
      const a = invuln > 0 ? (Math.sin(invuln * 30) > 0 ? 0.9 : 0.35) * (0.4 + 0.6 * invuln / INVULN) : 0.75;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(56,189,248,0.10)';
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y, rad - 4, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // capsule ronde : halo, fond teinté, contour clair, pictogramme tracé
    function drawItem(it, x) {
      const P = POWERS[it.kind], y = it.y;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 26);
      g.addColorStop(0, 'rgba(' + P.rgb + ',0.4)'); g.addColorStop(1, 'rgba(' + P.rgb + ',0)');
      ctx.fillStyle = g; ctx.fillRect(x - 26, y - 26, 52, 52);
      ctx.fillStyle = 'rgba(' + P.rgb + ',0.2)';
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 10.5, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.translate(x, y);
      glyph(it.kind, P.col);
      ctx.restore();
    }

    function glyph(kind, col) {
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      if (kind === 'shield') {
        ctx.moveTo(0, -6); ctx.lineTo(5, -4); ctx.lineTo(4.5, 1); ctx.quadraticCurveTo(3.5, 4.5, 0, 6.5);
        ctx.quadraticCurveTo(-3.5, 4.5, -4.5, 1); ctx.lineTo(-5, -4); ctx.closePath(); ctx.fill();
      } else if (kind === 'mini') {
        // petit avion entre deux crochets qui se resserrent
        ctx.moveTo(4, 0); ctx.lineTo(-3, -3.2); ctx.lineTo(-1.4, 0.4); ctx.lineTo(-3, 3.2); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-6.5, -3.5); ctx.lineTo(-6.5, -6.5); ctx.lineTo(-3.5, -6.5);
        ctx.moveTo(6.5, 3.5); ctx.lineTo(6.5, 6.5); ctx.lineTo(3.5, 6.5); ctx.stroke();
      } else if (kind === 'magnet') {
        ctx.lineWidth = 2.6; ctx.lineCap = 'butt';
        ctx.moveTo(-3.6, -5); ctx.lineTo(-3.6, 0); ctx.arc(0, 0, 3.6, Math.PI, 0, true); ctx.lineTo(3.6, -5); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.fillRect(-4.9, -6.5, 2.6, 2.2); ctx.fillRect(2.3, -6.5, 2.6, 2.2);
      } else if (kind === 'slow') {
        ctx.moveTo(-4, -5); ctx.lineTo(4, -5); ctx.lineTo(-4, 5); ctx.lineTo(4, 5); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2, 4); ctx.lineTo(2, 4); ctx.lineTo(0, 1.5); ctx.closePath(); ctx.fill();
      }
    }

    // nom du bonus qui monte en s'effaçant
    function drawLabels() {
      if (!labels.length) return;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 13px ' + api.font;
      for (const l of labels) {
        const k = l.t / 1.1, y = l.y - api.ease.out(k) * 28;
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = C.bg; ctx.fillText(l.text, l.x + 1, y + 1);
        ctx.fillStyle = l.col; ctx.fillText(l.text, l.x, y);
      }
      ctx.globalAlpha = 1;
    }

    // barres de temps restant, en haut du canvas
    function drawBars() {
      if (state !== 'play') return;
      let row = 0;
      for (const k of TIMED) {
        if (pow[k] <= 0) continue;
        const P = POWERS[k], y = 2 + row * 5;
        ctx.fillStyle = 'rgba(' + P.rgb + ',0.18)'; ctx.fillRect(0, y, W, 3);
        ctx.fillStyle = P.col; ctx.fillRect(0, y, W * Math.min(1, pow[k] / P.dur), 3);
        row++;
      }
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
      text: api.t('Gardez l\'avion en l\'air et passez entre les portiques. Des bonus flottent parfois entre eux : bouclier, mini, aimant à points, ralenti.',
        'Keep the plane aloft and slip through the gates. Power-ups sometimes float between them: shield, tiny, score magnet, slow motion.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart() { lastStart = -1e9; start(); } };
  },
});

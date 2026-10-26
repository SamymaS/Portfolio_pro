/* ==================================================================
   games/fruits.js · Fruits (jeu de fusion façon Suika)
   On lâche des fruits dans un bocal. Deux fruits identiques qui se
   touchent fusionnent en un fruit plus gros, de la cerise jusqu'à
   la pastèque. Physique de Verlet à pas fixe : positions, contraintes
   de contact résolues plusieurs fois par pas, ce qui donne des piles
   stables. Les fruits sont dessinés une seule fois dans des sprites,
   puis tournés selon leur roulement.
   ================================================================== */
SBG.register('fruits', {
  create(api) {
    const { C } = api;
    const W = 380, H = 580;
    const LEFT = 16, RIGHT = W - 16, FLOOR = H - 16;
    const DROP_Y = 62, DANGER_Y = 112;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();

    /* ── Les onze fruits ─────────────────────────────────────────── */
    // r : rayon logique, c : couleur, d : couleur sombre (contour, ombres)
    const KINDS = [
      { fr: 'cerise', en: 'cherry', r: 14, c: '#E5383B', d: '#9D1A22' },
      { fr: 'fraise', en: 'strawberry', r: 19, c: '#FF5D73', d: '#B8263D' },
      { fr: 'raisin', en: 'grape', r: 25, c: '#9B5DE5', d: '#5B2A9A' },
      { fr: 'clémentine', en: 'clementine', r: 30, c: '#FFB347', d: '#C9761A' },
      { fr: 'orange', en: 'orange', r: 37, c: '#FF8C21', d: '#B9580A' },
      { fr: 'pomme', en: 'apple', r: 45, c: '#F25F5C', d: '#A8302D' },
      { fr: 'poire', en: 'pear', r: 52, c: '#C9E265', d: '#7E9A2A' },
      { fr: 'pêche', en: 'peach', r: 61, c: '#FFB4A2', d: '#D9786A' },
      { fr: 'ananas', en: 'pineapple', r: 71, c: '#F7D154', d: '#B8901A' },
      { fr: 'melon', en: 'melon', r: 83, c: '#B5E48C', d: '#6E9E46' },
      { fr: 'pastèque', en: 'watermelon', r: 98, c: '#3FB950', d: '#1E6B2C' },
    ];
    const LAST = KINDS.length - 1;
    const name = (k) => api.t(KINDS[k].fr, KINDS[k].en);
    const points = (k) => ((k + 1) * (k + 2)) / 2;

    /* ── Sprites : chaque fruit dessiné une fois, à la résolution de l'écran ── */
    const dpr = cv.dpr;
    const SPR = KINDS.map((k, i) => makeSprite(i));

    function makeSprite(i) {
      const k = KINDS[i];
      const pad = 10;
      const size = Math.ceil((k.r + pad) * 2);
      const c = document.createElement('canvas');
      c.width = Math.ceil(size * dpr); c.height = Math.ceil(size * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, size / 2 * dpr, size / 2 * dpr);
      drawFruit(g, i, k.r);
      return { c, size };
    }

    function drawFruit(g, i, r) {
      const k = KINDS[i];
      // corps : dégradé radial décentré, contour plus sombre
      const body = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      body.addColorStop(0, shade(k.c, 0.28));
      body.addColorStop(0.65, k.c);
      body.addColorStop(1, shade(k.c, -0.18));
      g.fillStyle = body;
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();

      g.save();
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.clip();
      // motifs propres à chaque fruit
      if (i === 1) { // fraise : graines
        g.fillStyle = 'rgba(255,230,140,0.85)';
        for (let a = 0; a < 14; a++) {
          const ang = a * 2.4, rr = r * (0.25 + (a % 4) * 0.17);
          g.beginPath(); g.ellipse(Math.cos(ang) * rr, Math.sin(ang) * rr + r * 0.1, 1.3, 2, ang, 0, Math.PI * 2); g.fill();
        }
      } else if (i === 2) { // raisin : grains
        g.fillStyle = 'rgba(255,255,255,0.10)';
        for (let a = 0; a < 7; a++) {
          const ang = a * 0.9, rr = r * 0.48;
          g.beginPath(); g.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, r * 0.32, 0, Math.PI * 2); g.fill();
        }
        g.strokeStyle = 'rgba(40,10,70,0.35)'; g.lineWidth = 1.2;
        for (let a = 0; a < 7; a++) {
          const ang = a * 0.9, rr = r * 0.48;
          g.beginPath(); g.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, r * 0.32, 0, Math.PI * 2); g.stroke();
        }
      } else if (i === 3 || i === 4) { // agrumes : pores
        g.fillStyle = 'rgba(120,50,0,0.16)';
        for (let a = 0; a < 26; a++) {
          const ang = a * 2.39996, rr = r * Math.sqrt((a + 0.5) / 26) * 0.92;
          g.beginPath(); g.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, 1.1, 0, Math.PI * 2); g.fill();
        }
      } else if (i === 6) { // poire : taches
        g.fillStyle = 'rgba(110,130,30,0.22)';
        for (let a = 0; a < 18; a++) {
          const ang = a * 2.39996, rr = r * Math.sqrt((a + 0.5) / 18) * 0.85;
          g.beginPath(); g.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, 1.6, 0, Math.PI * 2); g.fill();
        }
      } else if (i === 7) { // pêche : sillon
        g.strokeStyle = 'rgba(190,90,80,0.45)'; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(-r * 0.05, -r); g.quadraticCurveTo(r * 0.35, 0, -r * 0.05, r); g.stroke();
      } else if (i === 8) { // ananas : écailles
        g.strokeStyle = 'rgba(140,90,10,0.45)'; g.lineWidth = 1.6;
        for (let d = -r * 2; d < r * 2; d += r * 0.38) {
          g.beginPath(); g.moveTo(d, -r); g.lineTo(d + r * 2, r); g.stroke();
          g.beginPath(); g.moveTo(d, r); g.lineTo(d + r * 2, -r); g.stroke();
        }
      } else if (i === 9) { // melon : filet
        g.strokeStyle = 'rgba(255,255,240,0.45)'; g.lineWidth = 1.4;
        for (let a = 0; a < 9; a++) {
          const x = -r + a * (r / 4);
          g.beginPath(); g.moveTo(x, -r); g.bezierCurveTo(x + r * 0.3, -r * 0.3, x - r * 0.3, r * 0.3, x + r * 0.1, r); g.stroke();
        }
        for (let a = 0; a < 7; a++) {
          const y = -r + a * (r / 3);
          g.beginPath(); g.moveTo(-r, y); g.bezierCurveTo(-r * 0.3, y + r * 0.2, r * 0.3, y - r * 0.2, r, y + r * 0.05); g.stroke();
        }
      } else if (i === 10) { // pastèque : rayures
        g.fillStyle = '#145222';
        for (let a = -4; a <= 4; a++) {
          const x = a * r * 0.28;
          g.beginPath();
          g.moveTo(x - r * 0.05, -r);
          g.bezierCurveTo(x + r * 0.16, -r * 0.4, x - r * 0.12, r * 0.4, x + r * 0.06, r);
          g.lineTo(x + r * 0.16, r);
          g.bezierCurveTo(x - r * 0.02, r * 0.4, x + r * 0.26, -r * 0.4, x + r * 0.07, -r);
          g.closePath(); g.fill();
        }
      }
      // reflet
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.beginPath(); g.ellipse(-r * 0.38, -r * 0.42, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2); g.fill();
      g.restore();

      // contour
      g.strokeStyle = k.d; g.lineWidth = Math.max(1.5, r * 0.06);
      g.beginPath(); g.arc(0, 0, r - g.lineWidth / 2, 0, Math.PI * 2); g.stroke();

      // petit visage : deux yeux et un sourire
      const ey = r * 0.05, ex = r * 0.26, es = Math.max(1.6, r * 0.075);
      g.fillStyle = 'rgba(20,12,16,0.85)';
      g.beginPath(); g.arc(-ex, ey, es, 0, Math.PI * 2); g.arc(ex, ey, es, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(-ex + es * 0.35, ey - es * 0.35, es * 0.35, 0, Math.PI * 2); g.arc(ex + es * 0.35, ey - es * 0.35, es * 0.35, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(20,12,16,0.8)'; g.lineWidth = Math.max(1.2, r * 0.05); g.lineCap = 'round';
      g.beginPath(); g.arc(0, ey + r * 0.12, r * 0.13, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      // joues
      g.fillStyle = 'rgba(255,120,140,0.28)';
      g.beginPath(); g.ellipse(-ex - es * 1.6, ey + r * 0.16, es * 1.3, es * 0.8, 0, 0, Math.PI * 2); g.ellipse(ex + es * 1.6, ey + r * 0.16, es * 1.3, es * 0.8, 0, 0, Math.PI * 2); g.fill();

      // queue et feuilles au-dessus du fruit
      if (i === 0 || i === 5 || i === 6) {
        g.strokeStyle = '#5A3A1E'; g.lineWidth = Math.max(1.6, r * 0.07); g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, -r * 0.92); g.quadraticCurveTo(r * 0.05, -r * 1.25, r * 0.22, -r * 1.35); g.stroke();
        leaf(g, r * 0.18, -r * 1.12, r * 0.32, 0.5);
      } else if (i === 1 || i === 3 || i === 7) {
        leaf(g, -r * 0.14, -r * 0.96, r * 0.3, -0.7);
        leaf(g, r * 0.14, -r * 0.96, r * 0.3, 0.7);
      } else if (i === 8) {
        for (let a = -2; a <= 2; a++) leaf(g, a * r * 0.1, -r * 0.92, r * 0.36, a * 0.35 - 0.0001);
      }
    }
    function leaf(g, x, y, s, rot) {
      g.save(); g.translate(x, y); g.rotate(rot - Math.PI / 2);
      g.fillStyle = '#3FA34D'; g.strokeStyle = '#1F6B2A'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.5, -s * 0.45, s, 0); g.quadraticCurveTo(s * 0.5, s * 0.45, 0, 0); g.fill(); g.stroke();
      g.restore();
    }
    function shade(hex, k) {
      const n = parseInt(hex.slice(1), 16);
      let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
      const t = k > 0 ? 255 : 0, a = Math.abs(k);
      r = Math.round(r + (t - r) * a); gg = Math.round(gg + (t - gg) * a); b = Math.round(b + (t - b) * a);
      return `rgb(${r},${gg},${b})`;
    }

    /* ── Décor pré-rendu : bocal, quadrillage ────────────────────── */
    const deco = document.createElement('canvas');
    deco.width = cv.el.width; deco.height = cv.el.height;
    {
      const g = deco.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = C.grid; g.lineWidth = 1;
      for (let x = 0; x <= W; x += 20) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
      for (let y = 0; y <= H; y += 20) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
      // intérieur du bocal
      const inner = g.createLinearGradient(0, DANGER_Y, 0, FLOOR);
      inner.addColorStop(0, 'rgba(56,189,248,0.02)'); inner.addColorStop(1, 'rgba(31,111,235,0.10)');
      g.fillStyle = inner; g.fillRect(LEFT, DANGER_Y - 30, RIGHT - LEFT, FLOOR - DANGER_Y + 30);
      // parois
      g.fillStyle = '#21262D';
      g.fillRect(LEFT - 8, DANGER_Y - 30, 8, FLOOR - DANGER_Y + 38);
      g.fillRect(RIGHT, DANGER_Y - 30, 8, FLOOR - DANGER_Y + 38);
      g.fillRect(LEFT - 8, FLOOR, RIGHT - LEFT + 16, 8);
      g.fillStyle = 'rgba(56,189,248,0.35)';
      g.fillRect(LEFT - 1, DANGER_Y - 30, 1, FLOOR - DANGER_Y + 31);
      g.fillRect(RIGHT, DANGER_Y - 30, 1, FLOOR - DANGER_Y + 31);
      g.fillRect(LEFT - 1, FLOOR, RIGHT - LEFT + 2, 1);
    }

    /* ── État ────────────────────────────────────────────────────── */
    let items, held, next, aimX, cooldown, score, state, dangerT, biggest, time, flashes, keys, combo;

    function randomKind() {
      // les petits fruits sortent plus souvent ; jamais au-delà de la clémentine
      const r = Math.random();
      return r < 0.3 ? 0 : r < 0.56 ? 1 : r < 0.78 ? 2 : r < 0.93 ? 3 : 4;
    }

    function reset() {
      items = []; flashes = [];
      held = randomKind(); next = randomKind();
      aimX = W / 2; cooldown = 0; score = 0; dangerT = 0; biggest = 0; time = 0; combo = 0;
      keys = { left: false, right: false };
      fx.clear();
      api.hud({ score: 0 });
      api.status(api.t('Suivant : ', 'Next: ') + name(next));
    }

    function start() {
      reset();
      state = 'play';
      loop.start();
    }

    function drop() {
      if (state !== 'play' || cooldown > 0 || held === null) return;
      const r = KINDS[held].r;
      const x = api.clamp(aimX, LEFT + r, RIGHT - r);
      items.push({ x, y: DROP_Y, px: x, py: DROP_Y - 1.5, k: held, born: time, rot: 0, sc: 1, dead: false });
      api.sfx('drop');
      held = null; cooldown = 0.42;
    }

    function merge(a, b) {
      a.dead = b.dead = true;
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      const k = a.k + 1;
      combo++;
      if (a.k === LAST) {
        // deux pastèques : elles disparaissent, gros bonus
        score += 200;
        fx.burst(x, y, { n: api.reduced ? 12 : 40, color: [KINDS[LAST].c, '#fff', C.cyan], speed: 320, life: 0.9 });
        api.sfx('win');
        flashes.push({ x, y, r: KINDS[LAST].r * 1.6, t: 0, text: '+200' });
      } else {
        const add = points(k) * (combo > 1 ? 2 : 1);
        score += add;
        items.push({ x, y, px: x, py: y, k, born: time, rot: (a.rot + b.rot) / 2, sc: 0.55, dead: false, merged: true });
        fx.burst(x, y, { n: api.reduced ? 6 : 10 + k * 2, color: [KINDS[k].c, KINDS[a.k].c, '#fff'], speed: 120 + k * 22, life: 0.55 });
        api.tone(330 * Math.pow(1.122, k), 0.14, 'sine', 0.5, 1.5);
        flashes.push({ x, y, r: KINDS[k].r * 1.3, t: 0, text: '+' + add });
        if (k > biggest) {
          biggest = k;
          if (k >= 9) api.unlock('fruits_melon');
          if (k >= 6) api.status(api.t('Nouveau fruit : ', 'New fruit: ') + name(k) + ' !');
        }
        if (k === LAST && !api.reduced) api.shake(6);
      }
      api.hud({ score });
    }

    /* ── Physique ────────────────────────────────────────────────── */
    const G = 1700;          // gravité, px/s²
    const ITER = 7;          // passes de résolution des contacts

    function physics(dt) {
      const g2 = G * dt * dt;
      for (const p of items) {
        let vx = (p.x - p.px) * 0.996, vy = (p.y - p.py) * 0.996;
        // vitesse maximale : évite qu'un fruit traverse les autres
        const sp = Math.hypot(vx, vy), max = 14;
        if (sp > max) { vx *= max / sp; vy *= max / sp; }
        p.px = p.x; p.py = p.y;
        p.x += vx; p.y += vy + g2;
        p.rot += vx / KINDS[p.k].r;   // roulement
      }
      for (let it = 0; it < ITER; it++) {
        const n = items.length;
        for (let i = 0; i < n; i++) {
          const a = items[i]; if (a.dead) continue;
          const ra = KINDS[a.k].r;
          for (let j = i + 1; j < n; j++) {
            const b = items[j]; if (b.dead) continue;
            const rb = KINDS[b.k].r;
            const dx = b.x - a.x, dy = b.y - a.y, rr = ra + rb;
            const d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr || d2 === 0) continue;
            if (a.k === b.k && state === 'play') { merge(a, b); break; }
            const d = Math.sqrt(d2), over = (rr - d) / d;
            const ma = ra * ra, mb = rb * rb, s = 0.5 * over;
            const wa = mb / (ma + mb), wb = ma / (ma + mb);
            a.x -= dx * s * wa * 2; a.y -= dy * s * wa * 2;
            b.x += dx * s * wb * 2; b.y += dy * s * wb * 2;
          }
          // parois et fond
          if (a.x < LEFT + ra) a.x = LEFT + ra;
          else if (a.x > RIGHT - ra) a.x = RIGHT - ra;
          if (a.y > FLOOR - ra) {
            a.y = FLOOR - ra;
            a.px += (a.x - a.px) * 0.06;   // frottement au sol
          }
        }
      }
      if (items.some((p) => p.dead)) items = items.filter((p) => !p.dead);
    }

    /* ── Boucle ──────────────────────────────────────────────────── */
    const loop = api.loop({
      update(dt) {
        time += dt;
        fx.update(dt);
        for (const f of flashes) f.t += dt;
        if (flashes.length && flashes[0].t > 0.8) flashes.shift();
        for (const p of items) if (p.sc < 1) p.sc = Math.min(1, p.sc + dt * 5);
        if (state === 'over') { physics(dt); return; }
        if (state !== 'play') return;

        const speed = 330;
        if (keys.left) aimX -= speed * dt;
        if (keys.right) aimX += speed * dt;
        aimX = api.clamp(aimX, LEFT, RIGHT);

        if (cooldown > 0) {
          cooldown -= dt;
          if (cooldown <= 0) {
            held = next; next = randomKind(); combo = 0;
            api.status(api.t('Suivant : ', 'Next: ') + name(next));
          }
        }
        physics(dt);

        // danger : un fruit posé reste au-dessus de la ligne
        let over = false;
        for (const p of items) {
          if (time - p.born < 1.2) continue;
          const vy = p.y - p.py;
          if (p.y - KINDS[p.k].r < DANGER_Y && Math.abs(vy) < 0.6) { over = true; break; }
        }
        dangerT = over ? dangerT + dt : Math.max(0, dangerT - dt * 2);
        if (dangerT > 2.2) gameOver();
      },
      render() {
        ctx.drawImage(deco, 0, 0, W, H);

        // ligne de danger
        const warn = dangerT > 0 ? Math.min(1, dangerT / 2.2) : 0;
        ctx.strokeStyle = warn > 0 ? `rgba(255,123,114,${0.35 + 0.5 * Math.abs(Math.sin(time * 10)) * warn})` : 'rgba(255,123,114,0.22)';
        ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(LEFT, DANGER_Y); ctx.lineTo(RIGHT, DANGER_Y); ctx.stroke();
        ctx.setLineDash([]);

        // fruit tenu, guide de visée
        if (state === 'play' && held !== null) {
          const r = KINDS[held].r;
          const x = api.clamp(aimX, LEFT + r, RIGHT - r);
          ctx.strokeStyle = 'rgba(230,237,243,0.16)'; ctx.lineWidth = 2; ctx.setLineDash([3, 7]);
          ctx.beginPath(); ctx.moveTo(x, DROP_Y + r); ctx.lineTo(x, FLOOR); ctx.stroke(); ctx.setLineDash([]);
          drawItem(x, DROP_Y, held, Math.sin(time * 2) * 0.08, 1);
        }

        for (const p of items) drawItem(p.x, p.y, p.k, p.rot, p.sc);

        // anneaux et points des fusions
        for (const f of flashes) {
          const k = f.t / 0.8;
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + k * 0.6), 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = C.ink; ctx.font = '700 15px ' + api.font; ctx.textAlign = 'center';
          ctx.fillText(f.text, f.x, f.y - 14 - k * 24);
          ctx.globalAlpha = 1;
        }
        fx.draw(ctx);

        // fruit suivant, en haut à droite
        ctx.fillStyle = 'rgba(22,27,34,0.85)';
        api.roundRect(ctx, W - 74, 10, 62, 46, 6); ctx.fill();
        ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = C.muted; ctx.font = '600 10px ' + api.font; ctx.textAlign = 'left';
        ctx.fillText(api.t('SUIVANT', 'NEXT'), W - 68, 24);
        drawItem(W - 43, 40, next, 0, Math.min(1, 14 / KINDS[next].r));

        // échelle des fruits, en haut à gauche
        let ex = 14;
        for (let i = 0; i <= LAST; i++) {
          const s = 6.5 / KINDS[i].r;
          ctx.globalAlpha = i <= biggest || i <= 4 ? 1 : 0.28;
          drawItem(ex + 6, 22, i, 0, s);
          ex += 15;
        }
        ctx.globalAlpha = 1;
      },
    });

    function drawItem(x, y, k, rot, sc) {
      const s = SPR[k];
      const size = s.size * sc;
      ctx.save();
      ctx.translate(x, y);
      if (rot) ctx.rotate(rot);
      ctx.drawImage(s.c, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    function gameOver() {
      state = 'over';
      api.sfx('lose');
      api.shake(7);
      const record = api.setBest(score);
      api.status(api.t('Plus gros fruit : ', 'Biggest fruit: ') + name(biggest));
      api.after(700, () => api.overlay({
        kicker: record && score > 0 ? api.t('Nouveau record', 'New best') : '',
        title: api.t('Bocal plein', 'Jar full'),
        text: api.t(score + ' points, jusqu\'à : ' + name(biggest), score + ' points, up to: ' + name(biggest)),
        action: api.t('Rejouer', 'Play again'),
        tone: record && score > 0 ? 'good' : '',
        onAction: start,
      }));
    }

    /* ── Entrées ─────────────────────────────────────────────────── */
    const setAim = (e) => { aimX = cv.toLocal(e.clientX, e.clientY).x; };
    api.on(cv.el, 'pointermove', setAim);
    api.on(cv.el, 'pointerdown', (e) => { setAim(e); });
    api.on(cv.el, 'pointerup', (e) => { setAim(e); drop(); });
    api.onKey((e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'q' || k === 'a') keys.left = true;
      else if (k === 'arrowright' || k === 'd') keys.right = true;
      else if (k === ' ' || k === 'arrowdown' || k === 's' || k === 'enter') {
        if (state === 'play') drop();
        else if (state === 'over' && (k === ' ' || k === 'enter')) { api.hideOverlay(); start(); }
      }
    });
    api.on(document, 'keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'q' || k === 'a') keys.left = false;
      else if (k === 'arrowright' || k === 'd') keys.right = false;
    });

    // écran d'accueil : quelques fruits déjà dans le bocal, pour donner l'idée
    reset();
    state = 'ready';
    [[0, 120], [2, 200], [4, 280], [1, 160], [3, 240]].forEach(([k, x], i) => {
      const y = FLOOR - KINDS[k].r - i * 4;
      items.push({ x, y, px: x, py: y, k, born: -9, rot: i, sc: 1, dead: false });
    });
    loop.start();
    api.overlay({
      title: api.t('Fruits', 'Fruits'),
      text: api.t('Lâchez les fruits. Deux fruits identiques fusionnent en plus gros, de la cerise jusqu\'à la pastèque.', 'Drop the fruits. Two identical fruits merge into a bigger one, from cherry all the way to watermelon.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart: start };
  },
});

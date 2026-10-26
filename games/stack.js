/* ==================================================================
   games/stack.js · Pile (Stack)
   Une dalle glisse au dessus de la tour, sur l'axe x puis z en
   alternance. On la pose : ce qui dépasse est découpé et tombe, le
   reste devient la nouvelle base. Rendu isométrique façon voxels :
   les joints de blocs voyagent avec chaque dalle, si bien qu'une
   suite de poses parfaites garde des joints alignés sur toute la tour.
   ================================================================== */
SBG.register('stack', {
  create(api) {
    const { C } = api;
    const W = 420, H = 560;
    const SC = 0.9;                              // échelle monde vers pixels
    const ISX = 0.866 * SC, ISY = 0.5 * SC;      // projection isométrique 2:1
    const OX = W / 2, OY = 430;                  // écran du point (0, 0, 0)
    const LH = 20;                               // hauteur d'un étage (monde)
    const SIZE = 160, RANGE = 190;               // taille de départ, amplitude du va et vient
    const TOL = 5, GRID = 20, GROW = 10;         // tolérance parfaite, pas des joints, regain
    const TOP_Y = 236;                           // hauteur écran visée pour le sommet
    const PV_X = W / 2, PV_Y = 280;              // pivot du zoom de fin de partie
    const GRAV = 900;
    const NOTES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();

    let slabs, cur, debris, rings, score, streak, speed, state, cam, camT, zoom, zoomT, deathT, combo, comboT, scoreStr;

    // ── Couleurs : rampe cyan, bleu, violet, puis retour ─────────
    const hex = (h) => { const p = parseInt(h.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; };
    const RAMP = [hex(C.cyan), hex(C.blue), hex(C.violet)];
    const rgb = (c, k) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
    const toward = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    const WHITE = [255, 255, 255];
    function palette(i) {
      const t = (i * 0.11) % 4, u = t < 2 ? t : 4 - t;
      const c = u < 1 ? toward(RAMP[0], RAMP[1], u) : toward(RAMP[1], RAMP[2], u - 1);
      return {
        top: rgb(toward(c, WHITE, 0.1), 1),
        left: rgb(c, 0.78),
        right: rgb(c, 0.56),
        edge: rgb(toward(c, WHITE, 0.55), 1),
      };
    }
    // socle : gris bleuté neutre
    const BASE_COL = { top: '#2A3442', left: '#1C2430', right: '#151B24', edge: '#3A4656' };

    // fond pré-calculé : dégradé et halo (objets créés une seule fois)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0A0E14'); bgGrad.addColorStop(1, '#101826');
    const halo = ctx.createRadialGradient(W / 2, TOP_Y, 10, W / 2, TOP_Y, 260);
    halo.addColorStop(0, 'rgba(56,189,248,0.10)'); halo.addColorStop(1, 'rgba(56,189,248,0)');
    // petits pixels de fond, en parallaxe avec la caméra
    const stars = [];
    for (let i = 0; i < 40; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() < 0.25 ? 3 : 2, a: 0.08 + Math.random() * 0.22 });

    // ── Dessin d'un pavé isométrique ─────────────────────────────
    // (cx, cz) centre, (w, d) tailles, y bas ; (tx, tz) origine des joints
    function box(cx, cz, w, d, y, h, tx, tz, col) {
      const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
      const yt = (y + h) * SC, yb = y * SC;
      // sommets utiles à l'écran
      const ax = OX + (x0 - z0) * ISX, ay = OY + (x0 + z0) * ISY - yt;   // arrière
      const bx = OX + (x1 - z0) * ISX, by = OY + (x1 + z0) * ISY - yt;   // droite
      const ccx = OX + (x1 - z1) * ISX, ccy = OY + (x1 + z1) * ISY - yt; // avant
      const dx = OX + (x0 - z1) * ISX, dy = OY + (x0 + z1) * ISY - yt;   // gauche
      const hh = yt - yb;

      // face gauche (z = z1)
      ctx.fillStyle = col.left;
      ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(ccx, ccy); ctx.lineTo(ccx, ccy + hh); ctx.lineTo(dx, dy + hh); ctx.closePath(); ctx.fill();
      // face droite (x = x1)
      ctx.fillStyle = col.right;
      ctx.beginPath(); ctx.moveTo(ccx, ccy); ctx.lineTo(bx, by); ctx.lineTo(bx, by + hh); ctx.lineTo(ccx, ccy + hh); ctx.closePath(); ctx.fill();
      // dessus
      ctx.fillStyle = col.top;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(ccx, ccy); ctx.lineTo(dx, dy); ctx.closePath(); ctx.fill();

      // joints de blocs : alignés sur l'origine de texture de la dalle
      ctx.beginPath();
      let g = tx + Math.ceil((x0 - tx) / GRID) * GRID;
      for (; g < x1 - 0.5; g += GRID) {
        if (g <= x0 + 0.5) continue;
        const sx0 = OX + (g - z0) * ISX, sy0 = OY + (g + z0) * ISY - yt;
        const sx1 = OX + (g - z1) * ISX, sy1 = OY + (g + z1) * ISY - yt;
        ctx.moveTo(sx0, sy0); ctx.lineTo(sx1, sy1);            // sur le dessus
        ctx.moveTo(sx1, sy1); ctx.lineTo(sx1, sy1 + hh);       // sur la face gauche
      }
      g = tz + Math.ceil((z0 - tz) / GRID) * GRID;
      for (; g < z1 - 0.5; g += GRID) {
        if (g <= z0 + 0.5) continue;
        const sx0 = OX + (x0 - g) * ISX, sy0 = OY + (x0 + g) * ISY - yt;
        const sx1 = OX + (x1 - g) * ISX, sy1 = OY + (x1 + g) * ISY - yt;
        ctx.moveTo(sx0, sy0); ctx.lineTo(sx1, sy1);
        ctx.moveTo(sx1, sy1); ctx.lineTo(sx1, sy1 + hh);       // sur la face droite
      }
      ctx.strokeStyle = 'rgba(8,12,18,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // arête basse sombre : sépare nettement les étages
      ctx.strokeStyle = 'rgba(8,12,18,0.45)';
      ctx.beginPath(); ctx.moveTo(dx, dy + hh); ctx.lineTo(ccx, ccy + hh); ctx.lineTo(bx, by + hh); ctx.stroke();

      // arêtes avant éclairées : effet voxel net
      ctx.strokeStyle = col.edge;
      ctx.globalAlpha *= 0.55;
      ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(ccx, ccy); ctx.lineTo(bx, by); ctx.moveTo(ccx, ccy); ctx.lineTo(ccx, ccy + hh); ctx.stroke();
      ctx.globalAlpha /= 0.55;
    }
    const drawSlab = (s) => box(s.cx, s.cz, s.w - s.gw, s.d - s.gd, s.y, LH, s.tx, s.tz, s.col);

    // ── Partie ───────────────────────────────────────────────────
    function reset() {
      slabs = [{ cx: 0, cz: 0, w: SIZE, d: SIZE, y: 0, tx: 0, tz: 0, gw: 0, gd: 0, col: palette(0) }];
      debris = []; rings = [];
      score = 0; streak = 0; speed = 150;
      cam = camT = 0; zoom = zoomT = 1; deathT = 0;
      combo = ''; comboT = 0; scoreStr = '0';
      fx.clear();
      spawn();
      api.hud({ score: 0 });
    }

    function spawn() {
      const b = slabs[slabs.length - 1];
      const i = slabs.length;
      const side = i % 4 < 2 ? -1 : 1;           // côté de départ alterné
      const axis = i % 2 ? 'x' : 'z';
      cur = { cx: b.cx, cz: b.cz, w: b.w, d: b.d, y: b.y + LH, tx: b.tx, tz: b.tz, gw: 0, gd: 0, col: palette(i), axis, dir: -side, off: side * RANGE, prev: side * RANGE };
      syncCur(1);
    }
    // position de la dalle mobile = base + décalage (interpolé entre deux pas)
    function syncCur(k) {
      const b = slabs[slabs.length - 1];
      const o = cur.prev + (cur.off - cur.prev) * k;
      if (cur.axis === 'x') { cur.cx = b.cx + o; cur.tx = b.tx + o; }
      else { cur.cz = b.cz + o; cur.tz = b.tz + o; }
    }

    function start() {
      reset();
      state = 'play';
      api.status('');
      loop.start();
    }

    function place() {
      if (state !== 'play') return;
      syncCur(1);
      const b = slabs[slabs.length - 1];
      const ax = cur.axis === 'x';
      const delta = ax ? cur.cx - b.cx : cur.cz - b.cz;
      const size = ax ? cur.w : cur.d;
      const ad = Math.abs(delta), sg = delta < 0 ? -1 : 1;
      const topSy = OY + (cur.cx + cur.cz) * ISY - (cur.y + LH) * SC;

      if (ad >= size) return miss(sg);
      api.sfx('drop');

      const s = { cx: cur.cx, cz: cur.cz, w: cur.w, d: cur.d, y: cur.y, tx: cur.tx, tz: cur.tz, gw: 0, gd: 0, col: cur.col };
      if (ad <= TOL) {
        // pose parfaite : on aligne, carillon montant, anneau
        if (ax) { s.cx = b.cx; s.tx = b.tx; } else { s.cz = b.cz; s.tz = b.tz; }
        streak++;
        const note = NOTES[Math.min(streak - 1, NOTES.length - 1)];
        api.tone(523.25 * Math.pow(2, note / 12), 0.22, 'triangle', 0.4);
        if (streak >= 3) {
          // série : la dalle regagne un peu de largeur, en douceur
          if (ax && s.w < SIZE) { const g = Math.min(GROW, SIZE - s.w); s.w += g; s.gw = g; }
          else if (!ax && s.d < SIZE) { const g = Math.min(GROW, SIZE - s.d); s.d += g; s.gd = g; }
          else if (s.w < SIZE) { const g = Math.min(GROW, SIZE - s.w); s.w += g; s.gw = g; }
          else if (s.d < SIZE) { const g = Math.min(GROW, SIZE - s.d); s.d += g; s.gd = g; }
        }
        rings.push({ cx: s.cx, cz: s.cz, w: s.w, d: s.d, y: s.y + LH, t: 0 });
        combo = api.t('Parfait', 'Perfect') + (streak > 1 ? ' x' + streak : '');
        comboT = 1;
        fx.burst(OX + (s.cx - s.cz) * ISX, topSy + (s.w + s.d) * ISY * 0.5, { n: 12, color: [C.ink, C.cyan, s.col.top], speed: 170, life: 0.5, size: 2.2 });
      } else {
        // découpe : la partie gardée est centrée sur la zone de recouvrement
        streak = 0;
        const keep = size - ad;
        const cutC = (ax ? b.cx : b.cz) + sg * (size / 2 + keep / 2) + delta / 2;
        const keepC = (ax ? b.cx : b.cz) + delta / 2;
        const p = { cx: s.cx, cz: s.cz, w: s.w, d: s.d, y: s.y, tx: s.tx, tz: s.tz, col: s.col };
        if (ax) { s.cx = keepC; s.w = keep; p.cx = cutC; p.w = ad; }
        else { s.cz = keepC; s.d = keep; p.cz = cutC; p.d = ad; }
        addDebris(p, ax, sg);
        // poussière sur l'arête de coupe
        const ex = ax ? keepC + sg * keep / 2 : s.cx, ez = ax ? s.cz : keepC + sg * keep / 2;
        fx.burst(OX + (ex - ez) * ISX, OY + (ex + ez) * ISY - (s.y + LH * 0.5) * SC, { n: 8, color: [s.col.left, s.col.top], speed: 90, life: 0.45, gravity: 260, size: 2 });
      }
      slabs.push(s);
      score++;
      scoreStr = String(score);
      api.hud({ score });
      if (score >= 20) api.unlock('stack_20');
      speed = Math.min(330, 150 + score * 4.5);
      camT = Math.max(0, score * LH * SC - (OY - TOP_Y));
      spawn();
    }

    function addDebris(p, ax, sg) {
      p.axis = ax ? 'x' : 'z';
      p.vx = sg * (30 + Math.random() * 30);
      p.vy = 40;
      p.rot = 0;
      p.vr = api.reduced ? 0 : sg * (ax ? 1 : -1) * (1.4 + Math.random() * 1.6);
      p.a = 1; p.t = 0;
      p.back = sg < 0;                          // côté arrière : caché par la tour
      if (debris.length > 24) debris.shift();
      debris.push(p);
    }

    function miss(sg) {
      const p = { cx: cur.cx, cz: cur.cz, w: cur.w, d: cur.d, y: cur.y, tx: cur.tx, tz: cur.tz, col: cur.col };
      addDebris(p, cur.axis === 'x', sg);
      cur = null;
      state = 'dead'; deathT = 0; streak = 0; comboT = 0;
      api.sfx('lose'); api.shake(6);
      // recul de caméra : toute la tour tient dans le cadre
      const th = (score + 1) * LH * SC;
      zoomT = Math.min(1, 300 / (th + 170));
      if (zoomT < 1) camT = Math.max(0, PV_Y - OY + th / 2 + 40);
      const record = api.setBest(score);
      const floors = score === 1 ? api.t('1 étage', '1 layer') : api.t(score + ' étages', score + ' layers');
      api.after(900, () => api.overlay({
        kicker: record && score > 0 ? api.t('Nouveau record', 'New best') : '',
        title: api.t('Partie terminée', 'Game over'),
        text: floors,
        action: api.t('Rejouer', 'Play again'),
        tone: record && score > 0 ? 'good' : '',
        onAction: start,
      }));
    }

    // ── Boucle ───────────────────────────────────────────────────
    const loop = api.loop({
      update(dt) {
        fx.update(dt);
        if (cur && state !== 'dead') {
          cur.prev = cur.off;
          cur.off += cur.dir * speed * dt;
          if (cur.off > RANGE) { cur.off = RANGE; cur.dir = -1; }
          else if (cur.off < -RANGE) { cur.off = -RANGE; cur.dir = 1; }
        }
        for (let i = debris.length - 1; i >= 0; i--) {
          const p = debris[i];
          p.t += dt;
          p.vy -= GRAV * dt; p.y += p.vy * dt;
          if (p.axis === 'x') { p.cx += p.vx * dt; p.tx += p.vx * dt; } else { p.cz += p.vx * dt; p.tz += p.vx * dt; }
          p.rot += p.vr * dt;
          if (p.t > 0.35) p.a -= dt * (api.reduced ? 3 : 1.3);
          if (p.a <= 0) debris.splice(i, 1);
        }
        for (let i = rings.length - 1; i >= 0; i--) {
          rings[i].t += dt * (api.reduced ? 3 : 1.8);
          if (rings[i].t >= 1) rings.splice(i, 1);
        }
        const top = slabs[slabs.length - 1];
        if (top.gw > 0) top.gw = Math.max(0, top.gw - dt * 40);
        if (top.gd > 0) top.gd = Math.max(0, top.gd - dt * 40);
        const k = 1 - Math.exp(-dt * (api.reduced ? 14 : 5));
        cam += (camT - cam) * k;
        zoom += (zoomT - zoom) * (state === 'dead' ? 1 - Math.exp(-dt * 2.6) : k);
        comboT = Math.max(0, comboT - dt * 0.9);
        if (state === 'dead') deathT += dt;
      },
      render(k) {
        if (cur) syncCur(k);

        ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);

        // pixels de fond en parallaxe
        ctx.fillStyle = C.cyan;
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          const y = (s.y + cam * 0.25) % H;
          ctx.globalAlpha = s.a;
          ctx.fillRect(s.x, y, s.s, s.s);
        }
        ctx.globalAlpha = 1;

        // grand compteur en filigrane
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.font = '600 64px ' + api.font;
        ctx.fillStyle = 'rgba(230,237,243,0.14)';
        ctx.fillText(scoreStr, W / 2, 92);

        ctx.save();
        ctx.translate(PV_X, PV_Y); ctx.scale(zoom, zoom); ctx.translate(-PV_X, -PV_Y + cam);

        // socle profond sous la tour
        box(0, 0, SIZE, SIZE, -700, 700 - LH * 0.01, 0, 0, BASE_COL);

        for (let i = 0; i < debris.length; i++) if (debris[i].back) drawDebris(debris[i]);

        // tour : seuls les étages à l'écran
        for (let i = 0; i < slabs.length; i++) {
          const s = slabs[i];
          const sy = (OY - s.y * SC + cam - PV_Y) * zoom + PV_Y;
          if (sy - 120 * zoom > H) continue;
          drawSlab(s);
        }
        if (cur) drawSlab(cur);

        for (let i = 0; i < debris.length; i++) if (!debris[i].back) drawDebris(debris[i]);

        // anneaux des poses parfaites
        for (let i = 0; i < rings.length; i++) {
          const r = rings[i];
          const e = api.ease.out(r.t);
          const grow = api.reduced ? 4 : 4 + e * 26;
          const hw = r.w / 2 + grow, hd = r.d / 2 + grow;
          const yy = r.y * SC;
          ctx.globalAlpha = (1 - r.t) * 0.9;
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(OX + (r.cx - hw - (r.cz - hd)) * ISX, OY + (r.cx - hw + r.cz - hd) * ISY - yy);
          ctx.lineTo(OX + (r.cx + hw - (r.cz - hd)) * ISX, OY + (r.cx + hw + r.cz - hd) * ISY - yy);
          ctx.lineTo(OX + (r.cx + hw - (r.cz + hd)) * ISX, OY + (r.cx + hw + r.cz + hd) * ISY - yy);
          ctx.lineTo(OX + (r.cx - hw - (r.cz + hd)) * ISX, OY + (r.cx - hw + r.cz + hd) * ISY - yy);
          ctx.closePath(); ctx.stroke();
        }
        ctx.globalAlpha = 1;

        fx.draw(ctx);
        ctx.restore();

        // mention "Parfait"
        if (comboT > 0) {
          ctx.globalAlpha = Math.min(1, comboT * 2);
          ctx.font = '600 15px ' + api.font;
          ctx.fillStyle = C.ink;
          ctx.fillText(combo, W / 2, 122 - (api.reduced ? 0 : (1 - comboT) * 8));
          ctx.globalAlpha = 1;
        }
      },
    });

    function drawDebris(p) {
      ctx.globalAlpha = Math.max(0, p.a);
      if (p.rot !== 0) {
        const sx = OX + (p.cx - p.cz) * ISX, sy = OY + (p.cx + p.cz) * ISY - (p.y + LH / 2) * SC;
        ctx.save();
        ctx.translate(sx, sy); ctx.rotate(p.rot); ctx.translate(-sx, -sy);
        box(p.cx, p.cz, p.w, p.d, p.y, LH, p.tx, p.tz, p.col);
        ctx.restore();
      } else {
        box(p.cx, p.cz, p.w, p.d, p.y, LH, p.tx, p.tz, p.col);
      }
      ctx.globalAlpha = 1;
    }

    // ── Entrées ──────────────────────────────────────────────────
    api.on(cv.el, 'pointerdown', (e) => {
      if (state !== 'play') return;
      e.preventDefault();
      place();
    });
    api.onKey((e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        if (state === 'play') { if (e.key === ' ') place(); return; }
        if (state === 'ready' || deathT > 0.5) { api.hideOverlay(); start(); }
      }
    });

    // écran d'accueil : la première dalle glisse déjà en arrière plan
    reset(); state = 'ready';
    loop.start();
    api.overlay({
      title: api.t('Pile', 'Stack'),
      text: api.t('Posez chaque bloc pile sur le précédent. Ce qui dépasse tombe.', 'Drop each block right on top of the last one. Whatever hangs over falls off.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart: start };
  },
});

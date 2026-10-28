/* ==================================================================
   games/snake.js · Snake
   Le serpent avance de case en case (logique), mais il est dessiné
   en continu : chaque segment est interpolé entre sa case précédente
   et sa case actuelle. D'où un mouvement fluide à toute vitesse.
   Bonus : un objet spécial apparaît parfois sur une case libre
   pendant 6 s (il clignote les 2 dernières secondes).
   ================================================================== */
SBG.register('snake', {
  create(api) {
    const { C } = api;
    const COLS = 20, ROWS = 15, CELL = 28;
    const W = COLS * CELL, H = ROWS * CELL;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();
    const MANY = api.reduced ? 0.4 : 1;

    // Catalogue des bonus : nom, couleur, durée (0 = effet immédiat), poids de tirage
    const POWERS = {
      gold:     { fr: 'Orbe dorée', en: 'Golden orb', col: C.warm, rgb: '255,166,87', dur: 0, w: 30 },
      slow:     { fr: 'Ralenti', en: 'Slow motion', col: C.good, rgb: '63,185,80', dur: 8, w: 20 },
      ghost:    { fr: 'Fantôme', en: 'Ghost', col: C.ink, rgb: '230,237,243', dur: 6, w: 18 },
      wrap:     { fr: 'Traversée', en: 'Wrap', col: C.cyan, rgb: '56,189,248', dur: 10, w: 18 },
      scissors: { fr: 'Ciseaux', en: 'Scissors', col: C.bad, rgb: '255,123,114', dur: 0, w: 14 },
    };
    const KINDS = Object.keys(POWERS);
    const TIMED = ['slow', 'ghost', 'wrap'];
    const ITEM_LIFE = 6, SLOW_K = 0.6;
    const DASH = [9, 7], NODASH = [];

    let snake, prev, dir, queue, food, score, step, acc, state, grow, eatPulse, deathT;
    let item, itemCD, pow, labels, statusMask, dashT;

    const gridLayer = document.createElement('canvas');
    gridLayer.width = cv.el.width; gridLayer.height = cv.el.height;
    {
      const g = gridLayer.getContext('2d');
      g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
      g.fillStyle = C.grid;
      for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
        if ((x + y) % 2 === 0) g.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    // calque du serpent en mode fantôme
    const ghostLayer = document.createElement('canvas');
    ghostLayer.width = cv.el.width; ghostLayer.height = cv.el.height;
    const ghostCtx = ghostLayer.getContext('2d');
    ghostCtx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);

    function reset() {
      snake = [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }];
      prev = snake.map((p) => ({ ...p }));
      dir = { x: 1, y: 0 }; queue = [];
      score = 0; step = 0.12; acc = 0; grow = 0; eatPulse = 0; deathT = 0;
      item = null; itemCD = 6 + Math.random() * 5;
      pow = { slow: 0, ghost: 0, wrap: 0 };
      labels = []; statusMask = -1; dashT = 0;
      placeFood();
      fx.clear();
      api.hud({ score: 0 });
    }
    const onSnake = (x, y) => snake.some((s) => s.x === x && s.y === y);
    function placeFood() {
      let p;
      do { p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
      while (onSnake(p.x, p.y) || (item && item.x === p.x && item.y === p.y));
      food = { ...p, t: 0 };
    }

    // durée d'un pas, allongée pendant le ralenti
    const curStep = () => (pow.slow > 0 ? step / SLOW_K : step);

    /* ── Bonus ───────────────────────────────────────────────────── */
    function spawnItem() {
      // tirage pondéré, sans proposer un bonus déjà actif ni des ciseaux sur un serpent court
      let total = 0;
      const ok = (k) => !(pow[k] > 0) && !(k === 'scissors' && snake.length < 7);
      for (const k of KINDS) if (ok(k)) total += POWERS[k].w;
      let r = Math.random() * total, kind = 'gold';
      for (const k of KINDS) { if (!ok(k)) continue; r -= POWERS[k].w; if (r <= 0) { kind = k; break; } }
      // case libre, pas collée à la tête
      const h = snake[0];
      for (let i = 0; i < 80; i++) {
        const x = Math.floor(Math.random() * COLS), y = Math.floor(Math.random() * ROWS);
        if (onSnake(x, y) || (x === food.x && y === food.y)) continue;
        if (Math.abs(x - h.x) + Math.abs(y - h.y) < 3) continue;
        item = { x, y, kind, life: ITEM_LIFE };
        return;
      }
      itemCD = 1;
    }

    function chime() {
      api.tone(660, 0.08, 'triangle', 0.32);
      api.after(65, () => api.tone(880, 0.08, 'triangle', 0.32));
      api.after(130, () => api.tone(1320, 0.14, 'triangle', 0.3));
    }

    function addLabel(x, y, text, col) {
      let stack = 0;
      for (const l of labels) if (l.t < 0.5) stack++;
      labels.push({ x: api.clamp(x, 60, W - 60), y: Math.max(26, y - 14) - stack * 16, text, col, t: 0 });
    }

    function collect() {
      const kind = item.kind, P = POWERS[kind];
      const cx = item.x * CELL + CELL / 2, cy = item.y * CELL + CELL / 2;
      item = null; itemCD = 6 + Math.random() * 5;
      chime();
      fx.burst(cx, cy, { n: Math.round(20 * MANY), color: [P.col, '#fff', P.col], speed: 210 });
      addLabel(cx, cy, api.t(P.fr, P.en), P.col);
      if (kind === 'gold') {
        score += 50; grow += 3; eatPulse = 1;
      } else if (kind === 'scissors') {
        // coupe un tiers de la queue, jamais sous 3 segments (la tête vient d'être ajoutée, la queue va reculer d'une case)
        const cut = Math.max(0, Math.min(Math.floor(snake.length / 3), snake.length - 4));
        for (let i = snake.length - cut; i < snake.length; i++) {
          const s = snake[i];
          if (i % 2 === 0 || !api.reduced) fx.burst(s.x * CELL + CELL / 2, s.y * CELL + CELL / 2, { n: Math.round(4 * MANY) || 1, color: [C.bad, C.violet], speed: 120, life: 0.5 });
        }
        snake.length -= cut;
        if (prev.length > snake.length) prev.length = snake.length;
        grow = 0;
        score += 20;
        api.tone(1500, 0.05, 'square', 0.16, 0.5);
      } else {
        // ralenti : on rééchelonne l'accumulateur pour ne pas faire sauter l'interpolation
        if (kind === 'slow' && pow.slow <= 0) acc /= SLOW_K;
        pow[kind] = P.dur;
      }
      api.hud({ score });
      if (score >= 50) api.unlock('snake_50');
    }

    function syncStatus() {
      const m = (pow.slow > 0 ? 1 : 0) | (pow.ghost > 0 ? 2 : 0) | (pow.wrap > 0 ? 4 : 0);
      if (m === statusMask) return;
      statusMask = m;
      const names = [];
      for (const k of TIMED) if (pow[k] > 0) names.push(api.t(POWERS[k].fr, POWERS[k].en));
      api.status(names.length ? api.t('Actif : ', 'Active: ') + names.join(' · ') : '');
    }

    function start() {
      reset();
      state = 'play';
      api.status('');
      loop.start();
    }

    function turn(nx, ny) {
      if (state !== 'play') return;
      const last = queue.length ? queue[queue.length - 1] : dir;
      if ((nx === -last.x && ny === -last.y) || (nx === last.x && ny === last.y)) return;
      if (queue.length < 3) queue.push({ x: nx, y: ny });
    }

    // le serpent se chevauche-t-il déjà (traversée en mode fantôme) ?
    function tangled() {
      for (let i = 0; i < snake.length; i++) for (let j = i + 1; j < snake.length; j++) {
        if (snake[i].x === snake[j].x && snake[i].y === snake[j].y) return true;
      }
      return false;
    }

    function tick() {
      if (queue.length) dir = queue.shift();
      prev = snake.map((p) => ({ ...p }));
      let hx = snake[0].x + dir.x, hy = snake[0].y + dir.y;
      const out = hx < 0 || hx >= COLS || hy < 0 || hy >= ROWS;
      if (out) {
        if (pow.wrap <= 0) return die();
        hx = (hx + COLS) % COLS; hy = (hy + ROWS) % ROWS;
      }
      const head = { x: hx, y: hy };
      const hitSelf = snake.slice(0, snake.length - (grow ? 0 : 1)).some((s) => s.x === head.x && s.y === head.y);
      // fantôme : on traverse son corps ; à la fin de l'effet, on laisse le temps de se démêler
      if (hitSelf && pow.ghost <= 0 && !tangled()) return die();
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10; grow += 1; eatPulse = 1;
        api.hud({ score }); api.sfx('pop');
        fx.burst(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, { n: 16, color: [C.cyan, C.violet, '#fff'], speed: 190 });
        if (score >= 50) api.unlock('snake_50');
        step = Math.max(0.062, step * 0.97);
        placeFood();
      }
      if (item && head.x === item.x && head.y === item.y) collect();
      if (grow > 0) { grow--; prev.push({ ...prev[prev.length - 1] }); }
      else snake.pop();
      if (prev.length > snake.length) prev.length = snake.length;
    }

    function die() {
      state = 'dead'; deathT = 0;
      api.sfx('lose'); api.shake(7);
      api.status(''); statusMask = 0;
      const h = snake[0];
      fx.burst(h.x * CELL + CELL / 2, h.y * CELL + CELL / 2, { n: 30, color: [C.bad, C.warm], speed: 240 });
      const record = api.setBest(score);
      api.after(650, () => api.overlay({
        kicker: record && score > 0 ? api.t('Nouveau record', 'New best') : '',
        title: api.t('Partie terminée', 'Game over'),
        text: api.t(score + ' points', score + ' points'),
        action: api.t('Rejouer', 'Play again'),
        tone: record && score > 0 ? 'good' : '',
        onAction: start,
      }));
    }

    const loop = api.loop({
      update(dt) {
        fx.update(dt);
        food.t += dt;
        eatPulse = Math.max(0, eatPulse - dt * 3);
        for (let i = labels.length - 1; i >= 0; i--) { labels[i].t += dt; if (labels[i].t > 1.1) labels.splice(i, 1); }
        if (state === 'dead') { deathT += dt; return; }
        if (state !== 'play') return;

        // minuteries des bonus (temps réel, pas ralenti)
        dashT += dt;
        for (const k of TIMED) {
          if (pow[k] <= 0) continue;
          pow[k] -= dt;
          if (pow[k] <= 0) { pow[k] = 0; if (k === 'slow') acc *= SLOW_K; }
        }
        if (item) { item.life -= dt; if (item.life <= 0) { item = null; itemCD = 4 + Math.random() * 4; } }
        else { itemCD -= dt; if (itemCD <= 0) spawnItem(); }
        syncStatus();

        acc += dt;
        while (state === 'play' && acc >= curStep()) { acc -= curStep(); tick(); }
      },
      render() {
        const k = state === 'play' ? Math.min(1, acc / curStep()) : 1;
        cv.clear(C.bg);

        // quadrillage discret (pré-rendu une seule fois)
        ctx.drawImage(gridLayer, 0, 0, W, H);

        // traversée : bord en pointillés cyan, qui clignote juste avant la fin
        if (pow.wrap > 0 && state === 'play') {
          ctx.globalAlpha = pow.wrap < 2 && Math.sin(pow.wrap * 18) < 0 ? 0.3 : 0.9;
          ctx.strokeStyle = C.cyan; ctx.lineWidth = 2;
          ctx.setLineDash(DASH); ctx.lineDashOffset = -dashT * 24;
          ctx.strokeRect(1, 1, W - 2, H - 2);
          ctx.setLineDash(NODASH); ctx.lineDashOffset = 0;
          ctx.globalAlpha = 1;
        }

        // fruit : orbe qui pulse
        const fxp = food.x * CELL + CELL / 2, fyp = food.y * CELL + CELL / 2;
        const pulse = 1 + Math.sin(food.t * 5) * 0.08;
        const glow = ctx.createRadialGradient(fxp, fyp, 0, fxp, fyp, CELL * 1.2);
        glow.addColorStop(0, 'rgba(210,168,255,0.45)'); glow.addColorStop(1, 'rgba(210,168,255,0)');
        ctx.fillStyle = glow; ctx.fillRect(fxp - CELL * 1.2, fyp - CELL * 1.2, CELL * 2.4, CELL * 2.4);
        ctx.fillStyle = C.violet;
        ctx.beginPath(); ctx.arc(fxp, fyp, CELL * 0.27 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(fxp - 2.5, fyp - 2.5, 2.2, 0, Math.PI * 2); ctx.fill();

        if (item) drawItem();

        // serpent : polyligne épaisse interpolée. Chaque point est rapproché du
        // précédent (à un tour de plateau près) pour rester continu en traversée.
        const pts = [];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < snake.length; i++) {
          const s = snake[i], p = prev[i] || s;
          let dx = s.x - p.x, dy = s.y - p.y;
          if (dx > 1) dx -= COLS; else if (dx < -1) dx += COLS;
          if (dy > 1) dy -= ROWS; else if (dy < -1) dy += ROWS;
          let x = (s.x - dx * (1 - k)) * CELL + CELL / 2, y = (s.y - dy * (1 - k)) * CELL + CELL / 2;
          if (i > 0) {
            const q = pts[i - 1];
            if (x - q.x > W / 2) x -= W; else if (q.x - x > W / 2) x += W;
            if (y - q.y > H / 2) y -= H; else if (q.y - y > H / 2) y += H;
          }
          pts.push({ x, y });
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        let fade = state === 'dead' ? Math.max(0.35, 1 - deathT * 1.5) : 1;
        if (pow.ghost > 0 && state === 'play') fade *= pow.ghost < 1.5 && Math.sin(pow.ghost * 20) < 0 ? 0.75 : 0.42;
        // copies décalées d'un plateau quand le serpent déborde (traversée)
        const m = CELL;
        const nx0 = Math.floor((-m - maxX) / W) + 1, nx1 = Math.ceil((W + m - minX) / W) - 1;
        const ny0 = Math.floor((-m - maxY) / H) + 1, ny1 = Math.ceil((H + m - minY) / H) - 1;
        // fantôme : dessiné opaque sur un calque, puis posé en transparence (pas de surépaisseurs aux jointures)
        const ghost = pow.ghost > 0 && state === 'play';
        const g = ghost ? ghostCtx : ctx;
        if (ghost) ghostCtx.clearRect(0, 0, W, H);
        for (let nx = nx0; nx <= nx1; nx++) for (let ny = ny0; ny <= ny1; ny++) drawSnake(g, pts, nx * W, ny * H, ghost ? 1 : fade);
        if (ghost) { ctx.globalAlpha = fade; ctx.drawImage(ghostLayer, 0, 0, W, H); ctx.globalAlpha = 1; }

        fx.draw(ctx);
        drawLabels();
        drawBars();
      },
    });

    function drawSnake(ctx, pts, ox, oy, fade) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.globalAlpha = fade;
      for (let i = pts.length - 1; i > 0; i--) {
        const a = pts[i], b = pts[i - 1];
        const m = i / pts.length;
        ctx.strokeStyle = mix(C.cyan, C.violet, m);
        ctx.lineWidth = CELL * (0.66 - m * 0.18) + eatPulse * 4;
        ctx.beginPath(); ctx.moveTo(a.x + ox, a.y + oy); ctx.lineTo(b.x + ox, b.y + oy); ctx.stroke();
      }
      // tête et yeux
      const hx = pts[0].x + ox, hy = pts[0].y + oy;
      ctx.fillStyle = state === 'dead' ? C.bad : '#BAE6FD';
      ctx.beginPath(); ctx.arc(hx, hy, CELL * 0.38, 0, Math.PI * 2); ctx.fill();
      const ex = dir.y !== 0 ? 5 : 0, ey = dir.x !== 0 ? 5 : 0;
      ctx.fillStyle = C.bg;
      ctx.beginPath(); ctx.arc(hx + dir.x * 4 + ex, hy + dir.y * 4 + ey, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(hx + dir.x * 4 - ex, hy + dir.y * 4 - ey, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // capsule ronde : halo, fond teinté, contour clair, pictogramme tracé
    function drawItem() {
      const P = POWERS[item.kind];
      const x = item.x * CELL + CELL / 2, y = item.y * CELL + CELL / 2;
      const age = ITEM_LIFE - item.life;
      const pop = api.ease.back(Math.min(1, age * 4));
      let a = 1;
      if (item.life < 2) a = Math.sin(item.life * (item.life < 1 ? 34 : 20)) > -0.2 ? 1 : 0.22;
      const r = 10 * pop * (1 + Math.sin(age * 6) * 0.05);
      ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 24);
      g.addColorStop(0, 'rgba(' + P.rgb + ',0.38)'); g.addColorStop(1, 'rgba(' + P.rgb + ',0)');
      ctx.fillStyle = g; ctx.fillRect(x - 24, y - 24, 48, 48);
      ctx.fillStyle = 'rgba(' + P.rgb + ',0.2)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r + 0.5, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop);
      glyph(item.kind, P.col);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    function glyph(kind, col) {
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      if (kind === 'gold') {
        ctx.moveTo(0, -6.5); ctx.lineTo(1.7, -1.7); ctx.lineTo(6.5, 0); ctx.lineTo(1.7, 1.7);
        ctx.lineTo(0, 6.5); ctx.lineTo(-1.7, 1.7); ctx.lineTo(-6.5, 0); ctx.lineTo(-1.7, -1.7); ctx.closePath(); ctx.fill();
      } else if (kind === 'slow') {
        ctx.moveTo(-4, -5); ctx.lineTo(4, -5); ctx.lineTo(-4, 5); ctx.lineTo(4, 5); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2, 4); ctx.lineTo(2, 4); ctx.lineTo(0, 1.5); ctx.closePath(); ctx.fill();
      } else if (kind === 'ghost') {
        ctx.moveTo(-4.8, 5.5); ctx.lineTo(-4.8, -1); ctx.arc(0, -1, 4.8, Math.PI, 0); ctx.lineTo(4.8, 5.5);
        ctx.lineTo(3.2, 3.8); ctx.lineTo(1.6, 5.5); ctx.lineTo(0, 3.8); ctx.lineTo(-1.6, 5.5); ctx.lineTo(-3.2, 3.8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = C.bg;
        ctx.beginPath(); ctx.arc(-1.8, -1, 1.1, 0, Math.PI * 2); ctx.arc(1.8, -1, 1.1, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'wrap') {
        ctx.moveTo(-5.5, -2.5); ctx.lineTo(5.5, -2.5); ctx.moveTo(3, -5); ctx.lineTo(5.5, -2.5); ctx.lineTo(3, 0);
        ctx.moveTo(5.5, 3); ctx.lineTo(-5.5, 3); ctx.moveTo(-3, 0.5); ctx.lineTo(-5.5, 3); ctx.lineTo(-3, 5.5); ctx.stroke();
      } else if (kind === 'scissors') {
        ctx.moveTo(-1.4, 1.6); ctx.lineTo(3.2, -6); ctx.moveTo(1.4, 1.6); ctx.lineTo(-3.2, -6); ctx.stroke();
        ctx.beginPath(); ctx.arc(-2.6, 3.8, 2, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(2.6, 3.8, 2, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // nom du bonus qui monte en s'effaçant
    function drawLabels() {
      if (!labels.length) return;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 13px ' + api.font;
      for (const l of labels) {
        const k = l.t / 1.1;
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = C.bg; ctx.fillText(l.text, l.x + 1, l.y - api.ease.out(k) * 28 + 1);
        ctx.fillStyle = l.col; ctx.fillText(l.text, l.x, l.y - api.ease.out(k) * 28);
      }
      ctx.globalAlpha = 1;
    }

    // barres de temps restant, en haut du plateau
    function drawBars() {
      if (state !== 'play') return;
      let row = 0;
      for (const k of TIMED) {
        if (pow[k] <= 0) continue;
        const P = POWERS[k], y = 2 + row * 5;
        ctx.fillStyle = 'rgba(' + P.rgb + ',0.18)'; ctx.fillRect(0, y, W, 3);
        ctx.fillStyle = P.col; ctx.fillRect(0, y, W * (pow[k] / P.dur), 3);
        row++;
      }
    }

    // entrées
    const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], z: [0, -1], w: [0, -1], s: [0, 1], q: [-1, 0], a: [-1, 0], d: [1, 0] };
    api.onKey((e) => {
      const d = DIRS[e.key] || DIRS[e.key.toLowerCase()];
      if (d) { turn(d[0], d[1]); return; }
      if ((e.key === ' ' || e.key === 'Enter') && state !== 'play') { api.hideOverlay(); start(); }
    });
    api.swipe(cv.el, (d) => {
      const m = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
      if (m) turn(m[0], m[1]);
    });

    function mix(a, b, k) {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const r = Math.round(((pa >> 16) & 255) * (1 - k) + ((pb >> 16) & 255) * k);
      const g = Math.round(((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k);
      const bl = Math.round((pa & 255) * (1 - k) + (pb & 255) * k);
      return `rgb(${r},${g},${bl})`;
    }

    // écran d'accueil
    reset(); state = 'ready';
    loop.start();
    api.overlay({
      title: 'Snake',
      text: api.t('Mangez les orbes, évitez les murs et votre queue. Des bonus éphémères apparaissent parfois : orbe dorée, ralenti, fantôme, traversée, ciseaux.',
        'Eat the orbs, avoid the walls and your own tail. Short-lived power-ups show up now and then: golden orb, slow motion, ghost, wrap, scissors.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart: start };
  },
});

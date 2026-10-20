/* ==================================================================
   games/snake.js · Snake
   Le serpent avance de case en case (logique), mais il est dessiné
   en continu : chaque segment est interpolé entre sa case précédente
   et sa case actuelle. D'où un mouvement fluide à toute vitesse.
   ================================================================== */
SBG.register('snake', {
  create(api) {
    const { C } = api;
    const COLS = 20, ROWS = 15, CELL = 28;
    const W = COLS * CELL, H = ROWS * CELL;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();

    let snake, prev, dir, queue, food, score, step, acc, state, grow, eatPulse, deathT;

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

    function reset() {
      snake = [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }];
      prev = snake.map((p) => ({ ...p }));
      dir = { x: 1, y: 0 }; queue = [];
      score = 0; step = 0.12; acc = 0; grow = 0; eatPulse = 0; deathT = 0;
      placeFood();
      fx.clear();
      api.hud({ score: 0 });
    }
    function placeFood() {
      let p;
      do { p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
      while (snake.some((s) => s.x === p.x && s.y === p.y));
      food = { ...p, t: 0 };
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

    function tick() {
      if (queue.length) dir = queue.shift();
      prev = snake.map((p) => ({ ...p }));
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
      const hitSelf = snake.slice(0, snake.length - (grow ? 0 : 1)).some((s) => s.x === head.x && s.y === head.y);
      if (hitWall || hitSelf) return die();
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10; grow += 1; eatPulse = 1;
        api.hud({ score }); api.sfx('pop');
        fx.burst(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, { n: 16, color: [C.cyan, C.violet, '#fff'], speed: 190 });
        if (score >= 50) api.unlock('snake_50');
        step = Math.max(0.062, step * 0.97);
        placeFood();
      }
      if (grow > 0) { grow--; prev.push({ ...prev[prev.length - 1] }); }
      else snake.pop();
      if (prev.length > snake.length) prev.length = snake.length;
    }

    function die() {
      state = 'dead'; deathT = 0;
      api.sfx('lose'); api.shake(7);
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
        if (state === 'dead') { deathT += dt; return; }
        if (state !== 'play') return;
        acc += dt;
        while (acc >= step && state === 'play') { acc -= step; tick(); }
      },
      render() {
        const k = state === 'play' ? acc / step : 1;
        cv.clear(C.bg);

        // quadrillage discret (pré-rendu une seule fois)
        ctx.drawImage(gridLayer, 0, 0, W, H);

        // fruit : orbe qui pulse
        const fxp = food.x * CELL + CELL / 2, fyp = food.y * CELL + CELL / 2;
        const pulse = 1 + Math.sin(food.t * 5) * 0.08;
        const glow = ctx.createRadialGradient(fxp, fyp, 0, fxp, fyp, CELL * 1.2);
        glow.addColorStop(0, 'rgba(176,124,255,0.45)'); glow.addColorStop(1, 'rgba(176,124,255,0)');
        ctx.fillStyle = glow; ctx.fillRect(fxp - CELL * 1.2, fyp - CELL * 1.2, CELL * 2.4, CELL * 2.4);
        ctx.fillStyle = C.violet;
        ctx.beginPath(); ctx.arc(fxp, fyp, CELL * 0.27 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(fxp - 2.5, fyp - 2.5, 2.2, 0, Math.PI * 2); ctx.fill();

        // serpent : polyligne épaisse interpolée
        const pts = snake.map((s, i) => {
          const p = prev[i] || s;
          return { x: (p.x + (s.x - p.x) * k) * CELL + CELL / 2, y: (p.y + (s.y - p.y) * k) * CELL + CELL / 2 };
        });
        const fade = state === 'dead' ? Math.max(0.35, 1 - deathT * 1.5) : 1;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = pts.length - 1; i > 0; i--) {
          const a = pts[i], b = pts[i - 1];
          const m = i / pts.length;
          ctx.strokeStyle = mix(C.cyan, C.violet, m);
          ctx.globalAlpha = fade;
          ctx.lineWidth = CELL * (0.66 - m * 0.18) + eatPulse * 4;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        // tête et yeux
        const h = pts[0];
        ctx.fillStyle = state === 'dead' ? C.bad : '#BDF6FF';
        ctx.beginPath(); ctx.arc(h.x, h.y, CELL * 0.38, 0, Math.PI * 2); ctx.fill();
        const ex = dir.y !== 0 ? 5 : 0, ey = dir.x !== 0 ? 5 : 0;
        ctx.fillStyle = C.bg;
        ctx.beginPath(); ctx.arc(h.x + dir.x * 4 + ex, h.y + dir.y * 4 + ey, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(h.x + dir.x * 4 - ex, h.y + dir.y * 4 - ey, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;

        fx.draw(ctx);
      },
    });

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
      text: api.t('Mangez les orbes, évitez les murs et votre queue.', 'Eat the orbs, avoid the walls and your own tail.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart: start };
  },
});

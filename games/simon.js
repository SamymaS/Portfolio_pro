/* ==================================================================
   games/simon.js · Séquence
   Quatre secteurs d'un même disque, chacun avec sa teinte et sa note.
   La lecture de la séquence est pilotée par l'horloge de la boucle
   (pas de setInterval) : chaque pas a une date d'allumage et une
   date d'extinction. Le tempo accélère à mesure que la suite grandit.
   ================================================================== */
SBG.register('simon', {
  create(api) {
    const { C } = api;
    const W = 440, H = 440, CX = W / 2, CY = H / 2;
    const R_OUT = 196, R_IN = 74, GAP = 7;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();

    // ordre de lecture : 1 haut-gauche, 2 haut-droite, 3 bas-gauche, 4 bas-droite
    const PADS = [
      { col: C.cyan,   freq: 329.63, a0: Math.PI,         dir: [-1, -1] },
      { col: C.violet, freq: 261.63, a0: -Math.PI / 2,    dir: [1, -1] },
      { col: C.blue,   freq: 220.00, a0: Math.PI / 2,     dir: [-1, 1] },
      { col: C.warm,   freq: 164.81, a0: 0,               dir: [1, 1] },
    ];
    PADS.forEach((p) => { p.rgb = rgb(p.col); p.light = 0; p.hold = false; p.until = 0; });

    let seq, step, phase, clock, nextAt, showIdx, score, wrongPad, endT, hubPulse;

    function reset() {
      seq = []; step = 0; phase = 'idle'; clock = 0; nextAt = 0; showIdx = 0;
      score = 0; wrongPad = -1; endT = -1; hubPulse = 0;
      PADS.forEach((p) => { p.light = 0; p.hold = false; p.until = 0; });
      fx.clear();
      api.hud({ score: 0, scoreLabel: api.t('Longueur', 'Length') });
      api.status('');
    }

    function start() {
      reset();
      grow();
      loop.start();
    }

    // tempo : chaque note est plus courte quand la suite s'allonge
    const noteLen = () => Math.max(0.2, 0.46 - seq.length * 0.018);
    const noteGap = () => Math.max(0.08, noteLen() * 0.42);

    function grow() {
      seq.push(Math.floor(Math.random() * 4));
      phase = 'show';
      showIdx = 0;
      nextAt = clock + (seq.length === 1 ? 0.6 : 0.75);
      api.status(api.t('Écoutez', 'Watch'));
    }

    function light(i, dur) {
      const p = PADS[i];
      p.until = clock + dur;
      api.tone(p.freq, Math.max(0.18, dur + 0.05), 'triangle', 0.5);
      api.tone(p.freq * 2, Math.max(0.12, dur * 0.6), 'sine', 0.12);
    }

    function press(i) {
      if (phase !== 'input') return;
      const p = PADS[i];
      p.hold = true;
      if (seq[step] !== i) return fail(i);
      light(i, 0.2);
      step++;
      if (step === seq.length) {
        score = seq.length;
        api.hud({ score });
        hubPulse = 1;
        phase = 'wait';
        api.status(api.t('Bien', 'Good'));
        fx.burst(CX, CY, { n: 18, color: [p.col, '#fff'], speed: 160, life: 0.55 });
        nextAt = clock + 0.55;
      }
    }

    function release(i) { if (i >= 0) PADS[i].hold = false; }

    function fail(i) {
      phase = 'over';
      wrongPad = i; endT = clock;
      PADS.forEach((p) => { p.hold = false; p.until = 0; });
      api.sfx('error'); api.shake(7);
      api.after(140, () => api.sfx('lose'));
      const right = seq[step];
      const [dx, dy] = PADS[i].dir;
      fx.burst(CX + dx * 100, CY + dy * 100, { n: 22, color: [C.bad, C.warm], speed: 200, life: 0.7 });
      const record = api.setBest(score);
      api.status(api.t('Il fallait le pavé ' + (right + 1), 'The right pad was ' + (right + 1)));
      api.after(1100, () => api.overlay({
        kicker: record && score > 0 ? api.t('Nouveau record', 'New best') : '',
        title: api.t('Séquence rompue', 'Sequence broken'),
        text: score
          ? api.t('Suite de ' + score + (score > 1 ? ' notes retenue' : ' note retenue'), score + (score > 1 ? ' notes remembered' : ' note remembered'))
          : api.t('Aucune suite complète, cette fois.', 'No full sequence this time.'),
        action: api.t('Rejouer', 'Play again'),
        tone: record && score > 0 ? 'good' : '',
        onAction: start,
      }));
    }

    /* ── Boucle ──────────────────────────────────────────────────── */
    const loop = api.loop({
      update(dt) {
        clock += dt;
        fx.update(dt);
        hubPulse = Math.max(0, hubPulse - dt * 2.2);
        if (phase === 'show' && clock >= nextAt) {
          if (showIdx < seq.length) {
            light(seq[showIdx], noteLen());
            showIdx++;
            nextAt = clock + noteLen() + noteGap();
          } else {
            phase = 'input'; step = 0;
            api.status(api.t('À vous', 'Your turn'));
          }
        } else if (phase === 'wait' && clock >= nextAt) {
          grow();
        }
        // lumière : attaque rapide, relâche douce
        for (const p of PADS) {
          const on = p.hold || clock < p.until;
          const target = on ? 1 : 0;
          const rate = on ? 22 : 6.5;
          p.light += (target - p.light) * Math.min(1, dt * rate);
        }
      },
      render() {
        cv.clear(C.bg);

        // anneau extérieur discret
        ctx.strokeStyle = C.line; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(CX, CY, R_OUT + 12, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = C.grid;
        ctx.beginPath(); ctx.arc(CX, CY, R_OUT + 20, 0, Math.PI * 2); ctx.stroke();

        PADS.forEach((p, i) => drawPad(p, i));
        drawHub();
        fx.draw(ctx);
      },
    });

    // halo flou d'un pavé, rendu à 1x (le flou masque la définition)
    const GLOW = {};
    function glowSprite(i, wrong) {
      const key = i + (wrong ? 'x' : '');
      if (GLOW[key]) return GLOW[key];
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      const [r, gg, b] = wrong ? rgb(C.bad) : PADS[i].rgb;
      g.shadowColor = 'rgba(' + r + ',' + gg + ',' + b + ',0.55)';
      g.shadowBlur = 38;
      g.shadowOffsetX = 4000;           // seule l'ombre (le halo) est visible sur le canvas
      g.translate(-4000, 0);
      g.fillStyle = '#000';
      sectorOn(g, PADS[i]); g.fill();
      return (GLOW[key] = c);
    }

    function sector(p) { return sectorOn(ctx, p); }
    function sectorOn(ctx, p) {
      const [dx, dy] = p.dir;
      const ox = CX + dx * GAP * 0.7071, oy = CY + dy * GAP * 0.7071;
      const a0 = p.a0, a1 = p.a0 + Math.PI / 2;
      ctx.beginPath();
      ctx.arc(ox, oy, R_OUT, a0, a1);
      ctx.arc(ox, oy, R_IN, a1, a0, true);
      ctx.closePath();
      return { ox, oy };
    }

    function drawPad(p, i) {
      const L = p.light;
      const wrong = phase === 'over' && wrongPad === i;
      const dim = phase === 'over' && !wrong ? 0.45 : 1;
      const [r, g, b] = wrong ? rgb(C.bad) : p.rgb;
      const col = (a) => 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
      const pressScale = api.reduced ? 1 : 1 - 0.015 * (p.hold ? 1 : 0);

      ctx.save();
      ctx.globalAlpha = dim;
      ctx.translate(CX, CY); ctx.scale(pressScale, pressScale); ctx.translate(-CX, -CY);

      // halo lumineux : flou pré-rendu une fois, puis simple fondu
      const gl = wrong ? 0.75 : L;
      if (gl > 0.02) {
        ctx.save();
        ctx.globalAlpha = dim * gl;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glowSprite(i, wrong), 0, 0, W, H);
        ctx.restore();
      }

      const { ox, oy } = sector(p);
      // remplissage : dégradé radial du centre vers le bord
      const grd = ctx.createRadialGradient(ox, oy, R_IN, ox, oy, R_OUT);
      const base = wrong ? 0.3 : 0.08 + 0.55 * L;
      grd.addColorStop(0, col(base * 0.55));
      grd.addColorStop(1, col(base));
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.strokeStyle = col(0.28 + 0.6 * L);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // éclat central quand le pavé est allumé
      if (L > 0.02) {
        const [dx, dy] = p.dir;
        const hx = CX + dx * 96, hy = CY + dy * 96;
        const hl = ctx.createRadialGradient(hx, hy, 0, hx, hy, 110);
        hl.addColorStop(0, 'rgba(255,255,255,' + (0.22 * L) + ')');
        hl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save(); sector(p); ctx.clip();
        ctx.fillStyle = hl; ctx.fillRect(hx - 110, hy - 110, 220, 220);
        ctx.restore();
      }

      // numéro de touche
      const [dx, dy] = p.dir;
      ctx.fillStyle = col(0.45 + 0.5 * L);
      ctx.font = '600 13px ' + api.font;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), CX + dx * 118, CY + dy * 118);
      ctx.restore();
    }

    function drawHub() {
      // disque central
      const r = R_IN - 12;
      ctx.save();
      ctx.fillStyle = C.bg2;
      ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();

      // progression de la saisie
      if (seq.length && (phase === 'input' || phase === 'wait')) {
        const k = phase === 'wait' ? 1 : step / seq.length;
        ctx.strokeStyle = phase === 'wait' ? C.good : C.cyan;
        ctx.lineCap = 'round';
        if (k > 0) {
          ctx.globalAlpha = 0.25; ctx.lineWidth = 8;
          ctx.beginPath(); ctx.arc(CX, CY, r - 6, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1; ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
      if (phase === 'show') {
        // points de lecture
        const n = seq.length, shown = showIdx;
        const k = n ? shown / n : 0;
        ctx.strokeStyle = 'rgba(176,124,255,0.6)';
        ctx.lineWidth = 3; ctx.lineCap = 'round';
        if (k > 0) { ctx.beginPath(); ctx.arc(CX, CY, r - 6, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke(); }
      }

      // chiffre : longueur de la suite
      const s = 1 + hubPulse * 0.18;
      ctx.translate(CX, CY - 4); ctx.scale(s, s);
      ctx.fillStyle = phase === 'over' ? C.bad : C.ink;
      ctx.font = '800 30px ' + api.font;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(phase === 'over' ? score : seq.length), 0, 0);
      ctx.restore();
      ctx.fillStyle = C.faint;
      ctx.font = '600 10.5px ' + api.font;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lbl = phase === 'show' ? api.t('écoutez', 'watch') : phase === 'input' ? api.t('à vous', 'your turn') : phase === 'wait' ? api.t('bien', 'good') : '';
      ctx.fillText(lbl, CX, CY + 20);
    }

    function rgb(h) { const p = parseInt(h.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; }

    /* ── Entrées ─────────────────────────────────────────────────── */
    function local(e) {
      const r = cv.el.getBoundingClientRect();
      const s = Math.min(r.width / W, r.height / H);
      return { x: (e.clientX - r.left - (r.width - W * s) / 2) / s, y: (e.clientY - r.top - (r.height - H * s) / 2) / s };
    }
    function padAt(e) {
      const p = local(e);
      const dx = p.x - CX, dy = p.y - CY, d = Math.hypot(dx, dy);
      if (d < R_IN || d > R_OUT + 6) return -1;
      return (dy < 0 ? 0 : 2) + (dx < 0 ? 0 : 1);
    }
    let held = -1;
    api.on(cv.el, 'pointerdown', (e) => {
      if (e.button !== 0) return;
      const i = padAt(e);
      if (i < 0) return;
      try { cv.el.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
      held = i;
      press(i);
    });
    const up = () => { release(held); held = -1; };
    api.on(cv.el, 'pointerup', up);
    api.on(cv.el, 'pointercancel', up);
    api.on(cv.el, 'contextmenu', (e) => e.preventDefault());

    const keyPad = (e) => {
      const n = '1234'.indexOf(e.key);
      if (n >= 0) return n;
      const m = /^(Digit|Numpad)([1-4])$/.exec(e.code || '');   // claviers AZERTY : touches & é " '
      return m ? +m[2] - 1 : -1;
    };
    api.onKey((e) => {
      const i = keyPad(e);
      if (i < 0 || e.repeat) return;
      press(i);
    });
    api.on(document, 'keyup', (e) => { const i = keyPad(e); if (i >= 0) release(i); });

    // écran d'accueil
    reset();
    loop.start();
    api.overlay({
      title: api.t('Séquence', 'Sequence'),
      text: api.t('Regardez, écoutez, puis rejouez la suite. Elle s\'allonge et accélère à chaque tour.', 'Watch, listen, then repeat the sequence. It grows and speeds up every round.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart: start };
  },
});

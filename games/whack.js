/* ==================================================================
   games/whack.js · Tape-taupe
   Neuf ports ronds. Des signaux lumineux en sortent avec un petit
   rebond puis s'éteignent s'ils ne sont pas touchés. Le signal est
   découpé par l'ouverture du port : il « émerge » réellement du puits.
   Manche de 30 s, le tempo monte au fil du temps.
   ================================================================== */
SBG.register('whack', {
  create(api) {
    const { C } = api;
    const W = 444, H = 468;
    const ROUND = 30;
    const TOP = 36;                         // place pour la barre de temps
    const CELL_W = 136, CELL_H = 140, OX = (W - CELL_W * 3) / 2;
    const PRX = 46, PRY = 17;               // ellipse d'ouverture d'un port
    const ORB = 22, RISE = 44;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const fx = api.particles();

    const ports = [];
    for (let i = 0; i < 9; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      ports.push({ i, x: OX + col * CELL_W + CELL_W / 2, y: TOP + row * CELL_H + CELL_H * 0.66 });
    }

    let sig, pops, state, clock, t0, hits, spawned, missed, nextSpawn, cursor, kbd, hover, warnSec;

    function reset() {
      sig = new Array(9).fill(null);
      pops = [];
      clock = 0; t0 = 0; hits = 0; spawned = 0; missed = 0; nextSpawn = 0;
      cursor = 4; kbd = false; hover = -1; warnSec = -1;
      ports.forEach((p) => { p.flash = 0; p.press = 0; });
      fx.clear();
      api.hud({ score: 0, scoreLabel: api.t('Touchés', 'Hits') });
      api.status('');
    }

    function start() {
      reset();
      state = 'play';
      t0 = clock;
      nextSpawn = clock + 0.55;
      api.status(api.t('30 secondes', '30 seconds'));
      loop.start();
    }

    // progression de la manche, 0 → 1
    const prog = () => api.clamp((clock - t0) / ROUND, 0, 1);

    function spawn() {
      const k = prog();
      const free = [];
      for (let i = 0; i < 9; i++) if (!sig[i]) free.push(i);
      if (!free.length) return;
      const i = free[Math.floor(Math.random() * free.length)];
      const life = api.lerp(1.15, 0.62, k) * (0.9 + Math.random() * 0.2);
      sig[i] = { born: clock, life, hit: -1, gone: -1 };
      spawned++;
      api.tone(api.lerp(520, 760, Math.random()), 0.05, 'sine', 0.12);
    }

    function strike(i) {
      if (state !== 'play') return;
      const p = ports[i];
      p.press = 1;
      const s = sig[i];
      if (s && s.hit < 0 && s.gone < 0) {
        s.hit = clock;
        hits++;
        api.hud({ score: hits });
        api.sfx('pop');
        const oy = p.y - RISE * riseK(s);
        fx.burst(p.x, oy, { n: 16, color: [C.cyan, C.violet, '#fff'], speed: 200, life: 0.55 });
        pops.push({ x: p.x, y: oy - ORB - 6, t: clock });
        if (hits === 25) api.unlock('whack_25');
      } else {
        p.flash = 1;          // coup dans le vide : rien à payer, juste un éclair
        api.sfx('tick');
      }
    }

    // hauteur du signal (0 caché, 1 sorti)
    function riseK(s) {
      const a = clock - s.born;
      if (s.hit >= 0) return Math.max(0, (1 - (clock - s.hit) / 0.16)) * riseAt(s.hit - s.born);
      if (s.gone >= 0) return riseAt(s.gone - s.born) * Math.max(0, 1 - (clock - s.gone) / 0.22);
      return riseAt(a);
    }
    function riseAt(a) {
      const k = api.clamp(a / 0.2, 0, 1);
      return api.reduced ? k : api.ease.back(k);
    }

    function finish() {
      state = 'over';
      for (const s of sig) if (s && s.hit < 0 && s.gone < 0) s.gone = clock;
      const record = api.setBest(hits);
      const acc = spawned ? Math.round((hits / spawned) * 100) : 0;
      api.sfx(hits >= 25 ? 'win' : 'score');
      api.status(api.t('Manche terminée', 'Round over'));
      api.after(800, () => api.overlay({
        kicker: record && hits > 0 ? api.t('Nouveau record', 'New best') : (hits >= 25 ? api.t('Réflexes affûtés', 'Sharp reflexes') : ''),
        title: api.t(hits + (hits > 1 ? ' signaux' : ' signal'), hits + (hits === 1 ? ' signal' : ' signals')),
        text: api.t('Précision ' + acc + ' % sur ' + spawned + ' apparitions.', acc + '% accuracy over ' + spawned + ' signals.'),
        action: api.t('Rejouer', 'Play again'),
        tone: (record && hits > 0) || hits >= 25 ? 'good' : '',
        onAction: start,
      }));
    }

    /* ── Boucle ──────────────────────────────────────────────────── */
    const loop = api.loop({
      update(dt) {
        clock += dt;
        fx.update(dt);
        for (const p of ports) { p.flash = Math.max(0, p.flash - dt * 3); p.press = Math.max(0, p.press - dt * 7); }
        for (let i = pops.length - 1; i >= 0; i--) if (clock - pops[i].t > 0.7) pops.splice(i, 1);
        for (let i = 0; i < 9; i++) {
          const s = sig[i];
          if (!s) continue;
          if (s.hit < 0 && s.gone < 0 && clock - s.born > s.life) { s.gone = clock; missed++; }
          if ((s.hit >= 0 && clock - s.hit > 0.2) || (s.gone >= 0 && clock - s.gone > 0.3)) sig[i] = null;
        }
        if (state !== 'play') return;
        const left = ROUND - (clock - t0);
        if (left <= 0) { finish(); return; }
        const sec = Math.ceil(left);
        if (sec !== warnSec) {
          warnSec = sec;
          api.status(api.t(sec + ' s', sec + ' s'));
          if (sec <= 3) api.tone(880, 0.05, 'square', 0.12);
        }
        if (clock >= nextSpawn) {
          const k = prog();
          spawn();
          // fin de manche : parfois deux signaux à la fois
          if (k > 0.45 && Math.random() < k * 0.35) spawn();
          nextSpawn = clock + api.lerp(0.82, 0.4, k) * (0.85 + Math.random() * 0.3);
        }
      },
      render() {
        cv.clear(C.bg);
        drawTimer();
        for (const p of ports) drawPort(p);
        fx.draw(ctx);
        // +1 flottants
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '700 15px ' + api.font;
        for (const q of pops) {
          const a = (clock - q.t) / 0.7;
          ctx.globalAlpha = 1 - a * a;
          ctx.fillStyle = C.ink;
          ctx.fillText('+1', q.x, q.y - api.ease.out(a) * 22);
        }
        ctx.globalAlpha = 1;
      },
    });

    function drawTimer() {
      const x = 22, y = 16, w = W - 44, h = 4;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      api.roundRect(ctx, x, y, w, h, 2); ctx.fill();
      const k = state === 'play' ? 1 - prog() : state === 'ready' ? 1 : 0;
      if (k <= 0) return;
      const left = k * ROUND;
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      if (left <= 5 && state === 'play') { g.addColorStop(0, C.warm); g.addColorStop(1, C.bad); }
      else { g.addColorStop(0, C.cyan); g.addColorStop(1, C.violet); }
      ctx.save();
      ctx.fillStyle = g;
            api.roundRect(ctx, x, y, Math.max(h, w * k), h, 2); ctx.fill();
      ctx.restore();
    }

    // sprites pré-rendus : socle du port et orbe lumineux
    const SPR = {};
    function spr(key, w, h, draw) {
      if (SPR[key]) return SPR[key];
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * cv.dpr); c.height = Math.ceil(h * cv.dpr);
      const g = c.getContext('2d');
      g.scale(cv.dpr, cv.dpr); g.translate(w / 2, h / 2);
      draw(g);
      return (SPR[key] = { c, w, h });
    }
    const blit = (s, x, y) => ctx.drawImage(s.c, x - s.w / 2, y - s.h / 2, s.w, s.h);
    const BASE_W = (PRX + 24) * 2, BASE_H = (PRY + 16) * 2;
    const baseSpr = () => spr('base', BASE_W, BASE_H, (g) => {
      // disque de sol
      const floor = g.createRadialGradient(0, 4, 0, 0, 4, PRX + 22);
      floor.addColorStop(0, 'rgba(31,111,235,0.10)');
      floor.addColorStop(1, 'rgba(31,111,235,0)');
      g.fillStyle = floor;
      g.beginPath(); g.ellipse(0, 4, PRX + 22, PRY + 12, 0, 0, Math.PI * 2); g.fill();
      // épaisseur du dôme
      g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(0, 7, PRX + 6, PRY + 5, 0, 0.1, Math.PI - 0.1); g.stroke();
      // ouverture du puits
      const well = g.createLinearGradient(0, -PRY, 0, PRY);
      well.addColorStop(0, '#03040A'); well.addColorStop(1, '#141A30');
      g.fillStyle = well;
      g.beginPath(); g.ellipse(0, 0, PRX, PRY, 0, 0, Math.PI * 2); g.fill();
    });
    const wellGlow = () => spr('wellglow', PRX * 2, PRY * 2, (g) => {
      g.scale(1, PRY / PRX);
      const gl = g.createRadialGradient(0, 0, 0, 0, 0, PRX);
      gl.addColorStop(0, 'rgba(56,189,248,0.4)');
      gl.addColorStop(1, 'rgba(56,189,248,0)');
      g.fillStyle = gl;
      g.beginPath(); g.arc(0, 0, PRX, 0, Math.PI * 2); g.fill();
    });
    const ORB_BOX = ORB * 5.6;
    const orbSpr = (hit) => spr(hit ? 'orbhit' : 'orb', ORB_BOX, ORB_BOX, (g) => {
      const hc = hit ? '255,255,255' : '56,189,248';
      const halo = g.createRadialGradient(0, 0, 0, 0, 0, ORB * 2.7);
      halo.addColorStop(0, 'rgba(' + hc + ',0.45)');
      halo.addColorStop(1, 'rgba(' + hc + ',0)');
      g.fillStyle = halo;
      g.fillRect(-ORB_BOX / 2, -ORB_BOX / 2, ORB_BOX, ORB_BOX);
      const orb = g.createRadialGradient(-ORB * 0.3, -ORB * 0.35, 1, 0, 0, ORB);
      orb.addColorStop(0, '#FFFFFF');
      orb.addColorStop(0.35, hit ? '#E8FBFF' : '#9FF3FF');
      orb.addColorStop(1, hit ? '#9FF3FF' : C.cyan);
      g.fillStyle = orb;
      g.shadowColor = C.cyan; g.shadowBlur = 20 * cv.dpr;
      g.beginPath(); g.arc(0, 0, ORB, 0, Math.PI * 2); g.fill();
    });

    function drawPort(p) {
      const s = sig[p.i];
      const isHover = !kbd && hover === p.i && state === 'play';
      const isCursor = kbd && cursor === p.i && state === 'play';
      const press = p.press;

      blit(baseSpr(), p.x, p.y);

      if (s) {
        const rk = riseK(s);
        const hit = s.hit >= 0;
        const fade = s.gone >= 0 ? Math.max(0, 1 - (clock - s.gone) / 0.3) : 1;
        const urgency = s.hit < 0 && s.gone < 0 ? api.clamp((clock - s.born) / s.life, 0, 1) : 0;
        const oy = p.y + ORB - (RISE + ORB) * rk;

        // lueur au fond du puits
        ctx.globalAlpha = Math.min(1, rk) * fade;
        blit(wellGlow(), p.x, p.y);
        ctx.globalAlpha = 1;

        // signal : découpé par l'ouverture (tout ce qui est au-dessus du centre + la moitié avant de l'ellipse)
        ctx.save();
        ctx.beginPath();
        ctx.rect(p.x - PRX - 40, p.y - 140, (PRX + 40) * 2, 140);
        ctx.moveTo(p.x + PRX, p.y);
        ctx.ellipse(p.x, p.y, PRX, PRY, 0, 0, Math.PI);
        ctx.clip();
        ctx.globalAlpha = fade;
        // colonne de lumière qui relie le signal au puits
        const col = ctx.createLinearGradient(0, oy, 0, p.y);
        col.addColorStop(0, 'rgba(56,189,248,0.28)');
        col.addColorStop(1, 'rgba(56,189,248,0.02)');
        ctx.fillStyle = col;
        ctx.fillRect(p.x - ORB * 0.55, oy, ORB * 1.1, Math.max(0, p.y - oy));
        // orbe (grossit et blanchit quand il est touché)
        const sc = hit ? 1 + (clock - s.hit) * 2.2 : 1;
        const o = orbSpr(hit);
        ctx.drawImage(o.c, p.x - (o.w / 2) * sc, oy - (o.h / 2) * sc, o.w * sc, o.h * sc);
        // anneau d'urgence : se referme avant l'extinction
        if (urgency > 0 && !api.reduced) {
          ctx.strokeStyle = 'rgba(210,168,255,0.85)';
          ctx.lineWidth = 2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(p.x, oy, ORB + 6, -Math.PI / 2, -Math.PI / 2 + (1 - urgency) * Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      }

      // lèvre du port (par-dessus le signal)
      const rx = PRX + press * 2, ry = PRY + press;
      if (p.flash > 0 || isCursor) {
        ctx.strokeStyle = p.flash > 0 ? 'rgba(255,123,114,' + (0.18 * p.flash) + ')' : 'rgba(56,189,248,0.2)';
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.strokeStyle = p.flash > 0 ? 'rgba(255,123,114,' + (0.25 + 0.6 * p.flash) + ')'
        : isHover || isCursor ? 'rgba(56,189,248,0.65)' : 'rgba(255,255,255,0.13)';
      ctx.lineWidth = 2 + press * 1.5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();

      // numéro de touche
      ctx.fillStyle = C.faint;
      ctx.font = '600 11px ' + api.font;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(p.i + 1), p.x, p.y + PRY + 20);
    }

    /* ── Entrées ─────────────────────────────────────────────────── */
    function local(e) {
      const r = cv.el.getBoundingClientRect();
      const s = Math.min(r.width / W, r.height / H);
      return { x: (e.clientX - r.left - (r.width - W * s) / 2) / s, y: (e.clientY - r.top - (r.height - H * s) / 2) / s };
    }
    // zone de frappe généreuse : la cellule entière autour du port
    function portAt(e) {
      const q = local(e);
      let best = -1, bd = Infinity;
      for (const p of ports) {
        const d = Math.hypot((q.x - p.x) / 1.0, (q.y - (p.y - 22)) / 1.1);
        if (d < bd) { bd = d; best = p.i; }
      }
      return bd < 70 ? best : -1;
    }
    api.on(cv.el, 'pointerdown', (e) => {
      if (e.button !== 0 || state !== 'play') return;
      const i = portAt(e);
      if (i < 0) return;
      kbd = false;
      strike(i);
    });
    api.on(cv.el, 'pointermove', (e) => { if (e.pointerType === 'mouse') { hover = portAt(e); if (hover >= 0) kbd = false; } });
    api.on(cv.el, 'pointerleave', () => { hover = -1; });
    api.on(cv.el, 'contextmenu', (e) => e.preventDefault());

    api.onKey((e) => {
      if (state !== 'play' || e.repeat) return;
      let n = '123456789'.indexOf(e.key);
      if (n < 0) { const m = /^(Digit|Numpad)([1-9])$/.exec(e.code || ''); if (m) n = +m[2] - 1; }
      if (n >= 0) { kbd = false; strike(n); return; }
      const mv = { ArrowUp: -3, ArrowDown: 3, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (mv) {
        if (kbd) {
          const c = cursor % 3, r = Math.floor(cursor / 3);
          if (mv === -1 && c > 0) cursor--;
          else if (mv === 1 && c < 2) cursor++;
          else if (mv === -3 && r > 0) cursor -= 3;
          else if (mv === 3 && r < 2) cursor += 3;
        }
        kbd = true;
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (document.activeElement && document.activeElement.classList.contains('g-btn')) return;
        e.preventDefault();
        kbd = true; strike(cursor);
      }
    });

    // écran d'accueil
    reset(); state = 'ready';
    loop.start();
    api.overlay({
      title: api.t('Tape-taupe', 'Whack-a-mole'),
      text: api.t('Touchez les signaux avant qu\'ils s\'éteignent. Le rythme monte pendant 30 secondes.', 'Hit the signals before they fade. The pace rises for 30 seconds.'),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart: start };
  },
});

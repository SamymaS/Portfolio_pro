/* ==================================================================
   games/reflex.js · Temps de réaction
   Cinq essais par manche. Le signal apparaît après 1,2 à 3,5 s ;
   le temps est mesuré avec performance.now() sur pointerdown ou
   keydown (Espace), pas sur click, qui arrive plus tard.
   L'instant de départ est pris dans le requestAnimationFrame qui
   précède l'affichage du signal, pour coller à ce que voit l'œil.
   ================================================================== */
SBG.register('reflex', {
  create(api) {
    const t = api.t;
    const TRIES = 5;
    const SCALE = 600;               // ms pour une barre pleine

    const root = document.createElement('div');
    root.className = 'rx-root';
    root.innerHTML = `
<style>
.g-stage:has(> .rx-root){justify-content:flex-start}
.rx-root{width:100%;max-width:560px;margin-block:auto;display:grid;gap:1.2rem;user-select:none;-webkit-user-select:none}
.rx-pad{position:relative;height:clamp(200px,38svh,280px);border-radius:26px;border:1px solid var(--line);background:rgba(255,255,255,.025);display:grid;place-items:center;align-content:center;gap:.4rem;text-align:center;padding:1rem;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;overflow:hidden;outline:none;transition:background .35s ease-out,border-color .35s ease-out,box-shadow .35s ease-out}
.rx-pad:focus-visible{border-color:rgba(238,241,247,.28)}
.rx-pad::before{content:'';position:absolute;inset:0;border-radius:inherit;background:radial-gradient(60% 70% at 50% 50%,rgba(56,230,255,.35),rgba(56,230,255,0) 70%);opacity:0;transition:opacity .3s ease-out}
.rx-big{position:relative;font-size:clamp(1.7rem,6vw,2.6rem);font-weight:800;font-stretch:118%;letter-spacing:-.02em;line-height:1.05;color:var(--ink);font-variant-numeric:tabular-nums}
.rx-small{position:relative;font-size:.92rem;color:var(--muted)}
.rx-dot{position:relative;width:10px;height:10px;border-radius:50%;background:var(--faint);margin:0 auto .5rem;opacity:.8}
.rx-pad.wait .rx-dot{animation:rx-breathe 1.6s ease-in-out infinite}
@keyframes rx-breathe{50%{opacity:.25}}
.rx-pad.wait .rx-big{color:var(--muted)}
.rx-pad.go{transition:none;background:rgba(56,230,255,.16);border-color:var(--c2);box-shadow:0 0 0 1px var(--c2),0 0 60px rgba(56,230,255,.35)}
.rx-pad.go::before{transition:none;opacity:1}
.rx-pad.go .rx-dot{background:var(--c2);box-shadow:0 0 14px var(--c2)}
.rx-pad.go .rx-big{color:#fff}
.rx-pad.early{border-color:rgba(255,122,107,.6);background:rgba(255,122,107,.07)}
.rx-pad.early .rx-big{color:#FF7A6B}
.rx-pad.early .rx-dot{background:#FF7A6B}
.rx-pad.done .rx-big{color:var(--c2)}
.rx-pad.done .rx-dot{background:var(--c2)}
.rx-pad.fast .rx-big{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.rx-meta{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;font-size:.86rem;color:var(--faint)}
.rx-meta b{color:var(--ink);font-weight:650;font-variant-numeric:tabular-nums}
.rx-chart{--ch:112px;position:relative;box-sizing:content-box;display:grid;grid-template-columns:repeat(${TRIES},1fr);gap:.7rem;height:var(--ch);padding:1.5rem .2rem 0;border-bottom:1px solid var(--line)}
.rx-col{position:relative;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}
.rx-bar{width:100%;max-width:56px;height:100%;border-radius:10px 10px 3px 3px;background:linear-gradient(180deg,rgba(176,124,255,.55),rgba(176,124,255,.18));transform-origin:50% 100%;transform:scaleY(0);transition:transform .45s cubic-bezier(.2,.8,.2,1),background .3s}
.rx-col.best .rx-bar{background:linear-gradient(180deg,var(--c2),rgba(56,230,255,.25))}
.rx-col.slot .rx-bar{transform:scaleY(.03);background:rgba(255,255,255,.12)}
.rx-col.now .rx-bar{background:rgba(56,230,255,.35)}
.rx-val{position:absolute;bottom:calc(var(--h,0) * 100% + 6px);font-size:.78rem;font-weight:650;color:var(--muted);font-variant-numeric:tabular-nums;opacity:0;transition:opacity .3s ease-out .15s}
.rx-col.has .rx-val{opacity:1}
.rx-col.best .rx-val{color:var(--c2)}
.rx-avg{position:absolute;left:0;right:0;bottom:0;height:0;border-top:1px dashed rgba(238,241,247,.35);transform:translateY(calc(var(--a,0) * -1 * var(--ch)));opacity:0;transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .3s;pointer-events:none}
.rx-avg span{position:absolute;right:0;top:-1.25rem;font-size:.7rem;color:var(--muted);background:#0B0E1A;padding:0 .3rem;border-radius:4px}
.rx-avg.on{opacity:1}
.rx-axis{display:grid;grid-template-columns:repeat(${TRIES},1fr);gap:.7rem;padding:0 .2rem;margin-top:-.75rem;font-size:.72rem;color:var(--faint);text-align:center}
.rx-stats{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}
.rx-stat{padding:.75rem 1rem;border-radius:16px;border:1px solid var(--line);background:rgba(255,255,255,.025);display:grid;gap:.15rem}
.rx-stat small{font-size:.75rem;color:var(--faint)}
.rx-stat b{font-size:1.25rem;font-weight:750;font-variant-numeric:tabular-nums}
.rx-stat.best b{color:var(--c2)}
@media (prefers-reduced-motion: reduce){.rx-pad.wait .rx-dot{animation:none}.rx-bar,.rx-avg{transition:none}}
</style>
<div class="rx-pad" role="button" tabindex="0"><span class="rx-dot"></span><span class="rx-big"></span><span class="rx-small"></span></div>
<div class="rx-meta"><span data-k="try"></span><span data-k="hint"></span></div>
<div class="rx-chart"><div class="rx-avg"><span></span></div></div>
<div class="rx-axis"></div>
<div class="rx-stats">
  <div class="rx-stat"><small data-k="avgL"></small><b data-k="avg">–</b></div>
  <div class="rx-stat best"><small data-k="bestL"></small><b data-k="best">–</b></div>
</div>`;
    api.stage.appendChild(root);

    const K = (k) => root.querySelector('[data-k="' + k + '"]');
    const pad = root.querySelector('.rx-pad');
    const big = pad.querySelector('.rx-big'), small = pad.querySelector('.rx-small');
    const chart = root.querySelector('.rx-chart'), avgLine = root.querySelector('.rx-avg');
    const axis = root.querySelector('.rx-axis');
    K('avgL').textContent = t('Moyenne', 'Average');
    K('bestL').textContent = t('Meilleur essai', 'Best attempt');
    pad.setAttribute('aria-label', t('Zone de réaction', 'Reaction pad'));
    pad.setAttribute('aria-live', 'polite');

    const cols = [];
    for (let i = 0; i < TRIES; i++) {
      const c = document.createElement('div');
      c.className = 'rx-col slot';
      c.innerHTML = '<span class="rx-val"></span><div class="rx-bar"></div>';
      chart.appendChild(c);
      cols.push(c);
      const a = document.createElement('span'); a.textContent = String(i + 1); axis.appendChild(a);
    }

    let state = 'idle', times = [], goAt = 0, goTimer = 0, nextTimer = 0, gen = 0;
    const ms = (v) => v + ' ms';
    const avg = () => Math.round(times.reduce((a, b) => a + b, 0) / times.length);

    function setPad(cls, b, s) {
      pad.className = 'rx-pad' + (cls ? ' ' + cls : '');
      big.textContent = b; small.textContent = s || '';
    }
    function paintChart() {
      const bestV = times.length ? Math.min(...times) : 0;
      cols.forEach((c, i) => {
        const v = times[i];
        const bar = c.querySelector('.rx-bar'), val = c.querySelector('.rx-val');
        if (v === undefined) {
          c.className = 'rx-col slot' + (i === times.length && state !== 'over' ? ' now' : '');
          bar.style.transform = ''; c.style.removeProperty('--h'); val.textContent = '';
          return;
        }
        const h = api.clamp(v / SCALE, 0.06, 1);
        c.className = 'rx-col has' + (v === bestV ? ' best' : '');
        c.style.setProperty('--h', h.toFixed(3));
        bar.style.transform = 'scaleY(' + h.toFixed(3) + ')';
        val.textContent = v;
      });
      if (times.length) {
        const a = avg();
        avgLine.classList.add('on');
        avgLine.style.setProperty('--a', api.clamp(a / SCALE, 0.06, 1).toFixed(3));
        avgLine.querySelector('span').textContent = t('moy. ', 'avg ') + a;
        K('avg').textContent = ms(a);
        K('best').textContent = ms(bestV);
      } else {
        avgLine.classList.remove('on');
        K('avg').textContent = '–'; K('best').textContent = '–';
      }
      K('try').innerHTML = '';
      const n = Math.min(times.length + (state === 'over' ? 0 : 1), TRIES);
      K('try').append(t('Essai ', 'Attempt '));
      const b = document.createElement('b'); b.textContent = n + ' / ' + TRIES; K('try').appendChild(b);
    }

    function clearTimers() { clearTimeout(goTimer); clearTimeout(nextTimer); }

    function arm() {
      clearTimers();
      state = 'wait';
      setPad('wait', t('Attendez le signal', 'Wait for the signal'), t('Pas encore', 'Not yet'));
      K('hint').textContent = '';
      paintChart();
      const delay = 1200 + Math.random() * 2300;
      const g = gen;
      goTimer = api.after(delay, () => {
        if (g !== gen || state !== 'wait') return;
        state = 'go';
        goAt = performance.now();
        setPad('go', t('Maintenant', 'Now'), '');
        // l'image avec le signal sera peinte juste après ce rAF
        requestAnimationFrame(() => { if (g === gen && state === 'go') goAt = Math.max(goAt, performance.now()); });
      });
    }

    function press() {
      const now = performance.now();
      if (state === 'wait') {
        clearTimers();
        state = 'early';
        api.sfx('error'); api.shake(4);
        setPad('early', t('Trop tôt', 'Too soon'), t('On recommence cet essai', 'Restarting this attempt'));
        const g = gen;
        nextTimer = api.after(1100, () => { if (g === gen && state === 'early') arm(); });
        return;
      }
      if (state === 'go') {
        const v = Math.max(1, Math.round(now - goAt));
        // sous 90 ms, aucun humain ne réagit : c'est une anticipation
        if (v < 90) { state = 'wait'; press(); return; }
        times.push(v);
        state = 'shown';
        api.hud({ score: v });
        const fast = v < 250;
        if (fast) api.unlock('reflex_pro');
        api.sfx(fast ? 'score' : 'pop');
        const last = times.length >= TRIES;
        setPad('done' + (fast ? ' fast' : ''), ms(v), last ? '' : t('Toucher pour continuer', 'Tap to continue'));
        paintChart();
        const g = gen;
        if (last) { state = 'over'; nextTimer = api.after(900, () => { if (g === gen) finish(); }); }
        else nextTimer = api.after(1600, () => { if (g === gen && state === 'shown') arm(); });
        return;
      }
      if (state === 'shown') { arm(); return; }
      if (state === 'idle') arm();
    }

    function finish() {
      const bestV = Math.min(...times), a = avg();
      paintChart();
      setPad('done', ms(bestV), t('Meilleur essai', 'Best attempt'));
      const record = api.setBest(bestV, true);
      api.sfx(record ? 'win' : 'score');
      api.overlay({
        kicker: record ? t('Nouveau record', 'New best') : t('Record : ', 'Best: ') + api.best + ' ms',
        title: ms(bestV),
        text: t('Moyenne ' + a + ' ms sur ' + TRIES + ' essais. ', 'Average ' + a + ' ms over ' + TRIES + ' attempts. ') + verdict(a),
        action: t('Rejouer', 'Play again'),
        tone: record ? 'good' : '',
        onAction: start,
      });
    }
    function verdict(a) {
      if (a < 220) return t('Réflexes de pilote.', 'Pilot-grade reflexes.');
      if (a < 280) return t('Très vif.', 'Very sharp.');
      if (a < 350) return t('Dans la moyenne.', 'Right on average.');
      return t('Un café, puis on retente ?', 'Coffee, then another go?');
    }

    function start() {
      gen++; clearTimers();
      times = []; state = 'idle';
      api.hud({ score: '–', scoreLabel: t('Dernier', 'Last') });
      api.status('');
      paintChart();
      arm();
      try { pad.focus({ preventScroll: true }); } catch (e) { /* rien */ }
    }

    api.on(pad, 'pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      press();
    });
    api.onKey((e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (e.repeat) return;
      if (api.stage.querySelector('.g-overlay')) return;   // le bouton du panneau gère Entrée/Espace
      if (e.key === 'Enter' && state !== 'shown' && state !== 'idle') return;
      e.preventDefault();
      press();
    });

    // accueil
    paintChart();
    setPad('', t('Prêt ?', 'Ready?'), '');
    K('try').textContent = '';
    api.overlay({
      title: t('Réflexes', 'Reaction time'),
      text: t('Cinq essais. Quand la zone s\'allume, cliquez ou appuyez sur Espace. Sous 250 ms, c\'est excellent.',
        'Five attempts. When the pad lights up, click or press Space. Under 250 ms is excellent.'),
      action: t('Commencer', 'Start'),
      onAction: start,
    });

    return { restart: start, destroy() { gen++; clearTimers(); } };
  },
});

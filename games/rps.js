/* ==================================================================
   games/rps.js · Pierre-feuille-ciseaux
   Match en 10 points. L'ordinateur n'est pas aléatoire : il compte
   les transitions de vos coups (ordre 2, puis ordre 1, puis
   fréquence) pour prédire le prochain et jouer ce qui le bat,
   avec une part de hasard pour rester battable.
   ================================================================== */
SBG.register('rps', {
  create(api) {
    const t = api.t;
    const TARGET = 10;
    const NAMES = [['Pierre', 'Rock'], ['Feuille', 'Paper'], ['Ciseaux', 'Scissors']];
    const name = (m) => t(NAMES[m][0], NAMES[m][1]);
    // a bat b si (a - b + 3) % 3 === 1
    const beats = (a, b) => (a - b + 3) % 3 === 1;

    /* ── Glyphes SVG (trait, couleur héritée) ─────────────────── */
    const SVG = (body) => '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
    const GLYPH = [
      // galet facetté
      SVG('<path d="M13 37 L19 21 L34 13 L49 19 L55 35 L46 49 L27 53 L15 46 Z"/><path d="M19 21 L31 31 L49 19 M31 31 L27 53 M31 31 L55 35" stroke-width="1.6" opacity=".55"/>'),
      // feuille pliée
      SVG('<path d="M17 9 H40 L49 18 V55 H17 Z"/><path d="M40 9 V18 H49"/><path d="M24 29 H42 M24 37 H42 M24 45 H35" stroke-width="1.8" opacity=".55"/>'),
      // ciseaux : deux anneaux, deux lames
      SVG('<circle cx="19" cy="47" r="7"/><circle cx="45" cy="47" r="7"/><path d="M24 42 L45 10"/><path d="M40 42 L19 10"/><circle cx="32" cy="29.6" r="1.6" fill="currentColor" stroke="none"/>'),
    ];
    const WAIT = SVG('<circle cx="20" cy="32" r="3" fill="currentColor" stroke="none"/><circle cx="32" cy="32" r="3" fill="currentColor" stroke="none"/><circle cx="44" cy="32" r="3" fill="currentColor" stroke="none"/>');

    /* ── Interface ───────────────────────────────────────────── */
    const root = document.createElement('div');
    root.className = 'rps-root';
    root.innerHTML = `
<style>
.g-stage:has(> .rps-root){justify-content:flex-start}
.rps-root{width:100%;max-width:560px;margin-block:auto;display:grid;gap:1.1rem;user-select:none;-webkit-user-select:none}
.rps-board{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:.5rem 1rem}
.rps-side{display:grid;gap:.25rem}
.rps-side.cpu{text-align:right}
.rps-who{font-size:.8rem;color:var(--faint);font-weight:600}
.rps-pts{font-size:clamp(1.9rem,6vw,2.5rem);font-weight:800;font-stretch:118%;line-height:1;font-variant-numeric:tabular-nums}
.rps-side.you .rps-pts{color:var(--c2)}
.rps-side.cpu .rps-pts{color:var(--c3)}
.rps-mid{text-align:center;font-size:.8rem;color:var(--faint);line-height:1.5}
.rps-mid b{color:var(--muted);font-weight:600;font-variant-numeric:tabular-nums}
.rps-arena{display:grid;grid-template-columns:1fr 1fr;gap:1rem;perspective:700px}
.rps-card{position:relative;aspect-ratio:1/1;max-height:200px;width:100%;justify-self:center;border-radius:22px;border:1px solid var(--line);background:rgba(255,255,255,.025);display:grid;place-items:center;transition:border-color .3s,background .3s,box-shadow .3s}
.rps-card .rps-g{width:52%;height:52%;color:var(--faint);transition:color .25s}
.rps-card svg{width:100%;height:100%;display:block}
.rps-card.you.lit .rps-g{color:var(--c2)}
.rps-card.cpu.lit .rps-g{color:var(--c3)}
.rps-card.win{border-color:rgba(56,230,255,.55);background:rgba(56,230,255,.06);box-shadow:0 0 34px rgba(56,230,255,.14)}
.rps-card.cpu.win{border-color:rgba(176,124,255,.55);background:rgba(176,124,255,.07);box-shadow:0 0 34px rgba(176,124,255,.14)}
.rps-card.lose{opacity:.55}
.rps-tag{position:absolute;left:.8rem;top:.6rem;font-size:.72rem;color:var(--faint);font-weight:600}
.rps-card.cpu .rps-tag{left:auto;right:.8rem}
.rps-line{text-align:center;min-height:1.6em;font-size:1.08rem;font-weight:650;color:var(--ink);transition:opacity .2s}
.rps-line.good{color:var(--c2)}.rps-line.bad{color:#FF7A6B}.rps-line.even{color:var(--muted)}
.rps-picks{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem}
.rps-pick{position:relative;display:grid;justify-items:center;gap:.35rem;padding:.9rem .4rem .75rem;border-radius:18px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--ink);font-weight:600;font-size:.92rem;transition:border-color .2s,background .2s,transform .2s cubic-bezier(.2,.8,.2,1)}
.rps-pick svg{width:44px;height:44px;color:var(--muted);transition:color .2s}
.rps-pick:hover:not(:disabled){border-color:rgba(56,230,255,.5);background:rgba(56,230,255,.06);transform:translateY(-2px)}
.rps-pick:hover:not(:disabled) svg,.rps-pick.on svg{color:var(--c2)}
.rps-pick.on{border-color:var(--c2);background:rgba(56,230,255,.08)}
.rps-pick:disabled{cursor:default}
.rps-pick:disabled:not(.on){opacity:.5}
.rps-pick kbd{position:absolute;top:.45rem;right:.5rem;font-size:.7rem;color:var(--faint);padding:0 .35em}
.rps-streak{display:flex;justify-content:center;gap:1.4rem;font-size:.86rem;color:var(--faint)}
.rps-streak b{color:var(--ink);font-variant-numeric:tabular-nums;margin-left:.3rem}
@media (max-width:560px){
  .rps-root{gap:.9rem}
  .rps-card{border-radius:18px}
  .rps-pick svg{width:38px;height:38px}
  .rps-pick kbd{display:none}
}
</style>
<div class="rps-board">
  <div class="rps-side you"><span class="rps-who"></span><span class="rps-pts" data-k="you">0</span></div>
  <div class="rps-mid"><span data-k="first"></span><br><span data-k="tiesL"></span> <b data-k="ties">0</b></div>
  <div class="rps-side cpu"><span class="rps-who"></span><span class="rps-pts" data-k="cpu">0</span></div>
</div>
<div class="rps-arena">
  <div class="rps-card you"><span class="rps-tag"></span><div class="rps-g"></div></div>
  <div class="rps-card cpu"><span class="rps-tag"></span><div class="rps-g"></div></div>
</div>
<p class="rps-line" aria-live="polite"></p>
<div class="rps-picks"></div>
<div class="rps-streak"><span><span data-k="curL"></span><b data-k="cur">0</b></span><span><span data-k="bestL"></span><b data-k="best">0</b></span></div>`;
    api.stage.appendChild(root);

    const q = (s) => root.querySelector(s);
    const K = (k) => root.querySelector('[data-k="' + k + '"]');
    const you = t('Vous', 'You'), cpuName = t('Ordinateur', 'Computer');
    root.querySelectorAll('.rps-side.you .rps-who, .rps-card.you .rps-tag').forEach((n) => { n.textContent = you; });
    root.querySelectorAll('.rps-side.cpu .rps-who, .rps-card.cpu .rps-tag').forEach((n) => { n.textContent = cpuName; });
    K('first').textContent = t('Premier à ' + TARGET, 'First to ' + TARGET);
    K('tiesL').textContent = t('Égalités', 'Ties');
    K('curL').textContent = t('Série', 'Streak');
    K('bestL').textContent = t('Record', 'Best');
    const cardYou = q('.rps-card.you'), cardCpu = q('.rps-card.cpu');
    const gYou = cardYou.querySelector('.rps-g'), gCpu = cardCpu.querySelector('.rps-g');
    const line = q('.rps-line');
    const picks = q('.rps-picks');
    const btns = [0, 1, 2].map((m) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'rps-pick';
      b.innerHTML = GLYPH[m] + '<span></span><kbd>' + (m + 1) + '</kbd>';
      b.querySelector('span').textContent = name(m);
      b.setAttribute('aria-label', name(m) + ' (' + (m + 1) + ')');
      api.on(b, 'click', () => play(m));
      picks.appendChild(b);
      return b;
    });

    /* ── Modèle prédictif ────────────────────────────────────── */
    const hist = [];                // coups du joueur (persistent sur la session)
    const o2 = {}, o1 = {}, freq = [0, 0, 0];
    function learn(m) {
      const n = hist.length;
      if (n >= 2) { const k = hist[n - 2] + ',' + hist[n - 1]; (o2[k] = o2[k] || [0, 0, 0])[m]++; }
      if (n >= 1) { const k = String(hist[n - 1]); (o1[k] = o1[k] || [0, 0, 0])[m]++; }
      freq[m]++; hist.push(m);
    }
    const argmax = (a) => { const mx = Math.max(...a); const c = [0, 1, 2].filter((i) => a[i] === mx); return c[Math.floor(Math.random() * c.length)]; };
    const sum = (a) => a[0] + a[1] + a[2];
    function cpuMove() {
      const n = hist.length;
      let table = null;
      if (n >= 2 && o2[hist[n - 2] + ',' + hist[n - 1]] && sum(o2[hist[n - 2] + ',' + hist[n - 1]]) >= 2) table = o2[hist[n - 2] + ',' + hist[n - 1]];
      else if (n >= 1 && o1[String(hist[n - 1])] && sum(o1[String(hist[n - 1])]) >= 2) table = o1[String(hist[n - 1])];
      else if (n >= 3) table = freq;
      if (!table || Math.random() < 0.25) return Math.floor(Math.random() * 3);
      return (argmax(table) + 1) % 3;   // ce qui bat le coup prédit
    }

    /* ── État ────────────────────────────────────────────────── */
    let sYou, sCpu, ties, streak, matchBest, busy, over, gen = 0;
    const bestStreak = () => Math.max(api.best || 0, matchBest || 0);

    function paintScore() {
      K('you').textContent = sYou; K('cpu').textContent = sCpu; K('ties').textContent = ties;
      K('cur').textContent = streak; K('best').textContent = bestStreak();
    }
    function setLine(text, cls) { line.textContent = text; line.className = 'rps-line' + (cls ? ' ' + cls : ''); }
    function lock(on, chosen) {
      btns.forEach((b, i) => { b.disabled = on; b.classList.toggle('on', on && i === chosen); });
    }
    function resetCards() {
      [cardYou, cardCpu].forEach((c) => c.classList.remove('win', 'lose', 'lit'));
      gYou.innerHTML = WAIT; gCpu.innerHTML = WAIT;
    }

    function start() {
      gen++;
      sYou = 0; sCpu = 0; ties = 0; streak = 0; matchBest = 0; busy = false; over = false;
      api.hud({ score: 0, scoreLabel: t('Série', 'Streak') });
      api.status('');
      resetCards(); lock(false);
      setLine(t('À vous de jouer', 'Your move'), 'even');
      paintScore();
    }

    function bob(el) {
      if (api.reduced || !el.animate) return;
      el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-12px)' }, { transform: 'translateY(0)' }],
        { duration: 180, easing: 'cubic-bezier(.3,.7,.4,1)' });
    }
    function flip(el, html, delay) {
      if (api.reduced || !el.animate) { el.innerHTML = html; return; }
      api.after(delay, () => {
        el.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { duration: 120, easing: 'ease-in' })
          .onfinish = () => {
            el.innerHTML = html;
            el.animate([{ transform: 'rotateY(-90deg)', opacity: .4 }, { transform: 'rotateY(0)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
          };
      });
    }

    function play(m) {
      if (busy || over) return;
      busy = true;
      const g = gen;
      const c = cpuMove();          // décidé avant de connaître le coup (aucune triche)
      lock(true, m);
      resetCards();
      const beat = api.reduced ? 90 : 200;
      const words = [NAMES[0], NAMES[1], NAMES[2]];
      for (let i = 0; i < 3; i++) {
        api.after(i * beat, () => {
          if (g !== gen) return;
          api.sfx('tick');
          setLine(t(words[i][0], words[i][1]) + (i < 2 ? '…' : ''), 'even');
          bob(cardYou); bob(cardCpu);
        });
      }
      api.after(3 * beat, () => { if (g === gen) reveal(m, c, g); });
    }

    function reveal(m, c, g) {
      learn(m);
      cardYou.classList.add('lit'); cardCpu.classList.add('lit');
      flip(gYou, GLYPH[m], 0);
      flip(gCpu, GLYPH[c], api.reduced ? 0 : 60);
      api.after(api.reduced ? 40 : 330, () => {
        if (g !== gen) return;
        if (m === c) {
          ties++; streak = 0;
          setLine(t('Égalité, ' + name(m).toLowerCase() + ' partout', 'Tie, both ' + name(m).toLowerCase()), 'even');
          api.sfx('flip');
        } else if (beats(m, c)) {
          sYou++; streak++; matchBest = Math.max(matchBest, streak);
          cardYou.classList.add('win'); cardCpu.classList.add('lose');
          setLine(t(name(m) + ' bat ' + name(c).toLowerCase(), name(m) + ' beats ' + name(c).toLowerCase()), 'good');
          api.sfx('score');
          api.setBest(streak);
          if (streak >= 5) api.unlock('rps_streak');
        } else {
          sCpu++; streak = 0;
          cardCpu.classList.add('win'); cardYou.classList.add('lose');
          setLine(t(name(c) + ' bat ' + name(m).toLowerCase(), name(c) + ' beats ' + name(m).toLowerCase()), 'bad');
          api.sfx('hit');
        }
        api.hud({ score: streak });
        paintScore();
        if (sYou >= TARGET || sCpu >= TARGET) { over = true; api.after(700, () => { if (g === gen) end(); }); return; }
        busy = false; lock(false);
      });
    }

    function end() {
      const won = sYou > sCpu;
      api.sfx(won ? 'win' : 'lose');
      api.overlay({
        kicker: t('Meilleure série du match : ' + matchBest, 'Best streak this match: ' + matchBest),
        title: won ? t('Match gagné', 'Match won') : t('Match perdu', 'Match lost'),
        text: sYou + ' – ' + sCpu + (ties ? t(' · ' + ties + ' égalité' + (ties > 1 ? 's' : ''), ' · ' + ties + ' tie' + (ties > 1 ? 's' : '')) : ''),
        action: t('Rejouer', 'Play again'),
        tone: won ? 'good' : '',
        onAction: start,
      });
    }

    api.onKey((e) => {
      if (e.repeat) return;
      const i = ['1', '2', '3'].indexOf(e.key);
      if (i >= 0 && !api.stage.querySelector('.g-overlay')) play(i);
    });

    start();
    over = true;   // en attente du panneau d'accueil
    api.overlay({
      title: t('Pierre-feuille-ciseaux', 'Rock paper scissors'),
      text: t(`Premier à ${TARGET} points, visez cinq victoires d'affilée. L'ordinateur prédit vos coups à partir des deux derniers.`,
        `First to ${TARGET} points, aim for five wins in a row. The computer predicts your moves from your last two.`),
      action: t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart: start };
  },
});

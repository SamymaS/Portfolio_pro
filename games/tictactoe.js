/* ==================================================================
   games/tictactoe.js · Morpion
   Les marques se tracent comme au stylo : deux traits pour X, un arc
   pour O. L'IA est un minimax parfait, qui peut se tromper (environ
   une fois sur cinq) sur ses premiers coups : le succès reste à portée.
   ================================================================== */
(function () {
  'use strict';
  let sessionWins = 0, streak = 0, gamesPlayed = 0;   // survivent à la fermeture

  SBG.register('tictactoe', {
    create(api) {
      const { C } = api;
      const W = 480, H = 480, CELL = 128, BS = CELL * 3;
      const OX = (W - BS) / 2, OY = (H - BS) / 2 + 4;
      const cv = api.canvas(W, H);
      const ctx = cv.ctx;
      const fx = api.particles();
      const HUMAN = 1, AI = 2;
      const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
      const MARK_T = 0.32;   // durée du tracé d'une marque

      let board, marks, state, focus, curX, curY, curA, showCursor, winLine, winT, endT, gen, gridT, aiMoves, blundered;

      function cellX(i) { return OX + (i % 3) * CELL + CELL / 2; }
      function cellY(i) { return OY + Math.floor(i / 3) * CELL + CELL / 2; }

      function reset() {
        board = new Array(9).fill(0);
        marks = []; winLine = null; winT = 0; endT = 0;
        focus = 4; curX = cellX(4); curY = cellY(4); curA = 0; showCursor = false;
        aiMoves = 0; blundered = false;
        gridT = api.reduced ? 1 : 0;
        fx.clear();
        gen = (gen || 0) + 1;
        api.hud({ score: sessionWins, scoreLabel: api.t('Victoires', 'Wins') });
      }

      function start() {
        reset();
        gamesPlayed++;
        loop.start();
        const g = gen;
        // laisse la grille se tracer avant le premier coup
        if (gamesPlayed % 2 === 0) { state = 'wait'; api.status(api.t('L\'IA commence', 'The AI starts')); api.after(api.reduced ? 150 : 450, () => { if (g === gen) aiTurn(); }); }
        else playerTurn();
      }

      function playerTurn() {
        state = 'player';
        api.status(api.t('À vous', 'Your turn'));
      }

      function place(i, who) {
        board[i] = who;
        marks.push({ i, who, t: 0 });
        api.sfx(who === HUMAN ? 'move' : 'flip');
        state = 'anim';
        const g = gen;
        // la suite attend la fin du tracé
        api.after(MARK_T * 1000 + 40, () => { if (g === gen) settled(who); });
      }

      function settled(who) {
        const line = winnerLine(board);
        if (line) return finish(who, line);
        if (board.every((v) => v)) return finish(0, null);
        if (who === HUMAN) aiTurn(); else playerTurn();
      }

      function humanPlay(i) {
        if (state !== 'player') return;
        if (board[i]) { api.sfx('error'); return; }
        focus = i;
        place(i, HUMAN);
      }

      function aiTurn() {
        state = 'ai';
        api.status(api.t('L\'IA réfléchit…', 'The AI is thinking…'));
        const g = gen;
        api.after(api.reduced ? 200 : 420, () => {
          if (g !== gen || state !== 'ai') return;
          place(chooseMove(), AI);
          aiMoves++;
        });
      }

      function finish(who, line) {
        state = 'over'; winLine = line; winT = 0; endT = 0;
        const g = gen;
        if (who === HUMAN) {
          sessionWins++; streak++;
          api.hud({ score: sessionWins });
          api.setBest(streak);
          api.unlock('tictac_master');
          api.sfx('win');
          api.status(api.t('Vous gagnez', 'You win'));
          if (!api.reduced) fx.burst(cellX(line[1]), cellY(line[1]), { n: 30, color: [C.cyan, '#fff', C.good], speed: 240, life: 0.85 });
        } else if (who === AI) {
          streak = 0;
          api.sfx('lose'); api.shake(4);
          api.status(api.t('L\'IA gagne', 'The AI wins'));
        } else {
          api.sfx('tick');
          api.status(api.t('Match nul', 'Draw'));
        }
        api.after(api.reduced ? 500 : 1350, () => {
          if (g !== gen) return;
          api.overlay({
            kicker: who === HUMAN ? api.t('Victoire', 'Victory') : '',
            title: who === HUMAN ? api.t('Bien joué', 'Well played') : who === AI ? api.t('L\'IA gagne', 'The AI wins') : api.t('Match nul', 'Draw'),
            text: who === HUMAN
              ? api.t('Vous avez trouvé la faille.', 'You found the gap.')
              : who === AI ? api.t('Bloquez ses diagonales la prochaine fois.', 'Watch the diagonals next time.')
              : api.t('Personne ne cède. Un classique.', 'Nobody gives way. A classic.'),
            action: api.t('Rejouer', 'Play again'),
            tone: who === HUMAN ? 'good' : '',
            onAction: start,
          });
        });
      }

      function winnerLine(b) {
        for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return l;
        return null;
      }

      // ── IA ─────────────────────────────────────────────────────
      const memo = new Map();   // positions déjà évaluées : calcul instantané
      function minimax(b, who) {
        const key = b.join('') + who;
        const hit = memo.get(key);
        if (hit !== undefined) return hit;
        const v = minimaxRaw(b, who);
        memo.set(key, v);
        return v;
      }
      function minimaxRaw(b, who) {
        const l = winnerLine(b);
        // gagner tôt vaut plus : le score dépend des cases encore libres
        if (l) { const e = 1 + b.filter((v) => !v).length; return b[l[0]] === AI ? e : -e; }
        if (b.every((v) => v)) return 0;
        let best = who === AI ? -Infinity : Infinity;
        for (let i = 0; i < 9; i++) {
          if (b[i]) continue;
          b[i] = who;
          const v = minimax(b, who === AI ? HUMAN : AI);
          b[i] = 0;
          best = who === AI ? Math.max(best, v) : Math.min(best, v);
        }
        return best;
      }
      function immediate(b, who) {
        for (let i = 0; i < 9; i++) {
          if (b[i]) continue;
          b[i] = who; const w = winnerLine(b); b[i] = 0;
          if (w) return i;
        }
        return -1;
      }
      function chooseMove() {
        const b = board.slice();
        // plateau vide : coin ou centre, tous deux optimaux (évite la recherche la plus longue)
        if (b.every((v) => !v)) return [0, 2, 4, 6, 8][Math.floor(Math.random() * 5)];
        const scored = [];
        for (let i = 0; i < 9; i++) {
          if (b[i]) continue;
          b[i] = AI; scored.push({ i, v: minimax(b, HUMAN) }); b[i] = 0;
        }
        const top = Math.max(...scored.map((s) => s.v));
        const best = scored.filter((s) => s.v === top);
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)].i;
        // jamais d'erreur quand un gain ou un blocage s'impose
        const forced = immediate(b, AI) >= 0 || immediate(b, HUMAN) >= 0;
        if (!forced && !blundered && aiMoves < 2 && Math.random() < 0.2) {
          const worse = scored.filter((s) => s.v < top);
          if (worse.length) { blundered = true; return pick(worse); }
        }
        return pick(best);
      }

      // ── Boucle ────────────────────────────────────────────────
      const loop = api.loop({
        update(dt) {
          fx.update(dt);
          gridT = Math.min(1, gridT + dt * 2.2);
          for (const m of marks) m.t = Math.min(MARK_T, m.t + dt);
          if (state === 'over') { winT += dt; endT += dt; }
          const k = 1 - Math.exp(-dt * 24);
          curX = api.lerp(curX, cellX(focus), k);
          curY = api.lerp(curY, cellY(focus), k);
          curA = api.clamp(curA + ((state === 'player' && showCursor) ? dt * 7 : -dt * 7), 0, 1);
        },
        render() {
          cv.clear(C.bg);
          ctx.fillStyle = C.grid;
          for (let x = 24; x < W; x += 32) for (let y = 24; y < H; y += 32) ctx.fillRect(x, y, 1.2, 1.2);

          // grille : quatre traits qui se tracent au départ
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 3;
          const gk = api.ease.inOut(gridT);
          for (let n = 1; n <= 2; n++) {
            const x = OX + n * CELL, y = OY + n * CELL;
            const len = (BS - 24) * gk;
            ctx.beginPath(); ctx.moveTo(x, OY + 12); ctx.lineTo(x, OY + 12 + len); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(OX + 12, y); ctx.lineTo(OX + 12 + len, y); ctx.stroke();
          }

          // curseur de case
          if (curA > 0.01) {
            ctx.globalAlpha = curA;
            ctx.strokeStyle = 'rgba(56,189,248,0.55)'; ctx.lineWidth = 1.5;
            api.roundRect(ctx, curX - CELL / 2 + 10, curY - CELL / 2 + 10, CELL - 20, CELL - 20, 16); ctx.stroke();
            ctx.fillStyle = 'rgba(56,189,248,0.05)'; ctx.fill();
            if (!board[focus] && state === 'player') {
              ctx.globalAlpha = curA * 0.22;
              drawX(cellX(focus), cellY(focus), 1);
            }
            ctx.globalAlpha = 1;
          }

          // marques
          const dim = state === 'over' && winLine ? Math.min(1, endT * 2.5) : 0;
          for (const m of marks) {
            const k = m.t / MARK_T;
            const x = cellX(m.i), y = cellY(m.i);
            const inWin = winLine && winLine.includes(m.i);
            ctx.globalAlpha = inWin ? 1 : 1 - dim * 0.6;
            // halo doux
            const rgb = m.who === HUMAN ? '56,189,248' : '210,168,255';
            const g = ctx.createRadialGradient(x, y, 0, x, y, CELL * 0.55);
            g.addColorStop(0, `rgba(${rgb},${0.13 * api.ease.out(k)})`); g.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = g; ctx.fillRect(x - CELL / 2, y - CELL / 2, CELL, CELL);
            if (m.who === HUMAN) drawX(x, y, k); else drawO(x, y, k);
          }
          ctx.globalAlpha = 1;

          // ligne gagnante
          if (winLine) {
            const a = winLine[0], b = winLine[2];
            const x1 = cellX(a), y1 = cellY(a), x2 = cellX(b), y2 = cellY(b);
            const ext = 0.32, dx = (x2 - x1) * ext / 2, dy = (y2 - y1) * ext / 2;
            const sx = x1 - dx, sy = y1 - dy, ex = x2 + dx, ey = y2 + dy;
            const k = api.ease.inOut(Math.min(1, winT / 0.42));
            const pulse = api.reduced ? 1 : 0.8 + 0.2 * Math.sin(winT * 5);
            const col = board[a] === HUMAN ? C.cyan : C.violet;
            const px = api.lerp(sx, ex, k), py = api.lerp(sy, ey, k);
            ctx.strokeStyle = col; ctx.globalAlpha = 0.2 * pulse; ctx.lineWidth = 20;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(px, py); ctx.stroke();
            ctx.globalAlpha = 0.95; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(px, py); ctx.stroke();
            ctx.globalAlpha = 1;
          }

          fx.draw(ctx);
        },
      });

      function drawX(x, y, k) {
        const s = CELL * 0.22;
        const k1 = api.ease.out(api.clamp(k / 0.5, 0, 1)), k2 = api.ease.out(api.clamp((k - 0.5) / 0.5, 0, 1));
        ctx.strokeStyle = C.cyan; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x - s + 2 * s * k1, y - s + 2 * s * k1); ctx.stroke();
        if (k2 > 0) { ctx.beginPath(); ctx.moveTo(x + s, y - s); ctx.lineTo(x + s - 2 * s * k2, y - s + 2 * s * k2); ctx.stroke(); }
      }
      function drawO(x, y, k) {
        const r = CELL * 0.24, a0 = -Math.PI / 2;
        ctx.strokeStyle = C.violet; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, y, r, a0, a0 + Math.PI * 2 * api.ease.out(k)); ctx.stroke();
      }

      // comme cv.toLocal, mais tient compte du letterboxing (object-fit: contain)
      function toLocal(e) {
        const r = cv.el.getBoundingClientRect();
        const s = Math.min(r.width / W, r.height / H) || 1;
        return { x: (e.clientX - r.left - (r.width - W * s) / 2) / s, y: (e.clientY - r.top - (r.height - H * s) / 2) / s };
      }
      // ── Entrées ───────────────────────────────────────────────
      function cellAt(e) {
        const p = toLocal(e);
        const c = Math.floor((p.x - OX) / CELL), r = Math.floor((p.y - OY) / CELL);
        if (c < 0 || c > 2 || r < 0 || r > 2) return -1;
        return r * 3 + c;
      }
      api.on(cv.el, 'pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        const i = cellAt(e);
        if (i < 0) { showCursor = false; return; }
        focus = i; showCursor = true;
      });
      api.on(cv.el, 'pointerleave', () => { showCursor = false; });
      api.on(cv.el, 'click', (e) => {
        const i = cellAt(e);
        if (i >= 0) humanPlay(i);
      });
      const MOVES = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      api.onKey((e) => {
        const m = MOVES[e.key];
        if (m) {
          if (state === 'ready' || state === 'over') return;
          showCursor = true;
          const c = api.clamp((focus % 3) + m[0], 0, 2), r = api.clamp(Math.floor(focus / 3) + m[1], 0, 2);
          focus = r * 3 + c;
          return;
        }
        if (/^[1-9]$/.test(e.key) && state === 'player') { showCursor = true; humanPlay(+e.key - 1); return; }
        if (e.key === 'Enter' || e.key === ' ') {
          if (document.activeElement && document.activeElement.classList.contains('g-btn')) return;
          if (state === 'player') { e.preventDefault(); showCursor = true; humanPlay(focus); }
          else if (state === 'ready') { api.hideOverlay(); start(); }
        }
      });

      // ── Accueil ───────────────────────────────────────────────
      reset(); state = 'ready'; gridT = 1;
      loop.start();
      api.overlay({
        title: api.t('Morpion', 'Tic-tac-toe'),
        text: api.t('Trois alignés. Vous jouez X, l\'IA joue O, et vous commencez à tour de rôle.', 'Three in a row. You play X, the AI plays O, and you take turns starting.'),
        action: api.t('Jouer', 'Play'),
        onAction: start,
      });

      return { restart: start };
    },
  });
})();

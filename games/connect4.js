/* ==================================================================
   games/connect4.js · Puissance 4
   Les jetons tombent avec une vraie gravité et un petit rebond,
   derrière une grille percée (calque pré-rendu). L'IA joue un
   minimax alpha-bêta à profondeur 5, lancé après un court délai
   pour que l'animation et l'état « réfléchit » s'affichent d'abord.
   ================================================================== */
(function () {
  'use strict';
  let sessionWins = 0, streak = 0, gamesPlayed = 0;   // survivent à la fermeture

  SBG.register('connect4', {
    create(api) {
      const { C } = api;
      const COLS = 7, ROWS = 6, CELL = 70;
      const BW = COLS * CELL, BH = ROWS * CELL;
      const W = 560, TOP = 86, BX = (W - BW) / 2, H = TOP + BH + 26;
      const HOLE = CELL * 0.36, DISC = HOLE + 2.5;
      const DEPTH = 5;
      const cv = api.canvas(W, H);
      const ctx = cv.ctx;
      const fx = api.particles();
      const HUMAN = 1, AI = 2;

      // ── Grille percée, dessinée une fois hors écran ────────────
      const panel = document.createElement('canvas');
      panel.width = Math.round(W * cv.dpr); panel.height = Math.round(H * cv.dpr);
      (function buildPanel() {
        const p = panel.getContext('2d');
        p.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
        const g = p.createLinearGradient(0, TOP, 0, TOP + BH);
        g.addColorStop(0, '#141A30'); g.addColorStop(1, '#0E1224');
        p.fillStyle = g;
        api.roundRect(p, BX - 10, TOP - 10, BW + 20, BH + 20, 22); p.fill();
        p.globalCompositeOperation = 'destination-out';
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          p.beginPath(); p.arc(cx(c), cy(r), HOLE, 0, Math.PI * 2); p.fill();
        }
        p.globalCompositeOperation = 'source-over';
        p.strokeStyle = 'rgba(255,255,255,0.07)'; p.lineWidth = 1;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          p.beginPath(); p.arc(cx(c), cy(r), HOLE + 0.5, 0, Math.PI * 2); p.stroke();
        }
        p.strokeStyle = 'rgba(255,255,255,0.09)';
        api.roundRect(p, BX - 9.5, TOP - 9.5, BW + 19, BH + 19, 22); p.stroke();
      })();

      function cx(c) { return BX + c * CELL + CELL / 2; }
      function cy(r) { return TOP + r * CELL + CELL / 2; }

      let board, discs, state, turn, sel, ghostX, ghostA, winLine, winT, gen, moves, hoverOn, endT;

      function reset() {
        board = new Array(COLS * ROWS).fill(0);
        discs = []; winLine = null; winT = 0; moves = 0; endT = 0;
        sel = 3; ghostX = cx(3); ghostA = 0; hoverOn = true;
        fx.clear();
        gen = (gen || 0) + 1;
        api.hud({ score: sessionWins, scoreLabel: api.t('Victoires', 'Wins') });
      }

      function start() {
        reset();
        gamesPlayed++;
        const aiFirst = gamesPlayed % 2 === 0;
        loop.start();
        if (aiFirst) aiTurn(); else playerTurn();
      }

      function playerTurn() {
        state = 'player'; turn = HUMAN;
        api.status(api.t('À vous', 'Your turn'));
      }

      // ── Coups ──────────────────────────────────────────────────
      function landingRow(b, c) {
        for (let r = ROWS - 1; r >= 0; r--) if (!b[r * COLS + c]) return r;
        return -1;
      }

      function play(c, who) {
        const r = landingRow(board, c);
        if (r < 0) return false;
        board[r * COLS + c] = who;
        moves++;
        discs.push({ c, r, who, y: TOP - CELL * 0.62, vy: 0, done: false, bounced: 0, glow: 0 });
        state = 'anim';
        return true;
      }

      function humanDrop(c) {
        if (state !== 'player') return;
        if (landingRow(board, c) < 0) { api.sfx('error'); return; }
        sel = c;
        play(c, HUMAN);
      }

      // appelé quand le dernier jeton s'est posé
      function settled(d) {
        const line = winningLine(board, d.r * COLS + d.c, d.who);
        if (line) return finish(d.who, line);
        if (moves === COLS * ROWS) return finish(0, null);
        if (d.who === HUMAN) aiTurn(); else playerTurn();
      }

      function aiTurn() {
        state = 'ai'; turn = AI;
        api.status(api.t('L\'IA réfléchit…', 'The AI is thinking…'));
        const g = gen, t0 = performance.now();
        // laisse une image s'afficher avant le calcul
        api.after(40, () => {
          if (g !== gen) return;
          const c = bestMove(board);
          const wait = Math.max(0, 320 - (performance.now() - t0));
          api.after(wait, () => { if (g === gen && state === 'ai') play(c, AI); });
        });
      }

      function finish(who, line) {
        state = 'over'; endT = 0;
        winLine = line; winT = 0;
        const g = gen;
        if (who === HUMAN) {
          sessionWins++; streak++;
          api.hud({ score: sessionWins });
          api.setBest(streak);
          api.unlock('champion');
          api.sfx('win');
          api.status(api.t('Vous gagnez', 'You win'));
          const a = line[0], b = line[3];
          const mx = (cx(a % COLS) + cx(b % COLS)) / 2, my = (cy(Math.floor(a / COLS)) + cy(Math.floor(b / COLS))) / 2;
          if (!api.reduced) fx.burst(mx, my, { n: 34, color: [C.cyan, '#fff', C.good], speed: 260, life: 0.9 });
        } else if (who === AI) {
          streak = 0;
          api.sfx('lose');
          api.shake(5);
          api.status(api.t('L\'IA gagne', 'The AI wins'));
        } else {
          api.sfx('tick');
          api.status(api.t('Match nul', 'Draw'));
        }
        api.after(api.reduced ? 600 : 1700, () => {
          if (g !== gen) return;
          api.overlay({
            kicker: who === HUMAN ? api.t('Victoire', 'Victory') : '',
            title: who === HUMAN ? api.t('Bien joué', 'Well played') : who === AI ? api.t('L\'IA gagne', 'The AI wins') : api.t('Match nul', 'Draw'),
            text: who === 0
              ? api.t('La grille est pleine.', 'The board is full.')
              : api.t('Quatre alignés en ' + Math.ceil(moves / 2) + ' coups.', 'Four in a row in ' + Math.ceil(moves / 2) + ' moves.'),
            action: api.t('Rejouer', 'Play again'),
            tone: who === HUMAN ? 'good' : '',
            onAction: start,
          });
        });
      }

      // ── Détection de victoire ─────────────────────────────────
      const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
      function winningLine(b, idx, p) {
        const r0 = Math.floor(idx / COLS), c0 = idx % COLS;
        for (const [dr, dc] of DIRS) {
          const cells = [idx];
          for (let s = -1; s <= 1; s += 2) {
            let r = r0 + dr * s, c = c0 + dc * s;
            while (r >= 0 && r < ROWS && c >= 0 && c < COLS && b[r * COLS + c] === p) {
              if (s < 0) cells.unshift(r * COLS + c); else cells.push(r * COLS + c);
              r += dr * s; c += dc * s;
            }
          }
          if (cells.length >= 4) {
            // garde les quatre jetons qui encadrent le dernier posé
            const i = cells.indexOf(idx);
            const from = Math.max(0, Math.min(i, cells.length - 4));
            return cells.slice(from, from + 4);
          }
        }
        return null;
      }

      // ── IA : minimax alpha-bêta ───────────────────────────────
      const WINDOWS = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const [dr, dc] of DIRS) {
        const er = r + dr * 3, ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        WINDOWS.push([0, 1, 2, 3].map((k) => (r + dr * k) * COLS + (c + dc * k)));
      }
      const ORDER = [3, 2, 4, 1, 5, 0, 6];

      function evaluate(b) {
        let s = 0;
        for (let r = 0; r < ROWS; r++) {
          if (b[r * COLS + 3] === AI) s += 3; else if (b[r * COLS + 3] === HUMAN) s -= 3;
        }
        for (const w of WINDOWS) {
          let a = 0, h = 0;
          for (let k = 0; k < 4; k++) { const v = b[w[k]]; if (v === AI) a++; else if (v === HUMAN) h++; }
          if (a && h) continue;
          if (a === 3) s += 5; else if (a === 2) s += 2;
          if (h === 3) s -= 6; else if (h === 2) s -= 2;
        }
        return s;
      }

      function search(b, depth, alpha, beta, who, empty) {
        if (empty === 0) return 0;
        if (depth === 0) return evaluate(b);
        const other = who === AI ? HUMAN : AI;
        let best = who === AI ? -Infinity : Infinity;
        for (const c of ORDER) {
          const r = landingRow(b, c);
          if (r < 0) continue;
          const idx = r * COLS + c;
          b[idx] = who;
          let v;
          if (winningLine(b, idx, who)) v = (who === AI ? 1 : -1) * (100000 + depth);
          else v = search(b, depth - 1, alpha, beta, other, empty - 1);
          b[idx] = 0;
          if (who === AI) { if (v > best) best = v; if (best > alpha) alpha = best; }
          else { if (v < best) best = v; if (best < beta) beta = best; }
          if (alpha >= beta) break;
        }
        return best;
      }

      function bestMove(src) {
        const b = src.slice();
        const empty = b.filter((v) => !v).length;
        let best = -Infinity, picks = [];
        for (const c of ORDER) {
          const r = landingRow(b, c);
          if (r < 0) continue;
          const idx = r * COLS + c;
          b[idx] = AI;
          const v = winningLine(b, idx, AI) ? 1e6 : search(b, DEPTH - 1, -Infinity, Infinity, HUMAN, empty - 1);
          b[idx] = 0;
          if (v > best) { best = v; picks = [c]; } else if (v === best) picks.push(c);
        }
        // parmi les coups équivalents, un peu de variété (centre favorisé par l'ordre)
        return picks.length > 1 && Math.random() < 0.35 ? picks[1 + Math.floor(Math.random() * (picks.length - 1))] : picks[0];
      }

      // ── Boucle ────────────────────────────────────────────────
      const G = 3800;
      const loop = api.loop({
        update(dt) {
          fx.update(dt);
          if (state === 'over') { winT += dt; endT += dt; }
          // jeton fantôme : suit la colonne choisie
          ghostX = api.lerp(ghostX, cx(sel), 1 - Math.exp(-dt * 22));
          const showGhost = state === 'player' && hoverOn;
          ghostA = api.clamp(ghostA + (showGhost ? dt * 6 : -dt * 8), 0, 1);

          for (const d of discs) {
            if (d.glow > 0) d.glow = Math.max(0, d.glow - dt * 2.2);
            if (d.done) continue;
            const ty = cy(d.r);
            d.vy += G * dt;
            d.y += d.vy * dt;
            if (d.y >= ty) {
              d.y = ty;
              if (d.bounced === 0) {
                api.sfx('drop');
                d.glow = 1;
              }
              if (d.bounced < 2 && d.vy > 420 && !api.reduced) {
                d.vy = -d.vy * (d.bounced === 0 ? 0.24 : 0.18);
                d.bounced++;
              } else {
                d.vy = 0; d.done = true;
                if (state === 'anim') settled(d);
              }
            }
          }
        },
        render() {
          cv.clear(C.bg);
          // grille de fond très discrète
          ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
          ctx.beginPath();
          for (let x = 20; x < W; x += 28) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
          for (let y = 20; y < H; y += 28) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
          ctx.stroke();

          // colonne survolée
          if (state === 'player' && ghostA > 0) {
            ctx.globalAlpha = ghostA * 0.6;
            const grad = ctx.createLinearGradient(0, TOP, 0, TOP + BH);
            grad.addColorStop(0, 'rgba(56,230,255,0.10)'); grad.addColorStop(1, 'rgba(56,230,255,0.02)');
            ctx.fillStyle = grad;
            api.roundRect(ctx, ghostX - CELL / 2 + 3, TOP - 6, CELL - 6, BH + 12, 14); ctx.fill();
            ctx.globalAlpha = 1;
          }

          // jetons (derrière la grille percée)
          const dim = state === 'over' && winLine ? Math.min(1, endT * 2.5) : 0;
          for (const d of discs) {
            const isWin = winLine && winLine.includes(d.r * COLS + d.c);
            ctx.globalAlpha = isWin ? 1 : 1 - dim * 0.55;
            drawDisc(cx(d.c), d.y, d.who, DISC);
          }
          ctx.globalAlpha = 1;
          ctx.drawImage(panel, 0, 0, W, H);

          // halo bref à l'impact, au-dessus de la grille
          for (const d of discs) {
            if (d.glow <= 0) continue;
            const x = cx(d.c), y = cy(d.r), R = CELL * 0.75;
            const g = ctx.createRadialGradient(x, y, HOLE * 0.8, x, y, R);
            const rgb = d.who === HUMAN ? '56,230,255' : '176,124,255';
            g.addColorStop(0, `rgba(${rgb},${0.28 * d.glow})`); g.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
          }

          // jeton fantôme au-dessus de la colonne
          if (ghostA > 0.01) {
            const full = landingRow(board, sel) < 0;
            ctx.globalAlpha = ghostA * (full ? 0.25 : 0.9);
            drawDisc(ghostX, TOP - CELL * 0.62, HUMAN, DISC * 0.92);
            // point d'arrivée
            const lr = landingRow(board, sel);
            if (lr >= 0) {
              ctx.globalAlpha = ghostA * 0.5;
              ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.5;
              ctx.setLineDash([3, 5]);
              ctx.beginPath(); ctx.arc(cx(sel), cy(lr), HOLE - 4, 0, Math.PI * 2); ctx.stroke();
              ctx.setLineDash([]);
            }
            ctx.globalAlpha = 1;
          }

          // ligne gagnante
          if (winLine) {
            const a = winLine[0], b = winLine[3];
            const x1 = cx(a % COLS), y1 = cy(Math.floor(a / COLS));
            const x2 = cx(b % COLS), y2 = cy(Math.floor(b / COLS));
            const k = api.ease.out(Math.min(1, winT / 0.45));
            const pulse = api.reduced ? 1 : 0.75 + 0.25 * Math.sin(winT * 5);
            const col = board[a] === HUMAN ? C.cyan : C.violet;
            ctx.lineCap = 'round';
            ctx.strokeStyle = col; ctx.globalAlpha = 0.22 * pulse; ctx.lineWidth = 22;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(api.lerp(x1, x2, k), api.lerp(y1, y2, k)); ctx.stroke();
            ctx.globalAlpha = 0.95; ctx.lineWidth = 5; ctx.strokeStyle = '#fff';
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(api.lerp(x1, x2, k), api.lerp(y1, y2, k)); ctx.stroke();
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = col; ctx.lineWidth = 2.5;
            for (const i of winLine) {
              ctx.beginPath(); ctx.arc(cx(i % COLS), cy(Math.floor(i / COLS)), HOLE + 4 + 2 * pulse, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }

          // indicateur de tour, en haut à gauche
          if (state !== 'over' && state !== 'ready') {
            const who = state === 'player' || (state === 'anim' && turn === HUMAN) ? HUMAN : AI;
            ctx.font = `600 13px ${api.font}`;
            ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
            ctx.fillStyle = who === HUMAN ? C.cyan : C.violet;
            ctx.beginPath(); ctx.arc(BX + 2, 22, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.muted;
            ctx.fillText(who === HUMAN ? api.t('Vous', 'You') : api.t('IA', 'AI'), BX + 13, 22.5);
            if (state === 'ai') {
              const t = performance.now() / 1000;
              for (let i = 0; i < 3; i++) {
                ctx.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(t * 6 - i * 0.7));
                ctx.fillStyle = C.violet;
                ctx.beginPath(); ctx.arc(BX + 36 + i * 9, 23, 2.2, 0, Math.PI * 2); ctx.fill();
              }
              ctx.globalAlpha = 1;
            }
          }

          fx.draw(ctx);
        },
      });

      function drawDisc(x, y, who, R) {
        const base = who === HUMAN ? C.cyan : C.violet;
        const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
        if (who === HUMAN) { g.addColorStop(0, '#9FF3FF'); g.addColorStop(0.55, base); g.addColorStop(1, '#1BA9C4'); }
        else { g.addColorStop(0, '#D9C2FF'); g.addColorStop(0.55, base); g.addColorStop(1, '#7E4FD6'); }
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(7,9,18,0.22)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, R * 0.66, 0, Math.PI * 2); ctx.stroke();
      }

      // ── Entrées ───────────────────────────────────────────────
      function colAt(e) {
        const p = cv.toLocal(e.clientX, e.clientY);
        return api.clamp(Math.floor((p.x - BX) / CELL), 0, COLS - 1);
      }
      api.on(cv.el, 'pointermove', (e) => {
        hoverOn = true;
        const c = colAt(e);
        if (c !== sel && state === 'player') api.sfx('tick');
        sel = c;
      });
      api.on(cv.el, 'click', (e) => { hoverOn = true; humanDrop(colAt(e)); });
      api.onKey((e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          if (state === 'over' || state === 'ready') return;
          hoverOn = true;
          sel = api.clamp(sel + (e.key === 'ArrowLeft' ? -1 : 1), 0, COLS - 1);
          if (state === 'player') api.sfx('tick');
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          if (state === 'player') { e.preventDefault(); humanDrop(sel); }
          // sur l'écran d'accueil, le bouton du panneau a le focus et gère Entrée lui-même
          else if (state === 'ready' && !(document.activeElement && document.activeElement.classList.contains('g-btn'))) { api.hideOverlay(); start(); }
        }
      });

      // ── Accueil ───────────────────────────────────────────────
      reset(); state = 'ready';
      loop.start();
      api.overlay({
        title: api.t('Puissance 4', 'Connect Four'),
        text: api.t('Alignez quatre jetons avant l\'IA. Vous jouez en cyan.', 'Line up four discs before the AI. You play cyan.'),
        action: api.t('Jouer', 'Play'),
        onAction: start,
      });

      return { restart: start };
    },
  });
})();

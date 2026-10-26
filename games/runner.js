/* ==================================================================
   games/runner.js · Course
   Un coureur sans fin en pixel art façon Minecraft. Le personnage
   (inspiré du skin du propriétaire) saute par-dessus des cactus et
   des blocs de TNT, et se baisse sous les phantoms.
   Tout le décor est pré-rendu une seule fois (ciel, étoiles, collines,
   bande de sol), puis simplement défilé avec drawImage. Les sprites
   aussi : la boucle ne fait que copier des images.
   Saut à hauteur variable, tampon de saut et temps « coyote » pour
   que les commandes restent justes, boîtes de collision un peu
   plus petites que le dessin.
   ================================================================== */
SBG.register('runner', {
  create(api) {
    const { C } = api;
    const W = 640, H = 260;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const dpr = cv.dpr;
    ctx.imageSmoothingEnabled = false;
    cv.el.style.touchAction = 'none';

    const GROUND = 212;           // haut de la ligne d'herbe
    const BLOCK = 16;             // un bloc = 16 px, un texel = 1 px
    const PX = 72;                // abscisse du coureur
    const U = 2;                  // taille d'un « pixel » du personnage

    // physique (px, px/s)
    const GRAV = 2700, JUMP_V = -575, JUMP_CUT = -250, HOLD_MAX = 0.2, HOLD_GRAV = 0.45;
    const FAST_FALL = 2.8, COYOTE = 0.08, BUFFER = 0.12;
    const SPEED0 = 300, SPEED_MAX = 640;
    const METERS = 25;            // px parcourus par point

    const MANY = api.reduced ? 0.35 : 1;

    /* ── Utilitaires de pré-rendu ────────────────────────────────── */
    function layer(w, h) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.imageSmoothingEnabled = false;
      return { c, g, w, h };
    }
    // générateur pseudo-aléatoire à graine : le décor reste identique d'une partie à l'autre
    function rng(seed) {
      let a = seed >>> 0;
      return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    // bruit périodique sur la largeur W : les tuiles se raccordent sans couture
    function wave(x, parts) {
      let v = 0;
      for (const p of parts) v += p[0] * Math.sin((x / W) * Math.PI * 2 * p[1] + p[2]);
      return v;
    }
    const snap = (v) => Math.round(v * dpr) / dpr;

    /* ── Décor ───────────────────────────────────────────────────── */
    const sky = layer(W, H);
    {
      const g = sky.g;
      const grad = g.createLinearGradient(0, 0, 0, GROUND);
      grad.addColorStop(0, C.bg); grad.addColorStop(1, '#101C2E');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      // lune carrée, façon Minecraft
      const mx = 452, my = 38, ms = 22;
      g.fillStyle = 'rgba(210,168,255,0.10)'; g.fillRect(mx - 6, my - 6, ms + 12, ms + 12);
      g.fillStyle = 'rgba(210,168,255,0.06)'; g.fillRect(mx - 12, my - 12, ms + 24, ms + 24);
      g.fillStyle = '#E8E3F5'; g.fillRect(mx, my, ms, ms);
      g.fillStyle = '#C9C1DE';
      g.fillRect(mx + 4, my + 5, 5, 4); g.fillRect(mx + 13, my + 12, 6, 5); g.fillRect(mx + 6, my + 15, 3, 3); g.fillRect(mx + 15, my + 3, 3, 3);
      g.fillStyle = '#B3A9CC'; g.fillRect(mx, my + ms - 2, ms, 2); g.fillRect(mx + ms - 2, my, 2, ms);
    }

    const stars = layer(W, GROUND);
    {
      const g = stars.g, r = rng(7);
      for (let i = 0; i < 70; i++) {
        const x = Math.floor(r() * W), y = Math.floor(r() * (GROUND - 70));
        const big = r() < 0.15;
        g.globalAlpha = 0.25 + r() * 0.5;
        g.fillStyle = r() < 0.2 ? C.cyan : r() < 0.3 ? C.violet : C.ink;
        g.fillRect(x, y, big ? 2 : 1, big ? 2 : 1);
        if (big && r() < 0.5) { g.globalAlpha *= 0.4; g.fillRect(x - 1, y + 0.5, 4, 1); g.fillRect(x + 0.5, y - 1, 1, 4); }
      }
      g.globalAlpha = 1;
    }

    // collines lointaines : colonnes de 8 px, bleu très sourd
    const far = layer(W, GROUND);
    {
      const g = far.g;
      const parts = [[18, 2, 0.4], [10, 5, 1.7], [5, 11, 2.9]];
      for (let x = 0; x < W; x += 8) {
        const top = Math.round((GROUND - 70 + wave(x, parts)) / 4) * 4;
        g.fillStyle = '#122039'; g.fillRect(x, top, 8, GROUND - top);
        g.fillStyle = '#18294A'; g.fillRect(x, top, 8, 2);
      }
    }

    // collines proches : blocs de 16 px et quelques chênes en silhouette
    const near = layer(W, GROUND);
    {
      const g = near.g, r = rng(21);
      const parts = [[14, 3, 2.2], [8, 7, 0.3], [4, 13, 4.1]];
      const tops = [];
      for (let x = 0; x < W; x += BLOCK) {
        const top = Math.round((GROUND - 30 + wave(x, parts)) / 8) * 8;
        tops.push(top);
        g.fillStyle = '#0F1B26'; g.fillRect(x, top, BLOCK, GROUND - top);
        g.fillStyle = '#16301F'; g.fillRect(x, top, BLOCK, 3);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        for (let i = 0; i < 4; i++) g.fillRect(x + Math.floor(r() * 15), top + 6 + Math.floor(r() * (GROUND - top - 6)), 2, 2);
      }
      for (let i = 0; i < tops.length; i += 1) {
        if (r() > 0.22) continue;
        const x = i * BLOCK + 4, top = tops[i];
        g.fillStyle = '#1A140F'; g.fillRect(x + 3, top - 14, 3, 14);
        g.fillStyle = '#123321'; g.fillRect(x - 4, top - 30, 17, 17);
        g.fillStyle = '#17402A'; g.fillRect(x - 4, top - 30, 17, 3); g.fillRect(x - 1, top - 35, 11, 5);
        g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 7, top - 24, 3, 3); g.fillRect(x - 1, top - 20, 3, 3);
      }
    }

    // bande de sol répétable : herbe, puis terre qui s'assombrit
    const TILE = 256;
    const GROUND_TOP = 6;          // marge au-dessus pour les touffes d'herbe
    const ground = layer(TILE, H - GROUND + GROUND_TOP);
    {
      const g = ground.g, r = rng(3);
      const oy = GROUND_TOP;
      const dirt = ['#6B4A2B', '#5C3F24', '#7A5634', '#4F361F'];
      const grass = ['#3FB950', '#2EA043', '#56D364', '#238636'];
      for (let bx = 0; bx < TILE; bx += BLOCK) {
        for (let row = 0; row < 3; row++) {
          const by = oy + row * BLOCK;
          for (let y = 0; y < BLOCK; y++) for (let x = 0; x < BLOCK; x++) {
            const v = r();
            g.fillStyle = dirt[v < 0.55 ? 0 : v < 0.78 ? 1 : v < 0.93 ? 2 : 3];
            g.fillRect(bx + x, by + y, 1, 1);
          }
          if (row === 0) {
            // dessus d'herbe avec coulures irrégulières
            for (let x = 0; x < BLOCK; x++) {
              const drip = 3 + (r() < 0.45 ? 1 : 0) + (r() < 0.2 ? 2 : 0);
              for (let y = 0; y < drip; y++) {
                const v = r();
                g.fillStyle = y === 0 ? (v < 0.6 ? '#56D364' : '#3FB950') : grass[v < 0.5 ? 1 : v < 0.8 ? 0 : 3];
                g.fillRect(bx + x, by + y, 1, 1);
              }
            }
          }
        }
        // touffes et fleurs au-dessus de la ligne d'herbe
        if (r() < 0.5) {
          const x = bx + 2 + Math.floor(r() * 12);
          g.fillStyle = '#2EA043'; g.fillRect(x, oy - 2, 1, 2); g.fillRect(x + 2, oy - 3, 1, 3); g.fillRect(x + 1, oy - 1, 1, 1);
        }
        if (r() < 0.14) {
          const x = bx + 3 + Math.floor(r() * 10);
          g.fillStyle = '#238636'; g.fillRect(x, oy - 3, 1, 3);
          g.fillStyle = r() < 0.5 ? C.bad : '#F2CC60'; g.fillRect(x - 1, oy - 5, 3, 2);
        }
      }
      // la terre plonge dans l'ombre vers le bas
      g.fillStyle = 'rgba(13,17,23,0.35)'; g.fillRect(0, oy + BLOCK, TILE, BLOCK);
      g.fillStyle = 'rgba(13,17,23,0.7)'; g.fillRect(0, oy + BLOCK * 2, TILE, BLOCK);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, oy + BLOCK, TILE, 1);
    }

    /* ── Sprites ─────────────────────────────────────────────────── */
    const SK = {
      hair: '#2A1B12', hairHi: '#47301F', skin: '#C99566', skinSh: '#A8774D', glass: '#0A0D12', shine: '#7DD3FC',
      mouth: '#7A4A33', navy: '#1F2E57', navyDk: '#151F3D', navyLt: '#2B3F75', string: '#C9D1D9',
      grey: '#7D8591', greyDk: '#59616D', shoe: C.cyan, shoeDk: '#1C8EC4', sole: '#E6EDF3',
    };

    function sprite(wu, hu, draw) {
      const L = layer(wu * U, hu * U);
      const r = (x, y, w, h, col) => { L.g.fillStyle = col; L.g.fillRect(x * U, y * U, w * U, h * U); };
      draw(r);
      return L;
    }
    // tête de profil, tournée vers la droite (8 x 8 unités, nez en plus)
    function head(r, ox, oy) {
      r(ox, oy, 8, 8, SK.skin);
      r(ox, oy, 8, 2, SK.hair); r(ox + 2, oy, 3, 1, SK.hairHi);
      r(ox, oy + 2, 3, 4, SK.hair); r(ox, oy + 6, 2, 1, SK.hair);
      r(ox + 5, oy + 2, 3, 1, SK.hair);
      r(ox + 3, oy + 4, 1, 2, SK.skinSh);                 // oreille
      r(ox + 4, oy + 3, 1, 1, SK.glass);                  // branche des lunettes
      r(ox + 5, oy + 3, 3, 2, SK.glass);                  // verre
      r(ox + 6, oy + 3, 1, 1, SK.shine);                  // reflet
      r(ox + 8, oy + 4, 1, 1, SK.skin);                   // nez
      r(ox + 6, oy + 6, 2, 1, SK.mouth);
      r(ox + 2, oy + 7, 6, 1, SK.skinSh);
    }
    function torso(r, ox, oy) {
      r(ox, oy, 5, 6, SK.navy);
      r(ox, oy, 1, 6, SK.navyDk);
      r(ox - 1, oy, 2, 2, SK.navyDk);                     // capuche
      r(ox + 4, oy + 1, 1, 2, SK.string);                 // cordon
      r(ox, oy + 5, 5, 1, SK.navyDk);
    }
    function shoe(r, x, y, w, back) {
      r(x, y, w, 1, back ? SK.shoeDk : SK.shoe);
      r(x, y + 1, w, 1, SK.sole);
    }

    const PW = 13, PH = 20;       // sprite debout, en unités
    const runA = sprite(PW, PH, (r) => {
      // jambe arrière tendue en arrière, jambe avant en avant
      r(2, 14, 2, 2, SK.greyDk); r(1, 16, 2, 2, SK.greyDk); shoe(r, 0, 18, 3, true);
      head(r, 2, 0); torso(r, 3, 8);
      r(6, 14, 2, 4, SK.grey); shoe(r, 6, 18, 4, false);
      r(3, 14, 3, 1, SK.grey);
      r(4, 9, 2, 3, SK.navyLt); r(3, 12, 2, 1, SK.navyLt); r(2, 13, 2, 1, SK.skin);  // bras en arrière
    });
    const runB = sprite(PW, PH, (r) => {
      // jambes croisées, pied arrière relevé
      r(3, 14, 2, 3, SK.greyDk); r(2, 16, 2, 1, SK.greyDk); shoe(r, 1, 16, 2, true);
      head(r, 2, 0); torso(r, 3, 8);
      r(5, 14, 2, 4, SK.grey); shoe(r, 5, 18, 4, false);
      r(4, 9, 2, 3, SK.navyLt); r(6, 11, 2, 2, SK.navyLt); r(8, 12, 1, 2, SK.skin);  // bras en avant
    });
    const jumpS = sprite(PW, PH, (r) => {
      r(2, 14, 2, 3, SK.greyDk); shoe(r, 1, 17, 3, true);
      head(r, 2, 0); torso(r, 3, 8);
      r(5, 14, 3, 2, SK.grey); r(7, 15, 2, 2, SK.grey); shoe(r, 7, 17, 4, false);
      r(6, 8, 2, 2, SK.navyLt); r(8, 7, 2, 2, SK.navyLt); r(10, 6, 1, 2, SK.skin);   // bras levé
    });
    const DW = 17, DH = 13;       // sprite accroupi
    function duckFrame(alt) {
      return sprite(DW, DH, (r) => {
        r(1, 4, 8, 5, SK.navy); r(1, 4, 8, 1, SK.navyDk); r(0, 4, 2, 3, SK.navyDk);
        r(1, 8, 8, 1, SK.navyDk);
        head(r, 8, 2);
        if (alt) {
          r(1, 9, 3, 2, SK.greyDk); shoe(r, 0, 11, 3, true);
          r(5, 9, 3, 2, SK.grey); shoe(r, 6, 11, 4, false);
        } else {
          r(2, 9, 3, 2, SK.greyDk); shoe(r, 2, 11, 3, true);
          r(5, 9, 2, 2, SK.grey); shoe(r, 4, 11, 4, false);
        }
        r(6, 6, 3, 2, SK.navyLt); r(9, 9, 2, 1, SK.skin);
      });
    }
    const duckA = duckFrame(false), duckB = duckFrame(true);
    const deadS = sprite(PW, PH, (r) => {
      // surpris : bras en l'air, bouche ouverte
      r(2, 14, 2, 4, SK.greyDk); shoe(r, 1, 18, 3, true);
      head(r, 2, 0); torso(r, 3, 8);
      r(8, 6, 2, 1, '#3B1F14'); r(8, 7, 1, 1, '#3B1F14');
      r(5, 14, 2, 4, SK.grey); shoe(r, 5, 18, 4, false);
      r(6, 8, 2, 2, SK.navyLt); r(8, 7, 2, 2, SK.navyLt); r(10, 5, 1, 3, SK.skin);
    });
    // silhouette rouge pour le flash de collision
    function tint(src, col) {
      const L = layer(src.w, src.h);
      L.g.drawImage(src.c, 0, 0, src.w, src.h);
      L.g.globalCompositeOperation = 'source-atop';
      L.g.fillStyle = col; L.g.fillRect(0, 0, src.w, src.h);
      return L;
    }
    const deadFlash = tint(deadS, C.bad);

    // cactus : bloc de base et bloc de sommet (texels de 1 px)
    function cactusBlock(top) {
      const L = layer(BLOCK, BLOCK), g = L.g;
      g.fillStyle = '#1F7A33'; g.fillRect(1, 0, 14, 16);
      g.fillStyle = '#2EA043'; for (let x = 2; x < 14; x += 4) g.fillRect(x, 0, 2, 16);
      g.fillStyle = '#145C25'; g.fillRect(1, 0, 1, 16); g.fillRect(14, 0, 1, 16);
      g.fillStyle = '#56D364'; g.fillRect(3, 0, 1, 16);
      // épines
      g.fillStyle = '#0D1117';
      g.fillRect(0, 3, 1, 1); g.fillRect(15, 6, 1, 1); g.fillRect(0, 11, 1, 1); g.fillRect(15, 13, 1, 1);
      g.fillStyle = '#B7E4C0'; g.fillRect(6, 4, 1, 1); g.fillRect(10, 9, 1, 1); g.fillRect(7, 13, 1, 1);
      if (top) {
        g.fillStyle = '#3FB950'; g.fillRect(1, 0, 14, 2);
        g.fillStyle = '#56D364'; g.fillRect(3, 0, 10, 1);
        g.fillStyle = '#145C25'; g.fillRect(1, 2, 14, 1);
      }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(1, 15, 14, 1);
      return L;
    }
    const cactusMid = cactusBlock(false), cactusTop = cactusBlock(true);

    const tnt = layer(BLOCK, BLOCK);
    {
      const g = tnt.g;
      g.fillStyle = '#C9372C'; g.fillRect(0, 0, 16, 16);
      g.fillStyle = '#A82A21'; for (let x = 1; x < 16; x += 3) g.fillRect(x, 0, 1, 16);
      g.fillStyle = '#E6EDF3'; g.fillRect(0, 5, 16, 6);
      g.fillStyle = '#8B949E'; g.fillRect(0, 10, 16, 1);
      // « TNT » en lettres de 3 x 4
      g.fillStyle = '#0D1117';
      const T = (x) => { g.fillRect(x, 6, 3, 1); g.fillRect(x + 1, 7, 1, 3); };
      T(2); T(11);
      g.fillRect(6, 6, 1, 4); g.fillRect(9, 6, 1, 4); g.fillRect(7, 7, 1, 1); g.fillRect(8, 8, 1, 1);
      g.fillStyle = '#E8564B'; g.fillRect(0, 0, 16, 1);
      g.fillStyle = '#3A2A20'; g.fillRect(7, 0, 2, 1);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 15, 16, 1);
    }

    // phantom : deux battements d'ailes
    const PHW = 36, PHH = 20;
    function phantomFrame(up) {
      const L = layer(PHW, PHH), g = L.g;
      g.setTransform(-dpr, 0, 0, dpr, PHW * dpr, 0);     // dessiné vers la droite, puis retourné : il fonce sur le joueur
      const body = '#41507A', dark = '#28324F', light = '#6A7DB0';
      const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      // aile : membrane en escalier, bord d'attaque clair
      if (up) {
        R(11, 7, 13, 2, dark); R(12, 5, 10, 2, dark); R(13, 3, 7, 2, dark); R(14, 1, 4, 2, dark); R(15, 0, 2, 1, dark);
        R(17, 1, 1, 2, light); R(19, 3, 1, 2, light); R(21, 5, 1, 2, light); R(23, 7, 1, 1, light);
      } else {
        R(11, 14, 13, 2, dark); R(12, 16, 9, 2, dark); R(14, 18, 5, 2, dark);
        R(20, 16, 1, 2, light); R(18, 18, 1, 2, light); R(23, 14, 1, 2, light);
      }
      // queue effilée
      R(4, 10, 6, 4, body); R(1, 11, 4, 2, dark); R(0, 12, 2, 1, dark);
      // corps
      R(9, 9, 18, 6, body); R(9, 9, 18, 1, light); R(9, 14, 18, 1, dark);
      R(13, 11, 2, 1, dark); R(18, 11, 2, 1, dark);
      // tête et yeux verts
      R(26, 8, 9, 8, body); R(26, 8, 9, 1, light); R(26, 15, 9, 1, dark);
      R(28, 10, 7, 3, 'rgba(63,185,80,0.35)');
      R(29, 10, 2, 2, '#7EE787'); R(32, 10, 2, 2, '#7EE787');
      R(28, 14, 6, 1, dark);
      return L;
    }
    const phantomUp = phantomFrame(true), phantomDown = phantomFrame(false);

    /* ── Débris carrés (réserve fixe, aucune allocation en jeu) ──── */
    const DEBRIS = 64;
    const debris = [];
    for (let i = 0; i < DEBRIS; i++) debris.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, s: 2, life: 0, max: 1, col: C.ink, g: 0, ground: true });
    let debrisNext = 0;
    function emit(x, y, n, o) {
      n = Math.max(1, Math.round(n * MANY));
      for (let i = 0; i < n; i++) {
        const d = debris[debrisNext]; debrisNext = (debrisNext + 1) % DEBRIS;
        const a = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * o.spread : Math.random() * Math.PI * 2;
        const v = o.speed * (0.35 + Math.random() * 0.65);
        d.on = true; d.x = x; d.y = y; d.vx = Math.cos(a) * v + (o.vx || 0); d.vy = Math.sin(a) * v;
        d.s = o.size * (0.6 + Math.random() * 0.8); d.life = d.max = o.life * (0.7 + Math.random() * 0.6);
        d.col = o.colors[i % o.colors.length]; d.g = o.gravity || 0; d.ground = o.ground !== false;
      }
    }
    function updateDebris(dt, scroll) {
      for (let i = 0; i < DEBRIS; i++) {
        const d = debris[i];
        if (!d.on) continue;
        d.life -= dt; if (d.life <= 0) { d.on = false; continue; }
        d.vy += d.g * dt;
        d.x += (d.vx - scroll) * dt; d.y += d.vy * dt;
        if (d.ground && d.y > GROUND - d.s) { d.y = GROUND - d.s; d.vy *= -0.35; d.vx *= 0.6; }
      }
    }
    function drawDebris() {
      for (let i = 0; i < DEBRIS; i++) {
        const d = debris[i];
        if (!d.on) continue;
        ctx.globalAlpha = Math.min(1, (d.life / d.max) * 1.6);
        ctx.fillStyle = d.col;
        ctx.fillRect(snap(d.x), snap(d.y), d.s, d.s);
      }
      ctx.globalAlpha = 1;
    }

    /* ── État ────────────────────────────────────────────────────── */
    const p = { y: GROUND, vy: 0, prevY: GROUND, air: false, airT: 0, duck: false, landT: 0 };
    let obstacles = [], speed, dist, prevDist, runT, score, lastHud, milestone, flashT, state, deadT;
    let nextGap, unlocked, hitFlash, lastStart = -1e9, runId = 0, readyT = 0;
    // entrées
    let jumpHeld = false, duckKey = false, duckTouch = false, duckTimer = 0, bufferT = 0, coyoteT = 0, holdT = 0;
    let touchId = -1, touchY = 0, touchT = 0;

    function reset() {
      p.y = p.prevY = GROUND; p.vy = 0; p.air = false; p.airT = 0; p.duck = false; p.landT = 0;
      obstacles = []; speed = SPEED0; dist = prevDist = 0; runT = 0; score = 0; lastHud = 0;
      milestone = 0; flashT = 0; deadT = 0; hitFlash = 0; unlocked = false;
      nextGap = 380;
      jumpHeld = false; duckKey = false; duckTouch = false; duckTimer = 0; bufferT = 0; coyoteT = 0; holdT = 0;
      for (const d of debris) d.on = false;
      api.hud({ score: 0 });
    }

    function start() {
      const now = performance.now();
      if (now - lastStart < 350) return;
      lastStart = now; runId++;
      reset();
      state = 'play';
      api.status('');
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      loop.start();
    }

    /* ── Obstacles ───────────────────────────────────────────────── */
    // hb : marge de tolérance retirée de chaque côté de la boîte de collision
    function spawn() {
      const x = W + 24;
      const r = Math.random();
      const canFly = score > 220;
      const canTnt = score > 120;
      let o;
      if (canFly && r < 0.2) {
        const high = score > 450 && Math.random() < 0.3;
        // « tête » : il faut se baisser ; « haut » : passe au-dessus, sauf si l'on saute
        const bottom = high ? GROUND - 56 : GROUND - 30;
        o = { kind: 'phantom', x, y: bottom - 14, w: PHW, h: 14, hx: 2, hy: 3, hw: 26, hh: 9, t: Math.random() * 6, high };
      } else if (canTnt && r < 0.36) {
        o = { kind: 'tnt', x, y: GROUND - BLOCK, w: BLOCK, h: BLOCK, hx: 2, hy: 2, hw: BLOCK - 4, hh: BLOCK - 2, t: Math.random() * 3, rows: 1, cols: 1 };
      } else {
        const maxRows = score < 120 ? 2 : 3;
        let rows = 1 + Math.floor(Math.random() * maxRows);
        let cols = 1;
        if (score > 180 && rows <= 2 && Math.random() < 0.35) cols = 2;
        if (score > 500 && rows === 1 && Math.random() < 0.3) cols = 3;
        const w = cols * BLOCK, h = rows * BLOCK;
        o = { kind: 'cactus', x, y: GROUND - h, w, h, hx: 3, hy: 3, hw: w - 6, hh: h - 3, rows, cols, t: 0 };
      }
      obstacles.push(o);
      // écart minimal qui grandit avec la vitesse, pour qu'un saut suffise toujours
      const base = speed * 0.62 + 150 + o.w;
      nextGap = base + Math.random() * speed * 0.7 + (o.kind === 'phantom' && !o.high ? 70 : 0);
    }

    /* ── Saut et accroupi ────────────────────────────────────────── */
    function pressJump() {
      if (state !== 'play') return;
      jumpHeld = true;
      bufferT = BUFFER;
    }
    function releaseJump() {
      jumpHeld = false;
      if (p.air && p.vy < JUMP_CUT) p.vy = JUMP_CUT;
    }
    function doJump() {
      p.vy = JUMP_V; p.air = true; p.airT = 0; p.duck = false;
      bufferT = 0; coyoteT = 0; holdT = 0;
      api.tone(420, 0.08, 'square', 0.12, 1.6);
      emit(PX + 8, GROUND - 1, 4, { speed: 50, angle: Math.PI, spread: 1.2, size: 2, life: 0.35, colors: ['#56D364', '#6B4A2B'], gravity: 300 });
    }
    const ducking = () => duckKey || duckTouch || duckTimer > 0;

    const HB = { x: 0, y: 0, w: 0, h: 0 };
    function hitbox() {
      if (p.duck) { HB.x = PX + 4; HB.y = p.y - (DH * U - 3); HB.w = DW * U - 8; HB.h = DH * U - 3; }
      else { HB.x = PX + 5; HB.y = p.y - (PH * U - 3); HB.w = 13; HB.h = PH * U - 5; }
      return HB;
    }
    function collide() {
      const b = hitbox();
      for (const o of obstacles) {
        const ox = o.x + o.hx, oy = o.y + o.hy;
        if (b.x < ox + o.hw && b.x + b.w > ox && b.y < oy + o.hh && b.y + b.h > oy) return o;
      }
      return null;
    }

    function die(o) {
      state = 'dead'; deadT = 0; hitFlash = 1;
      p.vy = Math.min(p.vy, -260); p.air = true; p.duck = false;
      api.shake(o.kind === 'tnt' ? 10 : 7);
      if (o.kind === 'tnt') {
        api.sfx('boom'); api.sfx('lose');
        o.boom = true;
        emit(o.x + 8, o.y + 8, 30, { speed: 300, size: 3, life: 0.9, colors: [C.warm, C.bad, '#F2CC60', '#E6EDF3'], gravity: 600 });
      } else {
        api.sfx('hit'); api.sfx('lose');
      }
      emit(PX + 12, p.y - 20, 22, { speed: 220, size: 3, life: 0.9, colors: [SK.navy, SK.skin, SK.shoe, SK.hair, SK.grey], gravity: 700 });
      if (o.kind === 'cactus') emit(o.x + 4, o.y + 6, 8, { speed: 140, size: 2, life: 0.7, colors: ['#3FB950', '#1F7A33'], gravity: 600 });
      if (o.kind === 'phantom') emit(o.x + 20, o.y + 6, 10, { speed: 160, size: 2, life: 0.7, colors: ['#41507A', '#7EE787'], gravity: 400 });
      api.hud({ score });
      const record = api.setBest(score);
      const id = runId;
      api.after(800, () => {
        if (id !== runId) return;
        api.overlay({
          kicker: record && score > 0 ? api.t('Nouveau record', 'New best') : '',
          title: api.t('Partie terminée', 'Game over'),
          text: api.t(score + ' points', score + ' points'),
          action: api.t('Rejouer', 'Play again'),
          tone: record && score > 0 ? 'good' : '',
          onAction: start,
        });
      });
    }

    /* ── Boucle ──────────────────────────────────────────────────── */
    let animT = 0;
    const loop = api.loop({
      update(dt) {
        p.prevY = p.y;
        prevDist = dist;
        animT += dt;
        hitFlash = Math.max(0, hitFlash - dt * 3);
        flashT = Math.max(0, flashT - dt);
        duckTimer = Math.max(0, duckTimer - dt);
        for (const o of obstacles) o.t += dt;

        if (state === 'ready') {
          readyT += dt;
          dist += 110 * dt;
          updateDebris(dt, 0);
          return;
        }
        if (state === 'dead') {
          deadT += dt;
          if (p.air) {
            p.vy += GRAV * dt; p.y += p.vy * dt;
            if (p.y >= GROUND) { p.y = GROUND; p.vy = 0; p.air = false; }
          }
          updateDebris(dt, 0);
          return;
        }
        if (state !== 'play') return;

        // vitesse : rampe douce vers le maximum
        runT += dt;
        speed = SPEED0 + (SPEED_MAX - SPEED0) * (1 - Math.exp(-runT / 95));
        dist += speed * dt;

        // saut : tampon et temps coyote
        bufferT = Math.max(0, bufferT - dt);
        if (!p.air) coyoteT = COYOTE; else coyoteT = Math.max(0, coyoteT - dt);
        if (bufferT > 0 && coyoteT > 0) doJump();

        const wantDuck = ducking();
        let g = GRAV;
        if (p.air) {
          p.airT += dt;
          if (p.vy < 0 && jumpHeld && holdT < HOLD_MAX) { g *= HOLD_GRAV; holdT += dt; }
          if (wantDuck) { g *= FAST_FALL; if (p.vy < 120) p.vy = Math.max(p.vy, 120); }
          p.vy += g * dt;
          p.y += p.vy * dt;
          if (p.y >= GROUND) {
            p.y = GROUND; p.vy = 0; p.air = false; p.landT = 0.12;
            emit(PX + 6, GROUND - 1, 5, { speed: 70, angle: Math.PI, spread: 1.4, size: 2, life: 0.4, colors: ['#6B4A2B', '#56D364', '#8B949E'], gravity: 400 });
          }
        }
        p.duck = !p.air && wantDuck;
        p.landT = Math.max(0, p.landT - dt);

        // obstacles
        for (const o of obstacles) o.x -= speed * dt;
        while (obstacles.length && obstacles[0].x + obstacles[0].w < -30) obstacles.shift();
        const last = obstacles[obstacles.length - 1];
        if (!last || last.x < W + 24 - nextGap) spawn();

        // score
        score = Math.floor(dist / METERS);
        if (score - lastHud >= 25) { lastHud = score - (score % 25); api.hud({ score: lastHud }); }
        const m = Math.floor(score / 100);
        if (m > milestone) {
          milestone = m; flashT = 0.9;
          api.sfx('score');
        }
        if (!unlocked && score >= 1000) { unlocked = true; api.unlock('runner_1000'); }

        updateDebris(dt, speed);
        const hit = collide();
        if (hit) die(hit);
      },

      render(alpha) {
        const d = prevDist + (dist - prevDist) * alpha;
        ctx.drawImage(sky.c, 0, 0, W, H);
        tile(stars, d * 0.03, 0, W, GROUND);
        tile(far, d * 0.12, 0, W, GROUND);
        tile(near, d * 0.32, 0, W, GROUND);

        // sol
        const go = snap(d % TILE);
        for (let x = -go; x < W; x += TILE) ctx.drawImage(ground.c, x, GROUND - GROUND_TOP, TILE, ground.h);

        // obstacles (interpolés entre deux pas fixes)
        const shift = state === 'play' ? speed * (1 - alpha) / 120 : 0;
        for (const o of obstacles) drawObstacle(o, snap(o.x + shift));

        drawPlayer(alpha);
        drawDebris();
        drawScore();
      },
    });

    function tile(L, off, y, w, h) {
      const o = snap(off % w);
      ctx.drawImage(L.c, -o, y, w, h);
      ctx.drawImage(L.c, w - o, y, w, h);
    }

    function drawObstacle(o, x) {
      if (o.kind === 'cactus') {
        for (let c = 0; c < o.cols; c++) {
          // colonnes voisines légèrement décalées en hauteur pour éviter le mur parfait
          const rows = o.cols > 1 && c === o.cols - 1 && o.rows > 1 ? o.rows - 1 : o.rows;
          for (let r = 0; r < rows; r++) {
            const spr = r === rows - 1 ? cactusTop : cactusMid;
            ctx.drawImage(spr.c, x + c * BLOCK, GROUND - (r + 1) * BLOCK, BLOCK, BLOCK);
          }
        }
      } else if (o.kind === 'tnt') {
        if (o.boom) return;
        ctx.drawImage(tnt.c, x, o.y, BLOCK, BLOCK);
        // mèche qui scintille
        const lit = Math.sin(o.t * 9) > 0.2;
        ctx.fillStyle = lit ? '#F2CC60' : C.warm;
        ctx.fillRect(x + 7, o.y - 2, 2, 2);
        if (lit) { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(o.t * 18); ctx.fillStyle = '#E6EDF3'; ctx.fillRect(x, o.y, BLOCK, BLOCK); ctx.globalAlpha = 1; }
      } else {
        const bob = Math.round(Math.sin(o.t * 5) * 2);
        const spr = Math.sin(o.t * 14) > 0 ? phantomUp : phantomDown;
        ctx.drawImage(spr.c, x, o.y - 4 + bob, PHW, PHH);
      }
    }

    function drawPlayer(alpha) {
      const y = snap(p.prevY + (p.y - p.prevY) * alpha);
      const dead = state === 'dead';
      // ombre au sol, qui rétrécit avec la hauteur
      const hgt = Math.max(0, GROUND - y);
      const sw = Math.max(6, 20 - hgt * 0.12);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(snap(PX + 13 - sw / 2), GROUND, sw, 2);

      let spr;
      if (dead) spr = deadS;
      else if (p.duck) spr = Math.floor(dist / 18) % 2 ? duckA : duckB;
      else if (p.air) spr = jumpS;
      else spr = Math.floor(dist / 22) % 2 ? runA : runB;
      const squash = p.landT > 0 && !p.duck && !dead ? 1 : 0;
      ctx.drawImage(spr.c, PX, y - spr.h + squash, spr.w, spr.h - squash);
      if (dead && hitFlash > 0 && Math.floor(deadT * 16) % 2 === 0) {
        ctx.globalAlpha = Math.min(1, hitFlash * 1.2);
        ctx.drawImage(deadFlash.c, PX, y - deadFlash.h, deadFlash.w, deadFlash.h);
        ctx.globalAlpha = 1;
      }
    }

    const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
    function pad(n) { const s = String(n); return s.length >= 5 ? s : '00000'.slice(s.length) + s; }
    function drawScore() {
      if (state === 'ready') return;
      ctx.textBaseline = 'top'; ctx.textAlign = 'right';
      ctx.font = '700 15px ' + MONO;
      const best = api.best;
      if (best) {
        ctx.fillStyle = 'rgba(139,148,158,0.75)';
        ctx.fillText('HI ' + pad(best), W - 92, 14);
      }
      // clignote en cyan à chaque centaine, comme un compteur d'arcade
      const flashing = flashT > 0;
      const shown = flashing ? milestone * 100 : score;
      if (flashing && Math.floor(flashT * 8) % 2 === 1) return;
      ctx.fillStyle = flashing ? C.cyan : C.ink;
      if (flashing && !api.reduced) { ctx.shadowColor = C.cyan; ctx.shadowBlur = 10; }
      ctx.fillText(pad(shown), W - 16, 14);
      ctx.shadowBlur = 0;
    }

    /* ── Entrées ─────────────────────────────────────────────────── */
    const JUMP_KEYS = { ' ': 1, ArrowUp: 1, w: 1, W: 1, z: 1, Z: 1 };
    const DUCK_KEYS = { ArrowDown: 1, s: 1, S: 1 };
    api.onKey((e) => {
      const k = e.key;
      if (state !== 'play') {
        if ((JUMP_KEYS[k] || k === 'Enter') && !e.repeat && (state === 'ready' || (state === 'dead' && deadT > 0.5))) {
          api.hideOverlay(); start();
        }
        return;
      }
      if (JUMP_KEYS[k]) { if (!e.repeat) pressJump(); return; }
      if (DUCK_KEYS[k]) { e.preventDefault(); duckKey = true; }
    });
    api.on(document, 'keyup', (e) => {
      const k = e.key;
      if (JUMP_KEYS[k]) releaseJump();
      if (DUCK_KEYS[k]) duckKey = false;
    });
    // perte du focus : on relâche tout, sinon une touche resterait « enfoncée »
    api.on(window, 'blur', () => { jumpHeld = false; duckKey = false; duckTouch = false; });

    // souris et doigt : appui = saut (maintenir pour monter plus haut), glisser vers le bas = se baisser
    api.on(cv.el, 'pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      if (state !== 'play') return;
      touchId = e.pointerId; touchY = e.clientY; touchT = performance.now();
      try { cv.el.setPointerCapture(e.pointerId); } catch (err) { /* sans importance */ }
      pressJump();
    });
    api.on(cv.el, 'pointermove', (e) => {
      if (e.pointerId !== touchId || duckTouch || state !== 'play') return;
      if (e.clientY - touchY > 18 && performance.now() - touchT < 450) {
        // glissé vers le bas : on annule le saut à peine commencé et on plonge
        duckTouch = true; releaseJump(); bufferT = 0;
        if (p.air && p.airT < 0.15) p.vy = Math.max(p.vy, 420);
      }
    });
    const endPointer = (e) => {
      if (e.pointerId !== touchId) return;
      touchId = -1;
      if (duckTouch) duckTimer = 0.35;
      duckTouch = false;
      releaseJump();
    };
    api.on(cv.el, 'pointerup', endPointer);
    api.on(cv.el, 'pointercancel', endPointer);
    api.swipe(cv.el, (dir) => {
      if (dir === 'down' && state === 'play') duckTimer = Math.max(duckTimer, 0.35);
    });

    // écran d'accueil : le coureur trottine déjà sur place
    reset(); state = 'ready';
    loop.start();
    api.overlay({
      title: api.t('Course', 'Run'),
      text: api.t(
        'Sautez par-dessus les blocs, baissez-vous sous les phantoms. Maintenez pour sauter plus haut.',
        'Jump over the blocks, duck under the phantoms. Hold to jump higher.'
      ),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart() { lastStart = -1e9; start(); } };
  },
});

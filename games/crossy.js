/* ==================================================================
   games/crossy.js · Traversée
   Un mélange de Crossy Road et de Frogger en pixel art vu de 3/4.
   Le personnage (inspiré du skin du propriétaire) avance case par
   case sur des rangées générées à l'infini : prairies avec arbres et
   blocs, routes, voies de wagonnets, rivières à rondins et nénuphars,
   voies ferrées avec feu d'alerte avant le passage d'un train.
   La caméra suit en douceur et pousse lentement vers l'avant : qui
   traîne trop se fait attraper par un phantom.
   Chaque rangée mobile fait boucler ses objets sur une période fixe :
   aucune création d'objet pendant la partie, seulement à la
   génération d'une nouvelle rangée. Tous les sprites et textures
   sont pré-rendus une fois sur des canvas hors écran.
   ================================================================== */
SBG.register('crossy', {
  create(api) {
    const { C } = api;
    const COLS = 11, T = 40, VIS = 13;
    const W = COLS * T, H = VIS * T;
    const cv = api.canvas(W, H);
    const ctx = cv.ctx;
    const dpr = cv.dpr;
    ctx.imageSmoothingEnabled = false;
    cv.el.style.touchAction = 'none';
    const fx = api.particles();
    const MANY = api.reduced ? 0.35 : 1;
    const snap = (v) => Math.round(v * dpr) / dpr;

    /* ── Utilitaires de pré-rendu ────────────────────────────────── */
    function layer(w, h, flip) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
      const g = c.getContext('2d');
      if (flip) g.setTransform(-dpr, 0, 0, dpr, w * dpr, 0);
      else g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.imageSmoothingEnabled = false;
      return { c, g, w, h };
    }
    // générateur à graine : textures identiques d'une partie à l'autre
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
    // éclaircit (k > 1) ou assombrit (k < 1) une couleur hexadécimale
    function shade(hex, k) {
      const n = parseInt(hex.slice(1), 16);
      const f = (v) => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k)));
      return 'rgb(' + f((n >> 16) & 255) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
    }
    // mouchetis de texels carrés sur une zone
    function speckle(g, r, x, y, w, h, size, cols, density) {
      for (let yy = y; yy < y + h; yy += size) for (let xx = x; xx < x + w; xx += size) {
        if (r() < density) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(xx, yy, Math.min(size, x + w - xx), Math.min(size, y + h - yy)); }
      }
    }

    /* ── Bandes de sol (une par type de rangée) ──────────────────── */
    const GRASS = [['#24482F', '#2B5638', '#1F3F29'], ['#284E33', '#30603D', '#22452C']];
    const grassStrips = [];
    for (let s = 0; s < 2; s++) for (let v = 0; v < 2; v++) {
      const L = layer(W, T), g = L.g, r = rng(11 + s * 7 + v * 31);
      g.fillStyle = GRASS[s][0]; g.fillRect(0, 0, W, T);
      speckle(g, r, 0, 0, W, T, 4, [GRASS[s][1], GRASS[s][2]], 0.28);
      // quelques fleurs pixel
      for (let i = 0; i < 5; i++) {
        const x = 4 + Math.floor(r() * (W - 8) / 4) * 4, y = 4 + Math.floor(r() * 7) * 4;
        g.fillStyle = r() < 0.5 ? C.violet : r() < 0.5 ? C.warm : C.ink;
        g.globalAlpha = 0.75; g.fillRect(x, y, 2, 2); g.globalAlpha = 1;
      }
      grassStrips.push(L);
    }
    // flanc de bloc d'herbe : visible quand la prairie surplombe une route ou l'eau
    const lip = layer(W, 8);
    {
      const g = lip.g, r = rng(5);
      g.fillStyle = '#4A3324'; g.fillRect(0, 0, W, 8);
      speckle(g, r, 0, 2, W, 6, 2, ['#5A3E2B', '#3B281C', '#6B4A33'], 0.35);
      g.fillStyle = '#2B5638'; g.fillRect(0, 0, W, 2);
      for (let x = 0; x < W; x += 4) if (r() < 0.45) g.fillRect(x, 2, 2, 2);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 7, W, 1);
    }
    const roadStrips = [];
    for (let v = 0; v < 2; v++) {
      const L = layer(W, T), g = L.g, r = rng(41 + v);
      g.fillStyle = '#191E25'; g.fillRect(0, 0, W, T);
      speckle(g, r, 0, 0, W, T, 2, ['#1E242C', '#15191F', '#222932'], 0.22);
      roadStrips.push(L);
    }
    // eau : motif périodique de 40 px, défilé selon le courant
    const water = layer(W + T, T);
    {
      const g = water.g;
      g.fillStyle = '#0B2E4C'; g.fillRect(0, 0, W + T, T);
      for (let x0 = 0; x0 < W + T; x0 += T) {
        g.fillStyle = '#103A60'; g.fillRect(x0 + 4, 6, 12, 2); g.fillRect(x0 + 22, 20, 14, 2);
        g.fillStyle = '#0E3456'; g.fillRect(x0 + 10, 30, 10, 2); g.fillRect(x0 + 30, 11, 6, 2);
        g.fillStyle = 'rgba(56,189,248,0.28)'; g.fillRect(x0 + 6, 6, 4, 1); g.fillRect(x0 + 26, 20, 5, 1); g.fillRect(x0 + 13, 30, 3, 1);
      }
    }
    // voie ferrée : ballast, traverses en bois, rails lourds
    const railStrip = layer(W, T);
    {
      const g = railStrip.g, r = rng(77);
      g.fillStyle = '#23272E'; g.fillRect(0, 0, W, T);
      speckle(g, r, 0, 0, W, T, 2, ['#2C3139', '#1B1F25', '#343A43'], 0.4);
      for (let x = 2; x < W; x += 20) {
        g.fillStyle = '#4A3423'; g.fillRect(x, 6, 9, 29);
        g.fillStyle = '#5C412C'; g.fillRect(x, 6, 9, 2);
        g.fillStyle = '#35251A'; g.fillRect(x, 33, 9, 2);
      }
      for (const y of [11, 27]) {
        g.fillStyle = '#59616D'; g.fillRect(0, y, W, 4);
        g.fillStyle = '#AEB7C2'; g.fillRect(0, y, W, 1);
        g.fillStyle = '#3A414B'; g.fillRect(0, y + 4, W, 1);
      }
    }
    // voie de wagonnets façon Minecraft : chemin de terre, traverses fines
    const cartStrip = layer(W, T);
    {
      const g = cartStrip.g, r = rng(91);
      g.fillStyle = '#3A2A1F'; g.fillRect(0, 0, W, T);
      speckle(g, r, 0, 0, W, T, 4, ['#45322A', '#30231A', '#4C3828'], 0.35);
      for (let x = 0; x < W; x += 10) { g.fillStyle = '#6B4A2E'; g.fillRect(x + 2, 9, 5, 22); g.fillStyle = '#7E5A39'; g.fillRect(x + 2, 9, 5, 1); }
      for (const y of [12, 26]) { g.fillStyle = '#8B949E'; g.fillRect(0, y, W, 2); g.fillStyle = '#C9D1D9'; g.fillRect(0, y, W, 1); }
    }

    /* ── Obstacles des prairies ──────────────────────────────────── */
    function treeSprite(tall, seed) {
      const h = tall ? 78 : 60;
      const L = layer(T, h), g = L.g, r = rng(seed);
      const R = (x, y, w, hh, c) => { g.fillStyle = c; g.fillRect(x, y, w, hh); };
      R(6, h - 9, 30, 6, 'rgba(0,0,0,0.32)');
      const tTop = tall ? 46 : 38, tBot = h - 6;
      R(16, tTop, 8, tBot - tTop, '#5B3A24'); R(16, tTop, 2, tBot - tTop, '#46301E'); R(22, tTop, 2, tBot - tTop, '#6E4A2F');
      const lx = tall ? 3 : 4, lw = tall ? 34 : 32, top = tall ? 4 : 6, topH = 14, face = tall ? 28 : 20;
      R(lx, top, lw, topH, '#4E9C5A');
      speckle(g, r, lx, top, lw, topH, 4, ['#5DB06A', '#3F8A4C'], 0.4);
      R(lx, top, lw, 2, '#6CC078');
      R(lx, top + topH, lw, face, '#2F6E3C');
      speckle(g, r, lx, top + topH, lw, face, 4, ['#285F33', '#377C45', '#235430'], 0.45);
      R(lx, top + topH + face - 2, lw, 2, '#1F4A2A');
      return L;
    }
    function blockSprite(ore, seed) {
      const L = layer(T, 50), g = L.g, r = rng(seed);
      const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      R(5, 43, 32, 5, 'rgba(0,0,0,0.32)');
      R(3, 4, 34, 14, '#9AA3AD');
      speckle(g, r, 3, 4, 34, 14, 4, ['#AEB6C0', '#848D98', '#A3ACB6'], 0.5);
      R(3, 18, 34, 26, '#68707A');
      speckle(g, r, 3, 18, 34, 26, 4, ['#5A616B', '#757E89', '#4F5660'], 0.5);
      R(3, 18, 34, 1, '#B6BEC8'); R(3, 43, 34, 1, '#40464F');
      if (ore) {
        const spots = [[8, 8], [24, 10], [14, 24], [27, 30], [7, 34], [19, 37]];
        for (const s of spots) { R(s[0], s[1], 4, 4, '#1C8EC4'); R(s[0], s[1], 2, 2, '#7DE3F7'); }
      }
      return L;
    }
    const OBS = [null, treeSprite(false, 3), treeSprite(true, 4), blockSprite(false, 5), blockSprite(true, 6), treeSprite(false, 8)];
    const OBS_OFF = [0, -20, -38, -10, -10, -20];

    /* ── Véhicules ───────────────────────────────────────────────── */
    const GLASS = '#10283E';
    // phares : faisceau en escalier qui s'estompe, sans dégradé
    function beam(g, x, y0, y1) {
      const steps = [[0, 7, 0.16], [7, 7, 0.10], [14, 8, 0.05]];
      for (const s of steps) {
        const spread = s[0] * 0.35;
        g.fillStyle = 'rgba(255,236,170,' + s[2] + ')';
        g.fillRect(x + s[0], y0 - spread, s[1], y1 - y0 + spread * 2);
      }
    }
    function carSprite(col, flip) {
      const L = layer(82, 46, flip), g = L.g;
      const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      beam(g, 60, 27, 33);
      R(3, 39, 56, 6, 'rgba(0,0,0,0.38)');
      R(1, 26, 58, 12, shade(col, 0.5));
      R(1, 14, 58, 12, col);
      R(1, 14, 58, 2, shade(col, 1.3));
      R(8, 15, 6, 10, GLASS); R(44, 15, 7, 10, GLASS); R(45, 16, 2, 3, 'rgba(125,211,252,0.45)');
      R(14, 4, 30, 12, shade(col, 1.18)); R(14, 4, 30, 1, shade(col, 1.45));
      R(14, 16, 30, 8, GLASS); R(28, 16, 2, 8, shade(col, 0.6)); R(16, 17, 7, 1, 'rgba(125,211,252,0.45)');
      R(8, 34, 10, 8, '#0A0D12'); R(40, 34, 10, 8, '#0A0D12'); R(11, 36, 4, 3, '#3A424D'); R(43, 36, 4, 3, '#3A424D');
      R(56, 28, 3, 4, '#FFF4C8'); R(1, 28, 2, 4, C.bad);
      return L;
    }
    function truckSprite(col, flip) {
      const L = layer(126, 56, flip), g = L.g;
      const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      beam(g, 104, 36, 43);
      R(3, 49, 100, 6, 'rgba(0,0,0,0.38)');
      R(0, 2, 72, 22, '#C9D1D9'); R(0, 2, 72, 2, '#E6EDF3');
      for (let x = 12; x < 72; x += 12) R(x, 4, 1, 20, '#AEB7C2');
      R(0, 24, 72, 24, '#7D8691'); R(0, 31, 72, 6, col); R(0, 37, 72, 1, shade(col, 0.6));
      R(72, 20, 3, 22, '#3A424D');
      R(75, 10, 28, 14, col); R(75, 10, 28, 2, shade(col, 1.3)); R(95, 12, 7, 11, GLASS);
      R(75, 24, 28, 24, shade(col, 0.5)); R(79, 26, 14, 8, GLASS); R(80, 27, 5, 1, 'rgba(125,211,252,0.45)');
      R(8, 44, 12, 8, '#0A0D12'); R(22, 44, 12, 8, '#0A0D12'); R(80, 44, 12, 8, '#0A0D12');
      R(101, 37, 3, 5, '#FFF4C8'); R(0, 40, 2, 5, C.bad);
      return L;
    }
    const CAR_COLS = [C.cyan, C.violet, C.warm, C.bad, C.good, '#E6EDF3', C.blue];
    const cars = CAR_COLS.map((c) => [carSprite(c, true), carSprite(c, false)]);
    const trucks = [C.blue, C.bad, C.good, C.warm].map((c) => [truckSprite(c, true), truckSprite(c, false)]);

    // wagonnets Minecraft, en convoi de 1 à 3, parfois chargés
    function cartSprite(n, seed) {
      const L = layer(n * 38 + 2, 44), g = L.g, r = rng(seed);
      const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      for (let i = 0; i < n; i++) {
        const o = i * 38;
        R(o + 3, 37, 32, 5, 'rgba(0,0,0,0.35)');
        if (i < n - 1) R(o + 35, 25, 5, 2, '#4B525C');
        R(o + 2, 10, 34, 9, '#A7B0BA'); R(o + 2, 10, 34, 1, '#D0D7DE');
        const load = r();
        if (load < 0.3) { R(o + 6, 6, 26, 9, '#8A5A2B'); R(o + 6, 6, 26, 2, '#A97336'); R(o + 17, 10, 4, 3, '#C9D1D9'); }
        else if (load < 0.55) { R(o + 8, 5, 22, 10, '#C8382E'); R(o + 8, 9, 22, 3, '#E6EDF3'); R(o + 16, 5, 6, 2, '#E6EDF3'); }
        else R(o + 5, 12, 28, 5, '#1A1E24');
        R(o + 2, 19, 34, 13, '#6E7681'); R(o + 2, 19, 34, 2, '#8B949E'); R(o + 2, 30, 34, 2, '#4B525C');
        R(o + 6, 23, 2, 2, '#4B525C'); R(o + 30, 23, 2, 2, '#4B525C');
        R(o + 6, 31, 7, 7, '#1A1E24'); R(o + 25, 31, 7, 7, '#1A1E24'); R(o + 8, 33, 3, 3, '#59616D'); R(o + 27, 33, 3, 3, '#59616D');
      }
      return L;
    }
    const cartSprites = [null, [cartSprite(1, 1), cartSprite(1, 2)], [cartSprite(2, 3), cartSprite(2, 4)], [cartSprite(3, 5), cartSprite(3, 6)]];

    // train : motrice et voitures de 3 cases
    function locoSprite(flip) {
      const L = layer(120, 62, flip), g = L.g;
      const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      R(2, 55, 116, 6, 'rgba(0,0,0,0.4)');
      R(2, 6, 102, 18, '#2E3945'); R(2, 6, 102, 2, '#45525F');
      R(2, 24, 102, 30, '#1B222B'); R(2, 38, 102, 4, C.cyan); R(2, 42, 102, 1, '#1C8EC4');
      for (let x = 10; x < 90; x += 20) { R(x, 28, 14, 7, GLASS); R(x + 1, 29, 4, 1, 'rgba(125,211,252,0.45)'); }
      R(104, 12, 12, 12, '#2E3945'); R(104, 24, 14, 30, '#1B222B'); R(104, 38, 14, 4, C.cyan);
      R(108, 14, 7, 8, GLASS); R(114, 44, 4, 6, '#FFF4C8');
      g.fillStyle = 'rgba(255,236,170,0.12)'; g.beginPath(); g.moveTo(118, 42); g.lineTo(120, 38); g.lineTo(120, 54); g.fill();
      for (const x of [10, 36, 68, 94]) R(x, 52, 14, 6, '#0A0D12');
      return L;
    }
    const wagon = (() => {
      const L = layer(120, 62), g = L.g;
      const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      R(2, 55, 116, 6, 'rgba(0,0,0,0.4)');
      R(1, 6, 116, 18, '#343F4C'); R(1, 6, 116, 2, '#4A5664');
      R(1, 24, 116, 30, '#222A34'); R(1, 38, 116, 3, C.blue);
      for (let x = 8; x < 110; x += 22) { R(x, 27, 16, 7, GLASS); R(x + 1, 28, 4, 1, 'rgba(125,211,252,0.45)'); }
      R(117, 30, 3, 6, '#3A424D');
      for (const x of [8, 30, 82, 104]) R(x, 52, 10, 6, '#0A0D12');
      return L;
    })();
    const locos = [locoSprite(true), locoSprite(false)];

    // rondins de 2 à 4 cases, nénuphars
    function logSprite(n) {
      const w = n * T - 4;
      const L = layer(w, 36), g = L.g, r = rng(n * 13);
      const R = (x, y, ww, h, c) => { g.fillStyle = c; g.fillRect(x, y, ww, h); };
      R(4, 30, w - 6, 5, 'rgba(0,0,0,0.35)');
      R(2, 22, w - 4, 9, '#4A3220');
      R(2, 6, w - 4, 16, '#7A5434');
      for (let y = 8; y < 21; y += 3) {
        let x = 4 + Math.floor(r() * 10);
        while (x < w - 10) { const len = 6 + Math.floor(r() * 16); R(x, y, Math.min(len, w - 8 - x), 1, r() < 0.5 ? '#5E3F25' : '#8C6440'); x += len + 4 + Math.floor(r() * 8); }
      }
      R(2, 6, w - 4, 1, '#94693F');
      for (const ex of [0, w - 6]) { R(ex, 7, 6, 23, '#B9925C'); R(ex + 2, 11, 2, 15, '#8C6A3F'); R(ex, 7, 6, 1, '#D2AE78'); }
      return L;
    }
    const logs = [null, null, logSprite(2), logSprite(3), logSprite(4)];
    function lilySprite(flower) {
      const L = layer(T, T), g = L.g;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(21, 24, 16, 11, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#245F30'; g.beginPath(); g.ellipse(20, 22, 16, 12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#358A45'; g.beginPath(); g.ellipse(20, 20, 16, 12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0B2E4C'; g.beginPath(); g.moveTo(20, 20); g.lineTo(31, 9); g.lineTo(36, 15); g.fill();
      g.strokeStyle = '#47A657'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(20, 20); g.lineTo(8, 14); g.moveTo(20, 20); g.lineTo(12, 29); g.moveTo(20, 20); g.lineTo(27, 30); g.stroke();
      if (flower) {
        g.fillStyle = C.violet; g.fillRect(9, 15, 6, 6); g.fillStyle = '#F0E2FF'; g.fillRect(10, 14, 4, 2); g.fillStyle = C.warm; g.fillRect(11, 17, 2, 2);
      }
      return L;
    }
    const lilies = [lilySprite(false), lilySprite(true)];

    /* ── Personnage (skin du propriétaire), 12 x 17 unités ───────── */
    const SK = {
      hair: '#2A1B12', hairHi: '#47301F', hairDk: '#1C120B', skin: '#C99566', skinSh: '#A8774D', glass: '#0A0D12', shine: '#7DD3FC',
      mouth: '#7A4A33', navy: '#1F2E57', navyDk: '#151F3D', navyLt: '#2B3F75', string: '#C9D1D9',
      grey: '#7D8591', greyDk: '#59616D', shoe: C.cyan, shoeDk: '#1C8EC4', sole: '#E6EDF3',
    };
    const U = 2, PW = 12, PH = 17;
    function hero(draw, flip) {
      const L = layer(PW * U, PH * U, flip);
      const r = (x, y, w, h, col) => { L.g.fillStyle = col; L.g.fillRect(x * U, y * U, w * U, h * U); };
      draw(r);
      return L;
    }
    function legs(r, back) {
      r(3, 13, 2, 2, SK.grey); r(7, 13, 2, 2, SK.grey); r(5, 13, 2, 1, SK.greyDk);
      r(2, 15, 3, 1, back ? SK.shoeDk : SK.shoe); r(7, 15, 3, 1, back ? SK.shoeDk : SK.shoe);
      r(2, 16, 3, 1, SK.sole); r(7, 16, 3, 1, SK.sole);
    }
    const heroDown = hero((r) => {
      r(2, 0, 8, 2, SK.hair); r(3, 0, 5, 1, SK.hairHi);
      r(2, 2, 8, 6, SK.skin); r(2, 2, 8, 1, SK.hair); r(2, 3, 1, 2, SK.hair); r(9, 3, 1, 2, SK.hair);
      r(3, 4, 6, 1, SK.glass); r(3, 4, 2, 2, SK.glass); r(7, 4, 2, 2, SK.glass); r(3, 4, 1, 1, SK.shine); r(7, 4, 1, 1, SK.shine);
      r(5, 6, 2, 1, SK.mouth); r(2, 7, 8, 1, SK.skinSh);
      r(3, 8, 6, 5, SK.navy); r(3, 8, 6, 1, SK.navyDk); r(5, 9, 1, 2, SK.string); r(6, 9, 1, 2, SK.string); r(3, 12, 6, 1, SK.navyDk);
      r(1, 8, 2, 4, SK.navyLt); r(9, 8, 2, 4, SK.navyLt); r(1, 12, 2, 1, SK.skin); r(9, 12, 2, 1, SK.skin);
      legs(r, false);
    });
    const heroUp = hero((r) => {
      r(2, 0, 8, 8, SK.hair); r(3, 0, 5, 1, SK.hairHi); r(4, 2, 3, 1, SK.hairHi); r(2, 7, 8, 1, SK.hairDk);
      r(3, 8, 6, 5, SK.navy); r(3, 8, 6, 3, SK.navyDk); r(4, 8, 4, 2, SK.navy); r(3, 12, 6, 1, SK.navyDk);
      r(1, 8, 2, 4, SK.navyLt); r(9, 8, 2, 4, SK.navyLt); r(1, 12, 2, 1, SK.skin); r(9, 12, 2, 1, SK.skin);
      legs(r, true);
    });
    function heroSide(flip) {
      return hero((r) => {
        r(2, 0, 8, 8, SK.skin);
        r(2, 0, 8, 2, SK.hair); r(4, 0, 3, 1, SK.hairHi);
        r(2, 2, 3, 4, SK.hair); r(2, 6, 2, 1, SK.hair); r(7, 2, 3, 1, SK.hair);
        r(5, 4, 1, 2, SK.skinSh);
        r(6, 3, 1, 1, SK.glass); r(7, 3, 3, 2, SK.glass); r(8, 3, 1, 1, SK.shine);
        r(10, 4, 1, 1, SK.skin); r(8, 6, 2, 1, SK.mouth); r(2, 7, 8, 1, SK.skinSh);
        r(3, 8, 6, 5, SK.navy); r(3, 8, 2, 3, SK.navyDk); r(8, 9, 1, 2, SK.string); r(3, 12, 6, 1, SK.navyDk);
        r(5, 9, 2, 3, SK.navyLt); r(6, 12, 2, 1, SK.skin);
        r(4, 13, 2, 2, SK.greyDk); r(6, 13, 2, 2, SK.grey);
        r(3, 15, 3, 1, SK.shoeDk); r(6, 15, 4, 1, SK.shoe); r(3, 16, 7, 1, SK.sole);
      }, flip);
    }
    const HERO = { up: heroUp, down: heroDown, right: heroSide(false), left: heroSide(true) };

    // phantom : deux battements d'ailes, tourné vers la droite (unités de 2 px)
    function phantomFrame(up) {
      const L = layer(72, 40), g = L.g;
      const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * 2, y * 2, w * 2, h * 2); };
      const body = '#41507A', dark = '#28324F', light = '#6A7DB0';
      if (up) {
        R(11, 7, 13, 2, dark); R(12, 5, 10, 2, dark); R(13, 3, 7, 2, dark); R(14, 1, 4, 2, dark); R(15, 0, 2, 1, dark);
        R(17, 1, 1, 2, light); R(19, 3, 1, 2, light); R(21, 5, 1, 2, light); R(23, 7, 1, 1, light);
      } else {
        R(11, 14, 13, 2, dark); R(12, 16, 9, 2, dark); R(14, 18, 5, 2, dark);
        R(20, 16, 1, 2, light); R(18, 18, 1, 2, light); R(23, 14, 1, 2, light);
      }
      R(4, 10, 6, 4, body); R(1, 11, 4, 2, dark); R(0, 12, 2, 1, dark);
      R(9, 9, 18, 6, body); R(9, 9, 18, 1, light); R(9, 14, 18, 1, dark);
      R(13, 11, 2, 1, dark); R(18, 11, 2, 1, dark);
      R(26, 8, 9, 8, body); R(26, 8, 9, 1, light); R(26, 15, 9, 1, dark);
      R(28, 10, 7, 3, 'rgba(63,185,80,0.35)');
      R(29, 10, 2, 2, '#7EE787'); R(32, 10, 2, 2, '#7EE787');
      R(28, 14, 6, 1, dark);
      return L;
    }
    const phantoms = [phantomFrame(true), phantomFrame(false)];

    /* ── Bonus ───────────────────────────────────────────────────── */
    const POWERS = {
      shield: { col: C.cyan, fr: 'Bouclier', en: 'Shield' },
      slow:   { col: C.violet, fr: 'Ralenti', en: 'Slow time' },
      hop:    { col: C.warm, fr: 'Super saut', en: 'Super hop' },
    };
    const POWER_KINDS = ['shield', 'slow', 'hop'];
    const SLOW_TIME = 6;
    for (const k of POWER_KINDS) {
      const P = POWERS[k];
      const L = layer(48, 48), g = L.g;
      const n = parseInt(P.col.slice(1), 16), rgb = ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
      const grad = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      grad.addColorStop(0, 'rgba(' + rgb + ',0.5)'); grad.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = grad; g.fillRect(0, 0, 48, 48);
      P.glow = L; P.dark = shade(P.col, 0.42); P.light = shade(P.col, 1.45);
    }
    function glyph(kind, x, y) {
      ctx.fillStyle = POWERS[kind].light; ctx.strokeStyle = POWERS[kind].light;
      ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      if (kind === 'shield') {
        ctx.moveTo(x, y - 5); ctx.lineTo(x + 4.5, y - 3); ctx.lineTo(x + 4, y + 1.5); ctx.lineTo(x, y + 5); ctx.lineTo(x - 4, y + 1.5); ctx.lineTo(x - 4.5, y - 3); ctx.closePath(); ctx.fill();
      } else if (kind === 'slow') {
        ctx.moveTo(x - 4, y - 5); ctx.lineTo(x + 4, y - 5); ctx.lineTo(x - 4, y + 5); ctx.lineTo(x + 4, y + 5); ctx.closePath(); ctx.stroke();
      } else {
        ctx.moveTo(x - 4, y - 0.5); ctx.lineTo(x, y - 4.5); ctx.lineTo(x + 4, y - 0.5);
        ctx.moveTo(x - 4, y + 4); ctx.lineTo(x, y); ctx.lineTo(x + 4, y + 4); ctx.stroke();
      }
    }
    function drawPowerAt(kind, x, y, t) {
      const P = POWERS[kind];
      ctx.drawImage(P.glow.c, x - 24, y - 24, 48, 48);
      ctx.fillStyle = P.dark; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = P.light; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 9.5, 0, Math.PI * 2); ctx.stroke();
      glyph(kind, x, y);
    }

    // étiquettes flottantes (réserve fixe)
    const labels = [];
    for (let i = 0; i < 6; i++) labels.push({ t: 0, x: 0, y: 0, text: '', col: '' });
    function floatLabel(x, y, text, col) {
      let best = labels[0];
      for (const l of labels) if (l.t <= 0) { best = l; break; }
      best.t = 1.1; best.x = x; best.y = y; best.text = text; best.col = col;
    }
    // ronds dans l'eau
    const ripples = [];
    for (let i = 0; i < 4; i++) ripples.push({ t: 0, x: 0, r: 0 });
    function ripple(x, row) {
      let best = ripples[0];
      for (const p of ripples) if (p.t <= 0) { best = p; break; }
      best.t = 1; best.x = x; best.r = row;
    }

    // vignette de danger en bas de l'écran
    const danger = layer(W, 80);
    {
      const grad = danger.g.createLinearGradient(0, 0, 0, 80);
      grad.addColorStop(0, 'rgba(255,123,114,0)'); grad.addColorStop(1, 'rgba(255,123,114,0.45)');
      danger.g.fillStyle = grad; danger.g.fillRect(0, 0, W, 80);
    }

    /* ── Monde : génération des rangées ──────────────────────────── */
    const rows = new Map();
    let gen;
    function freshGen() { return { type: 'grass', left: 0, safe: 5, lastPower: 0, riverDir: 1, prev: null }; }
    const rnd = (a, b) => a + Math.random() * (b - a);
    const diff = (r) => Math.min(1, r / 160);

    // remplit une période d'objets (gauche à droite) puis la décale au hasard
    function fillLane(row, makeItem, gapMin, gapMax) {
      const items = [];
      let pos = 0;
      do {
        const it = makeItem();
        it.x = pos; items.push(it);
        pos += it.len + rnd(gapMin, gapMax);
      } while (pos < COLS + 6 || items.length < 2);
      row.period = Math.max(pos, COLS + 6);
      const shift = Math.random() * row.period - 2;
      for (const it of items) { it.x += shift; wrapItem(row, it); }
      row.items = items;
    }
    function wrapItem(row, it) {
      while (it.x >= COLS + 1) it.x -= row.period;
      while (it.x + it.len <= -row.period + COLS + 1) it.x += row.period;
    }

    function grassRow(r, forest) {
      const row = { i: r, type: 'grass', obs: new Uint8Array(COLS), power: null, strip: grassStrips[(r & 1) * 2 + (Math.random() < 0.5 ? 1 : 0)], items: null, speed: 0, dir: 1 };
      if (forest) { for (let c = 0; c < COLS; c++) row.obs[c] = Math.random() < 0.5 ? 1 : Math.random() < 0.5 ? 2 : 5; return row; }
      const d = diff(r);
      const dens = r <= 2 ? (r === 0 ? 0.0 : 0.12) : 0.17 + d * 0.13;
      for (let c = 0; c < COLS; c++) {
        if (Math.random() < dens) {
          const k = Math.random();
          row.obs[c] = k < 0.38 ? 1 : k < 0.6 ? 2 : k < 0.68 ? 5 : k < 0.9 ? 3 : 4;
        }
      }
      // couloir garanti : la colonne sûre dérive d'au plus une case par prairie
      const ns = api.clamp(gen.safe + Math.floor(Math.random() * 3) - 1, 1, COLS - 2);
      row.obs[gen.safe] = 0; row.obs[ns] = 0; gen.safe = ns;
      if (r === 0) row.obs.fill(0);
      if (r > 6 && r - gen.lastPower >= 7 && Math.random() < 0.16) {
        const free = [];
        for (let c = 0; c < COLS; c++) if (!row.obs[c]) free.push(c);
        const c = free[Math.floor(Math.random() * free.length)];
        row.power = { col: c, kind: POWER_KINDS[Math.floor(Math.random() * 3)], t: Math.random() * 6 };
        gen.lastPower = r;
      }
      return row;
    }
    function roadRow(r) {
      const d = diff(r);
      const row = { i: r, type: 'road', dir: Math.random() < 0.5 ? 1 : -1, speed: rnd(1.3, 2.4) + d * 2.2, strip: roadStrips[r & 1] };
      fillLane(row, () => {
        const truck = Math.random() < 0.22;
        return { x: 0, len: truck ? 2.6 : 1.5, kind: truck ? 'truck' : 'car', spr: Math.floor(Math.random() * (truck ? trucks.length : cars.length)) };
      }, Math.max(1.9, 2.6 - d * 0.6), 5.5 - d * 1.4);
      return row;
    }
    function cartRow(r) {
      const d = diff(r);
      const row = { i: r, type: 'cart', dir: Math.random() < 0.5 ? 1 : -1, speed: rnd(1.5, 2.4) + d * 1.6, strip: cartStrip };
      fillLane(row, () => {
        const n = 1 + Math.floor(Math.random() * 3);
        return { x: 0, len: n * 0.95, kind: 'cart', n, spr: Math.floor(Math.random() * 2) };
      }, 2.4, 5);
      return row;
    }
    function riverRow(r) {
      const d = diff(r);
      gen.riverDir = -gen.riverDir;
      const prev = gen.prev;
      if (prev && prev.type === 'grass' && Math.random() < 0.28) {
        // nénuphars immobiles, dont un sur la colonne sûre
        const row = { i: r, type: 'river', lily: true, dir: 1, speed: 0, items: [] };
        const cols = new Set([gen.safe]);
        const want = 4 + Math.floor(Math.random() * 3);
        while (cols.size < want) cols.add(Math.floor(Math.random() * COLS));
        for (const c of cols) row.items.push({ x: c, len: 1, kind: 'lily', spr: Math.random() < 0.3 ? 1 : 0 });
        return row;
      }
      const row = { i: r, type: 'river', dir: gen.riverDir, speed: rnd(0.9, 1.6) + d * 1.0 };
      fillLane(row, () => {
        const n = Math.random() < 0.25 + d * 0.2 ? 2 : Math.random() < 0.6 ? 3 : 4;
        return { x: 0, len: n - 0.1, kind: 'log', n };
      }, 1.2, 2.6 + d * 0.6);
      return row;
    }
    function railRow(r) {
      const row = { i: r, type: 'rail', dir: Math.random() < 0.5 ? 1 : -1, speed: 26, strip: railStrip, items: [] };
      row.train = { x: 0, len: 12, kind: 'train' };
      row.tState = 'idle'; row.tTimer = rnd(1.5, 5); row.bell = 0;
      return row;
    }
    function pickSegment(r) {
      const d = diff(r);
      if (gen.type !== 'grass') { gen.type = 'grass'; gen.left = 1 + (Math.random() < 0.4 - d * 0.2 ? 1 : 0); return; }
      const opts = [['road', 0.42]];
      if (r > 5) opts.push(['river', 0.26]);
      if (r > 8) opts.push(['cart', 0.17]);
      if (r > 11) opts.push(['rail', 0.15]);
      let sum = 0; for (const o of opts) sum += o[1];
      let k = Math.random() * sum, type = 'road';
      for (const o of opts) { k -= o[1]; if (k <= 0) { type = o[0]; break; } }
      gen.type = type;
      if (type === 'road') gen.left = 1 + Math.floor(Math.random() * (2 + Math.round(d * 3)));
      else if (type === 'river') gen.left = 1 + Math.floor(Math.random() * (2 + (d > 0.35 ? 1 : 0)));
      else if (type === 'cart') gen.left = 1 + (Math.random() < 0.35 ? 1 : 0);
      else gen.left = 1 + (d > 0.5 && Math.random() < 0.3 ? 1 : 0);
    }
    function makeRow(r) {
      let row;
      if (r < 0) row = grassRow(r, true);
      else if (r <= 3) row = grassRow(r, false);
      else {
        if (gen.left <= 0) pickSegment(r);
        gen.left--;
        row = gen.type === 'road' ? roadRow(r) : gen.type === 'river' ? riverRow(r) : gen.type === 'cart' ? cartRow(r) : gen.type === 'rail' ? railRow(r) : grassRow(r, false);
      }
      gen.prev = row;
      rows.set(r, row);
      return row;
    }
    let topRow;
    function ensureRows() {
      const want = Math.ceil(camY) + VIS + 3;
      while (topRow < want) makeRow(++topRow);
      const low = Math.floor(camY) - 3;
      for (const k of rows.keys()) if (k < low) rows.delete(k);
    }
    const rowAt = (r) => rows.get(r);

    /* ── État ────────────────────────────────────────────────────── */
    let state = 'ready', camY, started, score, p, hop, bump, land, queued, invul, shield, superHop, slowT, slowK;
    let deathKind, deathT, eagle, time, lastSafe, overlayShown;

    function reset() {
      rows.clear(); gen = freshGen();
      camY = -3.6; topRow = -7;
      ensureRows();
      p = { row: 0, x: 5.5, face: 'up', ride: null };
      hop = { on: false, k: 0, dur: 0.13, fx: 0, fr: 0, tx: 0, tr: 0, big: false };
      bump = { t: 0, dx: 0, dy: 0 };
      land = 0; queued = null; invul = 0; shield = false; superHop = false; slowT = 0; slowK = 1;
      started = false; score = 0; deathKind = ''; deathT = 0; time = 0; overlayShown = false;
      eagle = { on: false, t: 0, x: 0, y: 0 };
      lastSafe = { row: 0, x: 5.5 };
      for (const l of labels) l.t = 0;
      for (const rp of ripples) rp.t = 0;
      fx.clear();
      api.hud({ score: 0 });
      updateStatus();
    }
    function start() {
      reset();
      state = 'play';
      api.hideOverlay();
      loop.start();
    }

    function updateStatus() {
      const on = [];
      if (shield) on.push(api.t(POWERS.shield.fr, POWERS.shield.en));
      if (slowT > 0) on.push(api.t(POWERS.slow.fr, POWERS.slow.en));
      if (superHop) on.push(api.t(POWERS.hop.fr, POWERS.hop.en));
      api.status(on.length ? api.t('Actif : ', 'Active: ') + on.join(' + ') : '');
    }

    /* ── Déplacements ────────────────────────────────────────────── */
    const DIRV = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
    function blockedAt(r, col) {
      if (col < 0 || col >= COLS) return true;
      const row = rowAt(r);
      if (!row) return true;
      return row.type === 'grass' && row.obs[col] > 0;
    }
    function move(dir) {
      if (state !== 'play') return;
      if (hop.on) { queued = dir; return; }
      const v = DIRV[dir];
      p.face = dir;
      const cur = rowAt(p.row);
      const onRiver = cur && cur.type === 'river';
      let n = 1;
      if (dir === 'up' && superHop) {
        // super saut : trois rangées si possible, sinon le plus loin possible
        const col = Math.floor(p.x);
        for (n = 3; n > 1; n--) {
          const tr = rowAt(p.row + n);
          if (tr && !(tr.type === 'grass' && tr.obs[api.clamp(col, 0, COLS - 1)])) break;
        }
      }
      const tr = p.row + v[1] * n;
      const trow = rowAt(tr);
      if (!trow) return;
      let tx;
      if (trow.type === 'river') {
        // sur l'eau, on garde la position exacte : plus juste sur les rondins
        tx = (onRiver ? p.x : Math.floor(p.x) + 0.5) + v[0];
        if (tx < 0.3 || tx > COLS - 0.3) return doBump(v);
      } else {
        const col = Math.floor(api.clamp(p.x, 0, COLS - 0.01)) + v[0];
        if (blockedAt(tr, col)) return doBump(v);
        tx = col + 0.5;
      }
      hop.on = true; hop.k = 0; hop.big = n > 1;
      hop.dur = hop.big ? 0.34 : 0.13;
      hop.fx = p.x; hop.fr = p.row; hop.tx = tx; hop.tr = tr;
      // saut latéral sur le même rondin : on reste porté pendant le saut
      if (!(onRiver && tr === p.row)) p.ride = null;
      if (hop.big) {
        superHop = false; updateStatus();
        api.tone(420, 0.22, 'triangle', 0.35, 2.4);
        fx.burst(p.x * T, rowY(p.row) + 32, { n: Math.round(12 * MANY), color: [C.warm, '#FFE0B8'], speed: 120, life: 0.45, size: 2 });
      } else api.tone(dir === 'down' ? 470 : 560, 0.05, 'triangle', 0.22, 1.25);
      started = true;
    }
    function doBump(v) {
      bump.t = 0.12; bump.dx = v[0]; bump.dy = -v[1];
      api.tone(180, 0.05, 'square', 0.12);
    }
    function landHop() {
      hop.on = false;
      p.row = hop.tr; p.x = hop.tx;
      land = 0.12;
      const row = rowAt(p.row);
      if (row.type === 'river') {
        let found = null;
        for (const it of row.items) {
          const tol = it.kind === 'lily' ? 0.42 : 0.18;
          if (p.x >= it.x - tol && p.x <= it.x + it.len + tol) { found = it; break; }
        }
        if (found) {
          p.ride = found;
          if (found.kind === 'lily') p.x = found.x + 0.5;
          else p.x = api.clamp(p.x, found.x + 0.3, found.x + found.len - 0.3);
          if (found.kind === 'lily') api.tone(300, 0.06, 'sine', 0.25, 1.4);
        } else return fall('splash');
      } else {
        p.ride = null;
        lastSafe.row = p.row; lastSafe.x = p.x;
        if (row.type === 'grass' && row.power && row.power.col === Math.floor(p.x)) pickup(row);
      }
      if (p.row > score) {
        score = p.row;
        api.hud({ score });
        if (score >= 50) api.unlock('crossy_50');
      }
      if (hop.big) api.shake(2);
      if (queued) { const q = queued; queued = null; move(q); }
    }

    function pickup(row) {
      const kind = row.power.kind, P = POWERS[kind];
      row.power = null;
      const x = p.x * T, y = rowY(p.row) + 16;
      [660, 880, 1320].forEach((f, i) => api.after(i * 70, () => api.tone(f, 0.12, 'triangle', 0.35)));
      fx.burst(x, y, { n: Math.round(18 * MANY), color: [P.col, P.light, '#fff'], speed: 150, life: 0.55, size: 2.2 });
      floatLabel(x, y - 14, api.t(P.fr, P.en), P.col);
      if (kind === 'shield') shield = true;
      else if (kind === 'slow') slowT = SLOW_TIME;
      else superHop = true;
      updateStatus();
    }

    // chute dans l'eau ou emporté par le courant : le bouclier ramène sur la terre ferme
    function fall(kind) {
      ripple(p.x, p.row);
      fx.burst(p.x * T, rowY(p.row) + 24, { n: Math.round(16 * MANY), color: ['#7DD3FC', '#E6EDF3', '#1F6FEB'], speed: 130, life: 0.6, size: 2.2, gravity: 320 });
      api.tone(240, 0.2, 'sine', 0.4, 0.4);
      if (shield) {
        shield = false; invul = 1; p.ride = null;
        p.row = lastSafe.row; p.x = lastSafe.x; queued = null;
        fx.burst(p.x * T, rowY(p.row) + 20, { n: Math.round(14 * MANY), color: [C.cyan, '#fff'], speed: 140, life: 0.5 });
        api.tone(880, 0.14, 'triangle', 0.3, 0.6);
        updateStatus();
        return;
      }
      die(kind);
    }
    function hit(kind) {
      if (invul > 0) return;
      if (shield) {
        shield = false; invul = 1;
        fx.burst(p.x * T, rowY(p.row) + 20, { n: Math.round(20 * MANY), color: [C.cyan, '#BAE6FD', '#fff'], speed: 200, life: 0.5 });
        api.tone(880, 0.14, 'triangle', 0.3, 0.6); api.shake(3);
        updateStatus();
        return;
      }
      die(kind);
    }
    function die(kind) {
      if (state !== 'play') return;
      state = 'dying'; deathKind = kind; deathT = 0;
      // touché en plein saut : on fige le joueur là où il était dessiné
      if (hop.on) { p.x = api.lerp(hop.fx, hop.tx, hop.k); p.row = hop.k < 0.5 ? hop.fr : hop.tr; }
      hop.on = false; p.ride = null; queued = null;
      const x = p.x * T, y = rowY(p.row) + 24;
      if (kind === 'car' || kind === 'cart') {
        api.sfx('hit'); api.sfx('lose'); api.shake(6);
        fx.burst(x, y, { n: Math.round(22 * MANY), color: [SK.navy, SK.skin, C.cyan, C.bad], speed: 200, life: 0.6 });
      } else if (kind === 'train') {
        api.sfx('boom'); api.sfx('lose'); api.shake(9);
        fx.burst(x, y, { n: Math.round(34 * MANY), color: [SK.navy, SK.skin, C.cyan, C.bad, C.warm], speed: 320, life: 0.8 });
      } else if (kind === 'eagle') {
        eagle.on = true; eagle.t = 0;
        api.tone(900, 0.3, 'sawtooth', 0.12, 0.4); api.after(260, () => api.sfx('lose'));
      } else api.sfx('lose');
      updateStatus(); api.status('');
    }
    function gameOver() {
      state = 'dead';
      const record = api.setBest(score);
      const R = {
        car: ['Renversé', 'Run over'], cart: ['Percuté par un wagonnet', 'Hit by a minecart'], train: ['Percuté par le train', 'Hit by the train'],
        splash: ['Tombé à l\'eau', 'Fell in the water'], drift: ['Emporté par le courant', 'Swept away'], eagle: ['Attrapé par un phantom', 'Caught by a phantom'],
      }[deathKind] || ['', ''];
      api.overlay({
        kicker: record && score > 0 ? api.t('Nouveau record', 'New best') : '',
        title: api.t('Partie terminée', 'Game over'),
        text: api.t(R[0] + '. ' + score + (score > 1 ? ' rangées' : ' rangée'), R[1] + '. ' + score + (score === 1 ? ' row' : ' rows')),
        action: api.t('Rejouer', 'Play again'),
        tone: record && score > 0 ? 'good' : '',
        onAction: start,
      });
    }

    /* ── Mise à jour ─────────────────────────────────────────────── */
    const rowY = (r) => H - (r - camY + 1) * T;
    function updateRows(dt) {
      const sf = slowK;
      for (const row of rows.values()) {
        if (row.type === 'rail') {
          const tr = row.train;
          if (row.tState === 'idle') {
            row.tTimer -= dt * sf;
            if (row.tTimer <= 0) { row.tState = 'warn'; row.tTimer = 1.15; row.bell = 0; }
          } else if (row.tState === 'warn') {
            row.tTimer -= dt * sf; row.bell -= dt;
            const vis = row.i >= camY - 1 && row.i <= camY + VIS;
            if (row.bell <= 0 && vis && state === 'play') { row.bell = 0.24; api.tone(1240, 0.07, 'square', 0.09); }
            if (row.tTimer <= 0) {
              row.tState = 'pass';
              tr.x = row.dir > 0 ? -tr.len - 1 : COLS + 1;
              if (vis && state === 'play') api.sfx('boom');
            }
          } else {
            tr.x += row.dir * row.speed * sf * dt;
            if ((row.dir > 0 && tr.x > COLS + 1) || (row.dir < 0 && tr.x + tr.len < -1)) { row.tState = 'idle'; row.tTimer = rnd(2.5, 6.5); }
          }
          continue;
        }
        if (!row.speed) continue;
        const v = row.dir * row.speed * sf * dt;
        for (const it of row.items) {
          it.x += v;
          if (row.dir > 0 && it.x >= COLS + 1) it.x -= row.period;
          else if (row.dir < 0 && it.x + it.len <= -1) it.x += row.period;
        }
        if (p.ride && p.row === row.i && state === 'play') {
          p.x += v;
          if (hop.on && hop.tr === row.i) { hop.fx += v; hop.tx += v; }
        }
      }
    }
    function collide() {
      if (invul > 0 || (hop.on && hop.big)) return;
      const k = hop.on ? hop.k : 1;
      const r = hop.on ? (k < 0.5 ? hop.fr : hop.tr) : p.row;
      const x = hop.on ? api.lerp(hop.fx, hop.tx, k) : p.x;
      const row = rowAt(r);
      if (!row) return;
      if (row.type === 'road' || row.type === 'cart') {
        for (const it of row.items) {
          if (x + 0.27 > it.x + 0.08 && x - 0.27 < it.x + it.len - 0.08) { hit(row.type === 'road' ? 'car' : 'cart'); return; }
        }
      } else if (row.type === 'rail' && row.tState === 'pass') {
        const tr = row.train;
        if (x + 0.3 > tr.x && x - 0.3 < tr.x + tr.len) hit('train');
      }
    }

    const loop = api.loop({
      update(dt) {
        time += dt;
        fx.update(dt);
        for (const l of labels) if (l.t > 0) { l.t -= dt; l.y -= 26 * dt; }
        for (const rp of ripples) if (rp.t > 0) rp.t -= dt * 1.2;
        for (const row of rows.values()) if (row.power) row.power.t += dt;
        slowK += ((slowT > 0 ? 0.5 : 1) - slowK) * Math.min(1, dt * 6);
        updateRows(dt);

        if (state === 'play') {
          if (slowT > 0) { slowT -= dt; if (slowT <= 0) { slowT = 0; updateStatus(); api.tone(500, 0.12, 'triangle', 0.25, 0.7); } }
          if (invul > 0) invul = Math.max(0, invul - dt);
          if (bump.t > 0) bump.t = Math.max(0, bump.t - dt);
          if (land > 0) land = Math.max(0, land - dt);
          if (hop.on) {
            hop.k += dt / hop.dur;
            if (hop.k >= 1) { hop.k = 1; landHop(); }
          }
          if (state === 'play') {
            // emporté hors de l'écran par un rondin
            if (p.ride && !hop.on && (p.x < 0.1 || p.x > COLS - 0.1)) fall('drift');
          }
          if (state === 'play') collide();
          // caméra : suit le joueur en douceur et pousse doucement vers l'avant
          if (started) camY += (0.3 + Math.min(0.42, score * 0.0035)) * dt;
          const pr = hop.on ? api.lerp(hop.fr, hop.tr, hop.k) : p.row;
          const target = pr - 3.6;
          if (target > camY) camY += (target - camY) * (1 - Math.exp(-dt * 5));
          if (state === 'play' && p.row + 0.55 < camY && !hop.on) die('eagle');
          ensureRows();
        } else if (state === 'dying' || state === 'dead') {
          deathT += dt;
          if (eagle.on) eagle.t += dt;
          if (state === 'dying' && deathT > (deathKind === 'eagle' ? 1.35 : 0.95)) gameOver();
        } else if (state === 'ready') {
          ensureRows();
        }
      },
      render() {
        cv.clear(C.bg);
        const r0 = Math.floor(camY) - 1, r1 = Math.ceil(camY) + VIS + 1;
        const wOff = time * 14;

        // 1. sols
        for (let r = r1; r >= r0; r--) {
          const row = rowAt(r); if (!row) continue;
          const y = snap(rowY(r));
          if (row.type === 'river') {
            const o = ((row.dir * wOff * (row.speed ? 1 : 0.3)) % T + T) % T;
            ctx.drawImage(water.c, snap(o - T), y, W + T, T);
          } else ctx.drawImage(row.strip.c, 0, y, W, T);
          if (row.type === 'rail' && row.tState !== 'idle' && Math.floor(time * 8) % 2 === 0) {
            ctx.fillStyle = 'rgba(255,123,114,0.10)'; ctx.fillRect(0, y, W, T);
          }
        }
        // 2. raccords : marquages au sol, berges, flancs de prairie
        for (let r = r1; r >= r0; r--) {
          const row = rowAt(r); if (!row) continue;
          const y = snap(rowY(r));
          const below = rowAt(r - 1), above = rowAt(r + 1);
          if (row.type === 'road') {
            if (below && below.type === 'road') {
              ctx.fillStyle = 'rgba(230,237,243,0.35)';
              for (let x = 6; x < W; x += 40) ctx.fillRect(x, y + T - 1, 20, 2);
            }
            if (!above || above.type !== 'road') { ctx.fillStyle = '#2F3742'; ctx.fillRect(0, y, W, 2); }
          } else if (row.type === 'river' && above && above.type !== 'river') {
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, y, W, 4);
          }
          if (row.type === 'grass' && below && below.type !== 'grass') ctx.drawImage(lip.c, 0, y + T, W, 8);
        }

        // 3. objets et joueur, du fond vers l'avant
        const pk = hop.on ? hop.k : 1;
        const pRowF = hop.on ? api.lerp(hop.fr, hop.tr, api.ease.out(pk)) : p.row;
        const pDrawRow = Math.round(pRowF);
        for (let r = r1; r >= r0; r--) {
          const row = rowAt(r); if (!row) continue;
          const y = rowY(r);
          drawRow(row, y);
          if (r === pDrawRow) drawPlayer(pRowF, pk);
        }
        drawSignals(r0, r1);

        // 4. ronds dans l'eau, phantom, particules, étiquettes
        ctx.lineWidth = 2;
        for (const rp of ripples) {
          if (rp.t <= 0) continue;
          const k = 1 - rp.t;
          ctx.strokeStyle = 'rgba(186,230,253,' + (rp.t * 0.8).toFixed(3) + ')';
          ctx.beginPath(); ctx.ellipse(rp.x * T, rowY(rp.r) + 24, 6 + k * 18, 3 + k * 8, 0, 0, Math.PI * 2); ctx.stroke();
        }
        if (eagle.on) drawEagle();
        fx.draw(ctx);
        ctx.textAlign = 'center'; ctx.font = '700 13px ' + api.font;
        for (const l of labels) {
          if (l.t <= 0) continue;
          ctx.globalAlpha = Math.min(1, l.t * 1.6);
          ctx.fillStyle = 'rgba(13,17,23,0.75)'; ctx.fillText(l.text, l.x + 1, l.y + 1);
          ctx.fillStyle = l.col; ctx.fillText(l.text, l.x, l.y);
        }
        ctx.globalAlpha = 1;

        // 5. interface dans le canevas
        if (slowK < 0.98) { ctx.fillStyle = 'rgba(210,168,255,' + ((1 - slowK) * 0.12).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
        if (slowT > 0) {
          ctx.fillStyle = 'rgba(13,17,23,0.6)'; ctx.fillRect(0, 0, W, 4);
          ctx.fillStyle = C.violet; ctx.fillRect(0, 0, W * (slowT / SLOW_TIME), 3);
        }
        if (state === 'play' && started) {
          const gap = p.row - camY;
          if (gap < 1.6) {
            ctx.globalAlpha = Math.min(1, (1.6 - gap) / 1.1) * (0.65 + Math.sin(time * 9) * 0.25);
            ctx.drawImage(danger.c, 0, H - 80, W, 80);
            ctx.globalAlpha = 1;
          }
        }
        // petites icônes des bonus en réserve
        let ix = 14;
        if (shield) { drawPowerAt('shield', ix, H - 14, 0); ix += 24; }
        if (superHop) drawPowerAt('hop', ix, H - 14, 0);
      },
    });

    function drawRow(row, y) {
      if (row.type === 'grass') {
        for (let c = 0; c < COLS; c++) {
          const o = row.obs[c];
          if (o) { const S = OBS[o]; ctx.drawImage(S.c, c * T, snap(y + OBS_OFF[o]), S.w, S.h); }
        }
        if (row.power) {
          const pw = row.power;
          drawPowerAt(pw.kind, (pw.col + 0.5) * T, snap(y + 18 + Math.sin(pw.t * 3.2) * 2.5), pw.t);
        }
      } else if (row.type === 'river') {
        for (const it of row.items) {
          const x = snap(it.x * T);
          if (it.kind === 'lily') { const S = lilies[it.spr]; ctx.drawImage(S.c, x, snap(y + Math.sin(time * 2 + it.x) * 0.8), T, T); }
          else { const S = logs[it.n]; ctx.drawImage(S.c, x + 2, snap(y + 2), S.w, S.h); }
        }
      } else if (row.type === 'road') {
        const f = row.dir > 0 ? 1 : 0;
        for (const it of row.items) {
          const x = it.x * T;
          if (x > W + 30 || x + it.len * T < -30) continue;
          if (it.kind === 'car') { const S = cars[it.spr][f]; ctx.drawImage(S.c, snap(f ? x : x - 22), snap(y - 6), S.w, S.h); }
          else { const S = trucks[it.spr][f]; ctx.drawImage(S.c, snap(f ? x : x - 22), snap(y - 16), S.w, S.h); }
        }
      } else if (row.type === 'cart') {
        for (const it of row.items) {
          const x = it.x * T;
          if (x > W + 10 || x + it.len * T < -10) continue;
          const S = cartSprites[it.n][it.spr];
          ctx.drawImage(S.c, snap(x), snap(y - 4), S.w, S.h);
        }
      } else if (row.type === 'rail' && row.tState === 'pass') {
        const tr = row.train;
        for (let i = 0; i < 4; i++) {
          const x = (tr.x + i * 3) * T;
          if (x > W + 4 || x + 120 < -4) continue;
          const loco = row.dir > 0 ? i === 3 : i === 0;
          const S = loco ? locos[row.dir > 0 ? 1 : 0] : wagon;
          ctx.drawImage(S.c, snap(x), snap(y - 22), S.w, S.h);
        }
      }
    }
    // feux d'alerte sur le bord droit de chaque voie ferrée
    function drawSignals(r0, r1) {
      for (let r = r1; r >= r0; r--) {
        const row = rowAt(r);
        if (!row || row.type !== 'rail') continue;
        const y = snap(rowY(r));
        const x = W - 16;
        ctx.fillStyle = '#3A424D'; ctx.fillRect(x + 3, y - 12, 3, 30);
        ctx.fillStyle = '#161B22'; ctx.fillRect(x - 2, y - 20, 13, 10);
        const on = row.tState !== 'idle' && Math.floor(time * 6) % 2 === 0;
        ctx.fillStyle = on ? C.bad : '#4A2522'; ctx.fillRect(x, y - 18, 4, 6);
        ctx.fillStyle = !on && row.tState !== 'idle' ? C.bad : '#4A2522'; ctx.fillRect(x + 5, y - 18, 4, 6);
        if (row.tState !== 'idle') {
          ctx.fillStyle = 'rgba(255,123,114,0.25)';
          ctx.fillRect(on ? x - 3 : x + 2, y - 21, 10, 12);
        }
      }
    }

    function drawPlayer(rowF, k) {
      if (eagle.on) return;
      const dead = state === 'dying' || state === 'dead';
      if (dead && deathKind !== 'car' && deathKind !== 'cart') return;
      const x = (hop.on ? api.lerp(hop.fx, hop.tx, api.ease.out(k)) : p.x) * T;
      let y = H - (rowF - camY + 1) * T;
      const lift = hop.on ? Math.sin(Math.PI * k) * (hop.big ? 46 : 11) : 0;
      let bx = 0, by = 0;
      if (bump.t > 0) { const b = Math.sin((bump.t / 0.12) * Math.PI) * 4; bx = bump.dx * b; by = bump.dy * b; }
      const S = HERO[p.face];
      // ombre au sol
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath(); ctx.ellipse(x + bx, y + 35 + by, Math.max(5, 10 - lift * 0.08), 4, 0, 0, Math.PI * 2); ctx.fill();
      if (invul > 0 && Math.floor(invul * 14) % 2 === 0) return;
      let sw = S.w, sh = S.h;
      if (dead) { sw *= 1.35; sh *= 0.32; }
      else if (land > 0) { const q = land / 0.12; sw *= 1 + q * 0.12; sh *= 1 - q * 0.14; }
      else if (hop.on && k < 0.3) { sw *= 0.94; sh *= 1.08; }
      const dx = snap(x - sw / 2 + bx), dy = snap(y + 36 - sh - lift + by);
      ctx.drawImage(S.c, dx, dy, sw, sh);
      if (shield && !dead) {
        const cy = y + 20 - lift + by;
        ctx.fillStyle = 'rgba(56,189,248,0.10)';
        ctx.beginPath(); ctx.arc(x + bx, cy, 22, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(56,189,248,' + (0.55 + Math.sin(time * 5) * 0.2).toFixed(3) + ')'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x + bx, cy, 22, 0, Math.PI * 2); ctx.stroke();
      }
      if (superHop && !dead) {
        ctx.fillStyle = C.warm;
        const t = (time * 2) % 1;
        ctx.globalAlpha = 1 - t;
        ctx.fillRect(snap(x - 9), snap(y + 34 - t * 10), 3, 3); ctx.fillRect(snap(x + 6), snap(y + 30 - t * 10), 3, 3);
        ctx.globalAlpha = 1;
      }
    }
    // le phantom plonge depuis le haut, saisit le joueur et repart
    function drawEagle() {
      const t = eagle.t;
      const px0 = p.x * T, py0 = Math.min(rowY(p.row), H - 44) + 6;
      let ex, ey, carry = false;
      if (t < 0.55) {
        const k = api.ease.inOut(t / 0.55);
        ex = api.lerp(-80, px0, k); ey = api.lerp(-60, py0, k);
      } else {
        const k = api.ease.inOut(Math.min(1, (t - 0.55) / 0.8));
        ex = api.lerp(px0, W + 90, k); ey = api.lerp(py0, -90, k); carry = true;
      }
      if (carry) {
        const S = HERO[p.face];
        ctx.drawImage(S.c, snap(ex - 12), snap(ey + 14), S.w, S.h);
      } else {
        const S = HERO[p.face];
        ctx.drawImage(S.c, snap(px0 - 12), snap(py0 - 4), S.w, S.h);
      }
      const F = phantoms[Math.sin(time * 26) > 0 ? 0 : 1];
      ctx.drawImage(F.c, snap(ex - 36), snap(ey - 14), F.w, F.h);
    }

    /* ── Entrées ─────────────────────────────────────────────────── */
    const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', z: 'up', w: 'up', s: 'down', q: 'left', a: 'left', d: 'right' };
    api.onKey((e) => {
      const d = KEYS[e.key] || KEYS[e.key.toLowerCase()];
      if (d) {
        if (e.repeat) return;
        if (state === 'ready') { start(); }
        move(d);
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        if (state === 'play') { if (e.key === ' ' && !e.repeat) move('up'); }
        else if (state !== 'dying') start();
      }
    });
    // souris : le saut part vers le côté cliqué, par rapport au personnage
    api.on(cv.el, 'pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || state !== 'play') return;
      const q = cv.toLocal(e.clientX, e.clientY);
      const dx = q.x - p.x * T, dy = q.y - (rowY(p.row) + 20);
      if (Math.abs(dx) > Math.abs(dy) * 1.2 && Math.abs(dx) > T * 0.6) move(dx > 0 ? 'right' : 'left');
      else move(dy > T * 0.6 ? 'down' : 'up');
    });
    api.swipe(cv.el, (d) => {
      if (state !== 'play') return;
      move(d === 'tap' ? 'up' : d);
    });
    api.on(window, 'blur', () => { queued = null; });

    // écran d'accueil : la circulation tourne déjà
    reset(); state = 'ready';
    loop.start();
    api.overlay({
      title: api.t('Traversée', 'Crossing'),
      text: api.t(
        'Avancez le plus loin possible : évitez voitures, wagonnets et trains, restez sur les rondins. Ne traînez pas, un phantom rôde.',
        'Get as far as you can: dodge cars, minecarts and trains, stay on the logs. Do not dawdle, a phantom is lurking.'
      ),
      action: api.t('Jouer', 'Play'),
      onAction: start,
    });

    return { restart: start };
  },
});

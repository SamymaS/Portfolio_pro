/* ==================================================================
   avatar.js · Le personnage de Samy en 3D, à partir de son skin
   Texture 64×64 au format classique (bras de 4 px), deux couches :
   la base et la surcouche (lunettes, veste, manches, pantalon).
   1 unité = 1 pixel du skin. Le modèle mesure 32 unités de haut.
   ================================================================== */
import {
  WebGLRenderer, Scene, PerspectiveCamera, BoxGeometry, Mesh, Group,
  MeshLambertMaterial, Texture, NearestFilter, SRGBColorSpace,
  AmbientLight, DirectionalLight, Vector3,
} from './vendor/three-r186b.min.js';

/* Régions du skin pour chaque pièce : [x, y] du coin, et taille (largeur, hauteur, profondeur).
   Disposition standard : en haut le dessus et le dessous, puis droite, devant, gauche, dos. */
const PARTS = {
  head:     { base: [0, 0],   over: [32, 0],  size: [8, 8, 8] },
  body:     { base: [16, 16], over: [16, 32], size: [8, 12, 4] },
  armR:     { base: [40, 16], over: [40, 32], size: [4, 12, 4] },
  armL:     { base: [32, 48], over: [48, 48], size: [4, 12, 4] },
  legR:     { base: [0, 16],  over: [0, 32],  size: [4, 12, 4] },
  legL:     { base: [16, 48], over: [0, 48],  size: [4, 12, 4] },
};

// Rectangles de chaque face dans la texture (en pixels), dans l'ordre des faces
// de BoxGeometry : +x, -x, +y, -y, +z, -z
function faceRects([u, v], [w, h, d]) {
  return [
    [u + d + w, v + d, d, h],     // +x : côté gauche du personnage
    [u, v + d, d, h],             // -x : côté droit du personnage
    [u + d, v, w, d],             // +y : dessus
    [u + d + w, v, w, d],         // -y : dessous
    [u + d, v + d, w, h],         // +z : devant
    [u + d + w + d, v + d, w, h], // -z : dos
  ];
}

function boxFor(region, size, inflate) {
  const [w, h, d] = size;
  const g = new BoxGeometry(w + inflate * 2, h + inflate * 2, d + inflate * 2);
  const uv = g.attributes.uv;
  const rects = faceRects(region, size);
  const T = 64;
  for (let f = 0; f < 6; f++) {
    const [x, y, rw, rh] = rects[f];
    const u0 = x / T, u1 = (x + rw) / T;
    const v0 = 1 - y / T, v1 = 1 - (y + rh) / T;   // v vers le haut dans WebGL
    // sommets d'une face : haut-gauche, haut-droite, bas-gauche, bas-droite
    let q = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]];
    if (f === 3) q = [[u0, v1], [u1, v1], [u0, v0], [u1, v0]]; // dessous : retourné
    for (let i = 0; i < 4; i++) uv.setXY(f * 4 + i, q[i][0], q[i][1]);
  }
  uv.needsUpdate = true;
  return g;
}

export function createAvatar(container, opts = {}) {
  const reduce = !!opts.reduceMotion;
  const canvas = document.createElement('canvas');
  canvas.className = 'avatar-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.prepend(canvas);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(28, 1, 1, 400);
  camera.position.set(0, 17, 82);
  camera.lookAt(0, 16, 0);

  // Lumières : douce de face, rasante cyan de derrière pour détacher la silhouette
  scene.add(new AmbientLight(0xffffff, 1.55));
  const key = new DirectionalLight(0xffffff, 1.6); key.position.set(-30, 40, 60); scene.add(key);
  // Éclairage selon l'heure du visiteur : chaud le jour, froid et bleuté la nuit
  const hour = new Date().getHours();
  const night = hour < 7 || hour >= 20;
  if (night) { key.color.setHex(0xa8c4ff); key.intensity = 1.25; }
  else if (hour < 10 || hour >= 17) { key.color.setHex(0xffd9b0); }
  const rim = new DirectionalLight(0x38bdf8, night ? 2.8 : 2.2); rim.position.set(40, 20, -50); scene.add(rim);
  const rim2 = new DirectionalLight(0x1f6feb, 1.4); rim2.position.set(-50, 10, -40); scene.add(rim2);

  const root = new Group();
  scene.add(root);

  const parts = {};
  let ready = false;

  function build(texture) {
    const baseMat = new MeshLambertMaterial({ map: texture });
    const overMat = new MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.5, depthWrite: true });

    // pièce = groupe pivot + base + surcouche
    function part(name, pivot, offset, inflateOver) {
      const P = PARTS[name];
      const g = new Group();
      g.position.set(pivot[0], pivot[1], pivot[2]);
      const base = new Mesh(boxFor(P.base, P.size, 0), baseMat);
      const over = new Mesh(boxFor(P.over, P.size, inflateOver), overMat);
      base.position.set(offset[0], offset[1], offset[2]);
      over.position.copy(base.position);
      g.add(base, over);
      root.add(g);
      parts[name] = g;
      return g;
    }
    // pivots : cou, épaules, hanches
    part('head', [0, 24, 0], [0, 4, 0], 0.5);
    part('body', [0, 12, 0], [0, 6, 0], 0.25);
    part('armR', [-6, 24, 0], [0, -6, 0], 0.25);
    part('armL', [6, 24, 0], [0, -6, 0], 0.25);
    part('legR', [-2, 12, 0], [0, -6, 0], 0.25);
    part('legL', [2, 12, 0], [0, -6, 0], 0.25);
    parts.armR.rotation.z = -0.06; parts.armL.rotation.z = 0.06;
    ready = true;
    if (opts.onReady) opts.onReady();
  }

  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    const tex = new Texture(img);
    tex.magFilter = NearestFilter;
    tex.minFilter = NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
    build(tex);
  };
  img.src = opts.skin || 'assets/mougi/skin.png';

  // Souris : la tête suit, le corps un peu
  const target = { x: 0, y: 0 }, look = { x: 0, y: 0 };
  let lastMove = 0;
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.28;
    target.x = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth * 0.45)));
    target.y = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight * 0.5)));
    lastMove = performance.now();
  }
  window.addEventListener('pointermove', onMove, { passive: true });

  // Coucou de la main : à l'arrivée, puis au clic
  let waveT = reduce ? 99 : -0.6;
  function wave() { if (waveT > 1.8 || waveT < 0) waveT = 0; }

  // Un succès débloqué : petit saut de joie et coucou
  let jumpT = 99;
  document.addEventListener('achievement', () => { jumpT = 0; wave(); if (reduce) renderOnce(); });

  // Glisser pour faire tourner, avec un peu d'inertie
  let spin = 0, spinV = 0, dragging = false, dragX = 0, moved = 0, dragSpin = 0;
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; dragX = e.clientX; moved = 0; spinV = 0; dragSpin = 0;
    canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragX; dragX = e.clientX; moved += Math.abs(dx);
    spin += dx * 0.012; spinV = dx * 0.012 * 60; dragSpin += dx * 0.012;
    if (Math.abs(dragSpin) >= Math.PI * 2 && window.achievements) window.achievements.unlock('spin');
    if (reduce) renderOnce();
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false; canvas.style.cursor = '';
    if (moved < 4) wave();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (reduce && ready) renderOnce();
  }
  resize();
  new ResizeObserver(resize).observe(container);

  // Cotes du plan, recalées sur la silhouette projetée
  const dimH = container.querySelector('.dim-h');
  const dimW = container.querySelector('.dim-w');
  const v = new Vector3();
  function project(x, y, z) {
    v.set(x, y, z).applyMatrix4(root.matrixWorld).project(camera);
    return { x: (v.x * 0.5 + 0.5) * container.clientWidth, y: (-v.y * 0.5 + 0.5) * container.clientHeight };
  }
  function placeDims() {
    if (!dimH || !dimW) return;
    root.updateMatrixWorld();
    const top = project(0, 32.6, 0), bottom = project(0, 0, 0);
    const right = project(9, 0, 0);
    dimH.style.transform = `translate(${right.x + 34}px, ${top.y}px)`;
    dimH.style.height = (bottom.y - top.y) + 'px';
    const l = project(-8, 0, 2.5), r2 = project(8, 0, 2.5);
    dimW.style.transform = `translate(${l.x}px, ${bottom.y + 26}px)`;
    dimW.style.width = (r2.x - l.x) + 'px';
  }

  let raf = 0, running = false, t = 0, last = performance.now(), visible = true;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    t += dt;
    if (ready) {
      // sans mouvement de souris depuis un moment : le regard revient doucement
      const idle = now - lastMove > 3500;
      const tx = idle ? Math.sin(t * 0.4) * 0.25 : target.x;
      const ty = idle ? 0.05 : target.y;
      const k = 1 - Math.pow(0.002, dt);
      look.x += (tx - look.x) * k; look.y += (ty - look.y) * k;

      const breath = reduce ? 0 : Math.sin(t * 2.1);
      if (!dragging) {
        spin += spinV * dt;
        spinV *= Math.pow(0.04, dt);
        // revient face à l'écran quand l'élan est retombé
        if (Math.abs(spinV) < 0.3) {
          const twoPi = Math.PI * 2;
          spin = ((spin % twoPi) + twoPi + Math.PI) % twoPi - Math.PI;
          spin += (0 - spin) * (1 - Math.pow(0.05, dt));
        }
      }
      root.rotation.y = look.x * 0.42 + spin;
      if (jumpT < 0.9) {
        jumpT += dt;
        const j = Math.min(1, jumpT / 0.9);
        root.position.y = Math.sin(j * Math.PI * 2) > 0 ? Math.sin(j * Math.PI * 2) * 3.2 * (1 - j) : 0;
        parts.legL.rotation.x = parts.legR.rotation.x = -Math.max(0, Math.sin(j * Math.PI * 2)) * 0.35 * (1 - j);
      } else root.position.y = 0;
      parts.head.rotation.y = look.x * 0.5;
      parts.head.rotation.x = look.y * 0.32;
      parts.body.position.y = 12 + breath * 0.12;
      parts.head.position.y = 24 + breath * 0.18;
      parts.armL.rotation.x = breath * 0.05;
      parts.armL.rotation.z = 0.05 + Math.max(0, breath) * 0.02;
      if (jumpT >= 0.9) { parts.legR.rotation.x = 0; parts.legL.rotation.x = 0; }

      // coucou : le bras droit se lève, trois va-et-vient, redescend
      if (waveT < 1.8) {
        waveT += dt;
        const p = Math.max(0, waveT);
        const up = p < 0.25 ? p / 0.25 : p > 1.45 ? Math.max(0, 1 - (p - 1.45) / 0.35) : 1;
        const e = up * up * (3 - 2 * up);
        parts.armR.rotation.z = -e * 2.85;
        parts.armR.rotation.z += Math.sin(p * 13) * 0.22 * e;
        parts.armR.rotation.x = 0;
      } else {
        parts.armR.rotation.z = -0.05 - Math.max(0, breath) * 0.02;
        parts.armR.rotation.x = -breath * 0.05;
      }
    }
    renderer.render(scene, camera);
    placeDims();
  }

  function start() { if (reduce) return; if (running || !visible || document.hidden) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; visible ? start() : stop(); }).observe(container);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  function renderOnce() { root.rotation.y = spin; renderer.render(scene, camera); placeDims(); }
  if (reduce) {
    // une image fixe, rendue une fois la texture prête
    const once = () => { if (!ready) return setTimeout(once, 50); renderOnce(); };
    once();
  } else start();

  return { start, stop, wave };
}

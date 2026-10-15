/* ==================================================================
   scene.js · Champ de particules en 3D
   Une seule géométrie de points, plusieurs formes cibles. Le shader
   passe de l'une à l'autre avec un décalage par particule, ce qui
   donne des transitions fluides plutôt qu'un fondu.
     0 vague (ouverture, contact)   1 orbe (Sameva)
     2 microservices (TicketFlow)    3 anneaux sonores (MythraSona)
     4 voxels (TikTok → Minecraft)   5 galaxie (reste de la page)
   ================================================================== */
import {
  WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute,
  Points, ShaderMaterial, AdditiveBlending, Vector2, Vector3,
} from './vendor/three.min.js';

const STAGES = 6;

/* ── Générateurs de formes ─────────────────────────────────────── */
function rand(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function buildTargets(N) {
  const r = rand(7);
  const grid = new Float32Array(N * 3);   // x, z, aléa (vague calculée dans le shader)
  const orb = new Float32Array(N * 3);
  const svc = new Float32Array(N * 3);
  const rings = new Float32Array(N * 3);
  const vox = new Float32Array(N * 3);
  const gal = new Float32Array(N * 3);
  const rnd = new Float32Array(N);

  const rows = N > 20000 ? 52 : 38;          // lignes de la vague
  const cols = Math.ceil(N / rows);

  // centres des quatre microservices + broker central
  const cubes = [[-1.15, .55, 0], [1.15, .55, 0], [-1.15, -.75, 0], [1.15, -.75, 0], [0, -.1, .2]];
  const edges = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    edges.push([[-1, a, b], [1, a, b]], [[a, -1, b], [a, 1, b]], [[a, b, -1], [a, b, 1]]);
  }

  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    const k = r();
    rnd[i] = k;

    // 0 · vague : des lignes de signal serrées, comme des courbes de niveau
    const cx = i % cols, cz = Math.floor(i / cols);
    grid[i3] = (cx / (cols - 1) - .5) * 16 + (r() - .5) * .02;
    grid[i3 + 1] = (cz / Math.max(rows - 1, 1) - .5) * 7;
    grid[i3 + 2] = r();

    // 1 · orbe : sphère de Fibonacci, quelques couches internes
    {
      const t = i / N, phi = Math.acos(1 - 2 * t), th = Math.PI * (1 + Math.sqrt(5)) * i;
      const shell = r() < .82 ? 1.55 : 1.55 * (.35 + r() * .55);
      orb[i3] = Math.sin(phi) * Math.cos(th) * shell;
      orb[i3 + 1] = Math.cos(phi) * shell;
      orb[i3 + 2] = Math.sin(phi) * Math.sin(th) * shell;
    }

    // 2 · microservices : arêtes de cubes, puis liens vers le broker
    {
      const p = r();
      if (p < .78) {
        const c = cubes[Math.floor(r() * 4)];
        const e = edges[Math.floor(r() * 12)];
        const t = r(), s = .42;
        svc[i3] = c[0] + (e[0][0] + (e[1][0] - e[0][0]) * t) * s;
        svc[i3 + 1] = c[1] + (e[0][1] + (e[1][1] - e[0][1]) * t) * s;
        svc[i3 + 2] = c[2] + (e[0][2] + (e[1][2] - e[0][2]) * t) * s;
      } else if (p < .9) {
        const c = cubes[4], s = .3 * Math.cbrt(r());
        const th = r() * 6.283, ph = Math.acos(2 * r() - 1);
        svc[i3] = c[0] + Math.sin(ph) * Math.cos(th) * s;
        svc[i3 + 1] = c[1] + Math.sin(ph) * Math.sin(th) * s;
        svc[i3 + 2] = c[2] + Math.cos(ph) * s;
      } else {
        const a = cubes[Math.floor(r() * 4)], b = cubes[4], t = r();
        svc[i3] = a[0] + (b[0] - a[0]) * t;
        svc[i3 + 1] = a[1] + (b[1] - a[1]) * t;
        svc[i3 + 2] = a[2] + (b[2] - a[2]) * t + (r() - .5) * .02;
      }
    }

    // 3 · anneaux sonores : cercles concentriques modulés en amplitude
    {
      const ring = Math.floor(r() * 9);
      const ang = r() * Math.PI * 2;
      const base = .45 + ring * .15;
      const amp = .07 * Math.sin(ang * (3 + ring)) * Math.exp(-ring * .12);
      const rr = base + amp + (r() - .5) * .012;
      rings[i3] = Math.cos(ang) * rr;
      rings[i3 + 1] = Math.sin(ang) * rr;
      rings[i3 + 2] = (ring - 4) * .05 + (r() - .5) * .03;
    }

    // 4 · voxels : arêtes des blocs d'un gros cube, et quelques blocs en orbite
    {
      const g = 6, s = 1.2;
      const p = [0, 0, 0];
      if (r() < .84) {
        const face = Math.floor(r() * 6), ax = face >> 1, sign = face & 1 ? 1 : -1;
        const u = Math.floor(r() * g), v = Math.floor(r() * g);
        const t = r(), side = Math.floor(r() * 4);
        let a = u, b = v;
        if (side === 0) a += t; else if (side === 1) { a += t; b += 1; } else if (side === 2) b += t; else { b += t; a += 1; }
        p[ax] = sign;
        p[(ax + 1) % 3] = (a / g) * 2 - 1;
        p[(ax + 2) % 3] = (b / g) * 2 - 1;
        vox[i3] = p[0] * s; vox[i3 + 1] = p[1] * s; vox[i3 + 2] = p[2] * s;
      } else {
        // petits blocs flottants autour du cube
        const k2 = Math.floor(r() * 7);
        const ang = k2 * 0.897 + 0.4, rad = 1.85 + (k2 % 3) * .16;
        const cx2 = Math.cos(ang) * rad, cy2 = Math.sin(k2 * 1.7) * 1.1, cz2 = Math.sin(ang) * rad;
        const e = edges[Math.floor(r() * 12)], t = r(), h = .17;
        vox[i3] = cx2 + (e[0][0] + (e[1][0] - e[0][0]) * t) * h;
        vox[i3 + 1] = cy2 + (e[0][1] + (e[1][1] - e[0][1]) * t) * h;
        vox[i3 + 2] = cz2 + (e[0][2] + (e[1][2] - e[0][2]) * t) * h;
      }
    }

    // 5 · galaxie : spirale à trois bras, très aérée
    {
      const arm = Math.floor(r() * 3);
      const d = Math.pow(r(), .65) * 6.5;
      const ang = d * .55 + arm * (Math.PI * 2 / 3) + (r() - .5) * .5;
      const spread = (r() - .5) * (.35 + d * .08);
      gal[i3] = Math.cos(ang) * d + spread;
      gal[i3 + 1] = (r() - .5) * (.5 - d * .04) + spread * .3;
      gal[i3 + 2] = Math.sin(ang) * d + spread;
    }
  }
  return { grid, orb, svc, rings, vox, gal, rnd };
}

/* ── Shaders ───────────────────────────────────────────────────── */
const vertex = /* glsl */`
  uniform float uTime, uMorph, uSize, uPixelRatio, uRipple, uIntro;
  uniform vec2 uMouse;
  uniform vec3 uOffset;
  attribute vec3 aGrid, aOrb, aSvc, aRings, aVox, aGal;
  attribute float aRnd;
  varying float vMix, vAlpha, vRnd;

  mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

  vec3 wave(vec3 g){
    float x = g.x, z = g.y;
    float t = uTime * .55;
    float y = sin(x * .55 + t) * .32
            + sin(z * .9 - t * 1.3 + x * .2) * .22
            + sin((x + z) * 1.4 + t * 1.7) * .07;
    vec2 d = vec2(x, z) - uMouse;
    float dist = length(d);
    y += uRipple * exp(-dist * dist * .22) * sin(dist * 3.2 - uTime * 4.0) * .55;
    return vec3(x, y - 1.25, z - .6);
  }

  vec3 shape(int s){
    float spin = uTime * .12;
    vec3 p;
    if (s == 0) return wave(aGrid);
    if (s == 1) p = aOrb;
    else if (s == 2) { p = aSvc; spin *= .6; }
    else if (s == 3) { p = aRings; p *= 1.0 + .06 * sin(uTime * 2.2 - length(aRings.xy) * 9.0); }
    else if (s == 4) p = aVox;
    else { p = aGal; p.xz *= rot(uTime * .03); p.yz *= rot(-.42); return p + vec3(0., -.4, -2.5); }
    p.xz *= rot(spin);
    p.yz *= rot(.28);
    return p + uOffset;
  }

  // bruit léger pour que rien ne soit jamais figé
  vec3 drift(vec3 p){
    float t = uTime * .6 + aRnd * 30.;
    return vec3(sin(t + p.y * 2.), cos(t * 1.1 + p.x * 2.), sin(t * .9 + p.z * 2.)) * .025;
  }

  void main(){
    int a = int(floor(uMorph));
    int b = min(a + 1, ${STAGES - 1});
    float f = fract(uMorph);
    float t = smoothstep(0., 1., clamp((f * 1.7) - aRnd * .7, 0., 1.));

    vec3 pa = shape(a), pb = shape(b);
    vec3 p = mix(pa, pb, t);
    // tourbillon pendant la transition
    float swirl = sin(t * 3.14159);
    p += swirl * vec3(sin(aRnd * 40. + uTime), cos(aRnd * 33. + uTime * .8), sin(aRnd * 21.)) * .55;
    p += drift(p);

    // entrée : les particules montent de l'obscurité
    p.y -= (1. - uIntro) * (2.5 + aRnd * 3.);

    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    float size = uSize * (.55 + aRnd * .9) * uPixelRatio;
    gl_PointSize = size * (1. / -mv.z);

    float waveW = (a == 0 ? 1. - t : 0.) + (b == 0 ? t : 0.);
    gl_PointSize *= 1. + waveW * .35;
    vMix = clamp(p.y * .35 + .5 + aRnd * .25 + waveW * (p.x * .06), 0., 1.);
    vRnd = aRnd;
    vAlpha = uIntro * smoothstep(16., 3., -mv.z) * (1. + waveW * .6);
  }
`;

const fragment = /* glsl */`
  uniform vec3 uC1, uC2, uC3;
  uniform float uOpacity;
  varying float vMix, vAlpha, vRnd;
  void main(){
    vec2 c = gl_PointCoord - .5;
    float d = length(c);
    float a = smoothstep(.5, .0, d);
    a *= a;
    vec3 col = mix(uC1, uC2, vMix);
    col = mix(col, uC3, smoothstep(.72, 1., vRnd));
    gl_FragColor = vec4(col, a * vAlpha * uOpacity);
  }
`;

/* ── Scène ─────────────────────────────────────────────────────── */
export function createScene(canvas, opts = {}) {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const N = opts.count || (coarse || small ? 14000 : 36000);
  const reduce = !!opts.reduceMotion;

  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, .1, 60);
  const camBase = new Vector3(0, .9, 7.2);
  let lookY = -.2;
  camera.position.copy(camBase);

  const T = buildTargets(N);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aGrid', new BufferAttribute(T.grid, 3));
  geo.setAttribute('aOrb', new BufferAttribute(T.orb, 3));
  geo.setAttribute('aSvc', new BufferAttribute(T.svc, 3));
  geo.setAttribute('aRings', new BufferAttribute(T.rings, 3));
  geo.setAttribute('aVox', new BufferAttribute(T.vox, 3));
  geo.setAttribute('aGal', new BufferAttribute(T.gal, 3));
  geo.setAttribute('aRnd', new BufferAttribute(T.rnd, 1));

  const uniforms = {
    uTime: { value: 0 }, uMorph: { value: 0 }, uIntro: { value: reduce ? 1 : 0 },
    uSize: { value: coarse ? 30 : 24 }, uPixelRatio: { value: dpr },
    uMouse: { value: new Vector2(99, 99) }, uRipple: { value: 0 },
    uOffset: { value: new Vector3(0, 0, 0) }, uOpacity: { value: 1 },
    uC1: { value: hex('#2F5BFF') }, uC2: { value: hex('#38E6FF') }, uC3: { value: hex('#B07CFF') },
  };
  const mat = new ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, uniforms,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  /* état piloté de l'extérieur (tweens GSAP) */
  const state = { morph: 0, ox: 0, oy: 0, opacity: 1, intro: reduce ? 1 : 0 };

  /* souris : projection sur le plan de la vague */
  const pointer = new Vector2(0, 0), smooth = new Vector2(0, 0);
  const world = new Vector2(99, 99);
  let ripple = 0, lastMove = 0;
  const v3 = new Vector3(), dir = new Vector3();
  function onMove(e) {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    lastMove = performance.now();
  }
  if (!coarse) window.addEventListener('pointermove', onMove, { passive: true });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // recule la caméra sur écrans étroits pour garder les formes entières
    const portrait = camera.aspect < .8;
    camera.position.z = camBase.z * (portrait ? 1.45 : camera.aspect < 1.2 ? 1.15 : 1);
    camBase.y = portrait ? 2.0 : .9;          // en portrait on regarde la vague de plus haut
    lookY = portrait ? -2.6 : -.2;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  let running = false, raf = 0, t0 = performance.now(), elapsed = 0, prev = t0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - prev) / 1000, .05); prev = now;
    elapsed += dt;

    smooth.lerp(pointer, 1 - Math.pow(.001, dt));
    camera.position.x += ((smooth.x * .35) - camera.position.x) * .05;
    camera.position.y += ((camBase.y + smooth.y * .2) - camera.position.y) * .05;
    camera.lookAt(0, lookY, 0);

    // point visé sur le plan de la vague (y ≈ -1.35)
    v3.set(smooth.x, smooth.y, .5).unproject(camera);
    dir.copy(v3).sub(camera.position).normalize();
    const k = (-1.25 - camera.position.y) / dir.y;
    if (k > 0 && isFinite(k)) world.set(camera.position.x + dir.x * k, camera.position.z + dir.z * k + .6);
    const active = now - lastMove < 1400 ? 1 : 0;
    ripple += (active - ripple) * (1 - Math.pow(.02, dt));

    uniforms.uTime.value = elapsed;
    uniforms.uMorph.value = state.morph;
    uniforms.uOffset.value.set(state.ox, state.oy, 0);
    uniforms.uOpacity.value = state.opacity;
    uniforms.uIntro.value = state.intro;
    uniforms.uMouse.value.copy(world);
    uniforms.uRipple.value = ripple;
    renderer.render(scene, camera);
  }

  return {
    state,
    start() { if (running) return; running = true; prev = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    renderOnce() { prev = performance.now(); frame(prev); cancelAnimationFrame(raf); },
    stages: STAGES,
  };
}

function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

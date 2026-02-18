/* ===== CURSOR ===== */
const cursor = document.getElementById('cursor');
const cursorDot = document.getElementById('cursorDot');
let mx = 0, my = 0, cx = 0, cy = 0;
const isMobile = () => window.matchMedia('(pointer: coarse)').matches;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  if (cursorDot) { cursorDot.style.left = mx + 'px'; cursorDot.style.top = my + 'px'; }
});
(function animCursor() {
  cx += (mx - cx) * 0.12; cy += (my - cy) * 0.12;
  if (cursor) { cursor.style.left = cx + 'px'; cursor.style.top = cy + 'px'; }
  requestAnimationFrame(animCursor);
})();
document.querySelectorAll('a, button, .project-card, .skill-category, .game-card').forEach(el => {
  el.addEventListener('mouseenter', () => cursor && cursor.classList.add('hover'));
  el.addEventListener('mouseleave', () => cursor && cursor.classList.remove('hover'));
});

/* ===== SCROLL PROGRESS ===== */
const progressBar = document.getElementById('scrollProgress');
window.addEventListener('scroll', () => {
  const h = document.body.scrollHeight - window.innerHeight;
  if (progressBar) progressBar.style.width = (window.scrollY / h * 100) + '%';
}, { passive: true });

/* ===== THEME TOGGLE ===== */
const themeBtn = document.getElementById('themeToggle');
const html = document.documentElement;
let dark = true;
themeBtn && themeBtn.addEventListener('click', () => {
  dark = !dark;
  html.setAttribute('data-theme', dark ? 'dark' : 'light');
  themeBtn.textContent = dark ? '☀' : '🌙';
});

/* ===== HAMBURGER ===== */
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
let menuOpen = false;
function toggleMenu(force) {
  menuOpen = force !== undefined ? force : !menuOpen;
  hamburger && hamburger.classList.toggle('open', menuOpen);
  mobileMenu && mobileMenu.classList.toggle('open', menuOpen);
  document.body.style.overflow = menuOpen ? 'hidden' : '';
}
hamburger && hamburger.addEventListener('click', () => toggleMenu());
document.querySelectorAll('.mob-link').forEach(l => l.addEventListener('click', () => toggleMenu(false)));

/* ===== NAVBAR SCROLL ===== */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  const s = window.scrollY > 50;
  if (navbar) navbar.style.background = s
    ? (dark ? 'rgba(8,11,16,0.97)' : 'rgba(248,250,252,0.98)')
    : '';
}, { passive: true });

/* ===== HERO THREE.JS 3D ===== */
(function() {
  const canvas = document.getElementById('threeCanvas');
  if (!canvas || typeof THREE === 'undefined') return;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 30;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Particles
  const N = isMobile() ? 800 : 2000;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i*3]   = (Math.random()-0.5)*120;
    pos[i*3+1] = (Math.random()-0.5)*80;
    pos[i*3+2] = (Math.random()-0.5)*60;
    const t = Math.random();
    col[i*3]   = t * 0.48;
    col[i*3+1] = (1-t) * 0.9;
    col[i*3+2] = 1;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.15, vertexColors: true, transparent: true, opacity: 0.7 });
  const particles = new THREE.Points(geo, mat);
  scene.add(particles);

  // Wireframe shapes
  const shapes = [];
  const mats = [
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.14 }),
    new THREE.MeshBasicMaterial({ color: 0x7c3aed, wireframe: true, transparent: true, opacity: 0.11 }),
  ];
  const geos = [new THREE.IcosahedronGeometry(3,1), new THREE.OctahedronGeometry(2.5,0), new THREE.TetrahedronGeometry(2,0)];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(geos[i%geos.length], mats[i%mats.length]);
    m.position.set((Math.random()-0.5)*60, (Math.random()-0.5)*40, (Math.random()-0.5)*20-5);
    m.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    shapes.push({ m, rx:(Math.random()-0.5)*0.005, ry:(Math.random()-0.5)*0.005, o:Math.random()*Math.PI*2 });
    scene.add(m);
  }

  let tRx=0, tRy=0, cRx=0, cRy=0;
  window.addEventListener('mousemove', e => {
    tRy = (e.clientX/window.innerWidth - 0.5) * 0.35;
    tRx = (e.clientY/window.innerHeight - 0.5) * 0.18;
  });

  let t = 0;
  (function render() {
    requestAnimationFrame(render);
    t += 0.016;
    cRx += (tRx-cRx)*0.05; cRy += (tRy-cRy)*0.05;
    particles.rotation.x = t*0.015 + cRx*0.5;
    particles.rotation.y = t*0.02 + cRy*0.5;
    shapes.forEach(({m,rx,ry,o}) => { m.rotation.x+=rx; m.rotation.y+=ry; m.position.y+=Math.sin(t+o)*0.003; });
    renderer.render(scene, camera);
  })();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  // Parallax
  window.addEventListener('scroll', () => {
    if (window.scrollY < window.innerHeight)
      canvas.style.transform = `translateY(${window.scrollY * 0.25}px)`;
  }, { passive: true });
})();

/* ===== HERO ENTRANCE ===== */
window.addEventListener('load', () => {
  setTimeout(() => document.querySelector('#hero')?.classList.add('hero-ready'), 150);
});

/* ===== SCROLL REVEAL ===== */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* ===== ACTIVE NAV LINK ===== */
const navLinks = document.querySelectorAll('.nav-link');
const sectionObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) navLinks.forEach(l => {
      l.style.color = l.getAttribute('href') === '#'+e.target.id ? 'var(--accent)' : '';
    });
  });
}, { threshold: 0.4 });
document.querySelectorAll('section[id]').forEach(s => sectionObs.observe(s));

/* ===== STATS COUNTER ===== */
const statObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.querySelectorAll('.stat-num').forEach(el => {
      const target = +el.dataset.target;
      const duration = 1600;
      const start = performance.now();
      (function tick(now) {
        const p = Math.min((now-start)/duration, 1);
        const ease = 1 - Math.pow(1-p, 3);
        el.textContent = Math.round(ease * target);
        if (p < 1) requestAnimationFrame(tick);
      })(start);
    });
    statObs.unobserve(entry.target);
  });
}, { threshold: 0.5 });
const statsBar = document.querySelector('.stats-bar');
if (statsBar) statObs.observe(statsBar);

/* ===== PROJECT FILTER ===== */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;
    document.querySelectorAll('.project-card').forEach(card => {
      const show = f === 'all' || card.dataset.cat === f;
      card.classList.toggle('hidden', !show);
      if (show) card.style.animation = 'cardIn 0.35s ease forwards';
    });
  });
});
const s2 = document.createElement('style');
s2.textContent = `
@keyframes cardIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
`;
document.head.appendChild(s2);

/* ===== CONTACT FORM ===== */
document.getElementById('contactForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const orig = btn.textContent;
  btn.textContent = '✓ Message envoyé !';
  btn.style.background = '#22c55e';
  setTimeout(() => { btn.textContent = orig; btn.style.background = ''; e.target.reset(); }, 3000);
});

/* ===== SMOOTH SCROLL ===== */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const t = document.querySelector(a.getAttribute('href'));
    if (t) t.scrollIntoView({ behavior: 'smooth' });
  });
});

/* ===== EASTER EGG TERMINAL ===== */
const ee = document.getElementById('easterEgg');
const eeBody = document.getElementById('eeBody');
const eeInput = document.getElementById('eeInput');
const eeClose = document.getElementById('eeClose');
let konamiBuffer = '';
const trigger = 'sb';

document.addEventListener('keydown', e => {
  if (document.activeElement === eeInput) return;
  konamiBuffer = (konamiBuffer + e.key).slice(-trigger.length);
  if (konamiBuffer === trigger) openTerminal();
});
eeClose?.addEventListener('click', () => ee.classList.add('hidden'));

function openTerminal() {
  ee.classList.remove('hidden');
  eeBody.innerHTML = '';
  eePrint('Bienvenue dans le terminal de Samy ! 👾', 'accent');
  eePrint('────────────────────────────────');
  eePrint("Tape 'help' pour voir les commandes disponibles.", 'success');
  eeInput?.focus();
}

function eePrint(text, cls='') {
  const span = document.createElement('span');
  span.className = 'ee-line' + (cls ? ' '+cls : '');
  span.textContent = text;
  eeBody.appendChild(span);
  eeBody.scrollTop = eeBody.scrollHeight;
}

const commands = {
  help: () => {
    eePrint('Commandes disponibles :', 'accent');
    eePrint('  whoami      → Qui suis-je ?');
    eePrint('  stack       → Mon stack technique');
    eePrint('  github      → Lien GitHub');
    eePrint('  linkedin    → Lien LinkedIn');
    eePrint('  contact     → Me contacter');
    eePrint('  joke        → Une blague de dev');
    eePrint('  matrix      → 😏');
    eePrint('  clear       → Vider le terminal');
    eePrint('  exit        → Fermer');
  },
  whoami: () => {
    eePrint('Samy Boudaoud — Ingénieur Logiciel Fullstack & IoT', 'success');
    eePrint('24 ans · Aix-en-Provence · En alternance @ CS GROUP');
  },
  stack: () => {
    eePrint('Backend  → Java, Kotlin, Python, Spring, Flask', 'accent');
    eePrint('Mobile   → Flutter, Dart, React Native');
    eePrint('IoT      → ESP32, Raspberry Pi, MQTT, BLE');
    eePrint('Devops   → Git, Docker, CI/CD, Ansible');
  },
  github: () => {
    eePrint('→ https://github.com/SamymaS', 'success');
    window.open('https://github.com/SamymaS', '_blank');
  },
  linkedin: () => {
    eePrint('→ https://linkedin.com/in/samy-boudaoud', 'success');
    window.open('https://www.linkedin.com/in/samy-boudaoud', '_blank');
  },
  contact: () => {
    eePrint('✉  samyboudaoud95@gmail.com', 'success');
    eePrint('✆  06 67 72 14 76');
  },
  joke: () => {
    const jokes = [
      "Pourquoi les développeurs Java portent-ils des lunettes ? Parce qu'ils ne voient pas C#.",
      "Un null pointer entre dans un bar... segmentation fault.",
      "Je voulais faire une blague sur les WebSockets... mais elle n'avait pas de fin.",
      "git push --force : la seule solution aux conflits selon les juniors.",
      "Il y a 10 types de personnes : ceux qui comprennent le binaire et les autres."
    ];
    eePrint(jokes[Math.floor(Math.random()*jokes.length)], 'success');
  },
  matrix: () => {
    eePrint('Initialisation de la matrice...', 'accent');
    let chars = '日ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｪｩｨ01';
    let i = 0;
    const interval = setInterval(() => {
      let line = '';
      for(let j=0;j<30;j++) line += chars[Math.floor(Math.random()*chars.length)];
      eePrint(line, 'accent');
      if(++i>12) clearInterval(interval);
    }, 80);
  },
  clear: () => { eeBody.innerHTML = ''; },
  exit: () => { ee.classList.add('hidden'); },
};

eeInput?.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const val = eeInput.value.trim().toLowerCase();
  eePrint('$ ' + val);
  if (commands[val]) commands[val]();
  else eePrint(`Commande inconnue : "${val}". Tape 'help'.`, 'error');
  eeInput.value = '';
});

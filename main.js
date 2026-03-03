/* =============================================================
   MAIN.JS — Portfolio Samy Boudaoud
   ============================================================= */

/* ---------- UTILS ---------- */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

/* ---------- CUSTOM CURSOR (desktop only) ---------- */
const cursor    = $('#cursor');
const cursorDot = $('#cursorDot');

if (cursor && !isTouchDevice()) {
  let mx=0, my=0, cx=0, cy=0;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    if (cursorDot) { cursorDot.style.left = mx+'px'; cursorDot.style.top = my+'px'; }
  });
  (function animCursor() {
    cx += (mx-cx) * 0.12; cy += (my-cy) * 0.12;
    cursor.style.left = cx+'px'; cursor.style.top = cy+'px';
    requestAnimationFrame(animCursor);
  })();
  $$('a, button, .project-card, .skill-category, .game-card').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  });
}

/* ---------- PROJECT CARDS CLICKABLE ---------- */
$$('.project-card').forEach(card => {
  card.style.cursor = 'pointer';
  card.addEventListener('click', () => {
    const link = card.querySelector('.project-link');
    if (link) window.open(link.href, link.target);
  });
});

/* ---------- SCROLL PROGRESS BAR ---------- */
const progressBar = $('#scrollProgress');
function updateProgress() {
  if (!progressBar) return;
  const max = document.body.scrollHeight - window.innerHeight;
  progressBar.style.width = (max > 0 ? window.scrollY / max * 100 : 0) + '%';
  
  // Show/hide scroll-to-top button
  const scrollTopBtn = $('#scrollTop');
  if (scrollTopBtn) {
    scrollTopBtn.classList.toggle('show', window.scrollY > 300);
  }
}
window.addEventListener('scroll', updateProgress, { passive: true });

/* ---------- SCROLL TO TOP BUTTON ---------- */
const scrollTopBtn = $('#scrollTop');
scrollTopBtn?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ---------- THEME TOGGLE ---------- */
const html      = document.documentElement;
const themeBtn  = $('#themeToggle');
let isDark = localStorage.getItem('theme') !== 'light';

function setTheme(dark) {
  isDark = dark;
  html.setAttribute('data-theme', isDark ? 'dark' : 'light');
  themeBtn.textContent = isDark ? '☀' : '🌙';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Initial theme
setTheme(isDark);

themeBtn?.addEventListener('click', () => {
  setTheme(!isDark);
  updateNavBg();
});

/* ---------- NAVBAR SCROLL ---------- */
const navbar = $('#navbar');
function updateNavBg() {
  if (!navbar) return;
  const scrolled = window.scrollY > 50;
  navbar.classList.toggle('scrolled', scrolled);
  updateActiveNav();
}

function updateActiveNav() {
  const sections = $$('section[id], footer');
  let activeId = null;
  
  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    // Section is visible in viewport
    if (rect.top <= 200 && rect.bottom >= 200) {
      activeId = section.id;
    }
  });
  
  const navLinks = $$('.nav-link, .mob-link');
  navLinks.forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    if (href === '#' + activeId) {
      link.classList.add('active');
    }
  });
}

window.addEventListener('scroll', updateNavBg, { passive: true });

/* ---------- HAMBURGER MENU ---------- */
const hamburger  = $('#hamburger');
const mobileMenu = $('#mobileMenu');
let menuOpen = false;

function setMenu(open) {
  menuOpen = open;
  hamburger?.classList.toggle('open', menuOpen);
  mobileMenu?.classList.toggle('open', menuOpen);
  document.body.style.overflow = menuOpen ? 'hidden' : '';
}

hamburger?.addEventListener('click', () => setMenu(!menuOpen));

// Close when tapping a link
$$('.mob-link').forEach(link => {
  link.addEventListener('click', () => {
    setMenu(false);
    // Smooth scroll
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  });
});

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    setMenu(false);
    $('#easterEgg')?.classList.add('hidden');
  }
});

/* ---------- THREE.JS 3D HERO ---------- */
(function initThree() {
  const canvas = $('#threeCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const W = window.innerWidth, H = window.innerHeight;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, W/H, 0.1, 1000);
  camera.position.z = 30;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Fewer particles on mobile for performance
  const N = isTouchDevice() ? 600 : 2000;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N*3), col = new Float32Array(N*3);
  for (let i=0; i<N; i++) {
    pos[i*3]   = (Math.random()-.5)*120;
    pos[i*3+1] = (Math.random()-.5)*80;
    pos[i*3+2] = (Math.random()-.5)*60;
    const t = Math.random();
    col[i*3] = t*.48; col[i*3+1] = (1-t)*.9; col[i*3+2] = 1;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size:.15, vertexColors: true, transparent: true, opacity:.7 });
  const particles = new THREE.Points(geo, mat);
  scene.add(particles);

  // Wireframe shapes
  const shapeMats = [
    new THREE.MeshBasicMaterial({ color:0x00e5ff, wireframe:true, transparent:true, opacity:.14 }),
    new THREE.MeshBasicMaterial({ color:0x7c3aed, wireframe:true, transparent:true, opacity:.11 }),
  ];
  const shapeGeos = [new THREE.IcosahedronGeometry(3,1), new THREE.OctahedronGeometry(2.5,0), new THREE.TetrahedronGeometry(2,0)];
  const shapes = [];
  const shapeCount = isTouchDevice() ? 3 : 6;
  for (let i=0; i<shapeCount; i++) {
    const m = new THREE.Mesh(shapeGeos[i%3], shapeMats[i%2]);
    m.position.set((Math.random()-.5)*60, (Math.random()-.5)*40, (Math.random()-.5)*20-5);
    m.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    shapes.push({ m, rx:(Math.random()-.5)*.005, ry:(Math.random()-.5)*.005, o:Math.random()*Math.PI*2 });
    scene.add(m);
  }

  let tRx=0, tRy=0, cRx=0, cRy=0;
  if (!isTouchDevice()) {
    window.addEventListener('mousemove', e => {
      tRy = (e.clientX/window.innerWidth -.5) * .35;
      tRx = (e.clientY/window.innerHeight-.5) * .18;
    });
  }

  let elapsed = 0;
  let lastTime = performance.now();
  (function render(now) {
    requestAnimationFrame(render);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    elapsed += dt;

    cRx += (tRx-cRx)*.05; cRy += (tRy-cRy)*.05;
    particles.rotation.x = elapsed*.015 + cRx*.5;
    particles.rotation.y = elapsed*.02  + cRy*.5;
    shapes.forEach(({m,rx,ry,o}) => {
      m.rotation.x += rx; m.rotation.y += ry;
      m.position.y += Math.sin(elapsed+o)*.003;
    });
    renderer.render(scene, camera);
  })(lastTime);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Parallax on scroll (only when hero visible)
  window.addEventListener('scroll', () => {
    if (window.scrollY < window.innerHeight) {
      canvas.style.transform = `translateY(${window.scrollY * 0.22}px)`;
    }
  }, { passive: true });
})();

/* ---------- HERO ENTRANCE ---------- */
window.addEventListener('load', () => {
  setTimeout(() => $('#hero')?.classList.add('hero-ready'), 150);
});

/* ---------- SCROLL REVEAL ---------- */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
}, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
$$('.reveal').forEach(el => revealObs.observe(el));

/* ---------- ACTIVE NAV LINK ---------- */
const navLinks = $$('.nav-link');
const secObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navLinks.forEach(l => {
        l.classList.toggle('active', l.getAttribute('href') === '#'+e.target.id);
      });
    }
  });
}, { threshold: 0.35 });
$$('section[id]').forEach(s => secObs.observe(s));

/* ---------- STATS COUNTER ---------- */
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
const statsBar = $('.stats-bar');
if (statsBar) statObs.observe(statsBar);

/* ---------- PROJECT FILTER ---------- */
$$('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;
    $$('.project-card').forEach(card => {
      const show = f === 'all' || card.dataset.cat === f;
      card.classList.toggle('hidden', !show);
      if (show) card.style.animation = 'cardIn .35s ease forwards';
    });
  });
});
const s1 = document.createElement('style');
s1.textContent = '@keyframes cardIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}';
document.head.appendChild(s1);

/* ---------- SMOOTH SCROLL (desktop anchor links) ---------- */
$$('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      setMenu(false);
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ---------- COPY TO CLIPBOARD ---------- */
$$('.contact-item').forEach(item => {
  const text = item.textContent.trim();
  if (text.includes('@') || text.match(/\d{2}/)) {
    item.style.cursor = 'pointer';
    item.title = 'Cliquez pour copier';
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const value = text.replace(/\s/g, '');
      navigator.clipboard.writeText(value).then(() => {
        const orig = item.textContent;
        item.textContent = '✓ Copié !';
        setTimeout(() => item.textContent = orig, 2000);
      });
    });
  }
});

/* ---------- CONTACT FORM ---------- */
const contactForm = $('#contactForm');
if (contactForm) {
  const inputs = contactForm.querySelectorAll('.form-input');
  
  // Real-time validation
  inputs.forEach(input => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      if (input.classList.contains('error')) validateField(input);
    });
  });
  
  function validateField(input) {
    const isEmail = input.type === 'email';
    const isEmpty = !input.value.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
    const isValid = isEmpty ? false : (isEmail ? isValidEmail : true);
    
    input.classList.remove('error', 'success');
    const feedback = input.parentElement.querySelector('.form-error');
    
    if (isEmpty && input === document.activeElement) {
      input.classList.add('error');
      if (feedback) { feedback.classList.add('show'); feedback.textContent = 'Ce champ est requis'; }
    } else if (!isEmpty && !isValid) {
      input.classList.add('error');
      if (feedback) { 
        feedback.classList.add('show'); 
        feedback.textContent = isEmail ? 'Email invalide' : 'Ce champ est invalide';
      }
    } else if (!isEmpty && isValid) {
      input.classList.add('success');
      if (feedback) { feedback.classList.remove('show'); }
    }
  }
  
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    let valid = true;
    
    inputs.forEach(input => {
      const isEmpty = !input.value.trim();
      const isEmail = input.type === 'email';
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
      const isFieldValid = isEmpty ? false : (isEmail ? isValidEmail : true);
      
      if (!isFieldValid) {
        input.classList.add('error');
        valid = false;
        const feedback = input.parentElement.querySelector('.form-error');
        if (feedback) { 
          feedback.classList.add('show'); 
          feedback.textContent = isEmpty ? 'Ce champ est requis' : 'Format invalide';
        }
      }
    });
    
    if (!valid) return;
    
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Envoi...';
    
    setTimeout(() => {
      btn.textContent = '✓ Message envoyé !';
      btn.style.background = '';
      btn.classList.add('success-btn');
      setTimeout(() => { 
        btn.disabled = false;
        btn.textContent = orig; 
        btn.classList.remove('success-btn');
        contactForm.reset();
        inputs.forEach(i => { i.classList.remove('success', 'error'); });
      }, 2500);
    }, 800);
  });
}

/* ---------- EASTER EGG TERMINAL ---------- */
const ee      = $('#easterEgg');
const eeBody  = $('#eeBody');
const eeInput = $('#eeInput');
const eeClose = $('#eeClose');

// Trigger: type "sb" anywhere (not inside inputs/textareas)
let kbuf = '';
document.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.key === 'Escape') { ee?.classList.add('hidden'); return; }
  kbuf = (kbuf + e.key.toLowerCase()).slice(-2);
  if (kbuf === 'sb') openTerminal();
});
eeClose?.addEventListener('click', () => ee?.classList.add('hidden'));

function openTerminal() {
  if (!ee) return;
  ee.classList.remove('hidden');
  if (eeBody) eeBody.innerHTML = '';
  eePrint('Bienvenue dans le terminal de Samy ! 👾', 'accent');
  eePrint('────────────────────────────────');
  eePrint("Tape 'help' pour voir les commandes.", 'success');
  eeInput?.focus();
}

function eePrint(text, cls='') {
  if (!eeBody) return;
  const span = document.createElement('span');
  span.className = 'ee-line' + (cls ? ' '+cls : '');
  span.textContent = text;
  eeBody.appendChild(span);
  eeBody.scrollTop = eeBody.scrollHeight;
}

const cmds = {
  help: () => {
    eePrint('Commandes disponibles :', 'accent');
    ['whoami','stack','github','linkedin','contact','joke','matrix','clear','exit']
      .forEach(c => eePrint('  ' + c));
  },
  whoami:   () => { eePrint('Samy Boudaoud — Ingénieur Logiciel Fullstack & IoT', 'success'); eePrint('24 ans · Aix-en-Provence · Alternance @ CS GROUP'); },
  stack:    () => { eePrint('Backend  → Java, Kotlin, Python, Spring, Flask', 'accent'); eePrint('Mobile   → Flutter, Dart, React Native'); eePrint('IoT      → ESP32, Raspberry Pi, MQTT, BLE'); eePrint('Devops   → Git, Docker, CI/CD, Ansible'); },
  github:   () => { eePrint('→ https://github.com/SamymaS', 'success'); window.open('https://github.com/SamymaS','_blank'); },
  linkedin: () => { eePrint('→ https://linkedin.com/in/samy-boudaoud', 'success'); window.open('https://www.linkedin.com/in/samy-boudaoud','_blank'); },
  contact:  () => { eePrint('✉  samyboudaoud95@gmail.com', 'success'); eePrint('✆  06 67 72 14 76'); },
  joke: () => {
    const jokes = [
      'Pourquoi les devs Java portent des lunettes ? Parce qu\'ils ne voient pas C#.',
      'Un null pointer entre dans un bar... Segmentation fault.',
      'git push --force : la solution aux conflits selon les juniors.',
      'Il y a 10 types de personnes : ceux qui comprennent le binaire, et les autres.',
      'Je voulais faire une blague sur les WebSockets... mais elle n\'avait pas de fin.',
    ];
    eePrint(jokes[Math.floor(Math.random()*jokes.length)], 'success');
  },
  matrix: () => {
    eePrint('Initialisation matrice...', 'accent');
    const chars = '日ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｪｩｨ01';
    let i=0;
    const iv = setInterval(() => {
      let line = '';
      for(let j=0;j<28;j++) line += chars[Math.floor(Math.random()*chars.length)];
      eePrint(line, 'accent');
      if(++i>10) clearInterval(iv);
    }, 80);
  },
  clear: () => { if(eeBody) eeBody.innerHTML=''; },
  exit:  () => { ee?.classList.add('hidden'); },
};

eeInput?.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const val = eeInput.value.trim().toLowerCase();
  if (!val) return;
  eePrint('$ ' + val);
  if (cmds[val]) cmds[val]();
  else eePrint(`Commande inconnue: "${val}". Tape 'help'.`, 'error');
  eeInput.value = '';
});

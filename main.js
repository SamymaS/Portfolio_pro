/* ============ CURSOR ============ */
const cursor = document.getElementById('cursor');
const cursorDot = document.getElementById('cursorDot');

let mouseX = 0, mouseY = 0;
let cursorX = 0, cursorY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  cursorDot.style.left = mouseX + 'px';
  cursorDot.style.top = mouseY + 'px';
});

function animateCursor() {
  cursorX += (mouseX - cursorX) * 0.12;
  cursorY += (mouseY - cursorY) * 0.12;
  cursor.style.left = cursorX + 'px';
  cursor.style.top = cursorY + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();

// Hover effect
document.querySelectorAll('a, button, .project-card, .skill-category, .filter-btn').forEach(el => {
  el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
  el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
});

/* ============ THREE.JS 3D SCENE ============ */
(function() {
  const canvas = document.getElementById('threeCanvas');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 30;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // --- Particle field ---
  const particleCount = 2000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 120;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 60;

    // Cyan to purple gradient by position
    const t = Math.random();
    colors[i * 3]     = t * 0.48;       // R
    colors[i * 3 + 1] = (1 - t) * 0.9;  // G
    colors[i * 3 + 2] = 1.0;             // B

    sizes[i] = Math.random() * 2 + 0.5;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // --- Floating geometric shapes ---
  const shapes = [];
  const shapeMaterials = [
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.15 }),
    new THREE.MeshBasicMaterial({ color: 0x7c3aed, wireframe: true, transparent: true, opacity: 0.12 }),
    new THREE.MeshBasicMaterial({ color: 0xff6b35, wireframe: true, transparent: true, opacity: 0.1 }),
  ];

  const geoTypes = [
    new THREE.IcosahedronGeometry(3, 1),
    new THREE.OctahedronGeometry(2.5, 0),
    new THREE.TetrahedronGeometry(2, 0),
    new THREE.IcosahedronGeometry(1.5, 0),
    new THREE.OctahedronGeometry(4, 1),
  ];

  for (let i = 0; i < 8; i++) {
    const geo = geoTypes[Math.floor(Math.random() * geoTypes.length)];
    const mat = shapeMaterials[Math.floor(Math.random() * shapeMaterials.length)];
    const mesh = new THREE.Mesh(geo, mat);

    mesh.position.set(
      (Math.random() - 0.5) * 60,
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 20 - 5
    );
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

    const speed = {
      rx: (Math.random() - 0.5) * 0.005,
      ry: (Math.random() - 0.5) * 0.005,
      rz: (Math.random() - 0.5) * 0.003,
      fy: Math.random() * 0.003 + 0.001,
      offset: Math.random() * Math.PI * 2,
    };

    shapes.push({ mesh, speed });
    scene.add(mesh);
  }

  // Mouse tracking
  let targetRotX = 0, targetRotY = 0;
  let currentRotX = 0, currentRotY = 0;

  window.addEventListener('mousemove', (e) => {
    targetRotY = ((e.clientX / window.innerWidth) - 0.5) * 0.4;
    targetRotX = ((e.clientY / window.innerHeight) - 0.5) * 0.2;
  });

  let clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    // Smooth mouse tracking
    currentRotX += (targetRotX - currentRotX) * 0.05;
    currentRotY += (targetRotY - currentRotY) * 0.05;

    // Particles gentle rotation
    particles.rotation.x = elapsed * 0.015 + currentRotX * 0.5;
    particles.rotation.y = elapsed * 0.02 + currentRotY * 0.5;

    // Shapes animation
    shapes.forEach(({ mesh, speed }) => {
      mesh.rotation.x += speed.rx;
      mesh.rotation.y += speed.ry;
      mesh.rotation.z += speed.rz;
      mesh.position.y += Math.sin(elapsed + speed.offset) * speed.fy * 0.1;
    });

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

/* ============ HERO ENTRANCE ANIMATION ============ */
window.addEventListener('load', () => {
  setTimeout(() => {
    document.querySelectorAll('.hero-tag, .hero-title .line, .hero-sub, .hero-ctas, .hero-socials')
      .forEach(el => el.classList.add('animate'));
  }, 200);
});

/* ============ SCROLL REVEAL ============ */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.section .reveal, .about-grid > *, .timeline-item, .skill-category, .project-card, .about-meta, .contact-grid > *, .section-header')
  .forEach((el, i) => {
    if (!el.classList.contains('reveal')) el.classList.add('reveal');
    revealObserver.observe(el);
  });

/* ============ NAVBAR SCROLL EFFECT ============ */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    navbar.style.background = 'rgba(8, 11, 16, 0.97)';
    navbar.style.borderBottomColor = 'rgba(255,255,255,0.08)';
  } else {
    navbar.style.background = 'rgba(8, 11, 16, 0.8)';
  }
});

/* ============ ACTIVE NAV LINK ============ */
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.style.color = '';
        if (link.getAttribute('href') === '#' + entry.target.id) {
          link.style.color = 'var(--accent)';
        }
      });
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => sectionObserver.observe(s));

/* ============ PROJECTS FILTER ============ */
const filterBtns = document.querySelectorAll('.filter-btn');
const projectCards = document.querySelectorAll('.project-card');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    projectCards.forEach(card => {
      if (filter === 'all' || card.dataset.cat === filter) {
        card.classList.remove('hidden');
        card.style.animation = 'fadeIn 0.4s ease forwards';
      } else {
        card.classList.add('hidden');
      }
    });
  });
});

// FadeIn keyframe injection
const style = document.createElement('style');
style.textContent = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}`;
document.head.appendChild(style);

/* ============ CONTACT FORM ============ */
const contactForm = document.getElementById('contactForm');
contactForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = contactForm.querySelector('button');
  const original = btn.textContent;
  btn.textContent = '✓ Message envoyé !';
  btn.style.background = '#22c55e';
  btn.style.color = '#000';
  setTimeout(() => {
    btn.textContent = original;
    btn.style.background = '';
    btn.style.color = '';
    contactForm.reset();
  }, 3000);
});

/* ============ SMOOTH SCROLL ============ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ============ TYPING EFFECT IN CODE BLOCK ============ */
const codeBlock = document.querySelector('.code-content');
if (codeBlock) {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      codeBlock.style.opacity = '0';
      setTimeout(() => {
        codeBlock.style.transition = 'opacity 0.5s';
        codeBlock.style.opacity = '1';
      }, 300);
      observer.disconnect();
    }
  }, { threshold: 0.5 });
  observer.observe(codeBlock);
}

/* ============ PARALLAX HERO ============ */
window.addEventListener('scroll', () => {
  const scrolled = window.scrollY;
  const hero = document.getElementById('hero');
  if (hero && scrolled < hero.offsetHeight) {
    const canvas = document.getElementById('threeCanvas');
    if (canvas) canvas.style.transform = `translateY(${scrolled * 0.3}px)`;
  }
});

/* ================================================================
   main.js — Portfolio Samy Boudaoud
   ================================================================ */
   'use strict';

   const $ = s => document.querySelector(s);
   const $$ = s => [...document.querySelectorAll(s)];
   const touch = () => window.matchMedia('(pointer:coarse)').matches;
   
   /* ── TOUT dans DOMContentLoaded pour garantir que le DOM est prêt ── */
   document.addEventListener('DOMContentLoaded', function() {
   
     /* ── CURSOR avec traînée de particules ─────────────────────────── */
     (function initCursor() {
       // Seulement sur vrais appareils pointer:fine (souris)
       if (!window.matchMedia('(pointer:fine) and (hover:hover)').matches) return;
   
       const ring    = document.getElementById('cursor-ring');
       const dot     = document.getElementById('cursor-dot');
       const canvas  = document.getElementById('cursor-canvas');
       if (!ring || !dot || !canvas) return;
   
       document.body.classList.add('custom-cursor');
       ring.style.opacity = '0';
       dot.style.opacity  = '0';
   
       // Canvas setup
       const ctx = canvas.getContext('2d');
       function resizeCanvas() {
         canvas.width  = window.innerWidth;
         canvas.height = window.innerHeight;
       }
       resizeCanvas();
       window.addEventListener('resize', resizeCanvas, {passive:true});
   
       let mx=0, my=0, rx=0, ry=0;
       let entered = false;
       const ACCENT = '#00e5ff';
   
       // Particle pool
       const particles = [];
       const MAX_P = 28;
   
       function spawnParticle(x, y) {
         const angle  = Math.random() * Math.PI * 2;
         const speed  = Math.random() * 1.2 + 0.3;
         const size   = Math.random() * 3 + 1;
         particles.push({
           x, y,
           vx: Math.cos(angle) * speed,
           vy: Math.sin(angle) * speed,
           life: 1,
           decay: Math.random() * 0.04 + 0.03,
           size,
           hue: Math.random() > 0.7 ? 280 : 185, // cyan ou violet
         });
         if (particles.length > MAX_P) particles.shift();
       }
   
       let frameCount = 0;
       function render() {
         requestAnimationFrame(render);
         ctx.clearRect(0, 0, canvas.width, canvas.height);
   
         // Lag sur l'anneau
         rx += (mx - rx) * 0.1;
         ry += (my - ry) * 0.1;
         ring.style.left = rx + 'px';
         ring.style.top  = ry + 'px';
   
         // Dot instantané
         dot.style.left = mx + 'px';
         dot.style.top  = my + 'px';
   
         // Spawn particule toutes les 2 frames si souris bouge
         frameCount++;
         if (frameCount % 2 === 0 && entered) spawnParticle(mx, my);
   
         // Draw & update particles
         for (let i = particles.length - 1; i >= 0; i--) {
           const p = particles[i];
           p.x  += p.vx;
           p.y  += p.vy;
           p.vx *= 0.94;
           p.vy *= 0.94;
           p.life -= p.decay;
           if (p.life <= 0) { particles.splice(i, 1); continue; }
   
           ctx.beginPath();
           ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
           ctx.fillStyle = p.hue === 185
             ? 'rgba(0,229,255,' + (p.life * 0.6) + ')'
             : 'rgba(124,58,237,' + (p.life * 0.5) + ')';
           ctx.fill();
         }
       }
       render();
   
       // Mouse events
       document.addEventListener('mousemove', e => {
         mx = e.clientX; my = e.clientY;
         if (!entered) {
           entered = true;
           ring.style.opacity = '1';
           dot.style.opacity  = '1';
           // Téléporte l'anneau au premier mouvement pour éviter l'animation depuis (0,0)
           rx = mx; ry = my;
         }
       });
   
       document.addEventListener('mouseleave', () => {
         entered = false;
         ring.style.opacity = '0';
         dot.style.opacity  = '0';
       });
   
       document.addEventListener('mousedown', () => ring.classList.add('clicking'));
       document.addEventListener('mouseup',   () => ring.classList.remove('clicking'));
   
       // Hover sur éléments interactifs — event delegation
       const HOVER_SEL = 'a,button,.proj-card,.skill-cat,.game-card,.filter-btn,.cert-card,.tl-body';
       document.addEventListener('mouseover', e => {
         if (e.target.closest(HOVER_SEL)) ring.classList.add('hover');
       });
       document.addEventListener('mouseout', e => {
         if (e.target.closest(HOVER_SEL)) ring.classList.remove('hover');
       });
     })();
   
     /* ── SCROLL PROGRESS + SCROLL-TO-TOP ───────────────────────────── */
     const progressBar = $('#scrollProgress');
     const scrollTopBtn = $('.scroll-top');
     window.addEventListener('scroll', ()=>{
       const max = document.body.scrollHeight - window.innerHeight;
       if(progressBar) progressBar.style.width=(max>0?window.scrollY/max*100:0)+'%';
       if(scrollTopBtn) scrollTopBtn.classList.toggle('show', window.scrollY>400);
     }, {passive:true});
     if(scrollTopBtn) scrollTopBtn.addEventListener('click', ()=>window.scrollTo({top:0,behavior:'smooth'}));
   
     /* ── NAVBAR ────────────────────────────────────────────────────── */
     const navbar = $('#navbar');
     function updateNavBg() {
       if(navbar) navbar.classList.toggle('scrolled', window.scrollY>60);
     }
     window.addEventListener('scroll', updateNavBg, {passive:true});
   
     /* ── THEME TOGGLE ──────────────────────────────────────────────── */
     const html = document.documentElement;
     let dark = localStorage.getItem('sb-theme') !== 'light';
     function applyTheme(d) {
       dark = d;
       html.setAttribute('data-theme', dark ? 'dark' : 'light');
       const btn = $('#themeBtn');
       if(btn) btn.textContent = dark ? '☀' : '🌙';
       localStorage.setItem('sb-theme', dark ? 'dark' : 'light');
       updateNavBg();
     }
     applyTheme(dark);
     const themeBtn = $('#themeBtn');
     if(themeBtn) themeBtn.addEventListener('click', ()=>applyTheme(!dark));
   
     /* ── HAMBURGER ─────────────────────────────────────────────────── */
     const hamburger = $('#hamburger');
     const mobileMenu = $('#mobileMenu');
     let menuOpen = false;
     function setMenu(open) {
       menuOpen = open;
       if(hamburger) hamburger.classList.toggle('open', open);
       if(mobileMenu) mobileMenu.classList.toggle('open', open);
       document.body.style.overflow = open ? 'hidden' : '';
     }
     if(hamburger) hamburger.addEventListener('click', ()=>setMenu(!menuOpen));
     $$('.mob-link').forEach(l=>l.addEventListener('click', ()=>setMenu(false)));
     document.addEventListener('keydown', e=>{
       if(e.key==='Escape'){ setMenu(false); const ee=$('.ee-wrap'); if(ee) ee.classList.add('hidden'); }
     });
   
     /* ── ACTIVE NAV ────────────────────────────────────────────────── */
     const secObs = new IntersectionObserver(entries=>{
       entries.forEach(e=>{
         if(!e.isIntersecting) return;
         $$('.nav-link,.mob-link').forEach(l=>{
           l.classList.toggle('active', l.getAttribute('href')==='#'+e.target.id);
         });
       });
     },{threshold:.3});
     $$('section[id]').forEach(s=>secObs.observe(s));
   
     /* ── THREE.JS HERO ─────────────────────────────────────────────── */
     (function initThree(){
       const canvas=$('#threeCanvas');
       if(!canvas||typeof THREE==='undefined') return;
       const scene=new THREE.Scene();
       const cam=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,1000);
       cam.position.z=30;
       const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
       renderer.setSize(innerWidth,innerHeight);
       renderer.setPixelRatio(Math.min(devicePixelRatio,2));
       const N=touch()?500:1800;
       const geo=new THREE.BufferGeometry();
       const pos=new Float32Array(N*3),col=new Float32Array(N*3);
       for(let i=0;i<N;i++){
         pos[i*3]=(Math.random()-.5)*110;pos[i*3+1]=(Math.random()-.5)*75;pos[i*3+2]=(Math.random()-.5)*55;
         const t=Math.random();col[i*3]=t*.48;col[i*3+1]=(1-t)*.9;col[i*3+2]=1;
       }
       geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
       geo.setAttribute('color',new THREE.BufferAttribute(col,3));
       const pts=new THREE.Points(geo,new THREE.PointsMaterial({size:.13,vertexColors:true,transparent:true,opacity:.7}));
       scene.add(pts);
       const mats=[
         new THREE.MeshBasicMaterial({color:0x00e5ff,wireframe:true,transparent:true,opacity:.13}),
         new THREE.MeshBasicMaterial({color:0x7c3aed,wireframe:true,transparent:true,opacity:.10}),
       ];
       const geos=[new THREE.IcosahedronGeometry(3,1),new THREE.OctahedronGeometry(2.5,0),new THREE.TetrahedronGeometry(2,0)];
       const shapes=[];
       for(let i=0;i<(touch()?2:5);i++){
         const m=new THREE.Mesh(geos[i%3],mats[i%2]);
         m.position.set((Math.random()-.5)*55,(Math.random()-.5)*38,(Math.random()-.5)*18-4);
         m.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,0);
         shapes.push({m,rx:(Math.random()-.5)*.004,ry:(Math.random()-.5)*.004,o:Math.random()*Math.PI*2});
         scene.add(m);
       }
       let tRx=0,tRy=0,cRx=0,cRy=0;
       if(!touch()) window.addEventListener('mousemove',e=>{
         tRy=(e.clientX/innerWidth-.5)*.3;tRx=(e.clientY/innerHeight-.5)*.15;
       });
       let t=0,last=performance.now();
       (function render(now){
         requestAnimationFrame(render);
         const dt=Math.min((now-last)/1000,.05);last=now;t+=dt;
         cRx+=(tRx-cRx)*.05;cRy+=(tRy-cRy)*.05;
         pts.rotation.x=t*.013+cRx*.5;pts.rotation.y=t*.018+cRy*.5;
         shapes.forEach(({m,rx,ry,o})=>{m.rotation.x+=rx;m.rotation.y+=ry;m.position.y+=Math.sin(t+o)*.003;});
         renderer.render(scene,cam);
       })(last);
       window.addEventListener('resize',()=>{
         cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
       });
       window.addEventListener('scroll',()=>{
         if(scrollY<innerHeight) canvas.style.transform=`translateY(${scrollY*.2}px)`;
       },{passive:true});
     })();
   
     /* ── HERO ENTRANCE ─────────────────────────────────────────────── */
     function triggerHeroAnim() {
       const hero = $('#hero');
       if(!hero) return;
       if(window.scrollY < window.innerHeight * 0.5){
         $$('.hero-tag,.hero-sub,.hero-ctas,.hero-socials').forEach(el=>el.classList.add('will-animate'));
         $$('.hero-title .line').forEach(el=>el.classList.add('will-animate'));
         requestAnimationFrame(()=>requestAnimationFrame(()=>hero.classList.add('hero-ready')));
       }
     }
     window.addEventListener('load', ()=>setTimeout(triggerHeroAnim, 50));
   
     /* ── SCROLL REVEAL ─────────────────────────────────────────────── */
     const revObs = new IntersectionObserver(entries=>{
       entries.forEach(e=>{
         if(e.isIntersecting){ e.target.classList.add('visible'); revObs.unobserve(e.target); }
       });
     },{threshold:.07,rootMargin:'0px 0px -20px 0px'});
   
     function observeReveals(){
       const vH = window.innerHeight;
       $$('.reveal').forEach(el=>{
         if(el.classList.contains('visible')) return;
         const rect = el.getBoundingClientRect();
         if(rect.top < vH && rect.bottom > 0){
           el.classList.add('visible');
         } else {
           el.classList.add('will-animate');
           revObs.observe(el);
         }
       });
     }
     // Double rAF: ensures layout is painted before we measure positions
     requestAnimationFrame(()=>requestAnimationFrame(observeReveals));
   
     /* ── STATS COUNTER ─────────────────────────────────────────────── */
     const statsObs=new IntersectionObserver(entries=>{
       entries.forEach(entry=>{
         if(!entry.isIntersecting) return;
         entry.target.querySelectorAll('.stat-num').forEach(el=>{
           const target=+el.dataset.target,dur=1500,start=performance.now();
           (function tick(now){
             const p=Math.min((now-start)/dur,1);
             el.textContent=Math.round((1-Math.pow(1-p,3))*target);
             if(p<1) requestAnimationFrame(tick);
           })(start);
         });
         statsObs.unobserve(entry.target);
       });
     },{threshold:.5});
     const statsBar=$('.stats-bar');
     if(statsBar) statsObs.observe(statsBar);
   
     /* ── PROJECT FILTER ────────────────────────────────────────────── */
     $$('.filter-btn').forEach(btn=>{
       btn.addEventListener('click',()=>{
         $$('.filter-btn').forEach(b=>b.classList.remove('active'));
         btn.classList.add('active');
         const f=btn.dataset.filter;
         $$('.proj-card').forEach(c=>{
           const show=f==='all'||c.dataset.cat===f;
           c.classList.toggle('hidden',!show);
           if(show){ c.style.animation='none'; void c.offsetWidth; c.style.animation='cardIn .3s ease'; }
         });
       });
     });
     const s1=document.createElement('style');
     s1.textContent='@keyframes cardIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}';
     document.head.appendChild(s1);
   
     $$('.proj-card').forEach(card=>{
       card.addEventListener('click',e=>{
         if(e.target.closest('.proj-link')) return;
         const link=card.querySelector('.proj-link');
         if(link&&link.href&&link.href!=='#') window.open(link.href,'_blank');
       });
     });
   
     /* ── SMOOTH SCROLL ─────────────────────────────────────────────── */
     $$('a[href^="#"]').forEach(a=>{
       a.addEventListener('click',e=>{
         const href=a.getAttribute('href');
         if(!href||href==='#') return;
         const target=document.querySelector(href);
         if(target){
           e.preventDefault();
           setMenu(false);
           const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'))||64;
           const top = target.getBoundingClientRect().top + window.scrollY - navH;
           window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
         }
       });
     });
   
     /* ── CONTACT FORM (EmailJS) ────────────────────────────────────── */
     const form=$('#contactForm');
     if(form){
       const EMAILJS_SERVICE  = 'service_w9mc9od';
       const EMAILJS_TEMPLATE = 'template_jh6ptam';
       const EMAILJS_KEY      = 'kvrIDeCmjxUFxlP6O';
   
       function getVal(n){ return (form.querySelector('[name="'+n+'"]')||{}).value?.trim()||''; }
       function setErr(n,msg){
         const inp=form.querySelector('[name="'+n+'"]');
         const err=form.querySelector('[data-err="'+n+'"]');
         if(inp){inp.classList.add('is-err');inp.classList.remove('is-ok');}
         if(err){err.textContent=msg;err.classList.add('show');}
       }
       function clearErr(n){
         const inp=form.querySelector('[name="'+n+'"]');
         const err=form.querySelector('[data-err="'+n+'"]');
         if(inp) inp.classList.remove('is-err');
         if(err) err.classList.remove('show');
       }
       function setOk(n){
         const inp=form.querySelector('[name="'+n+'"]');
         if(inp){inp.classList.remove('is-err');inp.classList.add('is-ok');}
       }
       function validateField(n){
         const val=getVal(n);
         if(n==='name'){if(!val){setErr(n,'Nom requis');return false;}setOk(n);clearErr(n);return true;}
         if(n==='email'){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)){setErr(n,'Email invalide');return false;}setOk(n);clearErr(n);return true;}
         if(n==='message'){if(val.length<5){setErr(n,'Message requis');return false;}setOk(n);clearErr(n);return true;}
         return true;
       }
       form.querySelectorAll('.form-input').forEach(inp=>{
         inp.addEventListener('blur',()=>validateField(inp.name));
         inp.addEventListener('input',()=>{ if(inp.classList.contains('is-err')) validateField(inp.name); });
       });
       form.addEventListener('submit',async e=>{
         e.preventDefault();
         if(!['name','email','message'].every(f=>validateField(f))) return;
         const btn=form.querySelector('[type="submit"]');
         const orig=btn.textContent;
         btn.disabled=true; btn.textContent='Envoi…';
         try {
           if(typeof emailjs!=='undefined'){
             await emailjs.sendForm(EMAILJS_SERVICE,EMAILJS_TEMPLATE,form,EMAILJS_KEY);
           } else {
             await new Promise(r=>setTimeout(r,800));
           }
           btn.textContent='✓ Envoyé !'; btn.classList.add('ok');
           form.reset();
           form.querySelectorAll('.form-input').forEach(i=>i.classList.remove('is-ok','is-err'));
           setTimeout(()=>{btn.disabled=false;btn.textContent=orig;btn.classList.remove('ok');},3500);
         } catch(err){
           btn.textContent='Erreur, réessayez';
           setTimeout(()=>{btn.disabled=false;btn.textContent=orig;},3000);
         }
       });
     }
   
     /* ── EASTER EGG TERMINAL ───────────────────────────────────────── */
     (function initEE(){
       const wrap=$('.ee-wrap'), body=$('#eeBody'), input=$('#eeInput'), close=$('#eeClose');
       if(!wrap) return;
       let kbuf='';
       document.addEventListener('keydown',e=>{
         if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
         if(e.key==='Escape'){wrap.classList.add('hidden');return;}
         kbuf=(kbuf+e.key.toLowerCase()).slice(-2);
         if(kbuf==='sb') openEE();
       });
       if(close) close.addEventListener('click',()=>wrap.classList.add('hidden'));
       function openEE(){
         wrap.classList.remove('hidden');
         if(body) body.innerHTML='';
         print('Bienvenue dans le terminal de Samy ! 👾','a');
         print('─────────────────────────────');
         print("Tape 'help' pour les commandes.",'ok');
         if(input) input.focus();
       }
       function print(text,cls){
         if(!body) return;
         const s=document.createElement('span');
         s.className='ee-line'+(cls?' '+cls:'');
         s.textContent=text;
         body.appendChild(s);
         body.scrollTop=body.scrollHeight;
       }
       const cmds={
         help:()=>{ print('Commands:','a'); ['whoami','stack','github','linkedin','contact','joke','matrix','clear','exit'].forEach(c=>print('  '+c)); },
         whoami:()=>{ print('Samy Boudaoud — Software Engineer Fullstack & IoT','ok'); print('24y · Aix-en-Provence · @CS GROUP'); },
         stack:()=>{ print('Backend  → Java, Kotlin, Python, Spring, Flask','a'); print('Mobile   → Flutter, Dart, React Native'); print('IoT      → ESP32, Raspberry Pi, MQTT, BLE'); print('Devops   → Git, Docker, CI/CD, Ansible'); },
         github:()=>{ print('→ https://github.com/SamymaS','ok'); window.open('https://github.com/SamymaS','_blank'); },
         linkedin:()=>{ print('→ https://linkedin.com/in/samy-boudaoud','ok'); window.open('https://www.linkedin.com/in/samy-boudaoud','_blank'); },
         contact:()=>{ print('✉  samyboudaoud95@gmail.com','ok'); print('✆  06 67 72 14 76'); },
         joke:()=>{ const j=['Pourquoi les devs Java portent des lunettes ? Ils ne voient pas C#.','Un null pointer entre dans un bar... Segfault.','git push --force: solution aux conflits selon les juniors.','Il y a 10 types de personnes: ceux qui comprennent le binaire, et les autres.','Mon code compile. Je ne sais pas pourquoi. Je ne touche plus rien.']; print(j[Math.floor(Math.random()*j.length)],'ok'); },
         matrix:()=>{ print('Initializing matrix…','a'); const chars='日ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｪｩｨ01'; let i=0; const iv=setInterval(()=>{ let l=''; for(let j=0;j<26;j++) l+=chars[Math.floor(Math.random()*chars.length)]; print(l,'a'); if(++i>10) clearInterval(iv); },80); },
         clear:()=>{ if(body) body.innerHTML=''; },
         exit:()=>wrap.classList.add('hidden'),
       };
       if(input) input.addEventListener('keydown',e=>{
         if(e.key!=='Enter') return;
         const val=input.value.trim().toLowerCase();
         if(!val) return;
         print('$ '+val);
         cmds[val]?cmds[val]():print('Unknown: "'+val+'". Type \'help\'.','err');
         input.value='';
       });
     })();
   
     /* ── I18N ──────────────────────────────────────────────────────── */
     if(window.i18n) window.i18n.init();
   
   }); // end DOMContentLoaded
/* ================================================================
   main.js — Portfolio Samy Boudaoud
   ================================================================ */
   'use strict';

   // Mark JS as running — CSS uses this to enable animations
   // Without this, all content is visible even without JS
   document.body.classList.add('js-ready');
   
   const $ = s => document.querySelector(s);
   const $$ = s => [...document.querySelectorAll(s)];
   const touch = () => window.matchMedia('(pointer:coarse)').matches;
   
   /* ── CURSOR ──────────────────────────────────────────────────────── */
   (function initCursor() {
     const c = $('#cursor'), d = $('#cursorDot');
     if (!c || touch()) return;
     let mx=0,my=0,cx=0,cy=0;
     document.addEventListener('mousemove', e => {
       mx=e.clientX; my=e.clientY;
       d.style.cssText=`left:${mx}px;top:${my}px`;
     });
     (function loop(){
       cx+=(mx-cx)*.12; cy+=(my-cy)*.12;
       c.style.cssText=`left:${cx}px;top:${cy}px`;
       requestAnimationFrame(loop);
     })();
     $$('a,button,.proj-card,.skill-cat,.game-card').forEach(el=>{
       el.addEventListener('mouseenter',()=>c.classList.add('hover'));
       el.addEventListener('mouseleave',()=>c.classList.remove('hover'));
     });
   })();
   
   /* ── SCROLL PROGRESS + SCROLL-TO-TOP ─────────────────────────────── */
   const progressBar = $('#scrollProgress');
   const scrollTopBtn = $('.scroll-top');
   window.addEventListener('scroll', ()=>{
     const max = document.body.scrollHeight - window.innerHeight;
     if(progressBar) progressBar.style.width=(max>0?window.scrollY/max*100:0)+'%';
     scrollTopBtn?.classList.toggle('show', window.scrollY>400);
   }, {passive:true});
   scrollTopBtn?.addEventListener('click', ()=>window.scrollTo({top:0,behavior:'smooth'}));
   
   /* ── THEME TOGGLE ────────────────────────────────────────────────── */
   const html = document.documentElement;
   let dark = localStorage.getItem('sb-theme') !== 'light';
   function applyTheme(d) {
     dark=d;
     html.setAttribute('data-theme', dark?'dark':'light');
     const btn=$('#themeBtn');
     if(btn) btn.textContent = dark?'☀':'🌙';
     localStorage.setItem('sb-theme', dark?'dark':'light');
     updateNavBg();
   }
   applyTheme(dark);
   $('#themeBtn')?.addEventListener('click', ()=>applyTheme(!dark));
   
   /* ── NAVBAR SCROLL ───────────────────────────────────────────────── */
   const navbar = $('#navbar');
   function updateNavBg() {
     navbar?.classList.toggle('scrolled', window.scrollY>60);
   }
   window.addEventListener('scroll', updateNavBg, {passive:true});
   
   /* ── HAMBURGER ───────────────────────────────────────────────────── */
   const hamburger = $('#hamburger');
   const mobileMenu = $('#mobileMenu');
   let menuOpen = false;
   
   function setMenu(open) {
     menuOpen=open;
     hamburger?.classList.toggle('open', open);
     mobileMenu?.classList.toggle('open', open);
     document.body.style.overflow = open?'hidden':'';
   }
   hamburger?.addEventListener('click', ()=>setMenu(!menuOpen));
   $$('.mob-link').forEach(l=>l.addEventListener('click', ()=>{
     setMenu(false);
   }));
   document.addEventListener('keydown', e=>{
     if(e.key==='Escape'){setMenu(false); $('.ee-wrap')?.classList.add('hidden');}
   });
   
   /* ── ACTIVE NAV HIGHLIGHT ────────────────────────────────────────── */
   const secObs = new IntersectionObserver(entries=>{
     entries.forEach(e=>{
       if(!e.isIntersecting) return;
       $$('.nav-link,.mob-link').forEach(l=>{
         l.classList.toggle('active', l.getAttribute('href')==='#'+e.target.id);
       });
     });
   },{threshold:.3});
   $$('section[id]').forEach(s=>secObs.observe(s));
   
   /* ── THREE.JS HERO ───────────────────────────────────────────────── */
   (function initThree(){
     const canvas=$('#threeCanvas');
     if(!canvas||typeof THREE==='undefined') return;
     const scene=new THREE.Scene();
     const cam=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,1000);
     cam.position.z=30;
     const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
     renderer.setSize(innerWidth,innerHeight);
     renderer.setPixelRatio(Math.min(devicePixelRatio,2));
   
     // particles
     const N=touch()?500:1800;
     const geo=new THREE.BufferGeometry();
     const pos=new Float32Array(N*3),col=new Float32Array(N*3);
     for(let i=0;i<N;i++){
       pos[i*3]=(Math.random()-.5)*110;
       pos[i*3+1]=(Math.random()-.5)*75;
       pos[i*3+2]=(Math.random()-.5)*55;
       const t=Math.random();
       col[i*3]=t*.48;col[i*3+1]=(1-t)*.9;col[i*3+2]=1;
     }
     geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
     geo.setAttribute('color',new THREE.BufferAttribute(col,3));
     const pts=new THREE.Points(geo,
       new THREE.PointsMaterial({size:.13,vertexColors:true,transparent:true,opacity:.7}));
     scene.add(pts);
   
     // shapes
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
       tRy=(e.clientX/innerWidth-.5)*.3;
       tRx=(e.clientY/innerHeight-.5)*.15;
     });
   
     let t=0,last=performance.now();
     (function render(now){
       requestAnimationFrame(render);
       const dt=Math.min((now-last)/1000,.05); last=now; t+=dt;
       cRx+=(tRx-cRx)*.05; cRy+=(tRy-cRy)*.05;
       pts.rotation.x=t*.013+cRx*.5;
       pts.rotation.y=t*.018+cRy*.5;
       shapes.forEach(({m,rx,ry,o})=>{
         m.rotation.x+=rx;m.rotation.y+=ry;
         m.position.y+=Math.sin(t+o)*.003;
       });
       renderer.render(scene,cam);
     })(last);
   
     window.addEventListener('resize',()=>{
       cam.aspect=innerWidth/innerHeight;
       cam.updateProjectionMatrix();
       renderer.setSize(innerWidth,innerHeight);
     });
     window.addEventListener('scroll',()=>{
       if(scrollY<innerHeight) canvas.style.transform=`translateY(${scrollY*.2}px)`;
     },{passive:true});
   })();
   
   /* ── HERO ENTRANCE ───────────────────────────────────────────────── */
   // Uses CSS transitions triggered by .hero-ready class on #hero
   // We add it after fonts + layout are ready
   function triggerHeroAnim() {
     const hero=$('#hero');
     if(!hero) return;
     hero.classList.add('hero-ready');
   }
   if(document.readyState==='complete'){
     setTimeout(triggerHeroAnim,100);
   } else {
     window.addEventListener('load',()=>setTimeout(triggerHeroAnim,100));
   }
   
   /* ── SCROLL REVEAL ───────────────────────────────────────────────── */
   const revObs=new IntersectionObserver(entries=>{
     entries.forEach(e=>{if(e.isIntersecting) e.target.classList.add('visible');});
   },{threshold:.07,rootMargin:'0px 0px -20px 0px'});
   // Observe all .reveal elements — and re-observe after lang change
   function observeReveals(){
     $$('.reveal').forEach(el=>{
       // Don't re-add observer if already visible
       if(!el.classList.contains('visible')) revObs.observe(el);
     });
   }
   observeReveals();
   
   /* ── STATS COUNTER ───────────────────────────────────────────────── */
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
   
   /* ── PROJECT FILTER ──────────────────────────────────────────────── */
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
   (()=>{const s=document.createElement('style');
     s.textContent='@keyframes cardIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}';
     document.head.appendChild(s);
   })();
   
   // Project cards clickable
   $$('.proj-card').forEach(card=>{
     card.addEventListener('click',e=>{
       if(e.target.closest('.proj-link')) return; // let link handle itself
       const link=card.querySelector('.proj-link');
       if(link&&link.href&&link.href!=='#') window.open(link.href,'_blank');
     });
   });
   
   /* ── SMOOTH SCROLL ───────────────────────────────────────────────── */
   function initSmoothScroll() {
     $$('a[href^="#"]').forEach(a=>{
       a.addEventListener('click',e=>{
         const href=a.getAttribute('href');
         if(!href||href==='#') return;
         const target=document.querySelector(href);
         if(target){
           e.preventDefault();
           setMenu(false);
           const top = target.getBoundingClientRect().top + window.scrollY
                       - parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')||'64');
           window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
         }
       });
     });
   }
   // Run immediately AND after DOM ready (belt + suspenders)
   initSmoothScroll();
   if(document.readyState==='loading'){
     document.addEventListener('DOMContentLoaded', initSmoothScroll);
   }
   
   /* ── CONTACT FORM (EmailJS) ──────────────────────────────────────── */
   (function initContactForm(){
     const form=$('#contactForm');
     if(!form) return;
   
     // EmailJS config — replace with your real IDs after signing up at emailjs.com
     const EMAILJS_SERVICE  = 'service_w9mc9od';
     const EMAILJS_TEMPLATE = 'template_jh6ptam';
     const EMAILJS_KEY      = 'kvrIDeCmjxUFxlP6O';
   
     function getVal(name){ return form.querySelector(`[name="${name}"]`)?.value.trim()||''; }
     function setErr(name,msg){
       const inp=form.querySelector(`[name="${name}"]`);
       const err=form.querySelector(`[data-err="${name}"]`);
       inp?.classList.add('is-err'); inp?.classList.remove('is-ok');
       if(err){err.textContent=msg;err.classList.add('show');}
     }
     function clearErr(name){
       const inp=form.querySelector(`[name="${name}"]`);
       const err=form.querySelector(`[data-err="${name}"]`);
       inp?.classList.remove('is-err');
       if(err) err.classList.remove('show');
     }
     function setOk(name){
       const inp=form.querySelector(`[name="${name}"]`);
       inp?.classList.remove('is-err');inp?.classList.add('is-ok');
     }
   
     // Real-time validation
     form.querySelectorAll('.form-input').forEach(inp=>{
       inp.addEventListener('blur',()=>validateField(inp.name||inp.id));
       inp.addEventListener('input',()=>{
         if(inp.classList.contains('is-err')) validateField(inp.name||inp.id);
       });
     });
   
     function validateField(name){
       const val=getVal(name);
       const lang=window.i18n?.t;
       if(name==='name'){
         if(!val){setErr(name,lang?lang('form_err_name'):'Nom requis');return false;}
         setOk(name);clearErr(name);return true;
       }
       if(name==='email'){
         if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)){setErr(name,lang?lang('form_err_email'):'Email invalide');return false;}
         setOk(name);clearErr(name);return true;
       }
       if(name==='message'){
         if(val.length<10){setErr(name,lang?lang('form_err_msg'):'Message requis');return false;}
         setOk(name);clearErr(name);return true;
       }
       return true;
     }
   
     form.addEventListener('submit',async e=>{
       e.preventDefault();
       const fields=['name','email','message'];
       const valid=fields.every(f=>validateField(f));
       if(!valid) return;
   
       const btn=form.querySelector('[type="submit"]');
       const lang=window.i18n?.t;
       const origText=btn.textContent;
       btn.disabled=true;
       btn.textContent=lang?lang('form_sending'):'Envoi…';
   
       try {
         // If EmailJS is loaded, send via it
         if(typeof emailjs!=='undefined'){
           await emailjs.sendForm(EMAILJS_SERVICE,EMAILJS_TEMPLATE,form,EMAILJS_KEY);
         } else {
           // Fallback: simulate for demo
           await new Promise(r=>setTimeout(r,900));
         }
         btn.textContent=lang?lang('form_sent'):'✓ Envoyé !';
         btn.classList.add('ok');
         form.reset();
         fields.forEach(f=>{ form.querySelector(`[name="${f}"]`)?.classList.remove('is-ok','is-err'); });
         setTimeout(()=>{ btn.disabled=false; btn.textContent=origText; btn.classList.remove('ok'); },3500);
       } catch(err) {
         btn.textContent=lang?lang('form_err_send'):'Erreur, réessayez';
         setTimeout(()=>{ btn.disabled=false; btn.textContent=origText; },3000);
       }
     });
   })();
   
   /* ── EASTER EGG TERMINAL ─────────────────────────────────────────── */
   (function initEE(){
     const wrap=$('.ee-wrap');
     const body=$('#eeBody');
     const input=$('#eeInput');
     const close=$('#eeClose');
     if(!wrap) return;
   
     let kbuf='';
     document.addEventListener('keydown',e=>{
       if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
       if(e.key==='Escape'){wrap.classList.add('hidden');return;}
       kbuf=(kbuf+e.key.toLowerCase()).slice(-2);
       if(kbuf==='sb') open();
     });
     close?.addEventListener('click',()=>wrap.classList.add('hidden'));
   
     function open(){
       wrap.classList.remove('hidden');
       if(body) body.innerHTML='';
       print(window.i18n?.t('ee_welcome')||'Bienvenue 👾','a');
       print('─────────────────────────────');
       print(window.i18n?.t('ee_hint')||"Tape 'help'.",'ok');
       input?.focus();
     }
     function print(text,cls=''){
       const s=document.createElement('span');
       s.className='ee-line'+(cls?' '+cls:'');
       s.textContent=text;
       body?.appendChild(s);
       if(body) body.scrollTop=body.scrollHeight;
     }
     const cmds={
       help:()=>{
         print('Commands:','a');
         ['whoami','stack','github','linkedin','contact','joke','matrix','clear','exit'].forEach(c=>print('  '+c));
       },
       whoami:()=>{print('Samy Boudaoud — Software Engineer Fullstack & IoT','ok');print('24y · Aix-en-Provence · @CS GROUP');},
       stack:()=>{
         print('Backend  → Java, Kotlin, Python, Spring, Flask','a');
         print('Mobile   → Flutter, Dart, React Native');
         print('IoT      → ESP32, Raspberry Pi, MQTT, BLE');
         print('Devops   → Git, Docker, CI/CD, Ansible');
       },
       github:()=>{print('→ https://github.com/SamymaS','ok');window.open('https://github.com/SamymaS','_blank');},
       linkedin:()=>{print('→ https://linkedin.com/in/samy-boudaoud','ok');window.open('https://www.linkedin.com/in/samy-boudaoud','_blank');},
       contact:()=>{print('✉  samyboudaoud95@gmail.com','ok');print('✆  06 67 72 14 76');},
       joke:()=>{
         const j=['Pourquoi les devs Java portent des lunettes ? Ils ne voient pas C#.',
           'Un null pointer entre dans un bar... Segfault.',
           'git push --force: solution aux conflits selon les juniors.',
           'Il y a 10 types de personnes: ceux qui comprennent le binaire, et les autres.',
           'Mon code compile. Je ne sais pas pourquoi. Je ne touche plus rien.',
         ];
         print(j[Math.floor(Math.random()*j.length)],'ok');
       },
       matrix:()=>{
         print('Initializing matrix…','a');
         const chars='日ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｪｩｨ01';
         let i=0;const iv=setInterval(()=>{
           let l='';for(let j=0;j<26;j++) l+=chars[Math.floor(Math.random()*chars.length)];
           print(l,'a');if(++i>10) clearInterval(iv);
         },80);
       },
       clear:()=>{if(body) body.innerHTML='';},
       exit:()=>wrap.classList.add('hidden'),
     };
     input?.addEventListener('keydown',e=>{
       if(e.key!=='Enter') return;
       const val=input.value.trim().toLowerCase();
       if(!val) return;
       print('$ '+val);
       cmds[val]?cmds[val]():print(`Unknown: "${val}". Type 'help'.`,'err');
       input.value='';
     });
   })();
   
   /* ── I18N INIT (after DOM ready) ─────────────────────────────────── */
   if(document.readyState==='loading'){
     document.addEventListener('DOMContentLoaded',()=>window.i18n?.init());
   } else {
     window.i18n?.init();
   }
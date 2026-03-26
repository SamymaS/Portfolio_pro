/* ================================================================
   games.js — 8 mini-games (responsive, mobile-friendly)
   ================================================================ */
'use strict';

const gameModal     = document.getElementById('gameModal');
const gameTitle     = document.getElementById('gameTitle');
const gameClose     = document.getElementById('gameClose');
const gameContainer = document.getElementById('gameContainer');

const TITLES = {
  connect4:'🔴 Puissance 4 vs IA', snake:'🐍 Snake',
  breakout:'🧱 Casse-Briques', quiz:'💡 Quiz Tech',
  memory:'🧠 Memory', '2048':'2️⃣ 2048',
  simon:'🎯 Simon Says', tictactoe:'⭕ Tic Tac Toe',
};

function openGame(name) {
  gameModal.classList.remove('hidden');
  gameTitle.textContent = TITLES[name]||name;
  gameContainer.innerHTML = '';
  document.body.style.overflow='hidden';
  ({connect4:initConnect4,snake:initSnake,breakout:initBreakout,
    quiz:initQuiz,memory:initMemory,'2048':init2048,
    simon:initSimon,tictactoe:initTicTacToe}[name]||function(){})();
}
function closeGame() {
  gameModal.classList.add('hidden');
  gameContainer.innerHTML='';
  document.body.style.overflow='';
  cancelAnimationFrame(window._gRAF);
  clearInterval(window._gInt);
}
document.querySelectorAll('[data-game]').forEach(btn=>btn.addEventListener('click',()=>openGame(btn.dataset.game)));
gameClose?.addEventListener('click',closeGame);
gameModal?.addEventListener('click',e=>{if(e.target===gameModal) closeGame();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!gameModal.classList.contains('hidden')) closeGame();});

/* ── helpers ── */
function availW(){ return Math.min(gameContainer.clientWidth-24, 520); }
function mkBtn(text,cls='btn btn-primary'){
  const b=document.createElement('button');
  b.textContent=text; b.className=cls;
  b.style.cssText='font-size:.72rem;padding:.55rem 1.2rem;margin-top:.5rem';
  return b;
}
function mkWrap(extra=''){
  const d=document.createElement('div');
  d.style.cssText='display:flex;flex-direction:column;align-items:center;gap:.8rem;width:100%'+extra;
  return d;
}
function mkStatus(color='var(--accent)'){
  const d=document.createElement('div');
  d.style.cssText=`font-family:var(--fm);font-size:.78rem;color:${color};min-height:1.4rem;text-align:center`;
  return d;
}

/* ── CONNECT 4 ───────────────────────────────────────────────────── */
function initConnect4(){
  const COLS=7,ROWS=6,AC='#00e5ff',P2='#f97316',EMPTY='#1a2535',BG='#0d1117';
  let board,player,over;
  const cw=Math.floor(Math.min(availW(),380)/COLS);
  const wrap=mkWrap(), status=mkStatus(), rst=mkBtn('↺ Rejouer');
  const canvas=document.createElement('canvas');
  canvas.width=COLS*cw; canvas.height=ROWS*cw;
  canvas.style.cssText=`border-radius:8px;width:100%;max-width:${canvas.width}px;cursor:pointer;touch-action:manipulation`;
  wrap.append(status,canvas,rst); gameContainer.appendChild(wrap);
  const ctx=canvas.getContext('2d');

  function newGame(){board=Array.from({length:ROWS},()=>Array(COLS).fill(0));player=1;over=false;status.textContent='Votre tour (🔵)';draw();}
  function draw(){
    ctx.fillStyle=BG;ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      ctx.beginPath();ctx.arc(c*cw+cw/2,r*cw+cw/2,cw/2-3,0,Math.PI*2);
      ctx.fillStyle=board[r][c]===1?AC:board[r][c]===2?P2:EMPTY;ctx.fill();
    }
  }
  function drop(col){for(let r=ROWS-1;r>=0;r--)if(!board[r][col]){board[r][col]=player;return r;}return -1;}
  function win(b,p){
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)for(const[dr,dc]of[[0,1],[1,0],[1,1],[1,-1]]){
      let n=0;for(let k=0;k<4;k++){const nr=r+dr*k,nc=c+dc*k;if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&b[nr][nc]===p)n++;else break;}if(n===4)return true;
    }return false;
  }
  function full(b){return b[0].every(c=>c!==0);}
  function validCols(b){return [...Array(COLS).keys()].filter(c=>b[0][c]===0);}
  function dropB(b,c,p){for(let r=ROWS-1;r>=0;r--)if(!b[r][c]){b[r][c]=p;return;}}
  function score(b,p){let s=0;const o=p===1?2:1,ch=a=>{const pc=a.filter(x=>x===p).length,ec=a.filter(x=>!x).length,oc=a.filter(x=>x===o).length;if(pc===4)s+=1e4;else if(pc===3&&ec===1)s+=10;else if(pc===2&&ec===2)s+=2;if(oc===3&&ec===1)s-=50;if(oc===4)s-=1e4;};
    for(let r=0;r<ROWS;r++)for(let c=0;c<=COLS-4;c++)ch([b[r][c],b[r][c+1],b[r][c+2],b[r][c+3]]);
    for(let r=0;r<=ROWS-4;r++)for(let c=0;c<COLS;c++)ch([b[r][c],b[r+1][c],b[r+2][c],b[r+3][c]]);
    return s;
  }
  function mm(b,depth,a,be,max){
    if(win(b,2))return 1e5+depth;if(win(b,1))return-1e5-depth;if(full(b)||!depth)return score(b,2)-score(b,1);
    const cols=validCols(b);
    if(max){let v=-Infinity;for(const c of cols){const nb=b.map(r=>[...r]);dropB(nb,c,2);v=Math.max(v,mm(nb,depth-1,a,be,false));a=Math.max(a,v);if(a>=be)break;}return v;}
    else{let v=Infinity;for(const c of cols){const nb=b.map(r=>[...r]);dropB(nb,c,1);v=Math.min(v,mm(nb,depth-1,a,be,true));be=Math.min(be,v);if(a>=be)break;}return v;}
  }
  function aiMove(){
    status.textContent='IA réfléchit…';
    setTimeout(()=>{
      if(over)return;
      const cols=validCols(board);let best=-Infinity,bc=cols[0];
      for(const c of cols){const nb=board.map(r=>[...r]);dropB(nb,c,2);const v=mm(nb,4,-Infinity,Infinity,false);if(v>best){best=v;bc=c;}}
      drop(bc);draw();
      if(win(board,2)){status.textContent='🤖 IA gagne !';over=true;return;}
      if(full(board)){status.textContent='Match nul !';over=true;return;}
      player=1;status.textContent='Votre tour (🔵)';
    },180);
  }
  function click(px){
    if(over||player!==1)return;
    const rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width;
    const col=Math.floor((px-rect.left)*sx/cw);
    if(col<0||col>=COLS||board[0][col])return;
    drop(col);draw();
    if(win(board,1)){status.textContent='🎉 Vous gagnez !';over=true;return;}
    if(full(board)){status.textContent='Match nul !';over=true;return;}
    player=2;aiMove();
  }
  canvas.addEventListener('click',e=>click(e.clientX));
  canvas.addEventListener('touchend',e=>{e.preventDefault();click(e.changedTouches[0].clientX);},{passive:false});
  rst.addEventListener('click',newGame); newGame();
}

/* ── SNAKE ───────────────────────────────────────────────────────── */
function initSnake(){
  const COLS=20,ROWS=15,AC='#00e5ff',FOOD='#f97316',BG='#0a0f16';
  const sz=Math.floor(availW()/COLS);
  const W=sz*COLS,H=sz*ROWS;
  let snake,dir,ndir,food,score,running;

  const wrap=mkWrap(),info=document.createElement('div'),scoreEl=document.createElement('span'),statusEl=document.createElement('span');
  info.style.cssText=`display:flex;justify-content:space-between;width:100%;max-width:${W}px;font-family:var(--fm);font-size:.72rem;color:var(--muted)`;
  info.append(scoreEl,statusEl);

  const canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  canvas.style.cssText=`border-radius:8px;width:100%;max-width:${W}px;border:1px solid #1a2535;touch-action:none`;

  // D-pad
  const dpad=document.createElement('div');
  dpad.style.cssText='display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(2,44px);gap:4px';
  [['↑','ArrowUp',1,2],['←','ArrowLeft',2,1],['↓','ArrowDown',2,2],['→','ArrowRight',2,3]].forEach(([l,k,r,c])=>{
    const b=document.createElement('button');
    b.textContent=l;b.style.cssText=`grid-row:${r};grid-column:${c};padding:0;width:44px;height:44px;background:#111821;border:1px solid #1a2535;border-radius:6px;color:#e2e8f0;font-size:1.1rem;cursor:pointer`;
    b.addEventListener('click',()=>hk(k));
    b.addEventListener('touchstart',e=>{e.preventDefault();hk(k);},{passive:false});
    dpad.appendChild(b);
  });
  const rst=mkBtn('↺ Rejouer');
  wrap.append(info,canvas,dpad,rst); gameContainer.appendChild(wrap);
  const ctx=canvas.getContext('2d');

  // swipe
  let tx=0,ty=0;
  canvas.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
  canvas.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
    if(Math.abs(dx)>Math.abs(dy))hk(dx>0?'ArrowRight':'ArrowLeft');else hk(dy>0?'ArrowDown':'ArrowUp');
  },{passive:true});
  function hk(k){const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};const d=m[k];if(d&&!(d[0]===-dir[0]&&d[1]===-dir[1]))ndir=d;}
  document.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();hk(e.key);}});

  function rFood(){let f;do{f={x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)}}while(snake.some(s=>s.x===f.x&&s.y===f.y));return f;}
  function newGame(){snake=[{x:10,y:7},{x:9,y:7},{x:8,y:7}];dir=[1,0];ndir=[1,0];food=rFood();score=0;running=true;scoreEl.textContent='Score: 0';statusEl.textContent='';clearInterval(window._gInt);window._gInt=setInterval(tick,100);draw();}
  function tick(){
    if(!running)return;dir=ndir;
    const h={x:snake[0].x+dir[0],y:snake[0].y+dir[1]};
    if(h.x<0||h.x>=COLS||h.y<0||h.y>=ROWS||snake.some(s=>s.x===h.x&&s.y===h.y)){running=false;statusEl.textContent='💀 Game Over!';clearInterval(window._gInt);return;}
    snake.unshift(h);
    if(h.x===food.x&&h.y===food.y){score+=10;scoreEl.textContent='Score: '+score;food=rFood();}else snake.pop();
    draw();
  }
  function draw(){
    ctx.fillStyle=BG;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#111821';ctx.lineWidth=.5;
    for(let i=0;i<=COLS;i++){ctx.beginPath();ctx.moveTo(i*sz,0);ctx.lineTo(i*sz,H);ctx.stroke();}
    for(let i=0;i<=ROWS;i++){ctx.beginPath();ctx.moveTo(0,i*sz);ctx.lineTo(W,i*sz);ctx.stroke();}
    ctx.fillStyle=FOOD;ctx.beginPath();ctx.arc(food.x*sz+sz/2,food.y*sz+sz/2,sz/2-2,0,Math.PI*2);ctx.fill();
    snake.forEach((s,i)=>{ctx.fillStyle=`rgba(0,229,255,${1-(i/snake.length)*.5})`;ctx.fillRect(s.x*sz+1,s.y*sz+1,sz-2,sz-2);});
  }
  rst.addEventListener('click',newGame); newGame();
}

/* ── BREAKOUT ────────────────────────────────────────────────────── */
function initBreakout(){
  const scale=Math.min(1,(availW())/480);
  const W=Math.round(480*scale),H=Math.round(320*scale);
  let paddle,ball,bricks,score,lives,running;
  const COLS2=8,ROWS2=4,BW=Math.floor((W-Math.round(60*scale))/COLS2),BH=Math.max(10,Math.round(14*scale)),BP=Math.round(4*scale);
  const COLORS=['#f97316','#7c3aed','#00e5ff','#22c55e'];

  const wrap=mkWrap(),info=document.createElement('div'),scoreEl=document.createElement('span'),livesEl=document.createElement('span');
  info.style.cssText=`display:flex;justify-content:space-between;width:100%;max-width:${W}px;font-family:var(--fm);font-size:.72rem;color:var(--muted)`;
  info.append(scoreEl,livesEl);
  const canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  canvas.style.cssText=`border-radius:8px;width:100%;max-width:${W}px;border:1px solid #1a2535;touch-action:none`;
  const hint=document.createElement('div');
  hint.style.cssText='font-family:var(--fm);font-size:.64rem;color:var(--muted);text-align:center';
  hint.textContent='Souris / glisser le doigt';
  const rst=mkBtn('↺ Rejouer');
  wrap.append(info,canvas,hint,rst); gameContainer.appendChild(wrap);
  const ctx=canvas.getContext('2d');

  function newGame(){
    const pw=Math.round(80*scale);
    paddle={x:W/2-pw/2,y:H-Math.round(22*scale),w:pw,h:Math.round(10*scale)};
    const spd=Math.max(1.8,3*scale);
    ball={x:W/2,y:H-Math.round(50*scale),r:Math.max(4,Math.round(7*scale)),dx:spd,dy:-spd*1.1};
    score=0;lives=3;running=true;bricks=[];
    const sx=Math.round(30*scale);
    for(let r=0;r<ROWS2;r++)for(let c=0;c<COLS2;c++)bricks.push({x:sx+c*(BW+BP),y:Math.round(40*scale)+r*(BH+BP),alive:true,color:COLORS[r%4]});
    scoreEl.textContent='Score: 0';livesEl.textContent='♥♥♥';
    cancelAnimationFrame(window._gRAF);loop();
  }
  function loop(){window._gRAF=requestAnimationFrame(loop);if(running){update();draw();}}
  function update(){
    ball.x+=ball.dx;ball.y+=ball.dy;
    if(ball.x-ball.r<0||ball.x+ball.r>W)ball.dx*=-1;
    if(ball.y-ball.r<0)ball.dy*=-1;
    if(ball.y+ball.r>=paddle.y&&ball.x>=paddle.x&&ball.x<=paddle.x+paddle.w){const rel=(ball.x-(paddle.x+paddle.w/2))/(paddle.w/2);const spd2=Math.sqrt(ball.dx**2+ball.dy**2);ball.dx=rel*4;ball.dy=-spd2;ball.y=paddle.y-ball.r;}
    if(ball.y+ball.r>H){lives--;livesEl.textContent='♥'.repeat(lives)+'♡'.repeat(3-lives);const s2=Math.max(1.8,3*scale);if(!lives){running=false;draw();ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#00e5ff';ctx.font=`bold ${Math.round(22*scale)}px Syne,sans-serif`;ctx.textAlign='center';ctx.fillText('Game Over',W/2,H/2);return;}ball={x:W/2,y:H-Math.round(60*scale),r:Math.max(4,Math.round(7*scale)),dx:s2*(Math.random()>.5?1:-1),dy:-s2*1.1};}
    bricks.forEach(b=>{if(!b.alive)return;if(ball.x+ball.r>b.x&&ball.x-ball.r<b.x+BW&&ball.y+ball.r>b.y&&ball.y-ball.r<b.y+BH){b.alive=false;ball.dy*=-1;score+=10;scoreEl.textContent='Score: '+score;}});
    if(bricks.every(b=>!b.alive)){running=false;draw();ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#22c55e';ctx.font=`bold ${Math.round(22*scale)}px Syne,sans-serif`;ctx.textAlign='center';ctx.fillText('Victoire 🎉',W/2,H/2);}
  }
  function draw(){
    ctx.fillStyle='#0a0f16';ctx.fillRect(0,0,W,H);
    bricks.forEach(b=>{if(!b.alive)return;ctx.fillStyle=b.color;ctx.beginPath();ctx.roundRect(b.x,b.y,BW,BH,3);ctx.fill();});
    ctx.fillStyle='#00e5ff';ctx.beginPath();ctx.roundRect(paddle.x,paddle.y,paddle.w,paddle.h,5);ctx.fill();
    ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#00e5ff';ctx.lineWidth=2;ctx.stroke();
  }
  const mv=e=>{const r=canvas.getBoundingClientRect(),sx2=canvas.width/r.width;paddle.x=Math.max(0,Math.min(W-paddle.w,(e.clientX-r.left)*sx2-paddle.w/2));};
  canvas.addEventListener('mousemove',mv);
  canvas.addEventListener('touchmove',e=>{e.preventDefault();const r=canvas.getBoundingClientRect(),sx2=canvas.width/r.width;paddle.x=Math.max(0,Math.min(W-paddle.w,(e.touches[0].clientX-r.left)*sx2-paddle.w/2));},{passive:false});
  rst.addEventListener('click',newGame); newGame();
}

/* ── QUIZ ────────────────────────────────────────────────────────── */
function initQuiz(){
  const QS=[
    {q:'Quel protocole est utilisé pour la communication IoT légère ?',a:['MQTT','HTTP','FTP','SMTP'],c:0},
    {q:'Quel microcontrôleur supporte WiFi et Bluetooth BLE ?',a:['Arduino Nano','Raspberry Pi Pico','ESP32','STM32'],c:2},
    {q:'Que signifie RBAC ?',a:['Role-Based Access Control','Remote Backend Access Config','React Build Architecture Component','Route-Bound API Controller'],c:0},
    {q:'Quel framework Python pour des APIs légères ?',a:['Django','Spring','Flask','Rails'],c:2},
    {q:'Que fait "git rebase" ?',a:['Supprime des commits','Réapplique des commits sur une base','Fusionne deux branches','Crée un tag'],c:1},
    {q:'Communication industrielle série entre ESP32 et RPI ?',a:['I2C','SPI','Modbus RTU','CAN'],c:2},
    {q:'WebSocket est utile pour ?',a:['Transfert de fichiers','Communication temps réel','Authentification OAuth','Déploiement CI/CD'],c:1},
    {q:'Quel outil de supervision de conteneurs ?',a:['Jira','Docker','Ansible','Jenkins'],c:1},
    {q:'Quel langage compile pour Android et iOS ?',a:['Swift','Kotlin','Dart','Java'],c:2},
    {q:'Pattern architectural de MobilitX ?',a:['MVC','Event-driven / Micro-services','Monolithique','Serverless'],c:1},
  ];
  let idx=0,score=0,answered=false;
  const wrap=mkWrap(''), progress=document.createElement('div'),qEl=document.createElement('div'),ansEl=document.createElement('div'),fb=document.createElement('div'),nextBtn=mkBtn('Suivante →');
  progress.style.cssText='font-family:var(--fm);font-size:.68rem;color:var(--muted);text-align:right;width:100%';
  qEl.style.cssText='font-size:.95rem;font-weight:700;line-height:1.55;color:var(--text);width:100%';
  ansEl.style.cssText='display:flex;flex-direction:column;gap:.5rem;width:100%';
  fb.style.cssText='font-family:var(--fm);font-size:.76rem;min-height:1.3rem;text-align:center';
  nextBtn.style.display='none';
  wrap.append(progress,qEl,ansEl,fb,nextBtn); gameContainer.appendChild(wrap);

  function show(){
    if(idx>=QS.length){finish();return;}
    answered=false;fb.textContent='';nextBtn.style.display='none';
    const q=QS[idx];progress.textContent=`${idx+1}/${QS.length} — Score: ${score}`;qEl.textContent=q.q;ansEl.innerHTML='';
    q.a.forEach((a,i)=>{
      const b=document.createElement('button');b.textContent=a;
      b.style.cssText='padding:.58rem .9rem;background:#111821;border:1px solid #1a2535;border-radius:8px;color:#e2e8f0;cursor:pointer;text-align:left;font-size:.82rem;transition:all .15s;width:100%';
      b.addEventListener('mouseenter',()=>{if(!answered)b.style.borderColor='var(--accent)';});
      b.addEventListener('mouseleave',()=>{if(!answered)b.style.borderColor='#1a2535';});
      b.addEventListener('click',()=>{
        if(answered)return;answered=true;const ok=i===q.c;
        b.style.background=ok?'rgba(34,197,94,.2)':'rgba(248,113,113,.2)';
        b.style.borderColor=ok?'#22c55e':'#f87171';
        if(ok){score++;fb.style.color='#22c55e';fb.textContent='✓ Bonne réponse !';}
        else{fb.style.color='#f87171';fb.textContent=`✗ C'était: ${q.a[q.c]}`;ansEl.children[q.c].style.background='rgba(34,197,94,.15)';ansEl.children[q.c].style.borderColor='#22c55e';}
        nextBtn.style.display='';
      });
      ansEl.appendChild(b);
    });
  }
  function finish(){
    wrap.innerHTML='';
    const pct=Math.round(score/QS.length*100);
    const msg=document.createElement('div');msg.style.cssText='text-align:center;display:flex;flex-direction:column;align-items:center;gap:1rem';
    msg.innerHTML=`<div style="font-size:2.8rem">${pct>=80?'🏆':pct>=50?'👍':'📚'}</div><div style="font-size:1.4rem;font-weight:800">Score: ${score}/${QS.length}</div><div style="font-family:var(--fm);font-size:.76rem;color:var(--muted)">${pct}% — ${pct>=80?'Excellent !':pct>=50?'Bon score !':'Continue à apprendre'}</div>`;
    const rb=mkBtn('↺ Rejouer');rb.addEventListener('click',()=>{idx=0;score=0;wrap.innerHTML='';wrap.append(progress,qEl,ansEl,fb,nextBtn);show();});
    msg.appendChild(rb);wrap.appendChild(msg);
  }
  nextBtn.addEventListener('click',()=>{idx++;show();}); show();
}

/* ── MEMORY ──────────────────────────────────────────────────────── */
function initMemory(){
  const syms=['🍎','🍌','🍒','🍓','🍊','🍋','🍉','🍇'];
  let cards=[...syms,...syms].sort(()=>Math.random()-.5);
  let flipped=[],matched=0,moves=0,lock=false;
  const wrap=mkWrap(),statsEl=document.createElement('div'),board=document.createElement('div'),rst=mkBtn('↺ Rejouer');
  statsEl.style.cssText='font-family:var(--fm);font-size:.76rem;color:var(--accent);text-align:center';
  board.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;max-width:300px;padding:.8rem;background:rgba(0,0,0,.15);border-radius:8px';
  wrap.append(statsEl,board,rst); gameContainer.appendChild(wrap);

  function upStats(){statsEl.textContent=`Paires: ${matched}/8 | Coups: ${moves}`;}
  function mk(idx){
    const d=document.createElement('div');
    d.style.cssText='height:62px;background:var(--accent);border-radius:6px;font-size:1.6rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;user-select:none';
    d.textContent='?';d.dataset.idx=idx;d.dataset.up='0';
    d.addEventListener('click',()=>{
      if(lock||d.dataset.up==='1'||flipped.includes(idx))return;
      d.textContent=cards[idx];d.dataset.up='1';d.style.background='#1a2535';flipped.push(idx);
      if(flipped.length===2){moves++;upStats();lock=true;
        const[a,b]=flipped;
        if(cards[a]===cards[b]){matched++;flipped=[];lock=false;if(matched===8)setTimeout(()=>{const m=document.createElement('div');m.style.cssText='text-align:center;padding:.8rem';m.innerHTML=`<h3 style="color:var(--accent);margin-bottom:.5rem">Gagné ! 🎉</h3><p style="color:var(--muted)">${moves} coups</p>`;board.replaceWith(m);},300);}
        else{setTimeout(()=>{const[ca,cb]=flipped.map(i=>board.querySelector(`[data-idx="${i}"]`));if(ca&&cb){ca.textContent='?';ca.dataset.up='0';ca.style.background='var(--accent)';cb.textContent='?';cb.dataset.up='0';cb.style.background='var(--accent)';}flipped=[];lock=false;},700);}
      }
    });
    return d;
  }
  function newGame(){matched=0;moves=0;flipped=[];lock=false;cards=[...syms,...syms].sort(()=>Math.random()-.5);board.innerHTML='';cards.forEach((_,i)=>board.appendChild(mk(i)));upStats();}
  rst.addEventListener('click',newGame); newGame();
}

/* ── 2048 ────────────────────────────────────────────────────────── */
function init2048(){
  const SIZE=4;let grid,score,over;
  function add(){const e=[];for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(!grid[r][c])e.push([r,c]);if(e.length){const[r,c]=e[Math.floor(Math.random()*e.length)];grid[r][c]=Math.random()<.9?2:4;}}
  function canMove(){for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){if(!grid[r][c])return true;if(c<SIZE-1&&grid[r][c]===grid[r][c+1])return true;if(r<SIZE-1&&grid[r][c]===grid[r+1][c])return true;}return false;}
  function slide(a){a=a.filter(v=>v);for(let i=0;i<a.length-1;i++)if(a[i]===a[i+1]){a[i]*=2;score+=a[i];a.splice(i+1,1);}while(a.length<SIZE)a.push(0);return a;}
  function move(d){if(over)return;const old=JSON.stringify(grid);
    if(d==='l'||d==='r')for(let r=0;r<SIZE;r++)grid[r]=d==='l'?slide(grid[r]):slide([...grid[r]].reverse()).reverse();
    else for(let c=0;c<SIZE;c++){let col=grid.map(r=>r[c]);col=d==='u'?slide(col):slide([...col].reverse()).reverse();for(let r=0;r<SIZE;r++)grid[r][c]=col[r];}
    if(JSON.stringify(grid)!==old){add();over=!canMove();}render();}

  const wrap=mkWrap(),scoreEl=document.createElement('div'),board=document.createElement('div'),info=document.createElement('div');
  scoreEl.style.cssText='font-family:var(--fm);font-size:.95rem;color:var(--accent)';
  board.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:6px;background:#bbada0;border-radius:6px;padding:6px;max-width:260px;width:100%';
  info.style.cssText='font-size:.72rem;color:var(--muted);text-align:center';

  // direction buttons
  const btns=[['←','l'],['→','r'],['↑','u'],['↓','d']].map(([l,d])=>{const b=mkBtn(l,'btn btn-secondary');b.style.cssText='font-size:.8rem;padding:.45rem .8rem';b.addEventListener('click',()=>move(d));return b;});
  const bg=document.createElement('div');bg.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;max-width:260px;width:100%';
  btns.forEach(b=>bg.appendChild(b));
  const rst=mkBtn('↺ Rejouer');
  wrap.append(scoreEl,board,info,bg,rst); gameContainer.appendChild(wrap);

  const clrs={2:'#eee4da',4:'#ede0c8',8:'#f2b179',16:'#f59563',32:'#f67c5f',64:'#f65e3b',128:'#edcf72',256:'#edcc61',512:'#edc850',1024:'#edc53f',2048:'#edc22e'};
  function render(){
    board.innerHTML='';
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){const v=grid[r][c],cell=document.createElement('div');cell.textContent=v||'';cell.style.cssText=`height:58px;background:${clrs[v]||'#3c3c2f'};display:flex;align-items:center;justify-content:center;font-size:${v>512?'1.1rem':'1.4rem'};font-weight:700;border-radius:3px;color:${v>4?'#f9f6f2':'#776e65'}`;board.appendChild(cell);}
    scoreEl.textContent='Score: '+score;info.textContent=over?'Game Over — Rejoue !':'⬅ ➡ ⬆ ⬇ ou boutons';
  }
  document.addEventListener('keydown',e=>{const m={ArrowLeft:'l',ArrowRight:'r',ArrowUp:'u',ArrowDown:'d'};if(m[e.key]){e.preventDefault();move(m[e.key]);}});
  rst.addEventListener('click',()=>{grid=Array.from({length:SIZE},()=>Array(SIZE).fill(0));score=0;over=false;add();add();render();});
  rst.click();
}

/* ── SIMON ───────────────────────────────────────────────────────── */
function initSimon(){
  const COLORS=['#ff6b6b','#51cf66','#4ecdc4','#ffd93d'];
  let seq=[],pSeq=[],level=1,active=true;
  const wrap=mkWrap(),lvlEl=mkStatus(),board=document.createElement('div'),msg=document.createElement('div'),startBtn=mkBtn('▶ Commencer');
  lvlEl.style.fontSize='1rem';
  board.style.cssText='display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-width:220px';
  msg.style.cssText='font-size:.82rem;color:var(--muted);text-align:center;height:1.4rem';
  wrap.append(lvlEl,board,msg,startBtn); gameContainer.appendChild(wrap);

  COLORS.forEach((c,i)=>{
    const d=document.createElement('div');
    d.style.cssText=`width:100px;height:100px;background:${c};border-radius:8px;cursor:pointer;transition:filter .1s;box-shadow:0 4px 8px rgba(0,0,0,.3)`;
    d.addEventListener('click',()=>{if(!active)return;flash(i);pSeq.push(i);check();});
    board.appendChild(d);
  });
  function flash(i){const d=board.children[i];d.style.filter='brightness(1.4)';setTimeout(()=>d.style.filter='',280);}
  function play(){msg.textContent='Regardez…';active=false;let i=0;const iv=setInterval(()=>{flash(seq[i++]);if(i>=seq.length){clearInterval(iv);msg.textContent='À vous !';active=true;pSeq=[];}},750);}
  function check(){const last=pSeq.length-1;if(pSeq[last]!==seq[last]){msg.textContent=`❌ Perdu au niveau ${level}!`;active=false;return;}if(pSeq.length===seq.length){level++;lvlEl.textContent=`Niveau: ${level}`;msg.textContent='✓ Correct!';pSeq=[];seq.push(Math.floor(Math.random()*4));setTimeout(play,1200);}}
  startBtn.addEventListener('click',()=>{seq=[];level=1;lvlEl.textContent='Niveau: 1';seq.push(Math.floor(Math.random()*4));play();startBtn.style.display='none';});
  lvlEl.textContent='Niveau: 1';msg.textContent='Appuyez sur Commencer';
}

/* ── TIC TAC TOE ─────────────────────────────────────────────────── */
function initTicTacToe(){
  let board,active;
  const wrap=mkWrap(),status=mkStatus(),boardEl=document.createElement('div'),rst=mkBtn('↺ Rejouer');
  boardEl.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:6px;background:var(--surface);padding:10px;border-radius:8px;max-width:210px';
  wrap.append(status,boardEl,rst); gameContainer.appendChild(wrap);

  const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function winner(b){for(const[a,b1,c]of LINES)if(b[a]&&b[a]===b[b1]&&b[a]===b[c])return b[a];return null;}
  function ai(){
    const empty=board.map((v,i)=>!v?i:-1).filter(i=>i>=0);
    for(const i of empty){board[i]='O';if(winner(board)==='O')return;board[i]='';}
    for(const i of empty){board[i]='X';if(winner(board)==='X'){board[i]='O';return;}board[i]='';}
    if(empty.length)board[empty[Math.floor(Math.random()*empty.length)]]='O';
  }
  function render(){
    boardEl.innerHTML='';
    board.forEach((v,i)=>{
      const d=document.createElement('div');
      d.textContent=v;
      d.style.cssText=`height:65px;display:flex;align-items:center;justify-content:center;background:var(--bg2);border:1px solid var(--border);border-radius:6px;font-size:1.7rem;font-weight:700;cursor:${!v&&active?'pointer':'default'};transition:background .15s;color:${v==='X'?'var(--accent)':'#f97316'}`;
      if(!v&&active)d.addEventListener('click',()=>{if(!v&&active){board[i]='X';const w=winner(board);if(w){status.textContent='🎉 Gagné !';active=false;render();return;}if(board.every(v=>v)){status.textContent='🤝 Nul !';active=false;render();return;}ai();const w2=winner(board);if(w2){status.textContent="😢 L'IA gagne !";active=false;}else if(board.every(v=>v)){status.textContent='🤝 Nul !';active=false;}render();}});
      boardEl.appendChild(d);
    });
  }
  function newGame(){board=Array(9).fill('');active=true;status.textContent='À votre tour (X)';render();}
  rst.addEventListener('click',newGame); newGame();
}

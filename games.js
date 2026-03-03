/* ===================================================
   GAMES.JS — Puissance 4, Snake, Casse-Briques, Quiz
   =================================================== */

const gameModal  = document.getElementById('gameModal');
const gameTitle  = document.getElementById('gameTitle');
const gameClose  = document.getElementById('gameClose');
const gameContainer = document.getElementById('gameContainer');

const GAME_TITLES = {
  connect4: '🔴 Puissance 4 vs IA',
  snake:    '🐍 Snake',
  breakout: '🧱 Casse-Briques',
  quiz:     '💡 Quiz Tech',
  memory:   '🧠 Memory',
  tamagotchi: '🤖 Tamagotchi',
  '2048':   '2️⃣ 2048',
  simon:    '🎯 Simon Says',
  tictactoe: '⭕ Tic Tac Toe',
};

function openGame(name) {
  gameModal.classList.remove('hidden');
  gameTitle.textContent = GAME_TITLES[name] || name;
  gameContainer.innerHTML = '';
  document.body.style.overflow = 'hidden';
  switch(name) {
    case 'connect4':   initConnect4();   break;
    case 'snake':      initSnake();      break;
    case 'breakout':   initBreakout();   break;
    case 'quiz':       initQuiz();       break;
    case 'memory':     initMemory();     break;
    case 'tamagotchi': initTamagotchi(); break;
    case '2048':       init2048();       break;
    case 'simon':      initSimon();      break;
    case 'tictactoe':  initTicTacToe();  break;
  }
}

function closeGame() {
  gameModal.classList.add('hidden');
  gameContainer.innerHTML = '';
  document.body.style.overflow = '';
  if (window._gameLoop) cancelAnimationFrame(window._gameLoop);
  if (window._snakeInterval) clearInterval(window._snakeInterval);
}

document.querySelectorAll('.game-launch').forEach(btn =>
  btn.addEventListener('click', () => openGame(btn.dataset.game))
);
gameClose?.addEventListener('click', closeGame);
gameModal?.addEventListener('click', e => { if(e.target === gameModal) closeGame(); });

/* ==============================
   PUISSANCE 4 vs IA (Minimax)
   ============================== */
function initConnect4() {
  const COLS=7, ROWS=6;
  const ACCENT='#00e5ff', P2='#f97316', EMPTY='#1a2535', BG='#0d1117';
  let board, currentPlayer, gameOver;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:1rem;width:100%';

  const status = document.createElement('div');
  status.style.cssText = `font-family:var(--font-mono);font-size:0.8rem;color:${ACCENT};min-height:1.5rem;text-align:center`;

  const canvas = document.createElement('canvas');
  // Responsive cell size based on available width
  const availW = Math.min(gameContainer.clientWidth - 32, 360);
  const W = Math.floor(availW / COLS);
  canvas.width = COLS*W; canvas.height = ROWS*W;
  canvas.style.cssText = `border-radius:8px;cursor:pointer;width:100%;max-width:${COLS*W}px;touch-action:manipulation`;

  const resetBtn = document.createElement('button');
  resetBtn.textContent = '↺ Rejouer';
  resetBtn.className = 'btn-primary';
  resetBtn.style.fontSize = '0.75rem';

  wrap.append(status, canvas, resetBtn);
  gameContainer.appendChild(wrap);

  const ctx = canvas.getContext('2d');

  function newGame() {
    board = Array.from({length:ROWS}, ()=>Array(COLS).fill(0));
    currentPlayer = 1; gameOver = false;
    status.textContent = 'Votre tour (🔵)';
    draw();
  }

  function draw() {
    ctx.fillStyle = BG;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
      ctx.beginPath();
      ctx.arc(c*W+W/2, r*W+W/2, W/2-4, 0, Math.PI*2);
      ctx.fillStyle = board[r][c]===1 ? ACCENT : board[r][c]===2 ? P2 : EMPTY;
      ctx.fill();
    }
  }

  function drop(col) {
    for(let r=ROWS-1;r>=0;r--) {
      if(board[r][col]===0) { board[r][col]=currentPlayer; return r; }
    }
    return -1;
  }

  function checkWin(b, p) {
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
      const dirs=[[0,1],[1,0],[1,1],[1,-1]];
      for(const [dr,dc] of dirs) {
        let cnt=0;
        for(let k=0;k<4;k++) {
          const nr=r+dr*k, nc=c+dc*k;
          if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&b[nr][nc]===p) cnt++;
          else break;
        }
        if(cnt===4) return true;
      }
    }
    return false;
  }

  function isFull(b) { return b[0].every(c=>c!==0); }

  function score(b, p) {
    let s=0;
    const opp = p===1?2:1;
    const check = arr => {
      const pc = arr.filter(x=>x===p).length;
      const ec = arr.filter(x=>x===0).length;
      if(pc===4) s+=1000;
      else if(pc===3&&ec===1) s+=10;
      else if(pc===2&&ec===2) s+=2;
      const oc = arr.filter(x=>x===opp).length;
      if(oc===3&&ec===1) s-=50;
      if(oc===4) s-=10000;
    };
    for(let r=0;r<ROWS;r++) for(let c=0;c<=COLS-4;c++) check([b[r][c],b[r][c+1],b[r][c+2],b[r][c+3]]);
    for(let r=0;r<=ROWS-4;r++) for(let c=0;c<COLS;c++) check([b[r][c],b[r+1][c],b[r+2][c],b[r+3][c]]);
    for(let r=0;r<=ROWS-4;r++) for(let c=0;c<=COLS-4;c++) check([b[r][c],b[r+1][c+1],b[r+2][c+2],b[r+3][c+3]]);
    for(let r=3;r<ROWS;r++) for(let c=0;c<=COLS-4;c++) check([b[r][c],b[r-1][c+1],b[r-2][c+2],b[r-3][c+3]]);
    return s;
  }

  function minimax(b, depth, alpha, beta, maximizing) {
    if(checkWin(b,2)) return 10000+depth;
    if(checkWin(b,1)) return -10000-depth;
    if(isFull(b)||depth===0) return score(b,2)-score(b,1);
    const cols = validCols(b);
    if(maximizing) {
      let v=-Infinity;
      for(const c of cols) {
        const nb=b.map(r=>[...r]); dropB(nb,c,2);
        v=Math.max(v,minimax(nb,depth-1,alpha,beta,false));
        alpha=Math.max(alpha,v);
        if(alpha>=beta) break;
      }
      return v;
    } else {
      let v=Infinity;
      for(const c of cols) {
        const nb=b.map(r=>[...r]); dropB(nb,c,1);
        v=Math.min(v,minimax(nb,depth-1,alpha,beta,true));
        beta=Math.min(beta,v);
        if(alpha>=beta) break;
      }
      return v;
    }
  }

  function validCols(b) { return [...Array(COLS).keys()].filter(c=>b[0][c]===0); }
  function dropB(b,col,p) { for(let r=ROWS-1;r>=0;r--) if(b[r][col]===0){b[r][col]=p;return;} }

  function aiMove() {
    status.textContent = 'IA réfléchit...';
    setTimeout(() => {
      if(gameOver) return;
      const cols = validCols(board);
      let best=-Infinity, bestCol=cols[0];
      for(const c of cols) {
        const nb=board.map(r=>[...r]); dropB(nb,c,2);
        const v=minimax(nb,4,-Infinity,Infinity,false);
        if(v>best){best=v;bestCol=c;}
      }
      drop(bestCol);
      draw();
      if(checkWin(board,2)){status.textContent='🤖 IA gagne !';gameOver=true;return;}
      if(isFull(board)){status.textContent='Match nul !';gameOver=true;return;}
      currentPlayer=1;
      status.textContent='Votre tour (🔵)';
    }, 200);
  }

  canvas.addEventListener('click', e => {
    if(gameOver||currentPlayer!==1) return;
    const rect=canvas.getBoundingClientRect();
    const scaleX=canvas.width/rect.width;
    const col=Math.floor((e.clientX-rect.left)*scaleX/W);
    if(col<0||col>=COLS||board[0][col]!==0) return;
    drop(col); draw();
    if(checkWin(board,1)){status.textContent='🎉 Vous gagnez !';gameOver=true;return;}
    if(isFull(board)){status.textContent='Match nul !';gameOver=true;return;}
    currentPlayer=2; aiMove();
  });

  resetBtn.addEventListener('click', newGame);
  newGame();
}

/* ==============================
   SNAKE
   ============================== */
function initSnake() {
  const COLS=20, ROWS=15;
  const availW = Math.min(gameContainer.clientWidth - 32, 400);
  const SZ = Math.floor(availW / COLS);
  const W=SZ*COLS, H=SZ*ROWS;
  const ACCENT='#00e5ff', FOOD='#f97316', BG='#0a0f16', GRID='#111821';

  let snake, dir, nextDir, food, score, running;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:0.8rem;width:100%';

  const info = document.createElement('div');
  info.style.cssText = `display:flex;justify-content:space-between;width:100%;max-width:${W}px;font-family:var(--font-mono);font-size:0.75rem;color:#6b7280`;

  const scoreEl = document.createElement('span');
  const status  = document.createElement('span');
  info.append(scoreEl, status);

  const canvas = document.createElement('canvas');
  canvas.width=W; canvas.height=H;
  canvas.style.cssText=`border-radius:8px;width:100%;max-width:${W}px;border:1px solid #1a2535;touch-action:none`;

  // Mobile D-pad
  const dpad = document.createElement('div');
  dpad.style.cssText='display:grid;grid-template-columns:repeat(3,48px);grid-template-rows:repeat(2,48px);gap:5px';
  const arrows=[['↑','ArrowUp',1,2],['←','ArrowLeft',2,1],['↓','ArrowDown',2,2],['→','ArrowRight',2,3]];
  for(const [label,key,row,col] of arrows) {
    const b=document.createElement('button');
    b.textContent=label;
    b.style.cssText=`grid-row:${row};grid-column:${col};padding:0;width:48px;height:48px;background:#111821;border:1px solid #1a2535;border-radius:8px;color:#e2e8f0;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center`;
    b.addEventListener('click',()=>handleKey(key));
    b.addEventListener('touchstart',e=>{e.preventDefault();handleKey(key);},{passive:false});
    dpad.appendChild(b);
  }

  const restartBtn=document.createElement('button');
  restartBtn.textContent='↺ Rejouer'; restartBtn.className='btn-primary'; restartBtn.style.fontSize='0.75rem';

  wrap.append(info, canvas, dpad, restartBtn);
  gameContainer.appendChild(wrap);
  const ctx=canvas.getContext('2d');

  // Swipe support
  let touchStartX=0, touchStartY=0;
  canvas.addEventListener('touchstart', e => { touchStartX=e.touches[0].clientX; touchStartY=e.touches[0].clientY; }, {passive:true});
  canvas.addEventListener('touchend', e => {
    const dx=e.changedTouches[0].clientX-touchStartX;
    const dy=e.changedTouches[0].clientY-touchStartY;
    if(Math.abs(dx)>Math.abs(dy)) handleKey(dx>0?'ArrowRight':'ArrowLeft');
    else handleKey(dy>0?'ArrowDown':'ArrowUp');
  }, {passive:true});

  function handleKey(key) {
    const map={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
    if(!map[key]) return;
    const [dx,dy]=map[key];
    if(dx===-dir[0]&&dy===-dir[1]) return;
    nextDir=[dx,dy];
  }

  document.addEventListener('keydown', e => {
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); handleKey(e.key); }
  });

  function randFood() {
    let f;
    do { f={x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)}; }
    while(snake.some(s=>s.x===f.x&&s.y===f.y));
    return f;
  }

  function newGame() {
    snake=[{x:10,y:8},{x:9,y:8},{x:8,y:8}];
    dir=[1,0]; nextDir=[1,0];
    food=randFood(); score=0; running=true;
    scoreEl.textContent='Score: 0'; status.textContent='';
    if(window._snakeInterval) clearInterval(window._snakeInterval);
    window._snakeInterval=setInterval(tick,100);
    draw();
  }

  function tick() {
    if(!running) return;
    dir=nextDir;
    const head={x:snake[0].x+dir[0], y:snake[0].y+dir[1]};
    if(head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS||snake.some(s=>s.x===head.x&&s.y===head.y)) {
      running=false; status.textContent='💀 Game Over!';
      clearInterval(window._snakeInterval); return;
    }
    snake.unshift(head);
    if(head.x===food.x&&head.y===food.y) { score+=10; scoreEl.textContent='Score: '+score; food=randFood(); }
    else snake.pop();
    draw();
  }

  function draw() {
    ctx.fillStyle=BG; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle=GRID; ctx.lineWidth=0.5;
    for(let i=0;i<=COLS;i++){ctx.beginPath();ctx.moveTo(i*SZ,0);ctx.lineTo(i*SZ,H);ctx.stroke();}
    for(let i=0;i<=ROWS;i++){ctx.beginPath();ctx.moveTo(0,i*SZ);ctx.lineTo(W,i*SZ);ctx.stroke();}
    // Food
    ctx.fillStyle=FOOD;
    ctx.beginPath(); ctx.arc(food.x*SZ+SZ/2,food.y*SZ+SZ/2,SZ/2-2,0,Math.PI*2); ctx.fill();
    // Snake
    snake.forEach((seg,i) => {
      const alpha=1-(i/snake.length)*0.5;
      ctx.fillStyle=`rgba(0,229,255,${alpha})`;
      ctx.fillRect(seg.x*SZ+1,seg.y*SZ+1,SZ-2,SZ-2);
    });
    // Head highlight
    ctx.fillStyle='#fff'; ctx.globalAlpha=0.3;
    ctx.fillRect(snake[0].x*SZ+2,snake[0].y*SZ+2,6,6);
    ctx.globalAlpha=1;
  }

  restartBtn.addEventListener('click', newGame);
  newGame();
}

/* ==============================
   CASSE-BRIQUES
   ============================== */
function initBreakout() {
  const SCALE = Math.min(1, (gameContainer.clientWidth - 32) / 480);
  const W=Math.floor(480*SCALE), H=Math.floor(320*SCALE);
  const ACCENT='#00e5ff', BG='#0a0f16';

  let paddle, ball, bricks, score, lives, running, raf;

  const wrap=document.createElement('div');
  wrap.style.cssText='display:flex;flex-direction:column;align-items:center;gap:0.8rem;width:100%';

  const info=document.createElement('div');
  info.style.cssText=`display:flex;justify-content:space-between;width:100%;max-width:${W}px;font-family:var(--font-mono);font-size:0.75rem;color:#6b7280`;
  const scoreEl=document.createElement('span');
  const livesEl=document.createElement('span');
  info.append(scoreEl,livesEl);

  const canvas=document.createElement('canvas');
  canvas.width=W; canvas.height=H;
  canvas.style.cssText=`border-radius:8px;width:100%;max-width:${W}px;border:1px solid #1a2535;touch-action:none`;

  const hint=document.createElement('div');
  hint.style.cssText='font-family:var(--font-mono);font-size:0.68rem;color:#6b7280;text-align:center';
  hint.textContent='Souris / glisser le doigt pour la raquette';

  const restartBtn=document.createElement('button');
  restartBtn.textContent='↺ Rejouer'; restartBtn.className='btn-primary'; restartBtn.style.fontSize='0.75rem';

  wrap.append(info,canvas,hint,restartBtn);
  gameContainer.appendChild(wrap);
  const ctx=canvas.getContext('2d');

  const BRICK_COLS=8, BRICK_ROWS=4;
  const BRICK_W=Math.floor((W-60)/BRICK_COLS), BRICK_H=Math.max(10,Math.floor(14*SCALE)), BRICK_PAD=Math.floor(4*SCALE);
  const COLORS=['#f97316','#7c3aed','#00e5ff','#22c55e'];

  function newGame() {
    const pw=Math.floor(80*SCALE);
    paddle={x:W/2-pw/2,y:H-Math.floor(20*SCALE),w:pw,h:Math.floor(10*SCALE)};
    const spd=Math.max(2, 3*SCALE);
    ball={x:W/2,y:H-Math.floor(40*SCALE),r:Math.max(4,Math.floor(7*SCALE)),dx:spd,dy:-spd*1.1};
    score=0; lives=3; running=false;
    bricks=[];
    const startX=Math.floor(30*SCALE);
    for(let r=0;r<BRICK_ROWS;r++) for(let c=0;c<BRICK_COLS;c++)
      bricks.push({x:startX+c*(BRICK_W+BRICK_PAD),y:Math.floor(40*SCALE)+r*(BRICK_H+BRICK_PAD),alive:true,color:COLORS[r%4]});
    scoreEl.textContent='Score: 0'; livesEl.textContent='Vies: ♥♥♥';
    draw(); running=true; loop();
  }

  function loop() {
    if(!running) return;
    raf=requestAnimationFrame(loop);
    window._gameLoop=raf;
    update(); draw();
  }

  function update() {
    // Ball move
    ball.x+=ball.dx; ball.y+=ball.dy;
    // Walls
    if(ball.x-ball.r<0||ball.x+ball.r>W) ball.dx*=-1;
    if(ball.y-ball.r<0) ball.dy*=-1;
    // Paddle
    if(ball.y+ball.r>=paddle.y&&ball.x>=paddle.x&&ball.x<=paddle.x+paddle.w) {
      const rel=(ball.x-(paddle.x+paddle.w/2))/(paddle.w/2);
      const spd=Math.sqrt(ball.dx**2+ball.dy**2);
      ball.dx=rel*4; ball.dy=-spd; ball.y=paddle.y-ball.r;
    }
    // Out
    if(ball.y+ball.r>H) {
      lives--;
      livesEl.textContent='Vies: '+'♥'.repeat(lives)+'♡'.repeat(3-lives);
      const spd2=Math.max(2,3*SCALE);
      if(lives<=0){running=false;draw();ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,0,W,H);ctx.fillStyle=ACCENT;ctx.font=`bold ${Math.floor(22*SCALE)}px Syne,sans-serif`;ctx.textAlign='center';ctx.fillText('Game Over',W/2,H/2);return;}
      ball={x:W/2,y:H-Math.floor(60*SCALE),r:Math.max(4,Math.floor(7*SCALE)),dx:spd2*(Math.random()>0.5?1:-1),dy:-spd2*1.1};
    }
    // Bricks
    for(const b of bricks) {
      if(!b.alive) continue;
      if(ball.x+ball.r>b.x&&ball.x-ball.r<b.x+BRICK_W&&ball.y+ball.r>b.y&&ball.y-ball.r<b.y+BRICK_H) {
        b.alive=false; ball.dy*=-1; score+=10;
        scoreEl.textContent='Score: '+score;
      }
    }
    if(bricks.every(b=>!b.alive)){running=false;draw();ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#22c55e';ctx.font=`bold ${Math.floor(22*SCALE)}px Syne,sans-serif`;ctx.textAlign='center';ctx.fillText('Victoire ! 🎉',W/2,H/2);}
  }

  function draw() {
    ctx.fillStyle=BG; ctx.fillRect(0,0,W,H);
    bricks.forEach(b => {
      if(!b.alive) return;
      ctx.fillStyle=b.color; ctx.beginPath();
      ctx.roundRect(b.x,b.y,BRICK_W,BRICK_H,3); ctx.fill();
    });
    // Paddle
    ctx.fillStyle=ACCENT;
    ctx.beginPath(); ctx.roundRect(paddle.x,paddle.y,paddle.w,paddle.h,5); ctx.fill();
    // Ball
    ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);
    ctx.fillStyle='#fff'; ctx.fill();
    ctx.strokeStyle=ACCENT; ctx.lineWidth=2; ctx.stroke();
  }

  // Mouse
  canvas.addEventListener('mousemove', e => {
    const r=canvas.getBoundingClientRect();
    const scaleX=canvas.width/r.width;
    paddle.x=Math.max(0,Math.min(W-paddle.w,(e.clientX-r.left)*scaleX-paddle.w/2));
  });
  // Touch
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const r=canvas.getBoundingClientRect();
    const scaleX=canvas.width/r.width;
    paddle.x=Math.max(0,Math.min(W-paddle.w,(e.touches[0].clientX-r.left)*scaleX-paddle.w/2));
  },{passive:false});

  restartBtn.addEventListener('click',newGame);
  newGame();
}

/* ==============================
   QUIZ TECH
   ============================== */
function initQuiz() {
  const questions = [
    { q:'Quel protocole est utilisé pour la communication IoT légère ?', a:['MQTT','HTTP','FTP','SMTP'], c:0 },
    { q:'Quel langage est utilisé pour Android avec Kotlin ?', a:['Swift','Kotlin','Dart','Apex'], c:1 },
    { q:'Que signifie RBAC ?', a:['Role-Based Access Control','Remote Backend Access Config','React Build Architecture Component','Route-Bound API Controller'], c:0 },
    { q:'Quel microcontrôleur supporte le WiFi et le Bluetooth BLE ?', a:['Arduino Nano','Raspberry Pi Pico','ESP32','STM32'], c:2 },
    { q:'Quel framework Python est utilisé pour créer des APIs légères ?', a:['Django','Spring','Flask','Rails'], c:2 },
    { q:'Que fait "git rebase" ?', a:['Supprime des commits','Réapplique des commits sur une nouvelle base','Fusionne deux branches','Crée un tag'], c:1 },
    { q:'Quel protocole permet la communication série industrielle entre ESP32 et RPI ?', a:['I2C','SPI','Modbus RTU','CAN'], c:2 },
    { q:'Quelle technologie est utilisée dans le projet YNOV Express ?', a:['Flask','Node.js','Spring Boot','Django'], c:1 },
    { q:'WebSocket est utile pour ?', a:['Transfert de fichiers lourds','Communication temps réel bidirectionnelle','Authentification OAuth','Déploiement CI/CD'], c:1 },
    { q:'Quel outil CI/CD est utilisé chez CS GROUP ?', a:['Jenkins','GitHub Actions','GitLab CI','Travis CI'], c:2 },
  ];

  let idx=0, score=0, answered=false;

  const wrap=document.createElement('div');
  wrap.style.cssText='display:flex;flex-direction:column;gap:1rem;width:100%;max-width:560px';

  const progress=document.createElement('div');
  progress.style.cssText='font-family:var(--font-mono);font-size:0.7rem;color:#6b7280;text-align:right';

  const qEl=document.createElement('div');
  qEl.style.cssText='font-size:1rem;font-weight:700;line-height:1.5;color:var(--text)';

  const answersEl=document.createElement('div');
  answersEl.style.cssText='display:flex;flex-direction:column;gap:0.5rem';

  const feedback=document.createElement('div');
  feedback.style.cssText='font-family:var(--font-mono);font-size:0.8rem;min-height:1.4rem;text-align:center';

  const nextBtn=document.createElement('button');
  nextBtn.textContent='Question suivante →'; nextBtn.className='btn-primary';
  nextBtn.style.display='none';

  wrap.append(progress, qEl, answersEl, feedback, nextBtn);
  gameContainer.appendChild(wrap);

  function show() {
    if(idx>=questions.length) { finish(); return; }
    answered=false; feedback.textContent=''; nextBtn.style.display='none';
    const q=questions[idx];
    progress.textContent=`${idx+1} / ${questions.length}   Score: ${score}`;
    qEl.textContent=q.q;
    answersEl.innerHTML='';
    q.a.forEach((ans,i)=>{
      const btn=document.createElement('button');
      btn.textContent=ans;
      btn.style.cssText=`padding:0.6rem 1rem;background:#111821;border:1px solid #1a2535;border-radius:8px;color:#e2e8f0;cursor:pointer;text-align:left;font-size:0.85rem;transition:all 0.15s`;
      btn.addEventListener('mouseenter',()=>{ if(!answered) btn.style.borderColor='var(--accent)'; });
      btn.addEventListener('mouseleave',()=>{ if(!answered) btn.style.borderColor='#1a2535'; });
      btn.addEventListener('click',()=>{
        if(answered) return;
        answered=true;
        const correct=i===q.c;
        btn.style.background=correct?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)';
        btn.style.borderColor=correct?'#22c55e':'#ef4444';
        if(correct) { score++; feedback.style.color='#22c55e'; feedback.textContent='✓ Bonne réponse !'; }
        else { feedback.style.color='#ef4444'; feedback.textContent=`✗ C'était : ${q.a[q.c]}`; answersEl.children[q.c].style.background='rgba(34,197,94,0.15)'; answersEl.children[q.c].style.borderColor='#22c55e'; }
        nextBtn.style.display='';
      });
      answersEl.appendChild(btn);
    });
  }

  function finish() {
    wrap.innerHTML='';
    const pct=Math.round(score/questions.length*100);
    const emoji=pct>=80?'🏆':pct>=50?'👍':'📚';
    const msg=document.createElement('div');
    msg.style.cssText='text-align:center;display:flex;flex-direction:column;align-items:center;gap:1.5rem';
    msg.innerHTML=`
      <div style="font-size:3rem">${emoji}</div>
      <div style="font-size:1.5rem;font-weight:800">Score final : ${score} / ${questions.length}</div>
      <div style="font-family:var(--font-mono);font-size:0.8rem;color:#6b7280">${pct}% de réussite</div>
      <div style="font-size:0.9rem;color:var(--text-dim)">${pct>=80?'Excellent ! Tu maîtrises bien le stack 🚀':pct>=50?'Bon score ! Encore un peu de practice.':'Continue à apprendre, tu y arriveras !'}</div>
    `;
    const replay=document.createElement('button');
    replay.textContent='↺ Rejouer'; replay.className='btn-primary';
    replay.addEventListener('click',()=>{ idx=0; score=0; wrap.innerHTML=''; wrap.append(progress,qEl,answersEl,feedback,nextBtn); show(); });
    msg.appendChild(replay);
    wrap.appendChild(msg);
  }

  nextBtn.addEventListener('click',()=>{ idx++; show(); });
  show();
}

/* ==============================
   MEMORY GAME
   ============================== */
function initMemory() {
  const symbols = ['🍎', '🍌', '🍒', '🍓', '🍊', '🍋', '🍉', '🍇'];
  const cards = [...symbols, ...symbols].sort(() => Math.random() - 0.5);
  let flipped = [];
  let matched = 0;
  let moves = 0;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:1.5rem;width:100%';

  const stats = document.createElement('div');
  stats.style.cssText = 'font-family:var(--font-mono);font-size:0.85rem;color:var(--accent);text-align:center';

  const board = document.createElement('div');
  board.style.cssText = `
    display:grid;grid-template-columns:repeat(4,1fr);gap:0.75rem;max-width:340px;
    padding:1rem;background:rgba(0,0,0,.2);border-radius:8px;
  `;

  const resetBtn = document.createElement('button');
  resetBtn.textContent = '↺ Rejouer';
  resetBtn.className = 'btn-primary';
  resetBtn.style.fontSize = '0.75rem';

  wrap.append(stats, board, resetBtn);
  gameContainer.appendChild(wrap);

  function updateStats() {
    stats.textContent = `Paires: ${matched}/8 | Coups: ${moves}`;
  }

  function createCard(idx) {
    const card = document.createElement('div');
    card.style.cssText = `
      width:70px;height:70px;background:var(--accent);border:none;border-radius:6px;
      font-size:2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;
      transition:all .2s;user-select:none;
    `;
    card.textContent = '?';
    card.dataset.idx = idx;
    card.dataset.flipped = false;

    card.addEventListener('click', () => {
      if (card.dataset.flipped === 'true' || flipped.length >= 2 || flipped.includes(idx)) return;
      card.textContent = cards[idx];
      card.dataset.flipped = 'true';
      flipped.push(idx);

      if (flipped.length === 2) {
        moves++;
        const [a, b] = flipped;
        if (cards[a] === cards[b]) {
          matched++;
          flipped = [];
          updateStats();
          if (matched === 8) {
            setTimeout(() => {
              const msg = document.createElement('div');
              msg.style.cssText = 'text-align:center;padding:1rem';
              msg.innerHTML = `<h3 style="color:var(--accent);margin-bottom:0.5rem">Gagné ! 🎉</h3><p style="color:var(--muted);margin-bottom:1rem">${moves} coups</p>`;
              const replay = document.createElement('button');
              replay.textContent = '↺ Rejouer';
              replay.className = 'btn-primary';
              replay.addEventListener('click', () => { matched=0; moves=0; cards.sort(()=>Math.random()-0.5); board.innerHTML=''; flipped=[]; cards.forEach((s,i)=>board.appendChild(createCard(i))); updateStats(); });
              msg.appendChild(replay);
              board.parentElement.insertBefore(msg, board);
              board.style.display = 'none';
              resetBtn.style.display = 'none';
            }, 300);
          }
        } else {
          setTimeout(() => {
            const [ca, cb] = flipped.map(i => board.querySelector(`[data-idx="${i}"]`));
            ca.textContent = '?'; ca.dataset.flipped = 'false';
            cb.textContent = '?'; cb.dataset.flipped = 'false';
            flipped = [];
          }, 800);
        }
        updateStats();
      }
    });
    return card;
  }

  cards.forEach((s, i) => board.appendChild(createCard(i)));
  updateStats();

  resetBtn.addEventListener('click', () => {
    matched = 0; moves = 0;
    flipped = [];
    cards.sort(() => Math.random() - 0.5);
    board.innerHTML = '';
    cards.forEach((s, i) => board.appendChild(createCard(i)));
    updateStats();
  });
}

/* ==============================
   2048 GAME
   ============================== */
function init2048() {
  const SIZE = 4;
  let grid = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
  let score = 0;
  let gameOver = false;

  function addNewTile() {
    const empty = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] === 0) empty.push([r, c]);
    if (empty.length) {
      const [r, c] = empty[Math.floor(Math.random() * empty.length)];
      grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    }
  }

  function canMove() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) return true;
        if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
        if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
      }
    }
    return false;
  }

  function slide(arr) {
    arr = arr.filter(v => v !== 0);
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        score += arr[i];
        arr.splice(i + 1, 1);
      }
    }
    while (arr.length < SIZE) arr.push(0);
    return arr;
  }

  function move(dir) {
    if (gameOver) return;
    const old = JSON.stringify(grid);

    if (dir === 'left' || dir === 'right') {
      for (let r = 0; r < SIZE; r++) {
        grid[r] = dir === 'left' ? slide(grid[r]) : slide(grid[r].reverse()).reverse();
      }
    } else {
      for (let c = 0; c < SIZE; c++) {
        let col = grid.map(r => r[c]);
        col = dir === 'up' ? slide(col) : slide(col.reverse()).reverse();
        for (let r = 0; r < SIZE; r++) grid[r][c] = col[r];
      }
    }

    if (JSON.stringify(grid) !== old) {
      addNewTile();
      gameOver = !canMove();
      render();
    }
  }

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:1.2rem;width:100%';

  const scoreEl = document.createElement('div');
  scoreEl.style.cssText = 'font-family:var(--font-mono);font-size:1rem;color:var(--accent)';

  const board = document.createElement('div');
  board.style.cssText = `
    display:grid;grid-template-columns:repeat(4,1fr);gap:8px;
    background:#cdc1b4;border-radius:6px;padding:8px;max-width:280px;
  `;

  const info = document.createElement('div');
  info.style.cssText = 'font-size:0.8rem;color:var(--muted);text-align:center';

  wrap.append(scoreEl, board, info);
  gameContainer.appendChild(wrap);

  function render() {
    board.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const val = grid[r][c];
        const cell = document.createElement('div');
        cell.textContent = val || '';
        const colors = { 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e' };
        cell.style.cssText = `
          width:60px;height:60px;background:${colors[val] || '#3c3c2f'};
          display:flex;align-items:center;justify-content:center;
          font-size:1.8rem;font-weight:700;border-radius:3px;
          color:${val > 4 ? '#f9f6f2' : '#776e65'};
        `;
        board.appendChild(cell);
      }
    }
    scoreEl.textContent = `Score: ${score}`;
    info.textContent = gameOver ? '❌ Jeu Terminé!' : '⬅️➡️⬆️⬇️ ou Touches directionnelles';
  }

  addNewTile();
  addNewTile();
  render();

  document.addEventListener('keydown', e => {
    const keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (keys[e.key]) { e.preventDefault(); move(keys[e.key]); }
  });

  const btns = ['⬅️ Gauche', '➡️ Droite', '⬆️ Haut', '⬇️ Bas'].map((label, i) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.fontSize = '0.7rem';
    btn.className = 'btn-secondary';
    const dirs = ['left', 'right', 'up', 'down'];
    btn.addEventListener('click', () => move(dirs[i]));
    return btn;
  });

  const btnGrid = document.createElement('div');
  btnGrid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:0.5rem;max-width:280px;width:100%';
  btns.forEach(b => btnGrid.appendChild(b));
  wrap.appendChild(btnGrid);
}

/* ==============================
   SIMON SAYS GAME
   ============================== */
function initSimon() {
  const colors = ['#ff6b6b', '#51cf66', '#4ecdc4', '#ffd93d'];
  const colorNames = ['Red', 'Green', 'Blue', 'Yellow'];
  let sequence = [];
  let playerSequence = [];
  let level = 1;
  let gameActive = true;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:1.5rem;width:100%';

  const levelEl = document.createElement('div');
  levelEl.style.cssText = 'font-family:var(--font-mono);font-size:1.2rem;color:var(--accent)';

  const board = document.createElement('div');
  board.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-width:250px';

  const message = document.createElement('div');
  message.style.cssText = 'font-size:0.9rem;color:var(--muted);text-align:center;height:24px';

  wrap.append(levelEl, board, message);
  gameContainer.appendChild(wrap);

  function playSound(idx) {
    const btn = board.children[idx];
    const orig = btn.style.filter || '';
    btn.style.filter = 'brightness(1.3)';
    setTimeout(() => btn.style.filter = orig, 300);
  }

  function addNewColor() {
    sequence.push(Math.floor(Math.random() * 4));
  }

  function playSequence() {
    message.textContent = 'Regardez...';
    gameActive = false;
    let i = 0;
    const iv = setInterval(() => {
      playSound(sequence[i]);
      i++;
      if (i >= sequence.length) {
        clearInterval(iv);
        message.textContent = 'À vous !';
        gameActive = true;
        playerSequence = [];
      }
    }, 800);
  }

  function checkSequence() {
    if (playerSequence[playerSequence.length - 1] !== sequence[playerSequence.length - 1]) {
      message.textContent = `❌ Perdu au niveau ${level}!`;
      gameActive = false;
      return;
    }

    if (playerSequence.length === sequence.length) {
      level++;
      levelEl.textContent = `Niveau: ${level}`;
      message.textContent = '✓ Correct!';
      playerSequence = [];
      addNewColor();
      setTimeout(playSequence, 1500);
    }
  }

  colors.forEach((color, idx) => {
    const btn = document.createElement('div');
    btn.style.cssText = `
      width:100px;height:100px;background:${color};border-radius:8px;
      cursor:pointer;transition:all .1s;box-shadow:0 4px 8px rgba(0,0,0,.3);
    `;
    btn.addEventListener('click', () => {
      if (!gameActive) return;
      playSound(idx);
      playerSequence.push(idx);
      checkSequence();
    });
    board.appendChild(btn);
  });

  const startBtn = document.createElement('button');
  startBtn.textContent = '▶ Commencer';
  startBtn.className = 'btn-primary';
  startBtn.style.fontSize = '0.75rem';
  startBtn.addEventListener('click', () => {
    sequence = [];
    level = 1;
    gameActive = true;
    levelEl.textContent = `Niveau: ${level}`;
    addNewColor();
    playSequence();
    startBtn.style.display = 'none';
  });

  wrap.appendChild(startBtn);
  levelEl.textContent = `Niveau: ${level}`;
  message.textContent = 'Appuyez sur Commencer';
}

/* ==============================
   TIC TAC TOE GAME
   ============================== */
function initTicTacToe() {
  let board = Array(9).fill('');
  let gameActive = true;
  let isPlayerX = true;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:1.2rem;width:100%';

  const status = document.createElement('div');
  status.style.cssText = 'font-family:var(--font-mono);font-size:1rem;color:var(--accent)';

  const boardEl = document.createElement('div');
  boardEl.style.cssText = `
    display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
    background:var(--surface);padding:12px;border-radius:8px;max-width:220px;
  `;

  wrap.append(status, boardEl);
  gameContainer.appendChild(wrap);

  function checkWinner(b) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let [a, b1, b2] of lines) {
      if (b[a] && b[a] === b[b1] && b[a] === b[b2]) return b[a];
    }
    return null;
  }

  function aiMove() {
    const empty = board.map((v, i) => v === '' ? i : -1).filter(i => i !== -1);
    if (empty.length === 0) return;

    // Simple AI: try to win, else block, else random
    for (let idx of empty) {
      board[idx] = 'O';
      if (checkWinner(board) === 'O') return;
      board[idx] = '';
    }
    for (let idx of empty) {
      board[idx] = 'X';
      if (checkWinner(board) === 'X') {
        board[idx] = 'O';
        return;
      }
      board[idx] = '';
    }
    board[empty[Math.floor(Math.random() * empty.length)]] = 'O';
  }

  function render() {
    boardEl.innerHTML = '';
    board.forEach((val, idx) => {
      const cell = document.createElement('div');
      cell.textContent = val;
      cell.style.cssText = `
        width:70px;height:70px;display:flex;align-items:center;justify-content:center;
        background:var(--bg2);border:1px solid var(--border);border-radius:6px;
        font-size:1.8rem;font-weight:700;cursor:pointer;transition:all .2s;
      `;
      cell.addEventListener('mouseover', () => { if (!val && gameActive) cell.style.background = 'rgba(0,229,255,.1)'; });
      cell.addEventListener('mouseleave', () => { if (!val && gameActive) cell.style.background = 'var(--bg2)'; });
      cell.addEventListener('click', () => {
        if (!val && gameActive) {
          board[idx] = 'X';
          let winner = checkWinner(board);
          if (winner) {
            status.textContent = '🎉 Vous avez gagné!';
            gameActive = false;
          } else if (board.every(v => v !== '')) {
            status.textContent = '🤝 Match nul!';
            gameActive = false;
          } else {
            aiMove();
            winner = checkWinner(board);
            if (winner) {
              status.textContent = '😢 L\'IA a gagné!';
              gameActive = false;
            } else if (board.every(v => v !== '')) {
              status.textContent = '🤝 Match nul!';
              gameActive = false;
            }
          }
          render();
        }
      });
      boardEl.appendChild(cell);
    });
  }

  const resetBtn = document.createElement('button');
  resetBtn.textContent = '↺ Rejouer';
  resetBtn.className = 'btn-primary';
  resetBtn.style.fontSize = '0.75rem';
  resetBtn.addEventListener('click', () => {
    board = Array(9).fill('');
    gameActive = true;
    status.textContent = 'À votre tour (X)';
    render();
  });

  wrap.append(status, boardEl, resetBtn);
  render();
  status.textContent = 'À votre tour (X)';
}

/* ==============================
   TAMAGOTCHI GAME
   ============================== */
function initTamagotchi() {
  let hunger = 50;
  let happiness = 50;
  let energy = 70;
  let age = 0;
  let level = 'Bébé';
  let alive = true;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:1.2rem;max-width:300px;margin:0 auto;width:100%';

  const display = document.createElement('div');
  display.style.cssText = `
    background:var(--surface);border:2px solid var(--accent);border-radius:8px;
    padding:1.5rem;text-align:center;font-family:var(--font-mono);
  `;

  const creature = document.createElement('div');
  creature.style.cssText = 'font-size:5rem;margin-bottom:0.5rem;line-height:1;min-height:80px;display:flex;align-items:center;justify-content:center';

  const stats = document.createElement('div');
  stats.style.cssText = 'margin-bottom:1rem;font-size:0.75rem;color:var(--muted);text-align:left';

  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;width:100%';

  display.append(creature, stats);
  wrap.append(display, buttons);
  gameContainer.appendChild(wrap);

  function getCreatureFace() {
    if (!alive) return '☠️';
    if (happiness < 20) return '😢';
    if (hunger > 80) return '😫';
    if (energy < 20) return '😴';
    if (happiness > 75) return '😄';
    return '😊';
  }

  function updateDisplay() {
    creature.textContent = getCreatureFace();
    hunger = Math.max(0, Math.min(100, hunger));
    happiness = Math.max(0, Math.min(100, happiness));
    energy = Math.max(0, Math.min(100, energy));
    age++;

    if (age < 10) level = 'Bébé';
    else if (age < 30) level = 'Enfant';
    else if (age < 60) level = 'Adulte';
    else level = 'Sage';

    hunger += 0.5;
    energy -= 0.3;
    happiness -= 0.2;

    if (hunger > 95 || happiness < 5) alive = false;

    stats.innerHTML = `
      <div>🎂 Âge: ${age} | Niveau: <span style="color:var(--accent)">${level}</span></div>
      <div>🍗 Faim: <span style="${hunger>75?'color:#ff6b6b':'color:#51cf66'}">${Math.round(hunger)}%</span></div>
      <div>😊 Bonheur: <span style="${happiness<30?'color:#ff6b6b':'color:#51cf66'}">${Math.round(happiness)}%</span></div>
      <div>⚡ Énergie: <span style="${energy<30?'color:#ff6b6b':'color:#51cf66'}">${Math.round(energy)}%</span></div>
    `;

    if (!alive) {
      stats.innerHTML += '<div style="color:var(--error);margin-top:0.5rem">💀 Il n\'a pas survécu...</div>';
      $$('button', buttons).forEach(b=>b.disabled=true);
    }
  }

  const btnFeed = document.createElement('button');
  btnFeed.textContent = '🍗 Nourrir';
  btnFeed.className = 'btn-primary';
  btnFeed.style.fontSize = '0.75rem';
  btnFeed.addEventListener('click', () => {
    if (alive) { hunger -= 30; happiness += 5; updateDisplay(); }
  });

  const btnPlay = document.createElement('button');
  btnPlay.textContent = '🎮 Jouer';
  btnPlay.className = 'btn-primary';
  btnPlay.style.fontSize = '0.75rem';
  btnPlay.addEventListener('click', () => {
    if (alive && energy > 20) { happiness += 20; hunger += 10; energy -= 20; updateDisplay(); }
  });

  const btnSleep = document.createElement('button');
  btnSleep.textContent = '😴 Dormir';
  btnSleep.className = 'btn-secondary';
  btnSleep.style.fontSize = '0.75rem';
  btnSleep.addEventListener('click', () => {
    if (alive) { energy = 100; hunger += 20; updateDisplay(); }
  });

  const btnReset = document.createElement('button');
  btnReset.textContent = '↺ Nouveau';
  btnReset.className = 'btn-secondary';
  btnReset.style.fontSize = '0.75rem';
  btnReset.addEventListener('click', () => {
    hunger = 50; happiness = 50; energy = 70; age = 0; alive = true;
    btnFeed.disabled = false; btnPlay.disabled = false; btnSleep.disabled = false;
    updateDisplay();
  });

  buttons.append(btnFeed, btnPlay, btnSleep, btnReset);
  updateDisplay();

  const gameLoop = setInterval(() => {
    if (alive && document.body.contains(wrap)) updateDisplay();
    else clearInterval(gameLoop);
  }, 1000);
}

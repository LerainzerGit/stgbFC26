/* ========================================================================
   STGB FC 26 — a lightweight EA-FC-style top-down football game
   Built for Chart Studios Ltd / STGB (Stop The Gokid Behaviour)
   ======================================================================== */

// ---------- DATA ----------
const TEAMS = [
  { id:'STGB', name:'STGB',  primary:'#E60000', secondary:'#FFD400', isPlayer:true,  rating:80 },
  { id:'AUTTP', name:'AUTTP', primary:'#1C3D8F', secondary:'#FFFFFF', isPlayer:false, rating:74 },
  { id:'YROT',  name:'YROT',  primary:'#0B7A34', secondary:'#FFD400', isPlayer:false, rating:71 },
  { id:'UTTP',  name:'UTTP',  primary:'#7A0BAF', secondary:'#FFFFFF', isPlayer:false, rating:76 },
  { id:'ATBC',  name:'ATBC',  primary:'#111111', secondary:'#E60000', isPlayer:false, rating:73 },
  { id:'UTTD',  name:'UTTD',  primary:'#E67E00', secondary:'#111111', isPlayer:false, rating:75 },
  { id:'VGCP',  name:'VGCP',  primary:'#00A3E0', secondary:'#FFFFFF', isPlayer:false, rating:70 },
];

const DIFFICULTIES = {
  easy:         { label:'Easy',         aiSpeed:1.55, aiReact:0.35, aiAccuracy:0.45, matchLen:60  },
  amateur:      { label:'Amateur',      aiSpeed:1.75, aiReact:0.5,  aiAccuracy:0.55, matchLen:70  },
  semipro:      { label:'Semi-Pro',     aiSpeed:1.95, aiReact:0.65, aiAccuracy:0.68, matchLen:80  },
  professional: { label:'Professional', aiSpeed:2.15, aiReact:0.8,  aiAccuracy:0.8,  matchLen:90  },
  worldclass:   { label:'World Class',  aiSpeed:2.4,  aiReact:0.95, aiAccuracy:0.92, matchLen:100 },
};

const MODES = {
  friendly:    { label:'Friendly',    legs:1 },
  league:      { label:'League',      legs:1 },
  cup:         { label:'Cup',         legs:1 },
  tournament:  { label:'Tournament',  legs:1 },
};

// ---------- STATE ----------
const state = {
  mode: null,
  playerTeam: null,
  oppTeam: null,
  difficulty: null,
  paused: false,
};

// ---------- SCREEN NAV ----------
const screens = {};
document.querySelectorAll('.screen').forEach(el => screens[el.id] = el);
function showScreen(id){
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[id].classList.remove('hidden');
}

// Title -> Menu
document.getElementById('press-play-btn').addEventListener('click', () => showScreen('screen-menu'));

document.querySelectorAll('#screen-menu [data-action]').forEach(li => {
  li.addEventListener('click', () => {
    const action = li.dataset.action;
    if (action === 'play') showScreen('screen-mode');
    if (action === 'controls') showScreen('screen-controls');
    if (action === 'credits') showScreen('screen-credits');
  });
});

document.querySelectorAll('#screen-controls [data-action], #screen-credits [data-action]').forEach(el => {
  el.addEventListener('click', () => showScreen('screen-menu'));
});

// Mode select
document.querySelectorAll('#screen-mode [data-mode]').forEach(li => {
  li.addEventListener('click', () => {
    state.mode = li.dataset.mode;
    buildTeamGrid();
    document.getElementById('team-crumb').textContent =
      `STGB FC 26 / ${MODES[state.mode].label.toUpperCase()} / SELECT TEAM`;
    showScreen('screen-team');
  });
});
document.querySelector('#screen-mode [data-action="back-menu"]').addEventListener('click', () => showScreen('screen-menu'));

// Team select
function buildTeamGrid(){
  const grid = document.getElementById('team-grid');
  grid.innerHTML = '';
  state.playerTeam = null;
  document.getElementById('team-continue').style.opacity = 0.4;
  document.getElementById('team-continue').style.pointerEvents = 'none';
  TEAMS.forEach(t => {
    const card = document.createElement('div');
    card.className = 'team-card';
    card.dataset.teamId = t.id;
    card.innerHTML = `<div class="tname ${t.id==='STGB'?'tstgb':''}">${t.name}</div>
                       <div style="margin-top:8px;font-size:12px;color:#888;">OVR ${t.rating}</div>`;
    card.style.borderTopColor = t.primary;
    card.addEventListener('click', () => {
      document.querySelectorAll('.team-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.playerTeam = t;
      const contBtn = document.getElementById('team-continue');
      contBtn.style.opacity = 1;
      contBtn.style.pointerEvents = 'all';
    });
    grid.appendChild(card);
  });
}
document.querySelector('#screen-team [data-action="back-mode"]').addEventListener('click', () => showScreen('screen-mode'));
document.getElementById('team-continue').addEventListener('click', () => {
  if (!state.playerTeam) return;
  const others = TEAMS.filter(t => t.id !== state.playerTeam.id);
  state.oppTeam = others[Math.floor(Math.random()*others.length)];
  showScreen('screen-difficulty');
});

// Difficulty select
document.querySelectorAll('#diff-list [data-diff]').forEach(li => {
  li.addEventListener('click', () => {
    document.querySelectorAll('#diff-list li').forEach(l => l.classList.remove('selected'));
    li.classList.add('selected');
    state.difficulty = li.dataset.diff;
  });
});
document.querySelector('#screen-difficulty [data-action="back-team"]').addEventListener('click', () => showScreen('screen-team'));
document.getElementById('kickoff-btn').addEventListener('click', () => {
  if (!state.difficulty) state.difficulty = 'amateur';
  startMatch();
});

// Pause / fulltime navigation
document.getElementById('pause-btn').addEventListener('click', () => pauseGame());
document.querySelectorAll('#screen-pause [data-action]').forEach(li => {
  li.addEventListener('click', () => {
    const a = li.dataset.action;
    if (a === 'resume') resumeGame();
    if (a === 'restart') { resumeGame(); startMatch(); }
    if (a === 'quit-menu') { endMatchLoop(); showScreen('screen-menu'); }
  });
});
document.querySelectorAll('#screen-fulltime [data-action]').forEach(li => {
  li.addEventListener('click', () => {
    const a = li.dataset.action;
    if (a === 'quit-menu') showScreen('screen-menu');
    if (a === 'rematch') startMatch();
  });
});

// ============================================================
// MATCH ENGINE
// ============================================================
const canvas = document.getElementById('pitch');
const ctx = canvas.getContext('2d');
let PITCH = { w: 1000, h: 640, margin: 40 };

function resizeCanvas(){
  const dpr = window.devicePixelRatio || 1;
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = cw * dpr; canvas.height = ch * dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  PITCH.screenW = cw; PITCH.screenH = ch;
}
window.addEventListener('resize', resizeCanvas);

let match = null;
let rafId = null;
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (match && !screens['screen-match'].classList.contains('hidden')) {
      state.paused ? resumeGame() : pauseGame();
    }
  }
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

function makeVec(x,y){ return {x,y}; }

function initMatch(){
  const diff = DIFFICULTIES[state.difficulty];
  const W = PITCH.w, H = PITCH.h;
  const m = {
    time: 0,
    matchLen: diff.matchLen, // seconds (compressed match length)
    scoreHome: 0, scoreAway: 0,
    diff,
    ball: { x: W/2, y: H/2, vx:0, vy:0, r:7, owner:null },
    home: TEAMS.find(t=>t.id===state.playerTeam.id),
    away: TEAMS.find(t=>t.id===state.oppTeam.id),
    players: [],
    ended:false,
  };
  // Build 5 home players (1 controlled by user, 4 AI-assisted teammates) + 5 away AI players
  const homeFormation = [ [W*0.15,H/2], [W*0.35,H*0.25], [W*0.35,H*0.75], [W*0.55,H*0.35], [W*0.55,H*0.65] ];
  const awayFormation = [ [W*0.85,H/2], [W*0.65,H*0.25], [W*0.65,H*0.75], [W*0.45,H*0.35], [W*0.45,H*0.65] ];
  homeFormation.forEach((pos,i) => {
    m.players.push({
      team:'home', idx:i, x:pos[0], y:pos[1], baseX:pos[0], baseY:pos[1],
      r:12, isUser:(i===0), color:m.home.primary, ring:m.home.secondary, speed:2.6,
    });
  });
  awayFormation.forEach((pos,i) => {
    m.players.push({
      team:'away', idx:i, x:pos[0], y:pos[1], baseX:pos[0], baseY:pos[1],
      r:12, isUser:false, color:m.away.primary, ring:m.away.secondary, speed:diff.aiSpeed,
    });
  });
  return m;
}

function startMatch(){
  resizeCanvas();
  match = initMatch();
  state.paused = false;
  document.getElementById('hud-home').textContent = match.home.name;
  document.getElementById('hud-away').textContent = match.away.name;
  document.getElementById('hud-home').style.color = match.home.secondary;
  document.getElementById('hud-away').style.color = match.away.secondary;
  updateHud();
  showScreen('screen-match');
  cancelAnimationFrame(rafId);
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);
}

function pauseGame(){
  state.paused = true;
  showScreen('screen-pause');
}
function resumeGame(){
  state.paused = false;
  showScreen('screen-match');
  lastTime = performance.now();
}
function endMatchLoop(){
  cancelAnimationFrame(rafId);
  match = null;
}

let lastTime = 0;
function loop(now){
  rafId = requestAnimationFrame(loop);
  if (state.paused || !match) return;
  const dt = Math.min(0.05, (now - lastTime)/1000);
  lastTime = now;
  updateMatch(dt);
  drawMatch();
}

function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }

function updateMatch(dt){
  const m = match;
  m.time += dt * (90/m.matchLen); // scale to a 90-min match display
  if (m.time >= 90 && !m.ended) {
    m.ended = true;
    finishMatch();
    return;
  }

  const user = m.players.find(p=>p.isUser);
  // --- user input ---
  let ix=0, iy=0;
  if (keys['arrowup']||keys['w']) iy -= 1;
  if (keys['arrowdown']||keys['s']) iy += 1;
  if (keys['arrowleft']||keys['a']) ix -= 1;
  if (keys['arrowright']||keys['d']) ix += 1;
  const sprint = (keys['shift']) ? 1.6 : 1;
  const len = Math.hypot(ix,iy) || 1;
  user.x = clamp(user.x + (ix/len)*user.speed*sprint*dt*60, 10, PITCH.w-10);
  user.y = clamp(user.y + (iy/len)*user.speed*sprint*dt*60, 10, PITCH.h-10);

  // shoot / tackle
  if (keys[' ']) {
    if (m.ball.owner === user) {
      kickBall(user, true);
    } else if (dist(user, m.ball) < 22) {
      m.ball.owner = user;
    }
    keys[' '] = false;
  }

  // --- AI teammates & opponents ---
  m.players.forEach(p => {
    if (p.isUser) return;
    aiUpdate(p, dt);
  });

  // --- ball possession follow ---
  if (m.ball.owner) {
    const o = m.ball.owner;
    m.ball.x = o.x + (o.team==='home'?14:-14);
    m.ball.y = o.y;
    m.ball.vx = 0; m.ball.vy = 0;
  } else {
    m.ball.x += m.ball.vx * dt*60;
    m.ball.y += m.ball.vy * dt*60;
    m.ball.vx *= 0.985; m.ball.vy *= 0.985;
    if (m.ball.y < 12 || m.ball.y > PITCH.h-12) m.ball.vy *= -1;
    m.ball.x = clamp(m.ball.x, 4, PITCH.w-4);
    m.ball.y = clamp(m.ball.y, 4, PITCH.h-4);

    // pickup by nearest player if close
    let nearest=null, nd=999;
    m.players.forEach(p => { const d=dist(p,m.ball); if (d<nd){nd=d; nearest=p;} });
    if (nearest && nd < 16 && (Math.abs(m.ball.vx)+Math.abs(m.ball.vy) < 2)) {
      m.ball.owner = nearest;
    }
  }

  // goal check
  const gTop = PITCH.h/2 - 55, gBot = PITCH.h/2 + 55;
  if (m.ball.x <= 6 && m.ball.y > gTop && m.ball.y < gBot) {
    m.scoreAway++; resetKickoff(m,'home'); updateHud(); flashGoal(m.away.name);
  } else if (m.ball.x >= PITCH.w-6 && m.ball.y > gTop && m.ball.y < gBot) {
    m.scoreHome++; resetKickoff(m,'away'); updateHud(); flashGoal(m.home.name);
  }
  document.getElementById('hud-clock').textContent =
    Math.floor(m.time).toString().padStart(2,'0') + ":00";
}

function kickBall(p, isUser){
  const m = match;
  const targetGoalX = p.team==='home' ? PITCH.w : 0;
  const dx = targetGoalX - p.x, dy = (PITCH.h/2) - p.y;
  const l = Math.hypot(dx,dy)||1;
  const power = 9;
  m.ball.owner = null;
  m.ball.vx = (dx/l)*power;
  m.ball.vy = (dy/l)*power + (Math.random()-0.5)*2;
}

function aiUpdate(p, dt){
  const m = match;
  const diff = m.diff;
  const hasBall = m.ball.owner === p;
  const targetGoalX = p.team==='home' ? PITCH.w-20 : 20;

  if (hasBall) {
    // dribble toward goal, shoot if close enough
    const distToGoal = Math.abs(targetGoalX - p.x);
    if (distToGoal < 130 && Math.random() < diff.aiReact*dt*3) {
      if (Math.random() < diff.aiAccuracy) kickBall(p);
      else { kickBall(p); m.ball.vy += (Math.random()-0.5)*6; }
      return;
    }
    const dx = targetGoalX - p.x, dy = (PITCH.h/2) - p.y;
    const l = Math.hypot(dx,dy)||1;
    p.x = clamp(p.x + (dx/l)*p.speed*dt*60, 10, PITCH.w-10);
    p.y = clamp(p.y + (dy/l)*p.speed*dt*60, 10, PITCH.h-10);
  } else {
    // chase ball if near, else hold shape and press
    const d = dist(p, m.ball);
    const chaseRange = 140 + diff.aiReact*80;
    let tx, ty;
    if (d < chaseRange) { tx = m.ball.x; ty = m.ball.y; }
    else { tx = p.baseX; ty = p.baseY; }
    const dx = tx - p.x, dy = ty - p.y;
    const l = Math.hypot(dx,dy)||1;
    if (l > 4) {
      p.x = clamp(p.x + (dx/l)*p.speed*dt*60, 10, PITCH.w-10);
      p.y = clamp(p.y + (dy/l)*p.speed*dt*60, 10, PITCH.h-10);
    }
    // steal possession
    if (!m.ball.owner && dist(p,m.ball) < 14) {
      if (Math.random() < diff.aiReact) m.ball.owner = p;
    } else if (m.ball.owner && m.ball.owner.team !== p.team && dist(p,m.ball.owner) < 18) {
      if (Math.random() < diff.aiReact*0.5*dt*10) m.ball.owner = null;
    }
  }
}

function resetKickoff(m, possessionTeam){
  m.ball.owner = null;
  m.ball.x = PITCH.w/2; m.ball.y = PITCH.h/2; m.ball.vx=0; m.ball.vy=0;
  m.players.forEach(p => { p.x = p.baseX; p.y = p.baseY; });
}

let goalFlashTimer = 0, goalFlashText = '';
function flashGoal(teamName){
  goalFlashTimer = 2.2;
  goalFlashText = 'GOAL! ' + teamName;
}

function updateHud(){
  document.getElementById('hud-score').textContent = `${match.scoreHome} - ${match.scoreAway}`;
}

function finishMatch(){
  cancelAnimationFrame(rafId);
  document.getElementById('ft-home').textContent = match.home.name;
  document.getElementById('ft-away').textContent = match.away.name;
  document.getElementById('ft-home').style.color = match.home.secondary;
  document.getElementById('ft-away').style.color = match.away.secondary;
  document.getElementById('ft-score').textContent = `${match.scoreHome} - ${match.scoreAway}`;
  let res = 'DRAW';
  if (match.scoreHome > match.scoreAway) res = `${match.home.name} WIN!`;
  else if (match.scoreAway > match.scoreHome) res = `${match.away.name} WIN`;
  document.getElementById('ft-result').textContent = res;
  showScreen('screen-fulltime');
}

// ---------- DRAW ----------
function drawMatch(){
  const m = match;
  const W = PITCH.screenW, H = PITCH.screenH;
  ctx.clearRect(0,0,W,H);

  // scale pitch to fit screen with margin
  const scaleX = (W-60)/PITCH.w, scaleY = (H-60)/PITCH.h;
  const scale = Math.min(scaleX, scaleY);
  const offX = (W - PITCH.w*scale)/2, offY = (H - PITCH.h*scale)/2;
  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);

  // pitch stripes
  const stripes = 10;
  for (let i=0;i<stripes;i++){
    ctx.fillStyle = i%2===0 ? '#0b8a3a' : '#0a7d34';
    ctx.fillRect(i*(PITCH.w/stripes), 0, PITCH.w/stripes, PITCH.h);
  }
  // border & lines
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.strokeRect(4,4,PITCH.w-8,PITCH.h-8);
  ctx.beginPath(); ctx.moveTo(PITCH.w/2,4); ctx.lineTo(PITCH.w/2,PITCH.h-4); ctx.stroke();
  ctx.beginPath(); ctx.arc(PITCH.w/2,PITCH.h/2,55,0,Math.PI*2); ctx.stroke();
  // penalty boxes
  ctx.strokeRect(4, PITCH.h/2-110, 110, 220);
  ctx.strokeRect(PITCH.w-114, PITCH.h/2-110, 110, 220);
  // goals
  ctx.fillStyle='rgba(255,255,255,0.9)';
  ctx.fillRect(0, PITCH.h/2-55, 6, 110);
  ctx.fillRect(PITCH.w-6, PITCH.h/2-55, 6, 110);

  // players
  m.players.forEach(p => {
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = p.ring;
    ctx.stroke();
    if (p.isUser) {
      ctx.beginPath();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.arc(p.x,p.y,p.r+5,0,Math.PI*2);
      ctx.stroke();
    }
  });

  // ball
  ctx.beginPath();
  ctx.fillStyle = '#fff';
  ctx.arc(m.ball.x, m.ball.y, m.ball.r, 0, Math.PI*2);
  ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#333'; ctx.stroke();

  ctx.restore();

  // goal flash
  if (goalFlashTimer > 0) {
    goalFlashTimer -= 1/60;
    ctx.save();
    ctx.globalAlpha = Math.min(1, goalFlashTimer);
    ctx.fillStyle = '#FFD400';
    ctx.font = 'bold 56px Arial Black, Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#E60000'; ctx.lineWidth = 4;
    ctx.strokeText(goalFlashText, W/2, H/2);
    ctx.fillText(goalFlashText, W/2, H/2);
    ctx.restore();
  }
}

// initial sizing
resizeCanvas();

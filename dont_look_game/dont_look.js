(function(){
"use strict"
const TILE = 40, COLS = 38, ROWS = 24;
const WORLD_W = TILE*COLS, WORLD_H = TILE*ROWS;
const PLAYER_RADIUS = 14, PLAYER_SPEED = 190;
const ENTITY_RADIUS = 16, ENTITY_SPEED = 68, ENTITY_SPEED_CURIOUS = 102;
const CONE_HALF_ANGLE = 30 * Math.PI/180;
const CONE_RANGE = 260;
const AMBIENT_RADIUS = 66;
const SEEN_LIMIT = 0.9;       
const SEEN_DECAY = 2.2;       
const DREAD_RANGE = 430;      
const PICKUP_RADIUS = 34;
const EXIT_RADIUS = 46;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const fog = document.createElement('canvas');
const fctx = fog.getContext('2d');
 
function resize(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  fog.width = canvas.width;
  fog.height = canvas.height;
}
window.addEventListener('resize', resize);
resize();
let grid = [];
function initGrid(){
  grid = [];
  for(let y=0;y<ROWS;y++){
    const row = [];
    for(let x=0;x<COLS;x++) row.push(1); 
    grid.push(row);
  }
}
function carve(rx,ry,rw,rh){
  for(let y=ry;y<ry+rh;y++){
    for(let x=rx;x<rx+rw;x++){
      if(y>=0 && y<ROWS && x>=0 && x<COLS) grid[y][x] = 0; 
    }
  }
}

const rooms = [
  { name:'start',     x:2,  y:9,  w:6, h:6 },
  { name:'storage',   x:2,  y:1,  w:6, h:5 },
  { name:'office',    x:16, y:1,  w:7, h:5 },
  { name:'generator', x:30, y:8,  w:7, h:6 },
  { name:'keyroom',   x:16, y:17, w:6, h:5 },
  { name:'exit',      x:31, y:17, w:6, h:5 },
];
 
function buildMap(){
  initGrid();
  rooms.forEach(r=>carve(r.x,r.y,r.w,r.h));
  carve(4,11,32,2);   
  carve(4,5,3,6);     
  carve(18,5,3,6);    
  carve(18,13,3,5);   
  carve(33,13,3,5);   
}
buildMap();
 
const centers = rooms.map(r => ({ x:(r.x+r.w/2)*TILE, y:(r.y+r.h/2)*TILE }));
 
function tileAt(tx,ty){
  if(tx<0||ty<0||tx>=COLS||ty>=ROWS) return 1;
  return grid[ty][tx];
}
function isWallWorld(x,y){ return tileAt(Math.floor(x/TILE), Math.floor(y/TILE)) === 1; }

function collides(x,y,r){
  return isWallWorld(x-r,y) || isWallWorld(x+r,y) || isWallWorld(x,y-r) || isWallWorld(x,y+r) ||
         isWallWorld(x-r*0.7,y-r*0.7) || isWallWorld(x+r*0.7,y-r*0.7) ||
         isWallWorld(x-r*0.7,y+r*0.7) || isWallWorld(x+r*0.7,y+r*0.7);
}

function moveWithCollision(obj, dx, dy, r){
  const nx = obj.x + dx;
  if(!collides(nx, obj.y, r)) obj.x = nx;
  const ny = obj.y + dy;
  if(!collides(obj.x, ny, r)) obj.y = ny;
}

function hasLineOfSight(x0,y0,x1,y1){
  const dist = Math.hypot(x1-x0, y1-y0);
  const steps = Math.max(1, Math.ceil(dist/8));
  for(let i=1;i<steps;i++){
    const t = i/steps;
    if(isWallWorld(x0+(x1-x0)*t, y0+(y1-y0)*t)) return false;
  }
  return true;
}
const SHEET_SRC = "assets/spritesheet.png";
const CELL = 64;
const sheet = new Image();
let sheetReady = false;
sheet.onload = () => { sheetReady = true; };
sheet.src = SHEET_SRC;
 
function spriteCoords(cx,cy){ return [cx*CELL, cy*CELL, CELL, CELL]; }
const SPR = {
  playerIdle: spriteCoords(0,0), playerWalk: spriteCoords(1,0),
  entityA: spriteCoords(0,1), entityB: spriteCoords(1,1),
  note: spriteCoords(0,2), key: spriteCoords(1,2),
  floor: spriteCoords(0,3), wall: spriteCoords(1,3), exitFloor: spriteCoords(2,3),
};
let actx = null, muted = false;
let droneNodes = null;
function initAudio(){
  if(actx) return;
  actx = new (window.AudioContext||window.webkitAudioContext)();
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type='sine'; osc.frequency.value = 52;
  gain.gain.value = 0.02;
  osc.connect(gain); gain.connect(actx.destination);
  osc.start();
  const lfo = actx.createOscillator();
  const lfoGain = actx.createGain();
  lfo.frequency.value = 0.13; lfoGain.gain.value = 0.012;
  lfo.connect(lfoGain); lfoGain.connect(gain.gain);
  lfo.start();
  droneNodes = { osc, gain, lfo };
}

function tone(freq, dur, type, vol){
  if(muted || !actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type||'sine'; o.frequency.value = freq;
  g.gain.value = vol||0.05;
  o.connect(g); g.connect(actx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
  o.stop(actx.currentTime + dur + 0.02);
}
function playPickup(){ tone(660,0.12,'square',0.04); setTimeout(()=>tone(880,0.14,'square',0.04),90); }
function playUnlockFail(){ tone(120,0.25,'sawtooth',0.05); }
function playWin(){ tone(440,0.18,'sine',0.05); setTimeout(()=>tone(660,0.22,'sine',0.05),150); setTimeout(()=>tone(880,0.3,'sine',0.05),320); }
function playDeath(){
  if(muted || !actx) return;
  const bufSize = actx.sampleRate*0.4;
  const buf = actx.createBuffer(1,bufSize,actx.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<bufSize;i++) data[i] = (Math.random()*2-1)*(1-i/bufSize);
  const src = actx.createBufferSource(); src.buffer = buf;
  const g = actx.createGain(); g.gain.value = 0.22;
  src.connect(g); g.connect(actx.destination); src.start();
  tone(220,0.5,'sawtooth',0.06);
}
function heartbeat(strength){
  if(muted || !actx || strength<=0) return;
  tone(70, 0.1, 'sine', 0.02+strength*0.05);
}
let state = 'start'; 
const player = { x:0, y:0, facing:0 };
const entity = { x:0, y:0, target:null, idleTimer:0 };
let mouse = { x:0, y:0 };
let keys = {};
let notes = [false,false,false];
let hasKey = false;
let seenTimer = 0;
let heartbeatCooldown = 0;
let ambientCooldown = 6+Math.random()*6;
let flashAlpha = 0, shakeTimer = 0;
let toasts = [];
let last = 0;
 
const NOTE_TEXT = [
  "Do not look at it more than half a second. It learns the shape of whatever watches it back.",
  "Dr. Salunkhe insisted we keep working after the incident. I told him the cameras don't show anything because there's nothing to show — it isn't there unless you make it there. Looking is what gives it a shape.",
  "Power's been cut to hawkins lab for six days. Something down here doesn't need light to move. It only needs you to give it your eyes."
];

function itemPositions(){
  return {
    notes: [centers[1], centers[2], centers[3]],
    key: centers[4],
    exit: { x: centers[5].x+80, y: centers[5].y },
  };
}
const POS = itemPositions();
 
function resetGame(){
  player.x = centers[0].x; player.y = centers[0].y; player.facing = 0;
  entity.x = centers[3].x; entity.y = centers[3].y; entity.target = null; entity.idleTimer = 0;
  notes = [false,false,false];
  hasKey = false;
  seenTimer = 0;
  flashAlpha = 0; shakeTimer = 0;
  toasts = [];
  updateHUD();
}
 
function updateHUD(){
  document.getElementById('dotA').classList.toggle('on', notes[0]);
  document.getElementById('dotB').classList.toggle('on', notes[1]);
  document.getElementById('dotC').classList.toggle('on', notes[2]);
  const dk = document.getElementById('dotKey');
  dk.classList.toggle('key-on', hasKey);
}
 
function showToast(text, dur){
  toasts.push({ text, until: performance.now() + (dur||2200) });
  renderToasts();
}
function renderToasts(){
  const el = document.getElementById('toasts');
  el.innerHTML = '';
  toasts.forEach(t=>{
    const d = document.createElement('div');
    d.className='toast'; d.textContent = t.text;
    el.appendChild(d);
  });
}
window.addEventListener('keydown', e=>{
  keys[e.key.toLowerCase()] = true;
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault();
  if(state==='reading' && (e.key===' '||e.key==='Enter')) closeNote();
});
window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', e=>{ mouse.x = e.clientX; mouse.y = e.clientY; });
 
function beginGame(){
  initAudio();
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('mute').classList.remove('hidden');
  resetGame();
  state = 'playing';
  showToast("Remember: don't look at it.", 2600);
  last = performance.now();
  requestAnimationFrame(loop);
}
document.getElementById('startBtn').addEventListener('click', ()=>{
  if(sheetReady) beginGame();
  else sheet.onload = () => { sheetReady = true; beginGame(); };
});
document.getElementById('restartBtn').addEventListener('click', ()=>{
  document.getElementById('endScreen').classList.add('hidden');
  resetGame();
  state = 'playing';
  last = performance.now();
  requestAnimationFrame(loop);
});
document.getElementById('noteContinue').addEventListener('click', closeNote);
document.getElementById('mute').addEventListener('click', ()=>{
  muted = !muted;
  document.getElementById('mute').textContent = 'sound: ' + (muted?'off':'on');
  if(droneNodes) droneNodes.gain.gain.value = muted?0:0.02;
});
 
let pendingNoteIndex = -1;
function openNote(i){
  pendingNoteIndex = i;
  document.getElementById('noteText').textContent = NOTE_TEXT[i];
  document.getElementById('noteModal').classList.remove('hidden');
  state = 'reading';
}
function closeNote(){
  if(state!=='reading') return;
  document.getElementById('noteModal').classList.add('hidden');
  if(pendingNoteIndex>=0){ notes[pendingNoteIndex] = true; updateHUD(); }
  pendingNoteIndex = -1;
  state = 'playing';
}
function pickEntityTarget(){
  if(Math.random() < 0.35){
    entity.target = { x: player.x, y: player.y };
  } else {
    const r = centers[Math.floor(Math.random()*centers.length)];
    entity.target = { x: r.x + (Math.random()*80-40), y: r.y + (Math.random()*80-40) };
  }
}
function updateEntity(dt){
  if(entity.idleTimer > 0){ entity.idleTimer -= dt; return; }
  if(!entity.target || Math.hypot(entity.target.x-entity.x, entity.target.y-entity.y) < 14){
    if(Math.random() < 0.25){ entity.idleTimer = 1 + Math.random()*2; }
    pickEntityTarget();
    return;
  }
  const dx = entity.target.x - entity.x, dy = entity.target.y - entity.y;
  const dist = Math.hypot(dx,dy) || 1;
  const speed = (Math.hypot(entity.target.x-player.x, entity.target.y-player.y) < 30) ? ENTITY_SPEED_CURIOUS : ENTITY_SPEED;
  moveWithCollision(entity, (dx/dist)*speed*dt, (dy/dist)*speed*dt, ENTITY_RADIUS);
}

function triggerDeath(){
  state = 'dead';
  flashAlpha = 1; shakeTimer = 0.35;
  playDeath();
  setTimeout(()=>{
    document.getElementById('endTitle').textContent = 'You looked.';
    document.getElementById('endLede').textContent = 'It saw you seeing it.';
    document.getElementById('endScreen').classList.remove('hidden');
  }, 650);
}
function triggerWin(){
  state = 'won';
  playWin();
  document.getElementById('endTitle').textContent = "You Escaped.";
  document.getElementById('endLede').textContent = 'Hawkins Lab is behind you now.';
  document.getElementById('endScreen').classList.remove('hidden');
}
 
function update(dt){
  toasts = toasts.filter(t=>t.until > performance.now());
  if(toasts.length !== document.getElementById('toasts').children.length) renderToasts();
 
  if(state !== 'playing'){
    if(shakeTimer>0) shakeTimer = Math.max(0, shakeTimer-dt);
    if(flashAlpha>0) flashAlpha = Math.max(0, flashAlpha - dt*2.2);
    return;
  }

  let mx=0, my=0;
  if(keys['w']||keys['arrowup']) my -= 1;
  if(keys['s']||keys['arrowdown']) my += 1;
  if(keys['a']||keys['arrowleft']) mx -= 1;
  if(keys['d']||keys['arrowright']) mx += 1;
  if(mx||my){
    const len = Math.hypot(mx,my);
    mx/=len; my/=len;
    moveWithCollision(player, mx*PLAYER_SPEED*dt, my*PLAYER_SPEED*dt, PLAYER_RADIUS);
  }
  player.facing = Math.atan2(mouse.y - canvas.height/2, mouse.x - canvas.width/2);
 
  updateEntity(dt);

  POS.notes.forEach((p,i)=>{
    if(!notes[i] && Math.hypot(player.x-p.x, player.y-p.y) < PICKUP_RADIUS){
      playPickup();
      openNote(i);
    }
  });
  if(!hasKey && Math.hypot(player.x-POS.key.x, player.y-POS.key.y) < PICKUP_RADIUS){
    hasKey = true; updateHUD(); playPickup();
    showToast('Found the key. Cold, like it has been in a fridge.');
  }
  if(Math.hypot(player.x-POS.exit.x, player.y-POS.exit.y) < EXIT_RADIUS){
    if(notes.every(n=>n) && hasKey){ triggerWin(); }
  }

  const dx = entity.x-player.x, dy = entity.y-player.y;
  const dist = Math.hypot(dx,dy);
  let diff = Math.atan2(dy,dx) - player.facing;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // normalize angle
  const inCone = Math.abs(diff) < CONE_HALF_ANGLE && dist < CONE_RANGE;
  const seen = inCone && hasLineOfSight(player.x,player.y, entity.x,entity.y);
  
  if(seen){ seenTimer = Math.min(SEEN_LIMIT+0.2, seenTimer + dt); }
  else { seenTimer = Math.max(0, seenTimer - dt*SEEN_DECAY); }
  if(seenTimer >= SEEN_LIMIT){ triggerDeath(); return; }
 
  const proximity = Math.max(0, 1 - dist/DREAD_RANGE);
  heartbeatCooldown -= dt;
  if(heartbeatCooldown <= 0 && proximity > 0.05){
    heartbeat(proximity);
    heartbeatCooldown = 0.9 - proximity*0.55;
  }
  ambientCooldown -= dt;
  if(ambientCooldown <= 0){
    tone(90+Math.random()*40, 0.35, 'triangle', 0.02);
    ambientCooldown = 7 + Math.random()*9;
  }

  const bar = document.getElementById('dangerBar');
  const wrap = document.getElementById('dangerWrap');
  const frac = Math.min(1, seenTimer/SEEN_LIMIT);
  bar.style.width = (frac*100)+'%';
  wrap.style.opacity = frac>0.03 ? 1 : 0;
}
let animT = 0;
function render(dt){
  animT += dt;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,w,h);
  let shakeX=0, shakeY=0;
  if(shakeTimer>0){ shakeX=(Math.random()*2-1)*8; shakeY=(Math.random()*2-1)*8; }
 
  ctx.save();
  ctx.translate(Math.round(w/2 - player.x + shakeX), Math.round(h/2 - player.y + shakeY));

  for(let y=0;y<ROWS;y++){
    for(let x=0;x<COLS;x++){
      const wx=x*TILE, wy=y*TILE;
      if(wx < player.x - w/2 - TILE*2 || wx > player.x + w/2 + TILE*2) continue;
      if(wy < player.y - h/2 - TILE*2 || wy > player.y + h/2 + TILE*2) continue;
      const isExit = Math.hypot(wx+TILE/2-POS.exit.x, wy+TILE/2-POS.exit.y) < TILE*1.4;
      const s = grid[y][x]===1 ? SPR.wall : (isExit ? SPR.exitFloor : SPR.floor);
      ctx.drawImage(sheet, s[0],s[1],s[2],s[3], wx,wy, TILE,TILE);
    }
  }

  const bob = Math.sin(animT*2.4)*4;
  POS.notes.forEach((p,i)=>{
    if(notes[i]) return;
    ctx.save(); ctx.translate(p.x,p.y+bob);
    ctx.shadowColor='rgba(216,161,60,0.8)'; ctx.shadowBlur=16;
    ctx.drawImage(sheet, ...SPR.note, -18,-18,36,36);
    ctx.restore();
  });
  if(!hasKey){
    ctx.save(); ctx.translate(POS.key.x, POS.key.y+bob);
    ctx.shadowColor='rgba(111,214,201,0.85)'; ctx.shadowBlur=16;
    ctx.drawImage(sheet, ...SPR.key, -18,-18,36,36);
    ctx.restore();
  }

  const eFrame = (Math.floor(animT*2)%2===0) ? SPR.entityA : SPR.entityB;
  ctx.save();
  ctx.translate(entity.x, entity.y);
  ctx.drawImage(sheet, ...eFrame, -20,-24,40,48);
  ctx.restore();
  const walking = (keys['w']||keys['a']||keys['s']||keys['d']||keys['arrowup']||keys['arrowdown']||keys['arrowleft']||keys['arrowright']);
  const pFrame = walking && Math.floor(animT*8)%2===0 ? SPR.playerWalk : SPR.playerIdle;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.facing + Math.PI/2);
  ctx.drawImage(sheet, ...pFrame, -18,-18,36,36);
  ctx.restore();
  ctx.restore();
  fctx.clearRect(0,0,w,h);
  fctx.fillStyle = 'rgba(0,0,0,0.965)';
  fctx.fillRect(0,0,w,h);
  fctx.globalCompositeOperation = 'destination-out'; // Erases the fog where we draw lights
  const cx=w/2+shakeX, cy=h/2+shakeY;
  const jitter = 1 + Math.sin(animT*11)*0.03 + (Math.random()-0.5)*0.02;
  const ambGrad = fctx.createRadialGradient(cx,cy,0,cx,cy,AMBIENT_RADIUS*jitter);
  ambGrad.addColorStop(0,'rgba(255,255,255,0.5)');
  ambGrad.addColorStop(1,'rgba(255,255,255,0)');
  fctx.fillStyle = ambGrad;
  fctx.beginPath(); fctx.arc(cx,cy,AMBIENT_RADIUS*jitter,0,Math.PI*2); fctx.fill();
  fctx.save();
  fctx.translate(cx,cy);
  fctx.rotate(player.facing);
  const coneGrad = fctx.createRadialGradient(0,0,0,0,0,CONE_RANGE*jitter);
  coneGrad.addColorStop(0,'rgba(255,255,255,0.92)');
  coneGrad.addColorStop(0.7,'rgba(255,255,255,0.5)');
  coneGrad.addColorStop(1,'rgba(255,255,255,0)');
  fctx.fillStyle = coneGrad;
  fctx.beginPath();
  fctx.moveTo(0,0);
  fctx.arc(0,0,CONE_RANGE*jitter, -CONE_HALF_ANGLE, CONE_HALF_ANGLE);
  fctx.closePath();
  fctx.fill();
  fctx.restore();
  fctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(fog,0,0);
  const vg = ctx.createRadialGradient(w/2,h/2,h*0.25,w/2,h/2,h*0.75);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,w,h);
  const dist = Math.hypot(entity.x-player.x, entity.y-player.y);
  const proximity = Math.max(0, 1-dist/DREAD_RANGE);
  const redAlpha = proximity*0.12 + Math.min(1, seenTimer/SEEN_LIMIT)*0.4;
  if(redAlpha > 0.01){
    ctx.fillStyle = `rgba(120,10,10,${redAlpha})`;
    ctx.fillRect(0,0,w,h);
  }
  if(flashAlpha > 0){
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(0,0,w,h);
  }
}
function loop(now){
  const dt = Math.min(0.05, (now-last)/1000);
  last = now;
  update(dt);
  render(dt);
  if(state==='playing' || state==='reading' || state==='dead'){
    requestAnimationFrame(loop);
  } else if(state==='won'){
    render(dt);
  }
}
})();
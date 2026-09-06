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
const SHEET_SRC = "spritesheet.png";
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
})
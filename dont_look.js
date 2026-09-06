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
})
/* JUGADOR: AABB 0.6×1.8×0.6 contra la grilla, selección con DDA */
import { GS } from './state.js';
import * as THREE from 'three';
import { clamp } from './util.js';
import { WX, WZ } from './blocks.js';
import { getB, hmap, inWorld, SPAWN } from './world.js';
import { camera } from './render.js';

export const HW = 0.3, PH = 1.8, EYE = 1.62, REACH = 6;
export const player = { x:SPAWN.x, y:hmap[Math.floor(SPAWN.x) + Math.floor(SPAWN.z)*WX] + 0.01, z:SPAWN.z, vx:0, vy:0, vz:0, yaw:0.9, pitch:-0.08, ground:false };
export const keys = {};
export function boxHits(px, py, pz){ const x0 = Math.floor(px-HW), x1 = Math.floor(px+HW), y0 = Math.floor(py), y1 = Math.floor(py+PH), z0 = Math.floor(pz-HW), z1 = Math.floor(pz+HW);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (getB(x, y, z)) return true; return false; }
export function updatePlayer(dt){
  if (keys.ArrowLeft) player.yaw += 1.9*dt; if (keys.ArrowRight) player.yaw -= 1.9*dt; if (keys.ArrowUp) player.pitch += 1.3*dt; if (keys.ArrowDown) player.pitch -= 1.3*dt; player.pitch = clamp(player.pitch, -1.55, 1.55);
  let f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + GS.joyF, s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + GS.joyS;
  const sn = Math.sin(player.yaw), cs = Math.cos(player.yaw); let wx = -sn*f + cs*s, wz = -cs*f - sn*s; const l = Math.hypot(wx, wz); if (l > 1){ wx /= l; wz /= l; }
  const sp = (keys.ShiftLeft || keys.ShiftRight || Math.hypot(GS.joyF, GS.joyS) > 0.92) ? 6.6 : 4.3, k = Math.min(1, (player.ground ? 14 : 5)*dt);
  player.vx += (wx*sp - player.vx)*k; player.vz += (wz*sp - player.vz)*k; player.vy = Math.max(-19, player.vy - 26*dt);
  if (keys.Space && player.ground){ player.vy = 8.4; player.ground = false; }
  // resolución por eje: X, Z, Y
  player.x = clamp(player.x + player.vx*dt, HW + 0.001, WX - HW - 0.001);   // muro invisible en los bordes
  if (boxHits(player.x, player.y, player.z)){ player.x = player.vx > 0 ? Math.floor(player.x + HW) - HW - 1e-4 : Math.floor(player.x - HW) + 1 + HW + 1e-4; player.vx = 0; }
  player.z = clamp(player.z + player.vz*dt, HW + 0.001, WZ - HW - 0.001);
  if (boxHits(player.x, player.y, player.z)){ player.z = player.vz > 0 ? Math.floor(player.z + HW) - HW - 1e-4 : Math.floor(player.z - HW) + 1 + HW + 1e-4; player.vz = 0; }
  player.y += player.vy*dt;
  if (boxHits(player.x, player.y, player.z)){ if (player.vy < 0){ player.y = Math.floor(player.y) + 1; player.ground = true; } else player.y = Math.floor(player.y + PH) - PH - 1e-4; player.vy = 0; } else player.ground = false;
  if (player.y < 1){ player.y = 1; player.vy = 0; player.ground = true; }
}
export function syncCamera(){ camera.position.set(player.x, player.y + EYE, player.z); camera.rotation.set(player.pitch, player.yaw, 0); }
export const eyeV = new THREE.Vector3(), dirV = new THREE.Vector3();
export function aim(){ eyeV.set(player.x, player.y + EYE, player.z); const cp = Math.cos(player.pitch); dirV.set(-Math.sin(player.yaw)*cp, Math.sin(player.pitch), -Math.cos(player.yaw)*cp); }
/* DDA de Amanatides & Woo sobre la grilla. Devuelve el primer bloque sólido y, si la hay antes, la primera celda fantasma. */
export const cellKey = (x, y, z) => x + z*64 + y*4096;
export const cellMap = new Map();   // celdas de plantillas aún no completadas
export function raycastGrid(o, d, maxD){
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z), tdx = sx ? Math.abs(1/d.x) : Infinity, tdy = sy ? Math.abs(1/d.y) : Infinity, tdz = sz ? Math.abs(1/d.z) : Infinity;
  let tmx = sx > 0 ? (x+1-o.x)*tdx : sx < 0 ? (o.x-x)*tdx : Infinity, tmy = sy > 0 ? (y+1-o.y)*tdy : sy < 0 ? (o.y-y)*tdy : Infinity, tmz = sz > 0 ? (z+1-o.z)*tdz : sz < 0 ? (o.z-z)*tdz : Infinity;
  let t = 0, fx = 0, fy = 0, fz = 0, ghost = null;
  while (t <= maxD){
    const id = getB(x, y, z); if (id) return { hit:true, x, y, z, fx, fy, fz, t, id, ghost };
    if (!ghost && inWorld(x, y, z)){ const c = cellMap.get(cellKey(x, y, z)); if (c) ghost = { x, y, z, t, cell:c }; }
    if (tmx < tmy && tmx < tmz){ x += sx; t = tmx; tmx += tdx; fx = -sx; fy = 0; fz = 0; }
    else if (tmy < tmz){ y += sy; t = tmy; tmy += tdy; fx = 0; fy = -sy; fz = 0; }
    else { z += sz; t = tmz; tmz += tdz; fx = 0; fy = 0; fz = -sz; }
  }
  return { hit:false, ghost };
}

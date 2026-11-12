/* AVENTURA: ciclo de día y noche, cuatreros, corrales y tips */
import * as THREE from 'three';
import { DEBUG, GS, late } from './state.js';
import { $, fmtTime, hash2, pxTex } from './util.js';
import { B, WY } from './blocks.js';
import { bkey, getB, hmap, inWorld, PLAT_POS, placed, setB } from './world.js';
import { burst, chunkMat, clouds, scene, sky, spawnP, sunLight, TEX } from './render.js';
import { sndGood, sndMoo, sndPop, tone } from './audio.js';
import { writeSave } from './save.js';
import { boxHits, dirV, eyeV, HW, PH, player } from './player.js';
import { plats } from './platforms.js';
import { COW_DEFS, cows, raycaster, walkableY } from './cows.js';
import { silCanvas, state, toast } from './ui.js';

/* duración del ciclo: pensado para una partida corta */
const DAY = 95, NIGHT = 65, WARN = 30, MAX_ACTIVE = 3, MAX_PER_NIGHT = 2, STUN = 4;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

let started = false, phase = 'day', clock = 0, warned = false, nights = 0, trappedN = 0;
let troubleT = 0, tipT = 0, tipI = 0, uiT = 0, stunHintShown = false;
export const cuatreros = [];
export const corrals = [];

/* ---------------------------------------------------------------------
   Luz: el mismo mundo teñido según cuánta luz de día queda (0 = noche)
   --------------------------------------------------------------------- */
const hemi = scene.children.find(o => o.isHemisphereLight);
const skyMesh = sky.children[0], sunSprite = sky.children[1];
const cloudMat = clouds.children[0].children[0].material;
const COL = { fogDay:new THREE.Color(0xd4ecf7), fogNight:new THREE.Color(0x18224a), white:new THREE.Color(1, 1, 1), skyNight:new THREE.Color(0x1a2450), blockNight:new THREE.Color(0x7684c0), cloudNight:new THREE.Color(0x3a4474), moon:new THREE.Color(0xc8d8ff) };
const starMat = new THREE.PointsMaterial({ color:0xffffff, size:2.2, sizeAttenuation:false, transparent:true, opacity:0, fog:false, depthWrite:false });
(function buildStars(){ const n = 260, pos = new Float32Array(n*3); for (let i = 0; i < n; i++){ const a = hash2(i, 1, 501)*Math.PI*2, e = 0.12 + hash2(i, 2, 502)*1.35; pos[i*3] = Math.cos(a)*Math.cos(e)*280; pos[i*3+1] = Math.sin(e)*280; pos[i*3+2] = Math.sin(a)*Math.cos(e)*280; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const p = new THREE.Points(g, starMat); p.frustumCulled = false; sky.add(p); })();
let lastLight = -1;
function applyLight(d){
  if (Math.abs(d - lastLight) < 0.004) return; lastLight = d; GS.daylight = d;
  scene.fog.color.copy(COL.fogNight).lerp(COL.fogDay, d); scene.background.copy(scene.fog.color);
  skyMesh.material.color.copy(COL.skyNight).lerp(COL.white, d); chunkMat.color.copy(COL.blockNight).lerp(COL.white, d); cloudMat.color.copy(COL.cloudNight).lerp(COL.white, d);
  hemi.intensity = 1.3 + 1.0*d; sunLight.intensity = 0.55 + 1.15*d; sunSprite.material.color.copy(COL.moon).lerp(COL.white, d); starMat.opacity = 1 - d;
}

/* ---------------------------------------------------------------------
   Sonidos de la aventura
   --------------------------------------------------------------------- */
function sndWarn(){ tone('triangle', 440, 440, 0.14, 0.2); tone('triangle', 330, 330, 0.2, 0.2, 0.18); }
function sndNight(){ [[196, 0], [185, 0.26], [147, 0.52]].forEach(([f, d], i) => { tone('sawtooth', f, f*0.98, i === 2 ? 0.9 : 0.24, 0.14, d); tone('triangle', f/2, f/2, i === 2 ? 0.9 : 0.24, 0.22, d); }); }
function sndDawn(){ [392, 494, 587, 784].forEach((f, i) => tone('triangle', f, f, 0.22, 0.2, i*0.12)); }
function sndAlarm(){ for (let i = 0; i < 3; i++){ tone('square', 660, 660, 0.09, 0.12, i*0.22); tone('square', 520, 520, 0.09, 0.12, i*0.22 + 0.11); } }
function sndStun(){ tone('square', 900, 280, 0.28, 0.14); tone('sine', 1300, 500, 0.3, 0.1, 0.05); }
function sndPoof(){ tone('sine', 300, 60, 0.35, 0.3); tone('triangle', 800, 1600, 0.2, 0.12, 0.1); }

/* ---------------------------------------------------------------------
   Cuatrero: personaje original de cajas, con pañuelo de color distinto por oleada
   --------------------------------------------------------------------- */
const CU_COLORS = [[216, 64, 44], [47, 127, 216], [56, 168, 74], [154, 79, 208], [240, 154, 36]];
const flat = c => new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(c[0]/255, c[1]/255, c[2]/255, THREE.SRGBColorSpace) });
function box(parent, w, h, d, mat, x, y, z){ const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; }
function buildCuatrero(ci){
  const col = CU_COLORS[ci % CU_COLORS.length], dark = col.map(v => v*0.62), skin = [226, 172, 128], g = new THREE.Group();
  const poncho = new THREE.MeshLambertMaterial({ map: pxTex(12, 10, (x, y) => { if (y === 2 || y === 7) return [246, 236, 210]; if (y === 3 || y === 6) return dark; const k = 0.9 + hash2(x, y, 301)*0.16; return [col[0]*k, col[1]*k, col[2]*k]; }) });
  const face = new THREE.MeshLambertMaterial({ map: pxTex(8, 8, (x, y) => { if (y >= 5) return (y === 5 && x % 2) ? dark : col;        // pañuelo
    if (y === 2 && (x === 1 || x === 2 || x === 5 || x === 6)) return [52, 34, 24];                                                  // cejas
    if (y === 3 && (x === 1 || x === 6)) return [255, 255, 255]; if (y === 3 && (x === 2 || x === 5)) return [30, 20, 20]; return skin; }) });
  const skinM = flat(skin), hatM = flat([64, 44, 30]), pantsM = flat([54, 62, 96]), bootM = flat([40, 28, 22]), bandM = flat(col);
  const legs = [1, -1].map(s => { const l = new THREE.Group(); l.position.set(s*0.14, 0.64, 0); box(l, 0.22, 0.52, 0.24, pantsM, 0, -0.26, 0); box(l, 0.24, 0.14, 0.3, bootM, 0, -0.57, 0.02); g.add(l); return l; });
  box(g, 0.62, 0.62, 0.38, poncho, 0, 0.95, 0);
  const arms = [1, -1].map(s => { const a = new THREE.Group(); a.position.set(s*0.4, 1.22, 0); box(a, 0.17, 0.46, 0.2, poncho, 0, -0.23, 0); box(a, 0.15, 0.12, 0.17, skinM, 0, -0.52, 0); g.add(a); return a; });
  const head = new THREE.Group(); head.position.set(0, 1.27, 0); g.add(head);
  box(head, 0.42, 0.42, 0.42, [skinM, skinM, skinM, skinM, face, skinM], 0, 0.21, 0);
  box(head, 0.9, 0.06, 0.9, hatM, 0, 0.45, 0); box(head, 0.48, 0.22, 0.48, hatM, 0, 0.58, 0); box(head, 0.5, 0.07, 0.5, bandM, 0, 0.5, 0);
  return { g, legs, arms, head };
}

/* ---------------------------------------------------------------------
   Caminos sobre la grilla (BFS). Mismas reglas que las vacas: sube 1, baja 2, no trepa bloques puestos.
   --------------------------------------------------------------------- */
const stepY = (x, z, fy) => walkableY(x + 0.5, z + 0.5, fy);
function bfs(sx, sz, sgy, isGoal, limit = 1800){
  const par = new Map(), gyOf = new Map(), dist = new Map(), q = [[sx, sz]], k0 = sx + sz*64; par.set(k0, -1); gyOf.set(k0, sgy); dist.set(k0, 0);
  for (let h = 0; h < q.length && h < limit; h++){
    const [x, z] = q[h], k = x + z*64, gy = gyOf.get(k);
    if (isGoal && isGoal(x, z, gy)) return { par, gyOf, dist, q, goal:k };
    for (const [dx, dz] of DIRS){ const nx = x + dx, nz = z + dz, nk = nx + nz*64; if (par.has(nk)) continue; const g = stepY(nx, nz, gy); if (g == null) continue; par.set(nk, k); gyOf.set(nk, g); dist.set(nk, dist.get(k) + 1); q.push([nx, nz]); }
  }
  return { par, gyOf, dist, q, goal:null };
}
function pathFrom(res){ const p = []; let k = res.goal; while (k != null && k !== -1){ p.push([k % 64, Math.floor(k/64)]); k = res.par.get(k); } p.reverse(); p.shift(); return p; }
const cowName = c => c.p.V.name;
const freeCows = () => cows.filter(c => !c.held);
const awake = () => phase === 'night';

function spawnCuatrero(cow){
  const far = (x, z) => Math.hypot(x - player.x, z - player.z) > 9;
  const res = bfs(Math.floor(cow.x), Math.floor(cow.z), cow.gy, null, 2600); let cand = res.q.filter(([x, z]) => { const d = res.dist.get(x + z*64); return d >= 13 && d <= 24 && far(x, z); });
  if (!cand.length && res.q.length >= 150) cand = res.q.slice(Math.floor(res.q.length*0.6)).filter(([x, z]) => far(x, z));
  if (!cand.length){   // la vaca está cercada: aparece igual, lejos, aunque no pueda llegar a ella
    for (let i = 0; i < 400 && cand.length < 12; i++){ const x = 3 + Math.floor(Math.random()*58), z = 3 + Math.floor(Math.random()*58), d = Math.hypot(x - cow.x, z - cow.z), h = hmap[x + z*64];
      if (d >= 13 && d <= 26 && far(x, z) && !nearPlatform(x, z, 2) && stepY(x, z, h) === h && !res.gyOf.has(x + z*64)){ res.gyOf.set(x + z*64, h); cand.push([x, z]); } } }
  if (!cand.length) return null;
  const [x, z] = cand[Math.floor(Math.random()*cand.length)], m = buildCuatrero(nights - 1 + cuatreros.length);
  const u = { g:m.g, legs:m.legs, arms:m.arms, head:m.head, x:x + 0.5, z:z + 0.5, gy:res.gyOf.get(x + z*64), y:0, rot:0, state:'seek', t:0, rp:0, chk:0.3, lost:0, stun:0, path:[], cow:null, target:null, site:null, phase:Math.random()*6, zz:0 };
  u.y = u.gy; m.g.userData.cuatrero = u; scene.add(m.g); cuatreros.push(u); burst(TEX.spark, u.x, u.y + 1, u.z, 14, 2.5, 0xffd27a, 0.25, 3, 0.7); return u;
}
function removeCuatrero(u){ scene.remove(u.g); const i = cuatreros.indexOf(u); if (i >= 0) cuatreros.splice(i, 1); }

/* ---------------------------------------------------------------------
   Corrales y rescate
   --------------------------------------------------------------------- */
const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 60, 8, 1, true);
function nearPlatform(x, z, m){ return PLAT_POS.some(([px, pz]) => x >= px - m && x < px + 4 + m && z >= pz - m && z < pz + 5 + m); }
function choosePen(u){
  const cx = Math.floor(u.x), cz = Math.floor(u.z), res = bfs(cx, cz, u.gy, null, 1500);
  const ok = (x, z, gy, strict) => { if (x < 4 || x > 59 || z < 4 || z > 59 || nearPlatform(x, z, 3)) return false; if (corrals.some(c => Math.hypot(c.cx - x, c.cz - z) < 8)) return false; if (Math.abs(player.x - x - 0.5) < 3.4 && Math.abs(player.z - z - 0.5) < 3.4) return false;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++){ const g = stepY(x + dx, z + dz, gy); if (g == null || (strict && g !== gy)) return false; } return true; };
  for (const strict of [true, false]){ const cand = res.q.filter(([x, z]) => { const d = res.dist.get(x + z*64); return d >= 7 && d <= 18 && ok(x, z, res.gyOf.get(x + z*64), strict); }); if (cand.length) return cand[Math.floor(Math.random()*cand.length)]; }
  return [cx, cz];
}
function buildCorral(u){
  const cow = u.cow, cx = Math.floor(u.x), cz = Math.floor(u.z), gy = u.gy, cells = [];
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++){ if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2) continue; const x = cx + dx, z = cz + dz, g = stepY(x, z, gy) ?? gy;
    if (!inWorld(x, g, z) || g >= WY || getB(x, g, z) !== 0) continue;
    if (player.x - HW < x + 1 && player.x + HW > x && player.y < g + 1 && player.y + PH > g && player.z - HW < z + 1 && player.z + HW > z) continue;   // nunca sobre el jugador
    setB(x, g, z, B.WOOD); placed.add(bkey(x, g, z)); cells.push({ x, y:g, z }); }
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color:0xff4a3a, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false })); beam.position.set(cx + 0.5, gy + 31.5, cz + 0.5); scene.add(beam);
  const corral = { cells, cow, cx, cz, beam }; corrals.push(corral);
  cow.x = cx + 0.5; cow.z = cz + 0.5; cow.gy = gy; cow.holder = null; cow.corral = corral; u.cow = null; u.site = null; u.path = [];
  // el cuatrero sale de su propio corral
  for (const [dx, dz] of DIRS.concat([[1, 1], [-1, -1], [1, -1], [-1, 1]])){ const g = stepY(cx + dx*3, cz + dz*3, gy); if (g != null){ u.x = cx + dx*3 + 0.5; u.z = cz + dz*3 + 0.5; u.gy = g; u.y = g; break; } }
  sndPop(); burst(TEX.sq, cx + 0.5, gy + 0.6, cz + 0.5, 20, 3, 0xc8935a, 0.18, 9, 0.7);
  toast('El cuatrero encerró a tu ' + cowName(cow) + '. Sigue el haz rojo y rompe el corral.'); u.state = awake() ? 'seek' : 'sleep';
}
function dropCorral(c){ scene.remove(c.beam); c.beam.material.dispose(); const i = corrals.indexOf(c); if (i >= 0) corrals.splice(i, 1); }
function freeCow(cow, quiet){
  const p = cow.p; if (cow.corral) dropCorral(cow.corral); if (cow.holder){ cow.holder.cow = null; }
  burst(TEX.spark, cow.x, cow.y + 0.8, cow.z, 14, 3, 0xfff2a0, 0.28, 4, 0.8);
  cow.held = false; cow.holder = null; cow.corral = null; cow.x = p.center.x; cow.z = p.center.z; cow.gy = p.H; cow.y = p.H; cow.rot = Math.PI; cow.state = 'idle'; cow.t = 1.5; cow.bounce = 1;
  burst(TEX.spark, cow.x, cow.y + 0.8, cow.z, 18, 3, 0x9dff8a, 0.28, 4, 0.9);
  if (!quiet){ sndMoo(COW_DEFS[cow.vi].pitch); sndGood(); for (let i = 0; i < 6; i++) spawnP(TEX.heart, cow.x + (Math.random() - 0.5), cow.y + 1.6, cow.z + (Math.random() - 0.5), 0, 1.2, 0, 1.3, 0.34, 0xff5a7a); toast('¡Liberaste a tu ' + cowName(cow) + '! Volvió a su plataforma.'); }
  refreshCounter(); if (!quiet) tryWin();
}

/* ---------------------------------------------------------------------
   Comportamiento del cuatrero
   --------------------------------------------------------------------- */
/* encerrado: no tiene salida a su mismo nivel o hacia abajo, y al menos un lado lo cierra un bloque puesto (o está totalmente tapiado) */
function isTrapped(u){ const cx = Math.floor(u.x), cz = Math.floor(u.z); let hard = 0, byBlock = false;
  for (const [dx, dz] of DIRS){ const g = stepY(cx + dx, cz + dz, u.gy); if (g != null && g <= u.gy) return false; if (g == null) hard++; if (placed.has(bkey(cx + dx, u.gy, cz + dz))) byBlock = true; }
  return hard === 4 || byBlock; }
function popCuatrero(u){
  const cx = Math.floor(u.x), cz = Math.floor(u.z);
  for (const [dx, dz] of DIRS) for (let dy = 0; dy <= 1; dy++){ const x = cx + dx, y = u.gy + dy, z = cz + dz; if (placed.has(bkey(x, y, z)) && getB(x, y, z) !== 0){ setB(x, y, z, 0); placed.delete(bkey(x, y, z)); burst(TEX.sq, x + 0.5, y + 0.5, z + 0.5, 6, 2.4, 0xc8935a, 0.16, 10, 0.6); } }
  burst(TEX.spark, u.x, u.y + 1, u.z, 30, 4, () => [0xffffff, 0xffd27a, 0xff8a6a][Math.floor(Math.random()*3)], 0.3, 5, 1); sndPoof(); sndGood();
  const cow = u.cow; removeCuatrero(u); trappedN++; if (cow) freeCow(cow); toast('¡Atrapaste al cuatrero! Se rindió y se fue.'); refreshCounter(); tryWin();
}
function follow(u, speed, dt){
  if (!u.path.length) return false; const [tx, tz] = u.path[0], dx = tx + 0.5 - u.x, dz = tz + 0.5 - u.z, d = Math.hypot(dx, dz);
  if (d < 0.1){ u.path.shift(); return true; }
  if (Math.floor(u.x) !== tx || Math.floor(u.z) !== tz){ if (stepY(tx, tz, u.gy) == null){ u.path = []; u.rp = 0; return false; } }   // el camino cambió
  const st = Math.min(d, speed*dt); u.x += dx/d*st; u.z += dz/d*st; const g = walkableY(u.x, u.z, u.gy); if (g != null) u.gy = g;
  let dr = Math.atan2(dx, dz) - u.rot; while (dr > Math.PI) dr -= Math.PI*2; while (dr < -Math.PI) dr += Math.PI*2; u.rot += Math.max(-7*dt, Math.min(7*dt, dr)); u.phase += dt*speed*5.5; u.moving = true; return true;
}
function wanderStep(u){ const cx = Math.floor(u.x), cz = Math.floor(u.z), opts = DIRS.filter(([dx, dz]) => { const g = stepY(cx + dx, cz + dz, u.gy); return g != null && stepY(cx, cz, g) != null; }); if (opts.length){ const [dx, dz] = opts[Math.floor(Math.random()*opts.length)]; u.path = [[cx + dx, cz + dz]]; } }
function updateCuatrero(u, dt){
  u.moving = false;
  // suelo: si le cambian el terreno se reacomoda
  const bx = Math.floor(u.x), bz = Math.floor(u.z);
  if (getB(bx, u.gy, bz) !== 0){ let y = u.gy; while (y < WY - 1 && getB(bx, y, bz) !== 0) y++; u.gy = y; } else if (getB(bx, u.gy - 1, bz) === 0){ let y = u.gy; while (y > 1 && getB(bx, y - 1, bz) === 0) y--; u.gy = y; }
  if (u.state === 'trapped'){ u.t -= dt; if (u.t <= 0){ popCuatrero(u); return; } }
  else {
    u.chk -= dt; if (u.chk <= 0){ u.chk = 0.3; if (isTrapped(u)){ u.state = 'trapped'; u.t = 1.6; u.path = []; sndStun(); toast('¡El cuatrero quedó encerrado!'); } }
    if (u.state !== 'trapped' && u.stun > 0){ u.stun -= dt; if (Math.random() < dt*6) spawnP(TEX.spark, u.x + (Math.random() - 0.5)*0.7, u.y + 2 + Math.random()*0.2, u.z + (Math.random() - 0.5)*0.7, 0, 0.3, 0, 0.5, 0.2, 0xffe36a); }
    else if (u.state === 'sleep'){ if (awake()) u.state = 'seek'; u.zz -= dt; if (u.zz <= 0){ u.zz = 1.1; spawnP(TEX.sq, u.x + 0.2, u.y + 2, u.z, 0.15, 0.5, 0, 1.4, 0.16, 0xbfd4ff); } }
    else if (u.state === 'seek' || u.state === 'guard'){
      if (!awake()){ u.state = 'sleep'; u.path = []; }
      else {
        if (!u.target || u.target.held) u.target = null;
        u.rp -= dt;
        if (u.rp <= 0){ u.rp = 0.8;
          if (!u.target){ const taken = cuatreros.filter(o => o !== u && o.target).map(o => o.target), fc = freeCows(), pool = fc.filter(c => !taken.includes(c)); const list = pool.length ? pool : fc; u.target = list.sort((a, b) => Math.hypot(a.x - u.x, a.z - u.z) - Math.hypot(b.x - u.x, b.z - u.z))[0] || null; }
          if (u.target){ const c = u.target, gx = Math.floor(c.x), gz = Math.floor(c.z), res = bfs(Math.floor(u.x), Math.floor(u.z), u.gy, (x, z) => Math.abs(x - gx) <= 1 && Math.abs(z - gz) <= 1);
            if (res.goal != null){ u.path = pathFrom(res); u.lost = 0; u.state = 'seek'; } else { u.lost++; u.target = null; u.state = 'guard'; wanderStep(u); if (!u.told){ u.told = true; toast('El cuatrero no encuentra cómo llegar a tus vacas. ¡Bien protegidas!'); } } }
          else { u.state = 'guard'; if (Math.random() < 0.5) wanderStep(u); }
        }
        follow(u, u.state === 'seek' ? 1.75 : 0.9, dt);
        const c = u.target; if (c && !c.held && Math.hypot(c.x - u.x, c.z - u.z) < 1.35 && Math.abs(c.gy - u.gy) <= 2){ c.held = true; c.holder = u; u.cow = c; u.target = null; u.state = 'tie'; u.t = 2.5; u.path = []; sndAlarm(); toast('¡Un cuatrero atrapó a tu ' + cowName(c) + '! Enciérralo antes de que se la lleve.'); refreshCounter(); }
      }
    }
    else if (u.state === 'tie'){ u.t -= dt; const c = u.cow; if (!c){ u.state = 'seek'; } else { u.rot = Math.atan2(c.x - u.x, c.z - u.z); if (u.t <= 0){ u.site = choosePen(u); u.state = 'carry'; u.rp = 0; u.lost = 0; u.idle = 0; } } }
    else if (u.state === 'carry'){
      const c = u.cow; if (!c){ u.state = awake() ? 'seek' : 'sleep'; }
      else {
        const [sx, sz] = u.site; u.rp -= dt;
        if (u.rp <= 0){ u.rp = 0.8; const res = bfs(Math.floor(u.x), Math.floor(u.z), u.gy, (x, z) => x === sx && z === sz); if (res.goal != null){ u.path = pathFrom(res); u.lost = 0; } else if (++u.lost >= 3){ u.site = [Math.floor(u.x), Math.floor(u.z)]; u.path = [u.site.slice()]; } }
        follow(u, 1.35, dt);
        u.idle = u.moving ? 0 : (u.idle || 0) + dt;   // sin avanzar varios segundos: arma el corral ahí mismo
        if (u.idle > 5 && !(u.stun > 0)){ u.idle = 0; u.site = [Math.floor(u.x), Math.floor(u.z)]; u.x = u.site[0] + 0.5; u.z = u.site[1] + 0.5; }
        // la vaca lo sigue amarrada
        const fx = Math.sin(u.rot), fz = Math.cos(u.rot), k = Math.min(1, dt*6); c.x += (u.x - fx*1.15 - c.x)*k; c.z += (u.z - fz*1.15 - c.z)*k; c.gy = u.gy; c.rot = u.rot;
        if (Math.floor(u.x) === u.site[0] && Math.floor(u.z) === u.site[1] && Math.hypot(u.site[0] + 0.5 - u.x, u.site[1] + 0.5 - u.z) < 0.2) buildCorral(u);
      }
    }
  }
  // animación
  u.y += (u.gy - u.y)*Math.min(1, dt*10);
  const sw = u.moving ? Math.sin(u.phase)*0.7 : 0, lerp = Math.min(1, dt*14);
  u.legs[0].rotation.x += (sw - u.legs[0].rotation.x)*lerp; u.legs[1].rotation.x = -u.legs[0].rotation.x;
  const up = u.state === 'tie' || u.state === 'trapped' ? -2.6 : (u.state === 'carry' ? -0.9 : -sw*0.8);
  u.arms[0].rotation.x += (up - u.arms[0].rotation.x)*lerp; u.arms[1].rotation.x += ((u.state === 'tie' || u.state === 'trapped' ? -2.6 : sw*0.8) - u.arms[1].rotation.x)*lerp;
  u.head.rotation.x += ((u.state === 'sleep' ? 0.55 : 0) - u.head.rotation.x)*Math.min(1, dt*4); u.head.rotation.y = u.stun > 0 ? Math.sin(GS.playTime*14)*0.5 : 0;
  u.g.rotation.z = u.state === 'trapped' ? Math.sin(GS.playTime*32)*0.09 : (u.stun > 0 ? Math.sin(GS.playTime*9)*0.12 : 0);
  u.g.position.set(u.x, u.y, u.z); u.g.rotation.y = u.rot;
}
/* el jugador no atraviesa vacas ni cuatreros: si se superponen, lo empuja hacia afuera (sin meterlo en un bloque) */
export function collideCharacters(){
  const push = (cx, cz, cy, r, h) => { if (player.y >= cy + h || player.y + PH <= cy) return; const dx = player.x - cx, dz = player.z - cz, d = Math.hypot(dx, dz), min = r + HW; if (d >= min) return;
    const nx = Math.max(HW, Math.min(64 - HW, d > 0.001 ? cx + dx/d*min : cx + min)), nz = Math.max(HW, Math.min(64 - HW, d > 0.001 ? cz + dz/d*min : cz));
    if (!boxHits(nx, player.y, player.z)) player.x = nx; if (!boxHits(player.x, player.y, nz)) player.z = nz; };
  for (const c of cows){ const D = COW_DEFS[c.vi]; push(c.x, c.z, c.y, 0.55, D.legH + D.body[1]); }
  for (const u of cuatreros) push(u.x, u.z, u.y, 0.32, 1.85);
}
/* click (o Romper) sobre un cuatrero: queda mareado unos segundos */
export function hitCuatrero(maxT){
  if (!cuatreros.length) return false; raycaster.set(eyeV, dirV); raycaster.near = 0; raycaster.far = maxT;
  const hits = raycaster.intersectObjects(cuatreros.map(u => u.g), true); if (!hits.length) return false;
  let o = hits[0].object; while (o && !o.userData.cuatrero) o = o.parent; if (!o) return false; const u = o.userData.cuatrero;
  if (u.state !== 'trapped'){ u.stun = STUN; sndStun(); if (!stunHintShown){ stunHintShown = true; toast('¡Lo mareaste! Rodéalo con 4 bloques antes de que se le pase.'); } }
  return true;
}

/* ---------------------------------------------------------------------
   Ciclo de día y noche
   --------------------------------------------------------------------- */
function startNight(){
  phase = 'night'; clock = 0; nights++; sndNight();
  const fc = freeCows(), n = Math.min(fc.length, MAX_PER_NIGHT, MAX_ACTIVE - cuatreros.length); let made = 0;
  for (let i = 0; i < n; i++) if (spawnCuatrero(fc[i])) made++;
  cuatreros.forEach(u => { if (u.state === 'sleep') u.state = 'seek'; });
  toast(cuatreros.length ? (made > 1 ? '¡Es de noche! Llegaron ' + made + ' cuatreros.' : made === 1 ? '¡Es de noche! Llegó un cuatrero.' : '¡Es de noche! Los cuatreros despertaron.') : 'Noche tranquila: no hay vacas que robar.');
}
function startDay(){ phase = 'day'; clock = 0; warned = false; sndDawn(); toast(cuatreros.length ? '¡Amaneció! Los cuatreros duermen: es el momento de encerrarlos.' : '¡Amaneció!'); }
function clearAdventure(){ cuatreros.slice().forEach(u => { burst(TEX.spark, u.x, u.y + 1, u.z, 12, 3, 0xffffff, 0.25, 4, 0.7); removeCuatrero(u); }); cows.forEach(c => { if (c.held) freeCow(c, true); }); corrals.slice().forEach(dropCorral); started = false; phase = 'day'; clock = 0; warned = false; troubleT = 0; $('tip').classList.add('hidden'); refreshCounter(); }
export function isTense(){ return GS.mode === 'aventura' && !GS.prizeUnlocked && phase === 'night' && cuatreros.length > 0; }
/* se gana con las 3 vacas armadas y ninguna robada */
export function tryWin(){
  if (GS.prizeUnlocked || !plats.every(p => p.done) || plats.some(p => p.anim)) return;
  if (cows.some(c => c.held)){ toast('¡Ya armaste las 3! Rescata a tus vacas robadas para ganar.'); return; }
  GS.prizeUnlocked = true; GS.totalTime = GS.playTime; $('btnPrizePause').classList.remove('hidden'); clearAdventure(); writeSave(); GS.winAt = GS.playTime + 1.8;
}
export function setMode(m){ if (m !== GS.mode){ GS.mode = m; if (m === 'libre') clearAdventure(); writeSave(); } refreshModeUI(); }
export function refreshModeUI(){ $('btnMode').textContent = 'Modo: ' + (GS.mode === 'aventura' ? 'aventura' : 'libre'); if (GS.mode !== 'aventura') $('dial').classList.add('hidden'); }
$('btnMode').onclick = () => setMode(GS.mode === 'aventura' ? 'libre' : 'aventura');
function refreshCounter(){ cows.forEach(c => { silCanvas[c.vi].style.outline = c.held ? '3px solid #e2352a' : ''; }); }
const TIPS = {
  corral: () => 'Tip: sigue el haz rojo y rompe cualquier bloque del corral de madera para liberar a tu vaca.',
  stun: () => 'Tip: ' + (GS.touch ? 'apunta al cuatrero y toca Romper' : 'haz click sobre el cuatrero') + ' para marearlo, y rodéalo con 4 bloques.',
  day: () => 'Tip: de día los cuatreros duermen. Es el mejor momento para rodearlos con bloques.',
  fence: () => 'Tip: una cerca de bloques alrededor de tus vacas las protege; los cuatreros no pueden saltarla.',
};
export function updateAdventure(dt){
  const on = GS.mode === 'aventura' && !GS.prizeUnlocked;
  if (!on){ applyLight(Math.min(1, GS.daylight + dt*0.5)); return; }
  if (!started && cows.length){ started = true; phase = 'day'; clock = 0; warned = false; toast('¡Tu primera vaca! Cuidado: de noche salen los cuatreros.'); }
  let d = 1, rem = 0;
  if (started){
    clock += dt;
    if (phase === 'day'){ rem = DAY - clock; if (rem <= WARN && !warned){ warned = true; sndWarn(); toast('¡Se hace de noche en ' + WARN + ' segundos! Vienen los cuatreros.'); } if (rem <= 0){ startNight(); rem = NIGHT; } }
    else { rem = NIGHT - clock; if (rem <= 0){ startDay(); rem = DAY; } }
    d = phase === 'day' ? Math.max(0, Math.min(1, rem/12)) : Math.max(0, Math.min(1, 1 - rem/8));
  }
  applyLight(d);
  for (const u of cuatreros.slice()) updateCuatrero(u, dt);
  for (const c of corrals.slice()) if (!c.cells.length || c.cells.some(b => getB(b.x, b.y, b.z) === 0)) freeCow(c.cow);
  // HUD: reloj y tips
  uiT -= dt;
  if (uiT <= 0){ uiT = 0.25; const dial = $('dial'); dial.classList.remove('hidden'); dial.classList.toggle('night', phase === 'night' && started); dial.classList.toggle('warn', started && phase === 'day' && rem <= WARN);
    dial.textContent = !started ? '☀️ Arma tu primera vaca' : (phase === 'day' ? '☀️ Noche en ' + fmtTime(rem) : '🌙 Amanece en ' + fmtTime(rem)) + (cuatreros.length ? ' · 🤠 ' + cuatreros.length : ''); }
  const robbed = cows.some(c => c.held), trouble = robbed || cuatreros.length > 0;
  if (!trouble){ if (troubleT > 0){ troubleT = 0; $('tip').classList.add('hidden'); } }
  else { troubleT += dt; if (troubleT >= 60){ tipT -= dt; if (tipT <= 0){ tipT = 10; const keys = []; if (corrals.length) keys.push('corral'); if (cuatreros.length){ keys.push('stun'); if (phase === 'day') keys.push('day'); } keys.push('fence'); const el = $('tip'); el.textContent = TIPS[keys[tipI++ % keys.length]](); el.classList.remove('hidden'); } } }
}

/* panel de debug */
export function advFlags(){ return { modo:GS.mode, iniciado:started, fase:phase, reloj:clock, faltan:started ? (phase === 'day' ? DAY : NIGHT) - clock : null, noches:nights, luz:GS.daylight, cuatreros:cuatreros.map(u => ({ estado:u.state, mareado:u.stun > 0, x:+u.x.toFixed(1), z:+u.z.toFixed(1), y:u.gy, llevaVaca:u.cow ? cowName(u.cow) : null, objetivo:u.target ? cowName(u.target) : null })), vacasRobadas:cows.filter(c => c.held).map(cowName), corrales:corrals.length, atrapados:trappedN, problemaHace:troubleT }; }
export function advDebug(){ const f = advFlags(); let h = 'modo: <b>' + f.modo + '</b>'; if (f.modo !== 'aventura') return h + '\n';
  h += '   fase: <b>' + (f.iniciado ? f.fase : 'sin iniciar') + '</b>' + (f.faltan != null ? ' (cambia en ' + fmtTime(f.faltan) + ')' : '') + '   noches: ' + f.noches + '   (L = anochecer, J = amanecer)\n';
  h += 'cuatreros: <b>' + f.cuatreros.length + '</b>' + f.cuatreros.map(u => ' [' + u.estado + (u.mareado ? '*' : '') + (u.llevaVaca ? ' con ' + u.llevaVaca.replace('Vaca ', '') : '') + ' @' + u.x + ',' + u.z + ']').join('') + '   atrapados: ' + f.atrapados + '\n';
  h += 'vacas robadas: ' + (f.vacasRobadas.length ? '<span class="warn">' + f.vacasRobadas.join(', ') + '</span>' : '<span class="off">ninguna</span>') + '   corrales: ' + f.corrales + '   tips en: ' + (f.problemaHace > 0 ? Math.max(0, 60 - f.problemaHace).toFixed(0) + ' s' : '—') + '\n';
  return h; }
if (DEBUG) document.addEventListener('keydown', e => { if (state !== 'play' || GS.mode !== 'aventura') return;
  if (e.code === 'KeyL'){ if (!started && cows.length) started = true; if (started){ phase = 'day'; clock = DAY - 2; warned = true; } }
  if (e.code === 'KeyJ' && started && phase === 'night') clock = NIGHT - 1; });

late('tryWin', () => tryWin);
late('setMode', () => setMode);
late('hitCuatrero', () => hitCuatrero);
late('advFlags', () => advFlags);
late('advDebug', () => advDebug);

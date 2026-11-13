/* AVENTURA: ciclo de día y noche, cuatreros, corrales y tips */
import { track } from './analytics.js';
import * as THREE from 'three';
import { DEBUG, GS, LATE, late } from './state.js';
import { $, fmtTime, hash2, pxTex } from './util.js';
import { B, WY } from './blocks.js';
import { bkey, foreign, getB, hmap, inWorld, isProtected, KEYROOM, PLAT_POS, placed, RETURN, setB, topY } from './world.js';
import { burst, chunkMat, clouds, scene, sky, spawnP, sunLight, TEX } from './render.js';
import { sndCrunch, sndGood, sndMoo, sndPop, tone } from './audio.js';
import { resetSave, writeSave } from './save.js';
import { boxHits, cellMap, dirV, eyeV, HW, PH, player } from './player.js';
import { plats, refreshLock, setTemplate } from './platforms.js';
import { HOTBAR } from './actions.js';
import { COW_DEFS, cows, raycaster, walkableY } from './cows.js';
import { lock, silCanvas, state, toast } from './ui.js';

/* duración del ciclo: pensado para una partida corta */
const WARN = 30;
/* dificultades del modo aventura */
export const DIFFS = {
  facil:      { label:'fácil',      day:95, night:65, perNight:(n, free) => Math.min(free, 2), maxActive:3, stun:4, stunCd:0, limited:false, breakers:false, big:false, aids:true,  moveCorral:false },
  dificil:    { label:'difícil',    day:70, night:90, perNight:(n, free) => free ? Math.min(n, 4) : 0, maxActive:6, stun:2, stunCd:6, limited:true, breakers:true, big:false, aids:true,  moveCorral:false, recover:30 },
  legendario: { label:'legendario', day:60, night:95, perNight:(n, free) => free ? Math.min(n + 1, 5) : 0, maxActive:7, stun:2, stunCd:7, limited:true, breakers:true, big:true,  aids:false, moveCorral:true, recover:20, dig:true, earnFur:true },
};
const CFG = () => (GS.mode === 'aventura' && DIFFS[GS.diff]) || DIFFS.facil;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

let started = false, phase = 'day', clock = 0, warned = false, nights = 0, trappedN = 0;
let digTold = false, royalGiven = false, crewT = 0, crewSpawnT = 0, pushTold = false, lockTold = false, troubleT = 0, tipT = 0, tipI = 0, uiT = 0, stunHintShown = false;
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
export function setSkyTheme(w){ if (w === 2){ COL.fogDay.set(0xf0d2b4); COL.white.setRGB(1, 0.89, 0.78); } else { COL.fogDay.set(0xd4ecf7); COL.white.setRGB(1, 1, 1); } lastLight = -1; }
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
function buildCuatrero(ci, breaker){
  const col = breaker ? [44, 42, 52] : CU_COLORS[ci % CU_COLORS.length], dark = col.map(v => v*0.62), skin = [226, 172, 128], g = new THREE.Group();
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
/* como stepY, pero haciendo como si los bloques puestos no existieran (para el cuatrero que rompe cercas) */
const gB = (x, y, z) => (placed.has(bkey(x, y, z)) && !cellMap.has(bkey(x, y, z))) ? 0 : getB(x, y, z);   // los bloques de un holograma no se tocan
function stepRelax(x, z, fy){ if (x < 1 || x >= 63 || z < 1 || z >= 63) return null; for (const gy of [fy + 1, fy, fy - 1, fy - 2]){ if (gy < 1 || gB(x, gy - 1, z) === 0) continue; let clear = true; for (let y = gy; y <= Math.max(gy, fy) + 1; y++) if (gB(x, y, z) !== 0){ clear = false; break; } if (clear) return gy; } return null; }
function bfs(sx, sz, sgy, isGoal, limit = 1800, relax = false){ const step = relax ? stepRelax : stepY;
  const par = new Map(), gyOf = new Map(), dist = new Map(), q = [[sx, sz]], k0 = sx + sz*64; par.set(k0, -1); gyOf.set(k0, sgy); dist.set(k0, 0);
  for (let h = 0; h < q.length && h < limit; h++){
    const [x, z] = q[h], k = x + z*64, gy = gyOf.get(k);
    if (isGoal && isGoal(x, z, gy)) return { par, gyOf, dist, q, goal:k };
    for (const [dx, dz] of DIRS){ const nx = x + dx, nz = z + dz, nk = nx + nz*64; if (par.has(nk)) continue; const g = step(nx, nz, gy); if (g == null) continue; par.set(nk, k); gyOf.set(nk, g); dist.set(nk, dist.get(k) + 1); q.push([nx, nz]); }
  }
  return { par, gyOf, dist, q, goal:null };
}
function pathFrom(res){ const p = []; let k = res.goal; while (k != null && k !== -1){ p.push([k % 64, Math.floor(k/64)]); k = res.par.get(k); } p.reverse(); p.shift(); return p; }
const cowName = c => c.p.V.name;
const freeCows = () => cows.filter(c => !c.held && c.w === 1);
const awake = () => phase === 'night' || GS.world === 2;   // en el Reino de Piedra no duermen
const here = () => cuatreros.filter(u => u.w === GS.world);

function spawnCuatrero(cow, breaker){
  const far = (x, z) => Math.hypot(x - player.x, z - player.z) > 9;
  const res = bfs(Math.floor(cow.x), Math.floor(cow.z), cow.gy, null, 2600); let cand = res.q.filter(([x, z]) => { const d = res.dist.get(x + z*64); return d >= 13 && d <= 24 && far(x, z); });
  if (!cand.length && res.q.length >= 150) cand = res.q.slice(Math.floor(res.q.length*0.6)).filter(([x, z]) => far(x, z));
  if (!cand.length){   // la vaca está cercada: aparece igual, lejos, aunque no pueda llegar a ella
    for (let i = 0; i < 400 && cand.length < 12; i++){ const x = 3 + Math.floor(Math.random()*58), z = 3 + Math.floor(Math.random()*58), d = Math.hypot(x - cow.x, z - cow.z), h = hmap[x + z*64];
      if (d >= 13 && d <= 26 && far(x, z) && !nearPlatform(x, z, 2) && stepY(x, z, h) === h && !res.gyOf.has(x + z*64)){ res.gyOf.set(x + z*64, h); cand.push([x, z]); } } }
  if (!cand.length) return null;
  const [x, z] = cand[Math.floor(Math.random()*cand.length)]; return makeCuatrero(x, z, res.gyOf.get(x + z*64), breaker);
}
function makeCuatrero(x, z, gy, breaker){
  const m = buildCuatrero(nights + cuatreros.length, breaker);
  const u = { w:GS.world, role:null, pushCd:0, g:m.g, legs:m.legs, arms:m.arms, head:m.head, x:x + 0.5, z:z + 0.5, gy, y:0, rot:0, state:'seek', breaker:!!breaker, brk:null, stunCd:0, t:0, rp:0, chk:0.3, lost:0, stun:0, path:[], cow:null, target:null, site:null, phase:Math.random()*6, zz:0 };
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
function makeCorral(cow, cx, cz, gy, high){
  const cols = [];
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++){ if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2) continue; const x = cx + dx, z = cz + dz, g = stepY(x, z, gy) ?? gy, ys = [];
    for (let k = 0; k < (high ? 2 : 1); k++){ const y = g + k; if (!inWorld(x, y, z) || y >= WY || getB(x, y, z) !== 0) continue;
      if (player.x - HW < x + 1 && player.x + HW > x && player.y < y + 1 && player.y + PH > y && player.z - HW < z + 1 && player.z + HW > z) continue;   // nunca sobre el jugador
      setB(x, y, z, B.WOOD); placed.add(bkey(x, y, z)); foreign.add(bkey(x, y, z)); ys.push(y); }
    if (ys.length) cols.push({ x, z, ys }); }
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color:0xff4a3a, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false })); beam.position.set(cx + 0.5, gy + 31.5, cz + 0.5); beam.visible = CFG().aids; scene.add(beam);
  const corral = { cols, cow, cx, cz, gy, beam }; corrals.push(corral);
  cow.held = true; cow.x = cx + 0.5; cow.z = cz + 0.5; cow.gy = gy; cow.holder = null; cow.corral = corral;
  sndPop(); burst(TEX.sq, cx + 0.5, gy + 0.6, cz + 0.5, 20, 3, 0xc8935a, 0.18, 9, 0.7); return corral;
}
function buildCorral(u){
  const cow = u.cow, cx = Math.floor(u.x), cz = Math.floor(u.z), gy = u.gy; makeCorral(cow, cx, cz, gy, false); u.cow = null; u.site = null; u.path = [];
  // el cuatrero sale de su propio corral
  for (const [dx, dz] of DIRS.concat([[1, 1], [-1, -1], [1, -1], [-1, 1]])){ const g = stepY(cx + dx*3, cz + dz*3, gy); if (g != null){ u.x = cx + dx*3 + 0.5; u.z = cz + dz*3 + 0.5; u.gy = g; u.y = g; break; } }
  toast(CFG().aids ? 'El cuatrero encerró a tu ' + cowName(cow) + '. Sigue el haz rojo y rompe el corral.' : 'El cuatrero encerró a tu ' + cowName(cow) + ' en un corral. ¡Búscala!'); u.state = awake() ? 'seek' : 'sleep';
}
/* legendario: cada noche, las vacas que sigan encerradas pasan a un corral más lejano y de doble altura */
function relocateCorral(c){
  const cow = c.cow, P = cow.p.center;
  for (let i = 0; i < 400; i++){ const x = 5 + Math.floor(Math.random()*54), z = 5 + Math.floor(Math.random()*54), h = hmap[x + z*64];
    if (Math.hypot(x - P.x, z - P.z) < 18 || nearPlatform(x, z, 3) || corrals.some(o => o !== c && Math.hypot(o.cx - x, o.cz - z) < 8) || Math.hypot(x - player.x, z - player.z) < 6) continue;
    let flat = true; for (let dx = -2; dx <= 2 && flat; dx++) for (let dz = -2; dz <= 2; dz++) if (stepY(x + dx, z + dz, h) !== h){ flat = false; break; } if (!flat) continue;
    c.cols.forEach(col => col.ys.forEach(y => { if (getB(col.x, y, col.z) !== 0){ setB(col.x, y, col.z, 0); placed.delete(bkey(col.x, y, col.z)); } })); burst(TEX.spark, cow.x, cow.y + 0.8, cow.z, 16, 3, 0xff8a6a, 0.28, 4, 0.8);
    dropCorral(c); makeCorral(cow, x, z, h, true); cow.y = h; return true; }
  return false;
}
function dropCorral(c){ scene.remove(c.beam); c.beam.material.dispose(); const i = corrals.indexOf(c); if (i >= 0) corrals.splice(i, 1); }
function freeCow(cow, quiet){
  const p = cow.p; if (cow.corral) dropCorral(cow.corral); if (cow.holder){ cow.holder.cow = null; }
  burst(TEX.spark, cow.x, cow.y + 0.8, cow.z, 14, 3, 0xfff2a0, 0.28, 4, 0.8);
  cow.held = false; cow.holder = null; cow.corral = null; cow.x = p.center.x; cow.z = p.center.z; cow.gy = p.H; cow.y = p.H; cow.rot = Math.PI; cow.state = 'idle'; cow.t = 1.5; cow.bounce = 1;
  burst(TEX.spark, cow.x, cow.y + 0.8, cow.z, 18, 3, 0x9dff8a, 0.28, 4, 0.9);
  if (!quiet){ track('vaca_rescatada', { vaca: cow.p.V.key }); sndMoo(COW_DEFS[cow.vi].pitch); sndGood(); for (let i = 0; i < 6; i++) spawnP(TEX.heart, cow.x + (Math.random() - 0.5), cow.y + 1.6, cow.z + (Math.random() - 0.5), 0, 1.2, 0, 1.3, 0.34, 0xff5a7a); toast('¡Liberaste a tu ' + cowName(cow) + '! Volvió a su plataforma.'); }
  refreshCounter(); if (!quiet) tryWin();
}

/* ---------------------------------------------------------------------
   Comportamiento del cuatrero
   --------------------------------------------------------------------- */
/* encerrado: no tiene salida a su mismo nivel o hacia abajo, y al menos un lado lo cierra un bloque puesto (o está totalmente tapiado) */
function trapState(u){ const cx = Math.floor(u.x), cz = Math.floor(u.z); let hard = 0, byBlock = false; const natural = [];
  for (const [dx, dz] of DIRS){ const x = cx + dx, z = cz + dz, g = stepY(x, z, u.gy); if (g != null && g <= u.gy) return null; if (g == null){ hard++; if (stepRelax(x, z, u.gy) == null) natural.push([x, z]); } if (placed.has(bkey(x, u.gy, z))) byBlock = true; }
  if (!(hard === 4 || byBlock)) return null;
  if (CFG().dig && natural.length){   // legendario: si algún lado es terreno natural, cava una escalera y sale
    if (!awake()) return null;
    for (const [x, z] of natural){ if (x < 2 || x > 61 || z < 2 || z > 61) continue; const ys = [u.gy + 1, u.gy + 2]; if (ys.some(y => y >= WY || isProtected(x, y, z) || placed.has(bkey(x, y, z)))) continue; return { dig: ys.filter(y => getB(x, y, z) !== 0).map(y => ({ x, y, z, t:1.6 })) }; }
  }
  return { trapped:true }; }
function popCuatrero(u){
  const cx = Math.floor(u.x), cz = Math.floor(u.z);
  for (const [dx, dz] of DIRS) for (let dy = 0; dy <= 1; dy++){ const x = cx + dx, y = u.gy + dy, z = cz + dz; if (placed.has(bkey(x, y, z)) && getB(x, y, z) !== 0){ setB(x, y, z, 0); placed.delete(bkey(x, y, z)); burst(TEX.sq, x + 0.5, y + 0.5, z + 0.5, 6, 2.4, 0xc8935a, 0.16, 10, 0.6); } }
  burst(TEX.spark, u.x, u.y + 1, u.z, 30, 4, () => [0xffffff, 0xffd27a, 0xff8a6a][Math.floor(Math.random()*3)], 0.3, 5, 1); sndPoof(); sndGood();
  const cow = u.cow; removeCuatrero(u); trappedN++; track('cuatrero_atrapado', { atrapados: trappedN, rol: u.role || 'cuatrero' }); if (cow) freeCow(cow); let fur = null; if (GS.inv){ GS.inv[2] += 6; if (CFG().earnFur) fur = grantFur(); refreshInv(); } toast(fur ? '¡Atrapaste al cuatrero! Dejó madera y pelaje para tu ' + fur.V.name + '.' : GS.inv ? '¡Atrapaste al cuatrero! Dejó 6 bloques de madera.' : '¡Atrapaste al cuatrero! Se rindió y se fue.'); refreshCounter(); tryWin();
}
function follow(u, speed, dt){
  if (!u.path.length) return false; const [tx, tz] = u.path[0], dx = tx + 0.5 - u.x, dz = tz + 0.5 - u.z, d = Math.hypot(dx, dz);
  if (d < 0.1){ u.path.shift(); return true; }
  if (Math.floor(u.x) !== tx || Math.floor(u.z) !== tz){ if (stepY(tx, tz, u.gy) == null){
    if (u.breaker && u.state === 'seek'){ for (const y of [u.gy, u.gy + 1]) if (placed.has(bkey(tx, y, tz)) && !cellMap.has(bkey(tx, y, tz)) && getB(tx, y, tz) !== 0){ u.brk = { x:tx, y, z:tz, t:2.6 }; return false; } }   // le estorba un bloque puesto: lo rompe
    u.path = []; u.rp = 0; return false; } }   // el camino cambió
  const st = Math.min(d, speed*dt); u.x += dx/d*st; u.z += dz/d*st; const g = walkableY(u.x, u.z, u.gy); if (g != null) u.gy = g;
  let dr = Math.atan2(dx, dz) - u.rot; while (dr > Math.PI) dr -= Math.PI*2; while (dr < -Math.PI) dr += Math.PI*2; u.rot += Math.max(-7*dt, Math.min(7*dt, dr)); u.phase += dt*speed*5.5; u.moving = true; return true;
}
function wanderStep(u){ const cx = Math.floor(u.x), cz = Math.floor(u.z), opts = DIRS.filter(([dx, dz]) => { const g = stepY(cx + dx, cz + dz, u.gy); return g != null && stepY(cx, cz, g) != null; }); if (opts.length){ const [dx, dz] = opts[Math.floor(Math.random()*opts.length)]; u.path = [[cx + dx, cz + dz]]; } }
function updateCuatrero(u, dt){
  u.moving = false; u.hitting = false; if (u.stunCd > 0) u.stunCd -= dt;
  // suelo: si le cambian el terreno se reacomoda
  const bx = Math.floor(u.x), bz = Math.floor(u.z);
  if (getB(bx, u.gy, bz) !== 0){ let y = u.gy; while (y < WY - 1 && getB(bx, y, bz) !== 0) y++; u.gy = y; } else if (getB(bx, u.gy - 1, bz) === 0){ let y = u.gy; while (y > 1 && getB(bx, y - 1, bz) === 0) y--; u.gy = y; }
  if (u.state === 'trapped'){ u.t -= dt; if (u.t <= 0){ popCuatrero(u); return; } }
  else {
    u.chk -= dt; if (u.chk <= 0 && !u.digq){ u.chk = 0.3; const ts = trapState(u); if (ts && ts.trapped){ u.state = 'trapped'; u.t = 1.6; u.path = []; sndStun(); toast('¡El cuatrero quedó encerrado!'); }
      else if (ts && ts.dig){ u.digq = ts.dig; u.path = []; u.brk = null; if (!digTold){ digTold = true; toast('¡Los cuatreros legendarios cavan para salir! Enciérralos con tus propios bloques.'); } } }
    if (u.state !== 'trapped' && u.stun > 0){ u.stun -= dt; if (Math.random() < dt*6) spawnP(TEX.spark, u.x + (Math.random() - 0.5)*0.7, u.y + 2 + Math.random()*0.2, u.z + (Math.random() - 0.5)*0.7, 0, 0.3, 0, 0.5, 0.2, 0xffe36a); }
    else if (u.state === 'sleep'){ if (awake()) u.state = 'seek'; u.zz -= dt; if (u.zz <= 0){ u.zz = 1.1; spawnP(TEX.sq, u.x + 0.2, u.y + 2, u.z, 0.15, 0.5, 0, 1.4, 0.16, 0xbfd4ff); } }
    else if (u.digq){   // cavando para salir de un hoyo
      const b = u.digq[0]; if (!b){ u.digq = null; u.rp = 0; }
      else { b.t -= dt; u.rot = Math.atan2(b.x + 0.5 - u.x, b.z + 0.5 - u.z); u.phase += dt*16; u.hitting = true; if (Math.random() < dt*5){ burst(TEX.sq, b.x + 0.5, b.y + 0.5, b.z + 0.5, 2, 1.6, 0x9a8a78, 0.13, 9, 0.4); tone('square', 150, 100, 0.05, 0.08); }
        if (getB(b.x, b.y, b.z) === 0) u.digq.shift(); else if (b.t <= 0){ setB(b.x, b.y, b.z, 0); placed.delete(bkey(b.x, b.y, b.z)); burst(TEX.sq, b.x + 0.5, b.y + 0.5, b.z + 0.5, 10, 2.4, 0x9a8a78, 0.16, 10, 0.6); sndCrunch(); u.digq.shift(); } }
    }
    else if (u.brk){   // rompiendo una cerca
      const b = u.brk; b.t -= dt; u.rot = Math.atan2(b.x + 0.5 - u.x, b.z + 0.5 - u.z); u.phase += dt*16; u.hitting = true;
      if (Math.random() < dt*5){ burst(TEX.sq, b.x + 0.5, b.y + 0.5, b.z + 0.5, 2, 1.6, 0xc8935a, 0.13, 9, 0.4); tone('square', 180, 120, 0.05, 0.08); }
      if (!awake() || getB(b.x, b.y, b.z) === 0) u.brk = null;
      else if (b.t <= 0){ setB(b.x, b.y, b.z, 0); placed.delete(bkey(b.x, b.y, b.z)); burst(TEX.sq, b.x + 0.5, b.y + 0.5, b.z + 0.5, 10, 2.4, 0xc8935a, 0.16, 10, 0.6); sndCrunch(); u.brk = null; u.rp = 0; if (!u.brokeMsg){ u.brokeMsg = true; toast('¡El cuatrero de pañuelo negro rompe tus cercas!'); } }
    }
    else if (u.w === 2 && (u.state === 'seek' || u.state === 'guard')) updateRaider(u, dt);
    else if (u.state === 'seek' || u.state === 'guard'){
      if (!awake()){ u.state = 'sleep'; u.path = []; }
      else {
        if (!u.target || u.target.held) u.target = null;
        u.rp -= dt;
        if (u.rp <= 0){ u.rp = 0.8;
          if (!u.target){ const taken = cuatreros.filter(o => o !== u && o.target).map(o => o.target), fc = freeCows(), pool = fc.filter(c => !taken.includes(c)); const list = pool.length ? pool : fc; u.target = list.sort((a, b) => Math.hypot(a.x - u.x, a.z - u.z) - Math.hypot(b.x - u.x, b.z - u.z))[0] || null; }
          if (u.target){ const c = u.target, gx = Math.floor(c.x), gz = Math.floor(c.z), res = bfs(Math.floor(u.x), Math.floor(u.z), u.gy, (x, z) => Math.abs(x - gx) <= 1 && Math.abs(z - gz) <= 1);
            if (res.goal != null){ u.path = pathFrom(res); u.lost = 0; u.state = 'seek'; }
            else if (u.breaker && (u.res2 = bfs(Math.floor(u.x), Math.floor(u.z), u.gy, (x, z) => Math.abs(x - gx) <= 1 && Math.abs(z - gz) <= 1, 1800, true)).goal != null){ u.path = pathFrom(u.res2); u.res2 = null; u.state = 'seek'; }
            else { u.lost++; u.target = null; u.state = 'guard'; wanderStep(u); if (!u.told){ u.told = true; toast('El cuatrero no encuentra cómo llegar a tus vacas. ¡Bien protegidas!'); } } }
          else { u.state = 'guard'; if (Math.random() < 0.5) wanderStep(u); }
        }
        follow(u, u.state === 'seek' ? 1.75 : 0.9, dt);
        const c = u.target; if (c && !c.held && Math.hypot(c.x - u.x, c.z - u.z) < 1.35 && Math.abs(c.gy - u.gy) <= 2){ c.held = true; c.holder = u; u.cow = c; u.target = null; u.state = 'tie'; u.t = 2.5; u.path = []; track('vaca_robada', { vaca: c.p.V.key }); sndAlarm(); toast('¡Un cuatrero atrapó a tu ' + cowName(c) + '! Enciérralo antes de que se la lleve.'); refreshCounter(); }
      }
    }
    else if (u.state === 'tie'){ u.t -= dt; const c = u.cow; if (!c){ u.state = 'seek'; } else { u.rot = Math.atan2(c.x - u.x, c.z - u.z); if (u.t <= 0){ u.site = choosePen(u); u.state = 'carry'; u.rp = 0; u.lost = 0; u.idle = 0; u.dawn = false; } } }
    else if (u.state === 'carry'){
      const c = u.cow; if (!c){ u.state = awake() ? 'seek' : 'sleep'; }
      else {
        if (!awake() && !u.dawn){ u.dawn = true; u.site = [Math.floor(u.x), Math.floor(u.z)]; u.path = [u.site.slice()]; u.rp = 999; }   // amaneció: arma el corral donde está y se duerme
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
  const up = u.state === 'tie' || u.state === 'trapped' ? -2.6 : (u.hitting ? -1.6 + Math.sin(u.phase)*0.9 : (u.state === 'carry' ? -0.9 : -sw*0.8));
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
  for (const c of cows) if (c.w === GS.world){ const D = COW_DEFS[c.vi]; push(c.x, c.z, c.y, 0.55, D.legH + D.body[1]); }
  for (const u of here()) push(u.x, u.z, u.y, 0.32, 1.85);
}
/* click (o Romper) sobre un cuatrero: queda mareado unos segundos */
export function hitCuatrero(maxT){
  const list = here(); if (!list.length) return false; raycaster.set(eyeV, dirV); raycaster.near = 0; raycaster.far = maxT;
  const hits = raycaster.intersectObjects(list.map(u => u.g), true); if (!hits.length) return false;
  let o = hits[0].object; while (o && !o.userData.cuatrero) o = o.parent; if (!o) return false; const u = o.userData.cuatrero;
  if (u.state !== 'trapped' && u.stunCd > 0 && !(u.stun > 0)){ toast('Todavía no puedes marearlo otra vez.'); return true; }
  if (u.state !== 'trapped'){ const c = CFG(); u.stun = c.stun; u.stunCd = c.stun + c.stunCd; u.brk = null; sndStun(); if (!stunHintShown){ stunHintShown = true; toast('¡Lo mareaste! Rodéalo con 4 bloques antes de que se le pase.'); } }
  return true;
}

/* ---------------------------------------------------------------------
   Ciclo de día y noche
   --------------------------------------------------------------------- */
function startNight(){
  phase = 'night'; clock = 0; nights++; sndNight(); track('noche_iniciada', { noche: nights });
  if (GS.world === 2){ toast(here().length ? '¡Es de noche en el reino!' : 'Cae la noche en el reino.'); return; }   // aquí no hay vacas que robar
  const cfg = CFG(); let moved = 0; if (cfg.moveCorral) corrals.slice().forEach(c => { if (relocateCorral(c)) moved++; });
  const fc = freeCows(), n = Math.min(cfg.perNight(nights, fc.length), cfg.maxActive - cuatreros.length); let made = 0;
  for (let i = 0; i < n; i++) if (spawnCuatrero(fc[i % fc.length], cfg.breakers && i === 0)) made++;
  cuatreros.forEach(u => { if (u.state === 'sleep') u.state = 'seek'; });
  toast((cuatreros.length ? (made > 1 ? '¡Es de noche! Llegaron ' + made + ' cuatreros.' : made === 1 ? '¡Es de noche! Llegó un cuatrero.' : '¡Es de noche! Los cuatreros despertaron.') : 'Noche tranquila: no hay vacas que robar.') + (moved ? ' Mudaron a tu vaca a un corral más lejano y reforzado.' : ''));
}
function startDay(){ phase = 'day'; clock = 0; warned = false; sndDawn(); toast(GS.world === 2 ? '¡Amaneció!' : cuatreros.length ? '¡Amaneció! Los cuatreros duermen: es el momento de encerrarlos.' : '¡Amaneció!'); }
export function clearAdventure(){ cuatreros.slice().forEach(u => { burst(TEX.spark, u.x, u.y + 1, u.z, 12, 3, 0xffffff, 0.25, 4, 0.7); removeCuatrero(u); }); cows.forEach(c => { if (c.held) freeCow(c, true); }); corrals.slice().forEach(dropCorral); clearBunker(); crewT = 0; started = false; phase = 'day'; clock = 0; warned = false; troubleT = 0; $('tip').classList.add('hidden'); refreshCounter(); }
export function isTense(){ if (GS.mode !== 'aventura') return false; return GS.world === 2 ? here().length > 0 : (!GS.prizeUnlocked && phase === 'night' && here().length > 0); }
/* se gana con las 3 vacas armadas y ninguna robada */
export function tryWin(){
  if (GS.prizeUnlocked || !plats.slice(0, 3).every(p => p.done) || plats.some(p => p.anim)) return;
  if (cows.some(c => c.held)){ toast('¡Ya armaste las 3! Rescata a tus vacas robadas para ganar.'); return; }
  GS.prizeUnlocked = true; GS.totalTime = GS.playTime; track('partida_ganada', { segundos: Math.round(GS.playTime), noches: nights, cuatreros_atrapados: trappedN }); if (GS.mode === 'aventura' && GS.diff === 'legendario') GS.crown = true; GS.newRecord = LATE.submitRecord ? LATE.submitRecord() : false; $('btnPrizePause').classList.remove('hidden'); clearAdventure(); writeSave(); GS.winAt = GS.playTime + 1.8;
}
export function setMode(m){ if (m !== GS.mode){ GS.mode = m; if (m === 'libre') clearAdventure(); writeSave(); } applyDifficulty(); }
export function setDifficulty(d){ if (!DIFFS[d]) return; if (d !== GS.diff){ GS.diff = d; clearAdventure(); writeSave(); } applyDifficulty(); }
/* bloques contados: los pelajes justos para las vacas que faltan (más 2 de repuesto) y pocos bloques de construcción */
function needOf(p){ const n = HOTBAR.map(() => 0); p.cells.forEach(c => { if (c.state !== 1){ const k = HOTBAR.indexOf(c.mat); if (k >= 0) n[k]++; } }); return n; }
function initialInv(cfg){ const open = plats.filter(p => !p.done), all = HOTBAR.map(() => 0); open.forEach(p => needOf(p).forEach((v, k) => { all[k] += v; }));
  const first = open[0] ? needOf(open[0]) : all.map(() => 0);   // legendario: pelaje solo para la primera vaca; el resto lo sueltan los cuatreros
  return HOTBAR.map((id, k) => k === 0 ? 10 : k === 1 ? 6 : k === 2 ? 6 + all[k] : cfg.earnFur ? (first[k] ? first[k] + 2 : 0) : (all[k] ? all[k] + 2 : 0)); }
/* cada cuatrero atrapado suelta cerca de la mitad del pelaje de la próxima vaca a la que le falte material */
function grantFur(){ for (const p of plats){ if (p.done) continue; const need = needOf(p); let short = false; for (let k = 3; k < need.length; k++) if (need[k] > GS.inv[k]) short = true; if (!short) continue;
    for (let k = 3; k < need.length; k++) if (need[k] > GS.inv[k]){ const tot = p.cells.filter(c => c.mat === HOTBAR[k]).length; GS.inv[k] += Math.min(need[k] - GS.inv[k] + 1, Math.ceil(tot/2) + 1); } return p; } return null; }
export function refreshInv(){ [...$('hotbar').children].forEach((el, k) => { let c = el.querySelector('.cnt'); if (!c){ c = document.createElement('em'); c.className = 'cnt'; el.append(c); } c.textContent = GS.inv ? GS.inv[k] : ''; el.classList.toggle('empty', !!GS.inv && GS.inv[k] <= 0); });
  const r = $('recover'); r.classList.toggle('hidden', GS.recover == null); if (GS.recover != null) r.textContent = '⛏ Puedes recuperar ' + GS.recover + ' bloques del terreno'; }
/* reglas que dependen del modo, la dificultad y el mapa (sin tocar el inventario) */
export function applyRules(){ const adv = GS.mode === 'aventura', cfg = CFG();
  if (LATE.applyHotbar) LATE.applyHotbar(); refreshLock(); setTemplate(adv && cfg.big ? 'big' : 'base'); GS.noAids = adv && !cfg.aids; corrals.forEach(c => { c.beam.visible = cfg.aids && GS.world === 1; });
  if (GS.inv){ while (GS.inv.length < HOTBAR.length) GS.inv.push(0);
    const r = plats[3]; if (r && r.cells.length && !royalGiven && !cfg.earnFur){ royalGiven = true; needOf(r).forEach((v, k) => { if (k >= 3 && v) GS.inv[k] += v + 2; }); } }   // material para la Vaca Real al desbloquearla
  refreshInv(); refreshModeUI(); }
/* al elegir modo o dificultad (y al cargar): reglas + inventario inicial */
export function applyDifficulty(){ const adv = GS.mode === 'aventura', cfg = CFG();
  GS.inv = null; applyRules(); royalGiven = !!(plats[3] && plats[3].cells.length); GS.inv = adv && cfg.limited ? initialInv(cfg) : null; GS.recover = adv && cfg.limited ? cfg.recover : null; refreshInv(); }
export function refreshModeUI(){ $('btnMode').textContent = 'Modo: ' + (GS.mode === 'aventura' ? 'aventura (' + CFG().label + ')' : 'libre'); if (GS.mode !== 'aventura') $('dial').classList.add('hidden');
  document.querySelectorAll('.diff').forEach(b => b.classList.toggle('sel', b.dataset.d === GS.diff)); }
$('btnMode').onclick = () => setMode(GS.mode === 'aventura' ? 'libre' : 'aventura');
/* menú de inicio: aventura -> dificultad -> jugar */
const showStep = n => { $('step1').classList.toggle('hidden', n !== 1); $('step2').classList.toggle('hidden', n !== 2); $('start').classList.toggle('picking', n === 2); };
let pickDiff = null;
$('btnStart').onclick = () => { pickDiff = GS.diff; refreshModeUI(); const n = plats.slice(0, 3).filter(p => p.done).length, any = n > 0 || GS.world === 2 || (plats[3] && plats[3].done);
  $('savedNote').classList.toggle('hidden', !any); $('savedTxt').textContent = 'Tienes una partida guardada (' + n + '/3 vacas' + (GS.world === 2 ? ', en el Reino de Piedra' : '') + '). Al jugar, continúas desde ahí.'; showStep(2); };
$('btnNew').onclick = () => { resetSave(); GS.saveReady = false; try { location.reload(); } catch (e){} };
document.querySelectorAll('.diff').forEach(b => { b.onclick = () => { pickDiff = b.dataset.d; document.querySelectorAll('.diff').forEach(o => o.classList.toggle('sel', o === b)); }; });
$('btnBackStart').onclick = () => showStep(1);
$('btnPlay').onclick = () => { GS.mode = 'aventura'; setDifficulty(pickDiff || GS.diff); applyDifficulty(); writeSave(); showStep(1); lock(); track('partida_iniciada', { vacas_previas: plats.slice(0, 3).filter(p => p.done).length }); };
$('btnStartFree').onclick = () => { setMode('libre'); lock(); track('partida_iniciada', { vacas_previas: plats.slice(0, 3).filter(p => p.done).length }); };
function refreshCounter(){ cows.forEach(c => { silCanvas[c.vi].style.outline = c.held ? '3px solid #e2352a' : ''; }); }
const TIPS = {
  corral: () => 'Tip: sigue el haz rojo y rompe cualquier bloque del corral de madera para liberar a tu vaca.',
  stun: () => 'Tip: ' + (GS.touch ? 'apunta al cuatrero y toca Romper' : 'haz click sobre el cuatrero') + ' para marearlo, y rodéalo con 4 bloques.',
  day: () => 'Tip: de día los cuatreros duermen. Es el mejor momento para rodearlos con bloques.',
  fence: () => 'Tip: una cerca de bloques alrededor de tus vacas las protege; los cuatreros no pueden saltarla.',
};
export function updateAdventure(dt){
  const royal = plats[3], w2 = GS.world === 2;
  // la aventura sigue en el primer mapa hasta ganar; en el Reino de Piedra (difícil y legendario), hasta armar la Vaca Real
  const on = GS.mode === 'aventura' && (w2 ? (GS.diff !== 'facil' && !(royal && royal.done)) : !GS.prizeUnlocked);
  if (w2 && royal && royal.locked && !lockTold && Math.hypot(player.x - royal.center.x, player.z - royal.center.z) < 7){ lockTold = true; toast('La Vaca Real está bloqueada: arma primero tus otras 3 vacas.'); }
  if (!on){ applyLight(Math.min(1, GS.daylight + dt*0.5)); if (w2 && GS.mode === 'aventura'){ const dial = $('dial'); dial.classList.remove('hidden', 'night', 'warn'); dial.textContent = royal && royal.done ? '👑 El reino está en paz' : '🕊 Reino en paz'; } return; }
  if (!started && (w2 || cows.length)){ started = true; phase = 'day'; clock = 0; warned = false; if (!w2) toast('¡Tu primera vaca! Cuidado: de noche salen los cuatreros.'); }
  let d = 1, rem = 0;
  if (started){
    clock += dt;
    if (phase === 'day'){ rem = CFG().day - clock; if (!w2 && rem <= WARN && !warned){ warned = true; sndWarn(); toast('¡Se hace de noche en ' + WARN + ' segundos! Vienen los cuatreros.'); } if (rem <= 0){ startNight(); rem = CFG().night; } }
    else { rem = CFG().night - clock; if (rem <= 0){ startDay(); rem = CFG().day; } }
    d = phase === 'day' ? Math.max(0, Math.min(1, rem/12)) : Math.max(0, Math.min(1, 1 - rem/8));
  }
  applyLight(d);
  // los que te siguen por el portal llegan unos segundos después
  for (const u of cuatreros) if (u.followAt != null && GS.playTime >= u.followAt){ u.followAt = null; if (u.w !== GS.world) arrive(u); }
  if (w2) updateCrew(dt);
  for (const u of cuatreros.slice()) if (u.w === GS.world) updateCuatrero(u, dt);
  if (!w2) for (const c of corrals.slice()) if (!c.cols.length || c.cols.some(col => col.ys.every(y => getB(col.x, y, col.z) === 0))) freeCow(c.cow);   // basta abrir una columna completa
  // HUD: reloj y tips
  uiT -= dt;
  if (uiT <= 0){ uiT = 0.25; const dial = $('dial'); dial.classList.remove('hidden'); dial.classList.toggle('night', phase === 'night' && started); dial.classList.toggle('warn', started && phase === 'day' && rem <= WARN);
    const n = here().length; dial.textContent = (w2 && crewT > 0) ? '🕊 Tregua: los cuatreros del reino llegan en ' + fmtTime(crewT) : (!started ? '☀️ Arma tu primera vaca' : (phase === 'day' ? '☀️ Noche en ' + fmtTime(rem) : '🌙 Amanece en ' + fmtTime(rem)) + (n ? ' · 🤠 ' + n : '')); }
  const robbed = cows.some(c => c.held), trouble = !w2 && (robbed || cuatreros.length > 0);
  if (!trouble){ if (troubleT > 0){ troubleT = 0; $('tip').classList.add('hidden'); } }
  else { troubleT += dt; if (troubleT >= 60 && CFG().aids){ tipT -= dt; if (tipT <= 0){ tipT = 10; const keys = []; if (corrals.length) keys.push('corral'); if (cuatreros.length){ keys.push('stun'); if (phase === 'day') keys.push('day'); } keys.push('fence'); const el = $('tip'); el.textContent = TIPS[keys[tipI++ % keys.length]](); el.classList.remove('hidden'); } } }
}

/* ---------------------------------------------------------------------
   Reino de Piedra: los cuatreros te siguen, te empujan y, en legendario, le construyen un búnker a la Vaca Real
   --------------------------------------------------------------------- */
const TRUCE = 180, CREW = 3;
/* punto de llegada de cada mapa: junto a la casa de la llave o a la casita de regreso */
function arrivalSpot(){ const [x, z] = GS.world === 2 ? [RETURN.x, RETURN.z - 2] : [KEYROOM.x + 3, KEYROOM.z]; return [x, z, topY(x, z)]; }
function arrive(u){ const [x, z, y] = arrivalSpot(), o = cuatreros.filter(v => v.w === GS.world).length;
  if (u.cow) freeCow(u.cow, true); u.cow = null; u.target = null; u.site = null; u.brk = null; u.digq = null; u.path = []; u.stun = 0;
  u.w = GS.world; u.x = x + 0.5 + (o % 3 - 1); u.z = z + 0.5 + (Math.floor(o/3) % 3 - 1)*0.9; u.gy = u.y = topY(Math.floor(u.x), Math.floor(u.z)); u.state = 'seek'; u.rp = 0; u.g.visible = true;
  burst(TEX.spark, u.x, u.y + 1, u.z, 16, 3, 0xff8a6a, 0.28, 4, 0.8); sndAlarm(); if (!u.followTold){ u.followTold = true; toast('¡Un cuatrero te siguió por el portal!'); } }
/* al cambiar de mapa: se muestran los de ese mapa; en difícil y legendario, los que quedaban te persiguen */
export function onWorldChange(from, to, live){
  for (const u of cuatreros) u.g.visible = u.w === to;
  if (live && GS.mode === 'aventura' && GS.diff !== 'facil'){ let k = 0; for (const u of cuatreros) if (u.w === from && u.state !== 'trapped') u.followAt = GS.playTime + 4 + (k++)*1.6; }
  if (to === 2 && live && CFG().dig && crewT <= 0 && !cuatreros.some(u => u.role === 'crew')){ const locked = !plats.slice(0, 3).every(p => p.done); crewT = !GS.visited2 && locked ? TRUCE : 20; }   // tregua larga solo la primera vez y si aún no puedes armar la Vaca Real
  if (to === 2) GS.visited2 = true; lockTold = false; applyRules(); refreshCounter(); uiT = 0;
}
export function debugSkipTruce(){ crewT = 0.01; crewSpawnT = 0; }
/* celdas del búnker: un muro alrededor de la plataforma y un techo encima */
let bunker = null;
function bunkerCells(){ const p = plats[3]; if (!p) return []; if (bunker && bunker.p === p && bunker.H === p.H) return bunker.cells;
  const cells = []; for (let y = p.H; y <= p.H + 5; y++) for (let x = p.x - 1; x <= p.x + 4; x++) for (let z = p.z - 1; z <= p.z + 5; z++){ const wall = x === p.x - 1 || x === p.x + 4 || z === p.z - 1 || z === p.z + 5; if (y === p.H + 5 || wall) cells.push({ x, y, z, cool:0 }); }
  bunker = { p, H:p.H, cells }; return cells; }
function clearBunker(){ bunker = null; }
function bunkerInfo(){ if (!bunker) return 'sin iniciar'; return bunker.cells.filter(c => getB(c.x, c.y, c.z) !== 0).length + '/' + bunker.cells.length; }
function nextBunkerCell(){ for (const c of bunkerCells()){ if (getB(c.x, c.y, c.z) !== 0){ c.had = true; continue; }
    if (c.had){ c.had = false; c.cool = GS.playTime + 8; }                                   // lo rompiste: tardan en reponerlo
    if (c.cool > GS.playTime || cellMap.has(bkey(c.x, c.y, c.z))) continue;
    if (player.x - HW < c.x + 1 && player.x + HW > c.x && player.y < c.y + 1 && player.y + PH > c.y && player.z - HW < c.z + 1 && player.z + HW > c.z) continue;   // nunca sobre ti
    if (cuatreros.some(u => u.w === 2 && Math.floor(u.x) === c.x && Math.floor(u.z) === c.z && c.y >= u.gy && c.y <= u.gy + 1)) continue;
    return c; } return null; }
/* cuadrilla del reino (legendario): aparece tras la tregua y se repone de a uno */
function updateCrew(dt){
  const p = plats[3]; if (!CFG().dig || !p || p.done) return;
  if (crewT > 0){ crewT -= dt; if (crewT <= 0) toast('Se acabó la tregua: los cuatreros del reino vienen a encerrar a la Vaca Real.'); return; }
  crewSpawnT -= dt; const crew = cuatreros.filter(u => u.w === 2 && u.role === 'crew'); if (crew.length >= CREW || crewSpawnT > 0) return;
  crewSpawnT = crew.length ? 20 : 2.5;
  for (let i = 0; i < 60; i++){ const a = Math.random()*Math.PI*2, r = 13 + Math.random()*7, x = Math.floor(p.center.x + Math.cos(a)*r), z = Math.floor(p.center.z + Math.sin(a)*r); if (x < 3 || x > 60 || z < 3 || z > 60) continue;
    const h = topY(x, z); if (stepY(x, z, h) !== h || Math.hypot(x - player.x, z - player.z) < 6) continue; const u = makeCuatrero(x, z, h, crew.length === 0); u.role = 'crew'; if (!u.crewTold && !crew.length) toast('¡Llegaron los cuatreros del reino! Quieren encerrar la plataforma de la Vaca Real.'); return; }
}
function updateRaider(u, dt){
  if (u.pushCd > 0) u.pushCd -= dt;
  const p = plats[3], building = u.role === 'crew' && !u.breaker && p && !p.done;   // el de pañuelo negro siempre va por ti
  const cell = building ? nextBunkerCell() : null;
  if (cell){   // construir: se acerca a la plataforma y va cerrando el búnker
    const near = Math.hypot(u.x - p.center.x, u.z - p.center.z) < 7.5;
    u.rp -= dt; if (!near && u.rp <= 0){ u.rp = 1; const res = bfs(Math.floor(u.x), Math.floor(u.z), u.gy, (x, z) => { const d = Math.hypot(x + 0.5 - p.center.x, z + 0.5 - p.center.z); return d < 6.5 && d > 4.6; }); if (res.goal != null) u.path = pathFrom(res); }
    if (!near) follow(u, 1.6, dt);
    else { u.path = []; u.rot = Math.atan2(cell.x + 0.5 - u.x, cell.z + 0.5 - u.z); u.hitting = true; u.phase += dt*12; u.t -= dt;
      if (u.t <= 0){ u.t = 0.75; setB(cell.x, cell.y, cell.z, B.STONE); const k = bkey(cell.x, cell.y, cell.z); placed.add(k); foreign.add(k); cell.had = true; sndPop(); burst(TEX.sq, cell.x + 0.5, cell.y + 0.5, cell.z + 0.5, 4, 1.6, 0x9a9a9a, 0.13, 8, 0.4); } }
    return;
  }
  // perseguir y empujar
  u.state = 'seek'; u.rp -= dt; const gx = Math.floor(player.x), gz = Math.floor(player.z);
  if (u.rp <= 0){ u.rp = 0.6; const goal = (x, z) => Math.abs(x - gx) <= 1 && Math.abs(z - gz) <= 1; let res = bfs(Math.floor(u.x), Math.floor(u.z), u.gy, goal, 1400);
    if (res.goal == null && u.breaker) res = bfs(Math.floor(u.x), Math.floor(u.z), u.gy, goal, 1400, true);
    if (res.goal != null) u.path = pathFrom(res); else if (!u.path.length) wanderStep(u); }
  follow(u, 1.7, dt);
  const dx = player.x - u.x, dz = player.z - u.z, d = Math.hypot(dx, dz);
  if (d < 1.75 && Math.abs(player.y - u.y) < 1.6 && u.pushCd <= 0){ u.pushCd = 2.4; const k = d > 0.01 ? 1/d : 0; player.vx += dx*k*9; player.vz += dz*k*9; player.vy = Math.max(player.vy, 5.5); player.ground = false; tone('square', 220, 90, 0.16, 0.22);
    if (!pushTold){ pushTold = true; toast('¡Los cuatreros te empujan! Maréalos o enciérralos.'); } }
}
/* al armar la Vaca Real: desaparecen todos los cuatreros del reino y estalla todo lo que construyeron */
export function royalBlast(){
  const any = cuatreros.some(u => u.w === 2) || foreign.size > 0;
  if (any) track('bunker_estallado', { cuatreros: cuatreros.filter(u => u.w === 2).length, bloques: foreign.size });   // solo si había algo que estallar
  cuatreros.slice().forEach(u => { if (u.w === 2){ burst(TEX.spark, u.x, u.y + 1, u.z, 22, 5, () => [0xffffff, 0xffd27a, 0xc8a8ff][Math.floor(Math.random()*3)], 0.3, 5, 1); removeCuatrero(u); } });
  let n = 0; for (const k of [...foreign]){ const x = k % 64, z = Math.floor(k/64) % 64, y = Math.floor(k/4096); if (getB(x, y, z) !== 0){ setB(x, y, z, 0); if (n++ % 3 === 0) burst(TEX.sq, x + 0.5, y + 0.5, z + 0.5, 5, 5, 0x9a9a9a, 0.2, 9, 0.9); } placed.delete(k); foreign.delete(k); }
  clearBunker(); crewT = 0; uiT = 0; if (any){ sndPoof(); sndNight(); toast('¡La Vaca Real espantó a todos los cuatreros del reino! Tu premio ahora es la Edición Real.'); }
}

/* panel de debug */
export function advFlags(){ return { modo:GS.mode, iniciado:started, fase:phase, reloj:clock, faltan:started ? (phase === 'day' ? CFG().day : CFG().night) - clock : null, noches:nights, luz:GS.daylight, cuatreros:cuatreros.map(u => ({ mundo:u.w, rol:u.role, estado:u.state, mareado:u.stun > 0, x:+u.x.toFixed(1), z:+u.z.toFixed(1), y:u.gy, llevaVaca:u.cow ? cowName(u.cow) : null, objetivo:u.target ? cowName(u.target) : null })), vacasRobadas:cows.filter(c => c.held).map(cowName), corrales:corrals.length, atrapados:trappedN, problemaHace:troubleT }; }
export function advDebug(){ const f = advFlags(); let h = 'mundo: <b>' + GS.world + '</b>   modo: <b>' + f.modo + '</b>'; if (f.modo !== 'aventura') return h + '\n'; h += ' (<b>' + GS.diff + '</b>)' + (GS.inv ? '   bloques: ' + GS.inv.join(',') + '   recuperables: ' + GS.recover : '') + (crewT > 0 ? '   tregua: ' + fmtTime(crewT) : '') + (GS.world === 2 ? '   búnker: ' + bunkerInfo() : '');
  h += '   fase: <b>' + (f.iniciado ? f.fase : 'sin iniciar') + '</b>' + (f.faltan != null ? ' (cambia en ' + fmtTime(f.faltan) + ')' : '') + '   noches: ' + f.noches + '   (L = anochecer, J = amanecer)\n';
  h += 'cuatreros: <b>' + f.cuatreros.length + '</b>' + f.cuatreros.map(u => ' [' + u.estado + (u.mareado ? '*' : '') + (u.llevaVaca ? ' con ' + u.llevaVaca.replace('Vaca ', '') : '') + ' @' + u.x + ',' + u.z + ']').join('') + '   atrapados: ' + f.atrapados + '\n';
  h += 'vacas robadas: ' + (f.vacasRobadas.length ? '<span class="warn">' + f.vacasRobadas.join(', ') + '</span>' : '<span class="off">ninguna</span>') + '   corrales: ' + f.corrales + '   tips en: ' + (f.problemaHace > 0 ? Math.max(0, 60 - f.problemaHace).toFixed(0) + ' s' : '—') + '\n';
  return h; }
if (DEBUG) document.addEventListener('keydown', e => { if (state !== 'play' || GS.mode !== 'aventura') return;
  if (e.code === 'KeyT') debugSkipTruce();
  if (e.code === 'KeyL'){ if (!started && cows.length) started = true; if (started){ phase = 'day'; clock = CFG().day - 2; warned = true; } }
  if (e.code === 'KeyJ' && started && phase === 'night') clock = CFG().night - 1; });

late('tryWin', () => tryWin);
late('setMode', () => setMode);
late('hitCuatrero', () => hitCuatrero);
late('advFlags', () => advFlags);
late('advDebug', () => advDebug);
late('refreshInv', () => refreshInv);
late('setDifficulty', () => setDifficulty);
late('royalBlast', () => royalBlast);

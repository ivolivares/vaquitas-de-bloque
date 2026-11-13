/* PLATAFORMAS Y HOLOGRAMAS */
import { track } from './analytics.js';
import * as THREE from 'three';
import { GS, LATE, late } from './state.js';
import { $, clamp, fmtTime, hash2, mkCanvas } from './util.js';
import { WX } from './blocks.js';
import { atlasTex, BLOCK_TILES } from './atlas.js';
import { getB, hmap, PLAT_POS, platH, setB, TEMPLATE, VARIANTS } from './world.js';
import { burst, scene, spawnP, TEX, tileBoxGeo } from './render.js';
import { sndBad, sndGood, sndMoo } from './audio.js';
import { writeSave } from './save.js';
import { cellKey, cellMap } from './player.js';

export const ghostMat = new THREE.MeshBasicMaterial({ map:atlasTex, transparent:true, opacity:0.7, depthWrite:false });
export const ghostEdgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 0.9, 0.9)), ghostEdgeMat = new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.85 });
export const okMat = new THREE.MeshBasicMaterial({ color:0x38ff5a, transparent:true, opacity:0.3, depthWrite:false, blending:THREE.AdditiveBlending });
export const badMat = new THREE.MeshBasicMaterial({ color:0xff2a1a, transparent:true, opacity:0.5, depthWrite:false });
export const animMat = new THREE.MeshBasicMaterial({ map:atlasTex });
export const overGeo = new THREE.BoxGeometry(1.05, 1.05, 1.05);
export function signTexture(name, done, locked){ const c = mkCanvas(256, 96), g = c.getContext('2d'); g.fillStyle = '#6b4222'; g.fillRect(0, 0, 256, 96); g.fillStyle = done ? '#cfeeb0' : locked ? '#cfc8bc' : '#f3dca6'; g.fillRect(8, 8, 240, 80);
  g.fillStyle = '#b98f52'; for (let i = 0; i < 40; i++) g.fillRect(8 + Math.floor(hash2(i, 1, 3)*232), 8 + Math.floor(hash2(i, 2, 3)*78), 8, 2);
  g.fillStyle = '#4a2a10'; g.font = 'bold 34px "Trebuchet MS",Verdana,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((done ? '✔ ' : locked ? '🔒 ' : '') + name, 128, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function makePlat(i){
  const V = VARIANTS[i], p = { i, V, x:0, z:0, H:0, done:false, time:null, startT:null, cells:[], anim:null, kind:null, group:new THREE.Group(), center:new THREE.Vector3() };
  p.post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), new THREE.MeshBasicMaterial({ color:0x6b4222 }));
  p.signMat = new THREE.MeshBasicMaterial({ map:signTexture(V.name, false) });
  p.s1 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.82), p.signMat); p.s2 = p.s1.clone(); p.s2.rotation.y = Math.PI;
  p.beamMat = new THREE.MeshBasicMaterial({ color:V.beam, transparent:true, opacity:0.42, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false });
  p.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 70, 8, 1, true), p.beamMat); p.core = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 70, 6, 1, true), p.beamMat);
  scene.add(p.group, p.post, p.s1, p.s2, p.beam, p.core); return p;
}
/* ubica la plataforma, su cartel y su haz de luz. Las tres vacas base viven en el primer mapa; la Vaca Real, en el segundo */
function placePlat(p){
  const [px, pz] = PLAT_POS[p.i === 3 ? 0 : p.i]; p.x = px; p.z = pz; p.H = platH[p.i === 3 ? 0 : p.i]; p.center.set(px + 2, p.H, pz + 2.5);
  const sx = px + 2, sz = pz + 5.7, sy = hmap[Math.floor(sx) + Math.floor(sz)*WX];
  p.post.position.set(sx, sy + 0.95, sz); p.s1.position.set(sx, sy + 1.75, sz + 0.09); p.s2.position.set(sx, sy + 1.75, sz - 0.09); p.beam.position.set(sx, sy + 2.2 + 35, sz); p.core.position.copy(p.beam.position);
}
function clearCells(p){ p.cells.forEach(c => { cellMap.delete(cellKey(c.x, c.y, c.z)); p.group.remove(c.ghost); p.group.remove(c.over); }); p.cells.length = 0; p.kind = null; }
export const plats = PLAT_POS.map((_, i) => { const p = makePlat(i); p.here = true; placePlat(p); return p; });
/* la Vaca Real se desbloquea cuando ya armaste las otras tres */
export function refreshLock(){ const p = plats[3]; if (!p || p.done) return; const locked = !plats.slice(0, 3).every(q => q.done); if (locked === p.locked) return;
  p.locked = locked; p.signMat.map.dispose(); p.signMat.map = signTexture(p.V.name, false, locked); p.beamMat.opacity = locked ? 0.14 : 0.42; clearCells(p); }
/* al cambiar de mapa: muestra solo las plataformas de ese mapa (y crea la de la Vaca Real la primera vez) */
export function relocatePlats(){
  if (GS.world === 2 && plats.length < 4){ const p = makePlat(3); p.locked = null; plats.push(p); }
  for (const p of plats){
    if (p.anim){ p.anim.cubes.forEach(m => scene.remove(m)); p.anim = null; LATE.spawnCow(p); }   // una vaca a medio aparecer no se pierde
    p.here = (p.i === 3) === (GS.world === 2); clearCells(p); if (p.here) placePlat(p);
    for (const o of [p.group, p.post, p.s1, p.s2, p.beam, p.core]) o.visible = p.here; }
  refreshLock();
}
/* plantillas: la base de 14 celdas y la grande de 23 (legendario), que suma lomo, cuernos de madera y cola */
function templateCells(kind, i, V){
  if (kind !== 'big') return TEMPLATE.map(tc => [tc[0], tc[1], tc[2], tc[3 + i] ? V.b : V.a]);
  const out = [], A = V.a, Bm = V.b, W = 6 /* madera */, add = (x, y, z, m) => out.push([x, y, z, m]);
  for (const [x, z] of [[1, 1], [2, 1], [1, 3], [2, 3]]) add(x, 0, z, i === 1 ? Bm : A);                                   // patas
  for (let y = 1; y <= 2; y++) for (let z = 1; z <= 3; z++) for (let x = 1; x <= 2; x++){                                   // cuerpo de dos pisos
    let m = A; if (i === 0 && z === 2) m = Bm; if (i === 3 && y === 2) m = Bm; if (i === 2 && ((x === 1 && y === 1 && z === 1) || (x === 2 && y === 1 && z === 3) || (x === 2 && y === 2 && z === 2) || (x === 1 && y === 2 && z === 3))) m = Bm; add(x, y, z, m); }
  for (let y = 2; y <= 3; y++) for (let x = 1; x <= 2; x++) add(x, y, 0, i === 2 && x === 1 && y === 3 ? Bm : A);           // cabeza
  add(0, 3, 0, W); add(3, 3, 0, W);                                                                                         // cuernos
  add(1, 2, 4, Bm);                                                                                                         // cola
  return out;
}
export function setTemplate(kind){
  for (const p of plats){ if (p.done || !p.here || p.locked){ if (p.cells.length && !p.done) clearCells(p); continue; } if (p.kind === kind) continue;
    clearCells(p); p.kind = kind;
    templateCells(kind, p.i, p.V).forEach(([dx, dy, dz, mat]) => { const cell = { x:p.x + dx, y:p.H + dy, z:p.z + dz, mat, state:0, p };
      cell.ghost = new THREE.Mesh(tileBoxGeo(BLOCK_TILES[mat][2], 0.9), ghostMat); cell.ghost.position.set(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5); cell.ghost.add(new THREE.LineSegments(ghostEdgeGeo, ghostEdgeMat)); p.group.add(cell.ghost);
      cell.over = new THREE.Mesh(overGeo, okMat); cell.over.position.copy(cell.ghost.position); cell.over.visible = false; p.group.add(cell.over); p.cells.push(cell); });
    registerCells(p); evalPlatform(p, null); }
}
export function registerCells(p){ p.cells.forEach(c => cellMap.set(cellKey(c.x, c.y, c.z), c)); }
export function evalPlatform(p, feedbackCell){
  if (p.done || !p.cells.length) return; let ok = 0;   // sin celdas (otro mapa o bloqueada) no hay nada que evaluar
  for (const c of p.cells){ const b = getB(c.x, c.y, c.z); c.state = b === 0 ? 0 : (b === c.mat ? 1 : 2); c.ghost.visible = c.state === 0; c.over.visible = c.state !== 0; c.over.material = c.state === 1 ? okMat : badMat; if (c.state === 1) ok++; }
  if (feedbackCell){ if (feedbackCell.state === 1){ sndGood(); burst(TEX.spark, feedbackCell.x + 0.5, feedbackCell.y + 0.5, feedbackCell.z + 0.5, 8, 2.2, 0x9dff8a, 0.22, 3, 0.6); } else if (feedbackCell.state === 2){ sndBad(); LATE.toast('Ese material no va ahí. Rómpelo y prueba con otro.'); } }
  if (ok === p.cells.length) completePlatform(p);
}
export function markDone(p){ p.done = true; p.cells.forEach(c => { cellMap.delete(cellKey(c.x, c.y, c.z)); c.ghost.visible = false; c.over.visible = false; });
  p.signMat.map.dispose(); p.signMat.map = signTexture(p.V.name, true); p.beamMat.color.setHex(0x7dff9a); p.beamMat.opacity = 0.16; }
export function completePlatform(p){
  p.time = p.startT == null ? 999 : Math.max(1, GS.playTime - p.startT);
  markDone(p);
  const cubes = p.cells.map(c => { const m = new THREE.Mesh(tileBoxGeo(BLOCK_TILES[c.mat][2], 1), animMat); m.position.set(c.x + 0.5, c.y + 0.5, c.z + 0.5); scene.add(m); setB(c.x, c.y, c.z, 0); return m; });
  p.anim = { t:0, cubes }; sndGood(); LATE.updateCounter(); writeSave();
}
export function updatePlatAnim(p, dt){
  const a = p.anim; a.t += dt; const k = clamp(1 - a.t, 0, 1), s = k*k*(3 - 2*k);
  a.cubes.forEach((m, i) => { m.scale.setScalar(Math.max(0.001, s)); m.rotation.y += dt*(4 + i%3); m.rotation.x += dt*3; m.position.y += dt*0.5;
    if (Math.random() < dt*10) spawnP(TEX.spark, m.position.x + (Math.random()-0.5), m.position.y + (Math.random()-0.5), m.position.z + (Math.random()-0.5), 0, 1.2, 0, 0.6, 0.3, 0xfff2a0); });
  if (a.t >= 1){ a.cubes.forEach(m => scene.remove(m)); p.anim = null;
    track('vaca_armada', { vaca: p.V.key, segundos: p.time >= 999 ? null : Math.round(p.time), plantilla: p.kind }); const cow = LATE.spawnCow(p); sndMoo(LATE.COW_DEFS[p.i].pitch); burst(TEX.spark, p.center.x, p.H + 1, p.center.z, 40, 4.5, () => [0xfff2a0, 0xffffff, 0x9dff8a, p.V.beam][Math.floor(Math.random()*4)], 0.32, 5, 1.1); cow.bounce = 1;
    LATE.toast(p.i === 3 ? '¡Armaste la Vaca Real! Tu premio ahora es la Edición Real.' : '¡' + p.V.name + ' lista en ' + fmtTime(p.time) + '!');
    if (p.i === 3 && LATE.royalBlast) LATE.royalBlast(); LATE.tryWin(); }
}
export function onEdit(x, y, z, placed){ for (const p of plats){ if (p.done) continue; const c = cellMap.get(cellKey(x, y, z)); const mine = c && c.p === p; if (mine && placed && p.startT == null) p.startT = GS.playTime; evalPlatform(p, mine && placed ? c : null); } }

/* enlaces tardíos */
late('plats', () => plats);

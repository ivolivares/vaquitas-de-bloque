/* PLATAFORMAS Y HOLOGRAMAS */
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
export function signTexture(name, done){ const c = mkCanvas(256, 96), g = c.getContext('2d'); g.fillStyle = '#6b4222'; g.fillRect(0, 0, 256, 96); g.fillStyle = done ? '#cfeeb0' : '#f3dca6'; g.fillRect(8, 8, 240, 80);
  g.fillStyle = '#b98f52'; for (let i = 0; i < 40; i++) g.fillRect(8 + Math.floor(hash2(i, 1, 3)*232), 8 + Math.floor(hash2(i, 2, 3)*78), 8, 2);
  g.fillStyle = '#4a2a10'; g.font = 'bold 34px "Trebuchet MS",Verdana,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((done ? '✔ ' : '') + name, 128, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
export const plats = PLAT_POS.map(([px, pz], i) => {
  const V = VARIANTS[i], H = platH[i], p = { i, V, x:px, z:pz, H, done:false, time:null, startT:null, cells:[], anim:null, group:new THREE.Group() };
  scene.add(p.group);
  TEMPLATE.forEach(tc => { const mat = tc[3 + i] ? V.b : V.a, cell = { x:px + tc[0], y:H + tc[1], z:pz + tc[2], mat, state:0, p };
    cell.ghost = new THREE.Mesh(tileBoxGeo(BLOCK_TILES[mat][2], 0.9), ghostMat); cell.ghost.position.set(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5); cell.ghost.add(new THREE.LineSegments(ghostEdgeGeo, ghostEdgeMat)); p.group.add(cell.ghost);
    cell.over = new THREE.Mesh(overGeo, okMat); cell.over.position.copy(cell.ghost.position); cell.over.visible = false; p.group.add(cell.over); p.cells.push(cell); });
  // cartel + haz de luz, detrás de la plataforma
  const sx = px + 2, sz = pz + 5.7, sy = hmap[Math.floor(sx) + Math.floor(sz)*WX];
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), new THREE.MeshBasicMaterial({ color:0x6b4222 })); post.position.set(sx, sy + 0.95, sz); scene.add(post);
  p.signMat = new THREE.MeshBasicMaterial({ map:signTexture(V.name, false) });
  const s1 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.82), p.signMat), s2 = s1.clone(); s1.position.set(sx, sy + 1.75, sz + 0.09); s2.position.set(sx, sy + 1.75, sz - 0.09); s2.rotation.y = Math.PI; scene.add(s1, s2);
  p.beamMat = new THREE.MeshBasicMaterial({ color:V.beam, transparent:true, opacity:0.42, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 70, 8, 1, true), p.beamMat); beam.position.set(sx, sy + 2.2 + 35, sz); scene.add(beam);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 70, 6, 1, true), p.beamMat); core.position.copy(beam.position); scene.add(core);
  p.center = new THREE.Vector3(px + 2, H, pz + 2.5);
  return p;
});
export function registerCells(p){ p.cells.forEach(c => cellMap.set(cellKey(c.x, c.y, c.z), c)); }
export function evalPlatform(p, feedbackCell){
  if (p.done) return; let ok = 0;
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
    const cow = LATE.spawnCow(p); sndMoo(LATE.COW_DEFS[p.i].pitch); burst(TEX.spark, p.center.x, p.H + 1, p.center.z, 40, 4.5, () => [0xfff2a0, 0xffffff, 0x9dff8a, p.V.beam][Math.floor(Math.random()*4)], 0.32, 5, 1.1); cow.bounce = 1;
    LATE.toast('¡' + p.V.name + ' lista en ' + fmtTime(p.time) + '!');
    if (plats.every(q => q.done) && !GS.prizeUnlocked){ GS.prizeUnlocked = true; $('btnPrizePause').classList.remove('hidden'); writeSave(); GS.winAt = GS.playTime + 1.8; } }
}
export function onEdit(x, y, z, placed){ for (const p of plats){ if (p.done) continue; const c = cellMap.get(cellKey(x, y, z)); const mine = c && c.p === p; if (mine && placed && p.startT == null) p.startT = GS.playTime; evalPlatform(p, mine && placed ? c : null); } }

/* enlaces tardíos */
late('plats', () => plats);

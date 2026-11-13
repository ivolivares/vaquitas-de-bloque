/* ENCARGOS (modo libre): hologramas de construcciones. Al completarlos quedan en pie y regalan un bloque decorativo */
import { track } from './analytics.js';
import * as THREE from 'three';
import { GS, LATE, late } from './state.js';
import { WX } from './blocks.js';
import { B, BLOCK_NAME } from './blocks.js';
import { BLOCK_TILES } from './atlas.js';
import { getB, hmap, PLAT_POS, platH, setB } from './world.js';
import { burst, scene, TEX, tileBoxGeo } from './render.js';
import { sndBad, sndFanfare, sndGood } from './audio.js';
import { writeSave } from './save.js';
import { cellKey, cellMap } from './player.js';
import { badMat, ghostEdgeGeo, ghostEdgeMat, ghostMat, okMat, overGeo, signTexture } from './platforms.js';

const L = B.LOG, W = B.WOOD, S = B.STONE, H = B.HAY;
function stable(){ const o = []; for (const [x, z] of [[0, 0], [2, 0], [0, 3], [2, 3]]) for (let y = 0; y < 2; y++) o.push([x, y, z, L]); for (let y = 0; y < 2; y++){ o.push([1, y, 0, W]); for (const [x, z] of [[0, 1], [0, 2], [2, 1], [2, 2]]) o.push([x, y, z, W]); } for (let x = 0; x < 3; x++) for (let z = 0; z < 4; z++) o.push([x, 2, z, H]); return o; }
function well(){ const o = []; for (let x = 1; x <= 3; x++) for (let z = 1; z <= 3; z++) if (x !== 2 || z !== 2) o.push([x, 0, z, S]); o.push([1, 1, 2, L], [3, 1, 2, L], [1, 2, 2, W], [2, 2, 2, W], [3, 2, 2, W]); return o; }
const DEFS = [
  { key:'espantapajaros', name:'Espantapájaros', prize:B.TILE, cells:[[2, 0, 2, L], [2, 1, 2, H], [1, 1, 2, W], [3, 1, 2, W], [2, 2, 2, B.PUMPKIN]] },
  { key:'pozo', name:'Pozo', prize:B.LAMP, cells:well() },
  { key:'establo', name:'Establo', prize:B.GOLD, cells:stable() },
];
export const jobs = DEFS.map((D, i) => { const [px, pz] = PLAT_POS[6 + i], Hh = platH[6 + i], j = { i, D, x:px, z:pz, H:Hh, done:false, here:false, cells:[], group:new THREE.Group() };
  const sx = px + 2, sz = pz + 5.7, sy = hmap[Math.floor(sx) + Math.floor(sz)*WX];
  j.signMat = new THREE.MeshBasicMaterial({ map:signTexture(D.name, false) }); const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), new THREE.MeshBasicMaterial({ color:0x6b4222 })); post.position.set(sx, sy + 0.95, sz);
  const s1 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.82), j.signMat), s2 = s1.clone(); s1.position.set(sx, sy + 1.75, sz + 0.09); s2.position.set(sx, sy + 1.75, sz - 0.09); s2.rotation.y = Math.PI;
  j.beamMat = new THREE.MeshBasicMaterial({ color:0x6ad8ff, transparent:true, opacity:0.32, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 70, 8, 1, true), j.beamMat); beam.position.set(sx, sy + 2.2 + 35, sz);
  j.deco = new THREE.Group(); j.deco.add(post, s1, s2, beam); j.deco.visible = false; j.group.visible = false; scene.add(j.group, j.deco); return j; });
function clearCells(j){ j.cells.forEach(c => { if (cellMap.get(cellKey(c.x, c.y, c.z)) === c) cellMap.delete(cellKey(c.x, c.y, c.z)); j.group.remove(c.ghost, c.over); }); j.cells.length = 0; }
function markDone(j){ j.done = true; clearCells(j); j.signMat.map.dispose(); j.signMat.map = signTexture(j.D.name, true); j.beamMat.opacity = 0.1; }
function evalJob(j, fb){ if (j.done || !j.cells.length) return; let ok = 0;
  for (const c of j.cells){ const b = getB(c.x, c.y, c.z); c.state = b === 0 ? 0 : (b === c.mat ? 1 : 2); c.ghost.visible = c.state === 0; c.over.visible = c.state !== 0; c.over.material = c.state === 1 ? okMat : badMat; if (c.state === 1) ok++; }
  if (fb){ if (fb.state === 1){ sndGood(); burst(TEX.spark, fb.x + 0.5, fb.y + 0.5, fb.z + 0.5, 8, 2.2, 0x9dff8a, 0.22, 3, 0.6); } else if (fb.state === 2){ sndBad(); LATE.toast('Ese material no va ahí. Rómpelo y prueba con otro.'); } }
  if (ok === j.cells.length){ const cx = j.x + 2, cz = j.z + 2; markDone(j); GS.jobs[j.i] = true; LATE.unlockBlock(j.D.prize); writeSave(); sndFanfare(); track('encargo_completado', { encargo: j.D.key });
    burst(TEX.spark, cx, j.H + 2, cz, 50, 5, () => [0xfff2a0, 0xffffff, 0x6ad8ff, 0x9dff8a][Math.floor(Math.random()*4)], 0.32, 5, 1.2); LATE.toast('¡Encargo listo: ' + j.D.name + '! Ganaste el bloque ' + BLOCK_NAME[j.D.prize] + ': está en tu mochila.'); } }
/* los encargos solo existen en la granja y en modo libre; los terminados se mantienen en pie */
export function syncJobs(){ const on = GS.world === 1 && GS.mode === 'libre';
  for (const j of jobs){ if (GS.jobs[j.i] && !j.done) markDone(j); j.here = on; j.group.visible = j.deco.visible = on;
    if (!on){ clearCells(j); continue; }
    if (j.done){ j.D.cells.forEach(([dx, dy, dz, mat]) => { if (getB(j.x + dx, j.H + dy, j.z + dz) !== mat) setB(j.x + dx, j.H + dy, j.z + dz, mat); }); continue; }
    if (!j.cells.length){ j.D.cells.forEach(([dx, dy, dz, mat]) => { const c = { x:j.x + dx, y:j.H + dy, z:j.z + dz, mat, state:0, p:j };
        c.ghost = new THREE.Mesh(tileBoxGeo(BLOCK_TILES[mat][2], 0.9), ghostMat); c.ghost.position.set(c.x + 0.5, c.y + 0.5, c.z + 0.5); c.ghost.add(new THREE.LineSegments(ghostEdgeGeo, ghostEdgeMat));
        c.over = new THREE.Mesh(overGeo, okMat); c.over.position.copy(c.ghost.position); c.over.visible = false; j.group.add(c.ghost, c.over); j.cells.push(c); cellMap.set(cellKey(c.x, c.y, c.z), c); }); }
    evalJob(j, null); } }
export function jobEdit(x, y, z, placed){ const c = cellMap.get(cellKey(x, y, z)); for (const j of jobs) if (j.here && !j.done) evalJob(j, c && c.p === j && placed ? c : null); }

late('syncJobs', () => syncJobs);
late('jobEdit', () => jobEdit);
late('jobs', () => jobs);

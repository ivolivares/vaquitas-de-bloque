/* ACCIONES DEL JUGADOR: romper, poner, acariciar */
import { bkey, placed } from './world.js';
import * as THREE from 'three';
import { GS, LATE } from './state.js';
import { $ } from './util.js';
import { B, BLOCK_NAME } from './blocks.js';
import { BLOCK_TILES, tileAvg } from './atlas.js';
import { getB, inWorld, isProtected, setB } from './world.js';
import { burst, outline, TEX } from './render.js';
import { sndCrunch, sndPop, sndThud } from './audio.js';
import { aim, cellKey, cellMap, dirV, eyeV, HW, PH, player, raycastGrid, REACH } from './player.js';
import { evalPlatform, onEdit, plats } from './platforms.js';
import { cows, petCow, raycaster } from './cows.js';

export const HOTBAR = [B.DIRT, B.STONE, B.WOOD, B.BLACK, B.WHITE, B.RUST, B.BROWN, B.LAVENDER, B.SLATE];
export function cowUnderAim(maxT){ raycaster.set(eyeV, dirV); raycaster.near = 0; raycaster.far = maxT; const hits = raycaster.intersectObjects(cows.map(c => c.group), true); if (!hits.length) return null; let o = hits[0].object; while (o && !o.userData.cow) o = o.parent; return o ? o.userData.cow : null; }
export function actBreak(){
  aim(); const hit = raycastGrid(eyeV, dirV, REACH); const cow = cowUnderAim(hit.hit ? Math.min(REACH, hit.t) : REACH);   // la vaca tiene prioridad sobre los bloques
  if (LATE.hitCuatrero && LATE.hitCuatrero(hit.hit ? Math.min(REACH, hit.t) : REACH)) return;   // click sobre un cuatrero: lo marea
  if (cow){ petCow(cow); return; }
  if (!hit.hit) return;
  if (isProtected(hit.x, hit.y, hit.z)){ sndThud(); LATE.toast('Ese bloque no se puede romper.'); return; }
  const avg = tileAvg[BLOCK_TILES[hit.id][2]]; setB(hit.x, hit.y, hit.z, 0); placed.delete(bkey(hit.x, hit.y, hit.z)); sndCrunch();
  if (GS.inv){ let k = HOTBAR.indexOf(hit.id); if (k < 0) k = hit.id === B.GRASS ? 0 : (hit.id === B.LOG ? 2 : -1); if (k >= 0){ GS.inv[k]++; LATE.refreshInv(); } }   // con bloques contados, romper devuelve material
  burst(TEX.sq, hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 9, 2.2, new THREE.Color().setRGB(avg[0]/255, avg[1]/255, avg[2]/255, THREE.SRGBColorSpace), 0.16, 12, 0.6); onEdit(hit.x, hit.y, hit.z, false);
}
export function actPlace(){
  aim(); const hit = raycastGrid(eyeV, dirV, REACH); let x, y, z;
  if (hit.ghost){ x = hit.ghost.x; y = hit.ghost.y; z = hit.ghost.z; } else if (hit.hit){ x = hit.x + hit.fx; y = hit.y + hit.fy; z = hit.z + hit.fz; } else return;
  if (!inWorld(x, y, z) || getB(x, y, z) !== 0) return;
  if (player.x - HW < x + 1 && player.x + HW > x && player.y < y + 1 && player.y + PH > y && player.z - HW < z + 1 && player.z + HW > z){ LATE.toast('No puedes poner un bloque donde estás parado.'); return; }
  if (GS.inv && GS.inv[GS.slot] <= 0){ sndThud(); LATE.toast('No te queda ' + BLOCK_NAME[HOTBAR[GS.slot]].toLowerCase() + '. Rompe bloques para conseguir más.'); return; }
  setB(x, y, z, HOTBAR[GS.slot]); placed.add(bkey(x, y, z)); sndPop(); if (GS.inv){ GS.inv[GS.slot]--; LATE.refreshInv(); } onEdit(x, y, z, true);
}
export function debugComplete(){ let best = null, bd = 1e9; for (const p of plats){ if (p.done) continue; const d = Math.hypot(p.center.x - player.x, p.center.z - player.z); if (d < bd){ bd = d; best = p; } } if (!best) return;
  best.cells.forEach(c => setB(c.x, c.y, c.z, c.mat)); evalPlatform(best, null); }
export let hintTxt = '';
export function updateTarget(){
  aim(); const hit = raycastGrid(eyeV, dirV, REACH); let h = '';
  if (hit.ghost && GS.noAids){ outline.visible = true; outline.position.set(hit.ghost.x + 0.5, hit.ghost.y + 0.5, hit.ghost.z + 0.5); }
  else if (hit.ghost){ outline.visible = true; outline.position.set(hit.ghost.x + 0.5, hit.ghost.y + 0.5, hit.ghost.z + 0.5); const need = hit.ghost.cell.mat, key = HOTBAR.indexOf(need) + 1; h = HOTBAR[GS.slot] === need ? (GS.touch ? '¡Ese es! Toca Poner' : '¡Ese es! Click derecho para ponerlo') : 'Aquí va: ' + BLOCK_NAME[need] + (GS.touch ? ' (tócalo abajo)' : ' (tecla ' + key + ')'); }
  else if (hit.hit){ outline.visible = true; outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); const c = cellMap.get(cellKey(hit.x, hit.y, hit.z)); if (c && c.state === 2) h = GS.touch ? 'Ese no es. Rómpelo con Romper' : 'Ese no es. Rómpelo con click izquierdo'; }
  else outline.visible = false;
  if (h !== hintTxt){ hintTxt = h; $('hint').textContent = h; $('hint').classList.toggle('hidden', !h); }
}

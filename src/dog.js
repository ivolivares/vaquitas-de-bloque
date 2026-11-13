/* PERRO PASTOR (aventura fácil): llega con la primera noche, te sigue y marea a los cuatreros que se acerquen */
import * as THREE from 'three';
import { late } from './state.js';
import { topY } from './world.js';
import { scene, spawnP, TEX } from './render.js';
import { tone } from './audio.js';
import { player } from './player.js';
import { walkableY } from './cows.js';
import { cuatreros } from './adventure.js';
import { toast } from './ui.js';

const mat = c => new THREE.MeshLambertMaterial({ color:c }), BLK = mat(0x2a2a30), WHT = mat(0xf4f0e6), PNK = mat(0xe07a8a);
const g = new THREE.Group(), bx = (p, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); p.add(o); return o; };
bx(g, 0.34, 0.32, 0.66, BLK, 0, 0.46, 0); bx(g, 0.36, 0.24, 0.2, WHT, 0, 0.42, 0.26);                                   // cuerpo y pecho blanco
const head = new THREE.Group(); head.position.set(0, 0.66, 0.36); g.add(head); bx(head, 0.3, 0.28, 0.28, BLK, 0, 0, 0); bx(head, 0.1, 0.28, 0.02, WHT, 0, 0, 0.145); bx(head, 0.16, 0.13, 0.16, WHT, 0, -0.06, 0.2); bx(head, 0.06, 0.05, 0.03, BLK, 0, -0.02, 0.29); bx(head, 0.06, 0.02, 0.06, PNK, 0, -0.13, 0.24);
[1, -1].forEach(s => { bx(head, 0.09, 0.12, 0.06, BLK, s*0.11, 0.19, -0.05); bx(head, 0.05, 0.05, 0.02, WHT, s*0.08, 0.04, 0.145); bx(head, 0.03, 0.03, 0.02, BLK, s*0.08, 0.04, 0.156); });
const legs = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => { const l = new THREE.Group(); l.position.set(sx*0.11, 0.32, sz*0.24); bx(l, 0.1, 0.32, 0.1, WHT, 0, -0.16, 0); g.add(l); return l; });
const tail = new THREE.Group(); tail.position.set(0, 0.6, -0.33); g.add(tail); bx(tail, 0.07, 0.3, 0.07, BLK, 0, 0.13, -0.04); bx(tail, 0.08, 0.1, 0.08, WHT, 0, 0.32, -0.04);
g.visible = false; scene.add(g);
export const dog = { g, on:false, x:0, z:0, y:0, gy:0, rot:0, cd:0, stuck:0, phase:0, told:false };
function bark(){ tone('square', 520, 380, 0.07, 0.16); tone('square', 560, 400, 0.08, 0.16, 0.13); }
function home(){ for (const [dx, dz] of [[1.6, 1], [-1.6, 1], [1, -1.6], [-1, -1.6], [0, 0]]){ const x = player.x + dx, z = player.z + dz, y = topY(Math.floor(x), Math.floor(z)); if (Math.abs(y - player.y) <= 2 || (dx === 0 && dz === 0)){ dog.x = x; dog.z = z; dog.gy = dog.y = y; dog.stuck = 0; return; } } }
export function updateDog(dt, active){
  if (!active){ if (dog.on){ dog.on = false; g.visible = false; } return; }
  if (!dog.on){ dog.on = true; g.visible = true; home(); bark(); toast('🐶 ¡Llegó tu perro pastor! Marea a los cuatreros que se le acercan.'); }
  dog.cd -= dt; let tx = player.x, tz = player.z, stop = 2.6, speed = 4.4, prey = null;
  if (dog.cd <= 0){ let bd = 16; for (const u of cuatreros){ if (u.w !== 1 || u.state === 'sleep' || u.state === 'trapped' || u.stun > 0) continue; const d = Math.hypot(u.x - dog.x, u.z - dog.z); if (d < bd){ bd = d; prey = u; } } }
  if (prey){ tx = prey.x; tz = prey.z; stop = 1.5; speed = 6.2; }
  const dx = tx - dog.x, dz = tz - dog.z, d = Math.hypot(dx, dz); let moving = false;
  if (prey && d <= stop){ prey.stun = 3.5; prey.stunCd = Math.max(prey.stunCd || 0, 3.5); prey.brk = null; dog.cd = 14; bark(); for (let i = 0; i < 6; i++) spawnP(TEX.spark, prey.x + (Math.random() - 0.5), prey.y + 1.8, prey.z + (Math.random() - 0.5), 0, 0.6, 0, 0.6, 0.22, 0xffe36a); if (!dog.told){ dog.told = true; toast('🐶 ¡Tu perro mareó a un cuatrero! Rodéalo con 4 bloques.'); } }
  else if (d > stop){ if (!prey && d > 9) speed = 7; const ux = dx/d, uz = dz/d, st = speed*dt; let ok = false;
    for (const [mx, mz] of [[ux, uz], [ux, 0], [0, uz]]){ if (!mx && !mz) continue; const gy = walkableY(dog.x + mx*st*1.5 + Math.sign(mx)*0.2, dog.z + mz*st*1.5 + Math.sign(mz)*0.2, dog.gy); if (gy != null){ dog.x += mx*st; dog.z += mz*st; dog.gy = gy; ok = true; break; } }
    if (ok){ dog.stuck = 0; moving = true; dog.phase += dt*16; } else dog.stuck += dt;
    let dr = Math.atan2(ux, uz) - dog.rot; while (dr > Math.PI) dr -= Math.PI*2; while (dr < -Math.PI) dr += Math.PI*2; dog.rot += Math.max(-9*dt, Math.min(9*dt, dr)); }
  if (!prey && (d > 24 || dog.stuck > 2.5)) home();
  dog.y += (dog.gy - dog.y)*Math.min(1, dt*12); const sw = moving ? Math.sin(dog.phase)*0.7 : 0; legs[0].rotation.x = legs[3].rotation.x = sw; legs[1].rotation.x = legs[2].rotation.x = -sw; tail.rotation.z = Math.sin(performance.now()*0.012)*0.5; tail.rotation.x = -0.5;
  g.position.set(dog.x, dog.y, dog.z); g.rotation.y = dog.rot;
}
late('updateDog', () => updateDog);
late('dog', () => dog);

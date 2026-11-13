/* PORTAL: las llaves escondidas y el paso entre la granja y el Reino de Piedra */
import { track } from './analytics.js';
import * as THREE from 'three';
import { DEBUG, GS, LATE } from './state.js';
import { $ } from './util.js';
import { B } from './blocks.js';
import { castleTheme, farmTheme } from './atlas.js';
import { chunks, dirty, getB, KEYROOM, loadWorld, RETURN, saveWorld, SPAWN, topY } from './world.js';
import { buildChunk, scene, spawnP, TEX } from './render.js';
import { sndFanfare } from './audio.js';
import { writeSave } from './save.js';
import { player } from './player.js';
import { relocatePlats } from './platforms.js';
import { cows } from './cows.js';
import { HOTBAR } from './actions.js';
import { state, toast, updateCounter } from './ui.js';
import { onWorldChange, setSkyTheme } from './adventure.js';

function makeKey(c1, c2){ const g = new THREE.Group(), m1 = new THREE.MeshBasicMaterial({ color:c1 }), m2 = new THREE.MeshBasicMaterial({ color:c2 });
  const kb = (w, h, d, x, y, m = m1) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, 0); g.add(b); };
  kb(0.36, 0.08, 0.08, 0, 0.5); kb(0.36, 0.08, 0.08, 0, 0.22); kb(0.08, 0.36, 0.08, -0.14, 0.36); kb(0.08, 0.36, 0.08, 0.14, 0.36);   // argolla
  kb(0.08, 0.5, 0.08, 0, -0.05, m2); kb(0.16, 0.07, 0.08, 0.1, -0.2); kb(0.12, 0.07, 0.08, 0.08, -0.05);                              // caña y dientes
  scene.add(g); return g; }
/* llave dorada: en la casa enterrada de la granja. Llave plateada: en la casita de piedra del reino, para volver */
const goldKey = makeKey(0xffd24a, 0xc8922a), silverKey = makeKey(0xcfe6ff, 0x7fa6d8); silverKey.visible = false;
const K1 = { x:KEYROOM.x + 0.5, y:KEYROOM.y + 0.9, z:KEYROOM.z + 0.5 }, K2 = { x:RETURN.x + 0.5, y:0, z:RETURN.z + 0.5 };
goldKey.position.set(K1.x, K1.y, K1.z);
let armed = true;

function flash(){ const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
/* cambia de mapa conservando lo que hiciste en cada uno */
export function setWorld(w, live){
  if (GS.world === w) return; const from = GS.world, first = w === 2 && !GS.visited2;
  saveWorld(from); GS.world = w; if (w === 2) castleTheme(); else farmTheme();
  loadWorld(w); for (let i = 0; i < chunks.length; i++) buildChunk(i); dirty.clear();
  relocatePlats();
  if (w === 2 && !HOTBAR.includes(B.ROYAL)) HOTBAR.push(B.ROYAL); LATE.syncHotbar();
  cows.forEach(c => { c.group.visible = c.w === w; if (!c.homed && c.p.placed){ c.homed = true; c.x = c.p.center.x; c.z = c.p.center.z; c.gy = c.y = c.p.H; } });   // una vaca cargada antes de visitar su mapa se ubica al llegar
  setSkyTheme(w); onWorldChange(from, w, live);
  // llegas junto a la casa por la que cruzaste
  const [ax, az] = w === 2 ? [SPAWN.x, SPAWN.z] : [KEYROOM.x + 3.5, KEYROOM.z + 0.5];
  player.x = ax; player.z = az; player.y = topY(Math.floor(ax), Math.floor(az)) + 0.01; player.vx = player.vy = player.vz = 0; player.yaw = w === 2 ? 0 : Math.PI/2; player.pitch = 0.05;
  if (w === 2){ let y = 1; while (y < 30 && !(getB(RETURN.x, y - 1, RETURN.z) && !getB(RETURN.x, y, RETURN.z))) y++; K2.y = y + 0.9; }   // la llave flota sobre el piso de la casita, bajo su techo
  silverKey.position.set(K2.x, K2.y, K2.z); goldKey.visible = w === 1; silverKey.visible = w === 2; armed = false; updateCounter();
  if (live){ track('portal_cruzado', { destino: w === 2 ? 'reino' : 'granja', primera_vez: first }); flash(); sndFanfare();
    toast(w === 2 ? (first ? '¡Encontraste la llave! Bienvenido al Reino de Piedra, donde vive la Vaca Real. Para volver, entra a la casita de piedra que tienes detrás.' : 'De vuelta en el Reino de Piedra.') : 'Volviste a la granja.'); writeSave(); }
}
export function updatePortal(dt){
  const w = GS.world, key = w === 1 ? goldKey : silverKey, K = w === 1 ? K1 : K2;
  key.rotation.y += dt*2.2; key.position.y = K.y + Math.sin(performance.now()/400)*0.08;
  const d = Math.hypot(player.x - K.x, player.z - K.z), d3 = Math.hypot(d, player.y + 0.9 - K.y);
  if (d < 6 && Math.random() < dt*6) spawnP(TEX.spark, K.x + (Math.random() - 0.5)*0.8, K.y + (Math.random() - 0.5)*0.8, K.z + (Math.random() - 0.5)*0.8, 0, 0.4, 0, 0.7, 0.18, w === 1 ? 0xffe27a : 0xcfe6ff);
  if (!armed){ if (d3 > 2.2) armed = true; return; }   // tras cruzar hay que alejarse antes de que la llave vuelva a funcionar
  if (d < 1.0 && Math.abs(player.y + 0.9 - K.y) < 1.8) setWorld(w === 1 ? 2 : 1, true);
}
if (DEBUG) document.addEventListener('keydown', e => { if (e.code === 'KeyO' && state === 'play') setWorld(GS.world === 1 ? 2 : 1, true); });   // atajo de debug entre mapas

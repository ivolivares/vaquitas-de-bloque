/* PORTAL: la llave escondida y el paso al segundo mapa, el Reino de Piedra */
import * as THREE from 'three';
import { DEBUG, GS, LATE } from './state.js';
import { $ } from './util.js';
import { B } from './blocks.js';
import { castleTheme } from './atlas.js';
import { chunks, dirty, generateWorld, hmap, KEYROOM, SPAWN } from './world.js';
import { buildChunk, scene, spawnP, TEX } from './render.js';
import { sndFanfare } from './audio.js';
import { writeSave } from './save.js';
import { player } from './player.js';
import { relocatePlats } from './platforms.js';
import { cows } from './cows.js';
import { HOTBAR } from './actions.js';
import { state, toast, updateCounter } from './ui.js';
import { applyDifficulty, clearAdventure, setSkyTheme, startTruce } from './adventure.js';

const TRUCE = 180;
/* la llave: dorada, girando dentro de la casa enterrada */
const keyGroup = new THREE.Group(), gold = new THREE.MeshBasicMaterial({ color:0xffd24a }), dark = new THREE.MeshBasicMaterial({ color:0xc8922a });
const kb = (w, h, d, x, y, m = gold) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, 0); keyGroup.add(b); };
kb(0.36, 0.08, 0.08, 0, 0.5); kb(0.36, 0.08, 0.08, 0, 0.22); kb(0.08, 0.36, 0.08, -0.14, 0.36); kb(0.08, 0.36, 0.08, 0.14, 0.36);   // argolla
kb(0.08, 0.5, 0.08, 0, -0.05, dark); kb(0.16, 0.07, 0.08, 0.1, -0.2); kb(0.12, 0.07, 0.08, 0.08, -0.05);                              // caña y dientes
const KEY = { x:KEYROOM.x + 0.5, y:KEYROOM.y + 0.9, z:KEYROOM.z + 0.5 }; keyGroup.position.set(KEY.x, KEY.y, KEY.z); scene.add(keyGroup);

function flash(){ const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
/* cambia de mapa: regenera el terreno, reubica plataformas y vacas, y ajusta tema, cielo, hotbar y dificultad */
export function setWorld(w, live){
  if (GS.world === w) return; clearAdventure(); GS.world = w;
  if (w === 2) castleTheme();
  generateWorld(w); for (let i = 0; i < chunks.length; i++) buildChunk(i); dirty.clear();
  relocatePlats();
  if (w === 2 && !HOTBAR.includes(B.ROYAL)) HOTBAR.push(B.ROYAL); LATE.syncHotbar();
  cows.forEach(c => { c.held = false; c.holder = null; c.corral = null; c.x = c.p.center.x; c.z = c.p.center.z; c.gy = c.y = c.p.H; c.state = 'idle'; c.t = 2; });
  setSkyTheme(w); applyDifficulty();
  player.x = SPAWN.x; player.z = SPAWN.z; player.y = hmap[Math.floor(SPAWN.x) + Math.floor(SPAWN.z)*64] + 0.01; player.vx = player.vy = player.vz = 0; player.yaw = 0; player.pitch = 0.05;
  keyGroup.visible = w === 1; updateCounter();
  if (live){ flash(); sndFanfare(); const adv = GS.mode === 'aventura' && !GS.prizeUnlocked; if (adv) startTruce(TRUCE);
    toast('¡Encontraste la llave! Bienvenido al Reino de Piedra.' + (adv ? ' Los cuatreros te dan 3 minutos de tregua.' : '') + ' Aquí vive la Vaca Real.'); writeSave(); }
}
export function updatePortal(dt){
  if (GS.world !== 1) return; keyGroup.rotation.y += dt*2.2; keyGroup.position.y = KEY.y + Math.sin(performance.now()/400)*0.08;
  const d = Math.hypot(player.x - KEY.x, player.z - KEY.z);
  if (d < 6 && Math.random() < dt*6) spawnP(TEX.spark, KEY.x + (Math.random() - 0.5)*0.8, KEY.y + (Math.random() - 0.5)*0.8, KEY.z + (Math.random() - 0.5)*0.8, 0, 0.4, 0, 0.7, 0.18, 0xffe27a);
  if (d < 1.0 && player.y < KEYROOM.y + 2.5 && player.y > KEYROOM.y - 1.5) setWorld(2, true);
}
if (DEBUG) document.addEventListener('keydown', e => { if (e.code === 'KeyO' && state === 'play') setWorld(2, true); });   // atajo de debug al segundo mapa

/* INICIO: cargar progreso y bucle principal */
import './style.css';
import './state.js';
import './util.js';
import './blocks.js';
import './atlas.js';
import './world.js';
import './render.js';
import './audio.js';
import './save.js';
import './player.js';
import './platforms.js';
import './cows.js';
import './actions.js';
import './prize.js';
import './ui.js';
import './debug.js';
import * as adv from './adventure.js';
import { collideCharacters, refreshModeUI, updateAdventure } from './adventure.js';
import { musicInfo, refreshMusicUI } from './music.js';
import { LATE } from './state.js';
import { bkey, placed } from './world.js';
import './touch.js';
import './share.js';
import './records.js';
import { setWorld, updatePortal } from './portal.js';
import { DEBUG, GS } from './state.js';
import { $ } from './util.js';
import { dirty, getB, hmap, isProtected, setB } from './world.js';
import { buildChunk, camera, chunkMesh, clouds, renderer, scene, sky, updateParticles } from './render.js';
import { setMuted } from './audio.js';
import { loadSave } from './save.js';
import { aim, dirV, eyeV, keys, player, raycastGrid, syncCamera, updatePlayer } from './player.js';
import { badMat, evalPlatform, ghostMat, markDone, okMat, plats, registerCells, updatePlatAnim, setTemplate } from './platforms.js';
import { cows, spawnCow, updateCow } from './cows.js';
import { actBreak, actPlace, debugComplete, updateTarget, HOTBAR } from './actions.js';
import { buildPlush, orbit, prizeCam, prizeScene } from './prize.js';
import { enterPrize, selectSlot, setState, showWin, state, updateCounter } from './ui.js';
import { debugFlags, updateDebug } from './debug.js';

setTemplate('base');
(function restore(){ const s = loadSave();
  if (s && s.world === 2) setWorld(2, false);
  if (s){ GS.crown = !!s.crown; plats.forEach((p, i) => { if (s.cows[i]){ p.time = (s.times && typeof s.times[i] === 'number') ? s.times[i] : null; markDone(p); spawnCow(p); } }); GS.prizeUnlocked = !!s.prize || plats.slice(0, 3).every(p => p.done); GS.muted = !!s.mute; if (s.mode === 'libre' || s.mode === 'aventura') GS.mode = s.mode; if (['facil', 'dificil', 'legendario'].includes(s.diff)) GS.diff = s.diff; GS.musicOn = s.music !== false; GS.totalTime = typeof s.total === 'number' ? s.total : null; if (typeof s.t === 'number') GS.playTime = s.t; }
  plats.forEach(p => evalPlatform(p, null)); GS.saveReady = true; updateCounter(); setMuted(GS.muted); adv.applyDifficulty(); refreshMusicUI(); setState('start'); })();
syncCamera();
export let last = performance.now(), fpsAcc = 0, fpsN = 0;
export function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last)/1000)); last = now;   // tope de 0.05 s
  updateDebug(dt);
  if (state === 'prize'){ orbit.update(); renderer.render(prizeScene, prizeCam); return; }
  if (state === 'play'){
    GS.playTime += dt; updatePlayer(dt); for (const c of cows) if (c.w === GS.world) updateCow(c, dt); for (const p of plats) if (p.anim) updatePlatAnim(p, dt); updateParticles(dt); updateAdventure(dt); updatePortal(dt); collideCharacters(); updateTarget();
    if (GS.winAt != null && GS.playTime >= GS.winAt){ GS.winAt = null; showWin(); }
    if (DEBUG){ fpsAcc += dt; fpsN++; if (fpsAcc >= 0.5){ $('fps').textContent = Math.round(fpsN/fpsAcc) + ' fps'; fpsAcc = 0; fpsN = 0; } }
  }
  if (dirty.size){ for (const ci of dirty) buildChunk(ci); dirty.clear(); }
  const tt = now/1000; ghostMat.opacity = 0.66 + Math.sin(tt*3)*0.12; okMat.opacity = 0.26 + Math.sin(tt*4)*0.1; badMat.opacity = (Math.sin(tt*11) > 0) ? 0.62 : 0.08;
  clouds.children.forEach(c => { c.position.x += dt*0.6; if (c.position.x > 150) c.position.x = -90; });
  syncCamera(); sky.position.copy(camera.position); renderer.render(scene, camera);
}
requestAnimationFrame(frame);

if (DEBUG) window.__vq = { GS, adv, placed, bkey, setWorld, HOTBAR, musicInfo, shareInfo: LATE.shareInfo, flags: debugFlags, player, plats, cows, keys, getB, setB, actBreak, actPlace, debugComplete, enterPrize, selectSlot, raycastGrid, aim, eyeV, dirV, hmap, isProtected, buildPlush, renderer, chunkMesh, get state(){ return state; }, get playTime(){ return GS.playTime; }, get prizeUnlocked(){ return GS.prizeUnlocked; } };

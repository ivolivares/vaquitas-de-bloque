/* UI: HUD, menús, estados y entrada */
import { track } from './analytics.js';
import { LATE } from './state.js';
import { DEBUG, GS, late } from './state.js';
import { $, clamp, fmtTime, mkCanvas, rgb } from './util.js';
import { BLOCK_NAME } from './blocks.js';
import { BLOCK_TILES, tileCanvas } from './atlas.js';
import { camera, renderer } from './render.js';
import { initAudio, setMuted, sndFanfare } from './audio.js';
import { resetSave } from './save.js';
import { keys, player } from './player.js';
import { plats } from './platforms.js';
import { actBreak, actPlace, debugComplete, HOTBAR } from './actions.js';
import { bestEdition, buildPlush, EDITIONS, orbit, plushEdition, prizeCam } from './prize.js';

export let state = 'start', noLock = false, toastTimer = null;
export const canvas = renderer.domElement;
export function toast(msg){ const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2600); }
export function setState(s){ state = s; document.body.dataset.state = s; $('start').classList.toggle('hidden', s !== 'start'); $('pause').classList.toggle('hidden', s !== 'pause'); $('win').classList.toggle('hidden', s !== 'win'); $('prizeUI').classList.toggle('hidden', s !== 'prize'); $('hud').classList.toggle('hidden', s !== 'play'); $('btnPrizePause').classList.toggle('hidden', !GS.prizeUnlocked); orbit.enabled = s === 'prize'; if (s !== 'play') for (const k in keys) keys[k] = false; }
export function lockFail(){ if (document.pointerLockElement === canvas) return; noLock = true; setState('play'); toast('No pude capturar el mouse: usa las flechas para mirar.'); }
export function lock(){ initAudio();
  if (GS.touch){ const first = state === 'start'; noLock = true; setState('play'); if (first) toast('Sigue los haces de luz y construye las vacas.'); return; }   // en pantallas táctiles no hay captura de mouse
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(lockFail); } catch (e){ lockFail(); } }
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement === canvas){ noLock = false; const first = state === 'start'; setState('play'); if (first) toast('Sigue los haces de luz y construye las vacas.'); } else if (state === 'play' && !noLock) setState('pause'); });
document.addEventListener('pointerlockerror', lockFail);
/* hotbar con íconos generados desde el atlas */
export function syncHotbar(){ const hb = $('hotbar');
  while (hb.children.length < HOTBAR.length){ const d = document.createElement('div'); d.className = 'slot'; d.append(document.createElement('span'), mkCanvas(16, 16)); hb.append(d); }
  [...hb.children].forEach((el, i) => { const g = el.querySelector('canvas').getContext('2d'); g.clearRect(0, 0, 16, 16); g.drawImage(tileCanvas[BLOCK_TILES[HOTBAR[i]][2]], 0, 0); el.querySelector('span').textContent = (i + 1) % 10; }); }
syncHotbar();
export function selectSlot(i){ const n = HOTBAR.length; GS.slot = (i + n) % n; [...$('hotbar').children].forEach((el, k) => el.classList.toggle('sel', k === GS.slot)); $('slotname').textContent = BLOCK_NAME[HOTBAR[GS.slot]]; }
selectSlot(3);
/* contador con 3 siluetas */
export const SIL = ['...........#.#', '..########.###', '.#############', '#.############', '#.##########..', '..##########..', '..##......##..', '..##......##..', '..##......##..'];
export const silCanvas = [];
export function updateCounter(){ while (silCanvas.length < plats.length){ const c = mkCanvas(14, 9); $('counter').append(c); silCanvas.push(c); }
  plats.forEach((p, i) => { const g = silCanvas[i].getContext('2d'); g.clearRect(0, 0, 14, 9); for (let y = 0; y < 9; y++) for (let x = 0; x < 14; x++){ if (SIL[y][x] !== '#') continue; let c = [176,160,128];
      if (p.done){ c = p.V.colA; if (i === 0 && x >= 5 && x <= 7 && y >= 1 && y <= 5) c = p.V.colB; if (i === 1 && (y >= 6 || (x >= 10 && y <= 1))) c = p.V.colB; if (i === 2 && ((x === 3 || x === 4) && y >= 2 && y <= 3 || (x >= 7 && x <= 8 && y >= 3 && y <= 4))) c = p.V.colB; if (i === 3 && y >= 1 && y <= 3 && x >= 3 && x <= 9) c = p.V.colB; }
      g.fillStyle = rgb(c); g.fillRect(x, y, 1, 1); } });
  $('countTxt').textContent = 'Vacas ' + plats.slice(0, 3).filter(p => p.done).length + '/3' + (plats[3] && plats[3].done ? ' +👑' : ''); }
export function timesText(){ return plats.filter(p => p.done && p.time != null).map(p => p.V.name + ': ' + (p.time >= 999 ? '—' : fmtTime(p.time))).join(' · ') + (GS.totalTime != null ? ' · Total: ' + fmtTime(GS.totalTime) : ''); }
export function showWin(){ setState('win'); if (document.pointerLockElement) document.exitPointerLock(); sndFanfare(); $('winTimes').textContent = timesText() + (GS.newRecord ? ' · 🏆 ¡Nuevo récord!' : ''); $('winHint').classList.toggle('hidden', GS.world !== 1); confetti(); if (LATE.refreshShare) LATE.refreshShare(); }
export function confetti(){ const box = $('confetti'), cols = ['#f08a24', '#58a83a', '#f6d04a', '#e2557a', '#6aa8f0', '#b98af0', '#ffffff']; for (let i = 0; i < 90; i++){ const e = document.createElement('i'); e.style.left = Math.random()*100 + 'vw'; e.style.background = cols[i % cols.length]; e.style.animationDuration = 2.2 + Math.random()*2.2 + 's'; e.style.animationDelay = Math.random()*1.2 + 's'; e.style.width = e.style.height = 8 + Math.random()*8 + 'px'; box.append(e); } setTimeout(() => { box.innerHTML = ''; }, 6500); }
export function enterPrize(){ const ed = bestEdition(); track('premio_visto', { edicion: ed, corona: !!GS.crown }); buildPlush(ed); const b = plats.find(p => p.V.key === ed);
  $('prizeSub').textContent = EDITIONS[ed].label + (ed === 'real' ? ' · armaste la Vaca Real' : b ? ' · tu vaca más rápida fue la ' + b.V.name : '') + (GS.crown ? ' · con corona de legendario' : ''); $('prizeTimes').textContent = timesText();
  prizeCam.position.set(3.9, 2.6, 5.4); orbit.target.set(0, 1.3, 0.15); orbit.autoRotate = true; setState('prize'); if (document.pointerLockElement) document.exitPointerLock(); if (LATE.refreshShare) LATE.refreshShare(); }
$('btnResume').onclick = lock; $('btnKeep').onclick = lock;
$('btnPrizeWin').onclick = enterPrize; $('btnPrizePause').onclick = enterPrize;
$('btnBack').onclick = () => { setState('pause'); lock(); };
$('btnMute').onclick = () => { initAudio(); setMuted(!GS.muted); };
$('btnReset').onclick = () => { resetSave(); GS.saveReady = false; try { location.reload(); } catch (e){} };
document.addEventListener('keydown', e => {
  if (state === 'play'){ keys[e.code] = true; if (e.code.startsWith('Digit')){ const n = +e.code.slice(5); if (n >= 1 && n <= 9) selectSlot(n - 1); else if (n === 0 && HOTBAR.length > 9) selectSlot(9); }
    if (e.code === 'KeyK' && DEBUG) debugComplete();
    if ((e.code === 'Escape' || e.code === 'KeyP') && (noLock || e.code === 'KeyP')){ if (document.pointerLockElement) document.exitPointerLock(); setState('pause'); }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault(); }
  if (e.code === 'KeyM' && state !== 'start'){ initAudio(); setMuted(!GS.muted); }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('mousemove', e => { if (state !== 'play' || document.pointerLockElement !== canvas) return; player.yaw -= e.movementX*0.0023; player.pitch = clamp(player.pitch - e.movementY*0.0023, -1.55, 1.55); });
canvas.addEventListener('mousedown', e => { if (state !== 'play' || GS.touch) return; initAudio(); if (e.button === 0) actBreak(); else if (e.button === 2) actPlace(); });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('wheel', e => { if (state === 'play') selectSlot(GS.slot + (e.deltaY > 0 ? 1 : -1)); }, { passive:true });
window.addEventListener('resize', () => { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h); camera.aspect = prizeCam.aspect = w/h; camera.updateProjectionMatrix(); prizeCam.updateProjectionMatrix(); });

/* enlaces tardíos */
late('toast', () => toast);
late('updateCounter', () => updateCounter);
late('syncHotbar', () => syncHotbar);

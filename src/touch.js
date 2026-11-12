/* CONTROLES TÁCTILES: joystick, arrastrar para mirar y botones de acción */
import { GS } from './state.js';
import { $, clamp } from './util.js';
import { renderer } from './render.js';
import { initAudio } from './audio.js';
import { keys, player } from './player.js';
import { actBreak, actPlace } from './actions.js';
import { selectSlot, setState, state } from './ui.js';

function setTouch(on){ if (GS.touch === on) return; GS.touch = on; document.body.dataset.touch = on ? '1' : '0'; if (on) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); else { GS.joyF = GS.joyS = 0; } }
try { if (window.matchMedia('(pointer: coarse)').matches) setTouch(true); } catch (e){}
/* el último tipo de puntero manda: sirve en equipos con pantalla táctil y mouse */
window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') setTouch(true); else if (e.pointerType === 'mouse') setTouch(false); }, true);

/* joystick */
const joy = $('joy'), knob = $('joyKnob'); let joyId = null;
function joyMove(e){ const r = joy.getBoundingClientRect(), R = r.width/2; let dx = (e.clientX - r.left - R)/R, dy = (e.clientY - r.top - R)/R; const l = Math.hypot(dx, dy); if (l > 1){ dx /= l; dy /= l; }
  GS.joyS = Math.abs(dx) < 0.12 ? 0 : dx; GS.joyF = Math.abs(dy) < 0.12 ? 0 : -dy; knob.style.transform = 'translate(' + dx*R*0.62 + 'px,' + dy*R*0.62 + 'px)'; }
function joyEnd(e){ if (e.pointerId !== joyId) return; joyId = null; GS.joyF = GS.joyS = 0; knob.style.transform = ''; }
joy.addEventListener('pointerdown', e => { e.preventDefault(); joyId = e.pointerId; try { joy.setPointerCapture(e.pointerId); } catch (err){} joyMove(e); });
joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);

/* mirar: arrastrar sobre el mundo */
const canvas = renderer.domElement; let lookId = null, lx = 0, ly = 0;
canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch' || state !== 'play') return; lookId = e.pointerId; lx = e.clientX; ly = e.clientY; });
canvas.addEventListener('pointermove', e => { if (e.pointerId !== lookId || state !== 'play') return; player.yaw -= (e.clientX - lx)*0.0055; player.pitch = clamp(player.pitch - (e.clientY - ly)*0.0055, -1.55, 1.55); lx = e.clientX; ly = e.clientY; });
const lookEnd = e => { if (e.pointerId === lookId) lookId = null; };
canvas.addEventListener('pointerup', lookEnd); canvas.addEventListener('pointercancel', lookEnd);

/* botones; Romper se repite si lo mantienes apretado */
function hold(el, fn, every){ let iv = null; const stop = () => { clearInterval(iv); iv = null; };
  el.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); if (state !== 'play') return; fn(); if (every){ stop(); iv = setInterval(() => { if (state === 'play') fn(); else stop(); }, every); } });
  el.addEventListener('pointerup', stop); el.addEventListener('pointercancel', stop); el.addEventListener('pointerleave', stop); }
hold($('tBreak'), actBreak, 280); hold($('tPlace'), actPlace, 0);
const jump = $('tJump'); jump.addEventListener('pointerdown', e => { e.preventDefault(); keys.Space = true; }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => jump.addEventListener(n, () => { keys.Space = false; }));
$('tPause').addEventListener('pointerdown', e => { e.preventDefault(); GS.joyF = GS.joyS = 0; setState('pause'); });
[...$('hotbar').children].forEach((el, i) => el.addEventListener('pointerdown', e => { if (e.pointerType === 'touch'){ e.preventDefault(); selectSlot(i); } }));
document.addEventListener('gesturestart', e => e.preventDefault());

/* pantalla completa: automática al empezar en táctil (donde el navegador lo permite) y opcional desde la pausa */
const root = document.documentElement, reqFS = root.requestFullscreen || root.webkitRequestFullscreen, exitFS = document.exitFullscreen || document.webkitExitFullscreen;
const canFS = !!reqFS && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
let wantFS = true;
function goFS(on){ try {
  if (on && !isFS()){ const p = reqFS.call(root, { navigationUI:'hide' }); const lockIt = () => { try { const q = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (q && q.catch) q.catch(() => {}); } catch (e){} }; if (p && p.then) p.then(lockIt).catch(() => {}); else lockIt(); }
  else if (!on && isFS()) exitFS.call(document);
} catch (e){} }
function refreshFS(){ $('btnFS').textContent = 'Pantalla completa: ' + (isFS() ? 'sí' : 'no'); }
if (canFS){
  $('btnFS').classList.remove('hidden'); $('btnFS').onclick = () => { wantFS = !isFS(); goFS(wantFS); };
  document.addEventListener('fullscreenchange', refreshFS); document.addEventListener('webkitfullscreenchange', refreshFS);
  ['btnStart', 'btnPlay', 'btnStartFree', 'btnResume'].forEach(id => $(id).addEventListener('click', () => { if (GS.touch && wantFS) goFS(true); }));
}
export function fsInfo(){ return { soportado: canFS, activo: isFS(), deseado: wantFS }; }
/* iPhone: Safari no permite pantalla completa a las páginas; la alternativa es abrir el juego desde la pantalla de inicio */
try { const standalone = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches;
  if (!canFS && /iPhone|iPod/.test(navigator.userAgent) && !standalone) $('iosTip').classList.remove('hidden'); } catch (e){}

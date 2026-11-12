/* DEBUG: panel de condiciones (solo con DEBUG = true; F3 lo muestra u oculta) */
import { DEBUG, GS } from './state.js';
import { $, fmtTime } from './util.js';
import { BLOCK_NAME } from './blocks.js';
import { getB } from './world.js';
import { actx } from './audio.js';
import { SAVE_KEY } from './save.js';
import { plats } from './platforms.js';
import { cows } from './cows.js';
import { HOTBAR } from './actions.js';
import { bestEdition, plushEdition } from './prize.js';
import { canvas, noLock, state } from './ui.js';

export let dbgOn = DEBUG, dbgAcc = 1;
export function debugFlags(){
  const vacas = plats.map((p, i) => { let ok = 0, bad = 0; if (!p.done) for (const c of p.cells){ const b = getB(c.x, c.y, c.z); if (b === c.mat) ok++; else if (b !== 0) bad++; }
    return { n:i + 1, nombre:p.V.name, completada:p.done, celdasCorrectas:p.done ? 14 : ok, celdasEquivocadas:bad, cronometroIniciado:p.startT != null, cronometro:(!p.done && p.startT != null) ? GS.playTime - p.startT : null, tiempoFinal:p.time, animando:!!p.anim, vacaViva:cows.some(c => c.p === p) }; });
  let guardado; try { guardado = localStorage.getItem(SAVE_KEY); } catch (e){ guardado = 'ERROR: ' + e.message; }
  return { estado:state, mouseCapturado:document.pointerLockElement === canvas, modoSinCaptura:noLock, vacas, vacasCompletadas:plats.filter(p => p.done).length, premioDesbloqueado:GS.prizeUnlocked,
    botonPremioPausa:!$('btnPrizePause').classList.contains('hidden'), pantallaVictoria:state === 'win', celebracionEn:GS.winAt != null ? GS.winAt - playTime : null, edicionPeluche:bestEdition(), pelucheConstruido:plushEdition,
    tiempoJugado:GS.playTime, slot:GS.slot + 1, material:BLOCK_NAME[HOTBAR[GS.slot]], silenciado:GS.muted, audio:actx ? actx.state : 'sin iniciar', guardadoListo:GS.saveReady, guardado };
}
export function updateDebug(dt){
  if (!DEBUG || !dbgOn) return; dbgAcc += dt; if (dbgAcc < 0.2) return; dbgAcc = 0;
  const f = debugFlags(), yn = (v, a = 'SÍ', b = 'no') => v ? '<span class="on">' + a + '</span>' : '<span class="off">' + b + '</span>';
  let h = '<b>DEBUG</b> (F3 oculta · K completa la plataforma más cercana)\n';
  h += 'estado: <b>' + f.estado + '</b>   mouse capturado: ' + yn(f.mouseCapturado) + (f.modoSinCaptura ? '  <span class="warn">modo flechas</span>' : '') + '   t=' + fmtTime(f.tiempoJugado) + '\n';
  f.vacas.forEach(v => { h += 'Vaquita ' + v.n + ' (' + v.nombre.replace('Vaca ', '') + '): ' + yn(v.completada, 'COMPLETADA', 'pendiente') + '  celdas ' + v.celdasCorrectas + '/14' + (v.celdasEquivocadas ? ' <span class="warn">(' + v.celdasEquivocadas + ' mal)</span>' : '')
    + '  crono: ' + (v.completada ? (v.tiempoFinal == null ? 's/d' : v.tiempoFinal >= 999 ? 'K (999)' : fmtTime(v.tiempoFinal)) : v.cronometroIniciado ? '<span class="on">' + fmtTime(v.cronometro) + '…</span>' : '<span class="off">sin iniciar</span>')
    + (v.animando ? '  <span class="on">animando</span>' : '') + '  vaca viva: ' + yn(v.vacaViva) + '\n'; });
  h += 'vacas completadas: <b>' + f.vacasCompletadas + '/3</b>\n';
  h += 'premio desbloqueado: ' + yn(f.premioDesbloqueado) + '\n';
  h += 'botón "Ver mi premio" (pausa): ' + yn(f.botonPremioPausa, 'ENCENDIDO', 'apagado') + '\n';
  h += 'pantalla de victoria: ' + yn(f.pantallaVictoria, 'VISIBLE', 'oculta') + '   celebración pendiente: ' + (f.celebracionEn != null ? '<span class="on">en ' + f.celebracionEn.toFixed(1) + ' s</span>' : '<span class="off">no</span>') + '\n';
  h += 'edición del peluche: <b>' + f.edicionPeluche + '</b>' + (f.pelucheConstruido ? ' (construido: ' + f.pelucheConstruido + ')' : '') + '\n';
  h += 'sonido: ' + (f.silenciado ? '<span class="warn">silenciado</span>' : '<span class="on">activo</span>') + '  audio: ' + f.audio + '\n';
  h += 'guardado: ' + (f.guardado == null ? '<span class="off">vacío</span>' : String(f.guardado).startsWith('ERROR') ? '<span class="warn">' + f.guardado + '</span>' : f.guardado.replace(/</g, '&lt;'));
  $('dbg').innerHTML = h;
}
if (DEBUG){ $('dbg').classList.remove('hidden'); document.addEventListener('keydown', e => { if (e.code === 'F3'){ e.preventDefault(); dbgOn = !dbgOn; $('dbg').classList.toggle('hidden', !dbgOn); dbgAcc = 1; } }); }

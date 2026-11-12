/* RÉCORDS: mejor tiempo por dificultad, guardado en este dispositivo (aparte del progreso, para que "Reiniciar progreso" no los borre) */
import { GS, late } from './state.js';
import { $, fmtTime } from './util.js';
import { plats } from './platforms.js';

const KEY = 'vaquitas-de-bloque-records';
export function loadRecords(){ try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && typeof r === 'object') return r; } catch (e){} return {}; }
export const recordKey = () => GS.mode === 'aventura' ? GS.diff : 'libre';
/* registra el tiempo de la partida ganada; devuelve true si es récord. No cuentan las vacas completadas con la tecla de debug */
export function submitRecord(){
  const ts = plats.slice(0, 3).map(p => p.time); if (!ts.every(t => typeof t === 'number' && t < 999) || GS.totalTime == null) return false;
  const r = loadRecords(), k = recordKey(), t = Math.round(GS.totalTime); if (r[k] != null && r[k] <= t) return false;
  r[k] = t; try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e){} refreshRecords(); return true;
}
export function refreshRecords(){ const r = loadRecords();
  document.querySelectorAll('.diff').forEach(b => { let e = b.querySelector('.rec'); if (!e){ e = document.createElement('small'); e.className = 'rec'; b.append(e); } e.textContent = r[b.dataset.d] != null ? '🏆 Récord ' + fmtTime(r[b.dataset.d]) : ''; });
  $('recFree').textContent = r.libre != null ? '🏆 Récord ' + fmtTime(r.libre) : ''; }
refreshRecords();
late('submitRecord', () => submitRecord);

/* MOCHILA (modo libre): los bloques se descubren picándolos y se eligen para las 3 casillas de construcción */
import { track } from './analytics.js';
import { GS, late } from './state.js';
import { $, mkCanvas } from './util.js';
import { B, BLOCK_NAME } from './blocks.js';
import { BLOCK_TILES, tileCanvas } from './atlas.js';
import { sndPop } from './audio.js';
import { writeSave } from './save.js';
import { HOTBAR } from './actions.js';
import { lock, selectSlot, setState, state, syncHotbar, toast } from './ui.js';

const BASE = [B.DIRT, B.STONE, B.WOOD];
export const BAG = [B.DIRT, B.STONE, B.WOOD, B.GRASS, B.LOG, B.LEAVES, B.FLOWERS, B.SAND, B.HAY, B.PUMPKIN, B.QUARTZ, B.BRICK];
const CLUE = { [B.GRASS]:'Pica pasto', [B.LOG]:'Pica el tronco de un árbol', [B.LEAVES]:'Pica las hojas de un árbol', [B.FLOWERS]:'Busca flores en la pradera', [B.SAND]:'Busca arena en las zonas bajas',
  [B.HAY]:'Busca un fardo amarillo', [B.PUMPKIN]:'Busca algo naranja en el pasto', [B.QUARTZ]:'Brilla dentro de la piedra', [B.BRICK]:'Está en otro reino…' };
const free = () => GS.mode === 'libre';
export const has = id => BASE.includes(id) || GS.unlocked.includes(id);
let target = 0;

/* deja la barra según el modo: en aventura siempre tierra, piedra y madera (los inventarios van por casilla) */
export function applyHotbar(){
  GS.unlocked = (Array.isArray(GS.unlocked) ? GS.unlocked : []).filter((id, i, a) => BAG.includes(id) && !BASE.includes(id) && a.indexOf(id) === i);
  const ok = Array.isArray(GS.hot) && GS.hot.length === 3 && GS.hot.every((id, i, a) => BAG.includes(id) && has(id) && a.indexOf(id) === i); if (!ok) GS.hot = null;
  const pick = free() && GS.hot ? GS.hot : BASE; for (let i = 0; i < 3; i++) HOTBAR[i] = pick[i];
  document.body.dataset.mode = GS.mode; syncHotbar(); selectSlot(GS.slot); }
/* se llama al romper un bloque */
export function discover(id){ if (!free() || !BAG.includes(id) || has(id)) return;
  GS.unlocked.push(id); writeSave(); track('bloque_descubierto', { bloque: BLOCK_NAME[id], total: GS.unlocked.length });
  toast('¡Descubriste ' + BLOCK_NAME[id].toLowerCase() + '! ' + (GS.touch ? 'Toca la mochila para usarlo.' : 'Abre tu mochila con E para usarlo.')); $('bagBtn').classList.add('new'); }
function render(){
  $('bagCount').textContent = BAG.filter(has).length + ' de ' + BAG.length + ' bloques descubiertos';
  const sl = $('bagSlots'); sl.innerHTML = '';
  for (let i = 0; i < 3; i++){ const b = document.createElement('button'); b.className = 'bslot' + (i === target ? ' sel' : ''); const c = mkCanvas(16, 16); c.getContext('2d').drawImage(tileCanvas[BLOCK_TILES[HOTBAR[i]][2]], 0, 0); const s = document.createElement('span'); s.textContent = 'Casilla ' + (i + 1); b.append(c, s); b.onclick = () => { target = i; render(); }; sl.append(b); }
  const g = $('bagGrid'); g.innerHTML = '';
  for (const id of BAG){ const ok = has(id), b = document.createElement('button'); b.className = 'bitem' + (ok ? '' : ' locked') + (HOTBAR[target] === id ? ' cur' : ''); b.disabled = !ok;
    const c = mkCanvas(16, 16); c.getContext('2d').drawImage(tileCanvas[BLOCK_TILES[id][2]], 0, 0); const s = document.createElement('span'); s.textContent = ok ? BLOCK_NAME[id] : '???'; const h = document.createElement('small'); h.textContent = ok ? '' : CLUE[id];
    b.append(c, s, h); if (ok) b.onclick = () => choose(id); g.append(b); } }
function choose(id){ const other = HOTBAR.indexOf(id); if (other >= 0 && other < 3 && other !== target) HOTBAR[other] = HOTBAR[target];   // si ya estaba en otra casilla, se intercambian
  HOTBAR[target] = id; GS.hot = HOTBAR.slice(0, 3); GS.slot = target; applyHotbar(); writeSave(); sndPop(); closeBag(); }
export function openBag(){ if (!free() || state !== 'play') return; target = GS.slot < 3 ? GS.slot : 0; $('bagBtn').classList.remove('new'); render(); setState('bag'); if (document.pointerLockElement) document.exitPointerLock(); }
export function closeBag(){ if (state !== 'bag') return; setState('pause'); lock(); }
$('bagBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); openBag(); });
$('btnBagClose').onclick = closeBag;
document.addEventListener('keydown', e => { if (e.repeat) return; if (e.code === 'KeyE' && state === 'play') openBag(); else if ((e.code === 'KeyE' || e.code === 'Escape') && state === 'bag') closeBag(); });

late('discover', () => discover);
late('hasBlock', () => has);
late('applyHotbar', () => applyHotbar);

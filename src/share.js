/* COMPARTIR: enlaces a redes y foto del peluche */
import { GS, late } from './state.js';
import { $, fmtTime } from './util.js';
import { renderer } from './render.js';
import { bestEdition, EDITIONS, prizeCam, prizeScene } from './prize.js';

const SITE = 'https://vaquitas-de-bloque.vercel.app';
/* cada edición tiene su página con su propia imagen de vista previa */
function shareUrl(){ const ed = bestEdition(); return ed === 'clasico' ? SITE + '/' : SITE + '/premio/' + ed; }
function shareText(){ const ed = bestEdition(), t = GS.totalTime != null && GS.totalTime < 3600 ? ' en ' + fmtTime(GS.totalTime) : '';
  return '¡Armé las 3 vaquitas' + t + ' y gané el Ternerito Dorado' + (ed !== 'clasico' ? ', ' + EDITIONS[ed].label : '') + '! 🐄 ¿Puedes superarme?'; }
const NETS = [
  ['x', 'X', () => 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText()) + '&url=' + encodeURIComponent(shareUrl())],
  ['wa', 'WhatsApp', () => 'https://wa.me/?text=' + encodeURIComponent(shareText() + ' ' + shareUrl())],
  ['fb', 'Facebook', () => 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl())],   // Facebook y LinkedIn solo aceptan la URL
  ['li', 'LinkedIn', () => 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl())],
];
function savePhoto(){ try { renderer.render(prizeScene, prizeCam); const a = document.createElement('a'); a.href = renderer.domElement.toDataURL('image/png'); a.download = 'ternerito-dorado-' + bestEdition() + '.png'; document.body.append(a); a.click(); a.remove(); } catch (e){} }
function fill(id, withPhoto){ const box = $(id); box.innerHTML = '';
  NETS.forEach(([cls, label, url]) => { const b = document.createElement('button'); b.className = cls; b.textContent = label; b.onclick = () => window.open(url(), '_blank', 'noopener'); box.append(b); });
  if (withPhoto){ const b = document.createElement('button'); b.className = 'foto'; b.textContent = 'Guardar foto'; b.onclick = savePhoto; box.append(b); } }
export function refreshShare(){ fill('shareWin', false); fill('sharePrize', true); }
export function shareInfo(){ return { texto: shareText(), url: shareUrl(), enlaces: NETS.map(n => n[2]()) }; }
refreshShare();
late('refreshShare', () => refreshShare);
late('shareInfo', () => shareInfo);

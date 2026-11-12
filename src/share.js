/* COMPARTIR: enlaces a redes y foto del peluche */
import { GS, late } from './state.js';
import { $, fmtTime } from './util.js';
import { renderer } from './render.js';
import { plats } from './platforms.js';
import { bestEdition, EDITIONS, prizeCam, prizeScene } from './prize.js';
import { toast } from './ui.js';

const SITE = 'https://vaquitas-de-bloque.vercel.app';
/* cada edición tiene su página con su propia imagen de vista previa */
function shareUrl(){ const ed = bestEdition(); return ed === 'clasico' ? SITE + '/' : SITE + '/premio/' + ed; }
/* tiempo total; si la partida es de antes de que se guardara, suma los tiempos de las tres vacas */
function totalTime(){ if (GS.totalTime != null && GS.totalTime < 3600) return GS.totalTime; const ts = plats.slice(0, 3).map(p => p.time); return ts.every(t => typeof t === 'number' && t < 999) ? ts.reduce((a, b) => a + b, 0) : null; }
function shareText(emoji){ const ed = bestEdition(), t = totalTime();
  return '¡Armé las 3 vaquitas' + (t != null ? ' en ' + fmtTime(t) : '') + (GS.mode === 'aventura' && GS.diff !== 'facil' ? ' en modo ' + GS.diff : '') + ' y gané el Ternerito Dorado' + (ed !== 'clasico' ? ', ' + EDITIONS[ed].label : '') + '!' + (emoji ? ' 🐄' : '') + ' ¿Puedes superarme?'; }
const enc = encodeURIComponent;
/* X, WhatsApp y LinkedIn aceptan texto; Facebook solo la URL, así que ahí el texto se copia al portapapeles para pegarlo */
const NETS = [
  ['x', 'X', () => 'https://x.com/intent/post?text=' + enc(shareText(true) + ' ' + shareUrl())],
  ['wa', 'WhatsApp', () => 'https://api.whatsapp.com/send?text=' + enc(shareText(false) + ' ' + shareUrl())],   // sin emoji: el enlace de WhatsApp lo rompía
  ['fb', 'Facebook', () => 'https://www.facebook.com/sharer/sharer.php?u=' + enc(shareUrl()), true],
  ['li', 'LinkedIn', () => 'https://www.linkedin.com/feed/?shareActive=true&text=' + enc(shareText(true) + ' ' + shareUrl())],
];
function copyText(){ const txt = shareText(true) + ' ' + shareUrl(); try { if (navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(() => toast('Texto copiado: pégalo en tu publicación.'), () => {}); return true; } } catch (e){} return false; }
function savePhoto(){ try { renderer.render(prizeScene, prizeCam); const a = document.createElement('a'); a.href = renderer.domElement.toDataURL('image/png'); a.download = 'ternerito-dorado-' + bestEdition() + '.png'; document.body.append(a); a.click(); a.remove(); } catch (e){} }
function btn(box, cls, label, fn){ const b = document.createElement('button'); b.className = cls; b.textContent = label; b.onclick = fn; box.append(b); }
function fill(id, withPhoto){ const box = $(id); box.innerHTML = '';
  if (navigator.share) btn(box, 'foto', 'Compartir…', () => { navigator.share({ title:'Vaquitas de Bloque', text:shareText(true), url:shareUrl() }).catch(() => {}); });   // menú del sistema (teléfonos)
  NETS.forEach(([cls, label, url, copy]) => btn(box, cls, label, () => { if (copy) copyText(); window.open(url(), '_blank', 'noopener'); }));
  btn(box, 'foto', 'Copiar texto', copyText);
  if (withPhoto) btn(box, 'foto', 'Guardar foto', savePhoto); }
export function refreshShare(){ fill('shareWin', false); fill('sharePrize', true); }
export function shareInfo(){ return { texto: shareText(true), url: shareUrl(), enlaces: NETS.map(n => n[2]()) }; }
refreshShare();
late('refreshShare', () => refreshShare);
late('shareInfo', () => shareInfo);

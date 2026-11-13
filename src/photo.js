/* FOTO DE TU GRANJA: captura de lo que estás mirando, con marco, para guardar o compartir */
import { track } from './analytics.js';
import { GS } from './state.js';
import { $, mkCanvas } from './util.js';
import { camera, outline, renderer, scene } from './render.js';
import { plats } from './platforms.js';
import { state, toast } from './ui.js';

export function takePhoto(){ try {
  const ol = outline.visible; outline.visible = false; renderer.render(scene, camera); outline.visible = ol;
  const src = renderer.domElement, W = 1280, H = Math.round(W*src.height/src.width), BAND = 72, c = mkCanvas(W, H + BAND), g = c.getContext('2d');
  g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, W, H);
  g.fillStyle = '#5a3418'; g.fillRect(0, H, W, BAND); g.fillStyle = '#fff3d6'; g.fillRect(6, H + 6, W - 12, BAND - 12);
  const n = plats.filter(p => p.done).length; g.fillStyle = '#4a2a10'; g.textBaseline = 'middle'; g.font = 'bold 30px "Trebuchet MS",Verdana,sans-serif'; g.textAlign = 'left'; g.fillText('Mi granja en Vaquitas de Bloque' + (n ? ' · ' + n + (n === 1 ? ' vaca' : ' vacas') : ''), 26, H + BAND/2 + 1);
  g.font = 'bold 22px "Trebuchet MS",Verdana,sans-serif'; g.textAlign = 'right'; g.fillStyle = '#8a5a2a'; g.fillText('vaquitas-de-bloque.vercel.app', W - 26, H + BAND/2 + 1);
  track('foto_tomada', { vacas: n });
  c.toBlob(async blob => { if (!blob) return; const name = 'mi-granja-vaquitas.png';
    try { const file = new File([blob], name, { type:'image/png' }); if (GS.touch && navigator.canShare && navigator.canShare({ files:[file] })){ await navigator.share({ files:[file], title:'Mi granja en Vaquitas de Bloque' }); return; } } catch (e){ if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); toast('📷 ¡Foto guardada!'); }, 'image/png');
  const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
} catch (e){ toast('No pude sacar la foto.'); } }
$('btnPhoto').onclick = takePhoto;
document.addEventListener('keydown', e => { if (e.code === 'KeyF' && !e.repeat && state === 'play') takePhoto(); });

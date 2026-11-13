/* PREMIO: peluche "Ternerito Dorado" en un estudio aparte */
import { GS } from './state.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, mkCanvas, mul, mulberry32, rgb } from './util.js';
import { renderer } from './render.js';
import { plats } from './platforms.js';

export const prizeScene = new THREE.Scene(), prizeCam = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
prizeCam.position.set(3.9, 2.6, 5.4);
export const orbit = new OrbitControls(prizeCam, renderer.domElement); orbit.enabled = false; orbit.enableDamping = true; orbit.dampingFactor = 0.08; orbit.enablePan = false; orbit.minDistance = 2.6; orbit.maxDistance = 9; orbit.maxPolarAngle = Math.PI*0.53; orbit.minPolarAngle = 0.25; orbit.target.set(0, 1.3, 0.15); orbit.autoRotateSpeed = 1.4;
orbit.addEventListener('start', () => { orbit.autoRotate = false; });
export let plush = null, plushEdition = null;
export const EDITIONS = {
  faja:    { label:'Edición Faja', base:[52,48,58], alt:[246,238,222], stitch:[150,142,162], sheen:[170,170,200] },
  grenuda: { label:'Edición Greñuda', base:[200,108,46], alt:[240,194,114], stitch:[122,58,22], sheen:[255,200,150] },
  lunar:   { label:'Edición Lunar', base:[190,168,228], alt:[108,116,146], stitch:[128,104,178], sheen:[230,220,255] },
  real:    { label:'Edición Real', base:[246,238,220], alt:[122,62,168], stitch:[196,170,120], sheen:[255,246,225] },
  heno:    { label:'Edición Heno', base:[232,194,84], alt:[236,216,160], stitch:[150,104,40], sheen:[255,236,170] },
  zapallo: { label:'Edición Zapallo', base:[232,136,36], alt:[78,134,52], stitch:[150,76,18], sheen:[255,196,130] },
  cuarzo:  { label:'Edición Cuarzo', base:[222,206,244], alt:[166,142,116], stitch:[140,120,180], sheen:[250,244,255] },
  clasico: { label:'Edición Clásica', base:[250,236,206], alt:[232,178,58], stitch:[200,160,96], sheen:[255,246,220] },
};
export const GOLD = [234,180,58];
(function buildStudio(){
  const bg = mkCanvas(16, 256), g = bg.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#f7e3c8'); gr.addColorStop(0.55, '#fbeedd'); gr.addColorStop(1, '#f1d8b8'); g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
  const bt = new THREE.CanvasTexture(bg); bt.colorSpace = THREE.SRGBColorSpace; prizeScene.background = bt;
  const fc = mkCanvas(256, 256), fg = fc.getContext('2d'), rg = fg.createRadialGradient(128, 128, 10, 128, 128, 128); rg.addColorStop(0, 'rgba(255,246,230,1)'); rg.addColorStop(0.6, 'rgba(247,228,200,0.9)'); rg.addColorStop(1, 'rgba(241,216,184,0)'); fg.fillStyle = rg; fg.fillRect(0, 0, 256, 256);
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace; const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map:ft, transparent:true, depthWrite:false })); floor.rotation.x = -Math.PI/2; prizeScene.add(floor);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.65, 0.16, 48), new THREE.MeshStandardMaterial({ color:0xf6ead6, roughness:0.75 })); base.position.y = 0.08; prizeScene.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.035, 8, 64), new THREE.MeshStandardMaterial({ color:0xd9a441, roughness:0.35, metalness:0.7 })); ring.rotation.x = Math.PI/2; ring.position.y = 0.1; prizeScene.add(ring);
  // sombras de contacto (sobre el pedestal y bajo el pedestal)
  const sc = mkCanvas(128, 128), sg = sc.getContext('2d'), sr = sg.createRadialGradient(64, 64, 4, 64, 64, 64); sr.addColorStop(0, 'rgba(60,30,10,0.6)'); sr.addColorStop(0.55, 'rgba(60,30,10,0.25)'); sr.addColorStop(1, 'rgba(60,30,10,0)'); sg.fillStyle = sr; sg.fillRect(0, 0, 128, 128);
  const st = new THREE.CanvasTexture(sc), sm = new THREE.MeshBasicMaterial({ map:st, transparent:true, depthWrite:false });
  const s1 = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.9), sm); s1.rotation.x = -Math.PI/2; s1.position.set(0, 0.165, 0.1); prizeScene.add(s1);
  const s2 = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), sm); s2.rotation.x = -Math.PI/2; s2.position.y = 0.004; prizeScene.add(s2);
  prizeScene.add(new THREE.HemisphereLight(0xfff6ea, 0xcbb49a, 1.7));
  const key = new THREE.DirectionalLight(0xfffaf0, 2.3); key.position.set(3, 5, 4); prizeScene.add(key);
  const fill = new THREE.DirectionalLight(0xffe2c4, 0.9); fill.position.set(-4, 2, 2.5); prizeScene.add(fill);
  const rim = new THREE.DirectionalLight(0xd6e4ff, 1.5); rim.position.set(-1, 3.5, -5); prizeScene.add(rim);
})();
/* normalMap procedural: trama y ruido de fibra */
export const fiberNormal = (function(){ const S = 128, h = new Float32Array(S*S), r = mulberry32(99); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[x + y*S] = ((x + y) % 4 < 2 ? 0.3 : 0) + ((x - y + 400) % 6 < 3 ? 0.15 : 0) + r()*0.75;
  const c = mkCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++){ const dx = h[((x+1)%S) + y*S] - h[((x+S-1)%S) + y*S], dy = h[x + ((y+1)%S)*S] - h[x + ((y+S-1)%S)*S], l = Math.hypot(dx, dy, 1), i = (x + y*S)*4; img.data[i] = (-dx/l*0.5 + 0.5)*255; img.data[i+1] = (-dy/l*0.5 + 0.5)*255; img.data[i+2] = (1/l*0.5 + 0.5)*255; img.data[i+3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); return t; })();
/* textura de tela: color base con mota, parches bordados y costura punteada en los bordes */
export function fabricTex(base, stitch, draw, seed = 1){ const S = 256, c = mkCanvas(S, S), g = c.getContext('2d'); g.fillStyle = rgb(base); g.fillRect(0, 0, S, S);
  if (draw) draw(g, S);
  const img = g.getImageData(0, 0, S, S), r = mulberry32(seed*977 + 5); for (let i = 0; i < img.data.length; i += 4){ const n = (r() - 0.5)*20; img.data[i] = clamp(img.data[i] + n, 0, 255); img.data[i+1] = clamp(img.data[i+1] + n, 0, 255); img.data[i+2] = clamp(img.data[i+2] + n, 0, 255); } g.putImageData(img, 0, 0);
  g.setLineDash([13, 9]); g.lineWidth = 4; g.lineCap = 'round'; g.strokeStyle = rgb(stitch); g.strokeRect(11, 11, S - 22, S - 22); g.setLineDash([]);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
/* parche bordado con forma de bloques (lista de rectángulos en una grilla de 16) */
export function patch(g, cells, color, stitch){ const u = 16; g.fillStyle = rgb(color); cells.forEach(([x, y, w, h]) => g.fillRect(x*u, y*u, w*u, h*u)); g.setLineDash([7, 5]); g.lineWidth = 3; g.strokeStyle = rgb(stitch); cells.forEach(([x, y, w, h]) => g.strokeRect(x*u + 5, y*u + 5, w*u - 10, h*u - 10)); g.setLineDash([]); }
export function clothMat(tex, sheen, rough = 0.96){ return new THREE.MeshPhysicalMaterial({ map:tex, normalMap:fiberNormal, normalScale:new THREE.Vector2(0.55, 0.55), roughness:rough, metalness:0, sheen:1, sheenRoughness:0.5, sheenColor:new THREE.Color().setRGB(sheen[0]/255, sheen[1]/255, sheen[2]/255, THREE.SRGBColorSpace) }); }
export function embroideredEye(g, cx, cy){ for (let i = -15; i <= 15; i += 3){ const hh = 21*Math.sqrt(1 - (i*i)/(17*17)); g.strokeStyle = (i/3) % 2 ? '#2a1c18' : '#3a2822'; g.lineWidth = 2.8; g.beginPath(); g.moveTo(cx + i, cy - hh); g.lineTo(cx + i, cy + hh); g.stroke(); }
  g.strokeStyle = '#fffaf0'; g.lineWidth = 3; g.lineCap = 'round'; for (let i = 0; i < 3; i++){ g.beginPath(); g.moveTo(cx - 9 + i*3, cy - 10); g.lineTo(cx - 6 + i*3, cy - 5); g.stroke(); } }
export function rbox(parent, w, h, d, r, mat, x, y, z){ const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 6, r), mat); m.position.set(x, y, z); parent.add(m); return m; }
export function buildPlush(edKey){
  if (plush){ prizeScene.remove(plush); plush.traverse(o => { if (o.isMesh){ o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } }); }
  const E = EDITIONS[edKey], g = new THREE.Group(), goldStitch = [170,120,30], darker = mul(E.base, 0.82);
  const plain = seed => clothMat(fabricTex(E.base, E.stitch, null, seed), E.sheen);
  const goldMat = () => clothMat(fabricTex(GOLD, goldStitch, null, 41), [255,240,170], 0.72);
  const altMat = seed => clothMat(fabricTex(E.alt, mul(E.alt, 0.7), null, seed), E.sheen);
  // cuerpo: cada edición reparte sus parches a su manera; todas llevan un parche dorado
  let bodyMats;
  if (edKey === 'faja'){
    const side = clothMat(fabricTex(E.base, E.stitch, G => { patch(G, [[5,0,6,16]], E.alt, [190,180,160]); patch(G, [[7,6,2,2],[6,7,4,2],[7,9,2,1]], GOLD, goldStitch); }, 2), E.sheen);
    const top = clothMat(fabricTex(E.base, E.stitch, G => patch(G, [[0,5,16,6]], E.alt, [190,180,160]), 3), E.sheen);
    bodyMats = [side, side, top, top, plain(4), plain(5)];
  } else if (edKey === 'grenuda'){
    const side = clothMat(fabricTex(E.base, E.stitch, G => { patch(G, [[2,9,3,4],[4,11,3,3]], darker, E.stitch); patch(G, [[10,3,3,3],[9,4,5,2]], GOLD, goldStitch); }, 6), E.sheen);
    bodyMats = [side, side, plain(7), plain(8), plain(9), plain(10)];
  } else if (edKey === 'lunar'){
    const cr = G => { patch(G, [[2,3,4,4],[3,2,2,6]], E.alt, [70,76,100]); patch(G, [[10,9,4,3],[11,8,2,5]], E.alt, [70,76,100]); patch(G, [[9,2,3,3]], GOLD, goldStitch); };
    const side = clothMat(fabricTex(E.base, E.stitch, cr, 11), E.sheen), top = clothMat(fabricTex(E.base, E.stitch, G => patch(G, [[6,5,4,5],[5,6,6,3]], E.alt, [70,76,100]), 12), E.sheen);
    bodyMats = [side, side, top, plain(13), plain(14), plain(15)];
  } else if (edKey === 'real'){
    const side = clothMat(fabricTex(E.base, E.stitch, G => { patch(G, [[0,0,16,7]], E.alt, [236,190,70]); patch(G, [[7,9,2,2],[6,10,4,2],[7,12,2,1]], GOLD, goldStitch); }, 36), E.sheen);
    bodyMats = [side, side, clothMat(fabricTex(E.alt, [236,190,70], null, 37), E.sheen), plain(38), plain(39), plain(40)];
  } else {
    const side = clothMat(fabricTex(E.base, E.stitch, G => { patch(G, [[2,3,5,4],[3,2,3,6]], GOLD, goldStitch); patch(G, [[10,9,4,4]], GOLD, goldStitch); }, 16), E.sheen);
    bodyMats = [side, side, clothMat(fabricTex(E.base, E.stitch, G => patch(G, [[5,5,6,5]], GOLD, goldStitch), 17), E.sheen), plain(18), plain(19), plain(20)];
  }
  const Y0 = 0.16;   // altura del pedestal
  rbox(g, 1.02, 0.82, 1.2, 0.3, bodyMats, 0, Y0 + 0.74, -0.2);
  // cabeza grande con cara bordada
  const blaze = edKey === 'faja' ? E.alt : edKey === 'grenuda' ? E.alt : edKey === 'lunar' ? [222,208,244] : GOLD;
  const face = clothMat(fabricTex(E.base, E.stitch, G => { patch(G, [[7,0,2,7]], blaze, mul(blaze, 0.7)); embroideredEye(G, 72, 120); embroideredEye(G, 184, 120);
    G.fillStyle = 'rgba(255,130,150,0.55)'; G.beginPath(); G.arc(40, 170, 16, 0, 7); G.fill(); G.beginPath(); G.arc(216, 170, 16, 0, 7); G.fill(); }, 21), E.sheen);
  const headTop = clothMat(fabricTex(E.base, E.stitch, G => patch(G, [[7,8,2,8]], blaze, mul(blaze, 0.7)), 22), E.sheen);
  rbox(g, 1.18, 1.02, 0.96, 0.33, [plain(23), plain(24), headTop, plain(25), face, plain(26)], 0, Y0 + 1.36, 0.62);
  const muz = clothMat(fabricTex([252,226,214], [214,160,150], G => { G.fillStyle = '#7a4a44'; G.beginPath(); G.ellipse(84, 96, 12, 16, 0, 0, 7); G.fill(); G.beginPath(); G.ellipse(172, 96, 12, 16, 0, 0, 7); G.fill(); G.strokeStyle = '#7a4a44'; G.lineWidth = 6; G.lineCap = 'round'; G.setLineDash([10, 8]); G.beginPath(); G.arc(128, 150, 50, 0.35, Math.PI - 0.35); G.stroke(); G.setLineDash([]); }, 27), [255,236,228]);
  rbox(g, 0.66, 0.42, 0.26, 0.12, [plain(28), plain(28), plain(28), plain(28), muz, plain(28)].map((m, i) => i === 4 ? m : clothMat(fabricTex([252,226,214], [214,160,150], null, 29), [255,236,228])), 0, Y0 + 1.1, 1.14);
  // patas cortas con pezuñas doradas
  [[1,1],[-1,1],[1,-1],[-1,-1]].forEach(([sx, sz]) => { rbox(g, 0.36, 0.44, 0.36, 0.15, plain(30), sx*0.3, Y0 + 0.3, -0.2 + sz*0.36); rbox(g, 0.39, 0.16, 0.39, 0.075, goldMat(), sx*0.3, Y0 + 0.085, -0.2 + sz*0.36); });
  // orejas, cuernitos redondeados dorados, cola
  [1, -1].forEach(s => { const e = rbox(g, 0.36, 0.24, 0.12, 0.055, edKey === 'lunar' ? altMat(31) : plain(31), s*0.72, Y0 + 1.58, 0.56); e.rotation.z = -s*0.45; e.rotation.y = s*0.2;
    const long = edKey === 'grenuda', h = rbox(g, 0.17, long ? 0.42 : 0.27, 0.17, 0.08, goldMat(), s*(long ? 0.5 : 0.36), Y0 + (long ? 2.0 : 1.96), 0.6); h.rotation.z = -s*(long ? 0.7 : 0.25); });
  const tail = rbox(g, 0.1, 0.1, 0.42, 0.045, plain(32), 0, Y0 + 0.86, -0.92); tail.rotation.x = 0.7; rbox(g, 0.2, 0.2, 0.2, 0.09, goldMat(), 0, Y0 + 0.7, -1.08);
  if (edKey === 'grenuda'){ const f = rbox(g, 0.98, 0.34, 0.26, 0.11, altMat(33), 0, Y0 + 1.72, 1.02); f.rotation.x = 0.25; rbox(g, 0.7, 0.2, 0.5, 0.09, altMat(34), 0, Y0 + 1.9, 0.72); }
  if (edKey === 'faja'){ rbox(g, 0.42, 0.16, 0.36, 0.07, plain(35), 0, Y0 + 1.9, 0.62); }
  // etiqueta de colección cosida al costado
  const tagTex = (function(){ const c = mkCanvas(96, 64), G = c.getContext('2d'); G.fillStyle = '#fff8e8'; G.fillRect(0, 0, 96, 64); G.strokeStyle = '#c99a3a'; G.setLineDash([6, 4]); G.lineWidth = 2; G.strokeRect(4, 4, 88, 56); G.setLineDash([]); G.fillStyle = '#b07a1a'; G.font = 'bold 30px Georgia,serif'; G.textAlign = 'center'; G.textBaseline = 'middle'; G.fillText('T·D', 48, 34); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.16), new THREE.MeshStandardMaterial({ map:tagTex, roughness:0.9, side:THREE.DoubleSide })); tag.position.set(0.535, Y0 + 0.5, -0.62); tag.rotation.y = Math.PI/2; tag.rotation.x = 0.12; g.add(tag);
  if (GS.crown){   // corona bordada: solo para quien ganó en legendario
    rbox(g, 0.6, 0.16, 0.5, 0.05, goldMat(), 0, Y0 + 1.96, 0.6);
    for (const [cx, cz] of [[-0.22, -0.17], [0.22, -0.17], [-0.22, 0.17], [0.22, 0.17], [0, 0.17]]) rbox(g, 0.14, cx === 0 ? 0.3 : 0.2, 0.14, 0.05, goldMat(), cx, Y0 + (cx === 0 ? 2.14 : 2.1), 0.6 + cz);
    rbox(g, 0.12, 0.12, 0.08, 0.04, clothMat(fabricTex([206,44,70], [150,20,40], null, 43), [255,180,190], 0.6), 0, Y0 + 1.97, 0.86);
  }
  prizeScene.add(g); plush = g; plushEdition = edKey;
}
export function bestEdition(){ if (plats[3] && plats[3].done) return 'real'; let best = null; plats.forEach(p => { if (p.done && p.time != null && (best == null || p.time < best.time)) best = p; }); return best ? best.V.key : 'clasico'; }

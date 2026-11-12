/* RENDER: renderer, escena, cielo y mallado de chunks */
import * as THREE from 'three';
import { $, clamp, lin, mulberry32, pxTex } from './util.js';
import { CS, NCX, NCZ } from './blocks.js';
import { atlasTex, BLOCK_TILES, tileRect } from './atlas.js';
import { chunks, cullSolid, getB } from './world.js';

export const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(window.innerWidth, window.innerHeight);
export const scene = new THREE.Scene(); export const FOG = 0xd4ecf7; scene.background = new THREE.Color(FOG); scene.fog = new THREE.Fog(FOG, 26, 86);
export const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 400); camera.rotation.order = 'YXZ';
scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8a68, 2.3)); export const sunLight = new THREE.DirectionalLight(0xfff0d0, 1.7); sunLight.position.set(0.5, 1, 0.35); scene.add(sunLight);

/* cielo con degradado, sol y nubes */
export const sky = new THREE.Group(); scene.add(sky);
(function buildSky(){
  const geo = new THREE.SphereGeometry(300, 24, 16), pos = geo.attributes.position, cols = new Float32Array(pos.count*3);
  const cTop = lin(44,128,232), cMid = lin(124,194,246), cHor = lin(212,236,247), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++){ const t = clamp(pos.getY(i)/300, 0, 1); if (t < 0.25) tmp.copy(cHor).lerp(cMid, t/0.25); else tmp.copy(cMid).lerp(cTop, (t-0.25)/0.75); cols.set([tmp.r, tmp.g, tmp.b], i*3); }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  sky.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.BackSide, fog:false, depthWrite:false })));
  const sunTex = pxTex(32, 32, (x, y) => { const d = Math.max(Math.abs(x-15.5), Math.abs(y-15.5)); if (d < 6) return [255,250,210,255]; if (d < 8) return [255,230,140,255]; if (d < 15.5) return [255,236,170, Math.round(90*(1-(d-8)/7.5))]; return null; });
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map:sunTex, fog:false, depthWrite:false, transparent:true })); sun.position.set(110, 190, 80); sun.scale.set(70, 70, 1); sky.add(sun);
})();
export const clouds = new THREE.Group(); scene.add(clouds);
(function buildClouds(){ const mat = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.92, fog:false }); const r = mulberry32(77);
  for (let i = 0; i < 12; i++){ const g = new THREE.Group(); const n = 2 + Math.floor(r()*3); for (let j = 0; j < n; j++){ const m = new THREE.Mesh(new THREE.BoxGeometry(6 + r()*8, 1.6, 4 + r()*6), mat); m.position.set(j*4 - n*2 + r()*2, r()*0.8, r()*3); g.add(m); } g.position.set(-80 + r()*230, 46 + r()*10, -80 + r()*230); clouds.add(g); } })();

/* mallado: una BufferGeometry por chunk, solo caras visibles, AO por vértice */
export const FACES = [
  { d:[-1,0,0], ax:0, sh:0.74, c:[[0,1,0, 0,1],[0,0,0, 0,0],[0,1,1, 1,1],[0,0,1, 1,0]] },
  { d:[ 1,0,0], ax:0, sh:0.74, c:[[1,1,1, 0,1],[1,0,1, 0,0],[1,1,0, 1,1],[1,0,0, 1,0]] },
  { d:[0,-1,0], ax:1, sh:0.52, c:[[1,0,1, 1,0],[0,0,1, 0,0],[1,0,0, 1,1],[0,0,0, 0,1]] },
  { d:[0, 1,0], ax:1, sh:1.00, c:[[0,1,1, 1,1],[1,1,1, 0,1],[0,1,0, 1,0],[1,1,0, 0,0]] },
  { d:[0,0,-1], ax:2, sh:0.86, c:[[1,0,0, 0,0],[0,0,0, 1,0],[1,1,0, 0,1],[0,1,0, 1,1]] },
  { d:[0,0, 1], ax:2, sh:0.86, c:[[0,0,1, 0,0],[1,0,1, 1,0],[0,1,1, 0,1],[1,1,1, 1,1]] },
];
export const AO_LEVEL = [0.42, 0.62, 0.82, 1.0];
export const chunkMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true });
export const chunkMesh = [];
export function buildChunk(ci){
  const cx = ci % NCX, cz = Math.floor(ci / NCX) % NCZ, cy = Math.floor(ci / (NCX*NCZ)), ox = cx*CS, oy = cy*CS, oz = cz*CS, data = chunks[ci];
  const pos = [], uv = [], col = [], idx = [], ao = [0,0,0,0], o1 = [0,0,0], o2 = [0,0,0];
  for (let y = 0; y < CS; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++){
    const id = data[x | (z << 4) | (y << 8)]; if (!id) continue; const wx = ox+x, wy = oy+y, wz = oz+z, tiles = BLOCK_TILES[id];
    for (let f = 0; f < 6; f++){ const F = FACES[f], d = F.d; if (cullSolid(wx+d[0], wy+d[1], wz+d[2])) continue;
      const r = tileRect(d[1] > 0 ? tiles[0] : d[1] < 0 ? tiles[1] : tiles[2]), n = pos.length / 3, t1 = (F.ax+1)%3, t2 = (F.ax+2)%3, bx = wx+d[0], by = wy+d[1], bz = wz+d[2];
      for (let k = 0; k < 4; k++){ const c = F.c[k]; pos.push(wx+c[0], wy+c[1], wz+c[2]); uv.push(r[0] + c[3]*r[2], r[1] + c[4]*r[3]);
        o1[0] = o1[1] = o1[2] = 0; o2[0] = o2[1] = o2[2] = 0; o1[t1] = c[t1]*2-1; o2[t2] = c[t2]*2-1;
        const s1 = getB(bx+o1[0], by+o1[1], bz+o1[2]) ? 1 : 0, s2 = getB(bx+o2[0], by+o2[1], bz+o2[2]) ? 1 : 0, cc = getB(bx+o1[0]+o2[0], by+o1[1]+o2[1], bz+o1[2]+o2[2]) ? 1 : 0;
        ao[k] = (s1 && s2) ? 0 : 3 - (s1 + s2 + cc); const s = F.sh * AO_LEVEL[ao[k]]; col.push(s, s, s); }
      if (ao[0] + ao[3] > ao[1] + ao[2]) idx.push(n, n+1, n+3, n, n+3, n+2); else idx.push(n, n+1, n+2, n+2, n+1, n+3);
    } }
  let mesh = chunkMesh[ci];
  if (!mesh){ mesh = chunkMesh[ci] = new THREE.Mesh(new THREE.BufferGeometry(), chunkMat); scene.add(mesh); } else { mesh.geometry.dispose(); mesh.geometry = new THREE.BufferGeometry(); }
  const g = mesh.geometry; g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeBoundingSphere(); mesh.visible = idx.length > 0;
}
for (let i = 0; i < chunks.length; i++) buildChunk(i);
/* cubo suelto con la textura de un tile (hologramas, animaciones) */
export const tileBoxCache = {};
export function tileBoxGeo(tile, size){ const k = tile + '_' + size; if (tileBoxCache[k]) return tileBoxCache[k]; const g = new THREE.BoxGeometry(size, size, size), u = g.attributes.uv, r = tileRect(tile); for (let i = 0; i < u.count; i++) u.setXY(i, r[0] + u.getX(i)*r[2], r[1] + u.getY(i)*r[3]); return tileBoxCache[k] = g; }
/* contorno del bloque apuntado */
export const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)), new THREE.LineBasicMaterial({ color:0x1a0e05 })); outline.visible = false; scene.add(outline);

/* partículas (sprites pequeños) */
export const TEX = {
  spark: pxTex(7, 7, (x, y) => { const a = Math.abs(x-3), b = Math.abs(y-3); return (a === 0 || b === 0) && a + b < 4 ? [255,255,255,255] : (a === 1 && b === 1 ? [255,255,255,200] : null); }),
  heart: pxTex(7, 6, (x, y) => ['.##.##.','#######','#######','.#####.','..###..','...#...'][y][x] === '#' ? [255,255,255,255] : null),
  sq: pxTex(2, 2, () => [255,255,255,255]),
};
export const particles = [];
export function spawnP(tex, x, y, z, vx, vy, vz, life, size, color, grav = 0){ if (particles.length > 400) return; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, color, transparent:true, depthWrite:false })); s.position.set(x, y, z); s.scale.set(size, size, 1); scene.add(s); particles.push({ s, vx, vy, vz, life, max:life, grav, size }); }
export function burst(tex, x, y, z, n, speed, color, size = 0.25, grav = 6, life = 0.8){ for (let i = 0; i < n; i++){ const a = Math.random()*Math.PI*2, e = Math.random()*Math.PI - Math.PI/2, c = typeof color === 'function' ? color() : color; spawnP(tex, x, y, z, Math.cos(a)*Math.cos(e)*speed, Math.abs(Math.sin(e))*speed + 1, Math.sin(a)*Math.cos(e)*speed, life*(0.6 + Math.random()*0.6), size*(0.7 + Math.random()*0.6), c, grav); } }
export function updateParticles(dt){ for (let i = particles.length - 1; i >= 0; i--){ const p = particles[i]; p.life -= dt; if (p.life <= 0){ scene.remove(p.s); p.s.material.dispose(); particles.splice(i, 1); continue; } p.vy -= p.grav*dt; p.s.position.x += p.vx*dt; p.s.position.y += p.vy*dt; p.s.position.z += p.vz*dt; const k = Math.min(1, p.life/p.max*2); p.s.material.opacity = k; } }

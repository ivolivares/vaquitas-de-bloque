/* Datos de chunks, plataformas (definición) y generación del terreno */
import { clamp, fbm, hash2, mulberry32, vnoise } from './util.js';
import { B, CS, NCX, NCY, NCZ, WX, WY, WZ } from './blocks.js';

/* --- datos: un Uint8Array por chunk --- */
export const chunks = []; for (let i = 0; i < NCX*NCY*NCZ; i++) chunks.push(new Uint8Array(CS*CS*CS));
export const chunkIndex = (x, y, z) => (x >> 4) + (z >> 4) * NCX + (y >> 4) * NCX * NCZ;
export const inWorld = (x, y, z) => x >= 0 && x < WX && y >= 0 && y < WY && z >= 0 && z < WZ;
export function getB(x, y, z){ if (!inWorld(x, y, z)) return 0; return chunks[chunkIndex(x, y, z)][(x & 15) | ((z & 15) << 4) | ((y & 15) << 8)]; }
export function setBRaw(x, y, z, id){ chunks[chunkIndex(x, y, z)][(x & 15) | ((z & 15) << 4) | ((y & 15) << 8)] = id; }
export const dirty = new Set();
export function setB(x, y, z, id){ if (!inWorld(x, y, z)) return; setBRaw(x, y, z, id);
  // re-malla el chunk afectado y los vecinos solo si el bloque toca un borde (el AO mira diagonales)
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++){ const nx = x+dx, ny = y+dy, nz = z+dz; if (inWorld(nx, ny, nz)) dirty.add(chunkIndex(nx, ny, nz)); } }
export function cullSolid(x, y, z){ if (y >= WY) return false; if (y < 0 || x < 0 || x >= WX || z < 0 || z >= WZ) return true; return getB(x, y, z) !== 0; }

/* --- plataformas (definición) --- */
export const VARIANTS = [
  { key:'faja', name:'Vaca Faja', a:B.BLACK, b:B.WHITE, beam:0xfff4c8, colA:[34,32,40], colB:[244,240,230] },
  { key:'grenuda', name:'Vaca Greñuda', a:B.RUST, b:B.BROWN, beam:0xffa040, colA:[196,104,38], colB:[80,50,32] },
  { key:'lunar', name:'Vaca Lunar', a:B.LAVENDER, b:B.SLATE, beam:0xc8a8ff, colA:[188,166,228], colB:[96,104,128] },
];
export const PLAT_POS = [ [10, 12], [46, 14], [28, 46] ];   // esquina mínima (x,z); tamaño 4 (x) × 5 (z)
/* plantilla de 14 celdas: [dx,dy,dz, usaSecundario(faja), (grenuda), (lunar)] — la cabeza queda hacia -z */
export const TEMPLATE = [
  [1,0,1, 0,1,0],[2,0,1, 0,1,0],[1,0,3, 0,1,0],[2,0,3, 0,1,0],                     // patas
  [1,1,1, 0,0,1],[2,1,1, 0,0,0],[1,1,2, 1,0,0],[2,1,2, 1,0,0],[1,1,3, 0,0,0],[2,1,3, 0,0,1], // cuerpo
  [1,1,0, 0,0,0],[2,1,0, 0,0,0],[1,2,0, 0,0,1],[2,2,0, 0,0,0],                     // cabeza
];
export const SPAWN = { x:32.5, z:30.5 };

/* --- generación del terreno --- */
export const hmap = new Int16Array(WX * WZ);
export const platH = [];
(function generate(){
  const raw = new Float32Array(WX * WZ);
  for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++){
    let h = 5 + clamp((fbm(x*0.045, z*0.045, 7) - 0.3) / 0.4, 0, 1) * 8;
    // mesetas: escalón brusco donde asoma la piedra; se atenúan cerca de las plataformas y del inicio
    let near = Math.hypot(x - SPAWN.x, z - SPAWN.z) - 5; for (const [px, pz] of PLAT_POS) near = Math.min(near, Math.hypot(x - px - 2, z - pz - 2.5) - 9);
    const m = vnoise(x*0.05 + 40, z*0.05 + 40, 99); let t = clamp((m - 0.5) / 0.09, 0, 1); t = t*t*(3 - 2*t);
    h += t * 9 * clamp(near / 4, 0, 1);
    raw[x + z*WX] = Math.min(h, 23);
  }
  // aplanar alrededor de las plataformas y del punto de inicio
  const flats = PLAT_POS.map(([px, pz]) => ({ x0:px-2, x1:px+5, z0:pz-2, z1:pz+6, cx:px+2, cz:pz+2 }));
  flats.forEach((f, i) => { const H = clamp(Math.round(raw[f.cx + f.cz*WX]), 6, 13); platH[i] = H;
    for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++){ const dx = Math.max(f.x0 - x, 0, x - f.x1), dz = Math.max(f.z0 - z, 0, z - f.z1), d = Math.hypot(dx, dz); let w = clamp(1 - d/8, 0, 1); w = w*w*(3 - 2*w); raw[x + z*WX] += (H - raw[x + z*WX]) * w; } });
  for (let i = 0; i < raw.length; i++) hmap[i] = clamp(Math.floor(raw[i]), 2, 23);
  const H = (x, z) => hmap[clamp(x,0,WX-1) + clamp(z,0,WZ-1)*WX];
  for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++){
    const h = H(x, z); const slope = Math.max(Math.abs(H(x+1,z)-h), Math.abs(H(x-1,z)-h), Math.abs(H(x,z+1)-h), Math.abs(H(x,z-1)-h));
    const rocky = slope >= 2 || (slope >= 1 && h > 18 && hash2(x, z, 5) < 0.5);
    for (let y = 0; y < h; y++){ let id = B.STONE; if (!rocky){ if (y === h-1) id = B.GRASS; else if (y >= h-4) id = B.DIRT; } else if (y >= h-2 && hash2(x, z + y*7, 6) < 0.18) id = B.DIRT; setBRaw(x, y, z, id); }
  }
  // árboles
  const rnd = mulberry32(20240612), trees = [];
  for (let n = 0; n < 220 && trees.length < 26; n++){
    const x = 3 + Math.floor(rnd()*(WX-6)), z = 3 + Math.floor(rnd()*(WZ-6)), h = H(x, z);
    if (getB(x, h-1, z) !== B.GRASS) continue;
    if (flats.some(f => x > f.x0-3 && x < f.x1+3 && z > f.z0-3 && z < f.z1+3)) continue;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 5) continue; if (trees.some(t => Math.hypot(t[0]-x, t[1]-z) < 5)) continue;
    trees.push([x, z]); const th = 3 + Math.floor(rnd()*3), top = h + th;
    for (let y = h; y < top; y++) setBRaw(x, y, z, B.LOG);
    for (let dy = -1; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++){
      const r = Math.hypot(dx, dy*1.25 - 0.6, dz) + hash2(x+dx, z+dz + dy*13, 8)*0.7; const yy = top + dy;
      if (r < 2.75 && yy < WY && inWorld(x+dx, yy, z+dz) && getB(x+dx, yy, z+dz) === 0) setBRaw(x+dx, yy, z+dz, B.LEAVES); }
  }
  // losas de las plataformas
  PLAT_POS.forEach(([px, pz], i) => { for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 5; dz++) setBRaw(px+dx, platH[i]-1, pz+dz, B.PLAT); });
})();
export function isProtected(x, y, z){ if (y === 0) return true; for (let i = 0; i < 3; i++){ const [px, pz] = PLAT_POS[i]; if (x >= px && x < px+4 && z >= pz && z < pz+5 && y <= platH[i]-1) return true; } return false; }

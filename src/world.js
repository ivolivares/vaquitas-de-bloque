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
  { key:'real', name:'Vaca Real', a:B.WHITE, b:B.ROYAL, beam:0xffd76a, colA:[244,238,224], colB:[122,62,168] },   // vaca secreta del segundo mapa
];
export const PLAT_POS = [];   // esquina mínima (x,z) de cada plataforma; tamaño 4 (x) × 5 (z). Se llena al generar el mundo
const WORLDS = { 1: { plats:[[10, 12], [46, 14], [28, 46]], spawn:[32.5, 30.5], seed:0, trees:26 }, 2: { plats:[[30, 29]], spawn:[32.5, 43.5], seed:300, trees:16 } };   // en el segundo mapa solo está la plataforma de la Vaca Real
/* casita de piedra del segundo mapa: adentro flota la llave para volver */
export const RETURN = { x:32, z:47 };
/* casa enterrada bajo el centro del primer mapa: adentro flota la llave del portal */
export const KEYROOM = { x:32, y:2, z:30 };
/* plantilla de 14 celdas: [dx,dy,dz, usaSecundario(faja), (grenuda), (lunar)] — la cabeza queda hacia -z */
export const TEMPLATE = [
  [1,0,1, 0,1,0],[2,0,1, 0,1,0],[1,0,3, 0,1,0],[2,0,3, 0,1,0],                     // patas
  [1,1,1, 0,0,1],[2,1,1, 0,0,0],[1,1,2, 1,0,0],[2,1,2, 1,0,0],[1,1,3, 0,0,0],[2,1,3, 0,0,1], // cuerpo
  [1,1,0, 0,0,0],[2,1,0, 0,0,0],[1,2,0, 0,0,1],[2,2,0, 0,0,0],                     // cabeza
];
TEMPLATE.forEach((t, k) => t.push(k >= 4 && k <= 9 ? 1 : 0));   // Vaca Real: cuerpo con el manto
export const SPAWN = { x:32.5, z:30.5 };

/* bloques puestos por el jugador o por un cuatrero: ni vacas ni cuatreros pueden subirse a ellos */
export const placed = new Set();
export const foreign = new Set();   // los que puso un cuatrero (corrales): al romperlos no devuelven material
export const bkey = (x, y, z) => x + z*64 + y*4096;

/* --- generación del terreno --- */
export const hmap = new Int16Array(WX * WZ);
export const platH = [];
export function generateWorld(w){
  const W = WORLDS[w], S = W.seed; PLAT_POS.length = 0; W.plats.forEach(p => PLAT_POS.push(p)); platH.length = 0; SPAWN.x = W.spawn[0]; SPAWN.z = W.spawn[1];
  chunks.forEach(c => c.fill(0)); placed.clear(); foreign.clear();
  const raw = new Float32Array(WX * WZ);
  for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++){
    let h = 5 + clamp((fbm(x*0.045, z*0.045, 7 + S) - 0.3) / 0.4, 0, 1) * 8;
    // mesetas: escalón brusco donde asoma la piedra; se atenúan cerca de las plataformas y del inicio
    let near = Math.hypot(x - SPAWN.x, z - SPAWN.z) - 5; for (const [px, pz] of PLAT_POS) near = Math.min(near, Math.hypot(x - px - 2, z - pz - 2.5) - 9);
    if (w === 2) near = Math.min(near, Math.hypot(x - 32, z - 31) - 17);
    const m = vnoise(x*0.05 + 40, z*0.05 + 40, 99 + S); let t = clamp((m - 0.5) / 0.09, 0, 1); t = t*t*(3 - 2*t);
    h += t * 9 * clamp(near / 4, 0, 1);
    raw[x + z*WX] = Math.min(h, 23);
  }
  // aplanar alrededor de las plataformas y del punto de inicio
  const flats = PLAT_POS.map(([px, pz], i) => ({ x0:px-2, x1:px+5, z0:pz-2, z1:pz+6, cx:px+2, cz:pz+2, i }));
  if (w === 2) flats.unshift({ x0:21, x1:43, z0:20, z1:50, cx:32, cz:31, i:-1 });   // patio del castillo y explanada de llegada
  flats.forEach(f => { const H = clamp(Math.round(raw[f.cx + f.cz*WX]), 6, 13); if (f.i >= 0) platH[f.i] = H;
    for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++){ const dx = Math.max(f.x0 - x, 0, x - f.x1), dz = Math.max(f.z0 - z, 0, z - f.z1), d = Math.hypot(dx, dz); let w = clamp(1 - d/8, 0, 1); w = w*w*(3 - 2*w); raw[x + z*WX] += (H - raw[x + z*WX]) * w; } });
  for (let i = 0; i < raw.length; i++) hmap[i] = clamp(Math.floor(raw[i]), 2, 23);
  const H = (x, z) => hmap[clamp(x,0,WX-1) + clamp(z,0,WZ-1)*WX];
  for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++){
    const h = H(x, z); const slope = Math.max(Math.abs(H(x+1,z)-h), Math.abs(H(x-1,z)-h), Math.abs(H(x,z+1)-h), Math.abs(H(x,z-1)-h));
    const rocky = slope >= 2 || (slope >= 1 && h > 18 && hash2(x, z, 5) < 0.5);
    for (let y = 0; y < h; y++){ let id = B.STONE; if (!rocky){ if (y === h-1) id = B.GRASS; else if (y >= h-4) id = B.DIRT; } else if (y >= h-2 && hash2(x, z + y*7, 6) < 0.18) id = B.DIRT;
      if (id === B.STONE && y > 0 && hash2(x + y*31, z - y*17, 9 + S) < 0.045) id = B.QUARTZ;                                    // vetas de cuarzo
      if (!rocky && h <= 6 && y >= h-2 && vnoise(x*0.16, z*0.16, 12 + S) > 0.52) id = B.SAND;                                 // arenales en las zonas bajas
      else if (id === B.GRASS && hash2(x, z, 13 + S) < 0.03) id = B.FLOWERS;                                                 // manchones de flores
      setBRaw(x, y, z, id); }
  }
  if (w === 2){   // ruinas del castillo: muralla almenada con puertas y brechas, y cuatro torres
    const col = (x, z, hgt) => { const b = H(x, z); for (let y = b; y < b + hgt && y < WY; y++) setBRaw(x, y, z, B.BRICK); };
    for (let x = 23; x <= 41; x++) for (let z = 22; z <= 40; z++){ if (x !== 23 && x !== 41 && z !== 22 && z !== 40) continue;
      if (((z === 22 || z === 40) && Math.abs(x - 32) <= 1) || ((x === 23 || x === 41) && Math.abs(z - 31) <= 1)) continue;        // puertas
      col(x, z, hash2(x, z, 77) < 0.14 ? 1 : 3 + ((x + z) % 2)); }
    { const R = RETURN, b = H(R.x, R.z); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++){ if (dx && dz) for (let y = b; y < b + 3; y++) setBRaw(R.x + dx, y, R.z + dz, B.BRICK); setBRaw(R.x + dx, b + 3, R.z + dz, (dx || dz) ? B.BRICK : B.WOOD); } }   // casita del regreso: cuatro pilares y techo
    for (const [tx, tz] of [[23, 22], [41, 22], [23, 40], [41, 40]]) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) col(tx + dx, tz + dz, 7 + ((dx + dz + 2) % 2));
  }
  if (w === 1){   // la casa de la llave: una pieza de madera de 3×3×2 enterrada bajo el punto de inicio
    const K = KEYROOM; for (let x = K.x - 2; x <= K.x + 2; x++) for (let z = K.z - 2; z <= K.z + 2; z++) for (let y = K.y - 1; y <= K.y + 2; y++){
      const inside = Math.abs(x - K.x) <= 1 && Math.abs(z - K.z) <= 1 && y >= K.y && y <= K.y + 1; setBRaw(x, y, z, inside ? 0 : B.WOOD); }
  }
  { // fardos de heno y zapallos sueltos por la pradera
    const r2 = mulberry32(777 + S); let n = 0; for (let i = 0; i < 400 && n < 18; i++){ const x = 3 + Math.floor(r2()*58), z = 3 + Math.floor(r2()*58), h = H(x, z); const top = getB(x, h-1, z);
      if ((top !== B.GRASS && top !== B.FLOWERS) || getB(x, h, z) !== 0 || flats.some(f => x > f.x0-2 && x < f.x1+2 && z > f.z0-2 && z < f.z1+2) || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 4) continue; setBRaw(x, h, z, n % 2 ? B.PUMPKIN : B.HAY); n++; } }
  // árboles
  const rnd = mulberry32(20240612 + S), trees = [];
  for (let n = 0; n < 220 && trees.length < W.trees; n++){
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
  PLAT_POS.forEach(([px, pz], i) => { for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 5; dz++){ setBRaw(px+dx, platH[i]-1, pz+dz, B.PLAT); for (let y = platH[i]; y < platH[i] + 5; y++) setBRaw(px+dx, y, pz+dz, 0); } });
}
export function isProtected(x, y, z){ if (y === 0) return true; for (let i = 0; i < PLAT_POS.length; i++){ const [px, pz] = PLAT_POS[i]; if (x >= px && x < px+4 && z >= pz && z < pz+5 && y <= platH[i]-1) return true; } return false; }
generateWorld(1);

/* cada mapa conserva sus bloques mientras visitas el otro */
const snaps = {};
export function saveWorld(w){ snaps[w] = { chunks: chunks.map(c => c.slice()), placed: [...placed], foreign: [...foreign] }; }
export function loadWorld(w){ generateWorld(w); const s = snaps[w]; if (!s) return; s.chunks.forEach((c, i) => chunks[i].set(c)); s.placed.forEach(k => placed.add(k)); s.foreign.forEach(k => foreign.add(k)); }
export function topY(x, z){ let y = WY - 1; while (y > 0 && getB(x, y - 1, z) === 0) y--; return y; }

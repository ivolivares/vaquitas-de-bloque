/* Atlas de texturas pixel art generado por código */
import * as THREE from 'three';
import { hash2, mkCanvas, mul, pick, vnoise } from './util.js';
import { B } from './blocks.js';

/* --- atlas: tiles de 16x16 con 8 px de relleno extruido por lado --- */
export const TILE = 16, PADPX = 8, CELL = 32, ATLAS_N = 8, ATLAS_PX = 256;
export const atlasCanvas = mkCanvas(ATLAS_PX, ATLAS_PX); export const ag = atlasCanvas.getContext('2d'); ag.imageSmoothingEnabled = false;
export const T = {}, tileCanvas = [], tileAvg = [];
export function makeTile(name, fn){   // si el nombre ya existe, lo redibuja en su mismo lugar (así se cambia de tema)
  const fresh = !(name in T), idx = fresh ? tileCanvas.length : T[name]; T[name] = idx;
  const c = fresh ? mkCanvas(16, 16) : tileCanvas[idx], g = c.getContext('2d'), img = g.createImageData(16, 16); let ar = 0, agn = 0, ab = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++){ const col = fn(x, y), i = (y*16 + x)*4; img.data[i] = col[0]; img.data[i+1] = col[1]; img.data[i+2] = col[2]; img.data[i+3] = 255; ar += col[0]; agn += col[1]; ab += col[2]; }
  g.putImageData(img, 0, 0); tileCanvas[idx] = c; tileAvg[idx] = [ar/256, agn/256, ab/256];
  const ax = (idx % ATLAS_N) * CELL, ay = Math.floor(idx / ATLAS_N) * CELL, P = PADPX;
  ag.drawImage(c, ax + P, ay + P);
  ag.drawImage(c, 0, 0, 1, 16, ax, ay + P, P, 16); ag.drawImage(c, 15, 0, 1, 16, ax + P + 16, ay + P, P, 16);
  ag.drawImage(c, 0, 0, 16, 1, ax + P, ay, 16, P); ag.drawImage(c, 0, 15, 16, 1, ax + P, ay + P + 16, 16, P);
  ag.drawImage(c, 0, 0, 1, 1, ax, ay, P, P); ag.drawImage(c, 15, 0, 1, 1, ax + P + 16, ay, P, P);
  ag.drawImage(c, 0, 15, 1, 1, ax, ay + P + 16, P, P); ag.drawImage(c, 15, 15, 1, 1, ax + P + 16, ay + P + 16, P, P);
}
/* paleta cálida y saturada */
export const PAL = {
  grass:[[52,128,44],[70,150,48],[92,172,54],[118,192,62],[150,208,74]],
  dirt:[[84,50,30],[104,64,38],[126,80,46],[148,98,56],[168,116,68]],
  stone:[[98,94,96],[116,112,110],[136,132,126],[156,152,142]],
  bark:[[70,46,28],[88,60,34],[108,76,42],[126,92,52]],
  leaf:[[34,96,42],[48,120,46],[66,144,52],[92,168,60]],
  black:[[20,18,24],[30,28,36],[42,40,50],[58,56,68]],
  white:[[214,204,186],[232,224,208],[244,240,230],[254,252,248]],
  rust:[[142,60,22],[170,80,28],[196,104,38],[218,130,54],[234,158,80]],
  brown:[[46,28,20],[62,38,26],[80,50,32],[98,64,40]],
  lav:[[160,134,204],[176,152,218],[192,170,230],[210,192,240]],
  slate:[[72,78,98],[88,96,118],[104,112,136],[122,130,154]],
};
export function grassPx(x, y, s){ const n = vnoise(x/2.6, y/2.6, s)*0.55 + hash2(x, y, s+1)*0.45; if (hash2(x, y, s+2) < 0.03) return [164,214,80]; if (hash2(x, y, s+3) < 0.04) return [44,112,44]; return pick(PAL.grass, n); }
export function dirtPx(x, y, s){ if (hash2(x, y, s+3) < 0.035) return [196,170,134]; if (y > 0 && hash2(x, y-1, s+3) < 0.035) return [62,36,22];
  if (hash2(x, y, s+4) < 0.02) return [112,104,100]; const n = vnoise(x/2.4, y/2.4, s)*0.6 + hash2(x, y, s+1)*0.4; return pick(PAL.dirt, n); }
/* tema del primer mapa (la granja); se puede volver a aplicar al regresar del Reino de Piedra */
export function farmTheme(){
  makeTile('grass_top', (x, y) => grassPx(x, y, 11));
  makeTile('grass_side', (x, y) => { const d = 2 + Math.round(vnoise(x/1.7, 3.3, 31)*3 + hash2(x, 1, 32)*1.6); if (y < d) return y === d-1 ? mul(grassPx(x, y, 15), 0.78) : grassPx(x, y, 15); if (y === d) return mul(dirtPx(x, y, 21), 0.62); if (y === d+1) return mul(dirtPx(x, y, 21), 0.84); return dirtPx(x, y, 21); });
  makeTile('dirt', (x, y) => dirtPx(x, y, 21));
  makeTile('stone', (x, y) => { const cr = Math.abs(vnoise(x/3.5, y/3.5, 43) - 0.5); if (cr < 0.028) return [70,66,72]; if (cr < 0.06 && hash2(x,y,44) < 0.5) return [168,164,152]; return pick(PAL.stone, vnoise(x/3, y/3, 41)*0.6 + hash2(x, y, 42)*0.4); });
  makeTile('log_side', (x, y) => { if (hash2(x, 0, 53) < 0.22) return hash2(x, y, 54) < 0.8 ? [52,34,22] : PAL.bark[1]; return pick(PAL.bark, hash2(x, Math.floor((y + hash2(x,0,51)*9)/5), 52)*0.75 + hash2(x,y,55)*0.25); });
  makeTile('log_top', (x, y) => { const r = Math.max(Math.abs(x-7.5), Math.abs(y-7.5)); if (r > 6.6) return pick(PAL.bark, hash2(x,y,56)); return (Math.floor(r) % 2) ? [176,134,80] : [206,168,108]; });
  makeTile('leaves', (x, y) => { const h = hash2(x, y, 61); if (h < 0.11) return [24,70,36]; if (h > 0.975) return [222,66,50]; return pick(PAL.leaf, vnoise(x/2.2, y/2.2, 62)*0.5 + h*0.5); });
  makeTile('wood', (x, y) => { const row = Math.floor(y/4); if (y % 4 === 3) return [132,88,48]; if (x === (row*5 + 3) % 16) return [144,98,54]; const n = hash2(x, row, 71)*0.5 + hash2(Math.floor(x/3), y, 72)*0.5; return pick([[178,128,72],[194,142,82],[208,158,94],[220,172,106]], n); });
  makeTile('plat', (x, y) => { const e = Math.min(x, y, 15-x, 15-y); if (e === 0) return [122,104,82]; if (e === 1) return [236,224,192]; if ((x === 3 || x === 12) && (y === 3 || y === 12)) return [240,180,60]; return pick([[196,182,152],[208,194,164],[218,206,176]], hash2(x,y,81)); });
  if (T.flowers != null) makeTile('flowers', (x, y) => flowerPx(x, y, grassPx(x, y, 11)));
  if (atlasReady) atlasTex.needsUpdate = true;
}
let atlasReady = false;
farmTheme();
makeTile('black', (x, y) => { const c = vnoise(x/1.6, y/1.6, 91); return pick(PAL.black, c*0.7 + hash2(x,y,92)*0.3); });
makeTile('white', (x, y) => pick(PAL.white, vnoise(x/2, y/2, 93)*0.65 + hash2(x,y,94)*0.35));
makeTile('rust', (x, y) => pick(PAL.rust, hash2(x, Math.floor((y + hash2(x,0,95)*11)/6), 96)*0.7 + hash2(x,y,97)*0.3));
makeTile('brown', (x, y) => pick(PAL.brown, hash2(x, Math.floor((y + hash2(x,0,98)*11)/6), 99)*0.7 + hash2(x,y,100)*0.3));
makeTile('lavender', (x, y) => pick(PAL.lav, vnoise(x/3, y/3, 101)*0.7 + hash2(x,y,102)*0.3));
makeTile('slate', (x, y) => { const r = Math.hypot(x-7.5, y-8); if (r > 3.6 && r < 5.2) return (x + y < 15) ? PAL.slate[0] : PAL.slate[3]; if (r <= 3.6) return pick(PAL.slate, 0.25 + hash2(x,y,104)*0.3); return pick(PAL.slate, 0.35 + vnoise(x/2.5,y/2.5,103)*0.45 + hash2(x,y,105)*0.2); });

makeTile('royal', (x, y) => ((x + y) % 8 === 0 || (x - y + 16) % 8 === 0) ? [236,190,70] : pick([[92,44,132],[108,54,150],[124,66,168],[140,80,184]], vnoise(x/2.5, y/2.5, 111)*0.6 + hash2(x,y,112)*0.4));
export const atlasTex = new THREE.CanvasTexture(atlasCanvas); atlasReady = true;
atlasTex.magFilter = THREE.NearestFilter; atlasTex.minFilter = THREE.NearestMipmapLinearFilter; atlasTex.colorSpace = THREE.SRGBColorSpace;
/* [tapa, base, lados] por id de bloque */
export const BLOCK_TILES = []; export const setBT = (id, top, bot, side) => BLOCK_TILES[id] = [T[top], T[bot], T[side]];
setBT(B.GRASS,'grass_top','dirt','grass_side'); setBT(B.DIRT,'dirt','dirt','dirt'); setBT(B.STONE,'stone','stone','stone'); setBT(B.LOG,'log_top','log_top','log_side');
setBT(B.LEAVES,'leaves','leaves','leaves'); setBT(B.WOOD,'wood','wood','wood'); setBT(B.PLAT,'plat','plat','plat');
/* bloques que se descubren picando en modo libre */
const flowerPx = (x, y, base) => { const c = hash2(Math.floor(x/2), Math.floor(y/2), 131); return (c < 0.3 && hash2(x, y, 132) < 0.8) ? pick([[255,92,122],[255,222,72],[250,250,250],[190,122,240]], hash2(Math.floor(x/2), Math.floor(y/2), 133)) : base; };
makeTile('flowers', (x, y) => flowerPx(x, y, grassPx(x, y, 11)));
makeTile('sand', (x, y) => hash2(x, y, 141) < 0.05 ? [188,160,104] : pick([[214,190,130],[226,204,146],[236,216,160],[244,226,176]], vnoise(x/3, y/3, 142)*0.55 + hash2(x, y, 143)*0.45));
makeTile('hay_side', (x, y) => (y === 4 || y === 11) ? [128,86,44] : pick([[196,150,48],[214,170,60],[230,190,78],[242,208,100]], hash2(Math.floor(x/3), y, 151)*0.6 + hash2(x, y, 152)*0.4));
makeTile('hay_top', (x, y) => { const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); return pick([[196,150,48],[214,170,60],[230,190,78],[242,208,100]], (Math.floor(r) % 2)*0.4 + hash2(x, y, 153)*0.6); });
makeTile('quartz', (x, y) => { const n = vnoise(x/2.2, y/2.2, 161); if (n > 0.66) return n > 0.76 ? [246,242,255] : [216,194,244]; return pick(PAL.stone, vnoise(x/3, y/3, 41)*0.6 + hash2(x, y, 42)*0.4); });
makeTile('pumpkin_side', (x, y) => (x % 4 === 0) ? [176,92,22] : pick([[214,116,26],[230,134,34],[242,152,46]], hash2(x, y, 171)*0.6 + (y < 3 ? 0.4 : 0)));
makeTile('pumpkin_top', (x, y) => (Math.abs(x - 7.5) < 1.6 && Math.abs(y - 7.5) < 1.6) ? [86,128,52] : ((x + y) % 5 === 0 ? [176,92,22] : pick([[214,116,26],[230,134,34],[242,152,46]], hash2(x, y, 172))));
makeTile('brick', (x, y) => { const row = Math.floor(y/8), off = row % 2 ? 4 : 0, bx = Math.floor((x + off)/8); if (y % 8 === 7 || (x + off) % 8 === 7) return [104,88,74]; const k = 0.94 + hash2(x, y, 182)*0.12, c = pick([[150,128,104],[166,142,116],[182,158,130]], hash2(bx, row, 181)); return [c[0]*k, c[1]*k, c[2]*k]; });
setBT(B.SAND,'sand','sand','sand'); setBT(B.FLOWERS,'flowers','dirt','grass_side'); setBT(B.HAY,'hay_top','hay_top','hay_side'); setBT(B.QUARTZ,'quartz','quartz','quartz'); setBT(B.PUMPKIN,'pumpkin_top','pumpkin_top','pumpkin_side'); setBT(B.BRICK,'brick','brick','brick');
setBT(B.ROYAL,'royal','royal','royal'); setBT(B.BLACK,'black','black','black'); setBT(B.WHITE,'white','white','white'); setBT(B.RUST,'rust','rust','rust'); setBT(B.BROWN,'brown','brown','brown'); setBT(B.LAVENDER,'lavender','lavender','lavender'); setBT(B.SLATE,'slate','slate','slate');
export function tileRect(idx){ const ax = (idx % ATLAS_N) * CELL + PADPX, ay = Math.floor(idx / ATLAS_N) * CELL + PADPX; return [ax / ATLAS_PX, 1 - (ay + TILE) / ATLAS_PX, TILE / ATLAS_PX, TILE / ATLAS_PX]; } // u0, v0(abajo), du, dv

/* tema del segundo mapa, el Reino de Piedra: musgo, turba, adoquines, hojas de otoño, madera oscura y losas de mármol */
export function castleTheme(){
  const moss = [[38,84,62],[48,102,70],[62,120,76],[80,138,84],[104,154,92]], peat = [[52,38,34],[66,48,40],[82,60,48],[98,74,58],[114,88,68]];
  const mossPx = (x, y, s) => { if (hash2(x, y, s+2) < 0.035) return [176,116,206]; if (hash2(x, y, s+3) < 0.02) return [226,196,90]; return pick(moss, vnoise(x/2.6, y/2.6, s)*0.55 + hash2(x, y, s+1)*0.45); };
  const peatPx = (x, y, s) => { if (hash2(x, y, s+3) < 0.04) return [140,132,126]; return pick(peat, vnoise(x/2.4, y/2.4, s)*0.6 + hash2(x, y, s+1)*0.4); };
  makeTile('grass_top', (x, y) => mossPx(x, y, 311)); makeTile('flowers', (x, y) => flowerPx(x, y, mossPx(x, y, 311)));
  makeTile('grass_side', (x, y) => { const d = 2 + Math.round(vnoise(x/1.7, 3.3, 331)*3 + hash2(x, 1, 332)*1.6); if (y < d) return y === d-1 ? mul(mossPx(x, y, 315), 0.78) : mossPx(x, y, 315); if (y === d) return mul(peatPx(x, y, 321), 0.62); if (y === d+1) return mul(peatPx(x, y, 321), 0.84); return peatPx(x, y, 321); });
  makeTile('dirt', (x, y) => peatPx(x, y, 321));
  makeTile('stone', (x, y) => { const row = Math.floor(y/4), off = row % 2 ? 4 : 0, bx = Math.floor((x + off)/8); if (y % 4 === 3 || (x + off) % 8 === 7) return [66,64,72]; if (hash2(x, y, 402) < 0.045) return [84,122,78];
    const k = 0.94 + hash2(x, y, 403)*0.12, c = pick([[118,116,122],[134,132,134],[150,148,144],[166,162,152]], hash2(bx, row, 401)); return [c[0]*k, c[1]*k, c[2]*k]; });
  makeTile('log_side', (x, y) => { if (hash2(x, 0, 353) < 0.22) return [34,24,20]; return pick([[48,34,26],[60,44,32],[74,54,38],[88,66,46]], hash2(x, Math.floor((y + hash2(x,0,351)*9)/5), 352)*0.75 + hash2(x,y,355)*0.25); });
  makeTile('leaves', (x, y) => { const h = hash2(x, y, 361); if (h < 0.11) return [96,40,20]; if (h > 0.96) return [250,206,90]; return pick([[150,60,24],[190,84,28],[222,120,36],[238,164,54]], vnoise(x/2.2, y/2.2, 362)*0.5 + h*0.5); });
  makeTile('wood', (x, y) => { const row = Math.floor(y/4); if (y % 4 === 3) return [70,46,30]; if (x === (row*5 + 3) % 16) return [80,54,34]; return pick([[108,72,44],[122,84,52],[136,96,60],[150,108,70]], hash2(x, row, 371)*0.5 + hash2(Math.floor(x/3), y, 372)*0.5); });
  makeTile('plat', (x, y) => { const e = Math.min(x, y, 15-x, 15-y); if (e === 0) return [96,60,128]; if (e === 1) return [236,190,70]; if ((x === 3 || x === 12) && (y === 3 || y === 12)) return [236,190,70]; return pick([[226,222,216],[236,232,226],[244,241,236]], hash2(x,y,381)); });
  atlasTex.needsUpdate = true;
}

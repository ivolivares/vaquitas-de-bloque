/* Atlas de texturas pixel art generado por código */
import * as THREE from 'three';
import { hash2, mkCanvas, mul, pick, vnoise } from './util.js';
import { B } from './blocks.js';

/* --- atlas: tiles de 16x16 con 8 px de relleno extruido por lado --- */
export const TILE = 16, PADPX = 8, CELL = 32, ATLAS_N = 4, ATLAS_PX = 128;
export const atlasCanvas = mkCanvas(ATLAS_PX, ATLAS_PX); export const ag = atlasCanvas.getContext('2d'); ag.imageSmoothingEnabled = false;
export const T = {}, tileCanvas = [], tileAvg = [];
export function makeTile(name, fn){
  const idx = tileCanvas.length; T[name] = idx;
  const c = mkCanvas(16, 16), g = c.getContext('2d'), img = g.createImageData(16, 16); let ar = 0, agn = 0, ab = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++){ const col = fn(x, y), i = (y*16 + x)*4; img.data[i] = col[0]; img.data[i+1] = col[1]; img.data[i+2] = col[2]; img.data[i+3] = 255; ar += col[0]; agn += col[1]; ab += col[2]; }
  g.putImageData(img, 0, 0); tileCanvas.push(c); tileAvg.push([ar/256, agn/256, ab/256]);
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
makeTile('grass_top', (x, y) => grassPx(x, y, 11));
makeTile('grass_side', (x, y) => { const d = 2 + Math.round(vnoise(x/1.7, 3.3, 31)*3 + hash2(x, 1, 32)*1.6); if (y < d) return y === d-1 ? mul(grassPx(x, y, 15), 0.78) : grassPx(x, y, 15); if (y === d) return mul(dirtPx(x, y, 21), 0.62); if (y === d+1) return mul(dirtPx(x, y, 21), 0.84); return dirtPx(x, y, 21); });
makeTile('dirt', (x, y) => dirtPx(x, y, 21));
makeTile('stone', (x, y) => { const cr = Math.abs(vnoise(x/3.5, y/3.5, 43) - 0.5); if (cr < 0.028) return [70,66,72]; if (cr < 0.06 && hash2(x,y,44) < 0.5) return [168,164,152]; return pick(PAL.stone, vnoise(x/3, y/3, 41)*0.6 + hash2(x, y, 42)*0.4); });
makeTile('log_side', (x, y) => { if (hash2(x, 0, 53) < 0.22) return hash2(x, y, 54) < 0.8 ? [52,34,22] : PAL.bark[1]; return pick(PAL.bark, hash2(x, Math.floor((y + hash2(x,0,51)*9)/5), 52)*0.75 + hash2(x,y,55)*0.25); });
makeTile('log_top', (x, y) => { const r = Math.max(Math.abs(x-7.5), Math.abs(y-7.5)); if (r > 6.6) return pick(PAL.bark, hash2(x,y,56)); return (Math.floor(r) % 2) ? [176,134,80] : [206,168,108]; });
makeTile('leaves', (x, y) => { const h = hash2(x, y, 61); if (h < 0.11) return [24,70,36]; if (h > 0.975) return [222,66,50]; return pick(PAL.leaf, vnoise(x/2.2, y/2.2, 62)*0.5 + h*0.5); });
makeTile('wood', (x, y) => { const row = Math.floor(y/4); if (y % 4 === 3) return [132,88,48]; if (x === (row*5 + 3) % 16) return [144,98,54]; const n = hash2(x, row, 71)*0.5 + hash2(Math.floor(x/3), y, 72)*0.5; return pick([[178,128,72],[194,142,82],[208,158,94],[220,172,106]], n); });
makeTile('plat', (x, y) => { const e = Math.min(x, y, 15-x, 15-y); if (e === 0) return [122,104,82]; if (e === 1) return [236,224,192]; if ((x === 3 || x === 12) && (y === 3 || y === 12)) return [240,180,60]; return pick([[196,182,152],[208,194,164],[218,206,176]], hash2(x,y,81)); });
makeTile('black', (x, y) => { const c = vnoise(x/1.6, y/1.6, 91); return pick(PAL.black, c*0.7 + hash2(x,y,92)*0.3); });
makeTile('white', (x, y) => pick(PAL.white, vnoise(x/2, y/2, 93)*0.65 + hash2(x,y,94)*0.35));
makeTile('rust', (x, y) => pick(PAL.rust, hash2(x, Math.floor((y + hash2(x,0,95)*11)/6), 96)*0.7 + hash2(x,y,97)*0.3));
makeTile('brown', (x, y) => pick(PAL.brown, hash2(x, Math.floor((y + hash2(x,0,98)*11)/6), 99)*0.7 + hash2(x,y,100)*0.3));
makeTile('lavender', (x, y) => pick(PAL.lav, vnoise(x/3, y/3, 101)*0.7 + hash2(x,y,102)*0.3));
makeTile('slate', (x, y) => { const r = Math.hypot(x-7.5, y-8); if (r > 3.6 && r < 5.2) return (x + y < 15) ? PAL.slate[0] : PAL.slate[3]; if (r <= 3.6) return pick(PAL.slate, 0.25 + hash2(x,y,104)*0.3); return pick(PAL.slate, 0.35 + vnoise(x/2.5,y/2.5,103)*0.45 + hash2(x,y,105)*0.2); });

export const atlasTex = new THREE.CanvasTexture(atlasCanvas);
atlasTex.magFilter = THREE.NearestFilter; atlasTex.minFilter = THREE.NearestMipmapLinearFilter; atlasTex.colorSpace = THREE.SRGBColorSpace;
/* [tapa, base, lados] por id de bloque */
export const BLOCK_TILES = []; export const setBT = (id, top, bot, side) => BLOCK_TILES[id] = [T[top], T[bot], T[side]];
setBT(B.GRASS,'grass_top','dirt','grass_side'); setBT(B.DIRT,'dirt','dirt','dirt'); setBT(B.STONE,'stone','stone','stone'); setBT(B.LOG,'log_top','log_top','log_side');
setBT(B.LEAVES,'leaves','leaves','leaves'); setBT(B.WOOD,'wood','wood','wood'); setBT(B.PLAT,'plat','plat','plat');
setBT(B.BLACK,'black','black','black'); setBT(B.WHITE,'white','white','white'); setBT(B.RUST,'rust','rust','rust'); setBT(B.BROWN,'brown','brown','brown'); setBT(B.LAVENDER,'lavender','lavender','lavender'); setBT(B.SLATE,'slate','slate','slate');
export function tileRect(idx){ const ax = (idx % ATLAS_N) * CELL + PADPX, ay = Math.floor(idx / ATLAS_N) * CELL + PADPX; return [ax / ATLAS_PX, 1 - (ay + TILE) / ATLAS_PX, TILE / ATLAS_PX, TILE / ATLAS_PX]; } // u0, v0(abajo), du, dv

/* VACAS: modelos de cajas, texturas procedurales y comportamiento */
import { bkey, placed } from './world.js';
import * as THREE from 'three';
import { GS, LATE, late } from './state.js';
import { B } from './blocks.js';
import { player } from './player.js';
import { writeSave } from './save.js';
import { clamp, hash2, mul, pick, pxTex, vnoise } from './util.js';
import { WX, WY, WZ } from './blocks.js';
import { PAL } from './atlas.js';
import { getB } from './world.js';
import { scene, spawnP, TEX } from './render.js';
import { sndMoo } from './audio.js';

export const COW_DEFS = [
  { legH:0.50, legW:0.25, body:[0.94, 0.78, 1.36], head:[0.64, 0.58, 0.52], pitch:1.0 },   // Faja: compacta, sin cuernos
  { legH:0.42, legW:0.29, body:[1.02, 0.84, 1.42], head:[0.70, 0.62, 0.54], pitch:0.82 },  // Greñuda: baja y peluda
  { legH:0.76, legW:0.20, body:[0.78, 0.72, 1.42], head:[0.54, 0.56, 0.58], pitch:1.22 },  // Lunar: alta y delgada
  { legH:0.58, legW:0.24, body:[0.90, 0.80, 1.40], head:[0.62, 0.58, 0.54], pitch:1.1 },   // Real: marfil, con manto y corona
  { legH:0.46, legW:0.27, body:[1.00, 0.82, 1.38], head:[0.66, 0.60, 0.52], pitch:0.92 },  // Heno: rechoncha, con sombrero de paja
  { legH:0.40, legW:0.26, body:[1.08, 0.90, 1.30], head:[0.68, 0.62, 0.52], pitch:0.74 },  // Zapallo: redonda, con tallo y hoja
  { legH:0.60, legW:0.22, body:[0.86, 0.76, 1.40], head:[0.60, 0.58, 0.56], pitch:1.34 },  // Cuarzo: con cristales que brillan
];
export const lam = (map, extra = {}) => new THREE.MeshLambertMaterial(Object.assign({ map }, extra));
export const flat = c => new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(c[0]/255, c[1]/255, c[2]/255, THREE.SRGBColorSpace) });
export function eyePx(x, y, ex, ey){ const dx = x - ex, dy = y - ey; if (dx < 0 || dx > 2 || dy < 0 || dy > 2) return null; if (dx === 0 && dy === 0) return [255,255,255]; if (dy === 0 || dx === 0) return [250,250,250]; return [24,18,22]; }
export const cowMats = [];
export function getCowMats(vi){
  if (cowMats[vi]) return cowMats[vi]; const M = {};
  const muzzle = (base, nose) => pxTex(8, 5, (x, y) => { if (y === 1 && (x === 2 || x === 5)) return nose; if (y === 3 && x >= 2 && x <= 5) return mul(base, 0.7); if (y === 2 && (x === 1 || x === 6)) return mul(base, 0.7); return mul(base, 0.94 + hash2(x,y,7)*0.1); });
  if (vi >= 4){   // vacas raras: paleta A (cuerpo) y B (patas y detalles)
    const R = [{ a:[[196,150,48],[214,170,60],[230,190,78],[242,208,100]], b:[[214,190,130],[226,204,146],[236,216,160]], muz:[244,222,178], nose:[150,110,60] },
      { a:[[200,104,22],[214,116,26],[230,134,34],[242,152,46]], b:[[52,104,40],[70,128,48],[92,150,60]], muz:[250,196,130], nose:[120,60,20] },
      { a:[[122,122,130],[146,146,154],[216,194,244],[246,242,255]], b:[[150,128,104],[166,142,116],[182,158,130]], muz:[228,216,242], nose:[92,82,112] }][vi - 4], s = 400 + vi*20;
    const px = vi === 4 ? (x, y) => (y % 6 === 4) ? [128,86,44] : pick(R.a, hash2(Math.floor(x/3), y, s)*0.6 + hash2(x, y, s+1)*0.4)
      : vi === 5 ? (x, y) => (x % 4 === 0) ? mul(R.a[0], 0.84) : pick(R.a, hash2(x, y, s)*0.7 + 0.15)
      : (x, y) => { const n = vnoise(x/2.2, y/2.2, s); return n > 0.62 ? (n > 0.74 ? R.a[3] : R.a[2]) : pick(R.a.slice(0, 2), vnoise(x/3, y/3, s+1)*0.6 + hash2(x, y, s+2)*0.4); };
    M.body = lam(pxTex(24, 16, px)); M.fur = lam(pxTex(16, 16, px));
    M.face = lam(pxTex(16, 16, (x, y) => eyePx(x, y, 2, 6) || eyePx(15-x, y, 2, 6) || ((y === 10 || y === 11) && (x === 1 || x === 2 || x === 13 || x === 14) ? [246,170,160] : px(x, y))));
    M.leg = lam(pxTex(6, 12, (x, y) => y > 9 ? mul(R.b[0], 0.6) : pick(R.b, hash2(x, y, s+5)))); M.muzzle = lam(muzzle(R.muz, R.nose)); M.ear = M.fur; M.tail = M.fur; M.tuft = flat(R.b[1]);
    M.x1 = flat(vi === 4 ? [226,186,72] : R.b[1]); M.x2 = vi === 4 ? flat([176,60,48]) : vi === 5 ? flat([120,84,40]) : new THREE.MeshLambertMaterial({ color:0xd8c0ff, emissive:0x8a5cff, emissiveIntensity:0.9 });
    return cowMats[vi] = M;
  }
  if (vi === 3){
    const ivo = [[226,214,190],[238,228,206],[246,240,224],[254,250,240]], pur = [[92,44,132],[108,54,150],[124,66,168],[140,80,184]], gold = [236,190,70];
    const iv = (x, y, s) => pick(ivo, vnoise(x/2, y/2, s)*0.65 + hash2(x,y,s+1)*0.35), pu = (x, y, s) => pick(pur, vnoise(x/2.5, y/2.5, s)*0.6 + hash2(x,y,s+1)*0.4);
    const side = pxTex(24, 14, (x, y) => { if (y === 7) return gold; if (y === 8 && x % 3 === 1) return gold; return y < 7 ? ((x + y) % 6 === 0 ? gold : pu(x, y, 281)) : iv(x, y, 283); });
    const top = pxTex(14, 24, (x, y) => (x === 0 || x === 13 || y === 0 || y === 23) ? gold : ((x + y) % 6 === 0 ? gold : pu(x, y, 281)));
    const plain = pxTex(16, 16, (x, y) => iv(x, y, 283));
    M.body = [lam(side), lam(side), lam(top), lam(plain), lam(plain), lam(plain)]; M.fur = lam(plain);
    M.face = lam(pxTex(16, 16, (x, y) => eyePx(x, y, 2, 6) || eyePx(15-x, y, 2, 6) || ((y === 10 || y === 11) && (x === 1 || x === 2 || x === 13 || x === 14) ? [246,170,180] : iv(x, y, 283))));
    M.leg = lam(pxTex(6, 12, (x, y) => y > 9 ? gold : iv(x, y, 285))); M.muzzle = lam(muzzle([244,196,200], [150,96,110])); M.ear = M.fur; M.tail = M.fur; M.tuft = flat(pur[2]);
    M.crown = new THREE.MeshLambertMaterial({ color:0xf0c040, emissive:0x6a4a00, emissiveIntensity:0.6 }); M.gem = new THREE.MeshLambertMaterial({ color:0xd02848, emissive:0x600818, emissiveIntensity:0.7 });
    return cowMats[vi] = M;
  }
  if (vi === 0){
    const fur = (x, y, s) => pick(PAL.black, vnoise(x/1.5, y/1.5, s)*0.7 + hash2(x,y,s+1)*0.3), wh = (x, y, s) => pick(PAL.white, vnoise(x/2, y/2, s)*0.6 + hash2(x,y,s+1)*0.4);
    const side = pxTex(24, 14, (x, y) => { const e0 = 8 + Math.round(hash2(0,y,201)*1.4), e1 = 15 - Math.round(hash2(1,y,202)*1.4); return (x >= e0 && x <= e1) ? wh(x,y,203) : fur(x,y,205); });
    const top = pxTex(14, 24, (x, y) => { const e0 = 8 + Math.round(hash2(x,0,206)*1.4), e1 = 15 - Math.round(hash2(x,1,207)*1.4); return (y >= e0 && y <= e1) ? wh(x,y,203) : fur(x,y,205); });
    const plain = pxTex(16, 16, (x, y) => fur(x, y, 205));
    M.body = [lam(side), lam(side), lam(top), lam(top), lam(plain), lam(plain)]; M.fur = lam(plain);
    M.face = lam(pxTex(16, 16, (x, y) => eyePx(x, y, 2, 6) || eyePx(15-x, y, 2, 6) || ((y === 11 && (x === 2 || x === 13)) ? [150,90,100] : fur(x, y, 205))));
    M.leg = lam(pxTex(6, 12, (x, y) => y > 9 ? [14,12,16] : fur(x, y, 209))); M.muzzle = lam(muzzle([196,192,190], [60,54,58])); M.ear = M.fur; M.tail = M.fur; M.tuft = M.fur;
  } else if (vi === 1){
    const blond = [[196,128,54],[218,156,76],[236,184,104],[246,208,138]];
    const st = (x, y, s, pal = PAL.rust) => pick(pal, hash2(x, Math.floor((y + hash2(x,0,s)*13)/7), s+1)*0.7 + hash2(x,y,s+2)*0.3);
    const fur = pxTex(16, 16, (x, y) => st(x, y, 220)); M.fur = lam(fur); M.body = M.fur;
    M.face = lam(pxTex(16, 16, (x, y) => eyePx(x, y, 2, 7) || eyePx(15-x, y, 2, 7) || st(x, y, 224)));
    M.skirt = lam(pxTex(24, 12, (x, y) => (y > 6 + Math.floor(hash2(x,0,226)*6)) ? null : st(x, y, 227, y < 3 ? PAL.rust : blond.slice(0,3).concat([PAL.rust[3]]))), { alphaTest:0.5, side:THREE.DoubleSide });
    M.fringe = lam(pxTex(14, 9, (x, y) => (y > 4 + Math.floor(hash2(x,0,230)*5)) ? null : st(x, y, 231, blond)), { alphaTest:0.5, side:THREE.DoubleSide });
    M.fringeTop = lam(pxTex(8, 8, (x, y) => st(x, y, 233, blond)));
    M.leg = lam(pxTex(6, 10, (x, y) => y > 7 ? [40,26,20] : st(x, y, 235, PAL.rust.slice(0,3)))); M.muzzle = lam(muzzle([214,160,140], [90,50,44])); M.ear = M.fur; M.tail = M.fur; M.tuft = lam(pxTex(4, 4, (x, y) => st(x, y, 237, blond)));
    M.horn = lam(pxTex(4, 4, (x, y) => pick([[214,200,168],[232,222,194],[244,238,216]], hash2(x,y,239)))); M.hornTip = flat([150,128,100]);
  } else {
    const lv = (x, y, s) => pick(PAL.lav, vnoise(x/3, y/3, s)*0.7 + hash2(x,y,s+1)*0.3);
    const patch = (x, y, s, sc = 5) => { const n = vnoise(x/sc, y/sc, s); if (n > 0.64) return n > 0.78 ? PAL.slate[3] : pick(PAL.slate, 0.3 + hash2(x,y,s+2)*0.45); if (n > 0.61) return PAL.slate[0]; return lv(x, y, s+3); };
    M.body = lam(pxTex(24, 16, (x, y) => patch(x, y, 250))); M.fur = lam(pxTex(16, 16, (x, y) => patch(x, y, 256, 6)));
    M.face = lam(pxTex(16, 16, (x, y) => { if ((x === 7 || x === 8) && y < 12) return PAL.lav[3]; if (y >= 5 && y <= 9 && ((x >= 1 && x <= 5) || (x >= 10 && x <= 14))) return PAL.slate[0]; return lv(x, y, 260); }));
    M.leg = lam(pxTex(6, 16, (x, y) => y > 13 ? PAL.slate[0] : (y > 6 ? PAL.lav[3] : patch(x, y, 262, 4)))); M.muzzle = lam(muzzle([234,206,230], [120,96,150])); M.ear = M.fur; M.tail = M.fur; M.tuft = flat(PAL.slate[1]);
    M.horn = flat([226,232,244]); M.eye = new THREE.MeshLambertMaterial({ color:0x1c3a4a, emissive:0x9ff2ff, emissiveIntensity:1.0 }); M.udder = flat([240,190,214]);
  }
  return cowMats[vi] = M;
}
export function addBox(parent, w, h, d, mat, x, y, z){ const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; }
export function buildCowModel(vi){
  const D = COW_DEFS[vi], M = getCowMats(vi), g = new THREE.Group(), [bw, bh, bl] = D.body, [hw, hh, hd] = D.head, lh = D.legH, lw = D.legW;
  addBox(g, bw, bh, bl, M.body, 0, lh + bh/2, 0);
  const legs = []; [[1,1],[-1,1],[1,-1],[-1,-1]].forEach(([sx, sz]) => { const lg = new THREE.Group(); lg.position.set(sx*(bw/2 - lw/2 - 0.02), lh + 0.04, sz*(bl/2 - lw/2 - 0.04)); addBox(lg, lw, lh + 0.04, lw, M.leg, 0, -(lh + 0.04)/2, 0); g.add(lg); legs.push(lg); });
  const head = new THREE.Group(); head.position.set(0, lh + bh*0.74, bl/2 - 0.1); g.add(head);
  const hy = 0.1, hz = hd/2 + 0.04;
  addBox(head, hw, hh, hd, [M.fur, M.fur, M.fur, M.fur, M.face, M.fur], 0, hy, hz);
  addBox(head, hw*0.68, hh*0.42, 0.16, [M.muzzle, M.muzzle, M.muzzle, M.muzzle, M.muzzle, M.muzzle], 0, hy - hh*0.25, hz + hd/2 + 0.06);
  [1, -1].forEach(s => { const e = addBox(head, 0.22, 0.12, 0.07, M.ear, s*(hw/2 + 0.1), hy + hh*0.22, hz - 0.02); e.rotation.z = -s*0.25; });
  const tail = new THREE.Group(); tail.position.set(0, lh + bh*0.86, -bl/2); g.add(tail); addBox(tail, 0.07, 0.5, 0.07, M.tail, 0, -0.25, -0.04); addBox(tail, 0.13, 0.15, 0.13, M.tuft, 0, -0.55, -0.04);
  if (vi === 0){ addBox(head, 0.36, 0.1, 0.3, M.fur, 0, hy + hh/2 + 0.04, hz - 0.04); }                 // copete rizado, sin cuernos
  if (vi === 1){
    [1, -1].forEach(s => { addBox(g, 0.06, 0.6, bl*0.98, M.skirt, s*(bw/2 + 0.035), lh + bh*0.38, 0); });        // pelo largo colgando
    addBox(head, hw + 0.06, 0.36, 0.05, M.fringe, 0, hy + hh*0.24, hz + hd/2 + 0.035); addBox(head, hw + 0.04, 0.1, hd*0.7, M.fringeTop, 0, hy + hh/2 + 0.04, hz + 0.06); // flequillo
    [1, -1].forEach(s => { const h1 = addBox(head, 0.36, 0.1, 0.1, M.horn, s*(hw/2 + 0.16), hy + hh*0.34, hz - 0.08), h2 = addBox(head, 0.3, 0.1, 0.1, M.horn, s*(hw/2 + 0.42), hy + hh*0.34 + 0.1, hz - 0.08), h3 = addBox(head, 0.08, 0.2, 0.08, M.horn, s*(hw/2 + 0.55), hy + hh*0.34 + 0.27, hz - 0.08), h4 = addBox(head, 0.06, 0.08, 0.06, M.hornTip, s*(hw/2 + 0.57), hy + hh*0.34 + 0.4, hz - 0.08); h2.rotation.z = s*0.7; h3.rotation.z = -s*0.1; h4.rotation.z = -s*0.1; h1.rotation.z = s*0.12; });
  }
  if (vi === 3){   // corona
    addBox(head, 0.46, 0.1, 0.4, M.crown, 0, hy + hh/2 + 0.05, hz - 0.02);
    for (const [cx, cz] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.13], [0.18, 0.13], [0, 0.13]]) addBox(head, 0.1, cx === 0 ? 0.2 : 0.14, 0.1, M.crown, cx, hy + hh/2 + (cx === 0 ? 0.2 : 0.17), hz - 0.02 + cz);
    addBox(head, 0.08, 0.08, 0.04, M.gem, 0, hy + hh/2 + 0.06, hz + 0.19);
  }
  if (vi === 4){ addBox(head, hw + 0.34, 0.05, hd + 0.34, M.x1, 0, hy + hh/2 + 0.03, hz); addBox(head, hw*0.62, 0.17, hd*0.62, M.x1, 0, hy + hh/2 + 0.13, hz); addBox(head, hw*0.64, 0.05, hd*0.64, M.x2, 0, hy + hh/2 + 0.08, hz); }   // sombrero de paja con cinta
  if (vi === 5){ addBox(head, 0.1, 0.18, 0.1, M.x2, 0, hy + hh/2 + 0.09, hz); const lf = addBox(head, 0.26, 0.04, 0.16, M.x1, 0.16, hy + hh/2 + 0.12, hz); lf.rotation.z = -0.35; }   // tallo y hoja
  if (vi === 6){ [1, -1].forEach(s => { const h1 = addBox(head, 0.1, 0.3, 0.1, M.x2, s*(hw/2 - 0.08), hy + hh/2 + 0.14, hz - 0.08); h1.rotation.z = -s*0.3; }); [[-0.2, 0.3], [0.16, -0.1], [-0.05, -0.42]].forEach(([cx, cz], k) => { const c = addBox(g, 0.13, 0.22 + k*0.05, 0.13, M.x2, cx, lh + bh + 0.1, cz); c.rotation.y = 0.6 + k; }); }   // cristales
  if (vi === 2){
    [1, -1].forEach(s => { addBox(head, 0.12, 0.14, 0.02, M.eye, s*0.14, hy + 0.03, hz + hd/2 + 0.008); addBox(head, 0.09, 0.13, 0.09, M.horn, s*(hw/2 - 0.08), hy + hh/2 + 0.06, hz - 0.1); });
    addBox(g, 0.34, 0.14, 0.34, M.udder, 0, lh - 0.05, -bl*0.2);
  }
  return { g, legs, head, tail, top:[hy + hh/2, hz, hw, hd] };
}
/* corona de flores: se la pones acariciándola con flores en la mano */
const FLOWER = [[255,92,122],[255,222,72],[250,250,250],[190,122,240]].map(c => flat(c)), STEM = flat([70,150,60]);
export function addFlowers(c){ const [ty, tz, w, d] = c.top, n = 10; for (let i = 0; i < n; i++){ const a = i/n*Math.PI*2; addBox(c.head, 0.11, 0.11, 0.11, FLOWER[i % 4], Math.cos(a)*(w/2 - 0.02), ty + 0.06, tz + Math.sin(a)*(d/2 - 0.02)); addBox(c.head, 0.07, 0.05, 0.07, STEM, Math.cos(a + 0.31)*(w/2 - 0.02), ty + 0.03, tz + Math.sin(a + 0.31)*(d/2 - 0.02)); } }
export const cows = [];
export function walkableY(x, z, fy){ const bx = Math.floor(x), bz = Math.floor(z); if (bx < 1 || bx >= WX-1 || bz < 1 || bz >= WZ-1) return null;
  for (const gy of [fy+1, fy, fy-1, fy-2]){ if (gy < 1 || getB(bx, gy-1, bz) === 0) continue; if (gy === fy+1 && placed.has(bkey(bx, gy-1, bz))) continue; let clear = true; for (let y = gy; y <= Math.max(gy, fy) + 1; y++) if (getB(bx, y, bz) !== 0){ clear = false; break; } if (clear) return gy; } return null; }
export function spawnCow(p){
  const model = buildCowModel(p.i), c = { vi:p.i, p, group:model.g, legs:model.legs, head:model.head, tail:model.tail, top:model.top, x:p.center.x, z:p.center.z, y:p.H, gy:p.H, rot:Math.PI, state:'idle', t:1.5 + Math.random()*2, tx:0, tz:0, phase:Math.random()*6, bounce:0, tilt:0, w:p.i === 3 ? 2 : p.rare ? (GS.mode === 'libre' ? 1 : 0) : 1, homed:!!p.placed };
  if (p.flower) addFlowers(c);
  model.g.visible = c.w === GS.world; model.g.userData.cow = c; model.g.position.set(c.x, c.y, c.z); model.g.rotation.y = c.rot; scene.add(model.g); cows.push(c); return c;
}
export function updateCow(c, dt){
  // robada: la mueve el cuatrero o espera triste en su corral
  if (c.held){ c.state = 'idle'; c.t = 1; c.legs.forEach(l => { l.rotation.x *= 0.8; }); c.tilt += (0.4 - c.tilt)*Math.min(1, dt*5); c.head.rotation.x = c.tilt; c.y += (c.gy - c.y)*Math.min(1, dt*9); c.group.position.set(c.x, c.y, c.z); c.group.rotation.y = c.rot; return; }
  const fy = c.gy;
  // si el suelo cambió bajo la vaca (el jugador rompió o puso bloques), se reacomoda
  const bx = Math.floor(c.x), bz = Math.floor(c.z);
  if (getB(bx, fy, bz) !== 0){ let y = fy; while (y < WY-1 && getB(bx, y, bz) !== 0) y++; c.gy = y; }
  else if (getB(bx, fy-1, bz) === 0){ let y = fy; while (y > 1 && getB(bx, y-1, bz) === 0) y--; c.gy = y; }
  c.t -= dt; c.lured = false;
  if (c.eat > 0){ c.eat -= dt; c.state = 'graze'; c.t = 0.5; if (Math.random() < dt*0.5) spawnP(TEX.heart, c.x, c.y + 1.7, c.z, 0, 1, 0, 1.2, 0.28, 0xff5a7a); }   // le diste heno: se queda comiendo donde está
  else if (LATE.HOTBAR && LATE.HOTBAR[GS.slot] === B.HAY){ const d = Math.hypot(player.x - c.x, player.z - c.z);   // con heno en la mano, las vacas te siguen
    if (d < 11){ c.lured = true; if (d > 2.4){ c.tx = player.x; c.tz = player.z; c.state = 'walk'; c.t = 2; } else if (c.state === 'walk'){ c.state = 'idle'; c.t = 0.8; if (Math.random() < 0.3) spawnP(TEX.heart, c.x, c.y + 1.7, c.z, 0, 1.1, 0, 1.2, 0.3, 0xff5a7a); } } }
  if (c.state === 'idle'){ if (c.t <= 0){ if (Math.random() < 0.62){ const a = Math.random()*Math.PI*2, r = 2 + Math.random()*8; c.tx = clamp(p_cx(c) + Math.cos(a)*r, 2.5, WX-2.5); c.tz = clamp(p_cz(c) + Math.sin(a)*r, 2.5, WZ-2.5); c.state = 'walk'; c.t = 9; } else { c.state = 'graze'; c.t = 2.5 + Math.random()*2.5; } } }
  else if (c.state === 'graze'){ if (c.t <= 0){ c.state = 'idle'; c.t = 1 + Math.random()*2.5; } }
  else if (c.state === 'walk'){
    const dx = c.tx - c.x, dz = c.tz - c.z, dist = Math.hypot(dx, dz);
    if (dist < 0.35 || c.t <= 0){ c.state = 'idle'; c.t = 1 + Math.random()*3; }
    else { const ux = dx/dist, uz = dz/dist, want = Math.atan2(ux, uz); let dr = want - c.rot; while (dr > Math.PI) dr -= Math.PI*2; while (dr < -Math.PI) dr += Math.PI*2; c.rot += clamp(dr, -3*dt, 3*dt);
      if (Math.abs(dr) < 0.6){ const px = -uz, pz = ux; let ok = true;
        for (const [f, s] of [[0.62, 0], [0.5, 0.33], [0.5, -0.33]]){ if (walkableY(c.x + ux*f + px*s, c.z + uz*f + pz*s, c.gy) == null){ ok = false; break; } }
        if (ok){ const st = (c.lured ? 2.3 : 1.25)*dt; c.x += ux*st; c.z += uz*st; const g2 = walkableY(c.x, c.z, c.gy); if (g2 != null) c.gy = g2; c.phase += dt*7; }
        else { c.state = 'idle'; c.t = 0.6 + Math.random(); } } }
  }
  c.y += (c.gy - c.y) * Math.min(1, dt*9);
  if (c.bounce > 0) c.bounce = Math.max(0, c.bounce - dt*2.2);
  const walking = c.state === 'walk', sw = walking ? Math.sin(c.phase)*0.55 : 0;
  c.legs[0].rotation.x += (sw - c.legs[0].rotation.x)*Math.min(1, dt*14); c.legs[3].rotation.x = c.legs[0].rotation.x; c.legs[1].rotation.x = -c.legs[0].rotation.x; c.legs[2].rotation.x = -c.legs[0].rotation.x;
  const wantTilt = c.state === 'graze' ? 0.95 + Math.sin(GS.playTime*6)*0.06 : (walking ? 0.06 : Math.sin(GS.playTime*0.8 + c.phase)*0.05); c.tilt += (wantTilt - c.tilt)*Math.min(1, dt*5); c.head.rotation.x = c.tilt;
  c.tail.rotation.z = Math.sin(GS.playTime*2.4 + c.phase)*0.35; c.tail.rotation.x = -0.15;
  c.group.position.set(c.x, c.y + Math.abs(Math.sin(c.bounce*Math.PI*2))*0.3*c.bounce, c.z); c.group.rotation.y = c.rot;
}
export const p_cx = c => c.p.center.x, p_cz = c => c.p.center.z;
export function petCow(c){ sndMoo(COW_DEFS[c.vi].pitch); c.bounce = 1;
  if (LATE.HOTBAR[GS.slot] === B.HAY && !c.held){ c.eat = 45; LATE.toast('¡Ñam! Se queda comiendo un buen rato.'); }
  if (LATE.HOTBAR[GS.slot] === B.FLOWERS && !c.p.flower){ if (c.vi === 3) LATE.toast('La Vaca Real ya tiene su corona.'); else { c.p.flower = true; addFlowers(c); writeSave(); LATE.toast('¡Le pusiste una corona de flores!'); } } const D = COW_DEFS[c.vi]; for (let i = 0; i < 7; i++) spawnP(TEX.heart, c.x + (Math.random()-0.5)*0.9, c.y + D.legH + D.body[1] + 0.3 + Math.random()*0.3, c.z + (Math.random()-0.5)*0.9, (Math.random()-0.5)*0.5, 1.1 + Math.random()*0.6, (Math.random()-0.5)*0.5, 1.3, 0.34, 0xff5a7a); }
export const raycaster = new THREE.Raycaster();

/* enlaces tardíos */
late('COW_DEFS', () => COW_DEFS);
late('spawnCow', () => spawnCow);
late('cows', () => cows);

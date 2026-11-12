/* UTILIDADES */
import * as THREE from 'three';

export const $ = id => document.getElementById(id);
export function hash2(x, y, s){ let h = Math.imul(x|0, 374761393) ^ Math.imul(y|0, 668265263) ^ Math.imul(s|0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x, y, s){ const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf); const a = hash2(xi,yi,s), b = hash2(xi+1,yi,s), c = hash2(xi,yi+1,s), d = hash2(xi+1,yi+1,s); return a + (b-a)*u + (c-a)*v + (a-b-c+d)*u*v; }
export function fbm(x, y, s){ let t = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++){ t += a * vnoise(x*f, y*f, s + i*17); a *= 0.5; f *= 2; } return t / 0.9375; }
export function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const pick = (pal, t) => pal[clamp(Math.floor(t * pal.length), 0, pal.length - 1)];
export const rgb = c => `rgb(${c[0]|0},${c[1]|0},${c[2]|0})`;
export const mul = (c, k) => [c[0]*k, c[1]*k, c[2]*k];
export const lin = (r, g, b) => new THREE.Color().setRGB(r/255, g/255, b/255, THREE.SRGBColorSpace);
export function fmtTime(s){ s = Math.max(0, Math.round(s)); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); }
export function mkCanvas(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
/* textura pixel art desde una función (x,y) -> [r,g,b] | [r,g,b,a] | null */
export function pxTex(w, h, fn){ const c = mkCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const col = fn(x, y), i = (y*w + x)*4; if (!col){ img.data[i+3] = 0; continue; } img.data[i] = col[0]; img.data[i+1] = col[1]; img.data[i+2] = col[2]; img.data[i+3] = col.length > 3 ? col[3] : 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; return t; }

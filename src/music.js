/* MÚSICA: secuenciador chiptune sintetizado (sin archivos). 4 temas de día en orden aleatorio y 1 de tensión para la noche. */
import { GS } from './state.js';
import { $ } from './util.js';
import { audioCtx, initAudio } from './audio.js';
import { writeSave } from './save.js';
import { isTense } from './adventure.js';

const SEMI = { C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 };
const hz = n => { const m = /^([A-G][#b]?)(\d)$/.exec(n); return 440 * Math.pow(2, (SEMI[m[1]] + (m[2] - 4)*12 - 9)/12); };
const CH = { C:['C3','E3','G3'], Am:['A2','C3','E3'], F:['F2','A2','C3'], G:['G2','B2','D3'], D:['D3','F#3','A3'], Em:['E2','G2','B2'], Dm:['D3','F3','A3'], Bb:['Bb2','D3','F3'], Gm:['G2','Bb2','D3'], A:['A2','C#3','E3'], E:['E2','G#2','B2'] };
/* Cada compás tiene 8 corcheas. En la melodía: nota = ataque, "." = sostiene la anterior, "-" = silencio. */
const T = (name, o) => Object.assign({ name, swing:0, lead:'square', leadVol:0.05, cutoff:2000, arp:true, drums:'soft', bass:'walk' }, o, { mel:o.mel.map(b => b.split(' ')), chords:o.chords.map(c => c.split(' ')) });
const DAY_TRACKS = [
  T('Pradera', { bpm:104, swing:0.1, chords:['C','Am','F','G','C','Am','F G','C'], mel:[
    'E5 . G5 . C6 . G5 .', 'A5 . G5 E5 . . C5 .', 'F5 . A5 . C6 . A5 .', 'G5 . F5 D5 . . G4 .',
    'E5 G5 C6 . B5 . G5 .', 'A5 . C6 A5 . . E5 .', 'F5 E5 D5 . G5 F5 E5 D5', 'C5 . . . - - - -'] }),
  T('Manos a la obra', { bpm:112, swing:0.14, drums:'bounce', chords:['G','G','C','D','Em','C','D','G'], mel:[
    'G4 B4 D5 B4 G4 B4 D5 .', 'G5 . D5 . B4 . D5 .', 'E5 C5 E5 G5 . E5 C5 .', 'D5 . F#5 . A5 . F#5 .',
    'G5 . E5 . B4 . E5 .', 'C5 E5 G5 E5 C5 . E5 .', 'D5 E5 F#5 A5 . F#5 D5 .', 'G5 . . . D5 . G4 .'] }),
  T('Siesta', { bpm:92, lead:'triangle', leadVol:0.11, cutoff:3200, drums:'none', chords:['F','Dm','Bb','C','F','Dm','Gm C','F'], mel:[
    'A4 . . C5 . . F5 .', 'F5 . E5 D5 . . A4 .', 'Bb4 . . D5 . . F5 .', 'E5 . D5 C5 . . . .',
    'A4 . C5 . F5 . A5 .', 'G5 . F5 D5 . . F5 .', 'G5 . . Bb4 . C5 E5 .', 'F5 . . . . . - -'] }),
  T('Establo', { bpm:108, swing:0.16, drums:'bounce', chords:['D','G','D','A','D','G','A','D'], mel:[
    'F#5 . A5 F#5 D5 . F#5 .', 'G5 . B5 G5 D5 . G5 .', 'A5 . F#5 . D5 E5 F#5 .', 'E5 . C#5 . A4 . E5 .',
    'F#5 A5 D6 . A5 . F#5 .', 'B5 . G5 . E5 G5 B5 .', 'A5 G5 E5 C#5 . E5 A5 .', 'D5 . . . F#5 . D5 .'] }),
];
const NIGHT_TRACK = T('Vienen los cuatreros', { bpm:126, lead:'sawtooth', leadVol:0.04, cutoff:1400, arp:false, drums:'night', bass:'pulse', chords:['Am','Am','F','E','Am','Dm','E','Am'], mel:[
  'A4 - C5 - E5 - C5 -', 'A4 - C5 - E5 . D#5 .', 'F4 - A4 - C5 - A4 -', 'E4 - G#4 - B4 . . .',
  'A4 C5 E5 A5 - E5 C5 -', 'D5 - F5 - A5 . F5 -', 'E5 - G#5 - B5 - G#5 E5', 'A5 . - - A4 . - -'] });

let ctx = null, bus = null, noise = null, cur = null, bar = 0, st = 0, loops = 0, nextT = 0, lastDay = -1;
function ensure(){
  ctx = audioCtx(); if (!ctx) return false;
  if (!bus){ const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; bus = ctx.createGain(); bus.gain.value = GS.musicOn ? 0.5 : 0; bus.connect(comp); comp.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate*0.2, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1; }
  return true;
}
function voice(type, f, t, dur, vol, cutoff, slide){
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(vol*0.55, t + Math.min(0.12, dur*0.5)); g.gain.setValueAtTime(vol*0.55, t + dur*0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o; if (cutoff){ const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.7; o.connect(lp); node = lp; }
  node.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.03);
}
function hit(t, dur, vol, type, freq){ const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.02); }
const kick = (t, v = 0.3) => voice('sine', 130, t, 0.13, v, 0, 42);
function schedule(tr, b, s, t){
  const sd = 30/tr.bpm, chs = tr.chords[b], ch = CH[chs.length > 1 && s >= 4 ? chs[1] : chs[0]], toks = tr.mel[b], tk = toks[s];
  if (tk !== '.' && tk !== '-'){ let len = 1; while (s + len < 8 && toks[s + len] === '.') len++; voice(tr.lead, hz(tk), t, len*sd*0.94, tr.leadVol, tr.cutoff); }
  if (tr.bass === 'pulse') voice('triangle', hz(ch[0]), t, sd*0.7, s % 2 ? 0.1 : 0.16);
  else if (s === 0 || s === 4) voice('triangle', hz(ch[0]), t, sd*1.8, 0.17);
  else if (s === 2 || s === 6) voice('triangle', hz(ch[2]), t, sd*1.3, 0.11);
  if (tr.arp && s % 2 === 1) voice('triangle', hz(ch[(s >> 1) % 3])*2, t, sd*0.9, 0.045);
  if (tr.drums === 'soft'){ if (s === 0 || s === 4) kick(t, 0.2); if (s % 2 === 1) hit(t, 0.03, 0.025, 'highpass', 7000); }
  else if (tr.drums === 'bounce'){ if (s === 0 || s === 4 || (s === 3 && b % 2)) kick(t, 0.24); if (s === 2 || s === 6) hit(t, 0.09, 0.05, 'bandpass', 1800); if (s % 2 === 1) hit(t, 0.03, 0.03, 'highpass', 7000); }
  else if (tr.drums === 'night'){ if (s % 2 === 0) kick(t, 0.26); hit(t, 0.025, s % 2 ? 0.035 : 0.02, 'highpass', 8000); if (s === 6 && b % 2) hit(t, 0.12, 0.06, 'bandpass', 1400); }
}
function pickTrack(){ if (isTense()) return NIGHT_TRACK; let i; do { i = Math.floor(Math.random()*DAY_TRACKS.length); } while (i === lastDay); lastDay = i; return DAY_TRACKS[i]; }
function tick(){
  if (!GS.musicOn || !ensure() || ctx.state !== 'running' || document.hidden){ nextT = 0; return; }
  const now = ctx.currentTime; if (nextT < now + 0.03){ const first = nextT === 0; nextT = now + 0.08; if (first) st = 0; }
  while (nextT < now + 0.6){
    if (st === 0 && (!cur || (cur === NIGHT_TRACK) !== isTense() || (bar === 0 && loops >= 2))){ cur = pickTrack(); bar = 0; loops = 0; }
    const sd = 30/cur.bpm; schedule(cur, bar, st, nextT + (st % 2 ? cur.swing*sd : 0)); nextT += sd;
    if (++st === 8){ st = 0; if (++bar === 8){ bar = 0; loops++; } }
  }
}
setInterval(tick, 40);
export function setMusic(on){ GS.musicOn = on; initAudio(); if (ensure()) bus.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.08); refreshMusicUI(); writeSave(); }
export function refreshMusicUI(){ $('btnMusic').textContent = 'Música: ' + (GS.musicOn ? 'activada' : 'silenciada'); }
export function musicInfo(){ return { tema: cur ? cur.name : null, compas: bar, activa: GS.musicOn }; }
$('btnMusic').onclick = () => setMusic(!GS.musicOn);
document.addEventListener('keydown', e => { if (e.code === 'KeyN' && document.body.dataset.state !== 'start') setMusic(!GS.musicOn); });

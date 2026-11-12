/* AUDIO (WebAudio sintetizado) */
import { GS, LATE } from './state.js';
import { $ } from './util.js';

export let actx = null, master = null, noiseBuf = null;
export function initAudio(){ if (actx){ if (actx.state === 'suspended') actx.resume().catch(() => {}); return; }
  try { const AC = window.AudioContext || window.webkitAudioContext; actx = new AC(); master = actx.createGain(); master.gain.value = GS.muted ? 0 : 0.6; master.connect(actx.destination);
    noiseBuf = actx.createBuffer(1, actx.sampleRate*0.3, actx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1; } catch (e){ actx = null; } }
export function tone(type, f0, f1, dur, vol, delay = 0){ if (!actx) return; const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02); }
export function sndMoo(pitch = 1){ if (!actx) return; const t = actx.currentTime, o = actx.createOscillator(), lfo = actx.createOscillator(), lg = actx.createGain(), f = actx.createBiquadFilter(), g = actx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(140*pitch, t); o.frequency.exponentialRampToValueAtTime(100*pitch, t + 0.95);
  lfo.frequency.value = 5.5; lg.gain.value = 4*pitch; lfo.connect(lg); lg.connect(o.frequency);
  f.type = 'lowpass'; f.Q.value = 4; f.frequency.setValueAtTime(360, t); f.frequency.linearRampToValueAtTime(760, t + 0.3); f.frequency.linearRampToValueAtTime(320, t + 1.05);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.14); g.gain.setValueAtTime(0.55, t + 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.12);
  o.connect(f); f.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + 1.2); lfo.stop(t + 1.2); }
export function sndPop(){ tone('sine', 420, 880, 0.09, 0.4); }
export function sndCrunch(){ if (!actx) return; const t = actx.currentTime, s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.14); f.Q.value = 0.9; g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.18); }
export function sndGood(){ tone('triangle', 660, 660, 0.1, 0.3); tone('triangle', 990, 990, 0.16, 0.3, 0.08); }
export function sndBad(){ tone('square', 170, 120, 0.2, 0.18); }
export function sndThud(){ tone('sine', 120, 70, 0.12, 0.4); }
export function sndFanfare(){ [[523,0],[659,0.14],[784,0.28],[1047,0.44],[784,0.66],[1047,0.8]].forEach(([f, d], i) => { tone('square', f, f, i === 5 ? 0.7 : 0.16, 0.16, d); tone('triangle', f/2, f/2, i === 5 ? 0.7 : 0.16, 0.22, d); }); }
export function setMuted(m){ GS.muted = m; if (master) master.gain.value = GS.muted ? 0 : 0.6; $('btnMute').textContent = 'Sonido: ' + (GS.muted ? 'silenciado' : 'activado'); $('muteTag').textContent = GS.muted ? 'Sonido silenciado (M)' : ''; LATE.writeSave(); }

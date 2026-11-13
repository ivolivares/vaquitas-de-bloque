/* GUARDADO (localStorage, siempre con try/catch) */
import { GS, LATE, late } from './state.js';

export const SAVE_KEY = 'vaquitas-de-bloque-v1';
export function loadSave(){ try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && Array.isArray(s.cows)) return s; } catch (e){} return null; }
export function writeSave(){ if (!GS.saveReady) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify({ cows: LATE.plats.map(p => p.done), times: LATE.plats.map(p => p.time), prize: GS.prizeUnlocked, mute: GS.muted, mode: GS.mode, diff: GS.diff, world: GS.world, crown: GS.crown, unlocked: GS.unlocked, hot: GS.hot, jobs: GS.jobs, fl: LATE.plats.map(p => !!p.flower), music: GS.musicOn, total: GS.totalTime, t: Math.round(GS.playTime) })); } catch (e){} }
export function resetSave(){ try { localStorage.removeItem(SAVE_KEY); } catch (e){} }

/* enlaces tardíos */
late('writeSave', () => writeSave);

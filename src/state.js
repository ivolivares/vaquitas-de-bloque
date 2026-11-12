/* Estado compartido, modo debug y enlaces tardíos entre módulos */

export const DEBUG = new URLSearchParams(location.search).get('debug') === 'true';
/* estado que cambian varios módulos */
export const GS = { prizeUnlocked:false, saveReady:false, playTime:0, slot:0, winAt:null, muted:false, mode:'aventura', diff:'facil', world:1, crown:false, newRecord:false, recover:null, inv:null, noAids:false, musicOn:true, touch:false, totalTime:null, daylight:1, joyF:0, joyS:0 };
/* enlaces tardíos: lo que un módulo necesita de otro que se carga después (se resuelve al llamar, no al importar) */
export const LATE = {};
export function late(name, get){ Object.defineProperty(LATE, name, { get, configurable:true }); }

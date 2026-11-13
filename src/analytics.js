/* ANALÍTICA: eventos anónimos del juego hacia PostHog.
   Pensado para un público infantil: sin cookies ni almacenamiento (cada visita es un visitante nuevo), sin perfiles de persona,
   sin grabación de sesiones, sin autocaptura ni encuestas. Solo se envían los eventos de juego definidos aquí.
   Si no hay token configurado (VITE_PUBLIC_POSTHOG_KEY), o en modo debug o en local, no se carga nada. */
import { DEBUG, GS } from './state.js';

const KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY, HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;
const local = ['localhost', '127.0.0.1', ''].includes(location.hostname);
export const analyticsOn = !!KEY && !!HOST && !DEBUG && !local;
let ph = null; const queue = [];
const base = () => ({ modo: GS.mode, dificultad: GS.mode === 'aventura' ? GS.diff : null, mapa: GS.world === 2 ? 'reino' : 'granja', tactil: !!GS.touch });
/* registra un evento del juego; nunca interrumpe el juego si la analítica falla */
export function track(event, props){ if (!analyticsOn) return; const p = Object.assign(base(), props); try { if (ph) ph.capture(event, p); else if (queue.length < 50) queue.push([event, p]); } catch (e){} }
if (analyticsOn) import('posthog-js').then(m => {
  const posthog = m.default;
  posthog.init(KEY, { api_host: HOST, persistence: 'memory', person_profiles: 'never', autocapture: false, capture_pageview: false, capture_pageleave: false,
    disable_session_recording: true, disable_surveys: true, capture_exceptions: false, capture_performance: false, capture_dead_clicks: false, enable_heatmaps: false,
    advanced_disable_flags: true, disable_external_dependency_loading: true });
  ph = posthog; ph.capture('$pageview'); queue.splice(0).forEach(([e, p]) => ph.capture(e, p));
}).catch(() => {});

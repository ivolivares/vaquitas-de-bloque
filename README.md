# Vaquitas de Bloque

Juego 3D en primera persona para navegador de escritorio. Explora un pequeño mundo de bloques, rellena los 3 hologramas con el pelaje correcto para dar vida a 3 vacas y gana un peluche de colección: el Ternerito Dorado.

- Código en módulos ES dentro de `src/`, empaquetado con Vite (Three.js 0.160.0 va incluido en el build, sin CDN).
- Se juega con teclado y mouse, o con controles táctiles en teléfonos y tablets.
- Dos modos: aventura (de noche llegan cuatreros a robarte las vacas) y libre.
- Tres dificultades en aventura: fácil, difícil (bloques contados, noches largas, oleadas crecientes y un cuatrero que rompe cercas) y legendario (además vacas de 23 bloques, sin ayudas y corrales que se alejan).
- Secreto: bajo el punto de inicio hay una casa enterrada con una llave que abre el Reino de Piedra, donde vive la Vaca Real (se desbloquea al armar las otras tres). Una casita de piedra te devuelve a la granja; cada mapa conserva sus bloques.
- En el reino, en difícil los cuatreros que quedaban te siguen y te empujan; en legendario además una cuadrilla le construye un búnker a la plataforma de la Vaca Real.
- Modo debug: agrega `?debug=true` a la URL (panel de condiciones con F3, K completa la plataforma más cercana, L adelanta el anochecer, J el amanecer, O cambia de mapa, T termina la tregua del reino, contador de fps).

## Desarrollo

```bash
npm install
npm run dev      # servidor local con recarga
npm run build    # genera dist/ (lo mismo que corre Vercel en cada push a main)
```

| Archivo | Contenido |
|---|---|
| `src/main.js` | Carga del progreso y bucle principal |
| `src/state.js` | Estado compartido, flag de debug y enlaces tardíos entre módulos |
| `src/blocks.js`, `src/atlas.js`, `src/world.js` | Ids de bloques, texturas pixel art y generación del terreno |
| `src/render.js` | Renderer, cielo, mallado de chunks y partículas |
| `src/player.js`, `src/actions.js` | Física, selección de bloques (DDA), romper y poner |
| `src/platforms.js`, `src/cows.js` | Hologramas, validación y vacas |
| `src/prize.js` | Escena del peluche Ternerito Dorado |
| `src/adventure.js` | Modo aventura: día y noche, cuatreros, corrales y tips |
| `src/music.js` | Música chiptune sintetizada (temas de día por mapa y 1 de noche) |
| `src/portal.js` | La llave escondida y el paso al segundo mapa, el Reino de Piedra |
| `src/records.js` | Récords por dificultad, guardados en el dispositivo |
| `src/touch.js`, `src/share.js` | Controles táctiles y botones para compartir |
| `src/ui.js`, `src/audio.js`, `src/save.js`, `src/debug.js` | HUD y menús, sonido, guardado y panel de debug |
| `public/` | Favicon, íconos, imagen Open Graph, manifest, robots y sitemap |

## Controles

| Tecla | Acción |
|---|---|
| W A S D | Moverte |
| Mouse | Mirar |
| Espacio / Shift | Saltar / correr |
| Click izquierdo | Romper bloque o acariciar vaca |
| Click derecho | Poner bloque |
| 1–9 o rueda | Elegir material |
| Click en un cuatrero | Marearlo para rodearlo con 4 bloques |
| M / N / Esc | Silenciar sonidos / música / pausa |

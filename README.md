# Vaquitas de Bloque

Juego 3D en primera persona para navegador de escritorio. Explora un pequeño mundo de bloques, rellena los 3 hologramas con el pelaje correcto para dar vida a 3 vacas y gana un peluche de colección: el Ternerito Dorado.

- Código en módulos ES dentro de `src/`, empaquetado con Vite (Three.js 0.160.0 va incluido en el build, sin CDN).
- Se juega con teclado y mouse; no tiene controles táctiles.
- Modo debug: agrega `?debug=true` a la URL (panel de condiciones con F3, tecla K para completar la plataforma más cercana, contador de fps).

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
| M / Esc | Silenciar / pausa |

# ProgressRunner PWA (Vanilla)

PWA minimal (HTML/CSS/JS) para ejecutar una rutina tipo "Runner" y llevar progreso semana a semana.

## Estructura
- `/data/routine.json` — rutina (días, ejercicios, sets/reps/tempo/descanso/técnica)
- `/data/techniques.json` — diccionario de técnicas (modales)
- `IndexedDB` guarda:
  - settings (inicio del programa)
  - logs (sets por fecha y ejercicio)

## Cómo correr (recomendado)
> PWA requiere HTTPS o localhost para Service Worker.

### VS Code Live Server
1. Abre la carpeta en VS Code
2. Click derecho a `index.html` → **Open with Live Server**
3. (Opcional) Instala como app (Chrome ⋮ → Install app)

### Python simple server
```bash
python -m http.server 5500
```
Abrir: http://localhost:5500

## Progreso (comparativo)
- Selecciona **e1RM** o **Volumen semanal**.

## Ajustes
En la app: botón ⚙️ → define **Inicio del programa (YYYY-MM-DD)** para semana 1–8.

## Versión
0.2.0 • Build 2026-01-09

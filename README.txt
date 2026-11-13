HIGHWAY RUSH — 3D CAR DRIVING GAME

Files:
- index.html: Game page and user interface
- style.css: Interface styling and responsive layout
- game.js: Three.js scene, vehicle models, controls, traffic, scoring and collision logic
- README_BN.txt: Bengali setup and control guide
- RUN_GAME.bat: Windows one-click local server launcher (requires Python)

Quick start:
1. Extract the ZIP.
2. On Windows, double-click RUN_GAME.bat (Python must be installed).
3. Or open index.html with VS Code Live Server. If needed, run a local server in this folder:
   python -m http.server 8000
   Then visit http://localhost:8000

The Three.js module is loaded from jsDelivr CDN, so an internet connection is required.

Controls:
A / Left Arrow  = steer left
D / Right Arrow = steer right
C               = switch chase / cockpit camera
P / Escape      = pause / resume
Enter           = start
R               = restart from pause or game-over screen

High score is saved in browser localStorage.


Version 2 updates: The center-road overlay has been removed. Added generated engine/road ambience, turbo and collision audio, hold-Space turbo boost (plus a touch TURBO button), a sound mute toggle, and the developer credit: Amirul & Jahidul. Audio begins after the Start button is clicked, per browser autoplay rules.

Version 3 speed fix: Normal driving speed is held at 173 KM/H. Holding Space smoothly accelerates to about 274 KM/H; releasing Space smoothly decelerates back to 173 KM/H. Space keydown/keyup handling includes a keyboard fallback and clears boost when the browser window loses focus.

# STP Viewer — Obsidian Plugin

3D STEP file previewer powered by OpenCascade WASM + Three.js.  
Rotate, zoom, and inspect CAD models directly in your vault.

## Features

- 🧊 **3D STEP/STP preview** — opens `.stp` and `.step` files as interactive 3D views
- 🔄 **Orbit controls** — rotate, pan, zoom with mouse
- 🎨 **Display modes** — solid shading, wireframe, edge overlay
- 📐 **Preset views** — ISO, front, right, top
- 📏 **1:1 scale** — actual-size rendering based on screen DPI
- 📊 **Scale bar + XYZ axes** — visual size reference

## Installation

### Manual

1. Download the latest release
2. Extract to `<vault>/.obsidian/plugins/stp-viewer/`
3. Reload Obsidian
4. Enable "STP Viewer" in Settings → Community plugins

### Build from source

```bash
npm install
npm run build
npm run install-plugin
```

## Usage

Open any `.stp` or `.step` file in your vault — the 3D viewer opens automatically.

### Controls

| Action | Input |
|--------|-------|
| Rotate | Left-click + drag |
| Pan | Right-click + drag |
| Zoom | Scroll wheel |
| Fit view | Toolbar → Fit button |

## Supported Formats

- STEP AP203 / AP214 (.stp, .step)

## Dependencies

- [OpenCascade.js](https://github.com/donalffons/opencascade.js) (WASM) — STEP parsing
- [Three.js](https://threejs.org/) — 3D rendering
- [occt-import-js](https://github.com/kovacsv/occt-import-js) — STEP → mesh conversion

## License

MIT

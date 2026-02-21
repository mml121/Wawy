# Wawy — Quantum Orbital Visualizer

A real-time, interactive hydrogen atomic orbital visualizer. Explore how quantum numbers shape electron probability densities through 2D cross-section heatmaps and 3D point cloud rendering — all in the browser with zero dependencies.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://wawy.netlify.app) ![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

## Overview

Wawy visualizes hydrogen atom wavefunctions by computing probability densities from first principles. Users can adjust quantum numbers (n, l, m) and instantly see how electron clouds change shape, size, and orientation.

## Features

- **2D Heatmap** — Cross-section density plot on the xz-plane with a scientific colormap (black to blue to cyan to white)
- **3D Point Cloud** — Monte Carlo rejection sampling with heatmap coloring by radial distance (red near nucleus, blue at edges)
- **Real-time Controls** — Adjust principal (n), angular momentum (l), and magnetic (m) quantum numbers with live re-rendering
- **Preset Orbitals** — Quick access to common orbitals: 1s, 2s, 2p, 3s, 3p, 3d, 4s, 4d, 4f
- **Interactive 3D** — Mouse and touch drag rotation with auto-spin toggle
- **Responsive** — Adapts to desktop, tablet, and mobile
- **Zero Dependencies** — Pure vanilla HTML/CSS/JS, no frameworks or build tools

## The Physics

The simulation solves the hydrogen atom Schrodinger equation analytically:

| Component | Implementation |
|-----------|---------------|
| Radial wavefunction R(r) | Associated Laguerre polynomials via recurrence relation |
| Angular wavefunction Y(θ,φ) | Real spherical harmonics using Associated Legendre polynomials |
| Probability density | \|ψ(r, θ, φ)\|² where ψ = R(r) · Y(θ, φ) |
| 3D sampling | Rejection sampling against computed max density |

### Quantum Numbers

| Symbol | Name | Range | Controls |
|--------|------|-------|----------|
| **n** | Principal | 1–7 | Energy level and orbital size |
| **l** | Angular Momentum | 0 to n−1 | Orbital shape (s, p, d, f, g, h) |
| **m** | Magnetic | −l to +l | Spatial orientation |

## Getting Started

No install or build step required:

```bash
# Option 1: Open directly
open index.html

# Option 2: Local server
npx serve .
```

## Deployment

Static site — deploy anywhere. For Netlify:

1. Connect the GitHub repo
2. Publish directory: `/`
3. No build command needed

## Architecture

```
wawy/
├── index.html            # Single-page app shell
├── css/
│   └── style.css         # Design system and responsive layout
├── js/
│   ├── simulation.js     # Wavefunction math, density grid, point cloud generation
│   ├── renderer.js       # Canvas 2D heatmap and 3D projection rendering
│   └── main.js           # UI controls, event handling, animation loop
└── README.md
```

**Separation of concerns:**
- `simulation.js` — Pure math, no DOM or canvas access
- `renderer.js` — All drawing logic, mode switching, rotation state
- `main.js` — Wires controls to simulation/renderer, handles user input

## License

MIT

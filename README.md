# Tode the Frog — Moonlit Meadow

<p align="center">
  <strong>A 3D browser survival game built with Three.js and Vite</strong><br />
  A JetBrains Academy learning project, extended with a custom game world, responsive menus, combat, power-ups, and a shared leaderboard.
</p>

<p align="center">
  <a href="https://build-a-game-with-jet-brains-academ.vercel.app/"><img src="https://img.shields.io/badge/Play-Live%20Demo-6d5dfc?style=for-the-badge" alt="Play the live game" /></a>
  <img src="https://img.shields.io/badge/JavaScript-ES%20Modules-f7df1e?style=for-the-badge&logo=javascript&logoColor=222" alt="JavaScript ES modules" />
  <img src="https://img.shields.io/badge/Three.js-3D%20Rendering-black?style=for-the-badge&logo=threedotjs&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/License-MIT-2ea44f?style=for-the-badge" alt="MIT License" />
</p>

## Overview

**Tode the Frog — Moonlit Meadow** is a browser-based 3D survival game inspired by the original [Build a Game with an AI Coding Agent](https://github.com/jetbrains-academy/game-course) course from JetBrains Academy. The player controls Tode, a small frog surviving in a stylized meadow, fighting enemies, collecting power-ups, and trying to beat previous scores.

This repository keeps the learning-project roots while developing the game into a more complete experience through custom environment art, day/night transitions, gameplay feedback, responsive menus, and deployment work.

## Play

**[Launch the live game](https://build-a-game-with-jet-brains-academ.vercel.app/)**

On a phone, the start screen supports portrait orientation, while the menu is designed to remain usable in landscape too. Touch devices use on-screen controls; desktop users can play with a keyboard.

## Features

- **3D game world** — real-time rendering powered by Three.js.
- **Survival combat** — move around the arena, attack enemies, and stay alive.
- **Dash and power-ups** — use movement and attack upgrades to change how a run plays.
- **Day/night environment** — cycle the environment mode and play under changing sky and lighting.
- **Player profile** — enter a name and select a country flag before starting a run.
- **Leaderboard** — shared Top 5 scores and a play-attempt counter through a separate API service.
- **Desktop and mobile controls** — keyboard input on desktop and touch controls on supported devices.
- **Responsive menus** — start, pause, and game-over screens designed for different viewport sizes.
- **Browser-based delivery** — built with Vite and deployable as a static site.

## Tech stack

| Area | Technology |
| --- | --- |
| Language | JavaScript (ES modules) |
| 3D rendering | [Three.js](https://threejs.org/) |
| Development server and build | [Vite](https://vite.dev/) |
| Leaderboard API | Node.js serverless API on Vercel |
| Leaderboard storage | JSONBin, accessed server-side |
| Version control | Git and GitHub |

## Run locally

### Requirements

- Node.js 20 or newer
- npm

### Start the game

From the repository root:

```bash
cd game
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

Create a production build with:

```bash
npm run build
```

Preview the production build locally with:

```bash
npm run preview
```

### Run repository tests

The repository root contains the Jest test setup. From the repository root, install its dependencies and run:

```bash
npm install
npm test
```

Some browser-smoke checks require the project's browser automation dependencies and a compatible Chromium installation.

## Leaderboard architecture

The game client calls the separate `leaderboard-api` service for shared scores and attempt counts. The API reads and writes the configured JSONBin record on the server, so the JSONBin Master Key must **never** be placed in client-side code or exposed through a `VITE_*` environment variable.

The production API needs the following server-side environment variables:

- `JSONBIN_BIN_ID` — the existing leaderboard bin.
- `JSONBIN_MASTER_KEY` — the JSONBin secret key.

Keep secrets in the deployment provider's environment-variable settings. Do not commit real credentials, tokens, or private configuration files. The API's deployment and CORS configuration must permit requests from the public game origin.

## Repository layout

```text
.
├── game/                  # Three.js game and Vite frontend
│   ├── src/
│   │   ├── components/    # Menus, environment, profile and UI
│   │   ├── data/          # Game data, including country flags
│   │   └── ...
│   ├── scripts/           # Browser and QA scripts
│   └── package.json
├── leaderboard-api/       # Server-side shared leaderboard API
├── .github/workflows/     # Automated checks
├── LICENSE
└── README.md
```

## Project background and attribution

This repository is based on the educational project **Build a Game with an AI Coding Agent** by JetBrains Academy. The original course introduces building a browser game with help from an AI coding agent. This repository contains additional implementation and customizations made on top of that learning foundation.

- [Original JetBrains Academy course repository](https://github.com/jetbrains-academy/game-course)
- [Course on Coursera](https://www.coursera.org/learn/jb-build-game-with-ai-agent/)
- [JetBrains Marketplace plugin](https://plugins.jetbrains.com/plugin/30327-build-a-game-with-ai-coding-agent/versions)
- [Original course issue tracker](https://github.com/jetbrains-academy/game-course/issues)

This is a learning and portfolio project, not an official JetBrains product release. JetBrains Academy is credited as the source of the original course project.

## License

The repository includes the MIT License from the original JetBrains Academy project. Review the [LICENSE](LICENSE) file for the applicable terms.

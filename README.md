# Tode the Frog — Moonlit Meadow

<p align="center">
  <strong>A custom 3D browser survival game built on the JetBrains Academy course project</strong><br />
  Designed, extended, and maintained by <a href="https://github.com/rezwan-ahmed-l7">Rezwan Ahmed</a>.
</p>

<p align="center">
  <a href="https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub"><img src="http://jb.gg/badges/official.svg" alt="Official JetBrains project badge for the original course project" /></a>
  <a href="https://build-a-game-with-jet-brains-academ.vercel.app/"><img src="https://img.shields.io/badge/PLAY-Live%20Game-6d5dfc?style=for-the-badge" alt="Play the live game" /></a>
  <a href="https://www.coursera.org/learn/jb-build-game-with-ai-agent/"><img src="https://img.shields.io/badge/COURSE-JetBrains%20Academy-0056D2?style=for-the-badge&logo=coursera&logoColor=white" alt="JetBrains Academy course" /></a>
  <a href="https://plugins.jetbrains.com/plugin/30327-build-a-game-with-ai-coding-agent/versions"><img src="https://img.shields.io/badge/JetBrains%20Marketplace-Course-6b59fe?style=for-the-badge&logo=jetbrains&logoColor=white" alt="JetBrains Marketplace course" /></a>
  <img src="https://img.shields.io/badge/JavaScript-ES%20Modules-f7df1e?style=for-the-badge&logo=javascript&logoColor=222" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Three.js-3D%20Rendering-black?style=for-the-badge&logo=threedotjs&logoColor=white" alt="Three.js" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-2ea44f?style=for-the-badge" alt="MIT License" /></a>
</p>

## About the project

**Tode the Frog — Moonlit Meadow** is a browser-based 3D survival game that I developed by extending the *Build a Game with an AI Coding Agent* educational project from JetBrains Academy. I used **WebStorm** as my main development IDE and JavaScript, Three.js, and Vite to build and refine the game.

You play as Tode, a frog surviving in a stylized meadow. Move through the arena, fight incoming enemies, use dash and attack abilities, collect power-ups, and aim for a new high score. Beyond the original learning foundation, this repository focuses on a richer game world, combat feedback, day/night atmosphere, responsive desktop/mobile controls, and an online leaderboard.

**[Play Tode the Frog — Moonlit Meadow](https://build-a-game-with-jet-brains-academ.vercel.app/)**

## Game features

### World design and atmosphere

The game world is designed as a stylized meadow rather than an empty arena. The environment includes:

- A custom sky gradient and atmospheric lighting that changes throughout the day/night cycle.
- A moving sun and moon, stars at night, and changing daylight, dusk, and moonlit colors.
- Drifting clouds and independently flying birds to give the sky depth and life.
- Fireflies in darker hours and butterflies in daylight.
- A varied meadow with trees, bushes, rocks, houses, and ponds placed around the playable space.
- Environmental spacing and collision boundaries that keep scenery and gameplay readable.

### Gameplay

- **Survival combat:** fight different enemy types with distinct behaviors and difficulty.
- **Attack and dash:** attack nearby enemies and dash to reposition or avoid danger.
- **Health and progression:** monitor health, score, level, combos, and run performance.
- **Power-ups:** collect upgrades that change or improve abilities during a run.
- **Combat feedback:** hit effects, damage numbers, particles, screen shake, and enemy defeat animations.
- **Day/night selection:** switch between automatic cycling, daytime, and nighttime.
- **Pause and restart:** pause a run, resume it, restart, or return to the main menu.
- **Personal best:** local high-score tracking and end-of-run stats.

### Desktop and mobile play

The game runs in a modern browser without a separate installer.

- **Desktop:** keyboard gameplay, mouse-wheel camera zoom, and drag-to-orbit camera control.
- **Mobile:** on-screen joystick, Attack and Dash buttons, compact health/score/control HUD, and responsive portrait/landscape layouts.
- **Two-finger camera zoom:** pinch outward to zoom in and pinch inward to zoom out on the game canvas.
- **Adjustable view:** orbit the camera to see the arena and nearby threats from a different angle.

### Shared online leaderboard

A separate server-side API connects the game to the existing JSONBin-backed data store.

- Shared Top 5 leaderboard fetched from the online API.
- Player name and country-flag selection.
- Score submission after a run, with rank feedback when the score qualifies.
- A shared play-attempt counter.
- Server-side storage credentials, kept out of the public frontend bundle.

Leaderboard updates depend on network/API availability; the game itself is browser-based, while shared scores require an internet connection.

## Screenshots and gameplay gallery

Add real screenshots from the deployed game to the paths below. Captures from both daytime and moonlit gameplay, plus a mobile landscape view, will make this repository easier to evaluate.

<!-- Save real screenshots in docs/images/ and uncomment the relevant image lines when they are added. Do not use mockups in place of actual gameplay captures. -->

<!--
<p align="center">
  <img src="docs/images/gameplay-day.png" width="48%" alt="Tode the Frog gameplay during daytime" />
  <img src="docs/images/gameplay-night.png" width="48%" alt="Tode the Frog gameplay at night" />
</p>
<p align="center">
  <img src="docs/images/gameplay-mobile-landscape.png" width="70%" alt="Tode the Frog on a mobile screen in landscape orientation" />
</p>
-->

## JetBrains Academy course completion

The original learning path for this project is the JetBrains Academy *Build a Game with an AI Coding Agent* course. I completed the course and am keeping this section for the course completion certificate.

<!-- Add your actual certificate image as docs/images/jetbrains-course-certificate.png, then uncomment the image below. -->
<!-- <p align="center"><img src="docs/images/jetbrains-course-certificate.png" width="72%" alt="JetBrains Academy Build a Game with an AI Coding Agent course completion certificate" /></p> -->

## Tech stack and tools

| Area | Technology |
| --- | --- |
| Main language | JavaScript (ES modules) |
| 3D rendering | [Three.js](https://threejs.org/) |
| Frontend tooling | [Vite](https://vite.dev/) |
| Main IDE | [WebStorm](https://www.jetbrains.com/webstorm/) |
| Course foundation | [JetBrains Academy — Build a Game with an AI Coding Agent](https://www.coursera.org/learn/jb-build-game-with-ai-agent/) |
| Online leaderboard API | Node.js serverless API on Vercel |
| Shared leaderboard storage | JSONBin, accessed server-side |
| Version control and CI | Git, GitHub, GitHub Actions |

## Run locally

### Requirements

- Node.js and npm
- A modern browser with WebGL support

### Start the game

From the repository root:

```bash
cd game
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

Build and preview the production frontend:

```bash
npm run build
npm run preview
```

The game can run locally without the shared leaderboard backend, but online scores and attempt counts require the deployed API and its configured server-side credentials.

## Leaderboard configuration and security

The separate `leaderboard-api` service reads and writes the configured JSONBin record. Its deployment requires server-side environment variables:

- `JSONBIN_BIN_ID` — the existing leaderboard bin identifier.
- `JSONBIN_MASTER_KEY` — the secret key used by the API.

**Never place the JSONBin Master Key in frontend code or a `VITE_*` environment variable.** Configure secrets in the API deployment settings and allow only the intended public game origins. Do not commit private keys, tokens, or local environment files.

## Repository structure

```text
.
├── game/                  # Three.js game and Vite frontend
│   ├── public/            # 3D models and public assets
│   ├── src/
│   │   ├── components/    # Gameplay systems, environment, camera and UI
│   │   ├── data/          # Game data, including country flags
│   │   └── utils/         # Shared utilities and persistence
│   ├── scripts/           # Browser and QA scripts
│   └── tests/             # Game tests
├── leaderboard-api/       # Server-side leaderboard API
├── .github/workflows/     # Automated checks
├── LICENSE
└── README.md
```

## Original project, authorship, and attribution

This repository builds on the educational **Build a Game with an AI Coding Agent** project published by **JetBrains Academy / JetBrains s.r.o.** The original course teaches you to plan, build, and polish a 3D browser game inside **WebStorm or another JetBrains IDE**, using an AI coding agent to turn ideas into working code. It follows Tode the Frog and encourages learners to customize the visuals and make the game their own.

The original course and its official JetBrains project badge are retained here as attribution to the upstream learning project. The game-world extensions, gameplay refinements, responsive UI work, camera interaction, leaderboard integration, and portfolio presentation in this repository are my own ongoing customizations. This customized repository is not a separate official JetBrains product.

- **Portfolio project maintainer:** [Rezwan Ahmed](https://github.com/rezwan-ahmed-l7)
- **Original course publisher:** [JetBrains Academy](https://github.com/jetbrains-academy/game-course)
- **Course:** [Build a Game with an AI Coding Agent on Coursera](https://www.coursera.org/learn/jb-build-game-with-ai-agent/)
- **JetBrains Marketplace:** [Build a Game with an AI Coding Agent](https://plugins.jetbrains.com/plugin/30327-build-a-game-with-ai-coding-agent/versions)
- **Original course issues and discussions:** [jetbrains-academy/game-course](https://github.com/jetbrains-academy/game-course/issues)
- **Contribution guidelines for the original project:** [JetBrains Academy contributing guidelines](https://github.com/jetbrains-academy/.github/blob/main/contributing_guidelines.md)

The official badge above refers to the original JetBrains Academy course project. This repository presents my customizations of that learning project; it should not be mistaken for a separate official JetBrains product.

## Questions and contributions

For questions about the original course tasks or issues in the upstream learning materials, use the [original course issue tracker](https://github.com/jetbrains-academy/game-course/issues). Before contributing to the upstream project, review the [JetBrains Academy contribution guidelines](https://github.com/jetbrains-academy/.github/blob/main/contributing_guidelines.md).

## License

See [LICENSE](LICENSE) for the license included with the original project. The original course and its materials remain credited to their publisher.

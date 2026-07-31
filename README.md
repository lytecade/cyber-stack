# CyberStack

An arcade-style tower stacking game with a cyberpunk/sci-fi aesthetic.

## Overview

Build the tallest tower possible by dropping moving slabs on top of each other.
Any edge that doesn't overlap with the block below gets sliced off, shrinking
your next block. The game ends when a block misses entirely and falls away.

## Controls

| Input | Action |
|-------|--------|
| **Space** / **Enter** | Drop the current block |
| **Tap** / **Click** | Drop the current block |

## How to Play

1. Open `index.html` in a modern web browser.
2. Press any key, tap, or click on the title screen to start.
3. A block will slide horizontally above your tower — time your placement carefully.
4. Drop the block with **Space**, **Enter**, or a tap/click.
5. The non-overlapping portion is sliced off; the remaining part becomes your next base.
6. Score 1 point per successful stack. Beat your high score!

## Game Features

- **Square canvas** that auto-scales to fit any screen size.
- **Cyberpunk neon visuals** using the Arne16 color palette.
- **Particle effects** on every slice.
- **Responsive controls** for both desktop (keyboard) and mobile (touch).
- **High score** saved to `localStorage` between sessions.
- **Zero external dependencies** — pure HTML, CSS, and JavaScript.

Works in any modern browser with Canvas 2D support (Chrome, Firefox, Safari, Edge).

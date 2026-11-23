# Solmar Bay — Sunset Streets

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/hadiba924-prog/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/hadiba924-prog/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original 3D open-world crime game set in the fictional coastal city of Solmar Bay. Built for the make.fun bounty [gta6-01](https://make.fun/bounty/gta6-01).

## The story

You play Danny Cruz, a courier who gets pulled into a turf war with a dockside gang. What starts as one bad delivery turns into a fight for the whole bay — and Danny is the only one who can finish it.

## What you can do

- **Explore Solmar Bay** on foot or behind the wheel — drive the streets, take shortcuts through alleys, and watch the sunset over the water.
- **Steal cars** — if you see a ride you like, take it. Just be ready for the consequences.
- **Living city** — AI traffic and pedestrians keep the streets busy, so the city feels alive even when you're not causing trouble.
- **Wanted system** — cause chaos and the police come after you. The wanted level runs from 1 to 5 stars, and the higher it climbs, the harder they chase.
- **7 story missions** — a sequential story campaign with on-screen markers and clear objectives that take you deeper into the gang war.
- **Combat** — a pistol for when talking doesn't work.
- **10 collectible coins** hidden around the city — find them all.
- **Progression** — earn money and respect, and climb the ranks from Rookie all the way to Bay Legend.
- **Autosave** — progress is saved automatically to localStorage, so you can pick up right where you left off.
- **Synthesized sound** — engine hums, sirens, and gunfire generated live with WebAudio, no audio files needed.
- **Full game flow** — start screen, pause menu, and WASTED / BUSTED screens when things go wrong.

## How to play

1. From the root of this repo, run:

   ```bash
   node serve.ts
   ```

2. Open <http://localhost:8080> in desktop Chrome.
3. Play with keyboard and mouse — the full control guide is shown inside the game.

The game runs entirely from local static files and makes no network requests while playing.

## Tech

- three.js (vendored locally)
- Plain JavaScript — no build step, no bundler, no framework
- Static files served by `node serve.ts`

## License

MIT

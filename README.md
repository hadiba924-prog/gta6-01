# Solmar Bay — Sunset Streets

An original open-world crime game that runs in desktop Chrome from static
files. No network requests, no accounts, no downloads at play time.

**Bounty:** https://make.fun/bounty/gta6-01

## The game

Danny Cruz came back to Solmar Bay with empty pockets and a fast right foot.
One courier job turned into a war with the dockside crews — and the whole
city is watching. Explore a sun-soaked coastal city on foot and by car,
steal cars, outrun the Bay PD, and finish 7 story missions to become a
legend of the coast.

## How to play

Serve the `game/` folder with any static server (for example
`node serve.ts` from this repo) and open it in desktop Chrome.

- **W A S D** — move / drive
- **Mouse** — look (click the game to lock the pointer)
- **Click** — shoot the pistol
- **E** — steal / enter a car, exit a car
- **Shift** — sprint
- **Space** — jump / handbrake
- **R** — reload
- **Esc** — pause
- **M** — toggle music

Progress (money, respect, mission, coins) saves to localStorage automatically.

## Features

- **Open world:** a 6×6-block coastal city with a beach, ocean, marina,
  palms, traffic, and pedestrians who flee from gunfire.
- **Driving:** steal any parked or traffic car; arcade handling with
  handbrake drifts, skid marks, and crash damage.
- **Wanted system:** 1–5 stars. Police cruisers chase and ram you, foot
  cops close in, shoot, and try to bust you. Lay low and the heat cools off.
- **7 story missions:** courier runs, a street race with checkpoints, a
  warehouse shootout, a hot-pursuit escape, beach cash collection, and a
  final marina score with a gold getaway car and a yacht.
- **Combat:** hitscan pistol with tracers, muzzle flash, reloads, gang
  rivals who shoot back, and cars that explode when shot enough.
- **Activities:** 10 gold coins hidden around the city ($100 each).
- **Progression:** money, respect, and ranks from Rookie to Bay Legend.
- **HUD:** health bar, cash, rank, wanted stars, mission objective with
  distance, speedometer, and a live round minimap.
- **Polish:** start screen, pause, WASTED / BUSTED screens, mission
  banners, particles, explosions, camera shake, and a full WebAudio synth
  soundtrack — engine hum, sirens, gunshots, and a sunset groove. No audio
  files.

## Screenshots

`?shot=start|play|end&seed=1` stages a deterministic scene for each
screenshot: the title over the city, a police chase with the HUD and
minimap, and the mission-complete celebration at the yacht.

## Structure

- `game/index.html` — page, HUD, menus, import map
- `game/src/main.js` — bootstrap and game loop
- `game/src/city.js` — the city: buildings, roads, beach, props, collision
- `game/src/player.js` — on-foot movement and the third-person camera
- `game/src/vehicles.js` — car factory, driving physics, traffic AI
- `game/src/pedestrians.js` — locals who wander and flee
- `game/src/police.js` — wanted level and Bay PD chases
- `game/src/combat.js` — shooting, rivals, exploding cars
- `game/src/missions.js` — the 7-mission story and progression
- `game/src/hud.js` — HUD and minimap
- `game/src/effects.js` — particles, skid marks, floating text, shake
- `game/src/audio.js` — synthesized WebAudio sound and music
- `game/src/input.js` — keyboard, mouse, pointer lock
- `game/src/save.js` — localStorage saves
- `game/src/shots.js` — deterministic screenshot staging
- `game/src/config.js` — tuning constants
- `game/src/rng.js` — seeded random
- `game/vendor/three.module.min.js` — three.js (vendored)

## License

MIT — see `LICENSE`.

// Solmar Bay — Sunset Streets: the entry program.
//
// Copies the static game/ and screenshots/ folders from this repository
// into the output directory and writes /output/dossier.json with the
// kit's buildDossier helper, so the gate can check the entry byte for byte.
//
// Run it locally with:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { buildDossier } from './vendor/makefun-game.ts';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

await mkdir(join(outDir, 'game'), { recursive: true });
await mkdir(join(outDir, 'screenshots'), { recursive: true });

await cp(gameDir, join(outDir, 'game'), { recursive: true });
await cp(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = await buildDossier(repoRoot, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

await writeFile(join(outDir, 'dossier.json'), dossier);
console.log(`dossier written: ${join(outDir, 'dossier.json')}`);

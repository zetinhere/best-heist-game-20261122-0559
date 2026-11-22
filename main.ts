// The Meridian Vault — entrypoint (Node 22, standard library only).
//
// Hands the game in: copies game/ and screenshots/ from this repository
// into the output directory and writes /output/dossier.json with
// buildDossier from vendor/makefun-game.ts, exactly as the scorer
// recomputes it. Runs twice with the same bytes.
//
// The output directory is MAKEFUN_OUTPUT_DIR, or /output. Only its
// CONTENTS are cleared and chmodded: never rmSync or chmod the output
// directory itself — the grader runs as uid 65534 with a root-owned
// /output, so touching the directory itself fails with EPERM.

import { cpSync, readdirSync, rmSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(out, { recursive: true });

// Clear only the contents of the output directory.
for (const entry of readdirSync(out)) {
  rmSync(join(out, entry), { recursive: true, force: true });
}

// The game and its screenshots, byte for byte.
cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The dossier: byte for byte what the scorer recomputes from game/ and
// screenshots/ with the same library and caps.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// Permissions on the contents only: files 0644, directories 0755.
// The output directory itself is never chmodded.
function chmodTree(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      chmodSync(p, 0o755);
      chmodTree(p);
    } else {
      chmodSync(p, 0o644);
    }
  }
}
chmodTree(out);
chmodSync(join(out, 'dossier.json'), 0o644);

console.log(`wrote ${out} (game, screenshots, dossier.json)`);

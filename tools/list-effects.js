import fs from 'node:fs';

const t = JSON.parse(fs.readFileSync(new URL('../src/effects/eldenring-chaosmod.json', import.meta.url), 'utf8'));
for (const [name, e] of Object.entries(t.effects)) {
  const keys = e.keys ?? e.steps?.[0]?.keys ?? [];
  console.log(`${name.padEnd(36)} ${(e.label ?? '').padEnd(12)} ${e.kind.padEnd(8)} ${keys.join('+')}`);
}

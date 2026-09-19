import 'dotenv/config';
import fs from 'node:fs';

const profile = process.env.PROFILE || 'hexinton';
const t = JSON.parse(fs.readFileSync(new URL(`../src/profiles/${profile}.json`, import.meta.url), 'utf8'));
console.log(`profile: ${profile} (backend: ${t.backend})
`);
for (const [name, e] of Object.entries(t.effects)) {
  const kind = e.every ? 'repeat' : e.off ? 'toggle' : 'once';
  const first = (e.on ?? e.every ?? [])[0] ?? [];
  console.log(`${name.padEnd(26)} ${(e.label ?? '').padEnd(14)} ${kind.padEnd(7)} ${first.join(' ').slice(0, 60)}`);
}

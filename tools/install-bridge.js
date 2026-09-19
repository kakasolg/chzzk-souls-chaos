// ce/chaos-bridge.lua 를 Cheat Engine 의 autorun 폴더에 복사한다 (CE 시작 시 자동 실행).
// 사용: npm run install-bridge [-- "C:\경로\Cheat Engine 7.6"]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../ce/chaos-bridge.lua');

const candidates = [
  process.argv[2],
  path.join(os.homedir(), 'scoop/apps/cheat-engine/current'),
  ...fs.existsSync('C:/Program Files')
    ? fs.readdirSync('C:/Program Files').filter((d) => /^cheat engine/i.test(d)).map((d) => `C:/Program Files/${d}`)
    : [],
  ...fs.existsSync('C:/Program Files (x86)')
    ? fs.readdirSync('C:/Program Files (x86)').filter((d) => /^cheat engine/i.test(d)).map((d) => `C:/Program Files (x86)/${d}`)
    : [],
].filter(Boolean);

const ceDir = candidates.find((d) => fs.existsSync(path.join(d, 'autorun')));
if (!ceDir) {
  console.error('Cheat Engine 폴더를 찾지 못했습니다. 경로를 인자로 주세요:\n  npm run install-bridge -- "C:\\Program Files\\Cheat Engine 7.6"');
  process.exit(1);
}
const dest = path.join(ceDir, 'autorun', 'chaos-bridge.lua');
fs.copyFileSync(SRC, dest);
console.log(`✔ 설치됨: ${dest}\nCheat Engine 을 (재)시작하면 브릿지가 자동으로 켜집니다. 확인: Ctrl+Alt+L 창에 "[chaos] bridge ready" 표시`);

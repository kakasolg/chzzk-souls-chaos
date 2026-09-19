// Cheat Engine 을 띄우고(없으면), eldenring.exe 에 붙이고, Hexinton 테이블을 불러와 [ Enable ] 까지 켠다.
// 사용: npm run attach            (.env 의 HEXINTON_CT 경로 사용)
//       npm run attach -- "C:\path\to\table.CT"
import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ct = process.argv[2] || process.env.HEXINTON_CT;
if (!ct || !fs.existsSync(ct)) {
  console.error('치트 테이블 경로가 없습니다. .env 에 HEXINTON_CT=... 를 넣거나 인자로 주세요.');
  process.exit(1);
}
const dir = process.env.CHAOS_BRIDGE_DIR || path.join(os.tmpdir(), 'chzzk-souls-chaos');
const log = path.join(dir, 'bridge.log');
const cmd = path.join(dir, 'cmd.txt');
fs.mkdirSync(dir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tail = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split(/\r?\n/).at(-1) : '');

// 1. CE 실행 (이미 떠 있으면 재사용)
const ceCandidates = [
  process.env.CHEAT_ENGINE_EXE,
  path.join(os.homedir(), 'scoop/apps/cheat-engine/current/cheatengine-x86_64.exe'),
  'C:/Program Files/Cheat Engine 7.6/cheatengine-x86_64.exe',
  'C:/Program Files/Cheat Engine 7.5/cheatengine-x86_64.exe',
].filter((p) => p && fs.existsSync(p));

const before = tail();
fs.appendFileSync(cmd, 'ping\n');
await sleep(600);
let alive = tail() !== before && tail().includes('pong');
if (!alive) {
  if (!ceCandidates.length) {
    console.error('Cheat Engine 을 찾지 못했습니다. .env 에 CHEAT_ENGINE_EXE 를 지정하세요.');
    process.exit(1);
  }
  console.log('Cheat Engine 실행:', ceCandidates[0]);
  spawn(ceCandidates[0], [], { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 40 && !alive; i++) {
    await sleep(500);
    alive = tail().includes('bridge ready');
  }
  if (!alive) {
    console.error('브릿지가 응답하지 않습니다. npm run install-bridge 를 먼저 실행했는지 확인하세요.');
    process.exit(1);
  }
}

// 2. 프로세스 부착 + 테이블 로드 + Enable
console.log('테이블 로드 중 (최대 1~2분)…');
fs.appendFileSync(cmd, `setup ${ct}\n`);
for (let i = 0; i < 240; i++) {
  await sleep(500);
  const t = tail();
  if (t.includes('setup:')) {
    console.log('✔', t);
    process.exit(0);
  }
  if (t.includes('FAIL setup')) {
    console.error('✖', t);
    process.exit(1);
  }
}
console.error('시간 초과 — bridge.log 를 확인하세요:', log);
process.exit(1);

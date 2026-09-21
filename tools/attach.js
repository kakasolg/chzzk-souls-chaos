// Cheat Engine 을 띄우고(없으면), eldenring.exe 에 붙이고, Hexinton 테이블을 불러와 [ Enable ] 까지 켠다.
// 사용: npm run attach            (.env 의 HEXINTON_CT 경로 사용)
//       npm run attach -- "C:\path\to\table.CT"
import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';

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
const logSize = () => (fs.existsSync(log) ? fs.statSync(log).size : 0);
const tail = (n = 1) => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split(/\r?\n/).slice(-n).join('\n') : '');
const ceRunning = () => /cheatengine/i.test(execSync('tasklist /FI "IMAGENAME eq cheatengine-x86_64.exe" /NH', { encoding: 'utf8' }));

/** 명령을 보내고, 로그에 pattern 이 새로 찍힐 때까지 기다린다 (timeoutMs). 새로 찍힌 줄들을 돌려준다. */
async function send(line, pattern, timeoutMs) {
  const before = logSize();
  fs.appendFileSync(cmd, line + '\n');
  for (let waited = 0; waited < timeoutMs; waited += 250) {
    await sleep(250);
    if (logSize() > before) {
      const added = fs.readFileSync(log, 'utf8').slice(before);
      if (pattern.test(added)) return added.trim();
    }
  }
  return null;
}

// 1. CE 가 없으면 실행. 이미 떠 있으면 재사용 (두 개가 뜨면 큐를 서로 뺏어간다)
if (ceRunning()) {
  console.log('Cheat Engine 이미 실행 중 — 재사용');
} else {
  const exe = [
    process.env.CHEAT_ENGINE_EXE,
    path.join(os.homedir(), 'scoop/apps/cheat-engine/current/cheatengine-x86_64.exe'),
    'C:/Program Files/Cheat Engine 7.6/cheatengine-x86_64.exe',
    'C:/Program Files/Cheat Engine 7.5/cheatengine-x86_64.exe',
  ].find((p) => p && fs.existsSync(p));
  if (!exe) {
    console.error('Cheat Engine 을 찾지 못했습니다. .env 에 CHEAT_ENGINE_EXE 를 지정하세요.');
    process.exit(1);
  }
  console.log('Cheat Engine 실행:', exe);
  spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
}

// 2. 브릿지 응답 확인 (CE 시작에 20~30초 걸릴 수 있음)
if (!(await send('ping', /pong/, 60000))) {
  console.error('브릿지가 응답하지 않습니다 (60초). npm run install-bridge 를 했는지, CE 창에 팝업이 떠 있지 않은지 확인하세요.');
  process.exit(1);
}

// 3. 프로세스 부착 + 테이블 로드 + Enable
console.log('테이블 로드 중 (최대 1~2분)…');
const r = await send(`setup ${ct}`, /setup:|FAIL setup/, 180000);
if (!r) {
  console.error('시간 초과 — bridge.log 를 확인하세요:', log);
  process.exit(1);
}
if (/FAIL setup/.test(r)) {
  console.error('✖', r.split('\n').find((l) => l.includes('FAIL')));
  process.exit(1);
}
console.log('✔', r.split('\n').find((l) => l.includes('setup:')));
// 외부 리더(bot/telemetry.py)용 심볼 주소 내보내기
await send('symbols', /symbols written/, 10000);

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * cheatengine-lua: Cheat Engine 안에서 도는 Lua 브릿지(ce/chaos-bridge.lua)와 파일 큐로 통신한다.
 * 어댑터는 한 줄 = 한 명령으로 cmd.txt 에 append 하고, 브릿지는 100ms 마다 파일을 rename 해서 가져간다.
 * (CE Lua 에 소켓이 없어도 되고, 게임 창 포커스도 필요 없다.)
 *
 * 줄 형식: 공백 구분, 첫 토큰이 명령. 값에 공백이 있으면 lua 명령만 허용(나머지 전부가 코드).
 *   activate 1337304928
 *   set 1337192615 0
 *   speed 0.3
 *   spawn c4730 47300000
 *   lua speedhack_setSpeed(1)
 */
export class CheatEngineLuaBackend {
  constructor(dir = process.env.CHAOS_BRIDGE_DIR || path.join(os.tmpdir(), 'chzzk-souls-chaos')) {
    this.dir = dir;
    this.file = path.join(dir, 'cmd.txt');
    fs.mkdirSync(dir, { recursive: true });
  }

  send(cmd) {
    const [kind, ...args] = cmd;
    const line = kind === 'lua' ? `lua ${args.join(' ')}` : [kind, ...args].map(String).join(' ');
    fs.appendFileSync(this.file, line + '\n');
  }

  close() {}
}

/**
 * cheatengine-hotkey: 치트 테이블에 등록된 글로벌 핫키를 누른다 (devPoland 카오스 모드 CT 호환).
 * 상주 PowerShell 프로세스가 keybd_event 로 키를 보낸다. `key` 명령만 이해한다.
 */
export class CheatEngineHotkeyBackend {
  constructor() {
    const script = path.join(HERE, 'keysender.ps1');
    this.proc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.proc.stdout.on('data', (d) => process.env.DEBUG_KEYS && console.log('[keys]', d.toString().trim()));
    this.proc.stderr.on('data', (d) => console.error('[keys]', d.toString().trim()));
    this.proc.on('exit', (code) => console.error(`[keys] keysender exited (${code})`));
  }

  send(cmd) {
    if (cmd[0] !== 'key') return console.warn(`[keys] hotkey 백엔드는 '${cmd[0]}' 명령을 지원하지 않음`);
    this.proc.stdin.write(cmd[1] + '\n');
  }

  close() {
    this.proc.stdin.end();
  }
}

/** 아무것도 하지 않고 콘솔에만 찍는 백엔드 (게임 없이 파이프라인 테스트용). */
export class LogBackend {
  send(cmd) {
    console.log(`[dry-run] ${cmd.join(' ')}`);
  }
  close() {}
}

export function createBackend(name) {
  switch (name) {
    case 'log': return new LogBackend();
    case 'cheatengine-hotkey': return new CheatEngineHotkeyBackend();
    case 'cheatengine-lua':
    default: return new CheatEngineLuaBackend();
  }
}

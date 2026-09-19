import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'keysender.ps1');

/**
 * Cheat Engine hotkey backend.
 * 효과 실행 = 치트 테이블에 등록된 글로벌 핫키(F13~F24 + 숫자 조합)를 누르는 것.
 * devPoland "Elden Ring Chaos Mod"의 CHAOS MOD.CT 핫키 배치와 호환된다 (코드는 공유하지 않음).
 */
export class CheatEngineBackend {
  constructor() {
    this.proc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.proc.stdout.on('data', (d) => process.env.DEBUG_KEYS && console.log('[keys]', d.toString().trim()));
    this.proc.stderr.on('data', (d) => console.error('[keys]', d.toString().trim()));
    this.proc.on('exit', (code) => console.error(`[keys] keysender exited (${code})`));
  }

  /** @param {string[]} keys e.g. ["F21","1"] */
  press(keys) {
    this.proc.stdin.write(keys.join('+') + '\n');
  }

  close() {
    this.proc.stdin.end();
  }
}

/** 키를 실제로 보내지 않고 콘솔에만 찍는 백엔드 (게임 없이 파이프라인 테스트용). */
export class LogBackend {
  press(keys) {
    console.log(`[keys] (dry-run) ${keys.join('+')}`);
  }
  close() {}
}

export function createBackend(name) {
  return name === 'log' ? new LogBackend() : new CheatEngineBackend();
}

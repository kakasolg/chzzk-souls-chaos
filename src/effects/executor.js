import { EventEmitter } from 'node:events';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 효과 정의(프로필 JSON)를 받아 백엔드에 명령을 보내는 실행기.
 *
 * effects[name]:
 *   label     한글 표시명
 *   on        시작 시 실행할 명령 목록          [["activate", 123], ["set", 456, "0"]]
 *   every     duration 동안 interval 마다 반복   (interval 기본 1000ms)
 *   off       duration 후 실행할 명령 목록      (on 만 있으면 1회성 효과)
 *   duration  ms (기본 table.defaultDuration)
 *
 * 명령은 배열 한 줄, 첫 원소가 종류. 백엔드가 이해하는 종류만 쓸 수 있다:
 *   key <combo>              글로벌 핫키                (cheatengine-hotkey)
 *   activate/deactivate <id> 치트 테이블 스크립트 on/off  (cheatengine-lua)
 *   set <id> <value>         메모리 레코드 값 쓰기
 *   freeze <id> <value>      값 고정 / unfreeze <id>
 *   speed <x>                speedhack
 *   spawn <chrId> [npcParam] 캐릭터 스포너
 *   lua <code>               임의 Lua
 *   wait <ms>                실행기가 처리하는 대기
 *
 * 여러 효과가 동시에 돌 수 있다. 같은 효과가 이미 진행 중이면 끝난 뒤 이어서 실행한다.
 *
 * ── 알려진 한계 ──────────────────────────────
 *  · 게임 상태를 읽지 않으므로 on/off 는 시간 기반이다.
 *  · 같은 메모리 레코드를 건드리는 두 효과가 겹치면 나중 off 가 먼저 것을 되돌릴 수 있다.
 */
export class EffectExecutor extends EventEmitter {
  constructor(table, backend, { minGapMs = 150 } = {}) {
    super();
    this.table = table;
    this.backend = backend;
    this.minGapMs = minGapMs;
    this.active = new Set();
    this.pending = new Map();
    this.lastSend = 0;
    this.chain = Promise.resolve();
  }

  names() {
    return Object.keys(this.table.effects);
  }

  get(name) {
    return this.table.effects[name];
  }

  init() {
    return this.#runCommands(this.table.init ?? []);
  }

  /** 명령을 직렬화해서 백엔드로 보낸다 (동시 실행 효과끼리 순서가 섞이지 않도록). */
  #send(cmd) {
    this.chain = this.chain.then(async () => {
      const wait = this.lastSend + this.minGapMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.backend.send(cmd);
      this.lastSend = Date.now();
    });
    return this.chain;
  }

  async #runCommands(cmds) {
    for (const cmd of cmds) {
      if (cmd[0] === 'wait') await sleep(Number(cmd[1]));
      else await this.#send(cmd);
    }
  }

  trigger(name, meta = {}) {
    const def = this.get(name);
    if (!def) {
      this.emit('unknown', name, meta);
      return Promise.resolve(false);
    }
    const prev = this.pending.get(name) ?? Promise.resolve();
    const run = prev.then(() => this.#run(name, def, meta));
    this.pending.set(name, run.catch(() => {}));
    return run;
  }

  async #run(name, def, meta) {
    this.active.add(name);
    const info = { name, label: def.label ?? name, ...meta };
    this.emit('start', info);
    const duration = def.duration ?? this.table.defaultDuration ?? 30000;
    try {
      await this.#runCommands(def.on ?? []);
      if (def.every) {
        const end = Date.now() + duration;
        while (Date.now() < end) {
          await this.#runCommands(def.every);
          await sleep(def.interval ?? 1000);
        }
      } else if (def.off) {
        await sleep(duration);
      }
      await this.#runCommands(def.off ?? []);
    } finally {
      this.active.delete(name);
      this.emit('end', info);
    }
    return true;
  }
}

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
 * 효과는 대기열에 들어가 한 번에 하나씩 시작한다 (gapMs 간격). 후원이 몰려도 스트리머가 감당할 수 있게.
 * 지속 효과(30초)는 시작만 간격을 두고 겹쳐서 진행될 수 있다. 대기열이 maxPending 을 넘으면 버린다.
 *
 * ── 알려진 한계 ──────────────────────────────
 *  · 게임 상태를 읽지 않으므로 on/off 는 시간 기반이다.
 *  · 같은 메모리 레코드를 건드리는 두 효과가 겹치면 나중 off 가 먼저 것을 되돌릴 수 있다.
 */
export class EffectExecutor extends EventEmitter {
  constructor(table, backend, { minGapMs = 150, gapMs = 8000, maxPending = 20 } = {}) {
    super();
    this.table = table;
    this.backend = backend;
    this.minGapMs = minGapMs;
    this.gapMs = gapMs;
    this.maxPending = maxPending;
    this.active = new Set();
    this.queue = [];
    this.lastStart = 0;
    this.draining = false;
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

  /** 효과를 대기열에 넣는다. 반환값은 대기 순번 (0 = 바로 시작). */
  trigger(name, meta = {}) {
    const def = this.get(name);
    if (!def) {
      this.emit('unknown', name, meta);
      return -1;
    }
    if (this.queue.length >= this.maxPending) {
      this.emit('dropped', { name, label: def.label ?? name, ...meta, reason: 'queue full' });
      return -1;
    }
    this.queue.push({ name, def, meta });
    const position = this.queue.length - 1;
    this.emit('queued', { name, label: def.label ?? name, ...meta, position, pending: this.queue.length });
    this.#drain();
    return position;
  }

  async #drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length) {
        const wait = this.lastStart + this.gapMs - Date.now();
        if (wait > 0) await sleep(wait);
        const item = this.queue.shift();
        this.lastStart = Date.now();
        this.#run(item.name, item.def, { ...item.meta, pending: this.queue.length }).catch((e) => this.emit('error', e));
      }
    } finally {
      this.draining = false;
    }
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

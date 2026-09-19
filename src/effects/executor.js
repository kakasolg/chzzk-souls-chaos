import { EventEmitter } from 'node:events';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 효과 정의(JSON)를 받아 백엔드에 키 조합을 보내는 실행기.
 * 효과 하나는 비동기로 진행되며(toggle/repeat는 duration 동안 살아 있음),
 * 여러 효과가 동시에 돌 수 있다. 단 같은 효과가 이미 진행 중이면 큐에서 대기시킨다.
 *
 * ── 알려진 한계 ──────────────────────────────
 *  · 키 입력은 글로벌 핫키라 게임 창이 포커스여야 한다.
 *  · 치트 테이블 쪽 상태를 읽을 수 없어 toggle의 on/off는 시간 기반 추정이다.
 */
export class EffectExecutor extends EventEmitter {
  /** @param {{init:string[], defaultDuration:number, effects:Record<string,any>}} table */
  constructor(table, backend, { minGapMs = 250 } = {}) {
    super();
    this.table = table;
    this.backend = backend;
    this.minGapMs = minGapMs;
    this.active = new Set();
    this.pending = new Map(); // effectName -> Promise chain
    this.lastPress = 0;
    this.pressChain = Promise.resolve();
  }

  names() {
    return Object.keys(this.table.effects);
  }

  get(name) {
    return this.table.effects[name];
  }

  init() {
    if (this.table.init?.length) this.#press(this.table.init);
  }

  /** 키 조합을 직렬화해서 보낸다 (동시 실행 효과끼리 키가 섞이지 않도록). */
  #press(keys) {
    this.pressChain = this.pressChain.then(async () => {
      const wait = this.lastPress + this.minGapMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.backend.press(keys);
      this.lastPress = Date.now();
    });
    return this.pressChain;
  }

  /**
   * @param {string} name 효과 이름
   * @param {{by?:string, amount?:number, source?:string}} meta 오버레이/로그용
   */
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
    this.emit('start', { name, label: def.label ?? name, ...meta });
    const duration = def.duration ?? this.table.defaultDuration;
    try {
      switch (def.kind) {
        case 'press':
          await this.#press(def.keys);
          break;
        case 'toggle':
          await this.#press(def.keys);
          await sleep(duration);
          await this.#press(def.keys);
          break;
        case 'repeat': {
          const end = Date.now() + duration;
          while (Date.now() < end) {
            await this.#press(def.keys);
            if (def.release) {
              await sleep(def.releaseAfter ?? 300);
              await this.#press(def.release);
            }
            await sleep(def.interval ?? 1000);
          }
          if (def.finally) await this.#press(def.finally);
          break;
        }
        case 'sequence':
          for (const step of def.steps) {
            await this.#press(step.keys);
            if (step.after) await sleep(step.after);
          }
          break;
        default:
          throw new Error(`unknown effect kind: ${def.kind}`);
      }
    } finally {
      this.active.delete(name);
      this.emit('end', { name, label: def.label ?? name, ...meta });
    }
    return true;
  }
}

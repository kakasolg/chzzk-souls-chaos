/**
 * 후원/채팅/구독 이벤트를 어떤 효과로 바꿀지 결정한다.
 *
 * config.json 예:
 * {
 *   "keywords": { "즉사": "Kill Player", "말레니아": "SPAWN MALENIA" },
 *   "tiers": [
 *     { "min": 1000,  "pool": ["Slow Down", "Small Player"] },
 *     { "min": 5000,  "pool": ["Kill Player", "SPAWN MALENIA"] },
 *     { "min": 10000, "pool": "*" }
 *   ],
 *   "subscription": { "pool": ["Heal HP"] },
 *   "chatCommands": { "enabled": false, "prefix": "!", "roles": ["streamer", "streaming_channel_manager"] },
 *   "disabled": ["Fake Crash"]
 * }
 *
 * 선택 규칙:
 *  1. 후원 메시지에 keywords 중 하나가 들어 있으면 그 효과 (그 효과가 속한 티어 금액 이상일 때만)
 *  2. 아니면 금액 이상인 가장 높은 티어의 pool에서 랜덤 ("*"는 전체)
 *  3. 금액이 최소 티어 미만이면 무시
 */
export class Router {
  constructor(config, allEffects) {
    this.cfg = config;
    this.all = allEffects.filter((n) => !(config.disabled ?? []).includes(n));
    this.tiers = [...(config.tiers ?? [])].sort((a, b) => b.min - a.min); // 높은 금액 우선
  }

  #pool(tier) {
    const p = tier.pool === '*' || tier.pool == null ? this.all : tier.pool;
    return p.filter((n) => this.all.includes(n));
  }

  #pick(pool) {
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  /** @returns {{effect:string, reason:string}|null} */
  forDonation({ payAmount, donationText = '' }) {
    const amount = Number(payAmount) || 0;
    const tier = this.tiers.find((t) => amount >= t.min);
    if (!tier) return null;

    // 키워드 효과는 금액 이하의 모든 티어 pool 합집합에서 허용 (5000원 효과를 10000원 후원으로 지목 가능)
    const text = donationText.toLowerCase();
    const allowed = new Set(this.tiers.filter((t) => amount >= t.min).flatMap((t) => this.#pool(t)));
    for (const [kw, effect] of Object.entries(this.cfg.keywords ?? {})) {
      if (text.includes(kw.toLowerCase()) && allowed.has(effect)) return { effect, reason: `keyword:${kw}` };
    }
    const effect = this.#pick(this.#pool(tier));
    return effect ? { effect, reason: `tier:${tier.min}` } : null;
  }

  forSubscription() {
    const pool = this.cfg.subscription?.pool;
    const effect = this.#pick(pool === '*' || pool == null ? [] : pool.filter((n) => this.all.includes(n)));
    return effect ? { effect, reason: 'subscription' } : null;
  }

  /** 효과가 속한 가장 낮은 티어 금액 (키워드 → 데모 후원 금액 계산용) */
  tierMinOf(effect) {
    const mins = this.tiers.filter((t) => this.#pool(t).includes(effect)).map((t) => t.min);
    return mins.length ? Math.min(...mins) : null;
  }

  /**
   * 채팅 명령.
   *  - 스트리머/매니저: "!fx <효과 이름|키워드>" → 바로 발동 (chatCommands)
   *  - 데모 모드(demo.enabled): 시청자 누구나
   *      "!후원 <금액> [메시지]"  → 그 금액으로 후원한 것처럼 처리 (티어·키워드 동일)
   *      "!<키워드>"              → 그 효과 티어의 최소 금액으로 후원한 것처럼
   *      "!구독"                  → 구독 이벤트
   *    시청자별 쿨다운(demo.cooldownMs, 기본 30초)과 금액 상한(demo.maxAmount, 기본 20000)
   * 반환: { effect, reason } | { donation: {...} } | { subscription: {...} } | null
   */
  forChat({ content, profile }) {
    const prefix = this.cfg.chatCommands?.prefix ?? this.cfg.demo?.prefix ?? '!';
    const text = (content ?? '').trim();
    if (!text.startsWith(prefix)) return null;
    const body = text.slice(prefix.length).trim();
    const nickname = profile?.nickname ?? '?';

    // 1) 스트리머 직접 발동
    const cc = this.cfg.chatCommands;
    if (cc?.enabled && body.startsWith('fx ')) {
      if (cc.roles?.length && !cc.roles.includes(profile?.userRoleCode)) return null;
      const arg = body.slice(3).trim();
      const effect = this.cfg.keywords?.[arg] ?? this.all.find((n) => n.toLowerCase() === arg.toLowerCase());
      return effect ? { effect, reason: 'chat' } : null;
    }

    // 2) 데모 모드 (시청자용 가짜 후원)
    const demo = this.cfg.demo;
    if (!demo?.enabled) return null;
    const maxAmount = Number(demo.maxAmount ?? 20000);
    const cooldown = Number(demo.cooldownMs ?? 30000);
    this.demoLast ??= new Map();
    const checkCooldown = () => {
      const last = this.demoLast.get(nickname) ?? 0;
      if (Date.now() - last < cooldown) return false;
      this.demoLast.set(nickname, Date.now());
      return true;
    };

    if (body === '구독' || body === 'sub') {
      if (!checkCooldown()) return { cooldown: true, nickname };
      return { subscription: { subscriberNickname: nickname, tierName: 'demo', month: 1 }, reason: 'demo' };
    }
    const m = /^(후원|도네|donate)\s+(\d+)\s*(.*)$/.exec(body);
    if (m) {
      if (!checkCooldown()) return { cooldown: true, nickname };
      const amount = Math.min(Number(m[2]), maxAmount);
      return { donation: { donatorNickname: nickname, payAmount: String(amount), donationText: m[3] ?? '' }, reason: 'demo' };
    }
    const kw = Object.keys(this.cfg.keywords ?? {}).find((k) => k === body);
    if (kw) {
      const effect = this.cfg.keywords[kw];
      const min = this.tierMinOf(effect);
      if (min == null) return null;
      if (!checkCooldown()) return { cooldown: true, nickname };
      return { donation: { donatorNickname: nickname, payAmount: String(Math.min(min, maxAmount)), donationText: kw }, reason: 'demo' };
    }
    return null;
  }
}

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

  /** 스트리머/매니저가 채팅으로 직접 효과를 쏘는 테스트용 명령 (예: "!fx Kill Player") */
  forChat({ content, profile }) {
    const cc = this.cfg.chatCommands;
    if (!cc?.enabled) return null;
    const prefix = cc.prefix ?? '!';
    if (!content.startsWith(prefix + 'fx ')) return null;
    if (cc.roles?.length && !cc.roles.includes(profile?.userRoleCode)) return null;
    const arg = content.slice(prefix.length + 3).trim();
    const effect = this.cfg.keywords?.[arg] ?? this.all.find((n) => n.toLowerCase() === arg.toLowerCase());
    return effect ? { effect, reason: 'chat' } : null;
  }
}

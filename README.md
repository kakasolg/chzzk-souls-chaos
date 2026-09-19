# chzzk-souls-chaos

치지직 **후원(치즈) · 구독 · 채팅**을 엘든링 카오스 효과로 연결하는 어댑터입니다.
시청자가 치즈를 쏘면 스트리머 게임에 말레니아가 소환되거나, 캐릭터가 거인이 되거나, 즉사합니다.

```
치지직 Open API (DONATION / SUBSCRIPTION / CHAT)
        │
        ▼
  chzzk-souls-chaos  ── 금액·키워드 → 효과 결정 ── 핫키(F13~F24) ──▶  Cheat Engine + 치트 테이블
        │                                                                (실제 게임 메모리 조작)
        └── OBS 오버레이 (누가 뭘 쐈는지)
```

효과 자체는 [devPoland/EldenRingChaosMod](https://github.com/devPoland/EldenRingChaosMod)의 치트 테이블(`CHAOS MOD.CT`)이 담당하고,
이 프로젝트는 **치지직 이벤트를 그 치트 테이블의 핫키로 바꿔주는 역할**만 합니다. 56개 효과를 그대로 쓸 수 있습니다.

> ⚠️ **반드시 오프라인(EAC 비활성) 상태로 플레이하세요.** 온라인에서 메모리 조작 도구를 쓰면 밴됩니다.
> 별도 세이브 슬롯을 쓰는 것을 권장합니다.

---

## 스트리머용 설치 가이드

### 준비물

| 항목 | 비고 |
|---|---|
| Elden Ring (Steam) | EAC 끄고 오프라인 실행 |
| [Cheat Engine](https://www.cheatengine.org/) 최신 버전 | |
| [EldenRingChaosMod 릴리스](https://github.com/devPoland/EldenRingChaosMod/releases) | `Cheat Engine/CHAOS MOD.CT` 파일만 필요 |
| [Node.js](https://nodejs.org/) 20 이상 | |
| 치지직 개발자센터 앱 | 아래 참고 |

### 1. 치지직 개발자센터에서 앱 등록

https://developers.chzzk.naver.com → 애플리케이션 등록 (네이버 실명인증 계정 필요)

| 항목 | 값 |
|---|---|
| 애플리케이션 ID / 이름 | 자유 (단 `chzzk`, `naver`, `치지직`, `네이버` 단어 포함 불가) |
| 로그인 리디렉션 URL | `http://localhost:8080/callback` |
| API Scope | **사용자 정보 조회, 채팅 메시지 조회, 후원 조회, 구독 조회** |

발급된 Client ID / Client Secret을 메모합니다. (외부에 공유 금지)

### 2. 어댑터 설치

```bash
git clone https://github.com/kakasolg/chzzk-souls-chaos.git
cd chzzk-souls-chaos
npm install
copy .env.example .env
copy config.example.json config.json
```

`.env`를 열어 Client ID / Secret을 넣습니다.

### 3. 치지직 계정 연동 (1회)

```bash
npm run auth
```

브라우저에 치지직 로그인 창이 뜹니다. 스트리머 본인 계정으로 동의하면 `tokens.json`이 생성됩니다.
(토큰은 자동 갱신됩니다. 이 파일도 외부에 공유하지 마세요.)

### 4. 게임 + Cheat Engine 실행

1. 엘든링을 **오프라인**으로 실행
2. Cheat Engine 실행 → `CHAOS MOD.CT` 열기 → 엘든링 프로세스 선택
3. 치트 테이블의 스크립트가 활성화되도록 안내에 따름 (devPoland README 참고)

### 5. 어댑터 실행

```bash
npm start
```

```
chzzk-souls-chaos 실행 중 — 백엔드: cheatengine, 설정: config.json
OBS 브라우저 소스: http://localhost:8008/overlay
✔ 치지직 세션 연결됨: ...
```

OBS에 **브라우저 소스** `http://localhost:8008/overlay` (1920×1080)를 추가하면 발동된 효과가 화면에 표시됩니다.

---

## 효과 설정 (`config.json`)

```jsonc
{
  // 후원 메시지에 이 단어가 있으면 해당 효과 (금액이 그 효과의 티어 이상일 때만)
  "keywords": { "즉사": "Kill Player", "말레니아": "SPAWN MALENIA" },

  // 금액 구간별 랜덤 풀. 키워드 없으면 금액에 맞는 가장 높은 구간에서 랜덤
  "tiers": [
    { "min": 1000,  "pool": ["Slow Down", "Small Player", "Giant Player"] },
    { "min": 5000,  "pool": ["Hitless Challenge", "SPAWN A DRAGON"] },
    { "min": 10000, "pool": ["Kill Player", "SPAWN MALENIA"] }
  ],

  // 구독 시 효과 (보통 이로운 것)
  "subscription": { "pool": ["Heal HP", "SPAWN A FRIENDLY DOG"] },

  // 스트리머/매니저가 채팅으로 직접 발동: "!fx Kill Player" 또는 "!fx 즉사"
  "chatCommands": { "enabled": true, "prefix": "!", "roles": ["streamer", "streaming_channel_manager"] },

  // 아예 쓰지 않을 효과
  "disabled": ["Fake Crash"]
}
```

전체 효과 목록과 핫키는 `npm run keys`로 확인할 수 있습니다.
효과 정의는 [`src/effects/eldenring-chaosmod.json`](src/effects/eldenring-chaosmod.json)에 있으며, 지속시간(`duration`, 기본 30초) 등을 바꿀 수 있습니다.

---

## 게임/치지직 없이 테스트하기

`.env`에서 `BACKEND=log`로 두면 키를 보내지 않고 콘솔에만 출력합니다. Client ID가 없어도 실행됩니다.

```bash
npm start
# 다른 터미널에서
npm run fake -- 5000 "말레니아" 후원자닉        # 후원 5,000원
npm run fake -- sub 구독자닉                     # 구독
npm run fake -- chat "!fx Kill Player"           # 스트리머 채팅 명령
```

---

## 구조

```
src/
├─ chzzk/        Open API — OAuth(auth.js), 세션/이벤트 구독(session.js)
├─ effects/      효과 정의(JSON), 실행기(executor.js), 후원→효과 라우터(router.js)
├─ backends/     cheatengine.js (핫키 전송, PowerShell keybd_event) / log
└─ overlay/      OBS 브라우저 소스
tools/
├─ fake-donation.js   가짜 이벤트 주입
└─ list-effects.js    효과·핫키 목록
```

### 알려진 한계

- 핫키는 글로벌 키 입력이라 **엘든링 창이 포커스**여야 합니다. F13~F24를 다른 프로그램 단축키로 쓰고 있으면 겹칩니다.
- 치트 테이블 상태를 읽을 수 없어 toggle 효과의 해제는 시간 기반입니다.
- 치트 테이블은 devPoland 모드의 것이라, 엘든링 업데이트 후 호환 여부는 해당 프로젝트를 따릅니다.

## 로드맵

- [ ] Crowd Control 백엔드 (치트 테이블 없이 CC 모드로)
- [ ] 다른 소울류(다크소울3, 세키로) 치트 테이블 프로필
- [ ] 효과 투표 모드 (채팅 1/2/3/4)

## 라이선스

MIT. 치트 테이블(`CHAOS MOD.CT`)은 이 저장소에 포함되어 있지 않으며 [devPoland/EldenRingChaosMod](https://github.com/devPoland/EldenRingChaosMod)에서 직접 받아야 합니다. 핫키 배치만 호환합니다.

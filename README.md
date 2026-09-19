# chzzk-souls-chaos

치지직 **후원(치즈) · 구독 · 채팅**을 엘든링 카오스 효과로 연결하는 어댑터입니다.
시청자가 치즈를 쏘면 스트리머 게임에 말레니아가 소환되거나, 슬로우 모션이 걸리거나, 즉사합니다.

```
치지직 Open API (DONATION / SUBSCRIPTION / CHAT)
        │
        ▼
  chzzk-souls-chaos  ── 금액·키워드 → 효과 결정 ── 파일 큐 ──▶  Cheat Engine (Lua 브릿지) + Hexinton 치트 테이블
        │                                                          (즉사 · 보스 소환 · 속도 · 텔레포트 · 무적 …)
        └── OBS 오버레이 (누가 뭘 쐈는지)
```

효과 자체는 Nexus의 [Hexinton All in One 치트 테이블](https://www.nexusmods.com/eldenring/mods/48)이 담당하고,
이 프로젝트는 **치지직 이벤트를 그 테이블의 스크립트 on/off · 값 변경 명령으로 바꿔주는 역할**만 합니다.
Cheat Engine 안에서 도는 작은 Lua 브릿지가 명령을 받아 실행하므로 **게임 창 포커스가 필요 없고**, 핫키 충돌도 없습니다.

> ⚠️ **반드시 오프라인(EAC 비활성) 상태로 플레이하세요.** 온라인에서 메모리 조작 도구를 쓰면 밴됩니다.
> 별도 세이브 슬롯/백업을 권장합니다. (`%APPDATA%\EldenRing\<스팀ID>\ER0000.sl2`)

---

## 스트리머용 설치 가이드

### 준비물

| 항목 | 비고 |
|---|---|
| Elden Ring (Steam) | EAC 끄고 오프라인 실행 |
| [Cheat Engine](https://www.cheatengine.org/) 7.5+ | 공식 설치기는 번들 광고가 붙으니, `scoop install cheat-engine`(번들 없음) 권장 |
| [Hexinton All in One](https://www.nexusmods.com/eldenring/mods/48) 8.0.x | Nexus 로그인 후 Manual download → zip 안의 `.CT` 파일 |
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
npm run install-bridge        # Cheat Engine autorun 폴더에 Lua 브릿지 복사
```

`.env`를 열어 Client ID / Secret을 넣습니다.

### 3. 치지직 계정 연동 (1회)

```bash
npm run auth
```

브라우저에 치지직 로그인 창이 뜹니다. 스트리머 본인 계정으로 동의하면 `tokens.json`이 생성됩니다.
(토큰은 자동 갱신됩니다. 이 파일도 외부에 공유하지 마세요.)

### 4. 게임 + Cheat Engine 실행

1. 엘든링을 **오프라인**으로 실행 (Hexinton 안내의 offline launcher, 또는 EAC 프로세스 종료 후 `eldenring.exe` 직접 실행)
2. Cheat Engine 실행 → Hexinton `.CT` 열기 → 엘든링 프로세스 선택 → 맨 위 **[ Enable ]** 체크
3. Ctrl+Alt+L(Lua Engine) 창에 `[chaos] bridge ready` 가 보이면 브릿지 준비 완료

### 5. 어댑터 실행

```bash
npm start
```

```
chzzk-souls-chaos 실행 중 — 프로필: hexinton, 백엔드: cheatengine-lua, 설정: config.json
OBS 브라우저 소스: http://localhost:8008/overlay
✔ 치지직 세션 연결됨: ...
```

OBS에 **브라우저 소스** `http://localhost:8008/overlay` (1920×1080)를 추가하면 발동된 효과가 화면에 표시됩니다.

---

## 효과 설정 (`config.json`)

```jsonc
{
  // 후원 메시지에 이 단어가 있으면 해당 효과 (금액이 그 효과의 티어 이상일 때만)
  "keywords": { "즉사": "Kill Player", "말레니아": "Spawn Malenia" },

  // 금액 구간별 랜덤 풀. 키워드 없으면 금액에 맞는 가장 높은 구간에서 랜덤
  "tiers": [
    { "min": 1000,  "pool": ["Spawn Dog", "Ultra Zoom", "Half HP"] },
    { "min": 5000,  "pool": ["One HP", "Spawn Dragon", "Teleport Random Grace"] },
    { "min": 10000, "pool": ["Kill Player", "Spawn Malenia", "Spawn Radahn"] }
  ],

  // 구독 시 효과 (보통 이로운 것)
  "subscription": { "pool": ["Heal HP", "God Mode", "One Hit Kill"] },

  // 스트리머/매니저가 채팅으로 직접 발동: "!fx Kill Player" 또는 "!fx 즉사"
  "chatCommands": { "enabled": true, "prefix": "!", "roles": ["streamer", "streaming_channel_manager"] },

  // 아예 쓰지 않을 효과
  "disabled": ["Pause Game"]
}
```

전체 효과 목록은 `npm run keys`로 확인할 수 있습니다.
효과 정의(프로필)는 [`src/profiles/hexinton.json`](src/profiles/hexinton.json)에 있으며, 지속시간(`duration`, 기본 30초)이나 명령을 바꾸거나 새 효과를 추가할 수 있습니다.
숫자는 Hexinton 테이블의 메모리 레코드 ID입니다 (CE에서 항목 우클릭 → "Change script"/속성에서 확인).

---

## 게임/치지직 없이 테스트하기

`.env`에서 `BACKEND=log`로 두면 명령을 보내지 않고 콘솔에만 출력합니다. Client ID가 없어도 실행됩니다.

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
├─ effects/      실행기(executor.js), 후원→효과 라우터(router.js)
├─ profiles/     효과 정의 — hexinton.json (기본), devpoland-hotkey.json (레거시 핫키 방식)
├─ backends/     cheatengine-lua (파일 큐 → CE Lua 브릿지) / cheatengine-hotkey / log
└─ overlay/      OBS 브라우저 소스
ce/chaos-bridge.lua   Cheat Engine autorun 에 설치되는 브릿지 (명령: activate/deactivate/set/freeze/speed/spawn/lua)
tools/
├─ fake-donation.js   가짜 이벤트 주입
├─ list-effects.js    효과 목록
└─ install-bridge.js  브릿지를 CE autorun 폴더에 복사
```

브릿지 로그: `%TEMP%\chzzk-souls-chaosridge.log` — 효과가 안 먹으면 여기서 `FAIL` 줄을 확인하세요.

### 알려진 한계

- 게임 상태를 읽지 않으므로 지속 효과의 해제는 시간 기반입니다.
- 치트 테이블은 Hexinton 팀이 유지보수합니다. 엘든링 패치 후엔 테이블 업데이트를 기다려야 할 수 있고, 메모리 레코드 ID가 바뀌면 프로필의 ID를 맞춰야 합니다.
- 레거시 `devpoland-hotkey` 프로필은 글로벌 핫키 방식이라 게임 창 포커스가 필요합니다.

## 로드맵

- [ ] 실제 게임에서 각 효과 검증 (스폰 좌표, NpcParam ID 등)
- [ ] 상태 이상 효과 (ApplyEffect SpEffect ID)
- [ ] 다른 소울류(다크소울3, 세키로) 프로필
- [ ] 효과 투표 모드 (채팅 1/2/3/4)
- [ ] Nexus Mods 페이지

## 라이선스

MIT. 치트 테이블은 이 저장소에 포함되어 있지 않습니다 — [Hexinton All in One](https://www.nexusmods.com/eldenring/mods/48)(Nexus)에서 직접 받으세요.
레거시 핫키 프로필은 [devPoland/EldenRingChaosMod](https://github.com/devPoland/EldenRingChaosMod)의 핫키 배치와만 호환하며 그 코드는 포함하지 않습니다.

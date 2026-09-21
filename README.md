# chzzk-souls-chaos

**시청자의 후원이 엘든링 안에서 일어나게 하는 도구**입니다.
치지직 치즈 / 유튜브 슈퍼챗을 쏘면 스트리머 주변에 박쥐 떼가 날아들고, 쥐 다섯 마리가 달려들고, 슬로우 모션이 걸리고, 고액이면 말레니아가 소환됩니다. 구독하면 멜리나가 따라다닙니다.

> 설계 원칙: **강한 보스 한 방보다, 날아다니고 물어뜯는 잔챙이가 슬슬 괴롭히는 게 훨씬 짜증난다.**
> 그래서 소액은 박쥐·잠자리·쥐·늑대·개 같은 성가신 무리, 보스는 고액에만.

| | |
|---|---|
| 지원 플랫폼 | **치지직** (치즈 후원 · 구독 · 채팅), **유튜브 라이브** (슈퍼챗 · 멤버십 · 채팅) — 둘 다 동시 사용 가능 |
| 게임 | Elden Ring (Steam) — **1.17.1 + Shadow of the Erdtree** 에서 검증 (Cheat Engine 7.6, Hexinton 8.0.4). 상세: [검증 환경 / 미검증 목록](docs/DEVELOPMENT.md#검증-환경) |
| 필요한 것 | Cheat Engine + Nexus의 [Hexinton All in One 치트 테이블](https://www.nexusmods.com/eldenring/mods/48) + Node.js |
| 방송 화면 | OBS 브라우저 소스로 "누가 뭘 쐈는지" 오버레이 표시 |

> ⚠️ **반드시 오프라인(EAC 비활성)으로 플레이하세요.** 온라인에서 메모리 조작 도구를 쓰면 밴됩니다.
> 별도 세이브 슬롯을 쓰거나 세이브를 백업해 두세요: `%APPDATA%\EldenRing\<스팀ID>\ER0000.sl2`

---

## 시청자에게는 이렇게 보입니다

후원 금액에 따라 아래 단계에서 **랜덤**으로 하나가 발동됩니다. 후원 메시지에 **키워드**를 넣으면 그 효과를 지목할 수 있습니다 (지목한 효과의 단계 이상 금액일 때).

| 단계 | 컨셉 | 효과 (키워드) |
|---|---|---|
| **1,000원** | 성가심 | 박쥐, 잠자리 떼 `잠자리`, 독수리 `독수리`, 해파리 `해파리`, 쥐, 개, 초근접 줌, 광각 FOV, 체력 반토막, FP 0 |
| **3,000원** | 떼 | 박쥐 떼 `박쥐`, 쥐 떼 5마리 `쥐`, 큰 쥐 2마리, 늑대 무리 `늑대`, 개 3마리 `개`, 손가락 벌레 3마리 `손가락`, 전투매 2마리 `매`, 해골 3마리 `해골`, 슬로우 모션 `슬로우`, 2배속, 스태미나 0 |
| **5,000원** | 위협 | 바실리스크(사혈) `바실리스크`, 반인 무리 `반인`, 거대 손가락 벌레, 육지 문어 `문어`, 부패 슬라임 `슬라임`, 블러드하운드 기사 `블러드하운드`, 검은 칼 암살자 `암살자`, 체력 1, 랜덤 은총 이동 `텔포`, 게임 정지 5초 `정지` |
| **10,000원** | 엘리트 | 도가니 기사 `도가니`, 나무 파수꾼 `파수꾼`, 룬곰 `룬곰`, 사영조 `사영조`, 거대 게 `게`, **즉사** `즉사` |
| **20,000원** | 보스 | 말레니아 `말레니아`, 라단 `라단`, 말리케스 `말리케스`, 모르곳 `모르곳`, 고드프리 `고드프리`, 모그 `모그`, 화염 거인 `화염거인`, 드래곤 `용`, 황금 번개 용 `번개용`, 아스텔 `아스텔` |
| **구독 / 멤버십** | 보상 | **멜리나**가 영체로 소환되어 따라다닙니다 (축복에서 쉬면 사라짐) |

- 후원이 몰리면 **8초 간격으로 하나씩** 발동됩니다 (오버레이에 "대기 중 N개" 표시).
- 금액·단계·키워드는 전부 스트리머가 `config.json`에서 바꿀 수 있습니다.

방송 설명란에 붙여 넣을 안내 예시:

```
🎮 치즈/슈퍼챗으로 게임에 개입하세요!
1,000 성가신 잔챙이 · 3,000 떼거리 · 5,000 위협 · 10,000 엘리트/즉사 · 20,000 보스 소환
메시지에 키워드를 쓰면 지목 가능: 쥐 / 박쥐 / 늑대 / 바실리스크 / 텔포 / 즉사 / 말레니아 …
구독하면 멜리나가 옆에 따라다닙니다.
```

---

## 설치 (스트리머, 약 20분)

> 처음이면 [**docs/CHECKLIST.md**](docs/CHECKLIST.md) 를 열어 순서대로 체크하세요 — 단계마다 "실행 → 확인 → 안 되면" 이 적혀 있습니다.
> 언제든 `npm run doctor` 를 실행하면 무엇이 빠졌는지와 고치는 명령을 알려줍니다.
> ChatGPT·Gemini 같은 AI 에게 도움을 받을 거면 [**docs/AI-ASSISTANT.md**](docs/AI-ASSISTANT.md) 를 통째로 붙여넣고 시작하세요 (AI 가 없는 명령을 지어내지 않도록 사실 목록을 줍니다).

### 준비물

| 항목 | 비고 |
|---|---|
| Elden Ring (Steam) | 오프라인 실행 필요 (아래 참고) |
| [Cheat Engine](https://www.cheatengine.org/) 7.5 이상 | 공식 설치기는 광고 번들이 붙습니다. [Scoop](https://scoop.sh/)이 있다면 `scoop bucket add extras && scoop install cheat-engine`(번들 없음) 권장 |
| [Hexinton All in One](https://www.nexusmods.com/eldenring/mods/48) 8.0 이상 | Nexus 로그인 → Files → Manual download → zip 안의 `.CT` 파일을 아무 폴더에 |
| [Node.js](https://nodejs.org/) 20 이상 | LTS 설치 |
| 치지직 개발자센터 앱 또는 유튜브 OAuth 앱 | 아래 3단계 |

### 1. 어댑터 설치

```bash
git clone https://github.com/kakasolg/chzzk-souls-chaos.git
cd chzzk-souls-chaos
npm install
copy .env.example .env
copy config.example.json config.json
npm run install-bridge
```

마지막 명령은 Cheat Engine의 `autorun` 폴더에 작은 Lua 브릿지를 복사합니다 (CE가 켜질 때 자동 실행되어 어댑터의 명령을 받습니다).

설치가 끝나면:
```bash
npm run doctor
```
`❌` 가 없으면 준비 완료. 있으면 각 줄 아래 `→` 안내를 따르세요.

### 2. `.env` 편집

```ini
HEXINTON_CT=C:\경로\eldenring_all-in-one_Hexinton-v8.0.4.CT   # 받은 치트 테이블
CHZZK_CLIENT_ID=...        # 치지직을 쓰면 (3-a)
CHZZK_CLIENT_SECRET=...
YOUTUBE_CLIENT_ID=...      # 유튜브를 쓰면 (3-b)
YOUTUBE_CLIENT_SECRET=...
```

### 3-a. 치지직 연동

1. https://developers.chzzk.naver.com → **애플리케이션 등록** (네이버 실명인증 계정 필요)

   | 항목 | 값 |
   |---|---|
   | 애플리케이션 ID / 이름 | 자유 — 단 `chzzk`, `naver`, `치지직`, `네이버` 단어는 포함 불가 |
   | 로그인 리디렉션 URL | `http://localhost:8080/callback` |
   | API Scope | **사용자 정보 조회, 채팅 메시지 조회, 후원 조회, 구독 조회** |

2. 발급된 Client ID / Secret을 `.env`에 넣고, 스트리머 계정으로 1회 로그인:
   ```bash
   npm run auth
   ```
   브라우저에서 동의하면 `tokens.json`이 생깁니다 (자동 갱신, 공유 금지).

### 3-b. 유튜브 라이브 연동 (선택)

슈퍼챗 → 후원, 멤버십 → 구독, 채팅 → 스트리머 명령으로 매핑됩니다.

1. [Google Cloud 콘솔](https://console.cloud.google.com/) → 새 프로젝트
2. **APIs & Services → Library** → **YouTube Data API v3** → Enable
3. **OAuth consent screen** → External → 앱 이름·이메일 입력 → **Audience → Test users**에 방송할 구글 계정 추가
4. **Credentials → Create credentials → OAuth client ID → Desktop app** → Client ID / Secret을 `.env`에
5. 방송할 구글 계정으로 1회 로그인:
   ```bash
   npm run auth:youtube
   ```
   ("확인되지 않은 앱" 경고가 뜨면 → 고급 → 계속. 본인이 만든 앱이라 정상입니다.)

- 처음 라이브를 켜는 채널은 YouTube Studio에서 **라이브 스트리밍 활성화 후 24시간** 기다려야 합니다.
- 슈퍼챗 통화는 `config.json`의 `youtube.rates`로 원화 환산됩니다 (기본 USD 1,350원).
- 유튜브 채팅은 3~5초 지연이 있습니다 (폴링 API). 하루 쿼터 10,000 → 약 2.7시간 방송분. 긴 방송은 Google Cloud에서 쿼터 증설을 신청하거나 `.env`의 `YOUTUBE_POLL_MS`를 늘리세요.
- 왜 스트리머마다 구글 설정이 필요한가: 유튜브 OAuth 앱은 만든 사람의 계정에 묶이고 공개하려면 구글 심사가 필요합니다. 각자 만들면 심사 없이 바로 쓰고 쿼터도 따로 받습니다.

---

## 방송 시작 순서 (매번)

1. **엘든링을 오프라인으로 실행** — 게임 폴더의 `start_game_in_offline_mode.exe`(Nexus의 오프라인 런처) 또는 EAC 프로세스를 끄고 `eldenring.exe` 직접 실행. **창 모드(또는 테두리 없는 창) 권장** — 전체화면 전용은 다른 창을 건드리면 최소화됩니다.
2. 캐릭터를 로드한 뒤, 터미널에서:
   ```bash
   npm run attach
   ```
   Cheat Engine을 띄우고, 게임에 붙이고, 치트 테이블을 불러와 `[ Enable ]`까지 켭니다 (1분 정도, 팝업 없음).
3. 어댑터 실행:
   ```bash
   npm start
   ```
   ```
   chzzk-souls-chaos 실행 중 — 프로필: hexinton, 백엔드: cheatengine-lua, 설정: config.json
   OBS 브라우저 소스: http://localhost:8008/overlay
   ✔ 치지직 세션 연결됨
   ✔ 유튜브 채팅 연결됨
   ```
   유튜브는 **진행 중인 내 방송**을 자동으로 찾습니다 (방송 전이면 15초마다 재확인).
4. OBS → 소스 추가 → **브라우저** → URL `http://localhost:8008/overlay`, 1920×1080. 발동된 효과와 대기 수가 우상단에 표시됩니다.

방송 전 점검: 채팅에 `!fx Bat Swarm`을 쳐서 박쥐가 나오면 전부 정상입니다.

---

## 방송 중 운영

- **스트리머/매니저 채팅 명령**: `!fx 효과이름` 또는 `!fx 키워드` (예: `!fx 즉사`, `!fx Rat Pack`). 방송 주인·관리자 계정만 먹습니다.
- **대기열**: 효과는 8초 간격으로 하나씩 시작됩니다. 몰릴 때 오버레이에 "대기 중 N개". 20개 넘게 밀리면 버립니다.
- **영체**: 구독 시 멜리나가 4m 옆에 나타나 따라다닙니다. 게임 영체처럼 축복 휴식·사망·지역 이동 시 사라집니다.
- **죽었을 때**: 리스폰 후 소환이 잠깐 안 되는 경우가 있는데, 어댑터가 자동으로 감지해 스포너를 다시 켭니다.
- **끝낼 때**: 어댑터 Ctrl+C → 게임은 메뉴에서 종료 → Cheat Engine 닫기 (테이블 저장 여부는 "아니오").

---

## 효과 설정 바꾸기 (`config.json`)

```jsonc
{
  "queue": { "gapMs": 8000, "maxPending": 20 },        // 발동 간격(ms), 최대 대기 수

  "keywords": { "즉사": "Kill Player", "쥐": "Rat Pack" },   // 메시지 키워드 → 효과

  "tiers": [                                             // 금액 구간별 랜덤 풀 (원)
    { "min": 1000,  "pool": ["Bat", "Dragonflies", "Rat", "Dog", "Ultra Zoom"] },
    { "min": 3000,  "pool": ["Bat Swarm", "Rat Pack", "Wolf Pack"] },
    { "min": 5000,  "pool": ["Basilisk", "One HP", "Teleport Random Grace"] },
    { "min": 10000, "pool": ["Crucible Knight", "Kill Player"] },
    { "min": 20000, "pool": ["Spawn Malenia", "Spawn Radahn"] }
  ],

  "subscription": { "pool": ["Ally Melina"] },           // 구독/멤버십 보상

  "chatCommands": { "enabled": true, "prefix": "!", "roles": ["streamer", "streaming_channel_manager"] },

  "disabled": ["Ally Wolf", "Ally Malenia"]              // 쓰지 않을 효과
}
```

- 효과 이름 전체 목록: `npm run keys`
- 싸우는 영체(늑대·기사·보스)도 준비돼 있지만 너무 강해서 기본은 꺼져 있습니다. 쓰려면 `disabled`에서 빼세요.
- 효과 자체를 추가/수정하려면 [`src/profiles/hexinton.json`](src/profiles/hexinton.json)을 편집합니다. 숫자는 Hexinton 테이블의 레코드 ID입니다.

---

## 게임 없이 미리 테스트

`.env`에 `BACKEND=log`를 두면 게임에 아무것도 보내지 않고 콘솔에만 찍습니다. Client ID 없이도 됩니다.

```bash
npm start
# 다른 터미널에서
npm run fake -- 5000 "말레니아" 후원자닉      # 후원 5,000원
npm run fake -- sub 구독자닉                   # 구독
npm run fake -- chat "!fx Kill Player"         # 스트리머 채팅 명령
```

---

## 문제가 생기면

먼저 `npm run doctor` — 대부분의 문제는 여기서 원인과 해결 명령이 나옵니다.

| 증상 | 확인 |
|---|---|
| 효과가 아무것도 안 나옴 | `%TEMP%\chzzk-souls-chaos\bridge.log`에서 `FAIL` 줄 확인. `bridge ready`가 없으면 `npm run install-bridge` 후 CE 재시작 |
| `npm run attach`가 "브릿지가 응답하지 않습니다" | Cheat Engine이 두 개 떠 있지 않은지 확인 (하나만). CE 창에 팝업이 떠 있으면 닫기 |
| 소환은 되는데 나오지 않음 | 죽은 직후라면 몇 초 뒤 다시 시도됨. 계속 안 되면 CE에서 `[ Enable ]`을 껐다 켜기 |
| 유튜브 "not enabled for live streaming" | 채널에서 라이브 활성화 후 24시간 대기 |
| 유튜브 채팅이 안 잡힘 | 방송이 실제로 "라이브" 상태인지, 로그인한 계정이 방송 채널과 같은지 확인 |
| 컨트롤러가 안 먹음 | 게임 창을 한 번 클릭 (포커스). Steam 밖에서 실행했다면 Steam 설정의 "Xbox 컨트롤러 Steam 입력"이 패드를 잡고 있을 수 있음 |
| 게임이 크래시 | 일부 몹 ID는 게임을 죽입니다 (예: c4550). 새 효과를 추가할 때 먼저 `!fx`로 테스트하세요 |

---

## 라이선스

MIT. 치트 테이블은 포함되어 있지 않습니다 — [Hexinton All in One](https://www.nexusmods.com/eldenring/mods/48)(Nexus)에서 직접 받으세요.
구조·실측 기록·로드맵은 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)에 있습니다.

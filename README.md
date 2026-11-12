# chzzk-souls-chaos

**시청자의 후원이 엘든링 안에서 일어나게 하는 도구**입니다.
치지직 치즈 / 유튜브 슈퍼챗을 쏘면 스트리머 주변에 박쥐 떼가 날아들고, 쥐 다섯 마리가 달려들고, 슬로우 모션이 걸리고, 고액이면 말레니아가 소환됩니다. 구독하면 멜리나가 따라다닙니다.

> 설계 원칙: **강한 보스 한 방보다, 날아다니고 물어뜯는 잔챙이가 슬슬 괴롭히는 게 훨씬 짜증난다.**
> 그래서 소액은 박쥐·잠자리·쥐·늑대·개 같은 성가신 무리, 보스는 고액에만.

| | |
|---|---|
| 지원 플랫폼 | **유튜브 라이브** (슈퍼챗 · 멤버십 · 채팅) — 실제 방송에서 검증 완료 / **치지직** (치즈 후원 · 구독 · 채팅) — ⚠️ **실제 연결 테스트 안 함** (아래 참고). 둘 다 동시 사용 가능 |
| 게임 | Elden Ring (Steam) — **App 1.17.2 / Regulation 1.17.3** (eldenring.exe 2.7.2.0) + Shadow of the Erdtree 에서 검증, 2026-11-12 (Cheat Engine 7.6, Hexinton 8.0.4). 상세: [검증 환경 / 미검증 목록](docs/DEVELOPMENT.md#검증-환경) |
| 필요한 것 | Cheat Engine + Nexus의 [Hexinton All in One 치트 테이블](https://www.nexusmods.com/eldenring/mods/48) + Node.js |
| 방송 화면 | OBS 브라우저 소스로 "누가 뭘 쐈는지" 오버레이 표시 |

> ⚠️ **반드시 오프라인(EAC 비활성)으로 플레이하세요.** 온라인에서 메모리 조작 도구를 쓰면 밴됩니다.
> 별도 세이브 슬롯을 쓰거나 세이브를 백업해 두세요: `%APPDATA%\EldenRing\<스팀ID>\ER0000.sl2`

> ⚠️ **게임 버전 주의.** 마지막 검증은 **App 1.17.2 / Regulation 1.17.3** 입니다 (게임 실행 → 타이틀 화면 오른쪽 아래, 또는 시스템 → 정보에서 확인).
> 엘든링이 업데이트되면 메모리 위치가 바뀌어 일부 효과가 안 되거나 이상하게 될 수 있습니다. 1.17.1 → 1.17.2 업데이트 때 실제로
> 소환이 게임을 크래시시켰습니다(브릿지에서 고침).
> ReShade·DLSS 같은 그래픽 모드(`dxgi.dll`)를 같이 쓰면 거인화 뒤 캐릭터가 늘어난 채 보이는 일이 있었습니다 — 이상하면 그래픽 모드를 빼고 확인하세요.
> 버전이 다르면 방송 전에 [게임 없이 미리 테스트](#게임-없이-미리-테스트) 와 `!fx` 로 효과를 하나씩 먼저 확인하세요.

> ⚠️ **치지직 연동은 아직 한 번도 실제로 테스트하지 않았습니다.**
> 개발자가 해외 거주라 네이버 실명인증이 안 돼서 치지직 개발자센터에 앱을 등록하지 못했습니다.
> 코드는 [치지직 공식 API 문서](https://chzzk.gitbook.io/chzzk) 그대로 작성했지만, 실제 서버와 연결해 본 적이 없어 첫 연결에서 안 될 수 있습니다.
> 한국 네이버 계정이면 앱 등록이 가능합니다 — 처음 쓸 때 [3-a 의 "치지직 첫 테스트"](#3-a-치지직-연동) 순서로 확인해 주세요.
> (유튜브 라이브는 실제 방송 → 게임 몹 소환까지 끝까지 확인했습니다.)

---

## 시청자에게는 이렇게 보입니다

후원 금액에 따라 아래 단계에서 **랜덤**으로 하나가 발동됩니다. 후원 메시지에 **키워드**를 넣으면 그 효과를 지목할 수 있습니다 (지목한 효과의 단계 이상 금액일 때).

| 단계 | 컨셉 | 효과 (키워드) |
|---|---|---|
| **1,000원** | 성가심 | 박쥐, 잠자리 떼 `잠자리`, 독수리 `독수리`, 해파리 `해파리`, 쥐, 개, 초근접 줌, 광각 FOV, 체력 반토막, FP 0, 가짜 크래시 `크래시`, 거인화 `거인`⚠, 꼬마화 `꼬마`, 뚱보화 `뚱보`, 종이 인간 `종이`, 능력치 ±5 (60초) `스탯` |

> ⚠ **거인화는 ReShade + RenoDX DLSS 모드(게임 폴더의 `dxgi.dll`)와 충돌합니다.** 그 모드가 깔려 있으면 죽었다 부활한 뒤 거인화가 끝나도 캐릭터가 늘어난 채 보였습니다. 모드를 빼면 정상입니다. 꼬마화·뚱보화·종이 인간도 같은 크기 값을 쓰니 그 모드를 쓴다면 이 효과들은 `disabled` 에 넣으세요.
| **3,000원** | 떼 | 박쥐 떼 `박쥐`, 쥐 떼 5마리 `쥐`, 큰 쥐 2마리, 늑대 무리 `늑대`, 개 3마리 `개`, 손가락 벌레 3마리 `손가락`, 전투매 2마리 `매`, 해골 3마리 `해골`, 슬로우 모션 `슬로우`, 2배속, 스태미나 0, 무기 랜덤 교체 `무기`, 구르기 금지 20초 `구르기` |
| **5,000원** | 위협 | 바실리스크(사혈) `바실리스크`, 반인 무리 `반인`, 거대 손가락 벌레, 육지 문어 `문어`, 부패 슬라임 `슬라임`, 블러드하운드 기사 `블러드하운드`, 검은 칼 암살자 `암살자`, 체력 1, 랜덤 은총 이동 `텔포`, 게임 정지 5초 `정지`, 이동 정지 5초 `멈춰`, 주변 적 끌어오기 `끌어와` |
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

> ⚠️ **실제 연결 테스트 안 함.** 공식 문서대로 작성만 했습니다. 아래 "치지직 첫 테스트" 표로 단계별로 확인해 주세요.

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

   **치지직 첫 테스트 (처음 한 번은 꼭)** — 이 순서대로 확인하고, 안 되는 단계가 있으면 그 단계의 터미널 출력을 개발자에게 보내 주세요 (`tokens.json`, `.env` 내용은 보내지 마세요):

   | 단계 | 정상이면 터미널에 | 안 되면 의심할 것 |
   |---|---|---|
   | ① `npm run auth` | `✔ 로그인 완료: <채널명>` | 리디렉션 URL, Scope 4개 |
   | ② `npm start` | `✔ 치지직 세션 연결됨: <세션키>` | 세션 연결 방식 (socket.io) |
   | ③ 방송 중 스트리머 계정으로 채팅 `!fx Bat Swarm` | `💬 <닉네임>: !fx Bat Swarm → Bat Swarm` | 채팅 이벤트 필드 |
   | ④ 부계정으로 치즈 1,000원 후원 | `💰 <닉네임> 1000원 "..." → <효과>` | 후원 이벤트 필드 — 닉네임이 `undefined` 거나 금액이 `NaN` 이면 필드 이름 불일치 |

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
- 유튜브 채팅은 3~5초 지연이 있습니다 (폴링 API). 하루 쿼터 10,000 → 기본 설정(5초 간격)으로 약 2.7시간 방송분. 다 쓰면 터미널에 쿼터 소진이 뜨고 30분마다 다시 시도합니다. 긴 방송은 Google Cloud에서 쿼터 증설을 신청하거나 `.env`의 `YOUTUBE_POLL_MS`를 늘리세요.
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
5. **게임 화면 안에 표시 (기본 켜짐)**: 어댑터가 켜지면 Cheat Engine 이 `overlay-dll/chaos-overlay.dll` 을 게임에 넣어, 엘든링 화면 왼쪽 위(체력 바 아래)에 지금 걸린 효과·보낸 사람·남은 시간·대기 수를 직접 그립니다. 따로 할 일은 없습니다.
   - 게임 화면 자체에 그리므로 **OBS 게임 캡처에도 잡힙니다** — 시청자도 봅니다. 전체화면·창 모드 모두 됩니다.
   - 게임을 다시 켜도 자동으로 다시 들어갑니다. 끄려면 `config.json` 에서 `"screenOverlay": "off"` 로 바꾸고 게임을 다시 켜세요.
   - 문제가 생기면 `%TEMP%\chzzk-souls-chaos\overlay-dll.log` 를 보내 주세요. 게임이 업데이트돼 그릴 위치를 못 찾으면 그리지 않고 로그만 남깁니다 (게임은 정상).
   - Steam 오버레이·OBS 게임 캡처와 같이 쓰는 상태에서 확인했습니다 (2026-11-12, 1.17.2). ReShade·DLSS 모드(`dxgi.dll`)와 같이 쓰는 것은 확인 안 함.
   - **다른 방법 (선택)**: 내 화면에만 보이고 방송에는 안 잡히게 하려면 `"screenOverlay": "window"` 로 바꾸고 터미널을 하나 더 열어 `npm run screen`. 게임 창 위에 클릭이 통과되는 투명 창을 띄웁니다 (창 모드 / 테두리 없는 창 모드에서만, OBS 캡처에서 빠짐). 끄기: 그 터미널에서 Ctrl+C.

방송 전 점검: 채팅에 `!fx Bat Swarm`을 쳐서 박쥐가 나오면 전부 정상입니다.

---

## 방송 중 운영

- **스트리머/매니저 채팅 명령**: `!fx 효과이름` 또는 `!fx 키워드` (예: `!fx 즉사`, `!fx Rat Pack`). 방송 주인·관리자 계정만 먹습니다.
- **데모 모드** (`config.json` → `"demo": { "enabled": true }`): 후원 없이 **시청자 누구나** 채팅으로 가짜 후원을 쏠 수 있습니다. 데모 클립 찍을 때, 또는 후원 기능이 없는 방송에서 쓰세요.
  - `!쥐`, `!박쥐`, `!말레니아` … — 그 키워드 효과의 최소 금액으로 후원한 것처럼
  - `!후원 5000 쥐` — 5,000원 후원한 것처럼 (금액 상한 `maxAmount`, 기본 20,000)
  - `!구독` — 구독 이벤트 (멜리나)
  - 시청자별 쿨다운 `cooldownMs` (기본 30초). 실제 후원 방송에서는 꺼 두세요.
- **대기열**: 효과는 8초 간격으로 하나씩 시작됩니다. 몰릴 때 오버레이에 "대기 중 N개". 20개 넘게 밀리면 버립니다.
- **영체**: 구독 시 멜리나가 4m 옆에 나타나 따라다닙니다. 게임 영체처럼 축복 휴식·사망·지역 이동 시 사라집니다.
- **소환**: Hexinton 의 Character Spawner 는 쓰지 않고 브릿지가 게임의 디버그 생성기를 직접 씁니다 (1.17.2 에서 Hexinton 스포너가 게임을 크래시시켜서). 게임이 업데이트돼 생성기를 못 찾으면 크래시 대신 소환만 건너뜁니다.
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

  "demo": { "enabled": false, "cooldownMs": 30000, "maxAmount": 20000 },   // 시청자 가짜 후원 명령 (!쥐, !후원 5000 쥐, !구독)

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
npm run fake -- 20000 "말레니아" 후원자닉     # 후원 20,000원 (말레니아는 보스 티어)
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
| 거인화 뒤 캐릭터가 늘어난 채 남음 | ReShade/DLSS 그래픽 모드(`dxgi.dll`)와 충돌. 그 모드를 빼거나, config 의 `disabled` 에 `"Giant Player"`, `"Tiny Player"`, `"Wide Player"`, `"Paper Player"` 를 넣으세요. 이미 늘어났으면 다른 축복으로 이동하거나 타이틀로 나갔다 들어오세요 |
| 게임이 크래시 | 일부 몹 ID는 게임을 죽입니다 (예: c4550). 새 효과를 추가할 때 먼저 `!fx`로 테스트하세요 |

---

## 라이선스

MIT. 치트 테이블은 포함되어 있지 않습니다 — [Hexinton All in One](https://www.nexusmods.com/eldenring/mods/48)(Nexus)에서 직접 받으세요.
구조·실측 기록·로드맵은 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)에 있습니다.

# AI 어시스턴트용 안내 (ChatGPT / Gemini / Claude 등에 붙여넣기)

스트리머가 이 프로젝트를 설치할 때 AI 에게 도움을 받는다면, **아래 내용을 통째로 복사해 대화 맨 앞에 붙여넣으세요.**
AI 가 없는 명령을 지어내거나 다른 프로그램 방식을 섞어 안내하는 것을 막기 위한 "사실 목록" 입니다.

---

## AI 에게 주는 지시

당신은 스트리머가 `chzzk-souls-chaos` 를 설치·실행하도록 돕습니다. 반드시 지키세요:

1. **아래 "사실 목록"에 있는 명령·파일·설정 이름만 사용하세요.** 목록에 없는 명령, 플래그, 파일, 메뉴 이름을 추측해서 말하지 마세요.
2. 한 번에 **한 단계씩** 안내하고, 사용자가 **실제 출력**을 붙여넣기 전에는 다음 단계로 넘어가지 마세요.
3. 문제가 생기면 먼저 `npm run doctor` 를 실행하게 하고, 그 출력의 `❌` 줄과 바로 아래 `→` 줄에 적힌 해결 명령을 **그대로** 안내하세요. doctor 가 알려준 것과 다른 해결책을 만들어내지 마세요.
4. 확실하지 않으면 "이 프로젝트 문서에 없는 내용입니다" 라고 말하세요. 다른 트위치 통합 도구(Crowd Control, Chaos Tricks 등)의 사용법을 섞지 마세요.
5. 절대로: Steam 으로 게임을 실행한 상태(EAC 켜짐)에서 Cheat Engine 을 붙이라고 하지 마세요. 밴됩니다.
6. 사용자가 Client ID / Secret / 토큰 값을 채팅에 붙여넣으려 하면 말리세요 (`.env` 파일에만 넣음).
7. 진행 순서는 `docs/CHECKLIST.md` 의 A1 → A8, 그다음 B1 → B6 입니다. 이 순서를 바꾸지 마세요.

---

## 사실 목록

### 프로젝트
- 저장소: https://github.com/kakasolg/chzzk-souls-chaos
- 하는 일: 치지직(치즈 후원·구독·채팅) / 유튜브 라이브(슈퍼챗·멤버십·채팅) 이벤트를 받아 엘든링에 효과(몹 소환, 즉사, 슬로우 등)를 일으킴
- 동작 방식: Node.js 어댑터 → 임시 폴더의 파일 큐 → Cheat Engine 안에서 실행되는 Lua 브릿지 → Hexinton All in One 치트 테이블의 스크립트 on/off
- **Windows 전용.** macOS/Linux 불가.
- 게임: Elden Ring (Steam). 검증 버전 1.17.1. **반드시 오프라인(EAC 비활성)으로 실행.**

### 필요한 프로그램 (이것만)
- Node.js 20 이상 — https://nodejs.org
- Cheat Engine 7.5 이상 — https://www.cheatengine.org (또는 `scoop install cheat-engine`)
- Hexinton All in One 치트 테이블 8.0.x — https://www.nexusmods.com/eldenring/mods/48 (Nexus 로그인 필요, zip 안의 `.CT` 파일)
- (선택) OBS Studio — 오버레이·유튜브 송출용
- 필요 없는 것: Python, Java, Visual Studio, Twitch 계정, Crowd Control, 별도 모드 엔진

### 저장소 안의 npm 명령 (이것이 전부)
| 명령 | 하는 일 |
|---|---|
| `npm install` | 의존성 설치 (처음 한 번) |
| `npm run doctor` | 환경 점검. ✅/⚠️/ℹ️/❌ 와 해결 명령 출력 |
| `npm run install-bridge` | Cheat Engine 의 autorun 폴더에 브릿지(Lua) 복사. 인자로 CE 폴더 경로를 줄 수 있음 |
| `npm run auth` | 치지직 스트리머 계정 로그인 → `tokens.json` 생성 |
| `npm run auth:youtube` | 유튜브(구글) 계정 로그인 → `youtube-tokens.json` 생성 |
| `npm run attach` | Cheat Engine 실행(없으면) + 게임 부착 + 치트 테이블 로드 + Enable |
| `npm start` | 어댑터 실행 (방송 내내 켜 둠, Ctrl+C 로 종료) |
| `npm run keys` | 사용할 수 있는 효과 이름 전체 목록 |
| `npm run fake -- <금액> "<메시지>" <닉>` | 가짜 후원 넣기 (테스트). `npm run fake -- sub <닉>` 구독, `npm run fake -- chat "!fx 효과이름"` 채팅 |

### 파일
| 파일 | 설명 |
|---|---|
| `.env` | 비밀값·경로. `.env.example` 을 복사해서 만듦. 값에 따옴표·공백 금지 |
| `config.json` | 금액 티어·키워드·구독 보상·대기열. `config.example.json` 을 복사해서 만듦 |
| `src/profiles/hexinton.json` | 효과 정의 (고급 사용자용) |
| `tokens.json`, `youtube-tokens.json` | 로그인 토큰. 자동 생성·갱신. 공유 금지 |
| `ce/chaos-bridge.lua` | CE 브릿지 원본. `npm run install-bridge` 가 복사함 |
| `%TEMP%\chzzk-souls-chaosridge.log` | 브릿지 로그. 효과가 안 나올 때 `FAIL` 줄 확인 |
| `docs/CHECKLIST.md` | 단계별 체크리스트 (이 순서대로) |

### `.env` 에 들어가는 키 (이것이 전부)
```
HEXINTON_CT=            # 치트 테이블 .CT 파일의 전체 경로 (필수)
CHZZK_CLIENT_ID=        # 치지직 쓰면
CHZZK_CLIENT_SECRET=
CHZZK_REDIRECT_URI=http://localhost:8080/callback
YOUTUBE_CLIENT_ID=      # 유튜브 쓰면
YOUTUBE_CLIENT_SECRET=  # GOCSPX- 로 시작
YOUTUBE_REDIRECT_URI=http://localhost:8081/callback
YOUTUBE_POLL_MS=3000
PROFILE=hexinton
BACKEND=                # 비워 둠. log 로 두면 게임에 안 보내고 콘솔만 (테스트)
ADAPTER_PORT=8008
CHEAT_ENGINE_EXE=       # CE 가 기본 경로에 없을 때만
```

### 치지직 개발자센터 앱 등록 값
- 사이트: https://developers.chzzk.naver.com (네이버 실명인증 계정 필요)
- 애플리케이션 ID/이름: 자유. `chzzk`, `naver`, `치지직`, `네이버` 단어 포함 불가
- 로그인 리디렉션 URL: `http://localhost:8080/callback`
- API Scope: 사용자 정보 조회, 채팅 메시지 조회, 후원 조회, 구독 조회

### 유튜브(Google Cloud) 설정 값
- 프로젝트 생성 → APIs & Services → Library → **YouTube Data API v3** Enable
- OAuth consent screen: External. Audience → Test users 에 방송 계정 추가 (심사 불필요)
- Credentials → Create credentials → OAuth client ID → **Desktop app**
- 로그인 시 "확인되지 않은 앱" 경고는 정상 → 고급 → 계속
- 채널이 라이브를 처음 켜면 24시간 뒤부터 방송 가능
- 스트리머마다 자기 프로젝트를 만들어야 함 (공유 앱 없음)

### 방송 순서 (매번)
1. 게임 폴더의 `start_game_in_offline_mode.exe` 로 엘든링 실행 (창 모드), 캐릭터 로드
2. `npm run attach` → `✔ ... setup: pid=... entries=12901 enable=true`
3. `npm start` → `✔ 치지직 세션 연결됨` / `✔ 유튜브 채팅 연결됨`
4. 스트리머 계정으로 채팅에 `!fx Bat Swarm` → 박쥐 4마리 나오면 정상
5. (선택) OBS 브라우저 소스 `http://localhost:8008/overlay`

### 채팅 명령
- `!fx <효과 이름>` 또는 `!fx <키워드>` — 방송 주인·관리자 계정만 가능. 예: `!fx Kill Player`, `!fx 즉사`

### 자주 나오는 메시지와 뜻
| 메시지 | 뜻 / 조치 |
|---|---|
| `브릿지가 응답하지 않습니다` | CE 가 두 개 떠 있거나 CE 에 팝업이 떠 있음. CE 전부 종료 후 `npm run attach` |
| `eldenring.exe not running` | 게임을 먼저 실행 |
| `EADDRINUSE ... 8008` | 어댑터가 이미 다른 창에서 실행 중 |
| `진행 중인 방송 없음 — 15초 후 다시 확인` | 정상. 유튜브 방송이 켜지면 자동 연결 |
| `The user is not enabled for live streaming` | 그 유튜브 채널은 라이브 미활성. Studio 에서 활성화 후 24시간 |
| `access_denied` (구글 로그인) | Test users 에 그 계정이 없음 |
| `The provided client secret is invalid` | `.env` 의 YOUTUBE_CLIENT_SECRET 값이 잘못됨 (뒤에 다른 줄이 붙었는지 확인) |
| `EasyAntiCheat 도 실행 중` (doctor) | 온라인 모드. 즉시 게임 종료 후 오프라인 런처로 재실행 |
| bridge.log 의 `no process attached` | CE 가 게임에 안 붙음. `npm run attach` |
| bridge.log 의 `not registered, re-toggling spawner` | 정상 (죽은 뒤 자동 복구) |

### 효과 이름 (config.json 과 `!fx` 에 쓰는 정확한 이름 — 대소문자·띄어쓰기 그대로)
- `Kill Player` — 즉사
- `One HP` — 체력 1
- `Half HP` — 체력 반토막
- `Heal HP` — 체력 회복
- `No FP` — FP 0
- `No Stamina` — 스태미나 0
- `Slow Motion` — 슬로우 모션
- `Double Time` — 2배속
- `Pause Game` — 게임 정지
- `Ultra Zoom` — 초근접 줌
- `Quake Pro FOV` — 광각 FOV
- `Teleport Random Grace` — 랜덤 은총 이동
- `God Mode` — 무적 (보상)
- `One Hit Kill` — 한방컷 (보상)
- `Unlimited Stamina` — 무한 스태미나 (보상)
- `Unlimited FP` — 무한 FP (보상)
- `Super Poise` — 슈퍼 강인도 (보상)
- `Hide From Enemies` — 투명화 (보상)
- `No Hitbox` — 피격 무시 (보상)
- `Bat` — 박쥐
- `Bat Swarm` — 박쥐 떼
- `Operatic Bat` — 노래하는 박쥐
- `Warhawk` — 전투매
- `Warhawks` — 전투매 2마리
- `Giant Insect` — 거대 벌레
- `Dragonflies` — 잠자리 떼
- `Eagle` — 독수리
- `Jellyfish` — 해파리
- `Fingercreepers` — 손가락 벌레 3마리
- `Big Fingercreeper` — 거대 손가락 벌레
- `Rat` — 쥐
- `Rat Pack` — 쥐 떼 5마리
- `Big Rats` — 큰 쥐 2마리
- `Wolf` — 늑대
- `Wolf Pack` — 늑대 무리 3마리
- `Dog` — 개
- `Dog Pack` — 개 3마리
- `Basilisk` — 바실리스크(사혈)
- `Rot Slime` — 부패 슬라임
- `Land Octopus` — 육지 문어
- `Demi-Human Gang` — 반인 무리 4마리
- `Skeletons` — 해골 3마리
- `Bloodhound Knight` — 블러드하운드 기사
- `Black Knife` — 검은 칼 암살자
- `Crucible Knight` — 도가니 기사
- `Runebear` — 룬곰
- `Tree Sentinel` — 나무 파수꾼
- `Death Rite Bird` — 사영조
- `Spawn Malenia` — 말레니아 소환
- `Spawn Radahn` — 라단 소환
- `Spawn Maliketh` — 말리케스 소환
- `Spawn Morgott` — 모르곳 소환
- `Spawn Godfrey` — 고드프리 소환
- `Spawn Mohg` — 모그 소환
- `Spawn Fire Giant` — 화염 거인 소환
- `Spawn Dragon` — 드래곤 소환
- `Spawn Lightning Dragon` — 황금 번개 용 소환
- `Spawn Astel` — 아스텔 소환
- `Ally Wolf` — 영체: 늑대
- `Ally Black Knife` — 영체: 검은 칼 암살자
- `Ally Crucible Knight` — 영체: 도가니 기사
- `Ally Tree Sentinel` — 영체: 나무 파수꾼
- `Ally Runebear` — 영체: 룬곰
- `Ally Dragon` — 영체: 드래곤
- `Ally Malenia` — 영체: 말레니아
- `Ally Radahn` — 영체: 라단
- `Ally Melina` — 동반자: 멜리나
- `Ally Dog` — 영체: 개
- `Giant Crab` — 거대 게

### 알려진 제한
- 유튜브 채팅은 3~5초 지연. 하루 쿼터 10,000 (약 2.7시간 방송)
- 치지직 연동은 문서 스펙대로 작성됐고 실제 방송에서 아직 검증되지 않음 — 첫 사용 시 로그를 개발자에게 보내주면 좋음
- `c4550`(Monstrous Dog) 은 게임 크래시 → 사용 금지. 목록에 없는 몹 ID 를 추가하지 말 것
- 영체(멜리나 등)는 축복 휴식·사망 시 사라짐 (정상)

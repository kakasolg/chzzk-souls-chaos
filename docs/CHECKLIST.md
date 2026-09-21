# 설치·방송 체크리스트

순서대로 진행하세요. **각 단계의 "확인"이 맞지 않으면 다음으로 넘어가지 마세요.**
막히면 `npm run doctor` 를 실행하면 무엇이 빠졌는지와 고치는 명령을 알려줍니다.

모든 명령은 **이 저장소 폴더 안에서** 터미널(PowerShell 또는 명령 프롬프트)로 실행합니다.
터미널을 여는 법: 저장소 폴더를 탐색기로 연 뒤, 주소창에 `cmd` 를 입력하고 Enter.

---

## A. 한 번만 하는 설치

### A1. Node.js
- [ ] 실행: `node -v`
- 확인: `v20.x.x` 이상이 출력됨 (예: `v22.11.0`)
- 안 되면: https://nodejs.org 에서 LTS 설치 → **터미널을 닫고 새로 연 뒤** 다시 확인

### A2. 저장소 받기
- [ ] 실행:
  ```
  git clone https://github.com/kakasolg/chzzk-souls-chaos.git
  cd chzzk-souls-chaos
  npm install
  ```
- 확인: `npm install` 이 에러 없이 끝나고 `node_modules` 폴더가 생김
- 안 되면: git 이 없으면 GitHub 페이지의 **Code → Download ZIP** 으로 받아 압축을 풀고 그 폴더에서 `npm install`

### A3. 설정 파일 만들기
- [ ] 실행:
  ```
  copy .env.example .env
  copy config.example.json config.json
  ```
- 확인: 폴더에 `.env` 와 `config.json` 이 생김 (`dir` 로 확인)

### A4. Cheat Engine 설치
- [ ] Cheat Engine 7.5 이상 설치. Scoop 이 있으면 `scoop bucket add extras` → `scoop install cheat-engine` (광고 번들 없음). 없으면 https://www.cheatengine.org 설치기 (설치 중 광고 소프트웨어 제안은 **Decline**)
- 확인: `cheatengine-x86_64.exe` 가 다음 중 한 곳에 있음
  - `C:\Users\<이름>\scoop\apps\cheat-engine\current\`
  - `C:\Program Files\Cheat Engine 7.x\`
- 다른 곳에 설치했으면: `.env` 에 `CHEAT_ENGINE_EXE=전체경로\cheatengine-x86_64.exe` 추가

### A5. 브릿지 설치
- [ ] 실행: `npm run install-bridge`
- 확인: `✔ 설치됨: ...\autorun\chaos-bridge.lua` 가 출력됨
- 안 되면: 출력된 안내대로 `npm run install-bridge -- "C:\Cheat Engine 폴더 경로"`

### A6. 치트 테이블
- [ ] https://www.nexusmods.com/eldenring/mods/48 → 로그인 → **Files** → 최신 8.0.x → **Manual download** → zip 을 풀면 `eldenring_all-in-one_Hexinton-v8.0.x.CT` 파일이 나옴
- [ ] 그 `.CT` 파일의 **전체 경로**를 `.env` 의 `HEXINTON_CT=` 뒤에 적기 (예: `HEXINTON_CT=C:\Users\me\Downloads\hexinton\eldenring_all-in-one_Hexinton-v8.0.4.CT`)
- 확인: `npm run doctor` 에 `✅ 치트 테이블: eldenring_all-in-one_Hexinton-v8.0.4.CT`

### A7-a. 치지직 (치지직으로 방송하면)
- [ ] https://developers.chzzk.naver.com → 애플리케이션 등록
  - 애플리케이션 ID/이름: 자유. **단 `chzzk`, `naver`, `치지직`, `네이버` 단어는 넣으면 거절됨**
  - 로그인 리디렉션 URL: `http://localhost:8080/callback` (정확히 이대로)
  - API Scope: **사용자 정보 조회 · 채팅 메시지 조회 · 후원 조회 · 구독 조회** 4개 체크
- [ ] 발급된 Client ID, Client Secret 을 `.env` 의 `CHZZK_CLIENT_ID=`, `CHZZK_CLIENT_SECRET=` 뒤에 붙여넣기 (따옴표 없이, 줄 끝에 공백 없이)
- [ ] 실행: `npm run auth` → 브라우저에서 **스트리머 본인 계정**으로 로그인·동의
- 확인: 터미널에 `✔ 로그인 완료: <채널명>` 이 출력되고 폴더에 `tokens.json` 이 생김
- 안 되면: 브라우저 주소가 `localhost:8080/callback?...` 으로 넘어왔는데 에러가 나면 리디렉션 URL 을 다시 확인

### A7-b. 유튜브 (유튜브로 방송하면)
- [ ] https://console.cloud.google.com → 새 프로젝트 만들기 (이름 자유)
- [ ] 왼쪽 메뉴 **APIs & Services → Library** → 검색 `YouTube Data API v3` → **Enable**
- [ ] **APIs & Services → OAuth consent screen** (또는 Google Auth Platform) → **External** → 앱 이름·이메일 입력 → Create
- [ ] **Audience → Test users → Add users** → 방송할 구글 계정 이메일 추가
- [ ] **Credentials → Create credentials → OAuth client ID** → Application type **Desktop app** → Create
- [ ] 표시된 Client ID / Client secret 을 `.env` 의 `YOUTUBE_CLIENT_ID=`, `YOUTUBE_CLIENT_SECRET=` 뒤에 붙여넣기
- [ ] 실행: `npm run auth:youtube` → 브라우저에서 **방송할 구글 계정** 선택 → "확인되지 않은 앱" 경고가 나오면 **고급 → 계속** → 허용
- 확인: 터미널에 `✔ 유튜브 연동 완료` 가 출력되고 폴더에 `youtube-tokens.json` 이 생김
- 안 되면:
  - `access_denied` → Test users 에 그 계정이 없음 (위 단계로)
  - `invalid client secret` → `.env` 의 값 끝에 다른 줄이 붙었거나 공백/따옴표가 있음
  - 라이브를 한 번도 안 한 채널이면 YouTube Studio → 만들기 → 라이브 스트리밍 시작 → 전화 인증 → **24시간 뒤**부터 가능

### A8. 점검
- [ ] 실행: `npm run doctor`
- 확인: `❌` 가 하나도 없음. (`ℹ️` 와 `⚠️` 는 괜찮음)
- 안 되면: 각 `❌` 아래 `→` 줄의 명령을 실행하고 다시 `npm run doctor`

---

## B. 방송할 때마다

### B1. 엘든링 오프라인 실행
- [ ] Steam 으로 실행하지 말고, 게임 폴더(`...\steamapps\common\ELDEN RING\Game`)의 `start_game_in_offline_mode.exe` 로 실행 (없으면 Nexus mods/48 페이지 안내의 오프라인 런처를 받으세요)
- [ ] 그래픽 설정에서 **창 모드** 또는 **테두리 없는 창**
- [ ] 타이틀 화면 우하단에 **OFFLINE** 표시 확인 → 캐릭터 로드(CONTINUE)
- 확인: `npm run doctor` 에 `✅ 엘든링 실행 중 (오프라인, EAC 없음)`. `❌ ...EasyAntiCheat 도 실행 중` 이면 **즉시 게임을 끄고** 오프라인 런처로 다시 실행

### B2. Cheat Engine 붙이기
- [ ] 실행: `npm run attach`
- 확인: 1분 안에 `✔ ... setup: pid=... entries=12901 enable=true` 출력. Cheat Engine 창이 하나 떠 있음
- 안 되면:
  - `브릿지가 응답하지 않습니다` → 작업 관리자에서 `cheatengine-x86_64.exe` 를 **전부** 종료하고 다시 `npm run attach`
  - `eldenring.exe not running` → B1 먼저
  - `[ Enable ] not found` → `.env` 의 HEXINTON_CT 가 Hexinton 테이블이 아님

### B3. 어댑터 실행
- [ ] 실행: `npm start` (이 터미널 창은 방송 내내 켜 둡니다)
- 확인: 아래 줄들이 보임
  ```
  chzzk-souls-chaos 실행 중 — 프로필: hexinton, 백엔드: cheatengine-lua, 설정: config.json
  ✔ 치지직 세션 연결됨          ← 치지직을 설정했을 때
  ✔ 유튜브 채팅 연결됨          ← 유튜브 방송이 켜져 있을 때 (방송 전이면 "진행 중인 방송 없음 — 15초 후 다시 확인" 이 정상)
  ```
- 안 되면: `EADDRINUSE` → 이미 `npm start` 가 다른 창에 켜져 있음. 그 창을 쓰거나 닫기

### B4. 동작 확인
- [ ] 방송 채팅에 **스트리머 계정으로** `!fx Bat Swarm` 입력 (유튜브는 방송이 라이브 상태여야 함)
- 확인: 터미널에 `💬 <닉>: !fx Bat Swarm → Bat Swarm` 과 `▶ 박쥐 떼 (Bat Swarm)` 이 찍히고, 게임에 박쥐 4마리가 나옴 (유튜브는 3~5초 뒤)
- 안 되면:
  - 터미널에 `💬` 가 안 찍힘 → 채팅이 어댑터에 안 옴. 유튜브면 `✔ 유튜브 채팅 연결됨` 이 떴는지, 스트리머 계정으로 쳤는지 확인
  - `💬` 는 찍히는데 게임에 안 나옴 → `%TEMP%\chzzk-souls-chaos\bridge.log` 맨 아래 `FAIL` 줄 확인. 죽은 직후라면 몇 초 뒤 재시도됨

### B4-b. 데모 클립을 찍을 때 (후원 없이)
- [ ] `config.json` 에서 `"demo": { "enabled": true, ... }` 로 바꾸고 `npm start` 를 다시 실행
- [ ] 아무 계정으로 채팅에 `!쥐` → 쥐 떼 5마리, `!후원 20000 말레니아` → 말레니아, `!구독` → 멜리나
- 확인: 터미널에 `🎭 <닉>: "!쥐" → 데모 후원 3000원` 이 찍힘. 같은 사람이 30초 안에 또 치면 `🕒 데모 쿨다운 중`
- 끝나면: 실제 후원 방송 전에 `"enabled": false` 로 되돌리기

### B5. OBS 오버레이 (선택)
- [ ] OBS → 소스 **+** → **브라우저** → URL `http://localhost:8008/overlay`, 너비 1920, 높이 1080 → 확인
- 확인: 채팅에 `!fx Heal HP` 를 치면 오버레이 우상단에 "체력 회복" 카드가 잠깐 뜸

### B6. 끝낼 때
- [ ] `npm start` 터미널에서 Ctrl+C
- [ ] 게임은 **시스템 메뉴 → 게임 종료** 로 (강제 종료하면 다음에 "정상 종료되지 않음" 경고)
- [ ] Cheat Engine 닫기 → "테이블을 저장할까요?" → **아니오**

---

## 하지 말아야 할 것

- 온라인 상태(Steam 으로 실행, EAC 켜짐)에서 Cheat Engine 붙이기 → **밴**
- Cheat Engine 을 두 개 띄우기 → 명령을 서로 뺏어서 효과가 반만 나감
- `.env` 값에 따옴표나 줄 끝 공백 넣기
- `config.json` 에 효과 이름을 대충 적기 → `npm run keys` 로 정확한 이름 복사
- 검증 안 된 몹 ID 를 방송 중에 처음 써보기 → 크래시 위험 (먼저 `!fx` 로 테스트)

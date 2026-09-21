# 개발 노트

스트리머용 안내는 [README](../README.md)에 있습니다. 이 문서는 구조·실측 기록·로드맵입니다.

## 구조

```
src/
├─ chzzk/        치지직 Open API — OAuth(auth.js), 세션/이벤트 구독(session.js)
├─ sources/      youtube.js — YouTube Data API 라이브 채팅 폴링 (슈퍼챗/멤버십/채팅)
├─ effects/      실행기(executor.js), 후원→효과 라우터(router.js)
├─ profiles/     효과 정의 — hexinton.json (기본), devpoland-hotkey.json (레거시 핫키 방식)
├─ backends/     cheatengine-lua (파일 큐 → CE Lua 브릿지) / cheatengine-hotkey / log
└─ overlay/      OBS 브라우저 소스
ce/chaos-bridge.lua   Cheat Engine autorun 에 설치되는 브릿지 (명령: activate/deactivate/set/freeze/speed/spawn/ally/lua/setup)
tools/
├─ fake-donation.js   가짜 이벤트 주입
├─ list-effects.js    효과 목록
└─ install-bridge.js  브릿지를 CE autorun 폴더에 복사
```

브릿지 로그: `%TEMP%\chzzk-souls-chaos\bridge.log` — 효과가 안 먹으면 여기서 `FAIL` 줄을 확인하세요.

### 알려진 한계

- 게임 상태를 읽지 않으므로 지속 효과의 해제는 시간 기반입니다.
- 치트 테이블은 Hexinton 팀이 유지보수합니다. 엘든링 패치 후엔 테이블 업데이트를 기다려야 할 수 있고, 메모리 레코드 ID가 바뀌면 프로필의 ID를 맞춰야 합니다.
- 레거시 `devpoland-hotkey` 프로필은 글로벌 핫키 방식이라 게임 창 포커스가 필요합니다.

## 검증 환경

| 구성 | 버전 | 비고 |
|---|---|---|
| OS | Windows 11 Pro (10.0.26200) | Windows 전용 (CE·PowerShell 의존) |
| Elden Ring | **App 1.17.1 / Regulation 1.17.1** (eldenring.exe 2.7.1.0), Shadow of the Erdtree 설치 | Steam, `start_game_in_offline_mode.exe` 로 오프라인 실행, 창 모드 |
| Cheat Engine | **7.6** (Scoop `extras/cheat-engine`, 번들 없음) | 7.7 은 미검증. Hexinton 테이블이 "7.7 권장" 팝업을 띄우지만 7.6 에서 문제 없음 (`npm run attach` 가 팝업을 막음) |
| 치트 테이블 | **Hexinton All in One v8.0.4** (Nexus mods/48, 2026-09-10) | 메모리 레코드 ID 는 이 버전 기준. 테이블이 갱신되면 ID 확인 필요 |
| Node.js | 24.19 (20 이상이면 됨) | |
| OBS Studio | 32.2.2 (winget) | Game Capture "특정 창" 모드 |
| 유튜브 | YouTube Data API v3, Desktop OAuth (테스트 모드) | 채널 "mo kha" 로 Unlisted 라이브 |

## 실측 완료 (2026-09-19 ~ 20)

| 영역 | 확인한 것 |
|---|---|
| 브릿지 | CE autorun 자동 실행, 파일 큐 명령 처리, `setup`(프로세스 부착·테이블 로드·Enable) 자동화, 사망/리로드 후 스포너 훅 끊김 자동 재토글 |
| 플레이어 효과 | 즉사, 체력 1 / 반토막 / 회복(MaxHP), FP 0, 스태미나 0 고정, 슬로우 0.4x / 2배속(speedhack), 초근접 줌(FOV 0.4) / 광각(2.5), 랜덤 은총 텔포(MapID 변화 확인), 무적·한방컷 등 토글의 30초 자동 해제 |
| 소환 (화면 확인) | 개, 쥐 떼 5, 박쥐 떼 4, 늑대, 라단(c4730), 황금 번개 용(c4520), 말레니아(c2120 — 스폰됨, 정체는 대검 휘두르는 대형 개체로 추정) |
| 소환 (명령 성공, 개체 등장은 스트리머가 1·2차 관찰) | 박쥐, 노래하는 박쥐, 전투매, 거대 벌레, 잠자리, 독수리, 해파리, 손가락 벌레 소/대, 큰 쥐, 늑대 무리, 개 3, 바실리스크, 부패 슬라임, 육지 문어, 반인 무리, 해골 |
| 영체 | 늑대(팀 47): 4m 옆 스폰 후 플레이어 안 물고 쥐·병사 처치, 9m 이상 떨어지면 따라옴. 멜리나(c2180): 따라다니기만 함. 휴식 시 사라지고 재소환 없음(설계) |
| 유튜브 | OAuth 로그인·토큰 갱신, 진행 중 방송 자동 탐색, **라이브 채팅 `!fx Bat Swarm` → 게임 박쥐 떼** end-to-end. 지연 3~5초 |
| 대기열 | 후원 4건 + 구독 1건 동시 투입 → 8초 간격 순차 시작 (드라이런) |
| 라우팅 | 금액 티어, 키워드 지목(티어 이상일 때만), 구독 풀, 스트리머 `!fx` 명령, 슈퍼챗 USD→KRW 환산 (mock) |

### 알아낸 것 / 제외한 것
- `c4550` Monstrous Dog: **게임 크래시** → 제외.
- `c2010` Blaidd 등 NPC: 스포너로 안 나옴 → 제외. (`c2180` 멜리나는 나옴)
- 영체를 플레이어 몸 위에 스폰하면 팀 전환 전에 어그로가 잡혀 플레이어를 뭄 → 4m 옆 스폰으로 해결.
- Hexinton "Recruit" 루틴은 리로드 뒤 옛 포인터를 계속 써서 쓰지 않음. 우리 쪽은 HP/MaxHP 유효성 검사 후에만 씀.
- CE 두 인스턴스가 뜨면 큐를 서로 뺏음 → `attach.js` 는 프로세스 존재로 재사용.
- 브릿지에서 `print()` 쓰면 CE Lua 창이 떠서 전체화면 게임 포커스를 뺏음 → 파일 로그만.
- 유튜브 API 경로는 `/liveChat/messages` (`/liveChatMessages` 아님).

## 미검증 / 못 한 것

| 항목 | 상태 |
|---|---|
| **치지직 실연동** (OAuth, 세션 소켓, DONATION/CHAT/SUBSCRIPTION 페이로드) | 문서 스펙대로만 작성. 개발자센터 앱 등록에 네이버 실명인증이 필요해 미실측 — 첫 실측 때 필드명 불일치 가능 |
| 실제 슈퍼챗 / 멤버십 이벤트 | 결제가 필요해 mock 으로만 검증. `superChatDetails`, `newSponsorEvent` 필드는 공식 문서 기준 |
| 게임 정지(Pause Game) 5초 | 명령은 성공, 화면 확인 안 함 |
| 보스 소환 중 말리케스·모르곳·고드프리·모그·화염 거인·아스텔·드래곤(c4500)·나무 파수꾼·도가니 기사·룬곰·사영조·거대 게·블러드하운드·검은 칼 | 명령 경로는 동일하나 개체 등장을 눈으로 확인 안 함. 일부는 NpcParam(`chr×10000` 규칙) 이 안 맞을 수 있음 |
| 전투 영체 중 늑대·개 외 (기사·룬곰·용·말레니아·라단 영체) | 미검증. 기본 `disabled` |
| 장시간 방송 | 유튜브 쿼터 소진(약 2.7시간), 토큰 갱신(1시간마다), 브릿지 장시간 안정성 미검증 |
| 레거시 `devpoland-hotkey` 프로필 | 현재 게임 버전에서 미검증 (devPoland CT 가 2025-04 이후 갱신 없음) |
| Cheat Engine 7.7 | 미검증 (7.6 만) |
| 다른 PC / 다른 Windows 버전 | 이 PC 한 대에서만 |
| OBS 오버레이 | 브라우저에서 동작 확인, OBS 안에서 실제 표시는 확인 안 함 |

## 에피소드 학습 봇 (bot/)

목표: 봇이 림그레이브를 순찰하며 시청자 방해 속에서 생존하고, **죽을 때마다 복기해 플레이북을 고쳐 다음 에피소드에서 더 오래 산다**
(랜덤런 노데스 스트리머가 죽고 새 캐릭터로 시작하며 교훈을 축적하는 루프). 의미 판정: 에피소드 1~10 생존시간 중앙값 < 21~30 중앙값.
통과하면 같은 골격(관측 → 결정론적 Guard → 느린 Policy → 명령 큐 → 실행기, 워치독·기록·롤백)을 트레이딩에 옮길 근거가 생긴다.

| 단계 | 상태 |
|---|---|
| 1. 텔레메티리 포인터 + Recorder | ✅ 2026-09-21. `bot/telemetry.py`, `bot/record.py`. 브릿지 `symbols` 명령이 테이블의 AOB 결과를 내보내고 pymem 이 재사용 |
| 2. 순찰 봇 (웨이포인트 + Guard, vgamepad) | ✅ 2026-09-21. ViGEmBus 가상 패드, `nav.goto` 조향, `patrol.py` 왕복 순찰. 204 m 경로 무사 완주 |
| 3. 플레이북 + 복기 + 롤백 | 예정 |

## 로드맵

- [x] 유튜브 라이브 소스
- [ ] Streamlabs / StreamElements 소켓 소스 (유튜브 쿼터 우회)
- [ ] 소환 ID 전수 확인 (스포너 HP 로 추정 가능)
- [ ] 상태 이상 효과 (ApplyEffect SpEffect ID)
- [ ] 다른 소울류(다크소울3, 세키로) 프로필
- [ ] 효과 투표 모드 (채팅 1/2/3/4)
- [ ] Nexus Mods 페이지


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

## 검증 상태

Elden Ring 1.17.1 (App 2.7.1) + Hexinton 8.0.4 + Cheat Engine 7.6 에서 실측:
즉사 · 체력 1/반토막/회복 · FP 0 · 스태미나 0 · 슬로우/2배속 · 초근접 줌/광각 FOV · 랜덤 은총 이동 · 캐릭터 소환(개, c4520, 라단) · 무적 등 보상 토글의 30초 자동 해제.
말레니아는 `c2120`, `c4520` 은 황금 번개 용(별도 효과로 유지). 쥐 떼 5마리 동시 소환 확인.
**유튜브 라이브 채팅 → 어댑터 → 게임 end-to-end 확인** (2026-09-20, 지연 3~5초는 유튜브 폴링 API 특성).
**영체(아군) 소환 확인** — `ally` 명령: 플레이어 4m 옆에 스폰해 영체 팀(47)으로 편입. 황금빛으로 따라다니며 대신 싸웁니다(늑대가 쥐·병사를 잡는 것 확인). 멜리나(c2180)는 따라오기만 하는 동반자. 게임 영체처럼 **축복 휴식·리로드·사망으로 사라지면 끝** (재소환 없음, 최대 10분 유지). 구독 보상 기본값. `dismiss` 로 전부 해제.
(처음엔 플레이어 몸 위에 스폰돼 팀 전환 전에 어그로가 잡혀 플레이어를 물었음 → 옆으로 떨어뜨려 해결.)
**죽고 리스폰하면 스포너 훅이 끊기는 문제**는 브릿지가 자동 감지해 스포너를 껐다 켜고 재시도합니다.
크래시: `c4550` Monstrous Dog 은 게임을 죽이므로 제외. NPC(c2010 Blaidd 등)는 스포너로 안 나옴.
박쥐 떼(4마리) 등장도 확인. 아직 눈으로 확인 못 한 것: 게임 정지.

## 로드맵

- [x] 유튜브 라이브 소스
- [ ] Streamlabs / StreamElements 소켓 소스 (유튜브 쿼터 우회)
- [ ] 소환 ID 전수 확인 (스포너 HP 로 추정 가능)
- [ ] 상태 이상 효과 (ApplyEffect SpEffect ID)
- [ ] 다른 소울류(다크소울3, 세키로) 프로필
- [ ] 효과 투표 모드 (채팅 1/2/3/4)
- [ ] Nexus Mods 페이지


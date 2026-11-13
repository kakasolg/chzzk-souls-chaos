--[[
  chzzk-souls-chaos ─ Cheat Engine 브릿지

  Cheat Engine 의 autorun 폴더에 넣으면 CE 시작 시 자동 실행된다.
  어댑터(Node)가 %TEMP%\chzzk-souls-chaos\cmd.txt 에 한 줄씩 명령을 append 하고,
  이 스크립트가 100ms 마다 파일을 가져가(rename) 실행한다.

  명령 (공백 구분):
    activate <id>            메모리 레코드/스크립트 켜기 (freeze)
    deactivate <id>          끄기
    set <id> <value>         값 쓰기
    freeze <id> <value>      값 쓰고 고정
    unfreeze <id>            고정 해제
    speed <x>                speedhack_setSpeed(x)
    spawn <chrId> [npcParam] Hexinton Character Spawner 로 캐릭터 스폰 (플레이어 위치)
    ally <chrId> [npcParam] [초]  4m 옆에 스폰 후 영체 팀(47)으로 편입 — 따라다니며 대신 싸움.
                             게임 영체처럼 휴식/리로드/사망으로 사라지면 끝. 최대 유지 600초
    dismiss                  아군 전부 해제(원래 팀으로)
    lua <code>               임의 Lua 실행 (chaosRec(id), chaosLog(msg) 사용 가능)
    read <id> [id ...]       레코드 값을 로그에 기록 (디버그)
    symbols                  테이블이 등록한 주요 심볼 주소를 symbols.json 에 기록 (외부 리더용)
    warp <graceId>           해당 축복으로 워프 (Hexinton Choose Grace + Invoke Warp)
    setsave <id> <value>     원래 값을 기억해 두고 쓰기 (restore 로 되돌림)
    restore <id> [id ...]    setsave/setrandom/jolt 전 원래 값으로 되돌리기
    setrandom <id,id,...> <v1> <v2> ...   목록에서 하나 골라 모든 id 에 setsave (무기 랜덤)
    jolt <delta> <id> [id ...]            id 중 하나를 골라 ±delta (능력치 흔들기, 1 아래로 안 내려감)
    pull [반경 m] [최대 수]  가까운 일반 적을 플레이어 주변으로 끌어온다 (보스 제외)
    overload [무게]          오른손 무기 param 무게를 잠시 크게 → 과적으로 구르기 금지 / unoverload 로 복구
    ping                     로그에 pong

  로그: %TEMP%\chzzk-souls-chaos\bridge.log  (CE Lua 엔진 창(Ctrl+Alt+L)에도 print)
]]

local DIR = (os.getenv('CHAOS_BRIDGE_DIR') or (os.getenv('TEMP') .. '\\chzzk-souls-chaos'))
local CMD = DIR .. '\\cmd.txt'
local WORK = DIR .. '\\cmd.processing'
local LOG = DIR .. '\\bridge.log'


os.execute('mkdir "' .. DIR .. '" 2>nul')

-- print() 는 쓰지 않는다: CE 가 Lua Engine 창을 띄우면서 게임의 포커스를 뺏는다.
-- 테이블 자체 스크립트들도 print 로 에러를 뿜으며 같은 문제를 일으키므로, CE 전역 print 를 파일 로그로 돌린다.
local function log(msg)
  local line = os.date('%H:%M:%S ') .. tostring(msg)
  local f = io.open(LOG, 'a')
  if f then f:write(line, '\n'); f:close() end
end

local function rec(id)
  if getOpenedProcessID() == 0 then error('no process attached (open eldenring.exe in Cheat Engine first)') end
  local r = getAddressList().getMemoryRecordByID(tonumber(id))
  if not r then error('no memory record with id ' .. tostring(id)) end
  return r
end
chaosRec = rec  -- `lua` 명령에서 쓸 수 있도록 전역으로도 노출
chaosLog = log
if not chaosOrigPrint then chaosOrigPrint = print end
print = function(...)
  local parts = {}
  for i = 1, select('#', ...) do parts[#parts + 1] = tostring(select(i, ...)) end
  log('[ce print] ' .. table.concat(parts, '	'))
end

local function playerPos()
  local base = '[[[[[WorldChrMan]+10EF8]+0]+190]+68]'
  return readFloat(base .. '+70'), readFloat(base .. '+74'), readFloat(base .. '+78')
end

-- ── 캐릭터 소환 ─────────────────────────────────────────
-- 게임의 디버그 캐릭터 생성기(CS::CSDebugChrCreator)에 모델·NpcParam·좌표를 쓰고 +0x44 를 1 로 하면 다음 프레임에 생성된다.
-- Hexinton 8.0.4 의 Character Spawner 는 쓰지 않는다:
--[[
 * ── 알려진 한계 / 1.17.2 크래시 기록 ──────────────────────────────
 *  · Hexinton 은 생성기를 [WorldChrMan+1E648] 고정 오프셋으로 읽는데, 1.17.2 에서 그 앞에 필드가 끼어들어
 *    생성기가 +1E658 로 밀렸다. +1E648 은 0 이라 Spawn Debug Character 가 [0+44] 에 쓰다가 게임이 크래시했다.
 *  · 그래서 오프셋 숫자 대신 RTTI 클래스 이름으로 생성기를 찾는다. 다음 패치에 또 밀려도 따라가고,
 *    못 찾으면 아무것도 쓰지 않고 실패 로그만 남긴다 (크래시 대신 "소환 안 됨").
 *  · 생성기 안쪽 필드(+44 플래그, +B0 좌표, +F0 NpcParam, +100 모델, +178 플레이어형, +1B0 마지막 생성 개체)는
 *    Hexinton·Scripts-Data-Exposer 와 같은 배치. 패치로 이 안쪽이 바뀌면 다시 확인해야 한다.
]]
local CREATOR_CLASS = 'CS::CSDebugChrCreator'
local creatorOff = nil

local function isCreator(p)
  if not p or p < 0x10000 then return false end
  local ok, n = pcall(getRTTIClassName, p)
  return ok and n == CREATOR_CLASS
end

local function debugCreator()
  local wcm = readQword(getAddressSafe('WorldChrMan'))
  if not wcm or wcm == 0 then return nil end
  if creatorOff and isCreator(readQword(wcm + creatorOff)) then return readQword(wcm + creatorOff) end
  for off = 0x1D000, 0x20000, 8 do
    local p = readQword(wcm + off)
    if isCreator(p) then
      if creatorOff ~= off then log(('spawn: %s at WorldChrMan+%X'):format(CREATOR_CLASS, off)) end
      creatorOff = off
      return p
    end
  end
  return nil
end

local function spawnOnce(chrId, npcParam, offset)
  local c = debugCreator()
  if not c then error(CREATOR_CLASS .. ' not found — spawn skipped (game patch?)') end
  if (readBytes(c + 0x44, 1) or 0) ~= 0 then error('creator busy — previous spawn not consumed yet') end
  local px, py, pz = playerPos()
  if not px then error('player position unavailable') end
  if offset and offset > 0 then
    -- 플레이어 몸 위가 아니라 옆에 떨어뜨려 스폰 (아군은 팀 전환 전에 어그로가 잡히지 않도록)
    local a = math.random() * 2 * math.pi
    px, pz = px + math.cos(a) * offset, pz + math.sin(a) * offset
  end
  local model = chrId:sub(1, 5)
  for i = 0, 4 do writeSmallInteger(c + 0x100 + i * 2, model:byte(i + 1) or 0) end
  writeSmallInteger(c + 0x10A, 0)
  writeInteger(c + 0xF0, npcParam)
  writeInteger(c + 0xF4, npcParam)
  writeInteger(c + 0xF8, 0)
  writeInteger(c + 0xFC, 0)
  writeBytes(c + 0x178, 0)
  writeInteger(c + 0x17C, 0)
  writeFloat(c + 0xB0, px); writeFloat(c + 0xB4, py); writeFloat(c + 0xB8, pz)
  writeBytes(c + 0x44, 1)
  return c
end

local function lastCreated()
  local c = debugCreator()
  return (c and readQword(c + 0x1B0)) or 0
end

-- onDone(ptr|nil) 은 스폰이 확인되거나 포기했을 때 호출된다 (비동기)
local function spawn(chrId, npcParam, onDone, offset)
  local num = tonumber(chrId:match('c(%d+)'))
  npcParam = tonumber(npcParam) or (num * 10000)
  local prev = lastCreated()
  local ok, err = pcall(spawnOnce, chrId, npcParam, offset)
  if not ok then
    log('spawn ' .. chrId .. ': FAILED (' .. tostring(err) .. ')')
    if onDone then onDone(nil) end
    return
  end
  local tries = 0
  local t = createTimer(nil)
  t.Interval = 20
  t.OnTimer = function(tm)
    tries = tries + 1
    local p = lastCreated()
    if p ~= 0 and p ~= prev then
      tm.destroy()
      chaosLastSpawn = p
      log(('spawn %s: ok %X'):format(chrId, p))
      if onDone then onDone(p) end
    elseif tries > 150 then
      tm.destroy()
      -- 3초 안에 생성 안 됨: 플래그를 내려 두어 다음 소환이 막히지 않게 한다
      local c = debugCreator()
      if c then pcall(writeBytes, c + 0x44, 0) end
      log('spawn ' .. chrId .. ': FAILED (not created within 3s)')
      if onDone then onDone(nil) end
    end
  end
  t.Enabled = true
end

-- 스폰한 개체를 아군(영체)으로 편입. Hexinton "Recruit Target as Ally" 루틴에 등록해 따라다니게 하고,
-- 등록이 안 되면 우리 쪽 타이머가 팀 값을 계속 다시 쓴다.
--
-- ── 알려진 한계 / 주의 ──────────────────────────────
--  · 게임이 NPC 기본 팀으로 되돌리는 경우가 있어 팀 값은 한 번 쓰고 끝내면 안 된다 (되돌아간 채 불사면 죽일 수 없는 적).
--    그래서 폴백에서는 NoDead 를 켜지 않고, 0.5초마다 팀을 재확인한다. `dismiss` 로 전부 원복.
local ALLY_TEAM = 47  -- Spirit Summon
chaosAllies = chaosAllies or {}  -- 폴백으로 관리 중인 아군 { ptr, old, timer }

-- 좌표 주소 (Hexinton Recruit 루틴과 동일한 경로): ChrIns → +190 → +68 → +70 (x,y,z), 그리고 havok 쪽 +A8 → +18 → +80
local function chrPosAddrs(p)
  local ok1, p1 = pcall(readQword, p + 0x190); if not ok1 or not p1 or p1 == 0 then return nil end
  local ok2, p2 = pcall(readQword, p1 + 0x68); if not ok2 or not p2 or p2 == 0 then return nil end
  local pos = p2 + 0x70
  local ok3, p3 = pcall(readQword, p2 + 0xA8)
  local ok4, p4 = false, nil
  if ok3 and p3 and p3 ~= 0 then ok4, p4 = pcall(readQword, p3 + 0x18) end
  local pos2 = (ok4 and p4 and p4 ~= 0) and (p4 + 0x80) or nil
  return pos, pos2
end


local FOLLOW_DIST = 9.0      -- 이보다 멀어지면 플레이어 옆으로 당겨온다 (멀어지면 게임이 개체를 정리해 버림)
local ALLY_LIFETIME = 600    -- 초. 영체 최대 유지 시간 (ally 명령 3번째 인자로 바꿀 수 있음)
local ALLY_RESPAWN_MAX = 0   -- 게임 영체처럼: 축복 휴식/리로드/사망으로 사라지면 그걸로 끝 (재소환 안 함)

-- 개체가 아직 살아있는 ChrIns 인지: HP/MaxHP 가 정상 범위여야 한다. 아니면 포인터가 무효(리로드로 정리됨).
-- 무효한 포인터에 계속 쓰면 그 메모리를 재사용하는 다른 개체를 건드릴 수 있으므로 바로 손을 뗀다.
local function allyAlive(p)
  local okH, hp = pcall(readInteger, string.format('[[%X+190]+0]+138', p))
  local okM, mx = pcall(readInteger, string.format('[[%X+190]+0]+13C', p))
  if not (okH and okM and hp and mx) then return false end
  return hp > 0 and mx > 0 and mx < 1000000 and hp <= mx
end

local allySummon  -- forward

-- 한 영체 슬롯: 포인터가 무효해지면(휴식·리로드) 같은 몹을 다시 부르고, 수명이 끝나면 해제한다.
local function allyFallbackStart(p, slot)
  local okOld, ob = pcall(readBytes, p + 0x6C, 1, true)
  slot.ptr, slot.old = p, (okOld and ob and ob[1]) or 6
  local t = createTimer(nil)
  t.Interval = 500
  local ticks = 0
  t.OnTimer = function(tm)
    ticks = ticks + 1
    if getOpenedProcessID() == 0 or os.time() > slot.deadline then
      tm.destroy(); chaosAllies[p] = nil
      if getOpenedProcessID() ~= 0 and allyAlive(p) then pcall(writeBytes, p + 0x6C, slot.old) end
      log('ally ' .. slot.chrId .. ': lifetime over')
      return
    end
    if not allyAlive(p) then
      tm.destroy(); chaosAllies[p] = nil
      if ticks < 6 then return log('ally ' .. slot.chrId .. ': vanished right after spawn') end
      if slot.respawns < ALLY_RESPAWN_MAX then
        slot.respawns = slot.respawns + 1
        log(('ally %s: vanished (rest/reload) — re-summoning %d/%d'):format(slot.chrId, slot.respawns, ALLY_RESPAWN_MAX))
        allySummon(slot)
      else
        log('ally ' .. slot.chrId .. ': gone (rest/reload/death) — released')
      end
      return
    end
    pcall(writeBytes, p + 0x6C, ALLY_TEAM)
    if ticks % 3 == 0 then  -- 1.5초마다 따라오기
      pcall(function()
        local pos, pos2 = chrPosAddrs(p)
        if not pos then return end
        local px, py, pz = playerPos()
        local ax, ay, az = readFloat(pos), readFloat(pos + 4), readFloat(pos + 8)
        local d = math.sqrt((px - ax) ^ 2 + (py - ay) ^ 2 + (pz - az) ^ 2)
        if d > FOLLOW_DIST then
          local nx, nz = px + 2.0, pz + 2.0
          writeFloat(pos, nx); writeFloat(pos + 4, py); writeFloat(pos + 8, nz)
          if pos2 then writeFloat(pos2, nx); writeFloat(pos2 + 4, py); writeFloat(pos2 + 8, nz) end
        end
      end)
    end
  end
  slot.timer = t
  chaosAllies[p] = slot
  t.Enabled = true
end

allySummon = function(slot)
  spawn(slot.chrId, slot.npcParam, function(p)
    if not p then return log('ally ' .. slot.chrId .. ': spawn failed') end
    pcall(writeBytes, p + 0x6C, ALLY_TEAM)
    allyFallbackStart(p, slot)
  end, 4.0)  -- 4m 옆에 스폰
end

-- 테이블의 Recruit 루틴은 리로드 뒤 옛 포인터를 계속 쓰므로 쓰지 않고 우리 슬롯 방식만 사용한다.
local function ally(chrId, npcParam, seconds)
  local num = tonumber(chrId:match('c(%d+)'))
  npcParam = tonumber(npcParam) or (num * 10000)
  local slot = { chrId = chrId, npcParam = npcParam, deadline = os.time() + (tonumber(seconds) or ALLY_LIFETIME), respawns = 0 }
  allySummon(slot)
  log(('ally %s: summoning for %ds'):format(chrId, slot.deadline - os.time()))
end

chaosSpawn, chaosAlly = spawn, ally  -- `lua` 명령에서 디버그용
chaosLastSpawn = nil

-- 모든 아군 해제: 테이블 루틴 끄기(원복) + 폴백 아군 원래 팀으로
local function dismiss()
  for p, e in pairs(chaosAllies) do
    if e.timer then e.timer.destroy() end
    if allyAlive(p) then pcall(writeBytes, p + 0x6C, e.old) end
    chaosAllies[p] = nil
  end
  log('dismiss: allies released')
end

-- 테이블의 Lua 가 띄우는 안내 팝업(버전 경고 등)을 막는다. 전체화면 게임 포커스를 뺏기 때문.
local function silenceDialogs()
  showMessage = function() end
  messageDialog = function() return mrOk end
end

local ENABLE_ID = 1337092247  -- Hexinton [ Enable ]

-- 테이블이 이 CE 보다 새 버전(CheatEngineTableVersion)으로 저장돼 있으면 CE 가 "newer version" 모달을 띄운다.
-- 그 모달은 CE 내장이라 Lua 로 막을 수 없으므로, 임시 폴더에 버전 번호만 낮춘 사본을 만들어 그걸 연다.
-- 원본은 건드리지 않고 재배포하지도 않는다.
local function patchedTablePath(ctPath)
  local f = io.open(ctPath, 'rb'); if not f then return ctPath end
  local data = f:read('a'); f:close()
  local patched, n = data:gsub('CheatEngineTableVersion="%d+"', 'CheatEngineTableVersion="40"', 1)
  if n == 0 then return ctPath end
  local out = DIR .. '\\table.patched.CT'
  local w = io.open(out, 'wb'); if not w then return ctPath end
  w:write(patched); w:close()
  return out
end

-- 게임 안 표시 DLL (overlay-dll/chaos-overlay.dll). 어댑터가 overlaydll 명령으로 경로를 알려 주면 주입하고,
-- 게임이 다시 켜져 setup 이 새 프로세스에 붙을 때도 다시 주입한다.
chaosOverlayDll = chaosOverlayDll
local function injectOverlay()
  if not chaosOverlayDll then return end
  if getAddressSafe('chaos-overlay.dll') then return end  -- 이미 들어가 있음
  local ok, err = pcall(injectDLL, chaosOverlayDll, true)
  log(ok and ('overlay dll injected: ' .. chaosOverlayDll) or ('FAIL overlay dll inject -> ' .. tostring(err)))
end

local lastCtPath
local function setup(ctPath)
  lastCtPath = ctPath
  local pid = getProcessIDFromProcessName('eldenring.exe')
  if not pid or pid == 0 then error('eldenring.exe not running') end
  if getOpenedProcessID() ~= pid then
    -- 게임만 재시작된 경우: 옛 프로세스에 켜 두었던 스크립트를 실행 없이 끄고 새 프로세스에 다시 붙인다
    -- (그냥 끄면 [DISABLE] 이 죽은 프로세스에 쓰려다 실패한다). 기억해 둔 원래 값도 옛 캐릭터 것이라 버린다.
    -- 켜져 있던 스크립트(카메라 FOV 스크립트처럼 어댑터 시작 때 한 번만 켜는 것)는 새 프로세스에서 다시 켠다.
    -- 안 그러면 그 스크립트에 기대는 레코드가 '??' 가 된다.
    local al = getAddressList()
    local reenable = {}
    for i = al.Count - 1, 0, -1 do
      local r = al[i]
      if r.Active then
        if r.Type == vtAutoAssembler and r.ID ~= ENABLE_ID then reenable[#reenable + 1] = r.ID end
        pcall(function() r.disableWithoutExecute() end)
      end
    end
    chaosSaved = {}
    openProcess(pid)
    if getOpenedProcessID() ~= pid then error('openProcess failed for pid ' .. pid) end
    chaosReenable = reenable
  end
  if getAddressList().Count == 0 then
    silenceDialogs()
    loadTable(patchedTablePath(ctPath))
  end
  local en = getAddressList().getMemoryRecordByID(ENABLE_ID)
  if not en then error('[ Enable ] not found — is this the Hexinton table?') end
  if not en.Active then en.Active = true end
  if chaosReenable then
    -- 바깥(부모) 스크립트부터 켜지도록 목록 순서(위→아래)로
    for i = #chaosReenable, 1, -1 do
      local r = getAddressList().getMemoryRecordByID(chaosReenable[i])
      if r and not r.Active then pcall(function() r.Active = true end) end
    end
    log('re-enabled ' .. #chaosReenable .. ' script(s) after reattach')
    chaosReenable = nil
  end
  log(('setup: pid=%d entries=%d enable=%s'):format(getOpenedProcessID(), getAddressList().Count, tostring(en.Active)))
  injectOverlay()
end

-- 외부(Python) 리더가 테이블의 AOB 스캔 결과를 재사용할 수 있게 심볼 주소를 내보낸다
local SYMBOLS = { 'WorldChrMan', 'GameDataMan', 'FieldArea', 'GameMan', 'LocalPlayerOffset', 'SpawnedEnemy', 'LastLockOnTarget', 'WarpLocation', 'camadr' }
local HEX_CAM_SECTION = 1337199163  -- [ Teleport, Coords, NoClip/FreeCam ] — camadr(카메라 주소) 심볼을 등록하는 스크립트
local function symbols()
  -- 카메라 yaw 를 읽으려면 텔레포트/카메라 섹션 스크립트가 켜져 있어야 한다 (camadr 등록)
  pcall(function() local r = getAddressList().getMemoryRecordByID(HEX_CAM_SECTION); if r and not r.Active then r.Active = true end end)
  local out = { pid = getOpenedProcessID(), exe = getAddressSafe('eldenring.exe') }
  for _, name in ipairs(SYMBOLS) do out[name] = getAddressSafe(name) end
  local parts = {}
  for k, v in pairs(out) do parts[#parts + 1] = ('"%s": %s'):format(k, v and ('"0x%X"'):format(v) or 'null') end
  local f = assert(io.open(DIR .. '\\symbols.json', 'w'))
  f:write('{' .. table.concat(parts, ', ') .. '}')
  f:close()
  log('symbols written: ' .. DIR .. '\\symbols.json')
end

-- ── 되돌릴 수 있는 값 변경 ──────────────────────────────
-- 효과가 끝나면 원래 값으로 돌려야 하므로 처음 바꿀 때의 값을 기억한다.
-- 같은 레코드를 두 효과가 겹쳐 바꿔도 "처음" 값만 기억하므로 마지막 restore 는 원래 값이 된다.
chaosSaved = chaosSaved or {}
math.randomseed(os.time())

-- 포인터가 아직 안 풀린 레코드(게임 로딩 중, 재접속 직후 카메라 스크립트가 꺼진 FOV 등)는 Value 가 '??' 다.
-- 그 값을 기억했다가 restore 에서 쓰면 CE 가 "?? is an invalid float" 를 내고 브릿지가 멈췄다 (2026-11-12).
local function readable(v) return v ~= nil and v ~= '' and not tostring(v):find('?', 1, true) end

local function save(id)
  local k = tostring(id)
  if chaosSaved[k] == nil then
    local v = rec(id).Value
    if not readable(v) then error(('record %s not readable now (%s)'):format(k, tostring(v))) end
    chaosSaved[k] = v
  end
end

local function setsave(id, v)
  save(id)
  rec(id).Value = v
end

local function restore(...)
  for _, id in ipairs({ ... }) do
    local k = tostring(id)
    local v = chaosSaved[k]
    chaosSaved[k] = nil
    if readable(v) then
      local ok, err = pcall(function() rec(id).Value = v end)
      if not ok then log('restore ' .. k .. ' failed: ' .. tostring(err)) end
    end
  end
end

local function setrandom(ids, ...)
  local pool = { ... }
  local v = pool[math.random(#pool)]
  for id in ids:gmatch('[^,]+') do setsave(id, v) end
  log('setrandom ' .. ids .. ' = ' .. v)
end

local function jolt(delta, ...)
  local ids = { ... }
  local id = ids[math.random(#ids)]
  save(id)
  local r = rec(id)
  local cur = tonumber(r.Value) or 0
  local d = (tonumber(delta) or 5) * (math.random(2) == 1 and 1 or -1)
  r.Value = tostring(math.max(1, cur + d))
  log(('jolt %s %s -> %s'):format(r.Description, cur, r.Value))
end

-- ── 적 끌어오기 ──────────────────────────────────────────
-- WorldChrMan 의 캐릭터 배열을 돌며 가까운 일반 적의 좌표를 플레이어 주변 원 위로 옮긴다.
-- 좌표는 맵 타일 기준이라 먼 타일의 개체는 거리 계산이 틀어지므로 반경으로 거른다.
-- 보스(팀 7)는 제외: 보스 구역 밖으로 빼면 전투 이벤트가 깨질 수 있다.
-- 배열 위치는 패치마다 움직인다 (1.17.1: +1F1B8, 1.17.2: +1F1C8). 그래서 "첫 항목이 플레이어인 배열"을 찾아 쓴다.
local PULL_TEAMS = { [6] = true, [24] = true, [25] = true, [27] = true, [33] = true, [48] = true }  -- 48: 고드릭 병사·늑대 (1.17.2 실측)
local chrListOff = nil
local function chrPhys(p)
  local m = readQword(p + 0x190); if not m or m == 0 then return nil end
  local phys = readQword(m + 0x68); if not phys or phys == 0 then return nil end
  return phys, readQword(m + 0x00)
end

local function findChrList(wcm, player)
  for _, o in ipairs({ chrListOff, 0x1F1C8, 0x1F1B8 }) do
    if o and readQword(readQword(wcm + o) or 0) == player then return o end
  end
  for o = 0x1E000, 0x20000, 8 do
    local b = readQword(wcm + o)
    if b and b > 0x10000 and readQword(b) == player then
      local e = readQword(wcm + o + 8)
      if e and e > b and e - b <= 8 * 4096 then return o end
    end
  end
end

local function pull(radius, maxN)
  radius, maxN = tonumber(radius) or 40, tonumber(maxN) or 8
  local wcm = readQword(getAddressSafe('WorldChrMan'))
  local slot = readQword(wcm + (getAddressSafe('LocalPlayerOffset') or 0x10EF8))
  local player = slot and readQword(slot)
  local pphys = player and chrPhys(player)
  if not pphys then error('player not found') end
  local px, py, pz = readFloat(pphys + 0x70), readFloat(pphys + 0x74), readFloat(pphys + 0x78)
  chrListOff = findChrList(wcm, player)
  if not chrListOff then error('chr list not found') end
  local b, e = readQword(wcm + chrListOff), readQword(wcm + chrListOff + 8)
  local found = {}
  for a = b, e - 8, 8 do
    local p = readQword(a)
    if p and p > 0x10000 and p ~= player then
      local ok, phys, stats = pcall(chrPhys, p)
      local team = ok and phys and readBytes(p + 0x6C, 1)
      local hp = stats and readInteger(stats + 0x138)
      if team and PULL_TEAMS[team] and hp and hp > 0 then
        local x, y, z = readFloat(phys + 0x70), readFloat(phys + 0x74), readFloat(phys + 0x78)
        local d = math.sqrt((x - px) ^ 2 + (y - py) ^ 2 + (z - pz) ^ 2)
        if d > 3 and d <= radius then found[#found + 1] = { phys = phys, d = d } end
      end
    end
  end
  table.sort(found, function(m, n) return m.d < n.d end)
  local n = math.min(#found, maxN)
  for i = 1, n do
    local ang = (i / n) * 2 * math.pi
    writeFloat(found[i].phys + 0x70, px + math.cos(ang) * 3.5)
    writeFloat(found[i].phys + 0x74, py + 0.5)
    writeFloat(found[i].phys + 0x78, pz + math.sin(ang) * 3.5)
  end
  log(('pull: %d enemies within %dm, moved %d'):format(#found, radius, n))
end

-- ── 구르기 금지 (과적) ───────────────────────────────────
-- 테이블에 구르기만 끄는 플래그가 없어서, 장착한 오른손 무기의 param 무게를 잠시 크게 만들어 과적 상태로 만든다.
-- 과적이면 구르기·달리기가 막히고 걷기만 된다. 공격은 된다. 행 찾는 방식은 Hexinton ParamUtils 와 같다.
local function paramRow(paramName, id)
  local reg = getAddressSafe('CSRegulationManagerImp')
  if not reg then error('CSRegulationManagerImp symbol missing') end
  local list = readQword(reg) + 0x18
  local s, e = readQword(list), readQword(list + 8)
  for a = s, e - 8, 8 do
    local p = readQword(a)
    local name = (readInteger(p + 0x28) or 0) > 7 and readString(readQword(p + 0x18), 90, true) or readString(p + 0x18, 90, true)
    if name == paramName then
      local base = readQword(readQword(p + 0x80) + 0x80)
      local n = readSmallInteger(base + 0x0A) & 0xFFFF
      for i = 0, n - 1 do
        if readInteger(base + 0x40 + 0x18 * i) == id then return base + readInteger(base + 0x48 + 0x18 * i) end
      end
      error(('%s row %d not found'):format(paramName, id))
    end
  end
  error('param ' .. paramName .. ' not found')
end

local RIGHT_WEP = 1337193096
local overloadAddr = nil
local function overload(weight)
  if overloadAddr then return end
  local wep = readInteger(rec(RIGHT_WEP).CurrentAddress)
  local row = wep - wep % 100            -- 강화 수치(+0~25)는 행 ID 에 없다
  local addr = paramRow('EquipParamWeapon', row) + 0x10
  chaosSaved['overload'] = readFloat(addr)
  writeFloat(addr, tonumber(weight) or 999)
  overloadAddr = addr
  log(('overload: weapon %d row %d weight %.1f -> %s'):format(wep, row, chaosSaved['overload'], weight or 999))
end

local function unoverload()
  if not overloadAddr then return end
  writeFloat(overloadAddr, chaosSaved['overload'])
  chaosSaved['overload'], overloadAddr = nil, nil
end

local handlers = {
  overload   = overload,
  unoverload = unoverload,
  setup      = function(...) setup(table.concat({ ... }, ' ')) end,
  overlaydll = function(...) chaosOverlayDll = table.concat({ ... }, ' '); injectOverlay() end,
  symbols    = symbols,
  warp       = function(id) rec(1337304716).Value = tostring(id); rec(1337304717).Active = true end,
  ping       = function() log('pong') end,
  activate   = function(id) rec(id).Active = true end,
  deactivate = function(id) rec(id).Active = false end,
  set        = function(id, v) rec(id).Value = v end,
  freeze     = function(id, v) local r = rec(id); r.Value = v; r.Active = true end,
  unfreeze   = function(id) rec(id).Active = false end,
  speed      = function(x) speedhack_setSpeed(tonumber(x)) end,
  spawn      = function(chrId, npcParam) spawn(chrId, npcParam) end,
  ally       = ally,
  setsave    = setsave,
  restore    = restore,
  setrandom  = setrandom,
  jolt       = jolt,
  pull       = pull,
  dismiss    = dismiss,
  lua        = function(code) assert(load(code))() end,
  read       = function(...)
    local out = {}
    for _, id in ipairs({ ... }) do
      local r = rec(id)
      out[#out + 1] = r.Description .. '=' .. tostring(r.Value)
    end
    log('read ' .. table.concat(out, ' | '))
  end,
}

local function execLine(line)
  local kind, rest = line:match('^(%S+)%s*(.*)$')
  if not kind then return end
  local h = handlers[kind]
  if not h then return log('unknown command: ' .. line) end
  -- 어댑터를 켜 둔 채 게임만 다시 켠 경우: 명령마다 PID 를 비교해 새 게임에 자동으로 다시 붙는다
  -- (테이블은 이미 로드돼 있어 몇 초면 끝난다. 예전엔 npm run attach 를 다시 돌려야 했고, 안 하면 효과가 조용히 실패했다)
  if kind ~= 'setup' and (lastCtPath or getAddressList().Count > 0) then
    local pid = getProcessIDFromProcessName('eldenring.exe')
    if pid and pid ~= 0 and pid ~= getOpenedProcessID() then
      log('game restarted (pid ' .. tostring(getOpenedProcessID()) .. ' -> ' .. pid .. '), reattaching')
      local ok, err = pcall(setup, lastCtPath or '')
      if not ok then log('FAIL auto reattach -> ' .. tostring(err)) end
    end
  end
  local ok, err
  if kind == 'lua' then
    ok, err = pcall(h, rest)
  else
    local args = {}
    for a in rest:gmatch('%S+') do args[#args + 1] = a end
    ok, err = pcall(h, table.unpack(args))
  end
  if ok then log('ok   ' .. line) else log('FAIL ' .. line .. ' -> ' .. tostring(err)) end
end

local function tick()
  -- 지난 묶음이 도중에 죽어 WORK 가 남아 있으면 rename 이 영원히 실패해 브릿지가 멈춘다 (2026-11-12) → 먼저 치운다
  local stale = io.open(WORK, 'r')
  if stale then
    stale:close()
    log('stale ' .. WORK .. ' found (previous batch aborted), discarding')
    os.remove(WORK)
  end
  -- 어댑터가 append 중이면 rename 이 실패하므로 다음 tick 에 다시 시도
  if not os.rename(CMD, WORK) then return end
  local f = io.open(WORK, 'r')
  if not f then return end
  -- 실행 전에 다 읽고 파일부터 지운다: 한 줄이 잡히지 않는 오류로 죽어도 다음 tick 은 정상으로 돈다
  local lines = {}
  for line in f:lines() do
    line = line:gsub('\r', '')
    if line ~= '' then lines[#lines + 1] = line end
  end
  f:close()
  os.remove(WORK)
  for _, line in ipairs(lines) do execLine(line) end
end

-- CE 가 꺼져 있던 동안 쌓인 명령은 버린다 (다시 켜질 때 즉사 같은 효과가 한꺼번에 터지지 않게)
os.remove(CMD); os.remove(WORK)

if chaosBridgeTimer then chaosBridgeTimer.destroy() end
chaosBridgeTimer = createTimer(nil)
chaosBridgeTimer.Interval = 100
chaosBridgeTimer.OnTimer = function() local ok, e = pcall(tick); if not ok then log('tick error: ' .. tostring(e)) end end
chaosBridgeTimer.Enabled = true

log('bridge ready, watching ' .. CMD)

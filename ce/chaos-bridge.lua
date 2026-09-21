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
    ping                     로그에 pong

  로그: %TEMP%\chzzk-souls-chaos\bridge.log  (CE Lua 엔진 창(Ctrl+Alt+L)에도 print)
]]

local DIR = (os.getenv('CHAOS_BRIDGE_DIR') or (os.getenv('TEMP') .. '\\chzzk-souls-chaos'))
local CMD = DIR .. '\\cmd.txt'
local WORK = DIR .. '\\cmd.processing'
local LOG = DIR .. '\\bridge.log'

-- Hexinton All in One 8.x 의 메모리 레코드 ID (프로필 JSON 과 동일)
local HEX = {
  spawner      = 1987705401,
  spawnerInner = 1987705402,
  chrId        = 1987705422,
  npcParam     = 1987705425,
  npcThink     = 1987705426,
  enemyType    = 1987705420,
  printPos     = 1987705434,
  spawnDebug   = 1987705439,
}

os.execute('mkdir "' .. DIR .. '" 2>nul')

-- print() 는 쓰지 않는다: CE 가 Lua Engine 창을 띄우면서 전체화면 게임의 포커스를 뺏는다.
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

-- 플레이어가 죽거나 맵을 다시 불러오면 스포너 훅이 끊긴다(스크립트는 켜져 보여도 소환 안 됨).
-- 그래서 스폰 후 SpawnedEnemy 포인터가 안 바뀌면 스포너를 껐다 켜고 한 번 더 시도한다.
local function spawnerRetoggle()
  rec(HEX.spawnerInner).Active = false
  rec(HEX.spawner).Active = false
  rec(HEX.spawner).Active = true
  rec(HEX.spawnerInner).Active = true
end

local HEX_SPAWN_X, HEX_SPAWN_Z = 1987705435, 1987705437

local function spawnOnce(chrId, npcParam, offset)
  rec(HEX.spawner).Active = true
  rec(HEX.spawnerInner).Active = true
  rec(HEX.enemyType).Value = '0'
  rec(HEX.chrId).Value = chrId
  rec(HEX.npcParam).Value = tostring(npcParam)
  rec(HEX.npcThink).Value = tostring(npcParam)
  rec(HEX.printPos).Active = true   -- 현재 플레이어 좌표를 SpawnPos 에 복사
  if offset and offset > 0 then
    -- 플레이어 몸 위가 아니라 옆에 떨어뜨려 스폰 (아군은 팀 전환 전에 어그로가 잡히지 않도록)
    local a = math.random() * 2 * math.pi
    local x = tonumber(rec(HEX_SPAWN_X).Value) or 0
    local z = tonumber(rec(HEX_SPAWN_Z).Value) or 0
    rec(HEX_SPAWN_X).Value = tostring(x + math.cos(a) * offset)
    rec(HEX_SPAWN_Z).Value = tostring(z + math.sin(a) * offset)
  end
  rec(HEX.spawnDebug).Active = true
end

local function spawnedPtr()
  local ok, p = pcall(readQword, 'SpawnedEnemy')
  return (ok and p) or 0
end

-- onDone(ptr|nil) 은 스폰이 확인되거나 포기했을 때 호출된다 (비동기)
local function spawn(chrId, npcParam, onDone, offset)
  local num = tonumber(chrId:match('c(%d+)'))
  npcParam = tonumber(npcParam) or (num * 10000)
  local prev = spawnedPtr()
  spawnOnce(chrId, npcParam, offset)
  local tries, retried = 0, false
  local t = createTimer(nil)
  t.Interval = 20
  t.OnTimer = function(tm)
    tries = tries + 1
    local p = spawnedPtr()
    if p ~= 0 and p ~= prev then
      tm.destroy()
      chaosLastSpawn = p
      if onDone then onDone(p) end
    elseif tries == 60 and not retried then
      retried = true
      log('spawn ' .. chrId .. ': not registered, re-toggling spawner')
      pcall(spawnerRetoggle)
      pcall(spawnOnce, chrId, npcParam, offset)
    elseif tries > 200 then
      tm.destroy()
      log('spawn ' .. chrId .. ': FAILED (no SpawnedEnemy after retry)')
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
  local ok4, p4 = ok3 and p3 and p3 ~= 0 and pcall(readQword, p3 + 0x18)
  local pos2 = (ok4 and p4 and p4 ~= 0) and (p4 + 0x80) or nil
  return pos, pos2
end

local function playerPos()
  local base = '[[[[[WorldChrMan]+10EF8]+0]+190]+68]'
  return readFloat(base .. '+70'), readFloat(base .. '+74'), readFloat(base .. '+78')
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

local function setup(ctPath)
  if getOpenedProcessID() == 0 then
    openProcess('eldenring.exe')
    if getOpenedProcessID() == 0 then error('eldenring.exe not running') end
  end
  if getAddressList().Count == 0 then
    silenceDialogs()
    loadTable(ctPath)
  end
  local en = getAddressList().getMemoryRecordByID(ENABLE_ID)
  if not en then error('[ Enable ] not found — is this the Hexinton table?') end
  if not en.Active then en.Active = true end
  log(('setup: pid=%d entries=%d enable=%s'):format(getOpenedProcessID(), getAddressList().Count, tostring(en.Active)))
end

local handlers = {
  setup      = function(...) setup(table.concat({ ... }, ' ')) end,
  ping       = function() log('pong') end,
  activate   = function(id) rec(id).Active = true end,
  deactivate = function(id) rec(id).Active = false end,
  set        = function(id, v) rec(id).Value = v end,
  freeze     = function(id, v) local r = rec(id); r.Value = v; r.Active = true end,
  unfreeze   = function(id) rec(id).Active = false end,
  speed      = function(x) speedhack_setSpeed(tonumber(x)) end,
  spawn      = function(chrId, npcParam) spawn(chrId, npcParam) end,
  ally       = ally,
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
  -- 어댑터가 append 중이면 rename 이 실패하므로 다음 tick 에 다시 시도
  if not os.rename(CMD, WORK) then return end
  local f = io.open(WORK, 'r')
  if not f then return end
  for line in f:lines() do
    line = line:gsub('\r', '')
    if line ~= '' then execLine(line) end
  end
  f:close()
  os.remove(WORK)
end

if chaosBridgeTimer then chaosBridgeTimer.destroy() end
chaosBridgeTimer = createTimer(nil)
chaosBridgeTimer.Interval = 100
chaosBridgeTimer.OnTimer = function() local ok, e = pcall(tick); if not ok then log('tick error: ' .. tostring(e)) end end
chaosBridgeTimer.Enabled = true

log('bridge ready, watching ' .. CMD)

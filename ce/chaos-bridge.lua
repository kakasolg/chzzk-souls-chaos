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
    ally <chrId> [npcParam]  스폰 후 아군(영체 팀 47)으로 편입 — 따라다니며 대신 싸움
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

local function spawnOnce(chrId, npcParam)
  rec(HEX.spawner).Active = true
  rec(HEX.spawnerInner).Active = true
  rec(HEX.enemyType).Value = '0'
  rec(HEX.chrId).Value = chrId
  rec(HEX.npcParam).Value = tostring(npcParam)
  rec(HEX.npcThink).Value = tostring(npcParam)
  rec(HEX.printPos).Active = true   -- 현재 플레이어 좌표를 SpawnPos 에 복사
  rec(HEX.spawnDebug).Active = true
end

local function spawnedPtr()
  local ok, p = pcall(readQword, 'SpawnedEnemy')
  return (ok and p) or 0
end

-- onDone(ptr|nil) 은 스폰이 확인되거나 포기했을 때 호출된다 (비동기)
local function spawn(chrId, npcParam, onDone)
  local num = tonumber(chrId:match('c(%d+)'))
  npcParam = tonumber(npcParam) or (num * 10000)
  local prev = spawnedPtr()
  spawnOnce(chrId, npcParam)
  local tries, retried = 0, false
  local t = createTimer(nil)
  t.Interval = 100
  t.OnTimer = function(tm)
    tries = tries + 1
    local p = spawnedPtr()
    if p ~= 0 and p ~= prev then
      tm.destroy()
      chaosLastSpawn = p
      if onDone then onDone(p) end
    elseif tries == 12 and not retried then
      retried = true
      log('spawn ' .. chrId .. ': not registered, re-toggling spawner')
      pcall(spawnerRetoggle)
      pcall(spawnOnce, chrId, npcParam)
    elseif tries > 40 then
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
local HEX_TARGETED_ENEMY = 601372
local HEX_RECRUIT_ALLY   = 1337320100
local ALLY_TEAM = 47  -- Spirit Summon
chaosAllies = chaosAllies or {}  -- 폴백으로 관리 중인 아군 { ptr, old, timer }

local function allyFallbackStart(p)
  local okOld, ob = pcall(readBytes, p + 0x6C, 1, true)
  local entry = { ptr = p, old = (okOld and ob and ob[1]) or 6 }
  local t = createTimer(nil)
  t.Interval = 500
  local ticks = 0
  t.OnTimer = function(tm)
    ticks = ticks + 1
    local okHp, hp = pcall(readInteger, '[[' .. string.format('%X', p) .. '+190]+0]+138')
    if getOpenedProcessID() == 0 or ticks > 1200 or (okHp and hp and hp <= 0) then
      tm.destroy(); chaosAllies[p] = nil; return
    end
    pcall(writeBytes, p + 0x6C, ALLY_TEAM)
  end
  entry.timer = t
  chaosAllies[p] = entry
  t.Enabled = true
end

local function allyRecruit(p)
  -- 테이블 루틴은 락온 대상을 보므로 그 포인터를 잠시 스폰 개체로 바꿔치기한다
  if not RecruitAlly_AddCurrentTarget then return false end
  for _ = 1, 15 do
    pcall(writeQword, 'LastLockOnTarget', p)
    if GetPtr_3 then pcall(GetPtr_3) end
    local ok, r1, retry = pcall(RecruitAlly_AddCurrentTarget, true)
    if ok and r1 == true then return true end
    if ok and retry == false then return false end
    sleep(100)
  end
  return false
end

local function ally(chrId, npcParam)
  rec(HEX_TARGETED_ENEMY).Active = true
  rec(HEX_RECRUIT_ALLY).Active = true
  spawn(chrId, npcParam, function(p)
    if not p then return log('ally ' .. chrId .. ': spawn failed') end
    pcall(writeBytes, p + 0x6C, ALLY_TEAM)
    local registered = allyRecruit(p)
    if not registered then allyFallbackStart(p) end
    log(('ally %s: %s'):format(chrId, registered and 'recruited (table)' or 'fallback reassert (no NoDead)'))
  end)
end

chaosSpawn, chaosAlly = spawn, ally  -- `lua` 명령에서 디버그용
chaosLastSpawn = nil

-- 모든 아군 해제: 테이블 루틴 끄기(원복) + 폴백 아군 원래 팀으로
local function dismiss()
  local r = getAddressList().getMemoryRecordByID(HEX_RECRUIT_ALLY)
  if r and r.Active then r.Active = false end
  for p, e in pairs(chaosAllies) do
    if e.timer then e.timer.destroy() end
    pcall(writeBytes, p + 0x6C, e.old)
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

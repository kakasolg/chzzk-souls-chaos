// 환경 점검: 무엇이 준비됐고 무엇이 빠졌는지 ✅/❌ 로 보여주고, 빠진 것마다 정확한 해결 명령을 안내한다.
// 사용: npm run doctor
import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (...p) => path.join(ROOT, ...p);
const results = [];
let problems = 0;

function ok(msg) { results.push(['✅', msg]); }
function warn(msg, fix) { results.push(['⚠️', msg, fix]); }
function bad(msg, fix) { results.push(['❌', msg, fix]); problems++; }
function info(msg) { results.push(['ℹ️', msg]); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
function processes(name) {
  try {
    const out = execSync(`tasklist /FI "IMAGENAME eq ${name}" /NH`, { encoding: 'utf8' });
    return out.split(/\r?\n/).filter((l) => l.toLowerCase().startsWith(name.toLowerCase())).length;
  } catch { return 0; }
}
function sha(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }

// ── 1. Node / 파일 ──
const major = Number(process.versions.node.split('.')[0]);
if (major >= 20) ok(`Node.js ${process.versions.node}`);
else bad(`Node.js ${process.versions.node} — 20 이상 필요`, 'https://nodejs.org 에서 LTS 설치 후 터미널을 다시 여세요');

if (process.platform !== 'win32') bad('Windows 가 아닙니다', '이 도구는 Windows + Cheat Engine 전용입니다');

if (!fs.existsSync(at('node_modules'))) bad('node_modules 없음 (의존성 미설치)', 'npm install');
else ok('의존성 설치됨 (node_modules)');

if (!fs.existsSync(at('.env'))) bad('.env 파일 없음', 'copy .env.example .env  (그 다음 메모장으로 .env 를 열어 값 입력)');
else ok('.env 있음');

let config = null;
if (!fs.existsSync(at('config.json'))) {
  warn('config.json 없음 — config.example.json 의 기본값으로 실행됨', 'copy config.example.json config.json');
  config = readJson(at('config.example.json'));
} else {
  try { config = readJson(at('config.json')); ok('config.json 문법 정상'); }
  catch (e) { bad(`config.json 문법 오류: ${e.message}`, 'JSON 문법을 고치거나 copy /Y config.example.json config.json 으로 되돌리세요'); }
}

// 프로필 / 효과 이름 검증
const profileName = process.env.PROFILE || 'hexinton';
const profilePath = at('src', 'profiles', `${profileName}.json`);
let profile = null;
if (!fs.existsSync(profilePath)) bad(`프로필 파일 없음: src/profiles/${profileName}.json`, '.env 의 PROFILE 값을 지우거나 hexinton 으로 두세요');
else {
  profile = readJson(profilePath);
  ok(`프로필 ${profileName} (${Object.keys(profile.effects).length}개 효과)`);
  if (config) {
    const names = new Set(Object.keys(profile.effects));
    const refs = [
      ...(config.tiers ?? []).flatMap((t) => t.pool ?? []),
      ...Object.values(config.keywords ?? {}),
      ...(config.subscription?.pool ?? []),
      ...(config.disabled ?? []),
    ];
    const badRefs = [...new Set(refs.filter((n) => !names.has(n)))];
    if (badRefs.length) bad(`config.json 에 존재하지 않는 효과 이름: ${badRefs.join(', ')}`, 'npm run keys 로 정확한 이름을 확인해 config.json 을 고치세요 (대소문자·띄어쓰기까지 같아야 함)');
    else ok('config.json 의 효과 이름이 모두 프로필에 존재');
  }
}

// ── 2. 치트 테이블 ──
const ct = process.env.HEXINTON_CT;
if (!ct) bad('.env 에 HEXINTON_CT 가 비어 있음', '.env 에 HEXINTON_CT=C:\\경로\\eldenring_all-in-one_Hexinton-v8.0.4.CT 처럼 받은 .CT 파일의 전체 경로를 적으세요');
else if (!fs.existsSync(ct)) bad(`HEXINTON_CT 경로에 파일이 없음: ${ct}`, '경로에 오타가 없는지, zip 을 풀었는지 확인하세요 (.zip 이 아니라 .CT 파일을 가리켜야 함)');
else {
  const head = fs.readFileSync(ct, { encoding: 'utf8', flag: 'r' }).slice(0, 400000);
  if (!/<ID>1337092247<\/ID>/.test(head)) bad('HEXINTON_CT 가 Hexinton All in One 테이블이 아니거나 구조가 다른 버전입니다', 'Nexus mods/48 에서 8.0.x 버전을 받으세요');
  else ok(`치트 테이블: ${path.basename(ct)}`);
}

// ── 3. Cheat Engine / 브릿지 ──
const ceCandidates = [
  process.env.CHEAT_ENGINE_EXE,
  path.join(os.homedir(), 'scoop/apps/cheat-engine/current/cheatengine-x86_64.exe'),
  ...['7.7', '7.6', '7.5'].map((v) => `C:/Program Files/Cheat Engine ${v}/cheatengine-x86_64.exe`),
].filter((p) => p && fs.existsSync(p));
const ceExe = ceCandidates[0];
if (!ceExe) bad('Cheat Engine 을 찾지 못함', 'Cheat Engine 7.5 이상을 설치하고, 기본 경로가 아니면 .env 에 CHEAT_ENGINE_EXE=전체경로\\cheatengine-x86_64.exe 를 적으세요');
else {
  ok(`Cheat Engine: ${ceExe}`);
  const autorun = path.join(path.dirname(ceExe), 'autorun', 'chaos-bridge.lua');
  const src = at('ce', 'chaos-bridge.lua');
  if (!fs.existsSync(autorun)) bad('브릿지가 Cheat Engine autorun 폴더에 없음', 'npm run install-bridge');
  else if (sha(autorun) !== sha(src)) bad('autorun 의 브릿지가 이 저장소의 것과 다름 (오래된 버전)', 'npm run install-bridge  (그 다음 Cheat Engine 을 껐다 켜세요)');
  else ok('브릿지 설치됨 (최신)');
}

const ceCount = processes('cheatengine-x86_64.exe');
if (ceCount > 1) bad(`Cheat Engine 이 ${ceCount}개 실행 중 — 하나만 있어야 합니다`, '작업 관리자에서 cheatengine-x86_64.exe 를 전부 끝낸 뒤 npm run attach 를 다시 실행');
else if (ceCount === 1) ok('Cheat Engine 실행 중 (1개)');
else info('Cheat Engine 꺼져 있음 — npm run attach 가 자동으로 켭니다');

// ── 4. 게임 ──
const game = processes('eldenring.exe');
const eac = processes('EasyAntiCheat_EOS.exe') + processes('start_protected_game.exe');
if (!game) info('엘든링 꺼져 있음 — 방송 전에 오프라인 모드로 실행하세요 (README "방송 시작 순서" 1단계)');
else if (eac) bad('엘든링이 실행 중인데 EasyAntiCheat 도 실행 중 (온라인 모드)', '게임을 끄고 start_game_in_offline_mode.exe 로 다시 실행하세요. 온라인 상태에서 치트 엔진을 붙이면 밴됩니다');
else ok('엘든링 실행 중 (오프라인, EAC 없음)');

// ── 5. 브릿지 응답 ──
const dir = process.env.CHAOS_BRIDGE_DIR || path.join(os.tmpdir(), 'chzzk-souls-chaos');
const logFile = path.join(dir, 'bridge.log');
if (ceCount === 1) {
  fs.mkdirSync(dir, { recursive: true });
  const before = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
  fs.appendFileSync(path.join(dir, 'cmd.txt'), 'ping\n');
  let pong = false;
  for (let i = 0; i < 25 && !pong; i++) {
    await sleep(200);
    pong = fs.existsSync(logFile) && fs.statSync(logFile).size > before && fs.readFileSync(logFile, 'utf8').slice(before).includes('pong');
  }
  if (pong) ok('브릿지 응답 (ping → pong)');
  else bad('Cheat Engine 은 떠 있는데 브릿지가 응답하지 않음', 'Cheat Engine 창에 팝업이 떠 있으면 닫고, 그래도 안 되면 CE 를 끄고 npm run install-bridge → npm run attach');
}
if (fs.existsSync(logFile)) {
  const tail = fs.readFileSync(logFile, 'utf8').trim().split(/\r?\n/).slice(-30);
  const fails = tail.filter((l) => l.includes('FAIL') || l.includes('tick error'));
  if (fails.length) warn(`브릿지 로그 최근 30줄에 실패 ${fails.length}건: ${fails.at(-1).slice(0, 120)}`, `전체 로그: ${logFile}`);
}

// ── 6. 포트 ──
const port = Number(process.env.ADAPTER_PORT || 8008);
try {
  const out = execSync(`netstat -ano -p tcp | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' }).trim();
  if (out) warn(`포트 ${port} 를 이미 쓰는 프로그램이 있음 (어댑터가 이미 실행 중?)`, '이미 npm start 가 켜져 있으면 정상. 아니면 .env 의 ADAPTER_PORT 를 8009 등으로 바꾸세요');
  else ok(`포트 ${port} 사용 가능`);
} catch { ok(`포트 ${port} 사용 가능`); }

// ── 7. 치지직 ──
const chz = { id: process.env.CHZZK_CLIENT_ID, secret: process.env.CHZZK_CLIENT_SECRET };
if (!chz.id && !chz.secret) info('치지직: 설정 안 함 (.env 의 CHZZK_CLIENT_ID/SECRET 비어 있음)');
else if (!chz.id || !chz.secret) bad('치지직: CLIENT_ID 와 CLIENT_SECRET 중 하나만 있음', '.env 에 둘 다 넣으세요 (개발자센터 애플리케이션 상세 화면)');
else if (!fs.existsSync(at('tokens.json'))) bad('치지직: 앱 정보는 있으나 로그인 안 됨 (tokens.json 없음)', 'npm run auth');
else {
  try {
    const { ensureAccessToken, api } = await import('../src/chzzk/api.js');
    const token = await ensureAccessToken(chz);
    const me = await api.me(token);
    ok(`치지직 연결됨: ${me.channelName ?? me.channelId}`);
  } catch (e) {
    bad(`치지직 토큰 확인 실패: ${e.message}`, 'npm run auth 로 다시 로그인하세요. 401 이면 Client ID/Secret 오타, 리디렉션 URL 이 http://localhost:8080/callback 인지 확인');
  }
}

// ── 8. 유튜브 ──
const yt = { id: process.env.YOUTUBE_CLIENT_ID, secret: process.env.YOUTUBE_CLIENT_SECRET };
if (!yt.id && !yt.secret) info('유튜브: 설정 안 함 (.env 의 YOUTUBE_CLIENT_ID/SECRET 비어 있음)');
else if (!yt.id || !yt.secret) bad('유튜브: CLIENT_ID 와 CLIENT_SECRET 중 하나만 있음', '.env 에 둘 다 넣으세요 (Google Cloud → Credentials → OAuth client)');
else if (!/^GOCSPX-[A-Za-z0-9_-]{20,40}$/.test(yt.secret)) bad('유튜브: CLIENT_SECRET 모양이 이상함 (GOCSPX- 로 시작하는 35자여야 함)', '.env 에서 값 끝에 다른 줄이 붙지 않았는지, 따옴표/공백이 없는지 확인');
else if (!fs.existsSync(at('youtube-tokens.json'))) bad('유튜브: 앱 정보는 있으나 로그인 안 됨 (youtube-tokens.json 없음)', 'npm run auth:youtube');
else {
  try {
    const t = readJson(at('youtube-tokens.json'));
    let access = t.access_token;
    if (Date.now() > (t.expiresAt ?? 0) - 60000) {
      const body = new URLSearchParams({ client_id: yt.id, client_secret: yt.secret, grant_type: 'refresh_token', refresh_token: t.refresh_token });
      const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body }).then((x) => x.json());
      if (!r.access_token) throw new Error(r.error_description ?? r.error ?? 'refresh failed');
      access = r.access_token;
      fs.writeFileSync(at('youtube-tokens.json'), JSON.stringify({ ...t, ...r, expiresAt: Date.now() + r.expires_in * 1000 }, null, 2));
    }
    const h = { Authorization: `Bearer ${access}` };
    const ch = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: h }).then((x) => x.json());
    if (ch.error) throw new Error(ch.error.message);
    const name = ch.items?.[0]?.snippet?.title ?? '(채널 없음)';
    const b = await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status&broadcastStatus=active&broadcastType=all&maxResults=1', { headers: h }).then((x) => x.json());
    if (b.error?.message?.includes('not enabled for live streaming')) bad(`유튜브 로그인됨 (${name}) 이지만 이 채널은 라이브 스트리밍이 꺼져 있음`, 'YouTube Studio → 만들기 → 라이브 스트리밍 시작 → 전화 인증. 첫 활성화는 24시간 뒤부터 가능');
    else if (b.error) throw new Error(b.error.message);
    else if (b.items?.length) ok(`유튜브 연결됨: ${name} — 지금 라이브 중 "${b.items[0].snippet.title}"`);
    else ok(`유튜브 연결됨: ${name} (지금은 방송 중 아님 — 방송을 켜면 어댑터가 자동으로 찾음)`);
  } catch (e) {
    bad(`유튜브 토큰 확인 실패: ${e.message}`, 'npm run auth:youtube 로 다시 로그인. "access_denied" 면 Google Cloud → OAuth consent screen → Audience → Test users 에 그 구글 계정을 추가');
  }
}

// ── 출력 ──
console.log('\nchzzk-souls-chaos 점검 결과\n');
for (const [icon, msg, fix] of results) {
  console.log(`${icon} ${msg}`);
  if (fix) console.log(`     → ${fix}`);
}
console.log('');
if (problems === 0) {
  console.log('문제 없음. 다음 단계:');
  if (!game) console.log('  1) 엘든링을 오프라인 모드로 실행하고 캐릭터를 로드');
  console.log(`  ${game ? 1 : 2}) npm run attach`);
  console.log(`  ${game ? 2 : 3}) npm start`);
} else {
  console.log(`❌ ${problems}개 문제. 위의 → 안내대로 고친 뒤 npm run doctor 를 다시 실행하세요.`);
  process.exitCode = 1;
}

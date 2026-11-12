import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createBackend } from './backends/index.js';
import { EffectExecutor } from './effects/executor.js';
import { Router } from './effects/router.js';
import { ChzzkSession } from './chzzk/session.js';
import { loadTokens } from './chzzk/api.js';
import { YouTubeSource } from './sources/youtube.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const profileName = process.env.PROFILE || 'hexinton';
const table = readJson(path.join(ROOT, `src/profiles/${profileName}.json`));
const configPath = fs.existsSync(path.join(ROOT, 'config.json')) ? 'config.json' : 'config.example.json';
const config = readJson(path.join(ROOT, configPath));
const port = Number(process.env.ADAPTER_PORT || 8008);

const backendName = process.env.BACKEND || table.backend || 'cheatengine-lua';
const backend = createBackend(backendName);
const executor = new EffectExecutor(table, backend, {
  gapMs: Number(config.queue?.gapMs ?? 8000),
  maxPending: Number(config.queue?.maxPending ?? 20),
});
const router = new Router(config, executor.names());

// ── 오버레이 / 가짜 이벤트 주입용 로컬 서버 ──
const overlayHtml = fs.readFileSync(path.join(ROOT, 'src/overlay/index.html'));
const isLocalOrigin = (origin) => !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/overlay')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(overlayHtml);
  }
  if (req.method === 'GET' && req.url === '/effects') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(executor.names()));
  }
  const fake = /^\/fake\/(donation|chat|subscription)$/.exec(req.url ?? '');
  if (req.method === 'POST' && fake) {
    // 다른 웹페이지가 몰래 가짜 후원을 보내지 못하게: JSON 요청 + 브라우저 Origin 없음(또는 이 PC)만 허용
    if (!/^application\/json/i.test(req.headers['content-type'] ?? '') || !isLocalOrigin(req.headers.origin)) {
      return res.writeHead(403).end('forbidden');
    }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      try {
        handle(fake[1], JSON.parse(body), 'fake');
        res.writeHead(200).end('ok');
      } catch (e) {
        res.writeHead(400).end(String(e.message));
      }
    });
    return;
  }
  res.writeHead(404).end();
});
const wss = new WebSocketServer({ server, verifyClient: ({ origin }) => isLocalOrigin(origin) });
wss.on('error', () => {}); // server 의 error 를 그대로 다시 내보내므로 위 핸들러가 처리
const broadcast = (msg) => {
  const s = JSON.stringify(msg);
  for (const c of wss.clients) if (c.readyState === 1) c.send(s);
};
executor.on('start', (e) => {
  console.log(`▶ ${e.label} (${e.name}) ← ${e.by ?? '?'} ${e.amount ? e.amount + '원' : ''} [${e.source}]`);
  broadcast({ type: 'start', ...e });
});
executor.on('end', (e) => broadcast({ type: 'end', ...e }));
executor.on('queued', (e) => {
  if (e.position > 0) console.log(`⏳ ${e.label} 대기 ${e.position}번째 ← ${e.by ?? '?'}`);
  broadcast({ type: 'queued', ...e });
});
executor.on('dropped', (e) => { console.warn(`✖ ${e.label} 버림 (대기열 가득) ← ${e.by ?? '?'}`); broadcast({ type: 'dropped', ...e }); });
executor.on('unknown', (n) => console.warn('알 수 없는 효과:', n));
executor.on('error', (e) => console.error('[효과 실행 오류]', e.message));

// ── 이벤트 → 효과 ──
function handle(kind, data, source) {
  try {
    handleEvent(kind, data ?? {}, source);
  } catch (e) {
    console.error(`[${source}] 이벤트 처리 실패 (${kind}):`, e.message);
  }
}

function handleEvent(kind, data, source) {
  let pick, by, amount;
  if (kind === 'donation') {
    if (data.donationText == null) data = { ...data, donationText: '' };
    pick = router.forDonation(data);
    by = data.donatorNickname;
    amount = Number(data.payAmount);
    console.log(`💰 ${by} ${amount}원 "${data.donationText ?? ''}" → ${pick?.effect ?? '(무시)'}`);
  } else if (kind === 'subscription') {
    pick = router.forSubscription(data);
    by = data.subscriberNickname;
    console.log(`⭐ ${by} 구독 ${data.month}개월 → ${pick?.effect ?? '(무시)'}`);
  } else if (kind === 'chat') {
    const r = router.forChat(data);
    by = data.profile?.nickname;
    if (!r) return;
    if (r.cooldown) return console.log(`🕒 ${by}: 데모 쿨다운 중 (무시)`);
    if (r.donation) { console.log(`🎭 ${by}: "${data.content}" → 데모 후원 ${r.donation.payAmount}원`); return handleEvent('donation', r.donation, source + ':demo'); }
    if (r.subscription) { console.log(`🎭 ${by}: "${data.content}" → 데모 구독`); return handleEvent('subscription', r.subscription, source + ':demo'); }
    pick = r;
    console.log(`💬 ${by}: ${data.content} → ${pick.effect}`);
  }
  if (pick) executor.trigger(pick.effect, { by, amount, source, reason: pick.reason });
}

// ── 입력 소스 연결 (자격 증명 있는 것만) ──
async function connectChzzk() {
  const client = { id: process.env.CHZZK_CLIENT_ID, secret: process.env.CHZZK_CLIENT_SECRET };
  if (!client.id || !client.secret || !loadTokens()) {
    console.log('ℹ 치지직 미연결 (CHZZK_CLIENT_ID/SECRET 또는 tokens.json 없음)');
    return;
  }
  const session = new ChzzkSession(client);
  session.on('ready', (key) => console.log('✔ 치지직 세션 연결됨:', key));
  session.on('socket', (s) => console.log('[chzzk]', s));
  session.on('system', (m) => console.log('[chzzk]', m.type, m.data));
  session.on('error', (e) => console.error('[chzzk]', e.message));
  session.on('donation', (d) => handle('donation', d, 'chzzk'));
  session.on('subscription', (d) => handle('subscription', d, 'chzzk'));
  session.on('chat', (d) => handle('chat', d, 'chzzk'));
  await session.start();
}

async function connectYouTube() {
  const client = { id: process.env.YOUTUBE_CLIENT_ID, secret: process.env.YOUTUBE_CLIENT_SECRET };
  if (!client.id || !client.secret || !YouTubeSource.loadTokens()) {
    console.log('ℹ 유튜브 미연결 (YOUTUBE_CLIENT_ID/SECRET 또는 youtube-tokens.json 없음)');
    return;
  }
  const yt = new YouTubeSource(client, {
    rates: config.youtube?.rates,
    minPollMs: Number(process.env.YOUTUBE_POLL_MS || 5000),
  });
  yt.on('waiting', () => console.log('[youtube] 진행 중인 방송 없음 — 15초 후 다시 확인'));
  yt.on('broadcast', (b) => console.log('[youtube] 방송 발견:', b.title));
  yt.on('ready', (r) => console.log(`✔ 유튜브 채팅 연결됨 (이전 메시지 ${r.skipped}개 무시)`));
  yt.on('ended', () => console.log('[youtube] 방송 종료 — 다음 방송 대기'));
  yt.on('quota', () => console.error('[youtube] 오늘 API 쿼터를 다 썼습니다 — 30분 뒤 다시 시도 (README 의 쿼터 안내 참고)'));
  yt.on('error', (e) => console.error('[youtube]', e.message));
  yt.on('donation', (d) => { console.log(`[youtube] 슈퍼챗 ${d.amountDisplay} ≈ ${d.payAmount}원`); handle('donation', d, 'youtube'); });
  yt.on('subscription', (d) => handle('subscription', d, 'youtube'));
  yt.on('chat', (d) => handle('chat', d, 'youtube'));
  yt.start().catch((e) => console.error('[youtube]', e.message));
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`포트 ${port} 를 이미 쓰고 있습니다 — 어댑터가 다른 창에서 벌써 실행 중인지 확인하세요 (그 창에서 Ctrl+C).`);
  else console.error('서버 오류:', e.message);
  process.exit(1);
});
// 이 PC 안에서만 접속 가능 (OBS 도 같은 PC 라 localhost 로 충분)
server.listen(port, '127.0.0.1', async () => {
  console.log(`chzzk-souls-chaos 실행 중 — 프로필: ${profileName}, 백엔드: ${backendName}, 설정: ${configPath}`);
  if (backendName === 'cheatengine-lua') console.log(`브릿지 큐: ${backend.file} (Cheat Engine 에 ce/chaos-bridge.lua 가 설치되어 있어야 함 — npm run install-bridge)`);
  console.log(`OBS 브라우저 소스: http://localhost:${port}/overlay`);
  console.log('가짜 후원: npm run fake -- 20000 "말레니아" 닉네임');
  executor.init().catch((e) => console.error('[init]', e.message));
  await connectChzzk().catch((e) => console.error('[chzzk]', e.message));
  await connectYouTube().catch((e) => console.error('[youtube]', e.message));
});

// Ctrl+C 로 끌 때 진행 중인 효과(슬로우·무적 등)를 되돌려 게임이 그 상태로 남지 않게 한다
process.on('SIGINT', () => {
  const n = executor.revertAll();
  if (n) console.log(`진행 중이던 효과 ${n}개 해제`);
  backend.close();
  process.exit(0);
});

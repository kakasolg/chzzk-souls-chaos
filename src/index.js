import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createBackend } from './backends/cheatengine.js';
import { EffectExecutor } from './effects/executor.js';
import { Router } from './effects/router.js';
import { ChzzkSession } from './chzzk/session.js';
import { loadTokens } from './chzzk/api.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const table = readJson(path.join(ROOT, 'src/effects/eldenring-chaosmod.json'));
const configPath = fs.existsSync(path.join(ROOT, 'config.json')) ? 'config.json' : 'config.example.json';
const config = readJson(path.join(ROOT, configPath));
const port = Number(process.env.ADAPTER_PORT || 8008);

const backend = createBackend(process.env.BACKEND || 'cheatengine');
const executor = new EffectExecutor(table, backend);
const router = new Router(config, executor.names());

// ── 오버레이 / 가짜 이벤트 주입용 로컬 서버 ──
const overlayHtml = fs.readFileSync(path.join(ROOT, 'src/overlay/index.html'));
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
    let body = '';
    req.on('data', (c) => (body += c));
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
const wss = new WebSocketServer({ server });
const broadcast = (msg) => {
  const s = JSON.stringify(msg);
  for (const c of wss.clients) if (c.readyState === 1) c.send(s);
};
executor.on('start', (e) => {
  console.log(`▶ ${e.label} (${e.name}) ← ${e.by ?? '?'} ${e.amount ? e.amount + '원' : ''} [${e.source}]`);
  broadcast({ type: 'start', ...e });
});
executor.on('end', (e) => broadcast({ type: 'end', ...e }));
executor.on('unknown', (n) => console.warn('알 수 없는 효과:', n));

// ── 이벤트 → 효과 ──
function handle(kind, data, source) {
  let pick, by, amount;
  if (kind === 'donation') {
    pick = router.forDonation(data);
    by = data.donatorNickname;
    amount = Number(data.payAmount);
    console.log(`💰 ${by} ${amount}원 "${data.donationText ?? ''}" → ${pick?.effect ?? '(무시)'}`);
  } else if (kind === 'subscription') {
    pick = router.forSubscription(data);
    by = data.subscriberNickname;
    console.log(`⭐ ${by} 구독 ${data.month}개월 → ${pick?.effect ?? '(무시)'}`);
  } else if (kind === 'chat') {
    pick = router.forChat(data);
    by = data.profile?.nickname;
    if (pick) console.log(`💬 ${by}: ${data.content} → ${pick.effect}`);
  }
  if (pick) executor.trigger(pick.effect, { by, amount, source, reason: pick.reason });
}

// ── 치지직 연결 (tokens.json 있을 때만) ──
async function connectChzzk() {
  const client = { id: process.env.CHZZK_CLIENT_ID, secret: process.env.CHZZK_CLIENT_SECRET };
  if (!client.id || !client.secret || !loadTokens()) {
    console.log('ℹ 치지직 미연결 (CHZZK_CLIENT_ID/SECRET 또는 tokens.json 없음). 가짜 이벤트 모드로만 동작합니다.');
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

server.listen(port, async () => {
  console.log(`chzzk-souls-chaos 실행 중 — 백엔드: ${process.env.BACKEND || 'cheatengine'}, 설정: ${configPath}`);
  console.log(`OBS 브라우저 소스: http://localhost:${port}/overlay`);
  console.log('가짜 후원: npm run fake -- 5000 "말레니아" 닉네임');
  executor.init();
  await connectChzzk().catch((e) => console.error('[chzzk]', e.message));
});

process.on('SIGINT', () => {
  backend.close();
  process.exit(0);
});

// 스트리머 1회 로그인: 브라우저를 열어 치지직 계정 연동 → code 를 받아 토큰 교환 → tokens.json 저장
import 'dotenv/config';
import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { INTERLOCK, api, saveTokens } from './api.js';

const client = { id: process.env.CHZZK_CLIENT_ID, secret: process.env.CHZZK_CLIENT_SECRET };
const redirectUri = process.env.CHZZK_REDIRECT_URI || 'http://localhost:8080/callback';
if (!client.id || !client.secret) {
  console.error('.env 에 CHZZK_CLIENT_ID / CHZZK_CLIENT_SECRET 을 넣어주세요.');
  process.exit(1);
}

const { port, pathname } = new URL(redirectUri);
const state = crypto.randomBytes(12).toString('hex');
const authUrl = `${INTERLOCK}?clientId=${encodeURIComponent(client.id)}&redirectUri=${encodeURIComponent(redirectUri)}&state=${state}`;

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, redirectUri);
  if (u.pathname !== pathname) return res.writeHead(404).end();
  try {
    if (u.searchParams.get('state') !== state) throw new Error('state 불일치');
    const code = u.searchParams.get('code');
    const tok = await api.exchangeCode(client, code, state);
    saveTokens({ ...tok, expiresAt: Date.now() + Number(tok.expiresIn) * 1000 });
    const me = await api.me(tok.accessToken);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2>연동 완료: ${me.channelName ?? me.channelId}</h2><p>이 창을 닫고 터미널로 돌아가세요.</p>`);
    console.log(`✔ 로그인 완료: ${me.channelName} (${me.channelId}) — tokens.json 저장됨`);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('실패: ' + e.message);
    console.error('✖', e.message);
  } finally {
    setTimeout(() => process.exit(0), 300);
  }
});

server.listen(Number(port) || 80, () => {
  console.log('브라우저에서 치지직 로그인 창이 열립니다. 안 열리면 아래 주소를 직접 여세요:\n' + authUrl);
  exec(`start "" "${authUrl}"`);
});

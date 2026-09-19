// 유튜브(구글) 계정 1회 로그인 → youtube-tokens.json 저장
import 'dotenv/config';
import { YouTubeSource } from '../src/sources/youtube.js';

const client = { id: process.env.YOUTUBE_CLIENT_ID, secret: process.env.YOUTUBE_CLIENT_SECRET };
if (!client.id || !client.secret) {
  console.error('.env 에 YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET 을 넣어주세요.');
  process.exit(1);
}
await YouTubeSource.login(client, process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:8081/callback');
console.log('✔ 유튜브 연동 완료 — youtube-tokens.json 저장됨');
process.exit(0);

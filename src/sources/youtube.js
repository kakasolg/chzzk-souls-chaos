import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';

const TOKEN_FILE = new URL('../../youtube-tokens.json', import.meta.url);
const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const API = 'https://www.googleapis.com/youtube/v3';

/**
 * 유튜브 라이브 채팅 소스 (YouTube Data API v3, 공식).
 * 스트리머 계정으로 OAuth 1회 → 진행 중인 내 방송의 liveChatId 를 찾아 liveChatMessages 를 폴링한다.
 * 이벤트는 치지직 세션과 같은 모양으로 내보내서 라우터가 구분 없이 처리한다:
 *   donation     { donatorNickname, payAmount(원화 환산 문자열), donationText, currency, amountDisplay }
 *   subscription { subscriberNickname, tierName, month }
 *   chat         { profile: { nickname }, userRoleCode, content }
 *
 * ── 알려진 한계 ──────────────────────────────
 *  · 폴링 방식이라 지연이 3~5초 있다 (pollingIntervalMillis 를 따른다).
 *  · liveChatMessages.list 는 호출당 쿼터 5 — 기본 일일 쿼터 10,000 이면 5초 간격 기준 약 2.7시간치.
 *    긴 방송은 Google Cloud 에서 쿼터 증설을 신청하거나 YOUTUBE_POLL_MS 를 늘려야 한다.
 *  · 슈퍼챗 통화가 KRW 가 아니면 config.youtube.rates 로 원화 환산해 티어에 맞춘다.
 */
export class YouTubeSource extends EventEmitter {
  constructor(client, { rates = { KRW: 1, USD: 1350, JPY: 9, EUR: 1450 }, minPollMs = 5000 } = {}) {
    super();
    this.client = client;
    this.rates = rates;
    this.minPollMs = minPollMs;
    this.stopped = false;
    this.liveChatId = null;
    this.pageToken = null;
  }

  static loadTokens() {
    try {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    } catch {
      return null;
    }
  }

  static saveTokens(t) {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2));
  }

  /** 스트리머 1회 로그인 (Desktop app OAuth). 완료되면 youtube-tokens.json 저장. */
  static async login(client, redirectUri = 'http://localhost:8081/callback') {
    const state = crypto.randomBytes(12).toString('hex');
    const { port, pathname } = new URL(redirectUri);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    Object.entries({
      client_id: client.id, redirect_uri: redirectUri, response_type: 'code', scope: SCOPE,
      access_type: 'offline', prompt: 'consent', state,
    }).forEach(([k, v]) => url.searchParams.set(k, v));

    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        const u = new URL(req.url, redirectUri);
        if (u.pathname !== pathname) return res.writeHead(404).end();
        try {
          if (u.searchParams.get('state') !== state) throw new Error('state 불일치');
          const tok = await tokenRequest(client, { grant_type: 'authorization_code', code: u.searchParams.get('code'), redirect_uri: redirectUri });
          YouTubeSource.saveTokens({ ...tok, expiresAt: Date.now() + tok.expires_in * 1000 });
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h2>유튜브 연동 완료</h2><p>이 창을 닫고 터미널로 돌아가세요.</p>');
          resolve(tok);
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('실패: ' + e.message);
          reject(e);
        } finally {
          setTimeout(() => server.close(), 300);
        }
      });
      server.listen(Number(port) || 80, '127.0.0.1', () => {
        console.log('브라우저에서 구글 로그인 창이 열립니다. 안 열리면 아래 주소를 직접 여세요:\n' + url);
        exec(`start "" "${url}"`);
      });
    });
  }

  async #accessToken() {
    const t = YouTubeSource.loadTokens();
    if (!t?.refresh_token) throw new Error('youtube-tokens.json 없음 — 먼저 `npm run auth:youtube` 를 실행하세요.');
    if (Date.now() < (t.expiresAt ?? 0) - 60 * 1000) return t.access_token;
    const r = await tokenRequest(this.client, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
    const next = { ...t, ...r, expiresAt: Date.now() + r.expires_in * 1000 };
    YouTubeSource.saveTokens(next);
    return next.access_token;
  }

  async #get(path, params) {
    const url = new URL(API + path);
    Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
    const res = await fetch(url, { headers: { Authorization: `Bearer ${await this.#accessToken()}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(`${path} -> ${res.status} ${json.error?.message ?? ''}`.trim());
      e.status = res.status;
      e.reason = json.error?.errors?.[0]?.reason;
      throw e;
    }
    return json;
  }

  /** 진행 중인 내 방송 중 가장 최근에 시작한 것의 liveChatId. 없으면 null (방송 시작 전). */
  async #findLiveChat({ quiet = false } = {}) {
    const r = await this.#get('/liveBroadcasts', { part: 'snippet', broadcastStatus: 'active', broadcastType: 'all', maxResults: 5 });
    const started = (i) => Date.parse(i.snippet?.actualStartTime ?? i.snippet?.publishedAt ?? 0) || 0;
    const b = (r.items ?? []).filter((i) => i.snippet?.liveChatId).sort((a, c) => started(c) - started(a))[0];
    if (!b) return null;
    if (!quiet) this.emit('broadcast', { title: b.snippet.title, id: b.id });
    return b.snippet.liveChatId;
  }

  async start() {
    this.stopped = false;
    // 방송이 켜질 때까지 대기
    while (!this.stopped && !this.liveChatId) {
      try {
        this.liveChatId = await this.#findLiveChat();
      } catch (e) {
        this.emit('error', e);
      }
      if (!this.liveChatId) {
        this.emit('waiting');
        await sleep(15000);
      }
    }
    if (this.stopped) return;

    let first = true; // 첫 페이지는 이미 지나간 채팅이라 무시
    let lastCheck = Date.now();
    while (!this.stopped) {
      let wait = this.minPollMs;
      // OBS 에서 방송을 끄고 새 방송을 만들면 옛 방송이 "진행 중"으로 남아 빈 채팅만 계속 돌아올 수 있다.
      // 1분마다 더 최근에 시작한 방송이 있는지 보고 있으면 그쪽으로 옮긴다 (쿼터 1/회).
      if (Date.now() - lastCheck > 60000) {
        lastCheck = Date.now();
        try {
          const newest = await this.#findLiveChat({ quiet: true });
          if (newest && newest !== this.liveChatId) {
            this.emit('ended');
            this.liveChatId = null;
            this.pageToken = null;
            return this.start();
          }
        } catch (e) {
          this.emit('error', e);
        }
      }
      try {
        const r = await this.#get('/liveChat/messages', { liveChatId: this.liveChatId, part: 'snippet,authorDetails', pageToken: this.pageToken, maxResults: 200 });
        this.pageToken = r.nextPageToken;
        wait = Math.max(this.minPollMs, r.pollingIntervalMillis ?? 0);
        if (r.offlineAt) {
          this.emit('ended');
          this.liveChatId = null;
          this.pageToken = null;
          return this.start();
        }
        if (first) {
          first = false;
          this.emit('ready', { liveChatId: this.liveChatId, skipped: r.items?.length ?? 0 });
        } else {
          for (const item of r.items ?? []) this.#dispatch(item);
        }
      } catch (e) {
        this.emit('error', e);
        wait = 10000;
        if (e.reason === 'quotaExceeded' || e.reason === 'dailyLimitExceeded') {
          // 오늘 쿼터를 다 씀 — 계속 두드려도 소용없어 30분 쉬었다가 다시 시도
          this.emit('quota');
          wait = 30 * 60 * 1000;
        } else if (e.status === 403 || e.status === 404) {
          // 방송 종료/채팅 없음 (liveChatEnded, liveChatNotFound 등) → 다음 방송을 기다린다
          this.emit('ended');
          this.liveChatId = null;
          this.pageToken = null;
          return this.start();
        }
      }
      await sleep(wait);
    }
  }

  stop() {
    this.stopped = true;
  }

  #dispatch(item) {
    const s = item.snippet;
    const a = item.authorDetails ?? {};
    const nickname = a.displayName ?? '?';
    const role = a.isChatOwner ? 'streamer' : a.isChatModerator ? 'streaming_channel_manager' : 'common_user';
    switch (s.type) {
      case 'superChatEvent':
      case 'superStickerEvent': {
        const d = s.superChatDetails ?? s.superStickerDetails;
        let rate = this.rates[d.currency];
        if (rate == null) {
          // 환율표에 없는 통화도 슈퍼챗을 버리지 않는다 — 대략 달러로 보고, config.youtube.rates 에 추가하라고 알린다
          this.emit('error', new Error(`환율 없음: ${d.currency} — config.json 의 youtube.rates 에 추가하세요 (지금은 USD 로 계산)`));
          rate = this.rates.USD ?? 1350;
        }
        const amount = (Number(d.amountMicros) / 1e6) * rate;
        this.emit('donation', {
          donatorNickname: nickname, payAmount: String(Math.round(amount)),
          donationText: d.userComment ?? '', currency: d.currency, amountDisplay: d.amountDisplayString,
        });
        break;
      }
      case 'newSponsorEvent':
      case 'memberMilestoneChatEvent':
        this.emit('subscription', {
          subscriberNickname: nickname,
          tierName: s.newSponsorDetails?.memberLevelName ?? s.memberMilestoneChatDetails?.memberLevelName ?? '',
          month: s.memberMilestoneChatDetails?.memberMonth ?? 1,
        });
        break;
      case 'textMessageEvent':
        this.emit('chat', { profile: { nickname }, userRoleCode: role, content: s.displayMessage ?? '' });
        break;
      default:
        break;
    }
  }
}

async function tokenRequest(client, params) {
  const body = new URLSearchParams({ client_id: client.id, client_secret: client.secret, ...params });
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`token -> ${res.status} ${json.error_description ?? json.error ?? ''}`.trim());
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

import fs from 'node:fs';

export const OPENAPI = 'https://openapi.chzzk.naver.com';
export const INTERLOCK = 'https://chzzk.naver.com/account-interlock';
export const TOKEN_FILE = new URL('../../tokens.json', import.meta.url);

export function loadTokens() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch {
    return null;
  }
}

export function saveTokens(t) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2));
}

async function call(method, path, { token, client, body, query } = {}) {
  const url = new URL(OPENAPI + path);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (client) {
    headers['Client-Id'] = client.id;
    headers['Client-Secret'] = client.secret;
  }
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json.code && json.code !== 200)) {
    throw new Error(`${method} ${path} -> ${res.status} ${json.message ?? ''}`.trim());
  }
  return json.content ?? json;
}

export const api = {
  exchangeCode: (client, code, state) =>
    call('POST', '/auth/v1/token', {
      body: { grantType: 'authorization_code', clientId: client.id, clientSecret: client.secret, code, state },
    }),
  refresh: (client, refreshToken) =>
    call('POST', '/auth/v1/token', {
      body: { grantType: 'refresh_token', clientId: client.id, clientSecret: client.secret, refreshToken },
    }),
  me: (token) => call('GET', '/open/v1/users/me', { token }),
  sessionUrlUser: (token) => call('GET', '/open/v1/sessions/auth', { token }),
  sessionUrlClient: (client) => call('GET', '/open/v1/sessions/auth/client', { client }),
  subscribe: (token, type, sessionKey) =>
    call('POST', `/open/v1/sessions/events/subscribe/${type}`, { token, query: { sessionKey } }),
};

/** 만료 1시간 전이면 refresh. tokens.json 갱신까지 처리. */
export async function ensureAccessToken(client) {
  const t = loadTokens();
  if (!t?.refreshToken) throw new Error('tokens.json 없음 — 먼저 `npm run auth` 로 스트리머 로그인을 해주세요.');
  if (Date.now() < (t.expiresAt ?? 0) - 60 * 60 * 1000) return t.accessToken;
  const r = await api.refresh(client, t.refreshToken);
  const next = { ...r, expiresAt: Date.now() + Number(r.expiresIn) * 1000 };
  saveTokens(next);
  return next.accessToken;
}

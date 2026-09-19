import { EventEmitter } from 'node:events';
import io from 'socket.io-client';
import { api, ensureAccessToken } from './api.js';

const SOCKET_OPTS = {
  reconnection: false,
  'force new connection': true,
  'connect timeout': 3000,
  transports: ['websocket'],
};

const parse = (d) => (typeof d === 'string' ? JSON.parse(d) : d);

/**
 * 치지직 Open API 세션(유저). 스트리머 Access Token 으로 세션을 만들고
 * CHAT / DONATION / SUBSCRIPTION 이벤트를 구독해 EventEmitter 로 흘려보낸다.
 * 연결이 끊기면 백오프 후 재연결한다 (세션 URL은 매번 새로 발급).
 */
export class ChzzkSession extends EventEmitter {
  constructor(client, { events = ['donation', 'chat', 'subscription'] } = {}) {
    super();
    this.client = client;
    this.events = events;
    this.socket = null;
    this.stopped = false;
    this.backoff = 2000;
  }

  async start() {
    this.stopped = false;
    await this.#connect();
  }

  stop() {
    this.stopped = true;
    this.socket?.close();
  }

  async #connect() {
    const token = await ensureAccessToken(this.client);
    const { url } = await api.sessionUrlUser(token);
    const socket = io.connect(url, SOCKET_OPTS);
    this.socket = socket;

    socket.on('connect', () => this.emit('socket', 'connected'));
    socket.on('SYSTEM', async (raw) => {
      const msg = parse(raw);
      if (msg.type === 'connected') {
        const key = msg.data.sessionKey;
        try {
          for (const ev of this.events) await api.subscribe(token, ev, key);
          this.backoff = 2000;
          this.emit('ready', key);
        } catch (e) {
          this.emit('error', e);
        }
      } else if (msg.type === 'subscribed' || msg.type === 'unsubscribed' || msg.type === 'revoked') {
        this.emit('system', msg);
      }
    });
    socket.on('CHAT', (raw) => this.emit('chat', parse(raw)));
    socket.on('DONATION', (raw) => this.emit('donation', parse(raw)));
    socket.on('SUBSCRIPTION', (raw) => this.emit('subscription', parse(raw)));
    socket.on('disconnect', () => this.#reconnect('disconnect'));
    socket.on('connect_error', (e) => this.#reconnect('connect_error: ' + e));
    socket.on('error', (e) => this.emit('error', new Error(String(e))));
  }

  #reconnect(reason) {
    this.emit('socket', reason);
    if (this.stopped) return;
    const wait = this.backoff;
    this.backoff = Math.min(this.backoff * 2, 60000);
    setTimeout(() => this.#connect().catch((e) => { this.emit('error', e); this.#reconnect('retry'); }), wait);
  }
}

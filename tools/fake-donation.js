// 사용: node tools/fake-donation.js <금액> ["메시지"] [닉네임]
//       node tools/fake-donation.js sub [닉네임]                (구독 이벤트)
//       node tools/fake-donation.js chat "!fx Kill Player"       (스트리머 채팅 명령)
import 'dotenv/config';

const port = process.env.ADAPTER_PORT || 8008;
const [a, b, c] = process.argv.slice(2);

let kind, body;
if (a === 'sub') {
  kind = 'subscription';
  body = { channelId: 'test', subscriberChannelId: 'test', subscriberNickname: b ?? '테스터', tierNo: 1, tierName: '티어1', month: 1 };
} else if (a === 'chat') {
  kind = 'chat';
  body = {
    channelId: 'test', senderChannelId: 'test',
    profile: { nickname: c ?? '스트리머', userRoleCode: 'streamer' },
    content: b ?? '!fx Heal HP', messageTime: Date.now(),
  };
} else {
  kind = 'donation';
  body = {
    donationType: 'CHAT', channelId: 'test', donatorChannelId: 'test',
    donatorNickname: c ?? '테스터', payAmount: String(a ?? 1000), donationText: b ?? '', emojis: {},
  };
}

const res = await fetch(`http://localhost:${port}/fake/${kind}`, { method: 'POST', body: JSON.stringify(body) });
console.log(res.status, await res.text());

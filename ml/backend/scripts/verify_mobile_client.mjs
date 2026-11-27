import assert from 'node:assert/strict';
import { InferenceClient } from '../deployment/mobile/inference.ts';

const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  return options?.method === 'POST'
    ? new Response(JSON.stringify({ event_id: 'abcdef1234' }))
    : new Response('event: heartbeat\ndata: null\n\nevent: complete\ndata: [{"status":"recommended","outfits":[]}]\n\n');
};
const client = new InferenceClient('https://demo-user-space.hf.space', async () => ({ access_token: 'private-user-token' }));
assert.equal((await client.chat('Recommend an outfit', 3)).status, 'recommended');
assert.equal(calls.length, 2);
assert.equal(JSON.parse(calls[0].options.body).data[1], 'private-user-token');
assert.equal(JSON.parse(JSON.parse(calls[0].options.body).data[0]).count, 3);
assert.ok(calls.every(call => !call.url.includes('private-user-token')));
await client.chat('Recommend one outfit');
assert.equal(JSON.parse(JSON.parse(calls.at(-2).options.body).data[0]).count, null);
await client.bodyAnalysis('user/uploads/person.png', 170);
assert.ok(calls.at(-2).url.endsWith('/body_analysis'));
assert.deepEqual(JSON.parse(calls.at(-2).options.body).data, ['user/uploads/person.png',170,'private-user-token']);
assert.throws(() => client.bodyAnalysis('person.png', NaN), /known height/);
assert.throws(() => client.confirmBodyAnalysis({confirmed:false}), /confirm/);
assert.throws(() => new InferenceClient('http://insecure.example', async () => ({ access_token: 'x' })));
globalThis.fetch = async (_, options) => options?.method === 'POST'
  ? new Response(JSON.stringify({ event_id: 'abcdef1234' }))
  : new Response('event: error\ndata: null\n\n');
await assert.rejects(client.photo('user/person.png', ['top', 'bottom']), /Inference failed/);
console.log('PASS: mobile HTTP/SSE contract, count, token placement and inference errors');

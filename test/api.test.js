import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sampleCard } from './fixtures/card.js';

process.env.CASH_DATA_DIR = await mkdtemp(path.join(tmpdir(), 'csc-'));
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-123';
delete process.env.BLOB_READ_WRITE_TOKEN;

const { saveCard } = await import('../lib/store.js');
const { sign, verify } = await import('../lib/session.js');
const { memberCookie, currentMember } = await import('../lib/members.js');
const { ukDate } = await import('../lib/dates.js');
const { default: card } = await import('../api/card.js');

const today = ukDate();
const yesterday = ukDate(new Date(Date.now() - 86400_000));

function call(handler, { url = '/', method = 'GET', cookie } = {}) {
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      statusCode: 200,
      setHeader: (k, v) => (headers[k.toLowerCase()] = v),
      end: (body) => resolve({ status: res.statusCode, headers, body: body ? JSON.parse(body) : null }),
    };
    handler({ url, method, headers: cookie ? { cookie } : {} }, res);
  });
}

const memberCookieHeader = () => memberCookie('cus_test', Date.now() / 1000 + 86400).split(';')[0];

before(async () => {
  await saveCard(sampleCard(yesterday));
  await saveCard(sampleCard(today));
});

test('session tokens reject tampering and expiry', () => {
  const t = sign({ cid: 'cus_1', exp: Date.now() / 1000 + 60 });
  assert.equal(verify(t).cid, 'cus_1');
  assert.equal(verify(t.slice(0, -2) + 'xx'), null);
  const old = sign({ cid: 'cus_1', exp: 1 });
  assert.equal(verify(old), null);
  assert.equal(verify(old, { allowExpired: true }).cid, 'cus_1');
});

test('only member cookies count as membership, not login-link tokens', async () => {
  assert.equal((await currentMember({ headers: { cookie: memberCookieHeader() } })).cid, 'cus_test');
  const login = sign({ cid: 'cus_test', p: 'login', exp: Date.now() / 1000 + 600 });
  assert.equal(await currentMember({ headers: { cookie: `csc_member=${login}` } }), null);
});

test("non-members see today's bets locked, with no selections in the response", async () => {
  const r = await call(card, { url: `/api/card?date=${today}` });
  assert.equal(r.status, 200);
  assert.equal(r.body.locked, true);
  assert.equal(r.body.member, false);
  assert.equal(r.body.card.bets.length, 2);
  assert.equal(r.body.card.bets[0].legs_count, 2);
  const raw = JSON.stringify(r.body);
  assert.doesNotMatch(raw, /SECRET|Sample summary|value case/i);
});

test('members see today in full', async () => {
  const r = await call(card, { url: `/api/card?date=${today}`, cookie: memberCookieHeader() });
  assert.equal(r.body.locked, false);
  assert.equal(r.body.member, true);
  assert.match(JSON.stringify(r.body), /SECRET Saka/);
});

test('earlier days are public, so the record can be checked', async () => {
  const r = await call(card, { url: `/api/card?date=${yesterday}` });
  assert.equal(r.body.locked, false);
  assert.match(JSON.stringify(r.body), /SECRET/);
  assert.deepEqual(r.body.dates, [today, yesterday]);
});

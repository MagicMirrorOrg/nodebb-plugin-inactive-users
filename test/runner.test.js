'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Runner = require('../lib/runner');
const { defaults } = require('../lib/inactivity');

function fixture(overrides = {}) {
  const writes = [];
  const rows = [];
  const settings = { dailyDigestFreq: 'week', reply: 'notificationemail', chat: 'email', mention: 'notification' };
  const record = { uid: 1, username: 'admin', lastonline: 1, joindate: 1, email: 'admin@example.org', 'email:confirmed': 1 };
  const services = {
    meta: { settings: { get: async () => ({ ...defaults, ...overrides }) } },
    batch: { processSortedSet: async (key, process) => process([1]) },
    user: {
      getUsersFields: async () => [record], getUserFields: async () => record,
      getSettings: async () => ({ ...settings }),
      setSetting: async (...args) => writes.push(['setting', ...args]),
      updateDigestSetting: async (...args) => writes.push(['digestIndex', ...args]),
      setUserField: async (...args) => writes.push(['field', ...args]),
      email: { expireValidation: async (...args) => writes.push(['expire', ...args]), isValidationPending: async () => false },
    },
    groups: {
      isMember: async (uid, group) => group === 'verified-users',
      leave: async (...args) => writes.push(['leave', ...args]),
      join: async (...args) => writes.push(['join', ...args]),
    },
    notifications: { getAllNotificationTypes: async () => ['reply', 'chat', 'mention'] },
    db: {
      getObject: async () => null,
      setObject: async (key, data) => rows.push(['meta', key, { ...data }]),
      sortedSetAdd: async (key, score, value) => rows.push(['row', JSON.parse(value)]),
      deleteAll: async () => {},
    },
  };
  return { runner: new Runner(services), services, writes, rows, record, settings };
}

test('dryrun reports all actions without account writes or emails', async () => {
  const f = fixture();
  await f.runner.run('run-1', 'manual');
  assert.deepEqual(f.writes, []);
  const row = f.rows.find(row => row[0] === 'row')[1];
  assert.deepEqual(row.actions, ['disableDigests', 'disableEmailNotifications', 'revokeConfirmation']);
  assert.equal(row.status, 'proposed');
});

test('apply changes mail preferences, groups and confirmation links without deleting accounts', async () => {
  const f = fixture({ dryrun: false });
  await f.runner.run('run-1', 'manual');
  assert.deepEqual(f.writes, [
    ['setting', 1, 'dailyDigestFreq', 'off'], ['digestIndex', 1, 'off'],
    ['setting', 1, 'reply', 'notification'], ['setting', 1, 'chat', 'none'],
    ['expire', 1], ['field', 1, 'email:confirmed', 0],
    ['leave', 'verified-users', 1], ['join', 'unverified-users', 1],
  ]);
});

for (const action of ['disableDigests', 'disableEmailNotifications', 'revokeConfirmation']) {
  test(`only ${action} runs when the other actions are disabled`, async () => {
    const f = fixture({ dryrun: false, disableDigests: false, disableEmailNotifications: false, revokeConfirmation: false, [action]: true });
    await f.runner.run('run-1', 'manual');
    assert.deepEqual(f.rows.find(row => row[0] === 'row')[1].actions, [action]);
  });
}

test('users who return after selection are skipped before account changes', async () => {
  const f = fixture({ dryrun: false });
  f.services.user.getUserFields = async () => ({ ...f.record, lastonline: Date.now() });
  await f.runner.run('run-1', 'manual');
  assert.deepEqual(f.writes, []);
  assert.equal(f.rows.filter(row => row[0] === 'row').length, 0);
});

test('already-clean users cause no writes and no report rows', async () => {
  const f = fixture({ dryrun: false });
  f.settings.dailyDigestFreq = 'off';
  f.settings.reply = 'notification';
  f.settings.chat = 'none';
  f.record['email:confirmed'] = 0;
  f.services.groups.isMember = async (uid, group) => group === 'unverified-users';
  await f.runner.run('run-1', 'manual');
  assert.deepEqual(f.writes, []);
  assert.equal(f.rows.filter(row => row[0] === 'row').length, 0);
});

test('a partial failure is reported and the runner continues with other accounts', async () => {
  const f = fixture({ dryrun: false });
  const second = { ...f.record, uid: 2, username: 'moderator' };
  f.services.batch.processSortedSet = async (key, process) => process([1, 2]);
  f.services.user.getUsersFields = async () => [f.record, second];
  f.services.user.getUserFields = async uid => uid === 1 ? f.record : second;
  f.services.user.setSetting = async (...args) => {
    if (args[0] === 1) { throw Error('Database unavailable'); }
    f.writes.push(['setting', ...args]);
  };
  const report = await f.runner.run('run-1', 'manual');
  const row = f.rows.find(row => row[0] === 'row')[1];
  assert.equal(row.status, 'failed');
  assert.equal(row.error, 'Database unavailable');
  assert.equal(report.affected, 2);
  assert.equal(report.failed, 1);
  assert.equal(report.status, 'completed-with-errors');
  assert.ok(f.writes.some(write => write[0] === 'setting' && write[1] === 2));
  assert.equal(f.runner.running, false);
});

test('overlapping runs are rejected before they overwrite the report', async () => {
  const f = fixture();
  f.runner.running = true;
  await assert.rejects(f.runner.run('run-2', 'manual'), /already in progress/);
  assert.deepEqual(f.rows, []);
});

test('activity between planning and apply stops account changes', async () => {
  const f = fixture({ dryrun: false });
  let reads = 0;
  f.services.user.getUserFields = async () => ++reads === 1 ? f.record : { ...f.record, lastonline: Date.now() };
  const report = await f.runner.run('run-1', 'manual');
  assert.deepEqual(f.writes, []);
  assert.equal(report.disableDigests, 0);
  assert.equal(f.rows.find(row => row[0] === 'row')[1].status, 'skipped');
});

test('a scan failure persists the error and releases the run guard', async () => {
  const f = fixture();
  f.services.batch.processSortedSet = async () => { throw Error('Scan failed'); };
  await assert.rejects(f.runner.run('run-1', 'nightly'), /Scan failed/);
  const report = f.rows.at(-1)[2];
  assert.equal(report.status, 'failed');
  assert.equal(report.error, 'Scan failed');
  assert.ok(report.finished > 0);
  assert.equal(f.runner.running, false);
});

test('invalid saved settings release the guard without account changes', async () => {
  const f = fixture({ months: 0 });
  await assert.rejects(f.runner.run('run-1', 'manual'), /period/);
  assert.equal(f.runner.running, false);
  assert.deepEqual(f.writes, []);
});

test('a report write failure still releases the run guard', async () => {
  const f = fixture();
  f.services.db.setObject = async () => { throw Error('Report write failed'); };
  await assert.rejects(f.runner.run('run-1', 'manual'), /Report write failed/);
  assert.equal(f.runner.running, false);
});


test('a second apply run leaves an already-processed account unchanged', async () => {
  const f = fixture({ dryrun: false });
  let verified = true;
  let unverified = false;
  f.services.user.setSetting = async (uid, key, value) => { f.settings[key] = value; f.writes.push(['setting', uid, key, value]); };
  f.services.user.setUserField = async (uid, key, value) => { f.record[key] = value; f.writes.push(['field', uid, key, value]); };
  f.services.groups.isMember = async (uid, group) => group === 'verified-users' ? verified : unverified;
  f.services.groups.leave = async () => { verified = false; };
  f.services.groups.join = async () => { unverified = true; };
  await f.runner.run('run-1', 'manual');
  f.writes.length = 0;
  const report = await f.runner.run('run-2', 'manual');
  assert.deepEqual(f.writes, []);
  assert.equal(report.affected, 0);
});


test('a returning user retains completed actions in a partial report', async () => {
  const f = fixture({ dryrun: false });
  let reads = 0;
  f.services.user.getUserFields = async () => ++reads <= 2 ? f.record : { ...f.record, lastonline: Date.now() };
  const report = await f.runner.run('run-1', 'manual');
  const row = f.rows.find(row => row[0] === 'row')[1];
  assert.equal(row.status, 'partially-applied');
  assert.deepEqual(row.completed, ['disableDigests']);
  assert.equal(report.disableDigests, 1);
  assert.equal(report.disableEmailNotifications, 0);
  assert.equal(report.revokeConfirmation, 0);
});

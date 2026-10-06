'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../plugin.json');
const plugin = require('../library');

function mockNodeBB(t, services) {
  const original = require.main.require;
  t.mock.method(require.main, 'require', function (id) {
    return Object.hasOwn(services, id) ? services[id] : original.call(this, id);
  });
}

test('manifest initializes through the NodeBB app-load hook', () => {
  assert.equal(manifest.id, 'nodebb-plugin-inactive-users');
  assert.deepEqual(manifest.hooks, [{ hook: 'static:app.load', method: 'init' }]);
});

test('initialization supplies defaults without overwriting stored settings', async (t) => {
  let provided;
  mockNodeBB(t, {
    './src/meta': { settings: { setOnEmpty: async (name, values) => { provided = { name, values }; } } },
  });
  await plugin.init();
  assert.equal(provided.name, 'inactive-users');
  assert.deepEqual(provided.values, {
    months: 6, dryrun: 'on', nightly: 'off', disableDigests: 'on',
    disableEmailNotifications: 'on', revokeConfirmation: 'on',
  });
});

test('selection uses saved settings and batched NodeBB user reads without writes', async (t) => {
  const now = new Date('2026-10-06T12:00:00Z');
  const cutoff = Date.parse('2026-04-06T12:00:00Z');
  const users = {
    1: { uid: 1, username: 'admin', lastonline: cutoff - 1, joindate: 1 },
    2: { uid: 2, username: 'active', lastonline: cutoff + 1, joindate: 1 },
    3: { uid: 3, username: 'never-active', lastonline: 0, joindate: cutoff - 1 },
    4: { uid: 4, username: 'boundary', lastonline: cutoff, joindate: 1 },
  };
  const reads = [];
  mockNodeBB(t, {
    './src/meta': { settings: { get: async name => {
      assert.equal(name, 'inactive-users');
      return { months: '6', dryrun: 'on' };
    } } },
    './src/batch': { processSortedSet: async (key, process, options) => {
      assert.equal(key, 'users:joindate');
      assert.equal(options.batch, 100);
      await process([1, 2]);
      await process([3, 4, 5]);
    } },
    './src/user': { getUsersFields: async (uids, fields) => {
      reads.push({ uids, fields });
      return uids.map(uid => users[uid]);
    } },
  });
  const result = await plugin.getCandidates(now);
  assert.deepEqual(result.users.map(user => user.uid), [1, 3]);
  assert.equal(result.cutoff, cutoff);
  assert.equal(result.settings.dryrun, true);
  assert.equal(reads.length, 2);
  assert.deepEqual(reads[0].fields, ['uid', 'username', 'lastonline', 'joindate']);
});

test('selection honors a changed inactivity period', async (t) => {
  const now = new Date('2026-10-06T12:00:00Z');
  mockNodeBB(t, {
    './src/meta': { settings: { get: async () => ({ months: '12' }) } },
    './src/batch': { processSortedSet: async (key, process) => {
      await process([1]);
    } },
    './src/user': { getUsersFields: async () => [{ uid: 1, lastonline: Date.parse('2026-01-01T00:00:00Z') }] },
  });
  const result = await plugin.getCandidates(now);
  assert.equal(result.cutoff, Date.parse('2025-10-06T12:00:00Z'));
  assert.deepEqual(result.users, []);
});

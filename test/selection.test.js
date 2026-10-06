'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const scanUsers = require('../lib/selection');
const { normalizeSettings } = require('../lib/inactivity');

test('selection uses saved settings and batched NodeBB user reads without writes', async () => {
  const now = new Date('2026-10-06T12:00:00Z');
  const cutoff = Date.parse('2026-04-06T12:00:00Z');
  const users = {
    1: { uid: 1, username: 'admin', lastonline: cutoff - 1, joindate: 1 },
    2: { uid: 2, username: 'active', lastonline: cutoff + 1, joindate: 1 },
    3: { uid: 3, username: 'never-active', lastonline: 0, joindate: cutoff - 1 },
    4: { uid: 4, username: 'boundary', lastonline: cutoff, joindate: 1 },
  };
  const reads = [];
  const imports = {
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
  };
  const services = { meta: imports['./src/meta'], batch: imports['./src/batch'], user: imports['./src/user'] };
  const settings = normalizeSettings(await services.meta.settings.get('inactive-users'));
  const usersFound = [];
  const cutoffResult = await scanUsers(services, settings, now, async records => usersFound.push(...records));
  const result = { settings, cutoff: cutoffResult, users: usersFound };
  assert.deepEqual(result.users.map(user => user.uid), [1, 3]);
  assert.equal(result.cutoff, cutoff);
  assert.equal(result.settings.dryrun, true);
  assert.equal(reads.length, 2);
  assert.deepEqual(reads[0].fields, ['uid', 'username', 'lastonline', 'joindate']);
});

test('selection honors a changed inactivity period', async () => {
  const now = new Date('2026-10-06T12:00:00Z');
  const imports = {
    './src/meta': { settings: { get: async () => ({ months: '12' }) } },
    './src/batch': { processSortedSet: async (key, process) => {
      await process([1]);
    } },
    './src/user': { getUsersFields: async () => [{ uid: 1, lastonline: Date.parse('2026-01-01T00:00:00Z') }] },
  };
  const services = { meta: imports['./src/meta'], batch: imports['./src/batch'], user: imports['./src/user'] };
  const settings = normalizeSettings(await services.meta.settings.get('inactive-users'));
  const usersFound = [];
  const cutoffResult = await scanUsers(services, settings, now, async records => usersFound.push(...records));
  const result = { settings, cutoff: cutoffResult, users: usersFound };
  assert.equal(result.cutoff, Date.parse('2025-10-06T12:00:00Z'));
  assert.deepEqual(result.users, []);
});


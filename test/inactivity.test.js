'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { defaults, normalizeSettings, cutoffDate, isInactive } = require('../lib/inactivity');

test('defaults enable dryrun and all actions but disable the schedule', () => {
  assert.deepEqual(defaults, {
    months: 6, dryrun: true, nightly: false,
    disableDigests: true, disableEmailNotifications: true, revokeConfirmation: true,
  });
});

test('settings handle NodeBB checkbox strings and reject invalid periods', () => {
  assert.equal(normalizeSettings({ nightly: 'off', dryrun: 'on' }).nightly, false);
  assert.equal(normalizeSettings({ dryrun: 'off' }).dryrun, false);
  for (const months of [0, -1, 1.5, 'six']) {
    assert.throws(() => normalizeSettings({ months }), /positive integer/);
  }
});

test('calendar cutoff clamps the day at the end of the target month', () => {
  assert.equal(cutoffDate(new Date('2026-08-31T12:30:00Z'), 6).toISOString(), '2026-02-28T12:30:00.000Z');
  assert.equal(cutoffDate(new Date('2024-08-31T12:30:00Z'), 6).toISOString(), '2024-02-29T12:30:00.000Z');
});

test('lastonline wins over registration and equality stays active', () => {
  const cutoff = Date.parse('2026-04-06T12:00:00Z');
  assert.equal(isInactive({ lastonline: cutoff, joindate: 1 }, cutoff), false);
  assert.equal(isInactive({ lastonline: cutoff - 1, joindate: cutoff + 1 }, cutoff), true);
  assert.equal(isInactive({ lastonline: cutoff + 1, joindate: 1 }, cutoff), false);
});

test('never-active accounts use registration without excluding staff', () => {
  const cutoff = Date.parse('2026-04-06T12:00:00Z');
  for (const role of ['administrator', 'moderator', 'user']) {
    assert.equal(isInactive({ lastonline: 0, joindate: cutoff - 1, role }, cutoff), true);
  }
  assert.equal(isInactive({ lastonline: 0, joindate: cutoff + 1 }, cutoff), false);
  assert.equal(isInactive({}, cutoff), false);
});

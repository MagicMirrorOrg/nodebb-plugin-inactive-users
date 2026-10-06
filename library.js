'use strict';

const { defaults, normalizeSettings, cutoffDate, isInactive } = require('./lib/inactivity');

const plugin = module.exports;

plugin.init = async function () {
  const meta = require.main.require('./src/meta');
  const settings = Object.fromEntries(Object.entries(defaults).map(([key, value]) => [
    key, typeof value === 'boolean' ? (value ? 'on' : 'off') : value,
  ]));
  await meta.settings.setOnEmpty('inactive-users', settings);
};

plugin.getCandidates = async function (now = new Date()) {
  const meta = require.main.require('./src/meta');
  const batch = require.main.require('./src/batch');
  const user = require.main.require('./src/user');
  const settings = normalizeSettings(await meta.settings.get('inactive-users'));
  const cutoff = cutoffDate(now, settings.months).getTime();
  const users = [];

  await batch.processSortedSet('users:joindate', async (uids) => {
    const records = await user.getUsersFields(uids, ['uid', 'username', 'lastonline', 'joindate']);
    users.push(...records.filter(record => record && isInactive(record, cutoff)));
  }, { batch: 100 });

  return { settings, cutoff, users };
};

'use strict';

const { cutoffDate, isInactive } = require('./inactivity');

module.exports = async function scanUsers({ batch, user }, settings, now, process) {
  const cutoff = cutoffDate(now, settings.months).getTime();
  await batch.processSortedSet('users:joindate', async (uids) => {
    const records = await user.getUsersFields(uids, ['uid', 'username', 'lastonline', 'joindate']);
    await process(records.filter(record => record && isInactive(record, cutoff)), uids.length, cutoff);
  }, { batch: 100 });
  return cutoff;
};

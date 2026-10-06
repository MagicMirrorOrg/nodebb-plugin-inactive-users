'use strict';

const { normalizeSettings, isInactive, cutoffDate } = require('./inactivity');
const scanUsers = require('./selection');

const reportKey = 'inactive-users:report';
const rowsKey = `${reportKey}:rows`;

module.exports = class Runner {
  constructor(services) {
    this.services = services;
    this.running = false;
  }

  async run(id, source) {
    if (this.running) {
      throw new Error('An inactive-user run is already in progress.');
    }
    this.running = true;
    const { meta, db, user, notifications, groups } = this.services;
    let report;
    try {
      const settings = normalizeSettings(await meta.settings.get('inactive-users'));
      const now = new Date();
      const cutoff = cutoffDate(now, settings.months).getTime();
      const types = await notifications.getAllNotificationTypes();
      report = {
        id, source, dryrun: settings.dryrun ? 1 : 0, settings: JSON.stringify(settings),
        status: 'running', started: now.getTime(), finished: 0, scanned: 0, affected: 0, failed: 0,
        disableDigests: 0, disableEmailNotifications: 0, revokeConfirmation: 0, cutoff,
      };
      await db.deleteAll([reportKey, rowsKey]);
      await db.setObject(reportKey, report);
      await scanUsers(this.services, settings, now, async (records, count) => {
        for (const record of records) {
          const row = { uid: record.uid, username: record.username, lastActivity: Number(record.lastonline) || Number(record.joindate), actions: [], completed: [], status: settings.dryrun ? 'proposed' : 'applied', error: '' };
          try {
            const current = await user.getUserFields(record.uid, ['uid', 'lastonline', 'joindate', 'email', 'email:confirmed']);
            if (!current || !isInactive(current, cutoff)) {
              continue;
            }
            row.lastActivity = Number(current.lastonline) || Number(current.joindate);
            const preferences = await user.getSettings(record.uid);
            const emailTypes = types.filter(type => ['email', 'notificationemail'].includes(preferences[type]));
            if (settings.disableDigests && preferences.dailyDigestFreq !== 'off') {
              row.actions.push('disableDigests');
            }
            if (settings.disableEmailNotifications && emailTypes.length) {
              row.actions.push('disableEmailNotifications');
            }
            if (settings.revokeConfirmation && current.email) {
              const [verified, unverified, pending] = await Promise.all([
                groups.isMember(record.uid, 'verified-users'),
                groups.isMember(record.uid, 'unverified-users'),
                user.email.isValidationPending(record.uid),
              ]);
              if (Number(current['email:confirmed']) === 1 || verified || !unverified || pending) {
                row.actions.push('revokeConfirmation');
              }
            }
            if (!row.actions.length) {
              continue;
            }
            if (!settings.dryrun) {
              for (const action of row.actions) {
                const latest = await user.getUserFields(record.uid, ['lastonline', 'joindate']);
                if (!latest || !isInactive(latest, cutoff)) {
                  row.status = row.completed.length ? 'partially-applied' : 'skipped';
                  row.error = 'The user became active before the remaining actions.';
                  break;
                }
                if (action === 'disableDigests') {
                  await user.setSetting(record.uid, 'dailyDigestFreq', 'off');
                  await user.updateDigestSetting(record.uid, 'off');
                } else if (action === 'disableEmailNotifications') {
                  for (const type of emailTypes) {
                    await user.setSetting(record.uid, type, preferences[type] === 'notificationemail' ? 'notification' : 'none');
                  }
                } else {
                  await user.email.expireValidation(record.uid);
                  await user.setUserField(record.uid, 'email:confirmed', 0);
                  await groups.leave('verified-users', record.uid);
                  await groups.join('unverified-users', record.uid);
                }
                row.completed.push(action);
              }
            }
          } catch (error) {
            row.status = 'failed';
            row.error = error.message;
            report.failed += 1;
          }
          for (const action of settings.dryrun && row.status !== 'failed' ? row.actions : row.completed) {
            report[action] += 1;
          }
          await db.sortedSetAdd(rowsKey, report.affected, JSON.stringify(row));
          report.affected += 1;
        }
        report.scanned += count;
        await db.setObject(reportKey, report);
      });
      report.status = report.failed ? 'completed-with-errors' : 'completed';
    } catch (error) {
      if (report) {
        report.status = 'failed';
        report.error = error.message;
      }
      throw error;
    } finally {
      try {
        if (report) {
          report.finished = Date.now();
          await db.setObject(reportKey, report);
        }
      } finally {
        this.running = false;
      }
    }
    return report;
  }
};

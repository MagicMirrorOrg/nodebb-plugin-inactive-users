'use strict';

const defaults = Object.freeze({
  months: 6,
  dryrun: true,
  nightly: false,
  disableDigests: true,
  disableEmailNotifications: true,
  revokeConfirmation: true,
});

function normalizeSettings(settings = {}) {
  const result = { ...defaults, months: Number(settings.months ?? defaults.months) };
  if (!Number.isSafeInteger(result.months) || result.months < 1) {
    throw new Error('The inactivity period must be a positive integer in months.');
  }
  for (const key of Object.keys(defaults).filter(key => key !== 'months')) {
    if (settings[key] !== undefined) {
      result[key] = settings[key] === true || settings[key] === 'on';
    }
  }
  return result;
}

function cutoffDate(now, months) {
  const cutoff = new Date(now);
  const day = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, lastDay));
  return cutoff;
}

function isInactive(user, cutoff) {
  const activity = Number(user.lastonline) > 0 ? Number(user.lastonline) : Number(user.joindate);
  return Number.isFinite(activity) && activity > 0 && activity < Number(cutoff);
}

module.exports = { defaults, normalizeSettings, cutoffDate, isInactive };

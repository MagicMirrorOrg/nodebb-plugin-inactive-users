'use strict';

const { randomUUID } = require('node:crypto');
const { normalizeSettings } = require('./inactivity');

module.exports = class Coordinator {
  constructor(services) {
    this.services = services;
    this.pending = new Map();
  }

  async init() {
    const { pubsub, nconf, db, logger } = this.services;
    pubsub.on('inactive-users:response', response => {
      const request = this.pending.get(response.id);
      if (!request) {
        return;
      }
      this.pending.delete(response.id);
      clearTimeout(request.timer);
      if (response.error) {
        request.reject(new Error(response.error));
      } else {
        request.resolve({ id: response.id });
      }
    });
    if (!nconf.get('isPrimary')) {
      return;
    }
    const previous = await db.getObject('inactive-users:report');
    if (previous && previous.status === 'running') {
      await db.setObjectField('inactive-users:report', 'status', 'interrupted');
    }
    pubsub.on('inactive-users:request', request => {
      if (this.services.runner.running) {
        pubsub.publish('inactive-users:response', { id: request.id, error: 'An inactive-user run is already in progress.' });
        return;
      }
      this.services.runner.run(request.id, 'manual').catch(error => logger.error(`[inactive-users] ${error.stack}`));
      pubsub.publish('inactive-users:response', { id: request.id });
    });
    pubsub.on('action:settings.set.inactive-users', () => {
      this.refreshSchedule().catch(error => logger.error(`[inactive-users] ${error.stack}`));
    });
    await this.refreshSchedule();
  }

  async refreshSchedule() {
    const { cron, meta, nconf, runner, db } = this.services;
    const settings = normalizeSettings(await meta.settings.get('inactive-users'));
    if (settings.nightly && nconf.get('runJobs')) {
      await cron.restartJob({
        name: 'inactive-users.nightly', cronTime: '0 3 * * *',
        onTick: async () => runner.run(randomUUID(), 'nightly'),
      });
    } else {
      cron.removeJob('inactive-users.nightly');
      await db.setObjectField('cronJob:inactive-users.nightly', 'active', 0);
    }
  }

  requestRun() {
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('The primary NodeBB process did not respond. Check the forum logs before starting another run.'));
      }, 10000);
      this.pending.set(id, { resolve, reject, timer });
      this.services.pubsub.publish('inactive-users:request', { id });
    });
  }
};

'use strict';

const { defaults } = require('./lib/inactivity');
const Runner = require('./lib/runner');
const Coordinator = require('./lib/coordinator');
const registerAdmin = require('./lib/admin');

const plugin = module.exports;

plugin.init = async function ({ router }) {
  const services = {
    meta: nodebb.require('./src/meta'),
    batch: nodebb.require('./src/batch'),
    user: nodebb.require('./src/user'),
    db: nodebb.require('./src/database'),
    groups: nodebb.require('./src/groups'),
    notifications: nodebb.require('./src/notifications'),
    pubsub: nodebb.require('./src/pubsub'),
    cron: nodebb.require('./src/cron'),
    nconf: nodebb.require('nconf'),
    logger: nodebb.require('winston'),
    socketAdmin: nodebb.require('./src/socket.io/admin'),
    socketPlugins: nodebb.require('./src/socket.io/plugins'),
    routeHelpers: nodebb.require('./src/routes/helpers'),
    controllerHelpers: nodebb.require('./src/controllers/helpers'),
  };
  await services.meta.settings.setOnEmpty('inactive-users', Object.fromEntries(Object.entries(defaults).map(([key, value]) => [
    key, typeof value === 'boolean' ? (value ? 'on' : 'off') : value,
  ])));
  services.runner = new Runner(services);
  const coordinator = new Coordinator(services);
  await coordinator.init();
  registerAdmin(services, coordinator, router);
};

plugin.addAdminNavigation = async function (header) {
  header.plugins.push({ route: '/plugins/inactive-users', icon: 'fa-user-clock', name: 'Inactive Users' });
  return header;
};

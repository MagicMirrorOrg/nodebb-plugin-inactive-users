'use strict';

const { defaults, normalizeSettings } = require('./inactivity');

module.exports = function registerAdmin(services, coordinator, router) {
  const { meta, db, user, socketAdmin, socketPlugins, routeHelpers, controllerHelpers } = services;
  const handlers = {};

  handlers.state = async (socket, data = {}) => {
    await socketAdmin.before(socket, 'plugins.inactiveUsers.state');
    const page = Number(data?.page ?? 1);
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new Error('The report page must be a positive integer.');
    }
    const settings = normalizeSettings(await meta.settings.get('inactive-users'));
    const report = await db.getObject('inactive-users:report');
    const total = Number(report?.affected || 0);
    const pages = Math.max(1, Math.ceil(total / 50));
    const currentPage = Math.min(page, pages);
    const rows = report ? await db.getSortedSetRange('inactive-users:report:rows', (currentPage - 1) * 50, currentPage * 50 - 1) : [];
    return { settings, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, report, rows: rows.map(row => JSON.parse(row)), page: currentPage, pages };
  };

  handlers.save = async (socket, data) => {
    await socketAdmin.before(socket, 'plugins.inactiveUsers.save');
    const stored = await meta.settings.get('inactive-users');
    const values = Object.fromEntries(Object.keys(defaults).filter(key => data && Object.hasOwn(data, key)).map(key => [key, data[key]]));
    const settings = normalizeSettings({ ...stored, ...values });
    await meta.settings.set('inactive-users', Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, typeof value === 'boolean' ? (value ? 'on' : 'off') : value])), true);
    return settings;
  };

  handlers.run = async socket => {
    await socketAdmin.before(socket, 'plugins.inactiveUsers.run');
    return await coordinator.requestRun();
  };

  socketPlugins.inactiveUsers = handlers;
  routeHelpers.setupAdminPageRoute(router, '/admin/plugins/inactive-users', async (req, res) => {
    if (!await user.isAdministrator(req.uid)) {
      return await controllerHelpers.notAllowed(req, res);
    }
    res.render('admin/plugins/inactive-users', { title: 'Inactive Users' });
  });
};

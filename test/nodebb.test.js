'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../plugin.json');
const plugin = require('../library');

function mockNodeBB(t, services) {
  const previous = globalThis.nodebb;
  globalThis.nodebb = { require: id => {
    if (!Object.hasOwn(services, id)) { throw new Error(`Unexpected NodeBB import: ${id}`); }
    return services[id];
  } };
  t.after(() => { globalThis.nodebb = previous; });
}

test('manifest initializes through the NodeBB app-load hook', () => {
  assert.equal(manifest.id, 'nodebb-plugin-inactive-users');
  assert.ok(manifest.hooks.some(hook => hook.hook === 'static:app.load' && hook.method === 'init'));
});

test('initialization supplies defaults without overwriting stored settings', async (t) => {
  let provided;
  mockNodeBB(t, {
    './src/meta': { settings: { setOnEmpty: async (name, values) => { provided = { name, values }; } } },
    './src/batch': {}, './src/user': {}, './src/database': {}, './src/groups': {},
    './src/notifications': {}, './src/pubsub': { on: () => {} }, './src/cron': {},
    nconf: { get: () => false }, winston: {}, './src/socket.io/admin': {},
    './src/controllers/helpers': {}, './src/socket.io/plugins': {}, './src/routes/helpers': { setupAdminPageRoute: () => {} },
  });
  await plugin.init({ router: {} });
  assert.equal(provided.name, 'inactive-users');
  assert.deepEqual(provided.values, {
    months: 6, dryrun: 'on', nightly: 'off', disableDigests: 'on',
    disableEmailNotifications: 'on', revokeConfirmation: 'on',
  });
});

test('the administration menu links to the plugin settings', async () => {
  const header = { plugins: [] };
  assert.equal(await plugin.addAdminNavigation(header), header);
  assert.deepEqual(header.plugins[0], { route: '/plugins/inactive-users', icon: 'fa-user-clock', name: 'Inactive Users' });
});

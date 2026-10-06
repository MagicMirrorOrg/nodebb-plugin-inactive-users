'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const registerAdmin = require('../lib/admin');

function setup() {
  const stored = {};
  const sockets = {};
  let pageController;
  const services = {
    meta: { settings: {
      get: async () => ({ ...stored }),
      set: async (name, settings, quiet) => {
        assert.equal(name, 'inactive-users'); assert.equal(quiet, true); Object.assign(stored, settings);
      },
    } },
    db: { getObject: async () => null, getSortedSetRange: async () => [] },
    user: { isAdministrator: async uid => uid === 1 },
    socketAdmin: { before: async socket => {
      if (socket.uid !== 1) { throw Error('No privileges'); }
    } },
    socketPlugins: sockets,
    controllerHelpers: { notAllowed: async (req, res) => res.status(403) },
    routeHelpers: { setupAdminPageRoute: (router, path, controller) => { pageController = controller; } },
  };
  const coordinator = { requestRun: async () => ({ id: 'run-1' }) };
  registerAdmin(services, coordinator, {});
  return { handlers: sockets.inactiveUsers, services, stored, page: (...args) => pageController(...args) };
}

test('all administration handlers reject nonadministrators', async () => {
  const f = setup();
  for (const method of ['state', 'save', 'run']) {
    await assert.rejects(f.handlers[method]({ uid: 2 }, {}), /No privileges/);
  }
  let status;
  await f.page({ uid: 2 }, { status: value => { status = value; } });
  assert.equal(status, 403);
});

test('administrator page renders the native template', async () => {
  const f = setup();
  let rendered;
  await f.page({ uid: 1 }, { render: (...args) => { rendered = args; } });
  assert.equal(rendered[0], 'admin/plugins/inactive-users');
});

test('saving validates the period and ignores unknown fields', async () => {
  const f = setup();
  await assert.rejects(f.handlers.save({ uid: 1 }, { months: '' }), /positive integer/);
  assert.deepEqual(f.stored, {});
  const result = await f.handlers.save({ uid: 1 }, { months: 12, dryrun: false, unknown: 'value' });
  assert.equal(result.months, 12);
  assert.equal(f.stored.dryrun, 'off');
  assert.equal(f.stored.disableDigests, 'on');
  assert.equal(f.stored.unknown, undefined);
});

test('state returns the timezone, defaults and an empty first report', async () => {
  const f = setup();
  const state = await f.handlers.state({ uid: 1 });
  assert.equal(state.settings.dryrun, true);
  assert.equal(typeof state.timezone, 'string');
  assert.deepEqual(state.rows, []);
  assert.equal(state.page, 1);
  assert.equal((await f.handlers.state({ uid: 1 }, null)).page, 1);
  for (const page of [0, -1, 1.5, 'bad']) {
    await assert.rejects(f.handlers.state({ uid: 1 }, { page }), /positive integer/);
  }
});

test('state pages report rows and clamps pages after a smaller run', async () => {
  const f = setup();
  f.services.db.getObject = async () => ({ id: 'run-1', affected: '51' });
  f.services.db.getSortedSetRange = async (key, start, stop) => {
    assert.equal(start, 50); assert.equal(stop, 99);
    return [JSON.stringify({ uid: 51, status: 'proposed' })];
  };
  const state = await f.handlers.state({ uid: 1 }, { page: 100 });
  assert.equal(state.page, 2);
  assert.equal(state.pages, 2);
  assert.equal(state.rows[0].uid, 51);
});

test('manual run uses the primary process coordinator', async () => {
  const f = setup();
  assert.deepEqual(await f.handlers.run({ uid: 1 }), { id: 'run-1' });
});

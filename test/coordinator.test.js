'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const Coordinator = require('../lib/coordinator');

function environment(bus, primary, runner, nightly = false) {
  const calls = [];
  return {
    calls,
    pubsub: { on: bus.on.bind(bus), publish: bus.emit.bind(bus) },
    nconf: { get: key => key === 'isPrimary' ? primary : key === 'runJobs' ? primary : undefined },
    cron: { restartJob: async options => calls.push(options), removeJob: name => calls.push(name) },
    meta: { settings: { get: async () => ({ nightly }) } },
    db: { getObject: async () => null, setObjectField: async () => {} },
    logger: { error: () => {} },
    runner,
  };
}

test('requests from another worker execute on the primary only', async () => {
  const bus = new EventEmitter();
  const primaryCalls = [];
  const primary = new Coordinator(environment(bus, true, { running: false, run: async (...args) => primaryCalls.push(args) }));
  const worker = new Coordinator(environment(bus, false, { run: () => { throw Error('Worker must not run'); } }));
  await primary.init();
  await worker.init();
  const response = await worker.requestRun();
  assert.equal(typeof response.id, 'string');
  assert.equal(primaryCalls.length, 1);
  assert.equal(primaryCalls[0][1], 'manual');
});

test('overlapping requests return an explicit error', async () => {
  const bus = new EventEmitter();
  const coordinator = new Coordinator(environment(bus, true, { running: true }));
  await coordinator.init();
  await assert.rejects(coordinator.requestRun(), /already in progress/);
});

test('nightly execution is disabled by default and starts at 03:00 when enabled', async () => {
  const bus = new EventEmitter();
  const e = environment(bus, true, { running: false, run: async () => {} });
  const coordinator = new Coordinator(e);
  await coordinator.init();
  assert.equal(e.calls[0], 'inactive-users.nightly');
  e.meta.settings.get = async () => ({ nightly: 'on' });
  await coordinator.refreshSchedule();
  assert.equal(e.calls[1].cronTime, '0 3 * * *');
  assert.equal(e.calls[1].runOnAllNodes, undefined);
});

test('nonprimary workers do not register a schedule', async () => {
  const bus = new EventEmitter();
  const e = environment(bus, false, {} , true);
  await new Coordinator(e).init();
  assert.deepEqual(e.calls, []);
});

test('a process restart marks the previous unfinished report interrupted', async () => {
  const e = environment(new EventEmitter(), true, {});
  e.db.getObject = async () => ({ status: 'running' });
  const writes = [];
  e.db.setObjectField = async (...args) => writes.push(args);
  await new Coordinator(e).init();
  assert.deepEqual(writes[0], ['inactive-users:report', 'status', 'interrupted']);
});

test('scheduled runs use the same runner and a unique run id', async () => {
  const calls = [];
  const e = environment(new EventEmitter(), true, { run: async (...args) => calls.push(args) }, true);
  await new Coordinator(e).init();
  await e.calls[0].onTick();
  assert.equal(calls[0][1], 'nightly');
  assert.equal(typeof calls[0][0], 'string');
});

test('settings events refresh the schedule and log failures', async () => {
  const bus = new EventEmitter();
  const e = environment(bus, true, {});
  const errors = [];
  e.logger.error = message => errors.push(message);
  const coordinator = new Coordinator(e);
  await coordinator.init();
  bus.emit('action:settings.set.inactive-users');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(e.calls.length, 2);
  e.meta.settings.get = async () => { throw Error('Settings unavailable'); };
  bus.emit('action:settings.set.inactive-users');
  await new Promise(resolve => setImmediate(resolve));
  assert.match(errors[0], /Settings unavailable/);
});

test('manual run failures appear in the NodeBB logs', async () => {
  const e = environment(new EventEmitter(), true, { running: false, run: async () => { throw Error('Run failed'); } });
  const errors = [];
  e.logger.error = message => errors.push(message);
  const coordinator = new Coordinator(e);
  await coordinator.init();
  await coordinator.requestRun();
  assert.match(errors[0], /Run failed/);
});

test('requests time out if no primary process responds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const coordinator = new Coordinator(environment(new EventEmitter(), false, {}));
  await coordinator.init();
  const request = coordinator.requestRun();
  const rejection = assert.rejects(request, /did not respond/);
  t.mock.timers.tick(10000);
  await rejection;
  assert.equal(coordinator.pending.size, 0);
});

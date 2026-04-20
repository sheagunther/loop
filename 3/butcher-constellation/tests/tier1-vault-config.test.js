// ╔══════════════════════════════════════════════════════════════════════╗
// ║  Tier 1 Tests — vault:config                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const { init } = require('../constellation.js');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// ═════════════════════════════════════════════════════════════════
// Setup: init with db adapter, start the constellation
// ═════════════════════════════════════════════════════════════════

const records = new Map();
const dbAdapter = {
  read(id)        { return records.get(id) || null; },
  write(id, data) { records.set(id, data); return data; },
  query(filter)   { return Array.from(records.values()); },
  delete(id)      { return records.delete(id); }
};

const c = init({
  db: { 'vault:config': dbAdapter },
  gateway: {
    'working:orderIntake': { validateSubmission: () => ({ valid: true, errors: [] }) },
    'working:paymentWebhook': { verifySignature: () => ({ valid: true }) }
  }
});

// Start — instantiates vault:config with capabilities
c.start();

// Get the vault:config instance for seeding
const vaultConfig = c.registry.get('vault:config');


// ═════════════════════════════════════════════════════════════════
// TEST 1: Seed config data
// ═════════════════════════════════════════════════════════════════
section('T1-1: Seed config');

vaultConfig.seed({
  pricing: {
    baseRate: 165,
    weightThresholdLbs: 160,
    overagePerLb: 1,
    depositAmount: 75,
    animalTypeOverrides: {}
  },
  services: {
    porkFatPerLb: 3,
    sausagePerLb: 3.75,
    sausageMinimumLbs: 5,
    rushProcessing: 35
  },
  storage: {
    feePerWeek: 50,
    gracePeriodDays: 7,
    noShowDeadlineDays: 30
  },
  notifications: {
    readyForPickupTemplate: 'Your order is ready for pickup, {{customerName}}!',
    thankYouTemplate: 'Thank you {{customerName}}!'
  },
  campaigns: []
});

assert(vaultConfig.getVersion() === 1, 'version is 1 after seed');
assert(vaultConfig.getConfig().pricing.baseRate === 165, 'config data accessible');


// ═════════════════════════════════════════════════════════════════
// TEST 2: FETCH_CONFIG — full config via VAULT bus request
// ═════════════════════════════════════════════════════════════════
section('T1-2: FETCH_CONFIG (full)');

const fetchPkt = c.createPacket('FETCH_CONFIG', {}, { source: 'compute:pricing' });
const fetchResult = c.buses.VAULT.request('compute:pricing', fetchPkt);

assert(fetchResult.config !== null, 'FETCH_CONFIG returns config');
assert(fetchResult.config.pricing.baseRate === 165, 'pricing.baseRate correct');
assert(fetchResult.config.storage.feePerWeek === 50, 'storage.feePerWeek correct');
assert(fetchResult.version === 1, 'version returned');


// ═════════════════════════════════════════════════════════════════
// TEST 3: FETCH_CONFIG — filtered by configKeys
// ═════════════════════════════════════════════════════════════════
section('T1-3: FETCH_CONFIG (filtered)');

const filteredPkt = c.createPacket('FETCH_CONFIG', {
  configKeys: ['pricing', 'storage']
}, { source: 'compute:dailyScan' });
const filteredResult = c.buses.VAULT.request('compute:dailyScan', filteredPkt);

assert(filteredResult.config.pricing !== undefined, 'pricing section returned');
assert(filteredResult.config.storage !== undefined, 'storage section returned');
assert(filteredResult.config.notifications === undefined, 'notifications NOT returned');
assert(filteredResult.config.services === undefined, 'services NOT returned');


// ═════════════════════════════════════════════════════════════════
// TEST 4: FETCH_CONFIG from different sources (routing reuse)
// ═════════════════════════════════════════════════════════════════
section('T1-4: FETCH_CONFIG routing reuse');

// workflow:notifications (§4 #55)
const wfPkt = c.createPacket('FETCH_CONFIG', {}, { source: 'workflow:notifications' });
const wfResult = c.buses.VAULT.request('workflow:notifications', wfPkt);
assert(wfResult.config.pricing.baseRate === 165, 'workflow:notifications can fetch config');

// compute:reports (§5 #84)
const rpPkt = c.createPacket('FETCH_CONFIG', {}, { source: 'compute:reports' });
const rpResult = c.buses.VAULT.request('compute:reports', rpPkt);
assert(rpResult.config !== null, 'compute:reports can fetch config');

// presentation:dashboard (§6 #89)
const dbPkt = c.createPacket('FETCH_CONFIG', {}, { source: 'presentation:dashboard' });
const dbResult = c.buses.VAULT.request('presentation:dashboard', dbPkt);
assert(dbResult.config !== null, 'presentation:dashboard can fetch config');


// ═════════════════════════════════════════════════════════════════
// TEST 5: WRITE_CONFIG_UPDATE — success path
// ═════════════════════════════════════════════════════════════════
section('T1-5: WRITE_CONFIG_UPDATE (success)');

let configUpdatedReceived = null;
c.buses.DATA.subscribe('presentation:dashboard', (pkt) => {
  if (pkt.packetType === 'CONFIG_UPDATED') {
    configUpdatedReceived = pkt;
  }
});

const writePkt = c.createPacket('WRITE_CONFIG_UPDATE', {
  configKey: 'pricing',
  updatePath: 'baseRate',
  value: 175
}, { source: 'compute:dailyScan' });

c.buses.VAULT.emit('compute:dailyScan', writePkt);

assert(configUpdatedReceived !== null, 'CONFIG_UPDATED emitted on DATA');
assert(configUpdatedReceived.payload.configKey === 'pricing', 'configKey in confirmation');
assert(configUpdatedReceived.payload.updatePath === 'baseRate', 'updatePath in confirmation');
assert(configUpdatedReceived.payload.previousValue === 165, 'previousValue captured');
assert(configUpdatedReceived.payload.newValue === 175, 'newValue confirmed');
assert(vaultConfig.getVersion() === 2, 'version incremented');

// Verify the config was actually updated
const verifyPkt = c.createPacket('FETCH_CONFIG', {}, { source: 'compute:pricing' });
const verifyResult = c.buses.VAULT.request('compute:pricing', verifyPkt);
assert(verifyResult.config.pricing.baseRate === 175, 'config actually updated in storage');


// ═════════════════════════════════════════════════════════════════
// TEST 6: WRITE_CONFIG_UPDATE — persisted to db
// ═════════════════════════════════════════════════════════════════
section('T1-6: Persistence');

const dbStored = records.get('config');
assert(dbStored !== null, 'config persisted to db adapter');
assert(dbStored.data.pricing.baseRate === 175, 'db has updated value');
assert(dbStored.version === 2, 'db has updated version');


// ═════════════════════════════════════════════════════════════════
// TEST 7: WRITE_CONFIG_UPDATE — bad input emits failure
// ═════════════════════════════════════════════════════════════════
section('T1-7: WRITE_CONFIG_UPDATE (failure)');

let configFailedReceived = null;
// Need to subscribe compute:dailyScan to DATA to receive failures
c.buses.DATA.subscribe('compute:dailyScan', (pkt) => {
  if (pkt.packetType === 'CONFIG_UPDATE_FAILED') {
    configFailedReceived = pkt;
  }
});

const badPkt = c.createPacket('WRITE_CONFIG_UPDATE', {
  configKey: null,
  updatePath: null,
  value: 999
}, { source: 'compute:dailyScan' });

c.buses.VAULT.emit('compute:dailyScan', badPkt);

assert(configFailedReceived !== null, 'CONFIG_UPDATE_FAILED emitted');
assert(configFailedReceived.payload.failureReason.includes('Missing'), 'failure reason present');
assert(vaultConfig.getVersion() === 2, 'version NOT incremented on failure');


// ═════════════════════════════════════════════════════════════════
// TEST 8: WRITE_CONFIG_UPDATE from workflow:orderLifecycle (§6 #96)
// ═════════════════════════════════════════════════════════════════
section('T1-8: Config update from workflow (§6 reuse)');

configUpdatedReceived = null;

const wfWritePkt = c.createPacket('WRITE_CONFIG_UPDATE', {
  configKey: 'storage',
  updatePath: 'feePerWeek',
  value: 55
}, { source: 'workflow:orderLifecycle' });

c.buses.VAULT.emit('workflow:orderLifecycle', wfWritePkt);

assert(configUpdatedReceived !== null, 'CONFIG_UPDATED from workflow source');
assert(configUpdatedReceived.payload.previousValue === 50, 'previous storage fee captured');
assert(configUpdatedReceived.payload.newValue === 55, 'new storage fee confirmed');
assert(vaultConfig.getVersion() === 3, 'version now 3');


// ═════════════════════════════════════════════════════════════════
// TEST 9: Ledger records all vault:config traffic
// ═════════════════════════════════════════════════════════════════
section('T1-9: Ledger audit trail');

const allLedger = c.ledger.all();
const vaultEntries = allLedger.filter(e => e.bus === 'VAULT');
const dataEntries = allLedger.filter(e => e.bus === 'DATA');

assert(vaultEntries.length > 0, 'VAULT bus traffic recorded');
assert(dataEntries.length > 0, 'DATA bus traffic recorded');

const fetchEntries = c.ledger.queryByPacketType('FETCH_CONFIG');
assert(fetchEntries.length >= 4, 'all FETCH_CONFIG calls recorded');

const updateEntries = c.ledger.queryByPacketType('CONFIG_UPDATED');
assert(updateEntries.length >= 2, 'CONFIG_UPDATED confirmations recorded');


// ═════════════════════════════════════════════════════════════════
// TEST 10: Trace a complete write operation
// ═════════════════════════════════════════════════════════════════
section('T1-10: Trace write operation');

const traceId = wfWritePkt.traceId;
const trace = c.ledger.queryByTraceId(traceId);

assert(trace.length >= 2, 'trace has at least 2 entries (write + confirmation)');

const writeEntry = trace.find(e => e.packetType === 'WRITE_CONFIG_UPDATE');
const confirmEntry = trace.find(e => e.packetType === 'CONFIG_UPDATED');

assert(writeEntry !== undefined, 'WRITE_CONFIG_UPDATE in trace');
assert(confirmEntry !== undefined, 'CONFIG_UPDATED in trace');
assert(writeEntry.bus === 'VAULT', 'write went through VAULT bus');
assert(confirmEntry.bus === 'DATA', 'confirmation went through DATA bus');


// ═════════════════════════════════════════════════════════════════
// RESULTS
// ═════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}`);

if (failed > 0) {
  process.exit(1);
}

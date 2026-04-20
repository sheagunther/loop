// ╔══════════════════════════════════════════════════════════════════════╗
// ║  Tier 1 Tests — vault:customers, vault:orders, vault:snapshots     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const { init } = require('../constellation.js');

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${label}`); }
}
function section(name) { console.log(`\n── ${name} ──`); }

// Setup
const db = {};
function makeAdapter(name) {
  const store = new Map();
  return {
    read(id) { return store.get(id) || null; },
    write(id, data) { store.set(id, data); return data; },
    query() { return Array.from(store.values()); },
    delete(id) { return store.delete(id); }
  };
}

const c = init({
  db: {
    'vault:config':    makeAdapter('config'),
    'vault:customers': makeAdapter('customers'),
    'vault:orders':    makeAdapter('orders'),
    'vault:snapshots': makeAdapter('snapshots')
  },
  gateway: {
    'working:orderIntake': { validateSubmission: () => ({ valid: true, errors: [] }) },
    'working:paymentWebhook': { verifySignature: () => ({ valid: true }) }
  }
});

c.start();

// Capture DATA bus emissions
const emissions = [];
for (const loopName of ['workflow:orderLifecycle', 'workflow:notifications',
  'presentation:dashboard', 'compute:dailyScan', 'compute:reports']) {
  c.buses.DATA.subscribe(loopName, (pkt) => {
    emissions.push({ dest: loopName, type: pkt.packetType, payload: pkt.payload });
  });
}

// ═══════════════════════════════════════════════════════════════
// VAULT:CUSTOMERS
// ═══════════════════════════════════════════════════════════════

section('T1-CUST-1: Create customer');

const createCustPkt = c.createPacket('WRITE_CUSTOMER_CREATE', {
  customerId: 'cust-001', name: 'Rick Holte', phone: '+12075551234',
  email: 'rick@example.com', textOptIn: true, emailOptIn: true,
  depositWaiverStatus: false
});
c.buses.VAULT.emit('workflow:orderLifecycle', createCustPkt);

const created = emissions.find(e => e.type === 'CUSTOMER_CREATED');
assert(created !== undefined, 'CUSTOMER_CREATED emitted');
assert(created.payload.customerId === 'cust-001', 'correct customerId');

section('T1-CUST-2: Fetch customer by phone');
const fetchPkt = c.createPacket('FETCH_CUSTOMER', { lookupBy: 'phone', lookupValue: '+12075551234' });
const fetchResult = c.buses.VAULT.request('workflow:orderLifecycle', fetchPkt);
assert(fetchResult.found === true, 'customer found by phone');
assert(fetchResult.customer.name === 'Rick Holte', 'correct name');

section('T1-CUST-3: Fetch customer not found');
const noMatch = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_CUSTOMER', { lookupBy: 'phone', lookupValue: '+19999999999' }));
assert(noMatch.found === false, 'not found returns false');

section('T1-CUST-4: Create second customer + batch fetch');
c.buses.VAULT.emit('workflow:orderLifecycle',
  c.createPacket('WRITE_CUSTOMER_CREATE', {
    customerId: 'cust-002', name: 'Christine Holte', phone: '+12075555678',
    textOptIn: true, emailOptIn: false, marketingOptIn: true,
    depositWaiverStatus: false
  }));

const batchPkt = c.createPacket('FETCH_CUSTOMERS', { filter: { marketingOptIn: true } });
const batchResult = c.buses.VAULT.request('workflow:notifications', batchPkt);
assert(batchResult.customers.length === 1, 'filter returns only marketing opt-in');
assert(batchResult.customers[0].name === 'Christine Holte', 'correct filtered customer');

section('T1-CUST-5: Search by name');
const searchPkt = c.createPacket('FETCH_CUSTOMERS', { searchQuery: 'rick' });
const searchResult = c.buses.VAULT.request('presentation:dashboard', searchPkt);
assert(searchResult.customers.length === 1, 'search returns 1 match');

section('T1-CUST-6: Update customer');
emissions.length = 0;
c.buses.VAULT.emit('workflow:orderLifecycle',
  c.createPacket('WRITE_CUSTOMER_UPDATE', {
    customerId: 'cust-001',
    updates: { depositWaiverStatus: true }
  }));
const updated = emissions.find(e => e.type === 'CUSTOMER_UPDATED');
assert(updated !== undefined, 'CUSTOMER_UPDATED emitted');
assert(updated.payload.updatedFields.includes('depositWaiverStatus'), 'updated field reported');

// Verify the update persisted
const verify = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_CUSTOMER', { lookupBy: 'customerId', lookupValue: 'cust-001' }));
assert(verify.customer.depositWaiverStatus === true, 'update persisted');

section('T1-CUST-7: Duplicate create fails');
emissions.length = 0;
c.buses.VAULT.emit('workflow:orderLifecycle',
  c.createPacket('WRITE_CUSTOMER_CREATE', {
    customerId: 'cust-001', name: 'Duplicate', textOptIn: false, emailOptIn: false
  }));
const dupFail = emissions.find(e => e.type === 'CUSTOMER_CREATE_FAILED');
assert(dupFail !== undefined, 'CUSTOMER_CREATE_FAILED on duplicate');
assert(dupFail.payload.failureReason === 'DUPLICATE_CUSTOMER', 'correct failure reason');

// ═══════════════════════════════════════════════════════════════
// VAULT:ORDERS
// ═══════════════════════════════════════════════════════════════

section('T1-ORD-1: Create order');
emissions.length = 0;
c.buses.VAULT.emit('workflow:orderLifecycle',
  c.createPacket('WRITE_ORDER_CREATE', {
    orderId: 'ord-001', customerId: 'cust-001', tagNumber: 'ME-2025-1234',
    intakeSource: 'external', animalType: 'deer', tenderloinRemoved: true,
    stage: 'checked_in', rushFlag: false, depositAmount: 75,
    depositWaived: false, depositPaid: false
  }));
const orderCreated = emissions.find(e => e.type === 'ORDER_CREATED');
assert(orderCreated !== undefined, 'ORDER_CREATED emitted');
assert(orderCreated.payload.orderId === 'ord-001', 'correct orderId');
assert(orderCreated.payload.version === 1, 'version starts at 1');

section('T1-ORD-2: Fetch order');
const fetchOrd = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: 'ord-001' }));
assert(fetchOrd.found === true, 'order found');
assert(fetchOrd.order.tagNumber === 'ME-2025-1234', 'tag number correct');
assert(fetchOrd.order.version === 1, 'version 1');

section('T1-ORD-3: Update order with version check');
emissions.length = 0;
c.buses.VAULT.emit('workflow:orderLifecycle',
  c.createPacket('WRITE_ORDER_UPDATE', {
    orderId: 'ord-001', expectedVersion: 1,
    updates: { hangingWeightLbs: 145, stage: 'hanging' }
  }));
const orderUpdated = emissions.find(e => e.type === 'ORDER_UPDATED');
assert(orderUpdated !== undefined, 'ORDER_UPDATED emitted');
assert(orderUpdated.payload.version === 2, 'version incremented to 2');

section('T1-ORD-4: Version conflict');
emissions.length = 0;
c.buses.VAULT.emit('workflow:orderLifecycle',
  c.createPacket('WRITE_ORDER_UPDATE', {
    orderId: 'ord-001', expectedVersion: 1,
    updates: { stage: 'butchering' }
  }));
const conflict = emissions.find(e => e.type === 'ORDER_UPDATE_FAILED');
assert(conflict !== undefined, 'ORDER_UPDATE_FAILED on version conflict');
assert(conflict.payload.failureReason === 'VERSION_CONFLICT', 'VERSION_CONFLICT reason');

section('T1-ORD-5: Batch fetch with stage filter');
// Create a second order in different stage
c.buses.VAULT.emit('workflow:orderLifecycle',
  c.createPacket('WRITE_ORDER_CREATE', {
    orderId: 'ord-002', customerId: 'cust-002', tagNumber: 'ME-2025-5678',
    intakeSource: 'direct', animalType: 'moose', tenderloinRemoved: false,
    stage: 'pending_customer_input', rushFlag: false, depositAmount: 75,
    depositWaived: false, depositPaid: false
  }));

const stageFetch = c.buses.VAULT.request('compute:dailyScan',
  c.createPacket('FETCH_ORDERS', { stageFilter: ['hanging'] }));
assert(stageFetch.orders.length === 1, 'stage filter returns 1 match');
assert(stageFetch.orders[0].orderId === 'ord-001', 'correct order filtered');

const allFetch = c.buses.VAULT.request('compute:dailyScan',
  c.createPacket('FETCH_ORDERS', {}));
assert(allFetch.orders.length === 2, 'no filter returns all orders');

// ═══════════════════════════════════════════════════════════════
// VAULT:SNAPSHOTS
// ═══════════════════════════════════════════════════════════════

section('T1-SNAP-1: Write audit');
c.buses.VAULT.emit('workflow:orderLifecycle',
  c.createPacket('WRITE_AUDIT', {
    auditType: 'order_creation', orderId: 'ord-001',
    operatorId: 'rick', orderState: { stage: 'checked_in' }
  }));

const snapVault = c.registry.get('vault:snapshots');
assert(snapVault.count() === 1, 'one snapshot recorded');

section('T1-SNAP-2: Store snapshot');
emissions.length = 0;
c.buses.VAULT.emit('compute:reports',
  c.createPacket('STORE_SNAPSHOT', {
    snapshotType: 'daily', data: { orderCount: 2, revenue: 0 }
  }));
const stored = emissions.find(e => e.type === 'SNAPSHOT_STORED');
assert(stored !== undefined, 'SNAPSHOT_STORED emitted');
assert(stored.payload.snapshotType === 'daily', 'correct snapshot type');
assert(snapVault.count() === 2, 'two snapshots total');

section('T1-SNAP-3: Fetch snapshots with filter');
const auditFetch = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', { snapshotType: 'audit' }));
assert(auditFetch.snapshots.length === 1, 'audit filter returns 1');

const dailyFetch = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', { snapshotType: 'daily' }));
assert(dailyFetch.snapshots.length === 1, 'daily filter returns 1');

const allSnaps = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', {}));
assert(allSnaps.snapshots.length === 2, 'no filter returns all');

// ═══════════════════════════════════════════════════════════════
// CROSS-VAULT: Full trace from order create through audit
// ═══════════════════════════════════════════════════════════════

section('T1-CROSS: Full lifecycle trace');
const totalLedger = c.ledger.count();
assert(totalLedger > 20, `ledger has ${totalLedger} entries from full test`);

const routeCount = c.routing.count();
assert(routeCount > 30, `${routeCount} routing entries registered`);

assert(c.registry.instanceCount() === 15, 'all 15 built-in loops instantiated');

// ═══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}`);
if (failed > 0) process.exit(1);

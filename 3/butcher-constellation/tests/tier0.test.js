// ╔══════════════════════════════════════════════════════════════════════╗
// ║  Tier 0 Tests — Bus Infrastructure, Routing, Ledger, Capabilities  ║
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
// TEST 1: Init returns a handle with expected interface
// ═════════════════════════════════════════════════════════════════
section('T0-1: Constellation init');

const c = init({
  gateway: {
    'working:orderIntake': { validateSubmission: () => ({ valid: true, errors: [] }) },
    'working:paymentWebhook': { verifySignature: () => ({ valid: true }) }
  }
});
assert(c.routing !== undefined,       'handle has routing');
assert(c.registry !== undefined,      'handle has registry');
assert(c.ledger !== undefined,        'handle has ledger');
assert(c.buses !== undefined,         'handle has buses');
assert(c.buses.DATA !== undefined,    'handle has DATA bus');
assert(c.buses.VAULT !== undefined,   'handle has VAULT bus');
assert(c.buses.SIGNAL !== undefined,  'handle has SIGNAL bus');
assert(c.buses.SYNC !== undefined,    'handle has SYNC bus');
assert(typeof c.start === 'function', 'handle has start()');
assert(typeof c.createPacket === 'function', 'handle has createPacket()');


// ═════════════════════════════════════════════════════════════════
// TEST 2: Packet creation and header validation
// ═════════════════════════════════════════════════════════════════
section('T0-2: Packet creation');

const pkt = c.createPacket('INTAKE_RAW', { customerName: 'Test' });
assert(pkt.packetId.length === 36,           'packetId is UUID format');
assert(pkt.packetType === 'INTAKE_RAW',      'packetType set correctly');
assert(pkt.timestamp.includes('T'),          'timestamp is ISO 8601');
assert(pkt.traceId.length === 36,            'traceId is UUID format');
assert(pkt.payload.customerName === 'Test',  'payload preserved');

// Custom traceId
const pkt2 = c.createPacket('TEST', { x: 1 }, { traceId: 'custom-trace-id' });
assert(pkt2.traceId === 'custom-trace-id', 'custom traceId accepted');

// Bad inputs
let threw = false;
try { c.createPacket(null, {}); } catch (e) { threw = true; }
assert(threw, 'null packetType throws');

threw = false;
try { c.createPacket('TEST', null); } catch (e) { threw = true; }
assert(threw, 'null payload throws');


// ═════════════════════════════════════════════════════════════════
// TEST 3: Routing table — register, resolve, reject unrouted
// ═════════════════════════════════════════════════════════════════
section('T0-3: Routing table');

// INTAKE_RAW is now auto-registered by registerInputGateRoutes().
// Verify it exists from the built-in registration.

assert(c.routing.count() >= 1, 'entries registered (includes built-in routes)');
assert(c.routing.has('INTAKE_RAW', 'working:orderIntake'), 'route exists');
assert(!c.routing.has('INTAKE_RAW', 'vault:orders'), 'wrong source returns false');

const resolved = c.routing.resolve('INTAKE_RAW', 'working:orderIntake');
assert(resolved.length === 1, 'resolve returns one entry');
assert(resolved[0].destinations[0] === 'filter:orderValidation', 'correct destination');
assert(resolved[0].bus === 'DATA', 'correct bus');

// Unrouted packet throws
threw = false;
try { c.routing.resolve('NONEXISTENT', 'nobody'); } catch (e) {
  threw = true;
  assert(e.message.includes('[routing]'), 'error carries namespace');
}
assert(threw, 'unrouted packet throws');


// ═════════════════════════════════════════════════════════════════
// TEST 4: Bus emit — publish-subscribe with routing enforcement
// ═════════════════════════════════════════════════════════════════
section('T0-4: Bus emit (DATA)');

let received = null;
c.buses.DATA.subscribe('filter:orderValidation', (pkt) => {
  received = pkt;
});

const emitPkt = c.createPacket('INTAKE_RAW', { test: true }, { source: 'working:orderIntake' });
const result = c.buses.DATA.emit('working:orderIntake', emitPkt);

assert(received !== null, 'subscriber received packet');
assert(received.packetType === 'INTAKE_RAW', 'correct packet type received');
assert(result.delivered.includes('filter:orderValidation'), 'delivery confirmed');
assert(result.missing.length === 0, 'no missing destinations');

// Emit unrouted packet
threw = false;
try {
  const badPkt = c.createPacket('FAKE_PACKET', { x: 1 });
  c.buses.DATA.emit('working:orderIntake', badPkt);
} catch (e) {
  threw = true;
  assert(e.message.includes('[routing]'), 'unrouted emit error has namespace');
}
assert(threw, 'unrouted emit throws');

// Emit on wrong bus — WRITE_ORDER_CREATE is auto-registered on VAULT bus.
threw = false;
try {
  const wrongBusPkt = c.createPacket('WRITE_ORDER_CREATE', { orderId: '123' });
  c.buses.DATA.emit('workflow:orderLifecycle', wrongBusPkt);
} catch (e) {
  threw = true;
  assert(e.message.includes('routed to bus VAULT'), 'wrong bus error is specific');
}
assert(threw, 'wrong bus emit throws');


// ═════════════════════════════════════════════════════════════════
// TEST 5: VAULT bus request-response
// ═════════════════════════════════════════════════════════════════
section('T0-5: VAULT bus request-response');

c.routing.register({
  entryNumber: 5,
  packetType: 'FETCH_CUSTOMER',
  source: 'workflow:orderLifecycle',
  bus: 'VAULT',
  destinations: ['vault:customers'],
  mode: 'Pull',
  priority: 'STANDARD'
});

c.buses.VAULT.subscribe('vault:customers', (pkt) => {
  return { found: true, customer: { name: 'Rick Holte' } };
});

const fetchPkt = c.createPacket('FETCH_CUSTOMER', { lookupBy: 'phone', lookupValue: '2075551234' });
const fetchResult = c.buses.VAULT.request('workflow:orderLifecycle', fetchPkt);

assert(fetchResult.found === true, 'VAULT request returns response');
assert(fetchResult.customer.name === 'Rick Holte', 'response data correct');

// request() on non-VAULT bus throws
threw = false;
try { c.buses.DATA.request('test', {}); } catch (e) { threw = true; }
assert(threw, 'request() on DATA bus throws');


// ═════════════════════════════════════════════════════════════════
// TEST 6: Event ledger records all traffic
// ═════════════════════════════════════════════════════════════════
section('T0-6: Event ledger');

assert(c.ledger.count() > 0, 'ledger has entries after bus traffic');

// Query by traceId
const trace = c.ledger.queryByTraceId(emitPkt.traceId);
assert(trace.length >= 1, 'ledger queryable by traceId');
assert(trace[0].packetType === 'INTAKE_RAW', 'trace entry has correct type');
assert(trace[0].bus === 'DATA', 'trace entry has correct bus');

// Query by packetType
const byType = c.ledger.queryByPacketType('INTAKE_RAW');
assert(byType.length >= 1, 'ledger queryable by packetType');

// Rejected packets are also recorded
const rejected = c.ledger.queryByPacketType('FAKE_PACKET');
assert(rejected.length >= 1, 'rejected packets recorded in ledger');
assert(rejected[0].status === 'rejected:unrouted', 'rejected status correct');


// ═════════════════════════════════════════════════════════════════
// TEST 7: Capability framework — loop registration and isolation
// ═════════════════════════════════════════════════════════════════
section('T0-7: Capability framework');

// Register test loop factories (using compute loops — not auto-registered)
c.registry.registerFactory('presentation:customerIntake', (caps) => {
  assert(caps.bus !== undefined, 'presentation:customerIntake receives bus capability');
  assert(caps.services === undefined, 'presentation:customerIntake does NOT receive services');
  assert(caps.document === undefined, 'presentation:customerIntake does NOT receive document');

  // Verify bus filtering
  threw = false;
  try { caps.bus.emit('SIGNAL', c.createPacket('TEST', {})); } catch (e) { threw = true; }
  assert(threw, 'presentation:customerIntake cannot publish to SIGNAL');

  return { onPacket: () => {} };
});

assert(c.registry.factoryCount() === 16, 'sixteen factories registered (15 built-in + 1 test)');

// Start — instantiates loops with capabilities
c.start();

// Now test with a fresh instance that has db caps injected

const c2 = init({
  db: {
    'vault:orders': { read: () => 'mock-read', write: () => 'mock-write' }
  },
  gateway: {
    'working:orderIntake': { validateSubmission: () => ({ valid: true, errors: [] }) },
    'working:paymentWebhook': { verifySignature: () => ({ valid: true }) }
  }
});

c2.start();
assert(c2.registry.instanceCount() === 15, 'all 15 built-in loops instantiated on c2');


// ═════════════════════════════════════════════════════════════════
// TEST 8: Error messages carry namespace
// ═════════════════════════════════════════════════════════════════
section('T0-8: Error namespace convention');

const errors = [];
try { c.routing.resolve('X', 'Y'); } catch (e) { errors.push(e.message); }
try { c.buses.DATA.emit('nobody', c.createPacket('X', {})); } catch (e) { errors.push(e.message); }
try { c.buses.DATA.request('x', {}); } catch (e) { errors.push(e.message); }

for (const msg of errors) {
  assert(msg.startsWith('['), `error "${msg.substring(0, 40)}..." has namespace bracket`);
}


// ═════════════════════════════════════════════════════════════════
// RESULTS
// ═════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}`);

if (failed > 0) {
  process.exit(1);
}

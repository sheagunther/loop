// ╔══════════════════════════════════════════════════════════════════════╗
// ║  Tier 2 Tests — Input Gates                                        ║
// ║  working:orderIntake, filter:orderValidation, working:paymentWebhook║
// ║  FBD-5 gateway enforcement tests                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const { init } = require('../constellation.js');

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${label}`); }
}
function section(name) { console.log(`\n── ${name} ──`); }

// ═══════════════════════════════════════════════════════════════
// GATEWAY STUBS
// ═══════════════════════════════════════════════════════════════

function createIntakeGateway() {
  return {
    validateSubmission(body) {
      const errors = [];
      // Schema-level checks: tag number, weight, animal type
      if (body.hangingWeightLbs !== undefined && body.hangingWeightLbs > 2000) {
        errors.push('hangingWeightLbs exceeds maximum (2000 lbs)');
      }
      return { valid: errors.length === 0, errors: errors };
    }
  };
}

function createWebhookGateway() {
  return {
    verifySignature(body, signature) {
      // Stub: accept 'valid-sig', reject everything else
      if (signature === 'valid-sig') {
        return { valid: true };
      }
      return { valid: false, reason: 'Invalid signature' };
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════

function makeAdapter() {
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
    'vault:config':    makeAdapter(),
    'vault:customers': makeAdapter(),
    'vault:orders':    makeAdapter(),
    'vault:snapshots': makeAdapter()
  },
  gateway: {
    'working:orderIntake': createIntakeGateway(),
    'working:paymentWebhook': createWebhookGateway()
  }
});

c.start();

// Get loop handles for direct method calls
const orderIntake = c.registry.get('working:orderIntake');
const paymentWebhook = c.registry.get('working:paymentWebhook');

// Capture DATA bus emissions at destinations that don't have real loop handlers yet.
// filter:orderValidation is NOT in this list — it has a real onPacket handler.
const emissions = [];
for (const dest of ['workflow:orderLifecycle',
  'presentation:dashboard', 'compute:dailyScan', 'compute:reports']) {
  c.buses.DATA.subscribe(dest, (pkt) => {
    emissions.push({ dest: dest, type: pkt.packetType, payload: pkt.payload, traceId: pkt.traceId });
  });
}


// ═══════════════════════════════════════════════════════════════
// FBD-5: GATEWAY ENFORCEMENT
// ═══════════════════════════════════════════════════════════════

section('T2-FBD5-1: Working loop without gateway throws');

let threw = false;
try {
  const noGw = init({
    db: { 'vault:config': makeAdapter(), 'vault:customers': makeAdapter(),
          'vault:orders': makeAdapter(), 'vault:snapshots': makeAdapter() }
    // No gateway provided
  });
  noGw.start();
} catch (e) {
  threw = true;
  assert(e.message.includes('no gateway capability provided'), 'error message mentions gateway');
  assert(e.message.includes('working:'), 'error identifies working loop');
}
assert(threw, 'constellation refuses to start without gateway');

section('T2-FBD5-2: Partial gateway throws');
threw = false;
try {
  const partialGw = init({
    db: { 'vault:config': makeAdapter(), 'vault:customers': makeAdapter(),
          'vault:orders': makeAdapter(), 'vault:snapshots': makeAdapter() },
    gateway: {
      'working:orderIntake': createIntakeGateway()
      // Missing working:paymentWebhook
    }
  });
  partialGw.start();
} catch (e) {
  threw = true;
  assert(e.message.includes('paymentWebhook'), 'identifies which loop is missing gateway');
}
assert(threw, 'constellation refuses to start with incomplete gateway');


// ═══════════════════════════════════════════════════════════════
// WORKING:ORDERINTAKE — INTAKE PATH
// ═══════════════════════════════════════════════════════════════

section('T2-INTAKE-1: Valid full intake submission');
emissions.length = 0;

const validIntake = {
  customerName: 'Rick Holte', customerPhone: '+12075551234',
  customerEmail: 'rick@example.com', textOptIn: true, emailOptIn: true,
  tagNumber: 'ME-2025-1234', animalType: 'deer', tenderloinRemoved: true
};

const result1 = orderIntake.handleSubmission(validIntake);
assert(result1.status === 202, 'HTTP 202 on valid intake');
assert(result1.packetType === 'INTAKE_RAW', 'emits INTAKE_RAW');
assert(result1.errors === null, 'no errors');

// INTAKE_RAW goes to filter, which emits INTAKE_VALIDATED to workflow
const intakeResult = emissions.find(e => e.type === 'INTAKE_VALIDATED');
assert(intakeResult !== undefined, 'INTAKE_VALIDATED reached workflow (filter processed INTAKE_RAW)');
assert(intakeResult.dest === 'workflow:orderLifecycle', 'correct final destination');

section('T2-INTAKE-2: Valid partial intake (no cuts)');
emissions.length = 0;

const partialIntake = {
  customerName: 'Christine Holte', customerPhone: '+12075555678',
  textOptIn: true, emailOptIn: false,
  tagNumber: 'ME-2025-5678', animalType: 'moose', tenderloinRemoved: false
};

const result2 = orderIntake.handleSubmission(partialIntake);
assert(result2.status === 202, 'HTTP 202 on partial intake');
assert(result2.packetType === 'INTAKE_RAW', 'emits INTAKE_RAW for partial');

section('T2-INTAKE-3: Missing required field → 400');
emissions.length = 0;

const missingField = {
  customerName: 'Test', textOptIn: true, emailOptIn: false,
  // Missing tagNumber, animalType, tenderloinRemoved
};

const result3 = orderIntake.handleSubmission(missingField);
assert(result3.status === 400, 'HTTP 400 on missing fields');
assert(result3.errors.length >= 1, 'errors reported');
assert(result3.errors.some(e => e.includes('tagNumber')), 'identifies missing tagNumber');

section('T2-INTAKE-4: Type error → 400');
emissions.length = 0;

const badTypes = {
  customerName: 123, textOptIn: 'yes', emailOptIn: false,
  tagNumber: 'ME-2025-1234', animalType: 'deer', tenderloinRemoved: true
};

const result4 = orderIntake.handleSubmission(badTypes);
assert(result4.status === 400, 'HTTP 400 on type errors');
assert(result4.errors.some(e => e.includes('customerName must be a string')), 'type error detail');

section('T2-INTAKE-5: Consent cross-check — textOptIn without phone');
emissions.length = 0;

const noPhone = {
  customerName: 'Test User', textOptIn: true, emailOptIn: false,
  tagNumber: 'ME-2025-9999', animalType: 'deer', tenderloinRemoved: true
  // textOptIn is true but no customerPhone
};

const result5 = orderIntake.handleSubmission(noPhone);
assert(result5.status === 400, 'HTTP 400 when textOptIn without phone');
assert(result5.errors.some(e => e.includes('customerPhone required')), 'consent cross-check error');

section('T2-INTAKE-6: Gateway schema validation failure');
emissions.length = 0;

const overweight = {
  customerName: 'Test', customerPhone: '+12075551234',
  textOptIn: true, emailOptIn: false,
  tagNumber: 'ME-2025-1234', animalType: 'moose',
  tenderloinRemoved: true, hangingWeightLbs: 5000
};

const result6 = orderIntake.handleSubmission(overweight);
assert(result6.status === 400, 'HTTP 400 on gateway validation failure');
assert(result6.errors.some(e => e.includes('2000')), 'gateway schema error reported');

section('T2-INTAKE-7: Null body → 400');
const result7 = orderIntake.handleSubmission(null);
assert(result7.status === 400, 'HTTP 400 on null body');


// ═══════════════════════════════════════════════════════════════
// WORKING:ORDERINTAKE — CUTS PATH
// ═══════════════════════════════════════════════════════════════

section('T2-CUTS-1: Valid cuts submission');
emissions.length = 0;

const validCuts = {
  orderId: 'ord-001', selfServiceLinkId: 'link-abc-123',
  cutSelections: { steaks: true, ground: '50%', roasts: true },
  optionalServices: { sausage: true }
};

const resultC1 = orderIntake.handleSubmission(validCuts);
assert(resultC1.status === 202, 'HTTP 202 on valid cuts');
assert(resultC1.packetType === 'CUTS_RAW', 'emits CUTS_RAW');

// CUTS_RAW goes to filter, which emits CUTS_VALIDATED to workflow
const cutsResult = emissions.find(e => e.type === 'CUTS_VALIDATED');
assert(cutsResult !== undefined, 'CUTS_VALIDATED reached workflow (filter processed CUTS_RAW)');

section('T2-CUTS-2: Missing cutSelections → 400');

const noCuts = {
  orderId: 'ord-001', selfServiceLinkId: 'link-abc-123'
  // Missing cutSelections
};

const resultC2 = orderIntake.handleSubmission(noCuts);
assert(resultC2.status === 400, 'HTTP 400 on missing cutSelections');


// ═══════════════════════════════════════════════════════════════
// WORKING:ORDERINTAKE — CLOCK TRIGGERS
// ═══════════════════════════════════════════════════════════════

section('T2-CLOCK-1: Daily scan trigger');
emissions.length = 0;

// Register the DAILY_SCAN_TRIGGERED route for this test
c.routing.register({
  entryNumber: 64, packetType: 'DAILY_SCAN_TRIGGERED',
  source: 'working:orderIntake', bus: 'DATA',
  destinations: ['compute:dailyScan'], mode: 'Push', priority: 'STANDARD'
});

const clockResult = orderIntake.handleClockTrigger({
  triggerType: 'daily_overdue_scan',
  scanDate: '2026-04-06'
});

assert(clockResult.packetType === 'DAILY_SCAN_TRIGGERED', 'correct clock packet type');
const clockEmission = emissions.find(e => e.type === 'DAILY_SCAN_TRIGGERED');
assert(clockEmission !== undefined, 'DAILY_SCAN_TRIGGERED emitted');
assert(clockEmission.payload.operator === 'system:clock', 'tagged with system:clock');
assert(clockEmission.payload.scanDate === '2026-04-06', 'payload preserved');

section('T2-CLOCK-2: Unknown trigger type throws');
threw = false;
try {
  orderIntake.handleClockTrigger({ triggerType: 'nonexistent' });
} catch (e) {
  threw = true;
  assert(e.message.includes('Unknown clock trigger'), 'error message specific');
}
assert(threw, 'unknown clock trigger throws');

section('T2-CLOCK-3: Missing triggerType throws');
threw = false;
try {
  orderIntake.handleClockTrigger({});
} catch (e) {
  threw = true;
}
assert(threw, 'missing triggerType throws');


// ═══════════════════════════════════════════════════════════════
// FILTER:ORDERVALIDATION — INTAKE VALIDATION
// ═══════════════════════════════════════════════════════════════

section('T2-FILTER-1: Valid intake passes through');
emissions.length = 0;

// Submit a valid intake to trigger the filter
orderIntake.handleSubmission(validIntake);

const validated = emissions.find(e => e.type === 'INTAKE_VALIDATED');
assert(validated !== undefined, 'INTAKE_VALIDATED emitted');
assert(validated.dest === 'workflow:orderLifecycle', 'routed to workflow');
assert(validated.payload.customerName === 'Rick Holte', 'payload passed through unchanged');

section('T2-FILTER-2: Invalid phone format → INTAKE_REJECTED');
emissions.length = 0;

orderIntake.handleSubmission({
  customerName: 'Bad Phone', customerPhone: 'not-a-phone',
  textOptIn: false, emailOptIn: false,
  tagNumber: 'ME-2025-1111', animalType: 'deer', tenderloinRemoved: true
});

const phoneReject = emissions.find(e => e.type === 'INTAKE_REJECTED');
assert(phoneReject !== undefined, 'INTAKE_REJECTED emitted for bad phone');
assert(phoneReject.payload.rejectionReasons.includes('INVALID_PHONE_FORMAT'), 'INVALID_PHONE_FORMAT reason');
assert(phoneReject.payload.originalSubmission !== undefined, 'original submission preserved');
assert(phoneReject.dest === 'presentation:dashboard', 'rejection goes to dashboard');

section('T2-FILTER-3: Invalid tag format → INTAKE_REJECTED');
emissions.length = 0;

orderIntake.handleSubmission({
  customerName: 'Bad Tag', textOptIn: false, emailOptIn: false,
  tagNumber: 'INVALID', animalType: 'deer', tenderloinRemoved: true
});

const tagReject = emissions.find(e => e.type === 'INTAKE_REJECTED');
assert(tagReject !== undefined, 'INTAKE_REJECTED emitted for bad tag');
assert(tagReject.payload.rejectionReasons.includes('INVALID_TAG_FORMAT'), 'INVALID_TAG_FORMAT reason');

section('T2-FILTER-4: Unknown animal type → INTAKE_REJECTED');
emissions.length = 0;

orderIntake.handleSubmission({
  customerName: 'Bad Animal', textOptIn: false, emailOptIn: false,
  tagNumber: 'ME-2025-2222', animalType: 'elk', tenderloinRemoved: true
});

const animalReject = emissions.find(e => e.type === 'INTAKE_REJECTED');
assert(animalReject !== undefined, 'INTAKE_REJECTED emitted for unknown animal');
assert(animalReject.payload.rejectionReasons.includes('UNKNOWN_ANIMAL_TYPE'), 'UNKNOWN_ANIMAL_TYPE reason');

section('T2-FILTER-5: Invalid email format → INTAKE_REJECTED');
emissions.length = 0;

orderIntake.handleSubmission({
  customerName: 'Bad Email', customerEmail: 'not-an-email',
  textOptIn: false, emailOptIn: false,
  tagNumber: 'ME-2025-3333', animalType: 'bear', tenderloinRemoved: false
});

const emailReject = emissions.find(e => e.type === 'INTAKE_REJECTED');
assert(emailReject !== undefined, 'INTAKE_REJECTED emitted for bad email');
assert(emailReject.payload.rejectionReasons.includes('INVALID_EMAIL_FORMAT'), 'INVALID_EMAIL_FORMAT reason');

section('T2-FILTER-6: Multiple validation failures in one packet');
emissions.length = 0;

orderIntake.handleSubmission({
  customerName: 'Multi Fail', customerPhone: 'bad-phone',
  customerEmail: 'bad-email', textOptIn: false, emailOptIn: false,
  tagNumber: 'BADTAG', animalType: 'elephant', tenderloinRemoved: true
});

const multiReject = emissions.find(e => e.type === 'INTAKE_REJECTED');
assert(multiReject !== undefined, 'INTAKE_REJECTED emitted for multiple failures');
assert(multiReject.payload.rejectionReasons.length >= 3, 'multiple rejection reasons captured');

section('T2-FILTER-7: Trace ID preserved through filter');
emissions.length = 0;

orderIntake.handleSubmission(validIntake);
const valPkt = emissions.find(e => e.type === 'INTAKE_VALIDATED');
assert(valPkt !== undefined, 'INTAKE_VALIDATED emitted');
// Verify traceId via ledger: the INTAKE_RAW and INTAKE_VALIDATED share a traceId
const rawLedger = c.ledger.queryByPacketType('INTAKE_RAW');
const valLedger = c.ledger.queryByPacketType('INTAKE_VALIDATED');
const lastRaw = rawLedger[rawLedger.length - 1];
const lastVal = valLedger[valLedger.length - 1];
assert(lastRaw.traceId === lastVal.traceId, 'traceId preserved from RAW to VALIDATED via ledger');


// ═══════════════════════════════════════════════════════════════
// FILTER:ORDERVALIDATION — CUTS VALIDATION
// ═══════════════════════════════════════════════════════════════

section('T2-FILTER-8: Valid cuts pass through');
emissions.length = 0;

orderIntake.handleSubmission(validCuts);

const cutsValidated = emissions.find(e => e.type === 'CUTS_VALIDATED');
assert(cutsValidated !== undefined, 'CUTS_VALIDATED emitted');
assert(cutsValidated.dest === 'workflow:orderLifecycle', 'routed to workflow');

section('T2-FILTER-9: Empty cut selections → CUTS_REJECTED');
emissions.length = 0;

orderIntake.handleSubmission({
  orderId: 'ord-002', selfServiceLinkId: 'link-xyz',
  cutSelections: {}
});

const cutsRejected = emissions.find(e => e.type === 'CUTS_REJECTED');
assert(cutsRejected !== undefined, 'CUTS_REJECTED emitted for empty selections');
assert(cutsRejected.payload.rejectionReasons.includes('EMPTY_CUT_SELECTIONS'), 'EMPTY_CUT_SELECTIONS reason');
assert(cutsRejected.payload.orderId === 'ord-002', 'orderId on rejection');
assert(cutsRejected.dest === 'presentation:dashboard', 'cuts rejection goes to dashboard');


// ═══════════════════════════════════════════════════════════════
// WORKING:PAYMENTWEBHOOK
// ═══════════════════════════════════════════════════════════════

section('T2-WEBHOOK-1: Valid webhook → PAYMENT_EVENT');
emissions.length = 0;

const validWebhook = {
  id: 'evt_001', type: 'charge.succeeded',
  data: { object: { charge: 'ch_abc123', customer: 'cus_xyz', amount: 16500 } }
};

const wh1 = paymentWebhook.handleWebhook(validWebhook, 'valid-sig');
assert(wh1.status === 200, 'HTTP 200 on valid webhook');
assert(wh1.packetType === 'PAYMENT_EVENT', 'emits PAYMENT_EVENT');

const payEvt = emissions.find(e => e.type === 'PAYMENT_EVENT');
assert(payEvt !== undefined, 'PAYMENT_EVENT reached workflow');
assert(payEvt.payload.stripeEventId === 'evt_001', 'stripeEventId correct');
assert(payEvt.payload.stripeEventType === 'charge.succeeded', 'stripeEventType correct');
assert(payEvt.payload.relatedChargeId === 'ch_abc123', 'relatedChargeId extracted');
assert(payEvt.payload.relatedCustomerId === 'cus_xyz', 'relatedCustomerId extracted');
assert(payEvt.payload.receivedAt !== undefined, 'receivedAt set');

section('T2-WEBHOOK-2: Invalid signature → WEBHOOK_REJECTED');
emissions.length = 0;

const wh2 = paymentWebhook.handleWebhook(validWebhook, 'bad-sig');
assert(wh2.status === 401, 'HTTP 401 on bad signature');
assert(wh2.packetType === 'WEBHOOK_REJECTED', 'emits WEBHOOK_REJECTED');

const sigReject = emissions.find(e => e.type === 'WEBHOOK_REJECTED');
assert(sigReject !== undefined, 'WEBHOOK_REJECTED emitted');
assert(sigReject.payload.rejectionReason === 'SIGNATURE_INVALID', 'SIGNATURE_INVALID reason');
assert(sigReject.dest === 'presentation:dashboard', 'rejection goes to dashboard');

section('T2-WEBHOOK-3: Duplicate event → WEBHOOK_REJECTED');
emissions.length = 0;

// evt_001 was already processed in WEBHOOK-1
const wh3 = paymentWebhook.handleWebhook(validWebhook, 'valid-sig');
assert(wh3.status === 200, 'HTTP 200 on duplicate (idempotent)');
assert(wh3.packetType === 'WEBHOOK_REJECTED', 'emits WEBHOOK_REJECTED for duplicate');

const dupReject = emissions.find(e => e.type === 'WEBHOOK_REJECTED');
assert(dupReject !== undefined, 'WEBHOOK_REJECTED emitted for duplicate');
assert(dupReject.payload.rejectionReason === 'DUPLICATE_EVENT', 'DUPLICATE_EVENT reason');

section('T2-WEBHOOK-4: Malformed payload → WEBHOOK_REJECTED');
emissions.length = 0;

const wh4 = paymentWebhook.handleWebhook({ noId: true }, 'valid-sig');
assert(wh4.status === 400, 'HTTP 400 on malformed');
assert(wh4.packetType === 'WEBHOOK_REJECTED', 'emits WEBHOOK_REJECTED for malformed');

const malReject = emissions.find(e => e.type === 'WEBHOOK_REJECTED');
assert(malReject !== undefined, 'WEBHOOK_REJECTED emitted for malformed');
assert(malReject.payload.rejectionReason === 'MALFORMED_PAYLOAD', 'MALFORMED_PAYLOAD reason');

section('T2-WEBHOOK-5: Second valid event (dedup counter)');
emissions.length = 0;

const validWebhook2 = {
  id: 'evt_002', type: 'charge.dispute.created',
  data: { object: { charge: 'ch_def456', customer: 'cus_xyz' } }
};

const wh5 = paymentWebhook.handleWebhook(validWebhook2, 'valid-sig');
assert(wh5.status === 200, 'HTTP 200 on second valid event');
assert(wh5.packetType === 'PAYMENT_EVENT', 'second event emits PAYMENT_EVENT');
assert(paymentWebhook.processedCount() === 2, 'two events processed');


// ═══════════════════════════════════════════════════════════════
// CROSS-TIER: Routing and ledger verification
// ═══════════════════════════════════════════════════════════════

section('T2-CROSS-1: Routing table has input gate entries');

assert(c.routing.has('INTAKE_RAW', 'working:orderIntake'), 'INTAKE_RAW route exists');
assert(c.routing.has('INTAKE_VALIDATED', 'filter:orderValidation'), 'INTAKE_VALIDATED route exists');
assert(c.routing.has('INTAKE_REJECTED', 'filter:orderValidation'), 'INTAKE_REJECTED route exists');
assert(c.routing.has('INTAKE_DIRECT', 'presentation:dashboard'), 'INTAKE_DIRECT route exists');
assert(c.routing.has('CUTS_RAW', 'working:orderIntake'), 'CUTS_RAW route exists');
assert(c.routing.has('CUTS_VALIDATED', 'filter:orderValidation'), 'CUTS_VALIDATED route exists');
assert(c.routing.has('CUTS_REJECTED', 'filter:orderValidation'), 'CUTS_REJECTED route exists');
assert(c.routing.has('CUTS_DIRECT', 'presentation:dashboard'), 'CUTS_DIRECT route exists');
assert(c.routing.has('PAYMENT_EVENT', 'working:paymentWebhook'), 'PAYMENT_EVENT route exists');
assert(c.routing.has('WEBHOOK_REJECTED', 'working:paymentWebhook'), 'WEBHOOK_REJECTED route exists');

section('T2-CROSS-2: Ledger records input gate traffic');

const ledgerEntries = c.ledger.count();
assert(ledgerEntries > 20, `ledger has ${ledgerEntries} entries from full Tier 2 test`);

const intakeRawLedger = c.ledger.queryByPacketType('INTAKE_RAW');
assert(intakeRawLedger.length >= 1, 'INTAKE_RAW entries in ledger');

const webhookLedger = c.ledger.queryByPacketType('PAYMENT_EVENT');
assert(webhookLedger.length >= 1, 'PAYMENT_EVENT entries in ledger');

const rejectedLedger = c.ledger.queryByPacketType('WEBHOOK_REJECTED');
assert(rejectedLedger.length >= 1, 'WEBHOOK_REJECTED entries in ledger');

section('T2-CROSS-3: Route count includes Tier 2');
const routeCount = c.routing.count();
assert(routeCount >= 45, `${routeCount} routing entries (vault + input gate routes)`);

section('T2-CROSS-4: All 7 loops instantiated');
assert(c.registry.instanceCount() === 15, 'all 15 built-in loops instantiated');


// ═══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}`);
if (failed > 0) process.exit(1);

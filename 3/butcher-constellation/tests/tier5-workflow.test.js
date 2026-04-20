// ╔══════════════════════════════════════════════════════════════════════╗
// ║  Tier 5 Tests — workflow:orderLifecycle (Pipelines 1–5)            ║
// ║  Pipeline 1: PIPELINE_ORDER_INTAKE                                 ║
// ║  Pipeline 2: PIPELINE_STAGE_ADVANCE                                ║
// ║  Pipeline 3: PIPELINE_WEIGHT_RECORDING                             ║
// ║  Pipeline 5: PIPELINE_CANCELLATION                                 ║
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
    'working:orderIntake': { validateSubmission: () => ({ valid: true, errors: [] }) },
    'working:paymentWebhook': { verifySignature: () => ({ valid: true }) }
  }
});

c.start();

// Seed config (needed for compute:pricing)
const vaultConfig = c.registry.get('vault:config');
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
    readyForPickupTemplate: 'Your order is ready, {{customerName}}!',
    thankYouTemplate: 'Thank you {{customerName}}!'
  },
  campaigns: []
});

// Capture bus emissions for assertions
const emissions = [];

for (const loopName of ['presentation:dashboard']) {
  c.buses.DATA.subscribe(loopName, (pkt) => {
    emissions.push({ dest: loopName, type: pkt.packetType, payload: pkt.payload, traceId: pkt.traceId });
  });
}


// ═══════════════════════════════════════════════════════════════
// PIPELINE 1: FULL EXTERNAL INTAKE (with cuts)
// ═══════════════════════════════════════════════════════════════

section('T5-INTAKE-1: Full external intake — order created');
emissions.length = 0;

const intakePkt = c.createPacket('INTAKE_VALIDATED', {
  customerName: 'Rick Holte',
  customerPhone: '+12075551234',
  customerEmail: 'rick@example.com',
  textOptIn: true,
  emailOptIn: true,
  tagNumber: 'ME-2025-0001',
  animalType: 'deer',
  tenderloinRemoved: true,
  hangingWeightLbs: null,
  cutSelections: { steaks: 'T-bone', roasts: 'chuck' },
  optionalServices: null
});

c.buses.DATA.emit('filter:orderValidation', intakePkt);

const orderCreated = emissions.find(e => e.type === 'ORDER_CREATED' && e.dest === 'presentation:dashboard');
assert(orderCreated !== undefined, 'ORDER_CREATED emitted to dashboard');
assert(orderCreated.payload.stage === 'checked_in', 'stage is checked_in (full intake has cuts)');
assert(orderCreated.payload.customerId !== undefined, 'customerId assigned');

const orderId1 = orderCreated.payload.orderId;

const custCreated = emissions.find(e => e.type === 'CUSTOMER_CREATED');
assert(custCreated !== undefined, 'CUSTOMER_CREATED emitted for new customer');

section('T5-INTAKE-2: Full intake — deposit charged');
const depositCharged = emissions.find(e => e.type === 'DEPOSIT_CHARGED' && e.dest === 'presentation:dashboard');
assert(depositCharged !== undefined, 'DEPOSIT_CHARGED emitted to dashboard');
assert(depositCharged.payload.orderId === orderId1, 'deposit charged for correct order');

section('T5-INTAKE-3: Full intake — pricing completed');
const pricedLedger = c.ledger.queryByPacketType('ORDER_PRICED');
const orderPriced = pricedLedger.find(e => e.bus === 'DATA');
assert(orderPriced !== undefined, 'ORDER_PRICED recorded in ledger');

const orderFetch = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderId1 }));
assert(orderFetch.found === true, 'order exists in vault');
assert(orderFetch.order.pricingSnapshot !== undefined, 'pricing snapshot written to order');
assert(orderFetch.order.depositPaid === true, 'depositPaid set to true');

section('T5-INTAKE-4: Full intake — audit trail');
const allSnaps = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', {}));
const orderAudits = allSnaps.snapshots.filter(s =>
  s.auditType === 'order_creation' || s.auditType === 'deposit_charged');
assert(orderAudits.length >= 2, `at least 2 audit records (creation + deposit): got ${orderAudits.length}`);

section('T5-INTAKE-5: Full intake — traceId propagation');
const traceEntries = c.ledger.queryByTraceId(intakePkt.traceId);
assert(traceEntries.length >= 5, `trace has ${traceEntries.length} entries (intake->customer->order->deposit->pricing)`);


// ═══════════════════════════════════════════════════════════════
// PIPELINE 1: PARTIAL INTAKE (no cuts)
// ═══════════════════════════════════════════════════════════════

section('T5-INTAKE-6: Partial intake — pending_customer_input');
emissions.length = 0;

const partialPkt = c.createPacket('INTAKE_VALIDATED', {
  customerName: 'Christine Holte',
  customerPhone: '+12075555678',
  textOptIn: true,
  emailOptIn: false,
  tagNumber: 'ME-2025-0002',
  animalType: 'moose',
  tenderloinRemoved: false,
  cutSelections: null,
  optionalServices: null
});

c.buses.DATA.emit('filter:orderValidation', partialPkt);

const partialCreated = emissions.find(e => e.type === 'ORDER_CREATED' && e.dest === 'presentation:dashboard');
assert(partialCreated !== undefined, 'ORDER_CREATED emitted for partial intake');
assert(partialCreated.payload.stage === 'pending_customer_input', 'stage is pending_customer_input (no cuts)');

const orderId2 = partialCreated.payload.orderId;

// No pricing should fire for partial intake — check order has no pricing snapshot
const partialOrder = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderId2 }));
assert(partialOrder.order.pricingSnapshot === undefined || partialOrder.order.pricingSnapshot === null,
  'no pricing snapshot for partial intake (no cuts)');


// ═══════════════════════════════════════════════════════════════
// PIPELINE 1: INTERNAL INTAKE (INTAKE_DIRECT)
// ═══════════════════════════════════════════════════════════════

section('T5-INTAKE-7: Internal intake (INTAKE_DIRECT)');
emissions.length = 0;

const directPkt = c.createPacket('INTAKE_DIRECT', {
  customerName: 'Rick Holte',
  customerPhone: '+12075551234',
  textOptIn: true,
  emailOptIn: true,
  tagNumber: 'ME-2025-0003',
  animalType: 'bear',
  tenderloinRemoved: false,
  cutSelections: { steaks: 'ribeye' },
  optionalServices: { rushProcessing: true },
  operatorId: 'rick'
});

c.buses.DATA.emit('presentation:dashboard', directPkt);

const directCreated = emissions.find(e => e.type === 'ORDER_CREATED' && e.dest === 'presentation:dashboard');
assert(directCreated !== undefined, 'ORDER_CREATED emitted for direct intake');
assert(directCreated.payload.intakeSource === 'direct', 'intakeSource is direct');

const orderId3 = directCreated.payload.orderId;

const custCreated2 = emissions.find(e => e.type === 'CUSTOMER_CREATED');
assert(custCreated2 === undefined, 'no CUSTOMER_CREATED for returning customer');


// ═══════════════════════════════════════════════════════════════
// PIPELINE 1: DEPOSIT WAIVER
// ═══════════════════════════════════════════════════════════════

section('T5-INTAKE-8: Deposit waiver');
emissions.length = 0;

// Set deposit waiver on customer
c.buses.VAULT.emit('workflow:orderLifecycle',
  c.createPacket('WRITE_CUSTOMER_UPDATE', {
    customerId: orderCreated.payload.customerId,
    updates: { depositWaiverStatus: true }
  }));

const waiverPkt = c.createPacket('INTAKE_VALIDATED', {
  customerName: 'Rick Holte',
  customerPhone: '+12075551234',
  textOptIn: true,
  emailOptIn: true,
  tagNumber: 'ME-2025-0004',
  animalType: 'deer',
  tenderloinRemoved: true,
  cutSelections: null,
  optionalServices: null
});

c.buses.DATA.emit('filter:orderValidation', waiverPkt);

const waiverCreated = emissions.find(e => e.type === 'ORDER_CREATED' && e.dest === 'presentation:dashboard');
assert(waiverCreated !== undefined, 'ORDER_CREATED for waiver intake');

const depositWaived = emissions.find(e => e.type === 'DEPOSIT_WAIVED');
assert(depositWaived !== undefined, 'DEPOSIT_WAIVED emitted');
assert(depositWaived.payload.waivedAmount === 75, 'waived amount is $75');

const depositChargeForWaiver = emissions.find(e => e.type === 'DEPOSIT_CHARGED');
assert(depositChargeForWaiver === undefined, 'no DEPOSIT_CHARGED for waiver customer');

const orderId4 = waiverCreated.payload.orderId;


// ═══════════════════════════════════════════════════════════════
// PIPELINE 1: LATE CUTS
// ═══════════════════════════════════════════════════════════════

section('T5-INTAKE-9: Late cuts — CUTS_VALIDATED');
emissions.length = 0;

const cutsPkt = c.createPacket('CUTS_VALIDATED', {
  orderId: orderId2,
  cutSelections: { steaks: 'T-bone', ground: '10lbs' },
  optionalServices: { sausage: { lbs: 10, flavor: 'breakfast' } }
});

c.buses.DATA.emit('filter:orderValidation', cutsPkt);

const orderAfterCuts = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderId2 }));
assert(orderAfterCuts.found === true, 'order exists after late cuts');
assert(orderAfterCuts.order.stage === 'checked_in', 'stage changed to checked_in');
assert(orderAfterCuts.order.cutSelections !== null, 'cut selections written');

const latePricedLedger = c.ledger.queryByPacketType('ORDER_PRICED');
const latePriced = latePricedLedger.length > 1; // More than the first intake's pricing
assert(latePriced, 'ORDER_PRICED recorded after late cuts');
assert(orderAfterCuts.order.pricingSnapshot !== undefined, 'pricing snapshot written after late cuts');

section('T5-INTAKE-10: Late cuts from dashboard — CUTS_DIRECT');
emissions.length = 0;

// Create another partial order
const partial2Pkt = c.createPacket('INTAKE_VALIDATED', {
  customerName: 'Test User',
  customerPhone: '+12075559999',
  textOptIn: false,
  emailOptIn: false,
  tagNumber: 'ME-2025-0005',
  animalType: 'deer',
  tenderloinRemoved: true,
  cutSelections: null,
  optionalServices: null
});

c.buses.DATA.emit('filter:orderValidation', partial2Pkt);

const partial2Created = emissions.find(e => e.type === 'ORDER_CREATED' && e.dest === 'presentation:dashboard');
const orderId5 = partial2Created.payload.orderId;
emissions.length = 0;

c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('CUTS_DIRECT', {
    orderId: orderId5,
    cutSelections: { steaks: 'ribeye' },
    optionalServices: null
  }));

const directCutsOrder = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderId5 }));
assert(directCutsOrder.order.stage === 'checked_in', 'CUTS_DIRECT moved order to checked_in');
assert(directCutsOrder.order.pricingSnapshot !== undefined, 'pricing snapshot written after CUTS_DIRECT');


// ═══════════════════════════════════════════════════════════════
// PIPELINE 2: STAGE ADVANCE — Happy path
// ═══════════════════════════════════════════════════════════════

section('T5-STAGE-1: Advance checked_in -> hanging');
emissions.length = 0;

c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('STAGE_ADVANCE_COMMAND', {
    orderId: orderId1, targetStage: 'hanging', operatorId: 'rick'
  }));

const stageChanged = emissions.find(e => e.type === 'ORDER_STAGE_CHANGED' && e.dest === 'presentation:dashboard');
assert(stageChanged !== undefined, 'ORDER_STAGE_CHANGED emitted');
assert(stageChanged.payload.previousStage === 'checked_in', 'previousStage correct');
assert(stageChanged.payload.newStage === 'hanging', 'newStage correct');
assert(stageChanged.payload.triggeredBy === 'rick', 'triggeredBy correct');

const afterAdvance = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderId1 }));
assert(afterAdvance.order.stage === 'hanging', 'order stage updated to hanging in vault');

const stageChangedRoutes = c.routing.resolve('ORDER_STAGE_CHANGED', 'workflow:orderLifecycle');
assert(stageChangedRoutes[0].destinations.includes('workflow:notifications'), 'ORDER_STAGE_CHANGED routed to workflow:notifications');


// ═══════════════════════════════════════════════════════════════
// PIPELINE 2: RTB GATE
// ═══════════════════════════════════════════════════════════════

section('T5-STAGE-2: RTB gate — rejected (no weight)');
emissions.length = 0;

c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('STAGE_ADVANCE_COMMAND', {
    orderId: orderId1, targetStage: 'ready_to_butcher', operatorId: 'rick'
  }));

const rtbRejected = emissions.find(e => e.type === 'STAGE_ADVANCE_REJECTED');
assert(rtbRejected !== undefined, 'STAGE_ADVANCE_REJECTED emitted');
assert(rtbRejected.payload.reason.includes('hanging weight'), 'rejection reason mentions weight');
assert(rtbRejected.payload.currentStage === 'hanging', 'currentStage is hanging');

section('T5-STAGE-3: RTB gate — passes after weight set');
emissions.length = 0;

c.buses.VAULT.emit('workflow:orderLifecycle',
  c.createPacket('WRITE_ORDER_UPDATE', {
    orderId: orderId1,
    updates: { hangingWeightLbs: 145 }
  }));

c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('STAGE_ADVANCE_COMMAND', {
    orderId: orderId1, targetStage: 'ready_to_butcher', operatorId: 'rick'
  }));

const rtbChanged = emissions.find(e => e.type === 'ORDER_STAGE_CHANGED' && e.dest === 'presentation:dashboard');
assert(rtbChanged !== undefined, 'ORDER_STAGE_CHANGED emitted after gate passes');
assert(rtbChanged.payload.newStage === 'ready_to_butcher', 'advanced to ready_to_butcher');


// ═══════════════════════════════════════════════════════════════
// PIPELINE 2: FULL PIPELINE WALK
// ═══════════════════════════════════════════════════════════════

section('T5-STAGE-4: Walk through remaining stages');
emissions.length = 0;

const stages = ['butchering', 'ready_for_packaging', 'packaging', 'stored', 'ready_for_pickup', 'picked_up'];
const operators = ['rick', 'rick', 'christine', 'christine', 'christine', 'rick'];

for (let i = 0; i < stages.length; i++) {
  c.buses.DATA.emit('presentation:dashboard',
    c.createPacket('STAGE_ADVANCE_COMMAND', {
      orderId: orderId1, targetStage: stages[i], operatorId: operators[i]
    }));
}

const finalOrder = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderId1 }));
assert(finalOrder.order.stage === 'closed', 'order walked to closed (auto-close after picked_up)');
assert(finalOrder.order.readyForPickupAt !== undefined, 'readyForPickupAt timestamp set');
assert(finalOrder.order.pickedUpAt !== undefined, 'pickedUpAt timestamp set');
assert(finalOrder.order.closedAt !== undefined, 'closedAt timestamp set (auto-close)');

const allStageChanges = emissions.filter(e => e.type === 'ORDER_STAGE_CHANGED' && e.dest === 'presentation:dashboard');
assert(allStageChanges.length === 7, `7 stage changes emitted (includes auto-close): got ${allStageChanges.length}`);


// ═══════════════════════════════════════════════════════════════
// PIPELINE 2: REJECTION CASES
// ═══════════════════════════════════════════════════════════════

section('T5-STAGE-5: Reject — cannot advance to closed');
emissions.length = 0;

c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('STAGE_ADVANCE_COMMAND', {
    orderId: orderId1, targetStage: 'closed', operatorId: 'rick'
  }));

const closedRejected = emissions.find(e => e.type === 'STAGE_ADVANCE_REJECTED');
assert(closedRejected !== undefined, 'STAGE_ADVANCE_REJECTED for closed target');
assert(closedRejected.payload.reason.includes('Closed'), 'reason mentions Closed');

section('T5-STAGE-6: Reject — cannot skip stages');
emissions.length = 0;

c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('STAGE_ADVANCE_COMMAND', {
    orderId: orderId3, targetStage: 'butchering', operatorId: 'rick'
  }));

const skipRejected = emissions.find(e => e.type === 'STAGE_ADVANCE_REJECTED');
assert(skipRejected !== undefined, 'STAGE_ADVANCE_REJECTED for skip attempt');
assert(skipRejected.payload.reason.includes('skip'), 'reason mentions skip');

section('T5-STAGE-7: Reject — order not found');
emissions.length = 0;

c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('STAGE_ADVANCE_COMMAND', {
    orderId: 'nonexistent-id', targetStage: 'hanging', operatorId: 'rick'
  }));

const notFoundRejected = emissions.find(e => e.type === 'STAGE_ADVANCE_REJECTED');
assert(notFoundRejected !== undefined, 'STAGE_ADVANCE_REJECTED for nonexistent order');
assert(notFoundRejected.payload.reason.includes('not found'), 'reason mentions not found');

section('T5-STAGE-8: Reject — side state (pending_customer_input)');
emissions.length = 0;

c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('STAGE_ADVANCE_COMMAND', {
    orderId: orderId4, targetStage: 'hanging', operatorId: 'rick'
  }));

const sideRejected = emissions.find(e => e.type === 'STAGE_ADVANCE_REJECTED');
assert(sideRejected !== undefined, 'STAGE_ADVANCE_REJECTED for side state');
assert(sideRejected.payload.reason.includes('pending_customer_input'), 'reason mentions side state');



// ═══════════════════════════════════════════════════════════════
// PIPELINE 3: WEIGHT_RECORDING
// ═══════════════════════════════════════════════════════════════

// Create a fresh order for weight tests — direct intake with cuts (gets priced, checked_in)
section('T5-WEIGHT-1: Setup — create order for weight tests');
emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('INTAKE_DIRECT', {
    customerName: 'Weight Test', customerPhone: '+12075559001',
    tagNumber: 'ME-2025-W001', animalType: 'deer', tenderloinRemoved: false,
    cutSelections: { steaks: 'T-bone' }, optionalServices: null,
    operatorId: 'rick'
  }));
const weightOrderCreated = emissions.find(e => e.type === 'ORDER_CREATED' && e.dest === 'presentation:dashboard');
assert(weightOrderCreated !== undefined, 'weight test order created');
const orderIdW1 = weightOrderCreated.payload.orderId;

// Verify: order is checked_in, has pricing, no weight
const wOrd1 = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderIdW1 }));
assert(wOrd1.order.stage === 'checked_in', 'weight test order is checked_in');
assert(wOrd1.order.pricingSnapshot != null, 'weight test order has pricing');
assert(wOrd1.order.hangingWeightLbs == null, 'weight test order has no weight yet');

section('T5-WEIGHT-2: Record weight — triggers RTB gate');
emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('WEIGHT_RECORDED', {
    orderId: orderIdW1, hangingWeightLbs: 155, operatorId: 'rick'
  }));

// Weight should be written
const wOrd2 = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderIdW1 }));
assert(wOrd2.order.hangingWeightLbs === 155, 'weight written to order');

// RTB gate should have fired — order auto-advanced to ready_to_butcher
assert(wOrd2.order.stage === 'ready_to_butcher', 'RTB gate fired: auto-advanced to ready_to_butcher');

// ORDER_STAGE_CHANGED should have been emitted
const rtbStageChanged = emissions.find(e => e.type === 'ORDER_STAGE_CHANGED' && e.dest === 'presentation:dashboard');
assert(rtbStageChanged !== undefined, 'ORDER_STAGE_CHANGED emitted on RTB gate');
assert(rtbStageChanged.payload.previousStage === 'checked_in', 'previousStage is checked_in');
assert(rtbStageChanged.payload.newStage === 'ready_to_butcher', 'newStage is ready_to_butcher');
assert(rtbStageChanged.payload.triggeredBy === 'system', 'triggeredBy is system (auto-advance)');

section('T5-WEIGHT-3: Weight audit exists (independent of gate)');
const wAudits = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', { snapshotType: 'audit' }));
const weightAudits = wAudits.snapshots.filter(s => s.auditType === 'weight_recording');
assert(weightAudits.length >= 1, 'weight_recording audit exists');

section('T5-WEIGHT-4: Record weight without pricing — no gate');
// Create order without cuts (pending_customer_input, no pricing)
emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('INTAKE_DIRECT', {
    customerName: 'No Price Test', customerPhone: '+12075559002',
    tagNumber: 'ME-2025-W002', animalType: 'deer', tenderloinRemoved: false,
    cutSelections: null, optionalServices: null,
    operatorId: 'rick'
  }));
const noPriceCreated = emissions.find(e => e.type === 'ORDER_CREATED' && e.dest === 'presentation:dashboard');
const orderIdW2 = noPriceCreated.payload.orderId;
assert(noPriceCreated.payload.stage === 'pending_customer_input', 'no-price order starts pending');

emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('WEIGHT_RECORDED', {
    orderId: orderIdW2, hangingWeightLbs: 140, operatorId: 'rick'
  }));

// Weight written but no stage change (no pricing = gate stays closed)
const wOrd3 = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderIdW2 }));
assert(wOrd3.order.hangingWeightLbs === 140, 'weight recorded on unpriced order');
assert(wOrd3.order.stage === 'pending_customer_input', 'stage unchanged — gate not met');

const noGateStageChange = emissions.find(e => e.type === 'ORDER_STAGE_CHANGED');
assert(noGateStageChange === undefined, 'no ORDER_STAGE_CHANGED when gate not met');

section('T5-WEIGHT-5: Weight on nonexistent order — no crash');
emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('WEIGHT_RECORDED', {
    orderId: 'ord-nonexistent', hangingWeightLbs: 100, operatorId: 'rick'
  }));
// No crash, no emissions (no rejection event for weight per spec)
assert(emissions.find(e => e.type === 'ORDER_STAGE_CHANGED') === undefined, 'no stage change on nonexistent');

section('T5-WEIGHT-6: Weight update (correction) — re-audit');
emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('WEIGHT_RECORDED', {
    orderId: orderIdW1, hangingWeightLbs: 162, operatorId: 'rick'
  }));

const wOrd4 = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderIdW1 }));
assert(wOrd4.order.hangingWeightLbs === 162, 'weight correction persisted');

// Should get another weight_recording audit
const wAudits2 = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', { snapshotType: 'audit' }));
const weightAudits2 = wAudits2.snapshots.filter(s => s.auditType === 'weight_recording');
assert(weightAudits2.length >= 2, `weight correction audited: got ${weightAudits2.length}`);

section('T5-WEIGHT-7: Weight then late cuts triggers RTB gate');
// orderIdW2 has weight but no pricing. Send cuts → pricing → gate should fire.
emissions.length = 0;
const cutsDirectPkt = c.createPacket('CUTS_DIRECT', {
  orderId: orderIdW2,
  cutSelections: { steaks: 'Ribeye' },
  optionalServices: null
});
c.buses.DATA.emit('presentation:dashboard', cutsDirectPkt);

const wOrd5 = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderIdW2 }));
assert(wOrd5.order.stage === 'ready_to_butcher', 'RTB gate fires after late cuts + existing weight');
assert(wOrd5.order.pricingSnapshot != null, 'pricing snapshot written');


// ═══════════════════════════════════════════════════════════════
// PIPELINE 5: CANCELLATION
// ═══════════════════════════════════════════════════════════════

section('T5-CANCEL-1: Cancel from checked_in');
emissions.length = 0;

// Create a fresh order for cancellation
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('INTAKE_DIRECT', {
    customerName: 'Cancel Test', customerPhone: '+12075559003',
    tagNumber: 'ME-2025-C001', animalType: 'deer', tenderloinRemoved: false,
    cutSelections: { steaks: 'T-bone' }, optionalServices: null,
    operatorId: 'rick'
  }));
const cancelOrderCreated = emissions.find(e => e.type === 'ORDER_CREATED' && e.dest === 'presentation:dashboard');
const orderIdC1 = cancelOrderCreated.payload.orderId;
assert(cancelOrderCreated.payload.stage === 'checked_in', 'cancel test order is checked_in');

emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('CANCEL_ORDER', {
    orderId: orderIdC1, operatorId: 'rick', reason: 'Customer changed mind'
  }));

const cancelled = emissions.find(e => e.type === 'ORDER_CANCELLED' && e.dest === 'presentation:dashboard');
assert(cancelled !== undefined, 'ORDER_CANCELLED emitted to dashboard');
assert(cancelled.payload.orderId === orderIdC1, 'correct orderId');
assert(cancelled.payload.cancelledBy === 'rick', 'cancelledBy is rick');
assert(cancelled.payload.previousStage === 'checked_in', 'previousStage is checked_in');
assert(cancelled.payload.depositForfeited === true, 'depositForfeited is true');
assert(cancelled.payload.reason === 'Customer changed mind', 'reason preserved');

// ORDER_CANCELLED also goes to workflow:notifications (verified via routing)
const cancelRoutes2 = c.routing.resolve('ORDER_CANCELLED', 'workflow:orderLifecycle');
assert(cancelRoutes2[0].destinations.includes('workflow:notifications'), 'ORDER_CANCELLED routed to workflow:notifications');

// Verify vault state
const cOrd1 = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderIdC1 }));
assert(cOrd1.order.stage === 'cancelled', 'order stage is cancelled in vault');
assert(cOrd1.order.cancelledAt != null, 'cancelledAt timestamp set');

// No ORDER_STAGE_CHANGED (cancellation is a side state, not a pipeline step)
const cancelStageChanged = emissions.find(e => e.type === 'ORDER_STAGE_CHANGED');
assert(cancelStageChanged === undefined, 'no ORDER_STAGE_CHANGED on cancellation');

section('T5-CANCEL-2: Cancel from pending_customer_input');
emissions.length = 0;

c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('INTAKE_DIRECT', {
    customerName: 'Pending Cancel', customerPhone: '+12075559004',
    tagNumber: 'ME-2025-C002', animalType: 'moose', tenderloinRemoved: false,
    cutSelections: null, optionalServices: null,
    operatorId: 'rick'
  }));
const pendingCreated = emissions.find(e => e.type === 'ORDER_CREATED' && e.dest === 'presentation:dashboard');
const orderIdC2 = pendingCreated.payload.orderId;
assert(pendingCreated.payload.stage === 'pending_customer_input', 'order is pending');

emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('CANCEL_ORDER', {
    orderId: orderIdC2, operatorId: 'christine'
  }));

const cancelled2 = emissions.find(e => e.type === 'ORDER_CANCELLED');
assert(cancelled2 !== undefined, 'ORDER_CANCELLED from pending_customer_input');
assert(cancelled2.payload.previousStage === 'pending_customer_input', 'previousStage correct');

section('T5-CANCEL-3: Cancel from hanging');
emissions.length = 0;

c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('INTAKE_DIRECT', {
    customerName: 'Hanging Cancel', customerPhone: '+12075559005',
    tagNumber: 'ME-2025-C003', animalType: 'deer', tenderloinRemoved: false,
    cutSelections: { steaks: 'T-bone' }, optionalServices: null,
    operatorId: 'rick'
  }));
const hangCreated = emissions.find(e => e.type === 'ORDER_CREATED' && e.dest === 'presentation:dashboard');
const orderIdC3 = hangCreated.payload.orderId;

// Advance to hanging
emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('STAGE_ADVANCE_COMMAND', {
    orderId: orderIdC3, targetStage: 'hanging', operatorId: 'rick'
  }));
const hangAdvanced = emissions.find(e => e.type === 'ORDER_STAGE_CHANGED');
assert(hangAdvanced !== undefined, 'advanced to hanging');

emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('CANCEL_ORDER', {
    orderId: orderIdC3, operatorId: 'rick'
  }));
const cancelled3 = emissions.find(e => e.type === 'ORDER_CANCELLED');
assert(cancelled3 !== undefined, 'ORDER_CANCELLED from hanging');
assert(cancelled3.payload.previousStage === 'hanging', 'previousStage is hanging');

section('T5-CANCEL-4: Cancel rejected from butchering');
emissions.length = 0;

// Create order with cuts, give it weight so RTB gate fires, then advance to butchering
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('INTAKE_DIRECT', {
    customerName: 'Butchering Cancel', customerPhone: '+12075559006',
    tagNumber: 'ME-2025-C004', animalType: 'deer', tenderloinRemoved: false,
    hangingWeightLbs: 150,
    cutSelections: { steaks: 'T-bone' }, optionalServices: null,
    operatorId: 'rick'
  }));
const butchCreated = emissions.find(e => e.type === 'ORDER_CREATED' && e.dest === 'presentation:dashboard');
const orderIdC4 = butchCreated.payload.orderId;

// Record weight to trigger RTB gate (order already has pricing from intake cuts)
emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('WEIGHT_RECORDED', {
    orderId: orderIdC4, hangingWeightLbs: 150, operatorId: 'rick'
  }));

const c4Ord = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderIdC4 }));
assert(c4Ord.order.stage === 'ready_to_butcher', 'order at RTB for cancel test');

// Advance to butchering
emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('STAGE_ADVANCE_COMMAND', {
    orderId: orderIdC4, targetStage: 'butchering', operatorId: 'rick'
  }));
const butchAdvanced = emissions.find(e => e.type === 'ORDER_STAGE_CHANGED');
assert(butchAdvanced !== undefined, 'advanced to butchering');

// Now try to cancel — should be rejected
emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('CANCEL_ORDER', {
    orderId: orderIdC4, operatorId: 'rick'
  }));

const cancelRejected = emissions.find(e => e.type === 'CANCEL_REJECTED');
assert(cancelRejected !== undefined, 'CANCEL_REJECTED from butchering');
assert(cancelRejected.payload.currentStage === 'butchering', 'currentStage is butchering');
assert(cancelRejected.payload.reason.includes('butchering'), 'reason mentions stage');

section('T5-CANCEL-5: Cancel rejected from closed');
emissions.length = 0;

// orderId1 is at closed from the pipeline walk (auto-close after picked_up)
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('CANCEL_ORDER', {
    orderId: orderId1, operatorId: 'christine'
  }));

const cancelRejected2 = emissions.find(e => e.type === 'CANCEL_REJECTED');
assert(cancelRejected2 !== undefined, 'CANCEL_REJECTED from closed');
assert(cancelRejected2.payload.currentStage === 'closed', 'currentStage is closed');

section('T5-CANCEL-6: Cancel nonexistent order');
emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('CANCEL_ORDER', {
    orderId: 'ord-does-not-exist', operatorId: 'rick'
  }));

const cancelRejected3 = emissions.find(e => e.type === 'CANCEL_REJECTED');
assert(cancelRejected3 !== undefined, 'CANCEL_REJECTED for nonexistent order');
assert(cancelRejected3.payload.reason.includes('not found'), 'reason says not found');

section('T5-CANCEL-7: Cancel already-cancelled order');
emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('CANCEL_ORDER', {
    orderId: orderIdC1, operatorId: 'rick'
  }));

const cancelRejected4 = emissions.find(e => e.type === 'CANCEL_REJECTED');
assert(cancelRejected4 !== undefined, 'CANCEL_REJECTED for already-cancelled order');
assert(cancelRejected4.payload.currentStage === 'cancelled', 'currentStage is cancelled');

section('T5-CANCEL-8: Cancellation audit');
const cAudits = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', { snapshotType: 'audit' }));
const cancelAudits = cAudits.snapshots.filter(s => s.auditType === 'cancellation');
assert(cancelAudits.length >= 3, `at least 3 cancellation audits: got ${cancelAudits.length}`);

section('T5-CANCEL-9: Routing verification');
const cancelRoutes = c.routing.resolve('CANCEL_ORDER', 'presentation:dashboard');
assert(cancelRoutes.length === 1, 'CANCEL_ORDER routing exists');
assert(cancelRoutes[0].destinations.includes('workflow:orderLifecycle'), 'CANCEL_ORDER → workflow');

const cancelledRoutes = c.routing.resolve('ORDER_CANCELLED', 'workflow:orderLifecycle');
assert(cancelledRoutes.length === 1, 'ORDER_CANCELLED routing exists');
assert(cancelledRoutes[0].destinations.includes('presentation:dashboard'), 'ORDER_CANCELLED → dashboard');
assert(cancelledRoutes[0].destinations.includes('workflow:notifications'), 'ORDER_CANCELLED → notifications');

const rejectRoutes = c.routing.resolve('CANCEL_REJECTED', 'workflow:orderLifecycle');
assert(rejectRoutes.length === 1, 'CANCEL_REJECTED routing exists');

const weightRoutes = c.routing.resolve('WEIGHT_RECORDED', 'presentation:dashboard');
assert(weightRoutes.length === 1, 'WEIGHT_RECORDED routing exists');
assert(weightRoutes[0].destinations.includes('workflow:orderLifecycle'), 'WEIGHT_RECORDED → workflow');



// ═══════════════════════════════════════════════════════════════
// PIPELINE 6: PICKUP_CLOSE (Balance Charge + Auto-Close)
// ═══════════════════════════════════════════════════════════════

section('T5-PICKUP-1: Auto-close verified on pipeline walk');
// orderId1 already walked to closed via auto-close. Verify balance was charged.
const closedOrder = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderId1 }));
assert(closedOrder.order.stage === 'closed', 'orderId1 is closed');
assert(closedOrder.order.balancePaid === true, 'balance was charged');
assert(closedOrder.order.closedAt != null, 'closedAt timestamp present');

section('T5-PICKUP-2: Balance charge audit exists');
const pickupAudits = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', { snapshotType: 'audit' }));
const balanceAudits = pickupAudits.snapshots.filter(s => s.auditType === 'balance_charged');
assert(balanceAudits.length >= 1, `balance_charged audit exists: got ${balanceAudits.length}`);

section('T5-PICKUP-3: Zero balance skip — auto-close immediate');
emissions.length = 0;
// Create an order, give it pricing with zero balance (deposit covers total)
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('INTAKE_DIRECT', {
    customerName: 'Zero Balance', customerPhone: '+12075559010',
    tagNumber: 'ME-2025-Z001', animalType: 'deer', tenderloinRemoved: false,
    cutSelections: { steaks: 'T-bone' }, optionalServices: null,
    operatorId: 'rick'
  }));
const zeroCreated = emissions.find(e => e.type === 'ORDER_CREATED' && e.dest === 'presentation:dashboard');
const orderIdZ = zeroCreated.payload.orderId;

// Manually set pricingSnapshot.balanceDue to 0 (deposit covers everything)
// Walk order to picked_up first: need weight for RTB gate
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('WEIGHT_RECORDED', {
    orderId: orderIdZ, hangingWeightLbs: 120, operatorId: 'rick'
  }));

// Verify RTB gate fired
const zOrd = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderIdZ }));
assert(zOrd.order.stage === 'ready_to_butcher', 'zero-balance order at RTB');

// Override pricingSnapshot to have zero balance (simulating deposit >= total)
// We'll write directly since the pricing already happened with real values
const zOrdPriced = zOrd.order;
c.buses.VAULT.emit('workflow:orderLifecycle',
  c.createPacket('WRITE_ORDER_UPDATE', {
    orderId: orderIdZ,
    updates: { pricingSnapshot: { ...zOrdPriced.pricingSnapshot, balanceDue: 0 } }
  }));

// Walk to picked_up (which triggers auto-close)
emissions.length = 0;
const walkStages = ['butchering', 'ready_for_packaging', 'packaging', 'stored', 'ready_for_pickup', 'picked_up'];
const walkOps = ['rick', 'rick', 'christine', 'christine', 'christine', 'rick'];
for (let i = 0; i < walkStages.length; i++) {
  c.buses.DATA.emit('presentation:dashboard',
    c.createPacket('STAGE_ADVANCE_COMMAND', {
      orderId: orderIdZ, targetStage: walkStages[i], operatorId: walkOps[i]
    }));
}

const zFinal = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderIdZ }));
assert(zFinal.order.stage === 'closed', 'zero-balance order auto-closed');

// No BALANCE_CHARGED should have been emitted for the zero-balance order
// (The charge was skipped, close was immediate)
// Check that BALANCE_CHARGED emissions for this order don't exist
const zBalanceCharged = emissions.filter(e =>
  e.type === 'BALANCE_CHARGED' && e.payload && e.payload.orderId === orderIdZ);
assert(zBalanceCharged.length === 0, 'no BALANCE_CHARGED for zero-balance order');

section('T5-PICKUP-4: Storage fee rate snapshot at ready_for_pickup');
// The zero-balance order walked through ready_for_pickup — check storageFeeRateCents
assert(zFinal.order.storageFeeRateCents != null, 'storageFeeRateCents snapshotted');
assert(zFinal.order.storageFeeRateCents === 5000, 'storageFeeRateCents = 5000 ($50 * 100)');


// ═══════════════════════════════════════════════════════════════
// PIPELINE 7: STORAGE_FEE
// ═══════════════════════════════════════════════════════════════

section('T5-STORAGE-1: Storage fee charge');
// Create an order in stored stage for storage fee testing
emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('INTAKE_DIRECT', {
    customerName: 'Storage Test', customerPhone: '+12075559011',
    tagNumber: 'ME-2025-S001', animalType: 'deer', tenderloinRemoved: false,
    cutSelections: { steaks: 'Ribeye' }, optionalServices: null,
    operatorId: 'rick'
  }));
const storCreated = emissions.find(e => e.type === 'ORDER_CREATED' && e.dest === 'presentation:dashboard');
const orderIdS = storCreated.payload.orderId;

// Add weight → RTB gate fires
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('WEIGHT_RECORDED', {
    orderId: orderIdS, hangingWeightLbs: 155, operatorId: 'rick'
  }));

// Walk to ready_for_pickup (storage eligible)
const storStages = ['butchering', 'ready_for_packaging', 'packaging', 'stored', 'ready_for_pickup'];
const storOps = ['rick', 'rick', 'christine', 'christine', 'christine'];
for (let i = 0; i < storStages.length; i++) {
  c.buses.DATA.emit('presentation:dashboard',
    c.createPacket('STAGE_ADVANCE_COMMAND', {
      orderId: orderIdS, targetStage: storStages[i], operatorId: storOps[i]
    }));
}

const storOrd = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderIdS }));
assert(storOrd.order.stage === 'ready_for_pickup', 'storage test order at ready_for_pickup');
assert(storOrd.order.storageFeeRateCents === 5000, 'storage rate snapshotted');

// Simulate STORAGE_FEE_DUE from dailyScan
emissions.length = 0;
c.buses.DATA.emit('compute:dailyScan',
  c.createPacket('STORAGE_FEE_DUE', {
    orderId: orderIdS, storageWeekNumber: 1
  }));

const storOrdAfter = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderIdS }));
assert(storOrdAfter.order.lastStorageFeeChargedAt != null, 'lastStorageFeeChargedAt set');
assert(storOrdAfter.order.storageFeesChargedCents === 5000, 'storageFeesChargedCents = 5000');

section('T5-STORAGE-2: Second storage fee accumulates');
emissions.length = 0;
c.buses.DATA.emit('compute:dailyScan',
  c.createPacket('STORAGE_FEE_DUE', {
    orderId: orderIdS, storageWeekNumber: 2
  }));

const storOrd2 = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderIdS }));
assert(storOrd2.order.storageFeesChargedCents === 10000, 'storage fees accumulated: 10000 ($100)');

section('T5-STORAGE-3: Storage fee audit');
const storAuditAll = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', { snapshotType: 'audit' }));
const storFeeAudits = storAuditAll.snapshots.filter(s => s.auditType === 'storage_fee_charged');
assert(storFeeAudits.length >= 2, `at least 2 storage_fee_charged audits: got ${storFeeAudits.length}`);


// ═══════════════════════════════════════════════════════════════
// PIPELINE 8: ABANDONMENT (No-Show)
// ═══════════════════════════════════════════════════════════════

section('T5-ABANDON-1: No-show triggers abandonment');
// Create a fresh order for no-show test (don't reuse orderIdS which has $100 storage fees)
emissions.length = 0;
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('INTAKE_DIRECT', {
    customerName: 'NoShow Test', customerPhone: '+12075559012',
    tagNumber: 'ME-2025-N001', animalType: 'deer', tenderloinRemoved: false,
    cutSelections: { steaks: 'Ribeye' }, optionalServices: null,
    operatorId: 'rick'
  }));
const noshowCreated = emissions.find(e => e.type === 'ORDER_CREATED' && e.dest === 'presentation:dashboard');
const orderIdN = noshowCreated.payload.orderId;

// Add weight → RTB gate fires
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('WEIGHT_RECORDED', {
    orderId: orderIdN, hangingWeightLbs: 155, operatorId: 'rick'
  }));

// Walk to ready_for_pickup
['butchering', 'ready_for_packaging', 'packaging', 'stored', 'ready_for_pickup'].forEach((s, i) => {
  c.buses.DATA.emit('presentation:dashboard',
    c.createPacket('STAGE_ADVANCE_COMMAND', {
      orderId: orderIdN, targetStage: s, operatorId: ['rick','rick','christine','christine','christine'][i]
    }));
});

const nOrd = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderIdN }));
assert(nOrd.order.stage === 'ready_for_pickup', 'no-show test order at ready_for_pickup');

// Trigger no-show
emissions.length = 0;
c.buses.DATA.emit('compute:dailyScan',
  c.createPacket('NO_SHOW_DEADLINE_REACHED', {
    orderId: orderIdN, deadlineDate: '2026-05-07'
  }));

const abandonedEvt = emissions.find(e => e.type === 'ORDER_ABANDONED' && e.dest === 'presentation:dashboard');
assert(abandonedEvt !== undefined, 'ORDER_ABANDONED emitted to dashboard');
assert(abandonedEvt.payload.orderId === orderIdN, 'correct orderId');
assert(abandonedEvt.payload.previousStage === 'ready_for_pickup', 'previousStage correct');

// Also goes to workflow:notifications (verified via routing)
const abRoutes2 = c.routing.resolve('ORDER_ABANDONED', 'workflow:orderLifecycle');
assert(abRoutes2[0].destinations.includes('workflow:notifications'), 'ORDER_ABANDONED routed to workflow:notifications');

section('T5-ABANDON-2: Abandoned order vault state');
const abandonOrd = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderIdN }));
assert(abandonOrd.order.stage === 'abandoned', 'order stage is abandoned');
assert(abandonOrd.order.abandonedAt != null, 'abandonedAt timestamp set');

section('T5-ABANDON-3: No-show charge + abandonment audit');
const abAudits = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', { snapshotType: 'audit' }));
const noshowAudits = abAudits.snapshots.filter(s =>
  s.auditType === 'noshow_balance_charged' || s.auditType === 'abandonment');
assert(noshowAudits.length >= 2, `no-show charge + abandonment audits: got ${noshowAudits.length}`);

section('T5-ABANDON-4: No ORDER_STAGE_CHANGED on abandonment');
const abStageChanged = emissions.find(e => e.type === 'ORDER_STAGE_CHANGED');
assert(abStageChanged === undefined, 'no ORDER_STAGE_CHANGED on abandonment (side state)');

section('T5-ABANDON-5: Routing verification');
const abRoutes = c.routing.resolve('ORDER_ABANDONED', 'workflow:orderLifecycle');
assert(abRoutes.length === 1, 'ORDER_ABANDONED routing exists');
assert(abRoutes[0].destinations.includes('presentation:dashboard'), 'ORDER_ABANDONED → dashboard');
assert(abRoutes[0].destinations.includes('workflow:notifications'), 'ORDER_ABANDONED → notifications');


// ═══════════════════════════════════════════════════════════════
// AUDIT TRAIL
// ═══════════════════════════════════════════════════════════════

section('T5-AUDIT-1: Stage transition audits');
const allAudits = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', { snapshotType: 'audit' }));
const stageAudits = allAudits.snapshots.filter(s => s.auditType === 'stage_transition');
assert(stageAudits.length >= 10, `at least 10 stage audits: got ${stageAudits.length}`);

section('T5-AUDIT-2: Deposit waiver audit');
const waiverAudits = allAudits.snapshots.filter(s => s.auditType === 'deposit_waiver');
assert(waiverAudits.length >= 1, 'deposit waiver audit exists');

section('T5-AUDIT-3: Order creation audits');
const creationAudits = allAudits.snapshots.filter(s => s.auditType === 'order_creation');
assert(creationAudits.length >= 10, `at least 10 order creation audits: got ${creationAudits.length}`);


// ═══════════════════════════════════════════════════════════════
// CROSS-TIER COUNTS
// ═══════════════════════════════════════════════════════════════

section('T5-CROSS-1: Routing and instance counts');
assert(c.routing.count() === 93, `routing: ${c.routing.count()} entries (expected 93)`);
assert(c.registry.instanceCount() === 15, `instances: ${c.registry.instanceCount()} (expected 15)`);

section('T5-CROSS-2: Ledger volume');
const totalLedger = c.ledger.count();
assert(totalLedger > 100, `ledger has ${totalLedger} entries`);

section('T5-CROSS-3: DEPOSIT_FAILED routing exists');
const dfRoutes = c.routing.resolve('DEPOSIT_FAILED', 'signal:payments');
assert(dfRoutes.length === 1, 'DEPOSIT_FAILED has routing entry');
assert(dfRoutes[0].destinations.includes('workflow:orderLifecycle'), 'DEPOSIT_FAILED routed to workflow');


// ═══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}`);
if (failed > 0) process.exit(1);

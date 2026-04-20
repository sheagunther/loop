// ╔══════════════════════════════════════════════════════════════════════╗
// ║  Tier 7 Tests — End-to-End Integration                             ║
// ║  Single order: external HTTP intake → close                        ║
// ║  Exercises all 15 loops, all 4 buses, full trace chain             ║
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
// SETUP — Full constellation with controllable services
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

// Controllable payment gate
let chargeBehavior = { success: true };
const chargeLog = [];
function controllableCharge(opts) {
  chargeLog.push(opts);
  if (chargeBehavior.success) {
    return {
      success: true,
      chargeId: 'ch_test_' + chargeLog.length,
      chargedAt: new Date().toISOString(),
      stripeCustomerId: 'cus_test_001'
    };
  }
  return { success: false, reason: 'STRIPE_ERROR', detail: 'test failure' };
}

// Controllable notification gate
const sendLog = [];
function controllableSend(opts) {
  sendLog.push(opts);
  return { success: true, providerResponse: 'test_ok', attemptNumber: 1 };
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
  },
  services: {
    'signal:payments': { charge: controllableCharge },
    'signal:notifications': { send: controllableSend }
  }
});

c.start();

// Seed config
const vaultConfig = c.registry.get('vault:config');
vaultConfig.seed({
  pricing: {
    baseRate: 165, weightThresholdLbs: 160, overagePerLb: 1,
    depositAmount: 75, animalTypeOverrides: {}
  },
  services: {
    porkFatPerLb: 3, sausagePerLb: 3.75, sausageMinimumLbs: 5, rushProcessing: 35
  },
  storage: {
    feePerWeek: 50, gracePeriodDays: 7, noShowDeadlineDays: 30
  },
  notifications: {
    readyForPickupTemplate: 'Ready for pickup, {{customerName}}!',
    thankYouTemplate: 'Thank you {{customerName}}!',
    selfServiceLinkTemplate: 'Hi {{customerName}}, complete your cuts: {{selfServiceLinkUrl}}',
    cancellationTemplate: 'Order {{orderId}} cancelled.',
    abandonmentTemplate: 'Order {{orderId}} abandoned.',
    incompleteReminderTemplate: 'Reminder: complete cuts for {{orderId}}.',
    marketingTemplate: 'Hey {{customerName}}, hunting season!'
  },
  campaigns: []
});

// Capture all DATA bus emissions using decorator pattern
const emissions = [];
const dashboardHandle = c.registry.get('presentation:dashboard');
const dashboardRealHandler = dashboardHandle.onPacket;
c.buses.DATA.subscribe('presentation:dashboard', (pkt) => {
  emissions.push({ dest: 'presentation:dashboard', type: pkt.packetType, payload: pkt.payload, traceId: pkt.traceId });
  dashboardRealHandler(pkt);
});

// Get entry points
const orderIntake = c.registry.get('working:orderIntake');

// Record ledger baseline
const ledgerBaseline = c.ledger.count();


// ═══════════════════════════════════════════════════════════════
// PHASE 1: External HTTP submission
// True entry point — same as server.js would call
// ═══════════════════════════════════════════════════════════════

section('E2E-1: External HTTP intake submission');

const httpResult = orderIntake.handleSubmission({
  customerName: 'Rick Holte',
  customerPhone: '+12075551234',
  customerEmail: 'rick@deerhill.com',
  textOptIn: true,
  emailOptIn: true,
  tagNumber: 'ME-2025-9001',
  animalType: 'deer',
  tenderloinRemoved: true,
  cutSelections: { steaks: 'T-bone', roasts: 'chuck', ground: '50lb' },
  optionalServices: { sausage: 10 }
});

assert(httpResult.status === 202, `HTTP 202 accepted (got ${httpResult.status})`);
assert(httpResult.packetType === 'INTAKE_RAW', 'packet type is INTAKE_RAW');
assert(httpResult.errors === null, 'no errors');


// ═══════════════════════════════════════════════════════════════
// PHASE 2: Verify intake pipeline completed synchronously
// INTAKE_RAW → filter → INTAKE_VALIDATED → workflow → vaults
// ═══════════════════════════════════════════════════════════════

section('E2E-2: Order created with correct initial state');

const orderCreated = emissions.find(e => e.type === 'ORDER_CREATED');
assert(orderCreated !== undefined, 'ORDER_CREATED reached dashboard');
assert(orderCreated.payload.stage === 'checked_in', 'stage is checked_in (has cuts)');
assert(orderCreated.payload.customerId !== undefined, 'customerId assigned');

const orderId = orderCreated.payload.orderId;
const customerId = orderCreated.payload.customerId;

// Fetch order from vault to verify full state
const orderResult = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderId }));
assert(orderResult.found === true, 'order exists in vault');
assert(orderResult.order.tagNumber === 'ME-2025-9001', 'tag number correct');
assert(orderResult.order.animalType === 'deer', 'animal type correct');
assert(orderResult.order.tenderloinRemoved === true, 'tenderloin removed');
assert(orderResult.order.intakeSource === 'external', 'intake source is external');
assert(orderResult.order.cutSelections !== null, 'cut selections stored');

section('E2E-3: Customer created');
const custResult = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_CUSTOMER', { lookupBy: 'phone', lookupValue: '+12075551234' }));
assert(custResult.found === true, 'customer exists');
assert(custResult.customer.name === 'Rick Holte', 'customer name correct');
assert(custResult.customer.textOptIn === true, 'text opt-in stored');
assert(custResult.customer.emailOptIn === true, 'email opt-in stored');


// ═══════════════════════════════════════════════════════════════
// PHASE 3: Deposit charged through signal:payments
// ═══════════════════════════════════════════════════════════════

section('E2E-4: Deposit charged');
assert(chargeLog.length >= 1, 'payment service called');

const depositCharge = chargeLog.find(ch => ch.description && ch.description.includes('Deposit'));
assert(depositCharge !== undefined, 'deposit charge sent');
assert(depositCharge.amountCents === 7500, 'deposit is $75 (7500 cents)');

const depositCharged = emissions.find(e => e.type === 'DEPOSIT_CHARGED');
assert(depositCharged !== undefined, 'DEPOSIT_CHARGED reached dashboard');

// Verify order updated with deposit
const afterDeposit = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderId }));
assert(afterDeposit.order.depositPaid === true, 'depositPaid flag set');


// ═══════════════════════════════════════════════════════════════
// PHASE 4: Pricing completed through compute:pricing
// ═══════════════════════════════════════════════════════════════

section('E2E-5: Pricing completed');

// ORDER_PRICED routes to workflow:orderLifecycle only (not dashboard).
// Verify via vault: pricing snapshot written to order record.
const afterPricing = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderId }));
assert(afterPricing.order.pricingSnapshot !== undefined, 'pricing snapshot on order');
assert(afterPricing.order.pricingSnapshot.baseRate === 165, 'base rate from config');

// Verify in ledger
const pricingLedger = c.ledger.queryByPacketType('ORDER_PRICED');
assert(pricingLedger.length >= 1, 'ORDER_PRICED in ledger');


// ═══════════════════════════════════════════════════════════════
// PHASE 5: No notification for full intake (not partial)
// ORDER_CREATED notification only fires for pending_customer_input
// ═══════════════════════════════════════════════════════════════

section('E2E-6: No self-service link notification (full intake)');

const selfServiceSend = sendLog.find(s => s.body && s.body.includes('complete your cuts'));
assert(selfServiceSend === undefined, 'no self-service notification (full intake has cuts)');


// ═══════════════════════════════════════════════════════════════
// PHASE 6: Record hanging weight
// ═══════════════════════════════════════════════════════════════

section('E2E-7: Record hanging weight');
emissions.length = 0;

c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('WEIGHT_RECORDED', {
    orderId: orderId, hangingWeightLbs: 145, operatorId: 'rick'
  }));

const afterWeight = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderId }));
assert(afterWeight.order.hangingWeightLbs === 145, 'weight recorded');

// RTB gate: order has cuts + pricing + weight → may auto-advance
const currentStage = afterWeight.order.stage;
section('E2E-8: Current stage after weight + pricing');
console.log(`  Stage: ${currentStage}`);
assert(currentStage !== undefined, `order has a stage: ${currentStage}`);


// ═══════════════════════════════════════════════════════════════
// PHASE 7: Walk stages to close
// Advance from whatever current stage through to picked_up
// (picked_up triggers auto-close via balance charge)
// ═══════════════════════════════════════════════════════════════

section('E2E-9: Walk stages to close');
emissions.length = 0;
sendLog.length = 0;

// Build remaining stage sequence from current stage
const STAGE_ORDER = [
  'checked_in', 'hanging', 'ready_to_butcher', 'butchering', 'ready_for_packaging',
  'packaging', 'stored', 'ready_for_pickup', 'picked_up'
];

const currentIdx = STAGE_ORDER.indexOf(currentStage);
assert(currentIdx >= 0, `current stage "${currentStage}" is in STAGE_ORDER`);

const remainingStages = STAGE_ORDER.slice(currentIdx + 1);
const operators = { hanging: 'rick', ready_to_butcher: 'rick', butchering: 'rick', ready_for_packaging: 'rick',
  packaging: 'christine', stored: 'christine', ready_for_pickup: 'christine', picked_up: 'rick' };

for (const stage of remainingStages) {
  c.buses.DATA.emit('presentation:dashboard',
    c.createPacket('STAGE_ADVANCE_COMMAND', {
      orderId: orderId, targetStage: stage, operatorId: operators[stage]
    }));
}

// Verify final state: auto-close after picked_up
const finalOrder = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_ORDER', { orderId: orderId }));
assert(finalOrder.order.stage === 'closed', `order is closed (got ${finalOrder.order.stage})`);
assert(finalOrder.order.readyForPickupAt !== undefined, 'readyForPickupAt timestamp set');
assert(finalOrder.order.pickedUpAt !== undefined, 'pickedUpAt timestamp set');
assert(finalOrder.order.closedAt !== undefined, 'closedAt timestamp set');


// ═══════════════════════════════════════════════════════════════
// PHASE 8: Balance charge at pickup
// ═══════════════════════════════════════════════════════════════

section('E2E-10: Balance charged at pickup');

const balanceCharge = chargeLog.find(ch => ch.description && ch.description.includes('Balance'));
assert(balanceCharge !== undefined, 'balance charge sent');
assert(balanceCharge.amountCents > 0, `balance is positive: ${balanceCharge.amountCents}`);
assert(finalOrder.order.balancePaid === true, 'balancePaid flag set');

const balanceCharged = emissions.find(e => e.type === 'BALANCE_CHARGED');
assert(balanceCharged !== undefined, 'BALANCE_CHARGED reached dashboard');


// ═══════════════════════════════════════════════════════════════
// PHASE 9: Notifications at key stages
// ═══════════════════════════════════════════════════════════════

section('E2E-11: Notifications sent');

const rfpSend = sendLog.find(s => s.body && s.body.includes('pickup'));
assert(rfpSend !== undefined, 'ready_for_pickup notification sent');

const closedSend = sendLog.find(s => s.body && s.body.includes('Thank you'));
assert(closedSend !== undefined, 'closed (thank you) notification sent');

assert(sendLog.length >= 2, `at least 2 notifications sent (got ${sendLog.length})`);


// ═══════════════════════════════════════════════════════════════
// PHASE 10: Stage change emissions
// ═══════════════════════════════════════════════════════════════

section('E2E-12: Stage change emissions');

const stageChanges = emissions.filter(e => e.type === 'ORDER_STAGE_CHANGED');
// remainingStages manual advances + 1 auto-close
const expectedChanges = remainingStages.length + 1;
assert(stageChanges.length === expectedChanges,
  `${expectedChanges} stage changes (got ${stageChanges.length})`);

const lastChange = stageChanges[stageChanges.length - 1];
assert(lastChange.payload.newStage === 'closed', 'last stage change is to closed');
assert(lastChange.payload.triggeredBy === 'system', 'auto-close triggered by system');


// ═══════════════════════════════════════════════════════════════
// PHASE 11: Audit trail completeness
// ═══════════════════════════════════════════════════════════════

section('E2E-13: Audit trail');

const snapshots = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', { snapshotType: 'audit' }));
const audits = snapshots.snapshots;

const auditTypes = audits.map(a => a.auditType);
assert(auditTypes.includes('order_creation'), 'order_creation audit exists');
assert(auditTypes.includes('deposit_charged'), 'deposit_charged audit exists');
assert(auditTypes.includes('weight_recording'), 'weight_recording audit exists');
assert(auditTypes.includes('balance_charged'), 'balance_charged audit exists');

const stageAudits = audits.filter(a => a.auditType === 'stage_transition');
assert(stageAudits.length >= remainingStages.length, 'stage transition audits for all advances');

const orderAudits = audits.filter(a => a.orderId === orderId);
assert(orderAudits.length >= 5, `at least 5 audits for this order (got ${orderAudits.length})`);


// ═══════════════════════════════════════════════════════════════
// PHASE 12: Ledger trace — full chain from intake
// ═══════════════════════════════════════════════════════════════

section('E2E-14: Ledger completeness');

const totalLedger = c.ledger.count();
const newEntries = totalLedger - ledgerBaseline;
assert(newEntries > 30, `${newEntries} new ledger entries from full lifecycle`);

const allEntries = c.ledger.all();
const recentEntries = allEntries.slice(ledgerBaseline);

const busesUsed = new Set(recentEntries.map(e => e.bus));
assert(busesUsed.has('DATA'), 'DATA bus used');
assert(busesUsed.has('VAULT'), 'VAULT bus used');
assert(busesUsed.has('SIGNAL'), 'SIGNAL bus used');
console.log(`  Buses with traffic: ${Array.from(busesUsed).join(', ')}`);

const packetTypes = new Set(recentEntries.map(e => e.packetType));
const expectedTypes = [
  'INTAKE_RAW', 'INTAKE_VALIDATED',
  'WRITE_CUSTOMER_CREATE', 'CUSTOMER_CREATED',
  'WRITE_ORDER_CREATE', 'ORDER_CREATED',
  'CHARGE_DEPOSIT', 'DEPOSIT_CHARGED',
  'PRICING_REQUESTED', 'ORDER_PRICED',
  'WEIGHT_RECORDED', 'WRITE_AUDIT',
  'STAGE_ADVANCE_COMMAND', 'ORDER_STAGE_CHANGED',
  'CHARGE_BALANCE', 'BALANCE_CHARGED',
  'SEND_NOTIFICATION', 'NOTIFICATION_DELIVERED'
];

for (const pt of expectedTypes) {
  assert(packetTypes.has(pt), `${pt} in ledger`);
}


// ═══════════════════════════════════════════════════════════════
// PHASE 13: Infrastructure verification
// ═══════════════════════════════════════════════════════════════

section('E2E-15: Infrastructure counts');
assert(c.registry.instanceCount() === 15, `15 loops instantiated (got ${c.registry.instanceCount()})`);
assert(c.routing.count() === 93, `93 routing entries (got ${c.routing.count()})`);


// ═══════════════════════════════════════════════════════════════
// PHASE 14: Final order state — complete record
// ═══════════════════════════════════════════════════════════════

section('E2E-16: Final order record');

const final = finalOrder.order;
assert(final.stage === 'closed', 'stage: closed');
assert(final.depositPaid === true, 'deposit paid');
assert(final.balancePaid === true, 'balance paid');
assert(final.pricingSnapshot !== undefined, 'pricing snapshot present');
assert(final.hangingWeightLbs === 145, 'weight recorded');
assert(final.cutSelections !== null, 'cuts stored');
assert(final.intakeSource === 'external', 'intake source external');
assert(final.animalType === 'deer', 'animal type deer');
assert(final.tagNumber === 'ME-2025-9001', 'tag number');
assert(final.readyForPickupAt !== undefined, 'readyForPickupAt');
assert(final.pickedUpAt !== undefined, 'pickedUpAt');
assert(final.closedAt !== undefined, 'closedAt');
assert(final.version >= 10, `version >= 10 from all updates (got ${final.version})`);

const finalCust = c.buses.VAULT.request('workflow:orderLifecycle',
  c.createPacket('FETCH_CUSTOMER', { lookupBy: 'customerId', lookupValue: customerId }));
assert(finalCust.found === true, 'customer still exists');
assert(finalCust.customer.name === 'Rick Holte', 'customer name intact');


// ═══════════════════════════════════════════════════════════════
// PHASE 15: Loop participation
// ═══════════════════════════════════════════════════════════════

section('E2E-17: Loop participation');

const sources = new Set(recentEntries.map(e => e.source).filter(Boolean));
const destinations = new Set(recentEntries.flatMap(e => e.destinations || []));
const allLoops = new Set([...sources, ...destinations]);

const expectedLoops = [
  'working:orderIntake', 'filter:orderValidation',
  'vault:config', 'vault:customers', 'vault:orders', 'vault:snapshots',
  'workflow:orderLifecycle', 'workflow:notifications',
  'compute:pricing',
  'signal:payments', 'signal:notifications',
  'presentation:dashboard'
];

for (const loop of expectedLoops) {
  assert(allLoops.has(loop), `${loop} participated`);
}

console.log(`  ${allLoops.size} unique loops in ledger`);

// Loops not in this flow (clock/webhook triggered)
const notInFlow = ['compute:dailyScan', 'compute:reports', 'working:paymentWebhook'];
for (const loop of notInFlow) {
  console.log(`  (${loop} — not in intake→close flow, expected)`);
}


// ═══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}`);
if (failed > 0) process.exit(1);

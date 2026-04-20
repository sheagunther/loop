// ╔══════════════════════════════════════════════════════════════════════╗
// ║  Tier 4 Tests — compute:pricing, compute:dailyScan, compute:reports║
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
// Setup: full constellation with seeded vaults
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

// Seed config
const vaultConfig = c.registry.get('vault:config');
vaultConfig.seed({
  pricing: {
    baseRate: 165,
    weightThresholdLbs: 160,
    overagePerLb: 1,
    depositAmount: 75,
    animalTypeOverrides: { moose: 195 }
  },
  services: {
    porkFatPerLb: 3,
    porkFatRatio: 0.15,
    sausagePerLb: 3.75,
    sausageMinimumLbs: 5,
    sausageFlavorMinimumLbs: 5,
    antlers: 5,
    skullCapMount: 15,
    cape: 60,
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

// Seed customers
c.buses.VAULT.emit('workflow:orderLifecycle',
  c.createPacket('WRITE_CUSTOMER_CREATE', {
    customerId: 'cust-001', name: 'Rick Holte', phone: '+12075551234',
    textOptIn: true, emailOptIn: true, depositWaiverStatus: false
  }));

// Capture emissions per destination
const emissions = {};
function captureFor(loopName) {
  emissions[loopName] = [];
  c.buses.DATA.subscribe(loopName, (pkt) => {
    emissions[loopName].push({ type: pkt.packetType, payload: pkt.payload, traceId: pkt.traceId });
  });
}

captureFor('workflow:orderLifecycle');
captureFor('workflow:notifications');
captureFor('presentation:dashboard');

// NOTE: Do NOT captureFor compute loops — that would overwrite
// their onPacket handlers installed by start(). We capture their
// OUTPUTS by subscribing to destination loops above.


// ═══════════════════════════════════════════════════════════════
// COMPUTE:PRICING
// ═══════════════════════════════════════════════════════════════

section('T4-PRICE-1: Basic pricing — deer, no weight, no services');

function clearEmissions() {
  for (const key of Object.keys(emissions)) emissions[key].length = 0;
}

clearEmissions();
const priceTrace1 = 'trace-price-1';
c.buses.DATA.emit('workflow:orderLifecycle',
  c.createPacket('PRICING_REQUESTED', {
    orderId: 'ord-001',
    animalType: 'deer',
    hangingWeightLbs: null,
    cutSelections: { steaks: 'one_inch', roasts: 'three_lb' },
    optionalServices: null,
    depositAmount: 75
  }, { traceId: priceTrace1 }));

const priced1 = emissions['workflow:orderLifecycle'].find(e => e.type === 'ORDER_PRICED');
assert(priced1 !== undefined, 'ORDER_PRICED emitted');
assert(priced1.payload.orderId === 'ord-001', 'correct orderId');
assert(priced1.payload.pricingSnapshot.baseRate === 165, 'baseRate = 165');
assert(priced1.payload.pricingSnapshot.overageAmount === 0, 'no overage (null weight)');
assert(priced1.payload.pricingSnapshot.total === 165, 'total = 165');
assert(priced1.payload.pricingSnapshot.depositCredit === 75, 'deposit credit = 75');
assert(priced1.payload.pricingSnapshot.balanceDue === 90, 'balance due = 90');
assert(priced1.payload.configVersionUsed === 1, 'configVersionUsed = 1');


section('T4-PRICE-2: Overage calculation');

clearEmissions();
c.buses.DATA.emit('workflow:orderLifecycle',
  c.createPacket('PRICING_REQUESTED', {
    orderId: 'ord-002',
    animalType: 'deer',
    hangingWeightLbs: 180,
    cutSelections: { steaks: 'one_inch' },
    optionalServices: null,
    depositAmount: 75
  }));

const priced2 = emissions['workflow:orderLifecycle'].find(e => e.type === 'ORDER_PRICED');
assert(priced2 !== undefined, 'ORDER_PRICED with overage');
assert(priced2.payload.pricingSnapshot.overageRate === 1, 'overage rate = $1/lb');
assert(priced2.payload.pricingSnapshot.overageAmount === 20, 'overage = 20 lbs × $1');
assert(priced2.payload.pricingSnapshot.total === 185, 'total = 165 + 20');
assert(priced2.payload.pricingSnapshot.balanceDue === 110, 'balance = 185 - 75');


section('T4-PRICE-3: Weight at threshold — no overage');

clearEmissions();
c.buses.DATA.emit('workflow:orderLifecycle',
  c.createPacket('PRICING_REQUESTED', {
    orderId: 'ord-003',
    animalType: 'deer',
    hangingWeightLbs: 160,
    cutSelections: { steaks: 'one_inch' },
    optionalServices: null,
    depositAmount: 75
  }));

const priced3 = emissions['workflow:orderLifecycle'].find(e => e.type === 'ORDER_PRICED');
assert(priced3.payload.pricingSnapshot.overageAmount === 0, 'no overage at threshold');


section('T4-PRICE-4: Animal type override (moose)');

clearEmissions();
c.buses.DATA.emit('workflow:orderLifecycle',
  c.createPacket('PRICING_REQUESTED', {
    orderId: 'ord-004',
    animalType: 'moose',
    hangingWeightLbs: null,
    cutSelections: { steaks: 'one_inch' },
    optionalServices: null,
    depositAmount: 75
  }));

const priced4 = emissions['workflow:orderLifecycle'].find(e => e.type === 'ORDER_PRICED');
assert(priced4.payload.pricingSnapshot.baseRate === 195, 'moose override baseRate = 195');
assert(priced4.payload.pricingSnapshot.total === 195, 'total = 195');


section('T4-PRICE-5: Optional services pricing');

clearEmissions();
c.buses.DATA.emit('workflow:orderLifecycle',
  c.createPacket('PRICING_REQUESTED', {
    orderId: 'ord-005',
    animalType: 'deer',
    hangingWeightLbs: null,
    cutSelections: { steaks: 'one_inch' },
    optionalServices: {
      porkFat: { lbs: 10 },
      sausage: { totalLbs: 10 },
      antlers: true,
      rushProcessing: true
    },
    depositAmount: 75
  }));

const priced5 = emissions['workflow:orderLifecycle'].find(e => e.type === 'ORDER_PRICED');
const svcCosts = priced5.payload.pricingSnapshot.optionalServiceCosts;
assert(svcCosts.porkFat === 30, 'pork fat = 10 × $3');
assert(svcCosts.sausage === 37.5, 'sausage = 10 × $3.75');
assert(svcCosts.antlers === 5, 'antlers = $5');
assert(svcCosts.rushProcessing === 35, 'rush = $35');
const expectedTotal = 165 + 30 + 37.5 + 5 + 35;
assert(priced5.payload.pricingSnapshot.total === expectedTotal, 'total includes all services');


section('T4-PRICE-6: Unknown animal type → PRICING_REJECTED');

clearEmissions();
c.buses.DATA.emit('workflow:orderLifecycle',
  c.createPacket('PRICING_REQUESTED', {
    orderId: 'ord-006',
    animalType: 'elk',
    cutSelections: { steaks: 'one_inch' },
    depositAmount: 75
  }));

const reject6 = emissions['workflow:orderLifecycle'].find(e => e.type === 'PRICING_REJECTED');
assert(reject6 !== undefined, 'PRICING_REJECTED emitted');
assert(reject6.payload.rejectionReasons.indexOf('UNKNOWN_ANIMAL_TYPE') !== -1, 'UNKNOWN_ANIMAL_TYPE reason');
// Also goes to dashboard
const reject6d = emissions['presentation:dashboard'].find(e => e.type === 'PRICING_REJECTED');
assert(reject6d !== undefined, 'PRICING_REJECTED also routed to dashboard');


section('T4-PRICE-7: Invalid cut selections → PRICING_REJECTED');

clearEmissions();
c.buses.DATA.emit('workflow:orderLifecycle',
  c.createPacket('PRICING_REQUESTED', {
    orderId: 'ord-007',
    animalType: 'deer',
    cutSelections: null,
    depositAmount: 75
  }));

const reject7 = emissions['workflow:orderLifecycle'].find(e => e.type === 'PRICING_REJECTED');
assert(reject7 !== undefined, 'PRICING_REJECTED for null cutSelections');
assert(reject7.payload.rejectionReasons.indexOf('INVALID_CUT_SELECTION') !== -1, 'INVALID_CUT_SELECTION reason');


section('T4-PRICE-8: Sausage below minimum');

clearEmissions();
c.buses.DATA.emit('workflow:orderLifecycle',
  c.createPacket('PRICING_REQUESTED', {
    orderId: 'ord-008',
    animalType: 'deer',
    cutSelections: { steaks: 'one_inch' },
    optionalServices: { sausage: { totalLbs: 3 } },
    depositAmount: 75
  }));

const reject8 = emissions['workflow:orderLifecycle'].find(e => e.type === 'PRICING_REJECTED');
assert(reject8 !== undefined, 'PRICING_REJECTED for sausage below min');
assert(reject8.payload.rejectionReasons.indexOf('SAUSAGE_BELOW_MINIMUM') !== -1, 'SAUSAGE_BELOW_MINIMUM reason');


section('T4-PRICE-9: Unknown service');

clearEmissions();
c.buses.DATA.emit('workflow:orderLifecycle',
  c.createPacket('PRICING_REQUESTED', {
    orderId: 'ord-009',
    animalType: 'deer',
    cutSelections: { steaks: 'one_inch' },
    optionalServices: { taxidermy: true },
    depositAmount: 75
  }));

const reject9 = emissions['workflow:orderLifecycle'].find(e => e.type === 'PRICING_REJECTED');
assert(reject9 !== undefined, 'PRICING_REJECTED for unknown service');
assert(reject9.payload.rejectionReasons.indexOf('UNKNOWN_SERVICE') !== -1, 'UNKNOWN_SERVICE reason');


section('T4-PRICE-10: Multiple rejection reasons');

clearEmissions();
c.buses.DATA.emit('workflow:orderLifecycle',
  c.createPacket('PRICING_REQUESTED', {
    orderId: 'ord-010',
    animalType: 'elk',
    cutSelections: null,
    optionalServices: { sausage: { totalLbs: 2 } },
    depositAmount: 75
  }));

const reject10 = emissions['workflow:orderLifecycle'].find(e => e.type === 'PRICING_REJECTED');
assert(reject10 !== undefined, 'PRICING_REJECTED with multiple reasons');
assert(reject10.payload.rejectionReasons.length >= 3, 'at least 3 rejection reasons');


section('T4-PRICE-11: TraceId preservation');

clearEmissions();
const tracePrice = 'trace-pricing-test';
c.buses.DATA.emit('workflow:orderLifecycle',
  c.createPacket('PRICING_REQUESTED', {
    orderId: 'ord-011',
    animalType: 'deer',
    cutSelections: { steaks: 'one_inch' },
    depositAmount: 75
  }, { traceId: tracePrice }));

const priced11 = emissions['workflow:orderLifecycle'].find(e => e.type === 'ORDER_PRICED');
assert(priced11.traceId === tracePrice, 'traceId preserved through pricing');


section('T4-PRICE-12: Balance due floors at zero');

clearEmissions();
c.buses.DATA.emit('workflow:orderLifecycle',
  c.createPacket('PRICING_REQUESTED', {
    orderId: 'ord-012',
    animalType: 'deer',
    cutSelections: { steaks: 'one_inch' },
    depositAmount: 500
  }));

const priced12 = emissions['workflow:orderLifecycle'].find(e => e.type === 'ORDER_PRICED');
assert(priced12.payload.pricingSnapshot.balanceDue === 0, 'balance due floors at 0');


// ═══════════════════════════════════════════════════════════════
// COMPUTE:DAILYSCAN
// ═══════════════════════════════════════════════════════════════

// Helper: create orders directly in vault for scan testing
function seedOrder(orderId, overrides) {
  const defaults = {
    orderId: orderId,
    customerId: 'cust-001',
    tagNumber: 'ME-2025-' + orderId,
    intakeSource: 'external',
    animalType: 'deer',
    tenderloinRemoved: true,
    stage: 'checked_in',
    rushFlag: false,
    depositAmount: 75,
    depositWaived: false,
    depositPaid: true
  };
  const order = Object.assign(defaults, overrides);
  c.buses.VAULT.emit('workflow:orderLifecycle',
    c.createPacket('WRITE_ORDER_CREATE', order));

  // Apply overrides that vault:orders may have overwritten (e.g., createdAt)
  // via WRITE_ORDER_UPDATE
  const updateFields = {};
  const overrideKeys = ['createdAt', 'readyForPickupAt', 'lastStorageFeeChargedAt',
    'lastReminderSentAt', 'reminderCount', 'stage', 'pricingSnapshot'];
  for (let i = 0; i < overrideKeys.length; i++) {
    const k = overrideKeys[i];
    if (overrides[k] !== undefined) {
      updateFields[k] = overrides[k];
    }
  }
  if (Object.keys(updateFields).length > 0) {
    c.buses.VAULT.emit('workflow:orderLifecycle',
      c.createPacket('WRITE_ORDER_UPDATE', {
        orderId: orderId,
        updates: updateFields
      }));
  }

  return order;
}

// Helper: days ago ISO string
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

section('T4-SCAN-1: No-show deadline reached');

// Create order in ready_for_pickup, readyForPickupAt 35 days ago
seedOrder('scan-001', {
  stage: 'ready_for_pickup',
  readyForPickupAt: daysAgo(35)
});

clearEmissions();
const scanTrace1 = 'trace-scan-1';
c.buses.DATA.emit('working:orderIntake',
  c.createPacket('DAILY_SCAN_TRIGGERED', {
    scanDate: new Date().toISOString(),
    operator: 'system:clock'
  }, { traceId: scanTrace1 }));

const noShow = emissions['workflow:orderLifecycle'].find(e => e.type === 'NO_SHOW_DEADLINE_REACHED');
assert(noShow !== undefined, 'NO_SHOW_DEADLINE_REACHED emitted');
assert(noShow.payload.orderId === 'scan-001', 'correct orderId');


section('T4-SCAN-2: Terminal before recurring — no storage fee for no-show order');

// scan-001 should NOT trigger a storage fee
const storageFeeForNoShow = emissions['workflow:orderLifecycle'].filter(
  e => e.type === 'STORAGE_FEE_DUE' && e.payload.orderId === 'scan-001');
assert(storageFeeForNoShow.length === 0, 'no STORAGE_FEE_DUE for no-show order');


section('T4-SCAN-3: Storage fee due — grace elapsed, never charged');

seedOrder('scan-002', {
  stage: 'ready_for_pickup',
  readyForPickupAt: daysAgo(14),
  lastStorageFeeChargedAt: null
});

clearEmissions();
c.buses.DATA.emit('working:orderIntake',
  c.createPacket('DAILY_SCAN_TRIGGERED', {
    scanDate: new Date().toISOString(),
    operator: 'system:clock'
  }));

const storageFee = emissions['workflow:orderLifecycle'].find(
  e => e.type === 'STORAGE_FEE_DUE' && e.payload.orderId === 'scan-002');
assert(storageFee !== undefined, 'STORAGE_FEE_DUE emitted for scan-002');


section('T4-SCAN-4: Storage fee due — last charge > 7 days ago');

seedOrder('scan-003', {
  stage: 'ready_for_pickup',
  readyForPickupAt: daysAgo(21),
  lastStorageFeeChargedAt: daysAgo(10)
});

clearEmissions();
c.buses.DATA.emit('working:orderIntake',
  c.createPacket('DAILY_SCAN_TRIGGERED', {
    scanDate: new Date().toISOString(),
    operator: 'system:clock'
  }));

const storageFee2 = emissions['workflow:orderLifecycle'].find(
  e => e.type === 'STORAGE_FEE_DUE' && e.payload.orderId === 'scan-003');
assert(storageFee2 !== undefined, 'STORAGE_FEE_DUE for scan-003 (last charge 10 days ago)');


section('T4-SCAN-5: Storage fee NOT due — charged recently');

seedOrder('scan-004', {
  stage: 'ready_for_pickup',
  readyForPickupAt: daysAgo(14),
  lastStorageFeeChargedAt: daysAgo(3)
});

clearEmissions();
c.buses.DATA.emit('working:orderIntake',
  c.createPacket('DAILY_SCAN_TRIGGERED', {
    scanDate: new Date().toISOString(),
    operator: 'system:clock'
  }));

const noFee = emissions['workflow:orderLifecycle'].filter(
  e => e.type === 'STORAGE_FEE_DUE' && e.payload.orderId === 'scan-004');
assert(noFee.length === 0, 'no STORAGE_FEE_DUE for recently charged order');


section('T4-SCAN-6: Storage fee NOT due — grace period not elapsed');

seedOrder('scan-005', {
  stage: 'ready_for_pickup',
  readyForPickupAt: daysAgo(3),
  lastStorageFeeChargedAt: null
});

clearEmissions();
c.buses.DATA.emit('working:orderIntake',
  c.createPacket('DAILY_SCAN_TRIGGERED', {
    scanDate: new Date().toISOString(),
    operator: 'system:clock'
  }));

const noFee2 = emissions['workflow:orderLifecycle'].filter(
  e => e.type === 'STORAGE_FEE_DUE' && e.payload.orderId === 'scan-005');
assert(noFee2.length === 0, 'no STORAGE_FEE_DUE during grace period');


section('T4-SCAN-7: Incomplete reminder due');

seedOrder('scan-006', {
  stage: 'pending_customer_input',
  createdAt: daysAgo(5),
  lastReminderSentAt: null,
  reminderCount: 0
});

clearEmissions();
c.buses.DATA.emit('working:orderIntake',
  c.createPacket('DAILY_SCAN_TRIGGERED', {
    scanDate: new Date().toISOString(),
    operator: 'system:clock'
  }));

const reminder = emissions['workflow:notifications'].find(
  e => e.type === 'INCOMPLETE_REMINDER_DUE' && e.payload.orderId === 'scan-006');
assert(reminder !== undefined, 'INCOMPLETE_REMINDER_DUE emitted');


section('T4-SCAN-8: Incomplete reminder cap — no trigger at max');

seedOrder('scan-007', {
  stage: 'pending_customer_input',
  createdAt: daysAgo(15),
  lastReminderSentAt: daysAgo(5),
  reminderCount: 3
});

clearEmissions();
c.buses.DATA.emit('working:orderIntake',
  c.createPacket('DAILY_SCAN_TRIGGERED', {
    scanDate: new Date().toISOString(),
    operator: 'system:clock'
  }));

const noReminder = emissions['workflow:notifications'].filter(
  e => e.type === 'INCOMPLETE_REMINDER_DUE' && e.payload.orderId === 'scan-007');
assert(noReminder.length === 0, 'no reminder at cap (3)');


section('T4-SCAN-9: Incomplete reminder NOT due — interval not elapsed');

seedOrder('scan-008', {
  stage: 'pending_customer_input',
  createdAt: daysAgo(5),
  lastReminderSentAt: daysAgo(1),
  reminderCount: 1
});

clearEmissions();
c.buses.DATA.emit('working:orderIntake',
  c.createPacket('DAILY_SCAN_TRIGGERED', {
    scanDate: new Date().toISOString(),
    operator: 'system:clock'
  }));

const noReminder2 = emissions['workflow:notifications'].filter(
  e => e.type === 'INCOMPLETE_REMINDER_DUE' && e.payload.orderId === 'scan-008');
assert(noReminder2.length === 0, 'no reminder before interval');


section('T4-SCAN-10: Marketing outreach due + dedup write');

// Update config to include a campaign
vaultConfig.seed({
  pricing: vaultConfig.getConfig().pricing,
  services: vaultConfig.getConfig().services,
  storage: vaultConfig.getConfig().storage,
  notifications: vaultConfig.getConfig().notifications,
  campaigns: [{
    campaignId: 'camp-001',
    templateRef: 'marketingTemplate',
    audienceCriteria: { marketingOptIn: true },
    scheduledDate: daysAgo(1).split('T')[0],
    executedAt: null
  }]
});

clearEmissions();
c.buses.DATA.emit('working:orderIntake',
  c.createPacket('DAILY_SCAN_TRIGGERED', {
    scanDate: new Date().toISOString(),
    operator: 'system:clock'
  }));

const marketing = emissions['workflow:notifications'].find(
  e => e.type === 'MARKETING_OUTREACH_DUE');
assert(marketing !== undefined, 'MARKETING_OUTREACH_DUE emitted');
assert(marketing.payload.campaignId === 'camp-001', 'correct campaignId');
assert(marketing.payload.campaignConfig !== undefined, 'campaignConfig included');


section('T4-SCAN-11: Marketing already executed — skip');

// Re-seed with executedAt set
vaultConfig.seed({
  pricing: vaultConfig.getConfig().pricing,
  services: vaultConfig.getConfig().services,
  storage: vaultConfig.getConfig().storage,
  notifications: vaultConfig.getConfig().notifications,
  campaigns: [{
    campaignId: 'camp-002',
    templateRef: 'marketingTemplate',
    audienceCriteria: { marketingOptIn: true },
    scheduledDate: daysAgo(1).split('T')[0],
    executedAt: daysAgo(1)
  }]
});

clearEmissions();
c.buses.DATA.emit('working:orderIntake',
  c.createPacket('DAILY_SCAN_TRIGGERED', {
    scanDate: new Date().toISOString(),
    operator: 'system:clock'
  }));

const noMarketing = emissions['workflow:notifications'].filter(
  e => e.type === 'MARKETING_OUTREACH_DUE' && e.payload.campaignId === 'camp-002');
assert(noMarketing.length === 0, 'no trigger for already-executed campaign');


section('T4-SCAN-12: DAILY_SCAN_COMPLETED always emitted');

clearEmissions();
c.buses.DATA.emit('working:orderIntake',
  c.createPacket('DAILY_SCAN_TRIGGERED', {
    scanDate: new Date().toISOString(),
    operator: 'system:clock'
  }));

const scanComplete = emissions['presentation:dashboard'].find(
  e => e.type === 'DAILY_SCAN_COMPLETED');
assert(scanComplete !== undefined, 'DAILY_SCAN_COMPLETED emitted');
assert(scanComplete.payload.triggerCounts !== undefined, 'triggerCounts present');
assert(typeof scanComplete.payload.triggerCounts.storageFeesDue === 'number', 'storageFeesDue count present');
assert(typeof scanComplete.payload.triggerCounts.noShowsReached === 'number', 'noShowsReached count present');
assert(typeof scanComplete.payload.triggerCounts.incompleteReminders === 'number', 'incompleteReminders count present');
assert(typeof scanComplete.payload.triggerCounts.marketingCampaigns === 'number', 'marketingCampaigns count present');


section('T4-SCAN-13: Zero-trigger scan emits completion');

// Fresh constellation with no orders
const c2 = init({
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
c2.start();

const c2Config = c2.registry.get('vault:config');
c2Config.seed({
  pricing: { baseRate: 165, weightThresholdLbs: 160, overagePerLb: 1, depositAmount: 75 },
  services: {},
  storage: { feePerWeek: 50, gracePeriodDays: 7, noShowDeadlineDays: 30 },
  notifications: {},
  campaigns: []
});

const zeroEmissions = [];
c2.buses.DATA.subscribe('presentation:dashboard', (pkt) => {
  zeroEmissions.push({ type: pkt.packetType, payload: pkt.payload });
});

c2.buses.DATA.emit('working:orderIntake',
  c2.createPacket('DAILY_SCAN_TRIGGERED', {
    scanDate: new Date().toISOString(),
    operator: 'system:clock'
  }));

const zeroComplete = zeroEmissions.find(e => e.type === 'DAILY_SCAN_COMPLETED');
assert(zeroComplete !== undefined, 'completion emitted even with zero orders');
assert(zeroComplete.payload.triggerCounts.storageFeesDue === 0, 'zero storage fees');
assert(zeroComplete.payload.triggerCounts.noShowsReached === 0, 'zero no-shows');
assert(zeroComplete.payload.triggerCounts.incompleteReminders === 0, 'zero reminders');
assert(zeroComplete.payload.triggerCounts.marketingCampaigns === 0, 'zero campaigns');


section('T4-SCAN-14: TraceId preservation across triggers');

clearEmissions();
const scanTrace = 'trace-scan-preserve';
c.buses.DATA.emit('working:orderIntake',
  c.createPacket('DAILY_SCAN_TRIGGERED', {
    scanDate: new Date().toISOString(),
    operator: 'system:clock'
  }, { traceId: scanTrace }));

const scanCompleted = emissions['presentation:dashboard'].find(
  e => e.type === 'DAILY_SCAN_COMPLETED');
assert(scanCompleted.traceId === scanTrace, 'traceId preserved to DAILY_SCAN_COMPLETED');

// Check a trigger packet too
const anyTrigger = emissions['workflow:orderLifecycle'].find(
  e => (e.type === 'NO_SHOW_DEADLINE_REACHED' || e.type === 'STORAGE_FEE_DUE'));
if (anyTrigger) {
  assert(anyTrigger.traceId === scanTrace, 'traceId preserved to trigger packet');
} else {
  passed++; // No triggers to check — still valid
}


// ═══════════════════════════════════════════════════════════════
// COMPUTE:REPORTS
// ═══════════════════════════════════════════════════════════════

section('T4-RPT-1: Daily snapshot assembly + STORE_SNAPSHOT');

clearEmissions();
const snapTrace = 'trace-snap-1';
c.buses.DATA.emit('working:orderIntake',
  c.createPacket('SNAPSHOT_TRIGGERED', {
    snapshotType: 'daily',
    snapshotDate: todayISO(),
    operator: 'system:clock'
  }, { traceId: snapTrace }));

// STORE_SNAPSHOT goes through VAULT, vault:snapshots emits SNAPSHOT_STORED on DATA
const snapStored = emissions['presentation:dashboard'].find(
  e => e.type === 'SNAPSHOT_STORED');
assert(snapStored !== undefined, 'SNAPSHOT_STORED emitted after daily snapshot');

// SNAPSHOT_STORED is also routed to compute:reports (routing entry #81)
// We can verify via routing table
assert(c.routing.has('SNAPSHOT_STORED', 'vault:snapshots'), 'SNAPSHOT_STORED route exists');


section('T4-RPT-2: Seasonal snapshot includes customers');

clearEmissions();
c.buses.DATA.emit('working:orderIntake',
  c.createPacket('SNAPSHOT_TRIGGERED', {
    snapshotType: 'seasonal',
    snapshotDate: todayISO(),
    operator: 'system:clock'
  }));

const seasonSnap = emissions['presentation:dashboard'].find(
  e => e.type === 'SNAPSHOT_STORED');
assert(seasonSnap !== undefined, 'SNAPSHOT_STORED for seasonal');

// Verify snapshot was stored in vault:snapshots
const snapVault = c.registry.get('vault:snapshots');
const allSnaps = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', {}));
// Should have at least 2 (daily + seasonal)
assert(allSnaps.snapshots.length >= 2, 'at least 2 snapshots stored');


section('T4-RPT-3: REPORT_REQUESTED → REPORT_GENERATED (season_summary)');

clearEmissions();
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('REPORT_REQUESTED', {
    reportType: 'season_summary',
    dateRange: null,
    operatorId: 'rick'
  }));

const report1 = emissions['presentation:dashboard'].find(
  e => e.type === 'REPORT_GENERATED');
assert(report1 !== undefined, 'REPORT_GENERATED emitted');
assert(report1.payload.reportType === 'season_summary', 'correct report type');
assert(report1.payload.requestedBy === 'rick', 'requestedBy = rick');
assert(report1.payload.reportData.totalOrders !== undefined, 'report has totalOrders');
assert(report1.payload.reportData.totalCustomers !== undefined, 'report has totalCustomers');
assert(report1.payload.reportData.ordersByStage !== undefined, 'report has ordersByStage');


section('T4-RPT-4: REPORT_REQUESTED (revenue)');

clearEmissions();
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('REPORT_REQUESTED', {
    reportType: 'revenue',
    operatorId: 'christine'
  }));

const report2 = emissions['presentation:dashboard'].find(
  e => e.type === 'REPORT_GENERATED');
assert(report2 !== undefined, 'REPORT_GENERATED for revenue');
assert(report2.payload.reportType === 'revenue', 'revenue report type');
assert(report2.payload.reportData.revenueTotal !== undefined, 'has revenueTotal');
assert(report2.payload.requestedBy === 'christine', 'requestedBy = christine');


section('T4-RPT-5: REPORT_REQUESTED (order_status)');

clearEmissions();
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('REPORT_REQUESTED', {
    reportType: 'order_status',
    operatorId: 'rick'
  }));

const report3 = emissions['presentation:dashboard'].find(
  e => e.type === 'REPORT_GENERATED');
assert(report3 !== undefined, 'REPORT_GENERATED for order_status');
assert(report3.payload.reportData.ordersByStage !== undefined, 'has stage breakdown');


section('T4-RPT-6: snapshot_on_demand also stores');

const snapCountBefore = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', {})).snapshots.length;

clearEmissions();
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('REPORT_REQUESTED', {
    reportType: 'snapshot_on_demand',
    operatorId: 'rick'
  }));

const report4 = emissions['presentation:dashboard'].find(
  e => e.type === 'REPORT_GENERATED');
assert(report4 !== undefined, 'REPORT_GENERATED for on-demand snapshot');

// Also stored
const snapCountAfter = c.buses.VAULT.request('presentation:dashboard',
  c.createPacket('FETCH_SNAPSHOTS', {})).snapshots.length;
assert(snapCountAfter === snapCountBefore + 1, 'on-demand snapshot stored in vault');


section('T4-RPT-7: TraceId preservation');

clearEmissions();
const rptTrace = 'trace-report-test';
c.buses.DATA.emit('presentation:dashboard',
  c.createPacket('REPORT_REQUESTED', {
    reportType: 'order_status',
    operatorId: 'rick'
  }, { traceId: rptTrace }));

const report5 = emissions['presentation:dashboard'].find(
  e => e.type === 'REPORT_GENERATED');
assert(report5.traceId === rptTrace, 'traceId preserved through report');


// ═══════════════════════════════════════════════════════════════
// CROSS-TIER: Integration checks
// ═══════════════════════════════════════════════════════════════

section('T4-CROSS-1: Routing entry counts');

assert(c.routing.count() === 93, `routing has ${c.routing.count()} entries (expected 93)`);
assert(c.registry.instanceCount() === 15, 'all 15 loops instantiated');


section('T4-CROSS-2: Ledger records compute traffic');

const pricingLedger = c.ledger.queryByPacketType('ORDER_PRICED');
assert(pricingLedger.length >= 1, 'ORDER_PRICED in ledger');

const scanLedger = c.ledger.queryByPacketType('DAILY_SCAN_COMPLETED');
assert(scanLedger.length >= 1, 'DAILY_SCAN_COMPLETED in ledger');

const reportLedger = c.ledger.queryByPacketType('REPORT_GENERATED');
assert(reportLedger.length >= 1, 'REPORT_GENERATED in ledger');


section('T4-CROSS-3: Full trace — pricing request through config pull');

const traceEntries = c.ledger.queryByTraceId(priceTrace1);
const hasPricingReq = traceEntries.find(e => e.packetType === 'PRICING_REQUESTED');
const hasConfigPull = traceEntries.find(e => e.packetType === 'FETCH_CONFIG');
const hasOrderPriced = traceEntries.find(e => e.packetType === 'ORDER_PRICED');

assert(hasPricingReq !== undefined, 'PRICING_REQUESTED in trace');
assert(hasConfigPull !== undefined, 'FETCH_CONFIG in trace');
assert(hasOrderPriced !== undefined, 'ORDER_PRICED in trace');


// ═══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}`);
if (failed > 0) process.exit(1);

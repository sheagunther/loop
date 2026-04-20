// ╔══════════════════════════════════════════════════════════════════════╗
// ║  Tier 3 Tests — Signal Loops                                       ║
// ║  signal:payments, signal:notifications                             ║
// ║  Circuit breaker, charge types, notification delivery               ║
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
// CONFIGURABLE DEPENDENCY GATE STUBS
// ═══════════════════════════════════════════════════════════════

let chargeMode = 'succeed'; // 'succeed' | 'fail' | 'throw'
function createTestPaymentGate() {
  return {
    charge(params) {
      if (chargeMode === 'succeed') {
        return { success: true, chargeId: 'ch_test_' + Math.random().toString(36).substring(7), chargedAt: new Date().toISOString() };
      } else if (chargeMode === 'fail') {
        return { success: false, reason: 'CARD_DECLINED', detail: 'Test decline' };
      } else {
        throw new Error('Stripe connection timeout');
      }
    }
  };
}

let sendMode = 'succeed';
function createTestNotificationGate() {
  return {
    send(params) {
      if (sendMode === 'succeed') {
        return { success: true, providerResponse: 'delivered_ok', attemptNumber: 1 };
      } else if (sendMode === 'fail') {
        return { success: false, reason: 'INVALID_NUMBER', detail: 'Test failure' };
      } else {
        throw new Error('Twilio connection timeout');
      }
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
    'vault:config': makeAdapter(), 'vault:customers': makeAdapter(),
    'vault:orders': makeAdapter(), 'vault:snapshots': makeAdapter()
  },
  gateway: {
    'working:orderIntake': { validateSubmission: () => ({ valid: true, errors: [] }) },
    'working:paymentWebhook': { verifySignature: () => ({ valid: true }) }
  },
  services: {
    'signal:payments': createTestPaymentGate(),
    'signal:notifications': createTestNotificationGate()
  }
});

c.start();

// Capture DATA bus emissions at subscriber destinations
const emissions = [];
for (const dest of ['workflow:orderLifecycle', 'workflow:notifications',
  'presentation:dashboard', 'compute:dailyScan']) {
  c.buses.DATA.subscribe(dest, (pkt) => {
    emissions.push({ dest, type: pkt.packetType, payload: pkt.payload, traceId: pkt.traceId });
  });
}


// ═══════════════════════════════════════════════════════════════
// SIGNAL:PAYMENTS — CHARGE TYPES
// ═══════════════════════════════════════════════════════════════

section('T3-PAY-1: CHARGE_DEPOSIT success');
emissions.length = 0;
chargeMode = 'succeed';

const depositPkt = c.createPacket('CHARGE_DEPOSIT', {
  orderId: 'ord-001', customerId: 'cust-001', amountCents: 7500,
  currency: 'usd', paymentMethodId: 'pm_test', description: 'Deposit — Order ord-001',
  idempotencyKey: 'idem-001'
});
c.buses.SIGNAL.emit('workflow:orderLifecycle', depositPkt);

const depositCharged = emissions.find(e => e.type === 'DEPOSIT_CHARGED');
assert(depositCharged !== undefined, 'DEPOSIT_CHARGED emitted');
assert(depositCharged.payload.orderId === 'ord-001', 'orderId echoed');
assert(depositCharged.payload.amountCents === 7500, 'amountCents echoed');
assert(depositCharged.payload.stripeChargeId !== undefined, 'stripeChargeId present');
assert(depositCharged.payload.chargedAt !== undefined, 'chargedAt present');

section('T3-PAY-2: CHARGE_DEPOSIT failure');
emissions.length = 0;
chargeMode = 'fail';

const depositFail = c.createPacket('CHARGE_DEPOSIT', {
  orderId: 'ord-002', customerId: 'cust-001', amountCents: 7500,
  currency: 'usd', paymentMethodId: 'pm_test', description: 'Deposit — Order ord-002',
  idempotencyKey: 'idem-002'
});
c.buses.SIGNAL.emit('workflow:orderLifecycle', depositFail);

const depositFailed = emissions.find(e => e.type === 'DEPOSIT_FAILED');
assert(depositFailed !== undefined, 'DEPOSIT_FAILED emitted');
assert(depositFailed.payload.failureReason === 'CARD_DECLINED', 'failure reason correct');
assert(depositFailed.payload.orderId === 'ord-002', 'orderId echoed on failure');

section('T3-PAY-3: CHARGE_BALANCE success');
emissions.length = 0;
chargeMode = 'succeed';

const balancePkt = c.createPacket('CHARGE_BALANCE', {
  orderId: 'ord-001', customerId: 'cust-001', amountCents: 9000,
  currency: 'usd', stripeCustomerId: 'cus_stripe_001',
  description: 'Balance — Order ord-001', idempotencyKey: 'idem-003'
});
c.buses.SIGNAL.emit('workflow:orderLifecycle', balancePkt);

const balanceCharged = emissions.find(e => e.type === 'BALANCE_CHARGED');
assert(balanceCharged !== undefined, 'BALANCE_CHARGED emitted');
assert(balanceCharged.payload.amountCents === 9000, 'balance amount correct');

section('T3-PAY-4: CHARGE_STORAGE_FEE success');
emissions.length = 0;
chargeMode = 'succeed';

const storagePkt = c.createPacket('CHARGE_STORAGE_FEE', {
  orderId: 'ord-001', customerId: 'cust-001', amountCents: 5000,
  currency: 'usd', stripeCustomerId: 'cus_stripe_001',
  storageWeekNumber: 2, description: 'Storage Fee Week 2 — Order ord-001',
  idempotencyKey: 'idem-004'
});
c.buses.SIGNAL.emit('workflow:orderLifecycle', storagePkt);

const storageCharged = emissions.find(e => e.type === 'STORAGE_FEE_CHARGED');
assert(storageCharged !== undefined, 'STORAGE_FEE_CHARGED emitted');
assert(storageCharged.payload.storageWeekNumber === 2, 'storageWeekNumber echoed');

section('T3-PAY-5: CHARGE_NOSHOW_BALANCE success');
emissions.length = 0;
chargeMode = 'succeed';

const noshowPkt = c.createPacket('CHARGE_NOSHOW_BALANCE', {
  orderId: 'ord-003', customerId: 'cust-002', amountCents: 12000,
  currency: 'usd', stripeCustomerId: 'cus_stripe_002',
  description: 'No-Show Balance — Order ord-003', idempotencyKey: 'idem-005'
});
c.buses.SIGNAL.emit('workflow:orderLifecycle', noshowPkt);

const noshowCharged = emissions.find(e => e.type === 'NOSHOW_BALANCE_CHARGED');
assert(noshowCharged !== undefined, 'NOSHOW_BALANCE_CHARGED emitted');

section('T3-PAY-6: Dependency Gate throw → FAILED');
emissions.length = 0;
chargeMode = 'throw';

const throwPkt = c.createPacket('CHARGE_DEPOSIT', {
  orderId: 'ord-004', customerId: 'cust-001', amountCents: 7500,
  currency: 'usd', paymentMethodId: 'pm_test', description: 'test',
  idempotencyKey: 'idem-006'
});
c.buses.SIGNAL.emit('workflow:orderLifecycle', throwPkt);

const throwFailed = emissions.find(e => e.type === 'DEPOSIT_FAILED');
assert(throwFailed !== undefined, 'DEPOSIT_FAILED emitted on gate throw');
assert(throwFailed.payload.failureReason === 'STRIPE_ERROR', 'STRIPE_ERROR on throw');

section('T3-PAY-7: TraceId preserved through signal loop');
emissions.length = 0;
chargeMode = 'succeed';

const tracePkt = c.createPacket('CHARGE_BALANCE', {
  orderId: 'ord-001', customerId: 'cust-001', amountCents: 100,
  currency: 'usd', stripeCustomerId: 'cus_stripe_001',
  description: 'test', idempotencyKey: 'idem-007'
});
c.buses.SIGNAL.emit('workflow:orderLifecycle', tracePkt);

const traceResult = emissions.find(e => e.type === 'BALANCE_CHARGED');
assert(traceResult.traceId === tracePkt.traceId, 'traceId preserved through signal loop');


// ═══════════════════════════════════════════════════════════════
// SIGNAL:PAYMENTS — CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════

section('T3-CB-1: Circuit breaker triggers after 3 consecutive failures');
emissions.length = 0;
chargeMode = 'fail';

const signalPayments = c.registry.get('signal:payments');

// Already had failures above: 1 fail (PAY-2) + 1 throw (PAY-6) = 2.
// But PAY-3/4/5/7 succeeded, resetting counter. So counter is 0.
// Need 3 consecutive failures.
for (let i = 0; i < 3; i++) {
  c.buses.SIGNAL.emit('workflow:orderLifecycle',
    c.createPacket('CHARGE_DEPOSIT', {
      orderId: `ord-cb-${i}`, customerId: 'cust-001', amountCents: 7500,
      currency: 'usd', paymentMethodId: 'pm_test',
      description: 'circuit breaker test', idempotencyKey: `idem-cb-${i}`
    }));
}

assert(signalPayments.isDegraded() === true, 'signal:payments is degraded');
assert(signalPayments.consecutiveFailures() === 3, 'consecutive failures = 3');

const degraded = emissions.find(e => e.type === 'PAYMENT_SERVICE_DEGRADED');
assert(degraded !== undefined, 'PAYMENT_SERVICE_DEGRADED emitted');
assert(degraded.payload.service === 'stripe', 'service = stripe');
assert(degraded.payload.failureCount === 3, 'failureCount = 3');
assert(degraded.dest === 'presentation:dashboard', 'degraded alert goes to dashboard');

section('T3-CB-2: Success restores service');
emissions.length = 0;
chargeMode = 'succeed';

c.buses.SIGNAL.emit('workflow:orderLifecycle',
  c.createPacket('CHARGE_DEPOSIT', {
    orderId: 'ord-restore', customerId: 'cust-001', amountCents: 7500,
    currency: 'usd', paymentMethodId: 'pm_test',
    description: 'restore test', idempotencyKey: 'idem-restore'
  }));

assert(signalPayments.isDegraded() === false, 'service restored');
assert(signalPayments.consecutiveFailures() === 0, 'consecutive failures reset to 0');

const restored = emissions.find(e => e.type === 'PAYMENT_SERVICE_RESTORED');
assert(restored !== undefined, 'PAYMENT_SERVICE_RESTORED emitted');
assert(restored.payload.service === 'stripe', 'restored service = stripe');


// ═══════════════════════════════════════════════════════════════
// SIGNAL:NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

section('T3-NOTIF-1: SEND_NOTIFICATION success (SMS)');
emissions.length = 0;
sendMode = 'succeed';

const smsPkt = c.createPacket('SEND_NOTIFICATION', {
  notificationId: 'notif-001', orderId: 'ord-001', customerId: 'cust-001',
  channel: 'sms', recipientAddress: '+12075551234',
  body: 'Your order is ready for pickup!', templateId: 'readyForPickupTemplate'
});
c.buses.SIGNAL.emit('workflow:notifications', smsPkt);

const delivered = emissions.find(e => e.type === 'NOTIFICATION_DELIVERED');
assert(delivered !== undefined, 'NOTIFICATION_DELIVERED emitted');
assert(delivered.payload.notificationId === 'notif-001', 'notificationId echoed');
assert(delivered.payload.channel === 'sms', 'channel echoed');
assert(delivered.payload.providerResponse !== undefined, 'providerResponse present');

section('T3-NOTIF-2: SEND_NOTIFICATION success (email)');
emissions.length = 0;
sendMode = 'succeed';

const emailPkt = c.createPacket('SEND_NOTIFICATION', {
  notificationId: 'notif-002', orderId: 'ord-001', customerId: 'cust-001',
  channel: 'email', recipientAddress: 'rick@example.com',
  subject: 'Order Ready', body: 'Your order is ready!', templateId: 'readyForPickupTemplate'
});
c.buses.SIGNAL.emit('workflow:notifications', emailPkt);

const emailDelivered = emissions.find(e => e.type === 'NOTIFICATION_DELIVERED');
assert(emailDelivered !== undefined, 'NOTIFICATION_DELIVERED for email');
assert(emailDelivered.payload.channel === 'email', 'email channel echoed');

section('T3-NOTIF-3: SEND_NOTIFICATION failure');
emissions.length = 0;
sendMode = 'fail';

const failPkt = c.createPacket('SEND_NOTIFICATION', {
  notificationId: 'notif-003', orderId: 'ord-001', customerId: 'cust-001',
  channel: 'sms', recipientAddress: '+10000000000',
  body: 'test', templateId: 'test'
});
c.buses.SIGNAL.emit('workflow:notifications', failPkt);

const notifFailed = emissions.find(e => e.type === 'NOTIFICATION_FAILED');
assert(notifFailed !== undefined, 'NOTIFICATION_FAILED emitted');
assert(notifFailed.payload.failureReason === 'INVALID_NUMBER', 'failure reason correct');
assert(notifFailed.payload.notificationId === 'notif-003', 'notificationId echoed on failure');

section('T3-NOTIF-4: Notification circuit breaker');
emissions.length = 0;
sendMode = 'fail';

const signalNotif = c.registry.get('signal:notifications');

// Need 3 consecutive failures (already 1 from NOTIF-3, need 2 more)
for (let i = 0; i < 2; i++) {
  c.buses.SIGNAL.emit('workflow:notifications',
    c.createPacket('SEND_NOTIFICATION', {
      notificationId: `notif-cb-${i}`, customerId: 'cust-001',
      channel: 'sms', recipientAddress: '+10000000000',
      body: 'test', templateId: 'test'
    }));
}

assert(signalNotif.isDegraded() === true, 'signal:notifications is degraded');

const notifDegraded = emissions.find(e => e.type === 'NOTIFICATION_SERVICE_DEGRADED');
assert(notifDegraded !== undefined, 'NOTIFICATION_SERVICE_DEGRADED emitted');

section('T3-NOTIF-5: Notification service restore');
emissions.length = 0;
sendMode = 'succeed';

c.buses.SIGNAL.emit('workflow:notifications',
  c.createPacket('SEND_NOTIFICATION', {
    notificationId: 'notif-restore', customerId: 'cust-001',
    channel: 'sms', recipientAddress: '+12075551234',
    body: 'test', templateId: 'test'
  }));

assert(signalNotif.isDegraded() === false, 'notification service restored');

const notifRestored = emissions.find(e => e.type === 'NOTIFICATION_SERVICE_RESTORED');
assert(notifRestored !== undefined, 'NOTIFICATION_SERVICE_RESTORED emitted');

section('T3-NOTIF-6: Dependency Gate throw → FAILED');
emissions.length = 0;
sendMode = 'throw';

c.buses.SIGNAL.emit('workflow:notifications',
  c.createPacket('SEND_NOTIFICATION', {
    notificationId: 'notif-throw', customerId: 'cust-001',
    channel: 'email', recipientAddress: 'test@example.com',
    body: 'test', templateId: 'test'
  }));

const throwNotif = emissions.find(e => e.type === 'NOTIFICATION_FAILED');
assert(throwNotif !== undefined, 'NOTIFICATION_FAILED on gate throw');
assert(throwNotif.payload.failureReason === 'PROVIDER_ERROR', 'PROVIDER_ERROR on throw');


// ═══════════════════════════════════════════════════════════════
// CROSS-TIER: Routing and ledger
// ═══════════════════════════════════════════════════════════════

section('T3-CROSS-1: Routing table has signal entries');

assert(c.routing.has('CHARGE_DEPOSIT', 'workflow:orderLifecycle'), 'CHARGE_DEPOSIT route exists');
assert(c.routing.has('DEPOSIT_CHARGED', 'signal:payments'), 'DEPOSIT_CHARGED route exists');
assert(c.routing.has('DEPOSIT_FAILED', 'signal:payments'), 'DEPOSIT_FAILED route exists');
assert(c.routing.has('CHARGE_BALANCE', 'workflow:orderLifecycle'), 'CHARGE_BALANCE route exists');
assert(c.routing.has('CHARGE_STORAGE_FEE', 'workflow:orderLifecycle'), 'CHARGE_STORAGE_FEE route exists');
assert(c.routing.has('CHARGE_NOSHOW_BALANCE', 'workflow:orderLifecycle'), 'CHARGE_NOSHOW_BALANCE route exists');
assert(c.routing.has('SEND_NOTIFICATION', 'workflow:notifications'), 'SEND_NOTIFICATION route exists');
assert(c.routing.has('NOTIFICATION_DELIVERED', 'signal:notifications'), 'NOTIFICATION_DELIVERED route exists');
assert(c.routing.has('NOTIFICATION_FAILED', 'signal:notifications'), 'NOTIFICATION_FAILED route exists');
assert(c.routing.has('PAYMENT_SERVICE_DEGRADED', 'signal:payments'), 'PAYMENT_SERVICE_DEGRADED route exists');
assert(c.routing.has('NOTIFICATION_SERVICE_DEGRADED', 'signal:notifications'), 'NOTIFICATION_SERVICE_DEGRADED route exists');

section('T3-CROSS-2: Ledger records signal traffic');

const chargeLedger = c.ledger.queryByPacketType('DEPOSIT_CHARGED');
assert(chargeLedger.length >= 1, 'DEPOSIT_CHARGED in ledger');

const failLedger = c.ledger.queryByPacketType('DEPOSIT_FAILED');
assert(failLedger.length >= 1, 'DEPOSIT_FAILED in ledger');

section('T3-CROSS-3: All 9 loops instantiated');
assert(c.registry.instanceCount() === 15, 'all 15 built-in loops instantiated');

section('T3-CROSS-4: Route count includes signal entries');
const routeCount = c.routing.count();
assert(routeCount >= 65, `${routeCount} routing entries total`);


// ═══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}`);
if (failed > 0) process.exit(1);

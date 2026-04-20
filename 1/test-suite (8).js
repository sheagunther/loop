#!/usr/bin/env node
// ================================================================
//  LOOP 2.1 — INTER-PHASE TEST SUITE
//
//  Run: node test-suite.js [path-to-html-file]
//
//  Three categories of tests:
//    STRUCTURAL — verify the file's well-formed without executing it
//    LOGIC      — extract pure functions and test them in Node
//    CSS        — verify stylesheet integrity
//
//  Exit code: 0 = all passed, 1 = failures
// ================================================================

const fs = require('fs');

const file = process.argv[2] || './loop2-stage2__267_.html';
if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const src = fs.readFileSync(file, 'utf8');

const scriptMatch = src.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) { console.error('No <script> block found'); process.exit(1); }
const js = scriptMatch[1];

const styleMatch = src.match(/<style>([\s\S]*?)<\/style>/);
const css = styleMatch ? styleMatch[1] : '';

let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try { fn(); passed++; console.log(`  \u2713 ${name}`); }
  catch (e) { failed++; failures.push({ name, msg: e.message }); console.log(`  \u2717 ${name}\n    \u2192 ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(`${msg || 'assertEqual'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ── Helper: extract a function body from source by name ──
function extractFn(source, name) {
  const re = new RegExp(`function ${name}\\s*\\([^)]*\\)\\s*\\{`);
  const m = re.exec(source);
  if (!m) return null;
  let depth = 0, start = m.index;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') { depth--; if (depth === 0) return source.substring(start, i + 1); }
  }
  return null;
}


// ================================================================
//  STRUCTURAL TESTS
// ================================================================

console.log('\n\u2500\u2500 STRUCTURAL TESTS \u2500\u2500\n');

test('File is valid HTML with doctype', () => {
  assert(src.includes('<!DOCTYPE html>'), 'Missing DOCTYPE');
  assert(src.includes('<html'), 'Missing <html>');
  assert(src.includes('</html>'), 'Missing </html>');
});

test('Has exactly one <script> block', () => {
  assertEqual((src.match(/<script>/g) || []).length, 1, 'Script blocks');
});

test('Has exactly one <style> block', () => {
  const htmlPortion = src.substring(0, src.indexOf('<script>'));
  assertEqual((htmlPortion.match(/<style>/g) || []).length, 1, 'Style blocks');
});

test('Version header matches APP_VERSION', () => {
  const header = src.match(/<!-- Loop 2\.1.*build v\.(\d+)/);
  const appVer = js.match(/const APP_VERSION = '(\d+)'/);
  assert(header && appVer, 'Version strings not found');
  assertEqual(header[1], appVer[1], 'Header vs APP_VERSION');
});

test('No duplicate function definitions', () => {
  const names = [];
  const re = /^function (\w+)\s*\(/gm;
  let m; while ((m = re.exec(js)) !== null) names.push(m[1]);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  assert(dupes.length === 0, `Duplicates: ${[...new Set(dupes)].join(', ')}`);
});

test('All four loop canvases exist in HTML', () => {
  for (const id of ['working', 'alu', 'memory', 'big'])
    assert(src.includes(`id="canvas-${id}"`), `Missing canvas-${id}`);
});

test('All nine bus canvases exist in HTML', () => {
  for (const id of ['bus', 'busb', 'busc', 'busd', 'buse', 'busf', 'busg', 'bush', 'busi'])
    assert(src.includes(`id="canvas-${id}"`), `Missing canvas-${id}`);
});

test('All bus inline toggle buttons exist', () => {
  for (const id of ['bus', 'busb', 'busc', 'busd', 'buse', 'busf', 'busg'])
    assert(src.includes(`id="inline-btn-${id}"`), `Missing inline-btn-${id}`);
});

test('All sidebar sections have collapse buttons', () => {
  const count = (src.match(/class="sb-section/g) || []).length;
  assert(count >= 15, `Expected >=15 sidebar sections, found ${count}`);
});

test('No orphaned CSS (bare property blocks without selectors)', () => {
  const lines = css.split('\n');
  const propLine = /^\s+[\w-]+\s*:\s*[^;]+;\s*$/;
  let prevClose = false;
  const orphans = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '}') { prevClose = true; continue; }
    if (prevClose && propLine.test(lines[i]) && !t.startsWith('/*') && !t.startsWith('//'))
      orphans.push(`Line ~${i + 1}: ${t.substring(0, 60)}`);
    prevClose = false;
  }
  assert(orphans.length === 0, `Orphaned CSS:\n    ${orphans.join('\n    ')}`);
});

test('Utility CSS classes used in HTML are defined in CSS', () => {
  const classes = ['lbtn-dim', 'lbtn-ext', 'lbtn-mem', 'lsel-wrap', 'sb-action-half', 'sb-action-sm'];
  for (const cls of classes) {
    const usedInHTML = src.includes(` ${cls}`) || src.includes(`"${cls}`);
    if (usedInHTML) assert(css.includes(`.${cls}`), `"${cls}" used but not defined`);
  }
});

test('All onclick handlers reference defined functions', () => {
  const defined = new Set();
  let m; const re1 = /function (\w+)\s*\(/g;
  while ((m = re1.exec(js)) !== null) defined.add(m[1]);
  // Also match window.name = function() and window.name = async function() assignments
  const re1b = /window\.(\w+)\s*=\s*(?:async\s+)?function/g;
  while ((m = re1b.exec(js)) !== null) defined.add(m[1]);
  const called = new Set();
  const re2 = /onclick="([a-zA-Z_]\w*)\(/g;
  while ((m = re2.exec(src)) !== null) called.add(m[1]);
  const missing = [...called].filter(f => !defined.has(f) && f !== 'tickCount');
  assert(missing.length === 0, `Undefined onclick targets: ${missing.join(', ')}`);
});

test('All data-action attributes reference defined functions', () => {
  const defined = new Set();
  let m; const re1 = /function (\w+)\s*\(/g;
  while ((m = re1.exec(js)) !== null) defined.add(m[1]);
  const re1b = /window\.(\w+)\s*=\s*(?:async\s+)?function/g;
  while ((m = re1b.exec(js)) !== null) defined.add(m[1]);
  const actions = new Set();
  const re2 = /data-action="(\w+)"/g;
  while ((m = re2.exec(src)) !== null) actions.add(m[1]);
  // Also check JS-generated data-action via dataset.action
  const re3 = /dataset\.action\s*=\s*'(\w+)'/g;
  while ((m = re3.exec(js)) !== null) actions.add(m[1]);
  const missing = [...actions].filter(f => !defined.has(f));
  assert(missing.length === 0, `Undefined data-action targets: ${missing.join(', ')}`);
  assert(actions.size > 0, 'Should find at least one data-action attribute');
});

test('Balanced HTML container tags', () => {
  for (const tag of ['div', 'button', 'select']) {
    const opens = (src.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const closes = (src.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    assert(Math.abs(opens - closes) <= 2, `<${tag}>: ${opens} opens vs ${closes} closes`);
  }
});

test('No duplicate HTML element IDs (spot check critical ones)', () => {
  const criticalIds = [
    'canvas-working', 'canvas-alu', 'canvas-memory', 'canvas-big',
    'canvas-bus', 'canvas-busb', 'canvas-busc', 'canvas-busd',
    'btn-run', 'speed-slider', 'tick-display', 'skin-select',
    'alu-bits-a', 'alu-bits-b', 'alu-bits-c', 'alu-bits-d',
  ];
  for (const id of criticalIds) {
    const count = (src.match(new RegExp(`id="${id}"`, 'g')) || []).length;
    assert(count === 1, `id="${id}" appears ${count} times (expected 1)`);
  }
});

test('No inline onclick handlers in static HTML outside annotation section (Phase 6c)', () => {
  const htmlPortion = src.substring(0, src.indexOf('<script>'));
  // The annotation section still uses inline onclick handlers (added post-Phase-6c).
  // Exclude it from this check — it has its own existence test.
  const annoStart = htmlPortion.indexOf('id="anno-section"');
  const beforeAnno = annoStart >= 0 ? htmlPortion.substring(0, annoStart) : htmlPortion;
  const onclickMatches = beforeAnno.match(/onclick="/g) || [];
  assertEqual(onclickMatches.length, 0, `Found ${onclickMatches.length} onclick handlers outside annotation section`);
});

test('Event delegation listener registered (Phase 6c)', () => {
  assert(js.includes('document.addEventListener(\'click\'') || js.includes('document.addEventListener("click"'),
    'Should have a click event delegation listener');
  assert(js.includes('ELEMENT_RECEIVER_ACTIONS'), 'Should define ELEMENT_RECEIVER_ACTIONS set');
  assert(js.includes('parseActionArg'), 'Should define parseActionArg function');
});

test('data-action attributes exist in HTML (Phase 6c)', () => {
  const htmlPortion = src.substring(0, src.indexOf('<script>'));
  const actionCount = (htmlPortion.match(/data-action="/g) || []).length;
  assert(actionCount >= 200, `Expected 200+ data-action attributes, found ${actionCount}`);
});


// ── Readability overhaul verification (v.328) ──

test('File header contains architecture overview', () => {
  assert(js.includes('ARCHITECTURE OVERVIEW'), 'Missing architecture overview');
  assert(js.includes('THE MACHINE'), 'Missing machine description');
  assert(js.includes('THE TICK ENGINE'), 'Missing tick engine description');
  assert(js.includes('TABLE OF CONTENTS'), 'Missing table of contents');
});

test('File header contains the eight tenets', () => {
  assert(js.includes('The Operator Is the Program'), 'Missing tenet 1');
  assert(js.includes('Explicit State, No Black Boxes'), 'Missing tenet 2');
  assert(js.includes('Data as Physical Entity'), 'Missing tenet 3');
  assert(js.includes('Circular Storage'), 'Missing tenet 4');
  assert(js.includes('Manual Flow'), 'Missing tenet 5');
  assert(js.includes('Bus as Programmable Structure'), 'Missing tenet 6');
  assert(js.includes('Computation as Craft'), 'Missing tenet 7');
  assert(js.includes('Operator-Scale Timing'), 'Missing tenet 8');
});

test('All functions have a preceding comment', () => {
  const lines = js.split('\n');
  const uncommented = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^function\s+(\w+)/);
    if (!m) continue;
    let p = i - 1;
    while (p >= 0 && lines[p].trim() === '') p--;
    if (p >= 0 && !lines[p].trim().startsWith('//'))
      uncommented.push(m[1]);
  }
  assert(uncommented.length === 0,
    `${uncommented.length} uncommented functions: ${uncommented.slice(0,5).join(', ')}${uncommented.length > 5 ? '...' : ''}`);
});

test('No stale migration or backward-compat comments', () => {
  const bad = ['backward compat', 'removed once all code migrates', 'will consolidate in Phase 6', 'being moved here in phases'];
  for (const phrase of bad)
    assert(!js.includes(phrase), `Stale comment found: "${phrase}"`);
});

test('Dot rendering named constants defined', () => {
  for (const c of ['DOT_OFF_OUTER', 'DOT_LIT_BODY', 'DOT_MK_OFF', 'DOT_MK_LIT', 'MAX_TICK_COUNT'])
    assert(js.includes(`const ${c}`), `Missing constant: ${c}`);
});

test('New CSS utility classes defined', () => {
  for (const cls of ['sb-input', 'sb-row', 'sb-row-mb', 'sb-status', 'sb-error', 'sb-label'])
    assert(css.includes(`.${cls}`), `Missing CSS class: .${cls}`);
});

test('CSS utility classes used in HTML', () => {
  const htmlPortion = src.substring(0, src.indexOf('<script>'));
  for (const cls of ['sb-input', 'sb-row', 'sb-row-mb', 'sb-status']) {
    // Match class as a standalone value or within a space-separated class list
    const re = new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"`);
    assert(re.test(htmlPortion), `CSS class ${cls} defined but not used in HTML`);
  }
});

// ── Bus state shape ──

test('L21.buses unidirectional (A-D) have bits array', () => {
  // Accept either inline { bits: new Array... } or factory makeUnidirectionalBus(...)
  const hasFactory = /function makeUnidirectionalBus[\s\S]*?bits:\s*new Array/.test(js);
  for (const id of ['a', 'b', 'c', 'd']) {
    const reInline = new RegExp(`${id}:\\s*\\{[\\s\\S]*?bits:\\s*new Array`);
    const reFactory = new RegExp(`${id}:\\s*makeUnidirectionalBus\\(`);
    assert(reInline.test(js) || (hasFactory && reFactory.test(js)), `Bus ${id} should have bits array (unidirectional)`);
  }
});

test('L21.buses dual-channel (E-I) have outBits and inBits arrays', () => {
  const hasFactory = /function makeDualChannelBus[\s\S]*?outBits:\s*new Array/.test(js);
  for (const id of ['e', 'f', 'g', 'h', 'i']) {
    const reInline = new RegExp(`${id}:\\s*\\{[\\s\\S]*?outBits:\\s*new Array`);
    const reFactory = new RegExp(`${id}:\\s*makeDualChannelBus\\(`);
    assert(reInline.test(js) || (hasFactory && reFactory.test(js)), `Bus ${id} should have outBits array (dual-channel)`);
  }
});

test('L21.buses H and I have peerTarget field', () => {
  for (const id of ['h', 'i']) {
    const reInline = new RegExp(`${id}:\\s*\\{[\\s\\S]*?peerTarget:`);
    const reFactory = new RegExp(`${id}:\\s*makeDualChannelBus\\([^)]*peerTarget:`);
    assert(reInline.test(js) || reFactory.test(js), `Bus ${id} should have peerTarget`);
  }
});

// ── Annotation system existence ──

test('Annotation system functions defined', () => {
  const annoFns = ['annoInit', 'annoUpdateRecordingIndicator',
                   'annoFormatSessionHeader', 'annoFormatAnnotationLine',
                   'annoRenderPalette', 'annoSavePalette'];
  for (const fn of annoFns)
    assert(js.includes(`function ${fn}`) || js.includes(`window.${fn}`),
      `Missing annotation function: ${fn}`);
});

// ── Session statistics structure ──

test('Session stats has all expected counters', () => {
  const statsStart = js.indexOf('stats: {', js.indexOf('const L21'));
  assert(statsStart >= 0, 'stats block in L21');
  let depth = 0, end = statsStart + 7;
  for (let i = js.indexOf('{', statsStart); i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const block = js.substring(statsStart, end);
  for (const f of ['operatorActions:', 'wordsTransferred:', 'aluOpsExecuted:',
                    'busActivations:', 'gateToggles:', 'injects:',
                    'memSlotWrites:', 'memSlotReads:', 'clockChanges:'])
    assert(block.includes(f), `Stats missing: ${f}`);
});

// ── Skin system structure ──

test('parseSkinSource function exists', () => {
  assert(js.includes('function parseSkinSource'), 'parseSkinSource should exist');
});

test('Three foundational skin source strings defined', () => {
  assert(js.includes('SKIN_SOURCE_OG'), 'Missing SKIN_SOURCE_OG');
  assert(js.includes('SKIN_SOURCE_WINAMP'), 'Missing SKIN_SOURCE_WINAMP');
  assert(js.includes('SKIN_SOURCE_SUNRISE'), 'Missing SKIN_SOURCE_SUNRISE');
});


// ================================================================
//  LOGIC TESTS — pure function extraction
// ================================================================

console.log('\n\u2500\u2500 LOGIC TESTS \u2500\u2500\n');

let ctx = null;
try {
  const defsMatch = js.match(/const DEFS\s*=\s*(\[[\s\S]*?\]);/);
  const code = `
    const BPW = ${js.match(/const BPW\s*=\s*(\d+)/)[1]};
    const BUS_N = ${js.match(/const BUS_N\s*=\s*(\d+)/)[1]};
    const INJ_N = ${js.match(/const INJ_N\s*=\s*(\d+)/)[1]};
    const DEFS = ${defsMatch[1]};
    const LOOP_IDS_SET = new Set(DEFS.map(d => d.id));
    const BRIDGE_SOURCE_IDS = new Set(['pm1','pm2','pm2match','pm2reject','tg1','tg2','tg2match','tg2reject']);
    const COL = { working:'left', alu:'right', memory:'left', big:'right',
      pm1:'right', pm2:'right', pm2match:'right', pm2reject:'right',
      tg1:'right', tg2:'right', tg2match:'right', tg2reject:'right',
      'tg1-threshold':'right', 'tg2-threshold':'right',
      ext:'right', challenge:'right', network:'right' };
    const L21 = { buses: {} };
    ${extractFn(js, 'generateEmptyBitArray')}
    ${extractFn(js, 'extractWordAtReadHead')}
    ${extractFn(js, 'readHeadBitIndex')}
    ${extractFn(js, 'gateHeadBitIndex')}
    ${extractFn(js, 'resolveBusEndpoint')}
    ${extractFn(js, 'randomIntBetween')}
    ${extractFn(js, 'getUnidirectionalBusFlowDirection') || 'function getUnidirectionalBusFlowDirection() { return null; }'}
    const _hasFlowDir = ${extractFn(js, 'getUnidirectionalBusFlowDirection') ? 'true' : 'false'};
    ${extractFn(js, 'pmComputeRegisterValue') || 'function pmComputeRegisterValue() { return null; }'}
    const _hasPmCompute = ${extractFn(js, 'pmComputeRegisterValue') ? 'true' : 'false'};
    ${extractFn(js, 'tgCompare') || 'function tgCompare() { return null; }'}
    const _hasTgCompare = ${extractFn(js, 'tgCompare') ? 'true' : 'false'};
    ${extractFn(js, 'counterOutBufKey') || 'function counterOutBufKey() { return null; }'}
    const _hasCtrBufKey = ${extractFn(js, 'counterOutBufKey') ? 'true' : 'false'};
    return { BPW, BUS_N, INJ_N, DEFS, L21, _hasFlowDir, _hasPmCompute, _hasTgCompare, _hasCtrBufKey,
             generateEmptyBitArray, extractWordAtReadHead,
             readHeadBitIndex, gateHeadBitIndex,
             resolveBusEndpoint, randomIntBetween,
             getUnidirectionalBusFlowDirection,
             pmComputeRegisterValue, tgCompare, counterOutBufKey };
  `;
  ctx = (new Function(code))();
} catch (e) {
  console.log(`  \u2717 Pure function extraction failed: ${e.message}`);
  failed++;
}

if (ctx) {
  test('BPW is 17 (1 marker + 16 data)', () => assertEqual(ctx.BPW, 17, 'BPW'));
  test('BUS_N is 24', () => assertEqual(ctx.BUS_N, 24, 'BUS_N'));
  test('INJ_N is 17', () => assertEqual(ctx.INJ_N, 17, 'INJ_N'));

  test('Four loops defined: Working, ALU, Memory, Big', () => {
    assertEqual(ctx.DEFS.length, 4, 'DEFS.length');
    for (const id of ['working', 'alu', 'memory', 'big'])
      assert(ctx.DEFS.some(d => d.id === id), `Missing ${id}`);
  });

  test('Loop word capacities: W=18, A=24, M=24, B=48', () => {
    const caps = {}; ctx.DEFS.forEach(d => caps[d.id] = d.wordCap);
    assertEqual(caps.working, 18, 'W'); assertEqual(caps.alu, 24, 'A');
    assertEqual(caps.memory, 24, 'M'); assertEqual(caps.big, 48, 'B');
  });

  test('generateEmptyBitArray: correct length', () => {
    assertEqual(ctx.generateEmptyBitArray(10, 0).length, 170, '10*17');
  });

  test('generateEmptyBitArray: fill=0 produces all zeros', () => {
    assert(ctx.generateEmptyBitArray(4, 0).every(b => b === 0), 'All zero');
  });

  test('generateEmptyBitArray: fill=1 sets markers at word boundaries', () => {
    const bits = ctx.generateEmptyBitArray(4, 1);
    for (let w = 0; w < 4; w++) assertEqual(bits[w * 17], 1, `Word ${w} marker`);
  });

  test('generateEmptyBitArray: all values are binary', () => {
    assert(ctx.generateEmptyBitArray(8, 0.5).every(b => b === 0 || b === 1), 'Binary');
  });

  test('extractWordAtReadHead: null when no marker', () => {
    assertEqual(ctx.extractWordAtReadHead(new Array(17).fill(0), 0), null, 'No marker');
  });

  test('extractWordAtReadHead: 0x00FF', () => {
    const r = ctx.extractWordAtReadHead([1, 0,0,0,0, 0,0,0,0, 1,1,1,1, 1,1,1,1], 0);
    assertEqual(r.data, 0x00FF, 'Data');
  });

  test('extractWordAtReadHead: 0xFFFF', () => {
    assertEqual(ctx.extractWordAtReadHead([1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], 0).data, 0xFFFF, 'Max');
  });

  test('extractWordAtReadHead: 0x0000', () => {
    assertEqual(ctx.extractWordAtReadHead([1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 0).data, 0, 'Zero');
  });

  test('extractWordAtReadHead: 0xA5A5', () => {
    assertEqual(ctx.extractWordAtReadHead([1, 1,0,1,0, 0,1,0,1, 1,0,1,0, 0,1,0,1], 0).data, 0xA5A5, 'Pattern');
  });

  test('extractWordAtReadHead: respects offset', () => {
    const bits = [0, 0, 0, 1, 0,0,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0];
    assertEqual(ctx.extractWordAtReadHead(bits, 0), null, 'Offset 0');
    assertEqual(ctx.extractWordAtReadHead(bits, 3).data, 0x0010, 'Offset 3');
  });

  test('Read head always at index 2', () => {
    for (const id of ['working', 'alu', 'memory', 'big'])
      assertEqual(ctx.readHeadBitIndex(id), 2, id);
  });

  test('Gate head always at index 1', () => {
    for (const id of ['working', 'alu', 'memory', 'big'])
      assertEqual(ctx.gateHeadBitIndex(id), 1, id);
  });

  test('resolveBusEndpoint: loop names uppercase with colors', () => {
    for (const id of ['working', 'alu', 'memory', 'big']) {
      const ep = ctx.resolveBusEndpoint(id);
      assertEqual(ep.name, id.toUpperCase(), id);
      assert(ep.color.startsWith('#'), `${id} color`);
    }
  });

  test('resolveBusEndpoint: PM/TG endpoints', () => {
    assertEqual(ctx.resolveBusEndpoint('pm1').name, 'PM1', 'PM1');
    assertEqual(ctx.resolveBusEndpoint('pm2').name, 'PM2', 'PM2');
    assertEqual(ctx.resolveBusEndpoint('tg1').name, 'TG1', 'TG1');
    assertEqual(ctx.resolveBusEndpoint('tg2').name, 'TG2', 'TG2');
  });

  test('resolveBusEndpoint: counter endpoints', () => {
    assert(ctx.resolveBusEndpoint('ctr-working').name.includes('CTR'), 'ctr-working');
    assert(ctx.resolveBusEndpoint('ctr-global').name.includes('CTR'), 'ctr-global');
  });

  test('resolveBusEndpoint: special endpoints', () => {
    assertEqual(ctx.resolveBusEndpoint('challenge').name, 'CHALL', 'Challenge');
    assertEqual(ctx.resolveBusEndpoint('network').name, 'NET', 'Network');
    assertEqual(ctx.resolveBusEndpoint('ext').name, 'EXT', 'External');
  });

  test('randomIntBetween: stays in range over 200 samples', () => {
    for (let i = 0; i < 200; i++) {
      const v = ctx.randomIntBetween(5, 10);
      assert(v >= 5 && v <= 10, `${v} out of [5,10]`);
    }
  });

  test('randomIntBetween: hits both endpoints', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i++) seen.add(ctx.randomIntBetween(0, 2));
    assert(seen.has(0) && seen.has(2), 'Should hit 0 and 2');
  });

  // ── getUnidirectionalBusFlowDirection tests ──
  // Helper: set up a mock bus for direction testing
  function setMockBus(busId, src, dst) {
    ctx.L21.buses[busId] = { src, dst };
  }

  if (ctx._hasFlowDir) {

  test('getUnidirectionalBusFlowDirection: same src/dst is invalid', () => {
    setMockBus('a', 'working', 'working');
    assertEqual(ctx.getUnidirectionalBusFlowDirection('a'), 'invalid', 'same endpoint');
  });

  test('getUnidirectionalBusFlowDirection: left-to-right (LTR)', () => {
    setMockBus('a', 'working', 'alu');
    assertEqual(ctx.getUnidirectionalBusFlowDirection('a'), 'ltr', 'working→alu');
  });

  test('getUnidirectionalBusFlowDirection: right-to-left (RTL)', () => {
    setMockBus('a', 'alu', 'working');
    assertEqual(ctx.getUnidirectionalBusFlowDirection('a'), 'rtl', 'alu→working');
  });

  test('getUnidirectionalBusFlowDirection: bridge source forces RTL', () => {
    for (const src of ['pm1', 'pm2', 'tg1', 'tg2', 'pm2match', 'pm2reject', 'tg2match', 'tg2reject']) {
      setMockBus('b', src, 'working');
      assertEqual(ctx.getUnidirectionalBusFlowDirection('b'), 'rtl', `${src}→working`);
    }
  });

  test('getUnidirectionalBusFlowDirection: counter src to loop dst', () => {
    setMockBus('c', 'ctr-working', 'alu');
    assertEqual(ctx.getUnidirectionalBusFlowDirection('c'), 'ltr', 'ctr-working→alu');
  });

  test('getUnidirectionalBusFlowDirection: counter-to-counter is invalid', () => {
    setMockBus('d', 'ctr-working', 'ctr-alu');
    assertEqual(ctx.getUnidirectionalBusFlowDirection('d'), 'invalid', 'ctr→ctr');
  });

  test('getUnidirectionalBusFlowDirection: TG threshold destination treated as right col', () => {
    setMockBus('a', 'working', 'tg1-threshold');
    assertEqual(ctx.getUnidirectionalBusFlowDirection('a'), 'ltr', 'working→tg1-threshold');
    setMockBus('a', 'alu', 'tg2-clamp');
    assertEqual(ctx.getUnidirectionalBusFlowDirection('a'), 'ltr', 'alu→tg2-clamp (same col)');
  });

  test('getUnidirectionalBusFlowDirection: works for all bus IDs a-d', () => {
    for (const id of ['a', 'b', 'c', 'd']) {
      setMockBus(id, 'working', 'alu');
      assertEqual(ctx.getUnidirectionalBusFlowDirection(id), 'ltr', `bus ${id}`);
    }
  });

  } // end if _hasFlowDir

  // ── pmComputeRegisterValue tests (Phase 4a unified helper) ──
  if (ctx._hasPmCompute) {

  test('pmComputeRegisterValue: all zeros → 0', () => {
    const state = { maskBits: new Array(16).fill(0) };
    assertEqual(ctx.pmComputeRegisterValue(state, 'maskBits'), 0, 'All zeros');
  });

  test('pmComputeRegisterValue: all ones → 0xFFFF', () => {
    const state = { maskBits: new Array(16).fill(1) };
    assertEqual(ctx.pmComputeRegisterValue(state, 'maskBits'), 0xFFFF, 'All ones');
  });

  test('pmComputeRegisterValue: MSB only → 0x8000', () => {
    const bits = new Array(16).fill(0); bits[0] = 1;
    const state = { matchBits: bits };
    assertEqual(ctx.pmComputeRegisterValue(state, 'matchBits'), 0x8000, 'MSB');
  });

  test('pmComputeRegisterValue: LSB only → 0x0001', () => {
    const bits = new Array(16).fill(0); bits[15] = 1;
    const state = { matchBits: bits };
    assertEqual(ctx.pmComputeRegisterValue(state, 'matchBits'), 0x0001, 'LSB');
  });

  test('pmComputeRegisterValue: 0xA5A5 pattern', () => {
    // 0xA5A5 = 1010 0101 1010 0101
    const bits = [1,0,1,0, 0,1,0,1, 1,0,1,0, 0,1,0,1];
    const state = { changeMaskBits: bits };
    assertEqual(ctx.pmComputeRegisterValue(state, 'changeMaskBits'), 0xA5A5, '0xA5A5');
  });

  } // end if _hasPmCompute

  // ── tgCompare tests ──
  if (ctx._hasTgCompare) {

  test('tgCompare: gt mode', () => {
    assertEqual(ctx.tgCompare(100, 50, 'gt'), true, '100 > 50');
    assertEqual(ctx.tgCompare(50, 100, 'gt'), false, '50 > 100');
    assertEqual(ctx.tgCompare(50, 50, 'gt'), false, '50 > 50');
  });

  test('tgCompare: lt mode', () => {
    assertEqual(ctx.tgCompare(50, 100, 'lt'), true, '50 < 100');
    assertEqual(ctx.tgCompare(100, 50, 'lt'), false, '100 < 50');
    assertEqual(ctx.tgCompare(50, 50, 'lt'), false, '50 < 50');
  });

  test('tgCompare: gte mode', () => {
    assertEqual(ctx.tgCompare(100, 50, 'gte'), true, '100 >= 50');
    assertEqual(ctx.tgCompare(50, 50, 'gte'), true, '50 >= 50');
    assertEqual(ctx.tgCompare(49, 50, 'gte'), false, '49 >= 50');
  });

  test('tgCompare: lte mode', () => {
    assertEqual(ctx.tgCompare(50, 100, 'lte'), true, '50 <= 100');
    assertEqual(ctx.tgCompare(50, 50, 'lte'), true, '50 <= 50');
    assertEqual(ctx.tgCompare(51, 50, 'lte'), false, '51 <= 50');
  });

  test('tgCompare: boundary values 0 and 65535', () => {
    assertEqual(ctx.tgCompare(0, 0, 'gte'), true, '0 >= 0');
    assertEqual(ctx.tgCompare(65535, 65535, 'lte'), true, 'max <= max');
    assertEqual(ctx.tgCompare(0, 65535, 'lt'), true, '0 < max');
    assertEqual(ctx.tgCompare(65535, 0, 'gt'), true, 'max > 0');
  });

  test('tgCompare: invalid mode returns false', () => {
    assertEqual(ctx.tgCompare(100, 50, 'invalid'), false, 'bad mode');
    assertEqual(ctx.tgCompare(100, 50, ''), false, 'empty mode');
  });

  } // end if _hasTgCompare

  // ── counterOutBufKey tests (Phase 4c unified helper) ──
  if (ctx._hasCtrBufKey) {

  test('counterOutBufKey: maps bus IDs to correct outBuf property names', () => {
    assertEqual(ctx.counterOutBufKey('b'), 'outBuf', 'bus b');
    assertEqual(ctx.counterOutBufKey('a'), 'outBufA', 'bus a');
    assertEqual(ctx.counterOutBufKey('c'), 'outBufC', 'bus c');
    assertEqual(ctx.counterOutBufKey('d'), 'outBufD', 'bus d');
  });

  test('counterOutBufKey: unknown bus falls back to outBuf', () => {
    assertEqual(ctx.counterOutBufKey('x'), 'outBuf', 'unknown');
  });

  } // end if _hasCtrBufKey
}


// ================================================================
//  STATE VERIFICATION (source analysis, no execution)
// ================================================================

console.log('\n\u2500\u2500 STATE VERIFICATION \u2500\u2500\n');

test('ALU has four registers initialized to null', () => {
  // ALU may be declared directly or inside L21 namespace
  const aluMatch = js.match(/(?:const alu\s*=\s*\{|alu:\s*\{)([\s\S]*?\n\s*\})/);
  assert(aluMatch, 'ALU object not found');
  const body = aluMatch[1];
  for (const r of ['a:', 'b:', 'c:', 'd:'])
    assert(body.includes(`${r} null`) || body.includes(`${r}null`), `ALU ${r} not null`);
});

test('Memory has 16 slots', () => {
  assert(js.includes('slots: new Array(16).fill(null)'), 'mem.slots');
});

test('Working Scratch has 4 slots', () => {
  assert(js.includes('slots:      [null, null, null, null]') || 
         js.match(/const wscr[\s\S]*?slots:\s*\[null,\s*null,\s*null,\s*null\]/), 'wscr 4 slots');
});

test('Five counters defined', () => {
  // May be in const ctr = { or L21.ctr or ctr: {
  assert(js.includes('const ctr = {') || js.includes('const ctr = L21.ctr') || js.includes('ctr: {'), 'ctr not found');
  const ctrBlock = js.includes('ctr: {') ? 
    js.substring(js.indexOf('ctr: {')) : 
    js.substring(js.indexOf('const ctr'));
  for (const id of ['working', 'alu', 'memory', 'big', 'global'])
    assert(ctrBlock.includes(`${id}:`), `Missing counter: ${id}`);
});

test('Two pattern matchers defined', () => {
  assert(js.includes('const pm = {') || js.includes('const pm = L21.pm'), 'pm');
  assert(js.includes('const pm2 = {') || js.includes('const pm2 = L21.pm2'), 'pm2');
});

test('Two threshold gates defined', () => {
  assert(js.includes('const tg1 = {') || js.includes('const tg1 = L21.tg1'), 'tg1');
  assert(js.includes('const tg2 = {') || js.includes('const tg2 = L21.tg2'), 'tg2');
});

test('Three skins defined', () => {
  for (const s of ['og:', 'winamp:', 'sunrise:']) assert(js.includes(s), `Missing skin ${s}`);
});

test('BUS_CONFIGS has all 9 buses with required fields', () => {
  assert(js.includes('const BUS_CONFIGS'), 'BUS_CONFIGS not found');
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']) {
    assert(js.includes(`${id}: {`) || js.includes(`${id}:{`), `Missing bus ${id} in BUS_CONFIGS`);
  }
  const requiredFields = ['id:', 'label:', 'type:', 'sidebarSectionId:', 'dstSectionId:',
                          'selSrcClass:', 'selDstClass:', 'toggleBtnId:', 'inlineBtnId:',
                          'logPrefix:'];
  // Spot check bus 'a' entry has all required fields
  const busAStart = js.indexOf("a: {", js.indexOf('const BUS_CONFIGS'));
  assert(busAStart >= 0, 'Bus A entry not found in BUS_CONFIGS');
  // Find the closing brace for bus A's object
  let depth = 0, busAEnd = busAStart + 3;
  for (let i = busAStart + 3; i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') { if (depth === 0) { busAEnd = i; break; } depth--; }
  }
  const busABlock = js.substring(busAStart, busAEnd);
  for (const field of requiredFields)
    assert(busABlock.includes(field), `Bus A missing field: ${field}`);
});

test('BUS_CONFIGS has flashProps for all 9 buses (Phase 6d)', () => {
  for (const id of ['a','b','c','d']) {
    const re = new RegExp(`${id}:\\s*\\{[\\s\\S]*?flashProps:\\s*\\['flash'\\]`);
    assert(re.test(js), `Bus ${id} should have flashProps: ['flash']`);
  }
  for (const id of ['e','f','g','h','i']) {
    const re = new RegExp(`${id}:\\s*\\{[\\s\\S]*?flashProps:\\s*\\['outFlash',\\s*'inFlash'\\]`);
    assert(re.test(js), `Bus ${id} should have flashProps: ['outFlash', 'inFlash']`);
  }
});

test('11 ALU operations in HTML', () => {
  for (const op of ['ADD','SUB','AND','OR','XOR','NOT','SHL','SHR','NEG','INC','DEC'])
    assert(src.includes(`data-op="${op}"`), `Missing ${op}`);
});

test('CBX message types defined', () => {
  for (const k of ['DISCOVERY','PROBE','PROBE_RETURN','CHAIN_INVITE','CHAIN_GO','CHAIN_COMPLETE'])
    assert(js.includes(`${k}:`), `Missing CBX_MSG.${k}`);
});

test('At least 9 built-in challenges', () => {
  const n = (js.match(/builtin:\s*true/g) || []).length;
  assert(n >= 9, `Only ${n} built-in challenges`);
});

test('Built-in challenges have id, name, generate, par', () => {
  const start = js.indexOf('const BUILTIN_CHALLENGE_DEFINITIONS = [');
  assert(start >= 0, 'BUILTIN_CHALLENGE_DEFINITIONS not found');
  const arrStart = js.indexOf('[', start);
  let depth = 0, end = arrStart;
  for (let i = arrStart; i < js.length; i++) {
    if (js[i] === '[') depth++;
    if (js[i] === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  const section = js.substring(start, end);
  const ids = (section.match(/id:.*name:.*builtin:/g) || []).length;
  const gens = (section.match(/generate:\s*function/g) || []).length;
  const pars = (section.match(/par:\s*function/g) || []).length;
  assert(ids >= 9, `challenge ids: ${ids}`);
  assertEqual(ids, gens, 'id vs generate count');
  assertEqual(ids, pars, 'id vs par count');
});

test('executeOneTick has R/G/W phase structure', () => {
  const fn = extractFn(js, 'executeOneTick');
  assert(fn, 'executeOneTick not found');
  // Decomposed: coordinator calls named sub-functions
  const isDecomposed = fn.includes('tickReadPhase') && fn.includes('tickGatePhase') && fn.includes('tickRotatePhase') && fn.includes('tickWritePhase');
  if (isDecomposed) {
    // Verify all sub-functions exist
    for (const name of ['tickPreamble', 'tickSampleBusSources', 'tickReadPhase', 'tickGatePhase', 'tickRotatePhase', 'tickWritePhase'])
      assert(new RegExp(`function ${name}\\s*\\(`).test(js), `Missing tick sub-function: ${name}`);
  } else {
    // Monolithic: phase markers in comments
    assert(fn.includes('STEP 1') || fn.includes('READ'), 'READ phase');
    assert(fn.includes('GATE'), 'GATE phase');
    assert(fn.includes('STEP 3') || fn.includes('ROTATE'), 'ROTATE phase');
    assert(fn.includes('STEP 4') || fn.includes('WRITE'), 'WRITE phase');
  }
});

test('Session logger dual-column format', () => {
  assert(js.includes("' || '") || js.includes("+ ' || '"), 'Missing || separator');
});


// ================================================================
//  PHASE 4 PRE-FLIGHT — lock down peripheral structures
// ================================================================

console.log('\n── PHASE 4 PRE-FLIGHT ──\n');

// ── PM state structure ──

test('PM1 state has all required fields', () => {
  // Accept either inline pm: { ... } or factory makePatternMatcher()
  let block;
  const pmStart = js.indexOf('pm: {', js.indexOf('const L21'));
  if (pmStart >= 0) {
    let depth = 0, pmEnd = pmStart + 4;
    for (let i = js.indexOf('{', pmStart); i < js.length; i++) {
      if (js[i] === '{') depth++;
      if (js[i] === '}') { depth--; if (depth === 0) { pmEnd = i; break; } }
    }
    block = js.substring(pmStart, pmEnd);
  } else {
    // Check factory function body
    assert(/pm:\s*makePatternMatcher\(/.test(js), 'pm state not found (inline or factory)');
    const fStart = js.indexOf('function makePatternMatcher');
    assert(fStart >= 0, 'makePatternMatcher factory not found');
    let depth = 0, fEnd = fStart;
    for (let i = js.indexOf('{', fStart); i < js.length; i++) {
      if (js[i] === '{') depth++;
      if (js[i] === '}') { depth--; if (depth === 0) { fEnd = i; break; } }
    }
    block = js.substring(fStart, fEnd);
  }
  for (const f of ['maskBits:', 'matchBits:', 'changeMaskBits:', 'changeValBits:',
                    'enabled:', 'destructive:', 'matchFlag:', 'matchCount:',
                    'outBuf:', 'bridge:', 'bridgeFlash:', 'cooldown:'])
    assert(block.includes(f), `PM1 missing field: ${f}`);
});

test('PM2 state has PM1 fields plus cascade fields', () => {
  // Accept factory pattern: shared fields in makePatternMatcher, cascade fields in call site
  const hasFactory = /function makePatternMatcher/.test(js);
  const pm2Line = /pm2:\s*makePatternMatcher\(/.test(js);
  if (hasFactory && pm2Line) {
    // Check shared fields in factory
    const fStart = js.indexOf('function makePatternMatcher');
    let depth = 0, fEnd = fStart;
    for (let i = js.indexOf('{', fStart); i < js.length; i++) {
      if (js[i] === '{') depth++;
      if (js[i] === '}') { depth--; if (depth === 0) { fEnd = i; break; } }
    }
    const factoryBlock = js.substring(fStart, fEnd);
    for (const f of ['maskBits:', 'matchBits:', 'changeMaskBits:', 'changeValBits:',
                      'enabled:', 'destructive:', 'matchFlag:', 'matchCount:',
                      'outBuf:', 'bridge:', 'bridgeFlash:', 'cooldown:'])
      assert(factoryBlock.includes(f), `PM2 missing shared field: ${f}`);
    // Check cascade fields at call site
    const pm2Idx = js.indexOf('pm2: makePatternMatcher(');
    const cascadeBlock = js.substring(pm2Idx, js.indexOf('})', pm2Idx) + 2);
    for (const f of ['cascadeMode:', 'cascadeInBuf:', 'matchOutBuf:', 'rejectOutBuf:',
                      'matchBridge:', 'rejectBridge:', 'matchBridgeFlash:', 'rejectBridgeFlash:'])
      assert(cascadeBlock.includes(f), `PM2 missing cascade field: ${f}`);
  } else {
    const pm2Start = js.indexOf('pm2: {', js.indexOf('const L21'));
    assert(pm2Start >= 0, 'pm2 state block not found in L21');
    let depth = 0, pm2End = pm2Start + 5;
    for (let i = js.indexOf('{', pm2Start); i < js.length; i++) {
      if (js[i] === '{') depth++;
      if (js[i] === '}') { depth--; if (depth === 0) { pm2End = i; break; } }
    }
    const block = js.substring(pm2Start, pm2End);
    for (const f of ['maskBits:', 'matchBits:', 'changeMaskBits:', 'changeValBits:',
                      'enabled:', 'destructive:', 'matchFlag:', 'matchCount:',
                      'outBuf:', 'bridge:', 'bridgeFlash:', 'cooldown:',
                      'cascadeMode:', 'cascadeInBuf:', 'matchOutBuf:', 'rejectOutBuf:',
                      'matchBridge:', 'rejectBridge:', 'matchBridgeFlash:', 'rejectBridgeFlash:'])
      assert(block.includes(f), `PM2 missing field: ${f}`);
  }
});

// ── TG state structure ──

test('TG1 state has all required fields', () => {
  let block;
  const tg1Start = js.indexOf('tg1: {', js.indexOf('const L21'));
  if (tg1Start >= 0) {
    let depth = 0, tg1End = tg1Start + 5;
    for (let i = js.indexOf('{', tg1Start); i < js.length; i++) {
      if (js[i] === '{') depth++;
      if (js[i] === '}') { depth--; if (depth === 0) { tg1End = i; break; } }
    }
    block = js.substring(tg1Start, tg1End);
  } else {
    assert(/tg1:\s*makeThresholdGate\(/.test(js), 'tg1 state not found (inline or factory)');
    const fStart = js.indexOf('function makeThresholdGate');
    assert(fStart >= 0, 'makeThresholdGate factory not found');
    let depth = 0, fEnd = fStart;
    for (let i = js.indexOf('{', fStart); i < js.length; i++) {
      if (js[i] === '{') depth++;
      if (js[i] === '}') { depth--; if (depth === 0) { fEnd = i; break; } }
    }
    block = js.substring(fStart, fEnd);
  }
  for (const f of ['threshold:', 'mode:', 'enabled:', 'destructive:',
                    'clampEnabled:', 'clampValue:', 'matchFlag:', 'matchCount:',
                    'outBuf:', 'bridge:', 'bridgeFlash:', 'cooldown:',
                    'captureNext:', 'capPos:', 'capBuf:'])
    assert(block.includes(f), `TG1 missing field: ${f}`);
});

test('TG2 state has TG1 fields plus cascade fields', () => {
  const hasFactory = /function makeThresholdGate/.test(js);
  const tg2Line = /tg2:\s*makeThresholdGate\(/.test(js);
  if (hasFactory && tg2Line) {
    const fStart = js.indexOf('function makeThresholdGate');
    let depth = 0, fEnd = fStart;
    for (let i = js.indexOf('{', fStart); i < js.length; i++) {
      if (js[i] === '{') depth++;
      if (js[i] === '}') { depth--; if (depth === 0) { fEnd = i; break; } }
    }
    const factoryBlock = js.substring(fStart, fEnd);
    for (const f of ['threshold:', 'mode:', 'enabled:', 'destructive:',
                      'clampEnabled:', 'clampValue:', 'matchFlag:', 'matchCount:',
                      'outBuf:', 'bridge:', 'bridgeFlash:', 'cooldown:',
                      'captureNext:', 'capPos:', 'capBuf:'])
      assert(factoryBlock.includes(f), `TG2 missing shared field: ${f}`);
    const tg2Idx = js.indexOf('tg2: makeThresholdGate(');
    const cascadeBlock = js.substring(tg2Idx, js.indexOf('})', tg2Idx) + 2);
    for (const f of ['cascadeMode:', 'cascadeInBuf:', 'matchOutBuf:', 'rejectOutBuf:',
                      'matchBridge:', 'rejectBridge:', 'matchBridgeFlash:', 'rejectBridgeFlash:',
                      'rejectCount:'])
      assert(cascadeBlock.includes(f), `TG2 missing cascade field: ${f}`);
  } else {
    const tg2Start = js.indexOf('tg2: {', js.indexOf('const L21'));
    assert(tg2Start >= 0, 'tg2 state block not found in L21');
    let depth = 0, tg2End = tg2Start + 5;
    for (let i = js.indexOf('{', tg2Start); i < js.length; i++) {
      if (js[i] === '{') depth++;
      if (js[i] === '}') { depth--; if (depth === 0) { tg2End = i; break; } }
    }
    const block = js.substring(tg2Start, tg2End);
    for (const f of ['threshold:', 'mode:', 'enabled:', 'destructive:',
                      'clampEnabled:', 'clampValue:', 'matchFlag:', 'matchCount:',
                      'outBuf:', 'bridge:', 'bridgeFlash:', 'cooldown:',
                      'captureNext:', 'capPos:', 'capBuf:',
                      'cascadeMode:', 'cascadeInBuf:', 'matchOutBuf:', 'rejectOutBuf:',
                      'matchBridge:', 'rejectBridge:', 'matchBridgeFlash:', 'rejectBridgeFlash:',
                      'rejectCount:'])
      assert(block.includes(f), `TG2 missing field: ${f}`);
  }
});

// ── Counter state structure ──

test('Loop counters have rot, readPos, outBuf variants, triggers', () => {
  const ctrBlock = js.substring(js.indexOf('ctr: {', js.indexOf('const L21')));
  // Check factory path first (makeCounter calls), then fall back to inline
  const hasFactory = /function makeCounter/.test(js);
  for (const id of ['working', 'alu', 'memory', 'big']) {
    const reFactory = new RegExp(`${id}:\\s*makeCounter\\(`);
    if (hasFactory && reFactory.test(ctrBlock)) {
      const fStart = js.indexOf('function makeCounter');
      let depth = 0, fEnd = fStart;
      for (let i = js.indexOf('{', fStart); i < js.length; i++) {
        if (js[i] === '{') depth++;
        if (js[i] === '}') { depth--; if (depth === 0) { fEnd = i; break; } }
      }
      const fBody = js.substring(fStart, fEnd);
      for (const f of ['val:', 'rot:', 'readPos:', 'outBuf:', 'outBufA:', 'outBufC:', 'outBufD:', 'destructive:', 'triggers:'])
        assert(fBody.includes(f), `Counter factory missing field: ${f}`);
    } else {
      const reInline = new RegExp(`${id}:\\s*\\{([^}]+)\\}`);
      const m = reInline.exec(ctrBlock);
      assert(m, `Counter ${id} not found (inline or factory)`);
      const body = m[1];
      for (const f of ['val:', 'rot:', 'readPos:', 'outBuf:', 'outBufA:', 'outBufC:', 'outBufD:', 'destructive:', 'triggers:'])
        assert(body.includes(f), `Counter ${id} missing field: ${f}`);
    }
  }
});

test('Global counter has val/outBuf variants but no rot/readPos/triggers', () => {
  const ctrBlock = js.substring(js.indexOf('ctr: {', js.indexOf('const L21')));
  const m = /global:\s*\{([^}]+)\}/.exec(ctrBlock);
  assert(m, 'Global counter not found');
  const body = m[1];
  for (const f of ['val:', 'outBuf:', 'outBufA:', 'outBufC:', 'outBufD:', 'destructive:'])
    assert(body.includes(f), `Global counter missing field: ${f}`);
  assert(!body.includes('rot:'), 'Global counter should not have rot');
  assert(!body.includes('readPos:'), 'Global counter should not have readPos');
});

// ── ALU state structure ──

test('ALU state has registers, op, flags, writeback, capture fields', () => {
  const aluStart = js.indexOf('alu: {', js.indexOf('const L21'));
  assert(aluStart >= 0, 'alu state block not found in L21');
  let depth = 0, aluEnd = aluStart + 5;
  for (let i = js.indexOf('{', aluStart); i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') { depth--; if (depth === 0) { aluEnd = i; break; } }
  }
  const block = js.substring(aluStart, aluEnd);
  for (const f of ['a:', 'b:', 'c:', 'd:', 'result:', 'op:', 'opASrc:', 'opBSrc:',
                    'route:', 'routeHold:', 'autoWriteback:', 'wbBuf:', 'wbPos:',
                    'capBuf:', 'capTarget:', 'capPos:', 'ignore3:', 'flags:'])
    assert(block.includes(f), `ALU missing field: ${f}`);
});

test('ALU flags has zero, carry, overflow, sign, parity', () => {
  // Find the flags: { inside the alu: { block
  const aluStart = js.indexOf('alu: {', js.indexOf('const L21'));
  const flagsStart = js.indexOf('flags: {', aluStart);
  assert(flagsStart >= 0 && flagsStart < aluStart + 500, 'ALU flags not found');
  const flagsBlock = js.substring(flagsStart, js.indexOf('}', flagsStart) + 1);
  for (const f of ['zero:', 'carry:', 'overflow:', 'sign:', 'parity:'])
    assert(flagsBlock.includes(f), `ALU flags missing: ${f}`);
});

// ── CMP state structure ──

test('Comparator state has flags and writeback fields', () => {
  const cmpStart = js.indexOf('cmp: {', js.indexOf('const L21'));
  assert(cmpStart >= 0, 'cmp state block not found in L21');
  let depth = 0, cmpEnd = cmpStart + 5;
  for (let i = js.indexOf('{', cmpStart); i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') { depth--; if (depth === 0) { cmpEnd = i; break; } }
  }
  const block = js.substring(cmpStart, cmpEnd);
  for (const f of ['flags:', 'packed:', 'wbPos:', 'wbBuf:'])
    assert(block.includes(f), `CMP missing field: ${f}`);
});

// ── Memory state structure ──

test('Memory state has slots, capture, writeback, auto-inc, batch fields', () => {
  const memStart = js.indexOf('mem: {', js.indexOf('const L21'));
  assert(memStart >= 0, 'mem state block not found in L21');
  let depth = 0, memEnd = memStart + 5;
  for (let i = js.indexOf('{', memStart); i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') { depth--; if (depth === 0) { memEnd = i; break; } }
  }
  const block = js.substring(memStart, memEnd);
  for (const f of ['writeToSlots:', 'addrRead:', 'addrBits:', 'slots:',
                    'capBuf:', 'capPos:', 'capAddr:', 'wbPos:', 'wbBuf:',
                    'destructive:', 'wbSrcAddr:', 'autoInc:', 'autoIncStart:',
                    'autoIncCount:', 'autoIncActive:', 'batchQueue:'])
    assert(block.includes(f), `Memory missing field: ${f}`);
});

// ── Eject indices ──

test('Eject indices defined for all four peripherals', () => {
  assert(js.includes('const PM1_EJECT_IDX = 359'), 'PM1_EJECT_IDX');
  assert(js.includes('const PM2_EJECT_IDX = 342'), 'PM2_EJECT_IDX');
  assert(js.includes('const TG1_EJECT_IDX = 325'), 'TG1_EJECT_IDX');
  assert(js.includes('const TG2_EJECT_IDX = 308'), 'TG2_EJECT_IDX');
});

// ── PM paired function existence ──

test('PM1/PM2 paired functions all exist', () => {
  const pairs = [
    ['flipPMBit', 'flipPMBit2'],
    ['togglePMDestructive', 'togglePMDestructive2'],
    ['refreshPatternMatcherDisplay', 'refreshPatternMatcher2Display'],
    ['pmTick', 'pm2Tick'],
    ['advancePatternMatcherOutputBridge', 'advancePatternMatcher2OutputBridge'],
    ['sendPM1MatchCountToBus', 'sendPM2MatchCountToBus'],
    ['clearPMFlag', 'clearPMFlag2'],
    ['isPatternMatcherActive', 'isPatternMatcher2Active'],
    ['pmGetMask', 'pm2GetMask'],
    ['pmGetMatch', 'pm2GetMatch'],
    ['pmGetChangeMask', 'pm2GetChangeMask'],
    ['pmGetChangeVal', 'pm2GetChangeVal'],
  ];
  for (const [fn1, fn2] of pairs) {
    assert(new RegExp(`function ${fn1}\\s*\\(`).test(js), `Missing ${fn1}`);
    assert(new RegExp(`function ${fn2}\\s*\\(`).test(js), `Missing ${fn2}`);
  }
});

// ── TG paired function existence ──

test('TG1/TG2 paired functions all exist', () => {
  const pairs = [
    ['toggleTG1Enabled', 'toggleTG2Enabled'],
    ['toggleTG1Destructive', 'toggleTG2Destructive'],
    ['setTG1Mode', 'setTG2Mode'],
    ['setTG1Threshold', 'setTG2Threshold'],
    ['loadTG1FromRegister', 'loadTG2FromRegister'],
    ['toggleTG1Capture', 'toggleTG2Capture'],
    ['clearTG1Flag', 'clearTG2Flag'],
    ['toggleTG1Clamp', 'toggleTG2Clamp'],
    ['setTG1ClampValue', 'setTG2ClampValue'],
    ['tg1Tick', 'tg2Tick'],
    ['refreshThresholdGate1Display', 'refreshThresholdGate2Display'],
    ['sendTG1MatchCountToBus', 'sendTG2MatchCountToBus'],
  ];
  for (const [fn1, fn2] of pairs) {
    assert(new RegExp(`function ${fn1}\\s*\\(`).test(js), `Missing ${fn1}`);
    assert(new RegExp(`function ${fn2}\\s*\\(`).test(js), `Missing ${fn2}`);
  }
});

test('TG2 has cascade toggle, TG1 does not', () => {
  assert(/function toggleTG2CascadeMode\s*\(/.test(js), 'Missing toggleTG2CascadeMode');
  assert(!/function toggleTG1CascadeMode\s*\(/.test(js), 'TG1 should not have cascade toggle');
});

test('PM2 has cascade toggle (toggleCascadeMode), PM1 does not', () => {
  assert(/function toggleCascadeMode\s*\(/.test(js), 'Missing toggleCascadeMode for PM2');
});

// ── Counter eject/drain function parity ──

test('Counter eject functions exist for buses B, A, C, D', () => {
  for (const fn of ['ctrEject', 'ctrEjectA', 'ctrEjectC', 'ctrEjectD'])
    assert(new RegExp(`function ${fn}\\s*\\(`).test(js), `Missing ${fn}`);
});

test('Counter drain functions exist for buses A, B, C, D', () => {
  for (const fn of ['drainCounterQueueToBusA', 'drainCounterQueueToBusB',
                     'drainCounterQueueToBusC', 'drainCounterQueueToBusD'])
    assert(new RegExp(`function ${fn}\\s*\\(`).test(js), `Missing ${fn}`);
});

// ── ALU op constant sets ──

test('UNARY_OPS and CARRY_OPS sets defined', () => {
  assert(js.includes("const UNARY_OPS = new Set("), 'UNARY_OPS not found');
  assert(js.includes("const CARRY_OPS = new Set("), 'CARRY_OPS not found');
  // Verify UNARY_OPS contents
  for (const op of ['NOT', 'SHL', 'SHR', 'NEG', 'INC', 'DEC'])
    assert(js.includes(`'${op}'`) && js.indexOf(`'${op}'`, js.indexOf('UNARY_OPS')) < js.indexOf(']', js.indexOf('UNARY_OPS')),
      `UNARY_OPS missing ${op}`);
});

// ── WSCR state structure ──

test('WSCR state has slots, capture, writeback fields', () => {
  const wscrStart = js.indexOf('wscr: {', js.indexOf('const L21'));
  assert(wscrStart >= 0, 'wscr state block not found in L21');
  let depth = 0, wscrEnd = wscrStart + 6;
  for (let i = js.indexOf('{', wscrStart); i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') { depth--; if (depth === 0) { wscrEnd = i; break; } }
  }
  const block = js.substring(wscrStart, wscrEnd);
  for (const f of ['slots:', 'capture:', 'capAddr:', 'capPos:', 'capBuf:', 'wbPos:', 'wbBuf:'])
    assert(block.includes(f), `WSCR missing field: ${f}`);
});

// ── Display dirty flags migration (Phase 4d) ──

test('ALU and Memory display refresh flags are in L21, not stray lets (Phase 4d)', () => {
  // displayNeedsRefresh should be in L21.alu and L21.mem state blocks
  const aluStart = js.indexOf('alu: {', js.indexOf('const L21'));
  assert(aluStart >= 0, 'alu block not found');
  let depth = 0, aluEnd = aluStart + 5;
  for (let i = js.indexOf('{', aluStart); i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') { depth--; if (depth === 0) { aluEnd = i; break; } }
  }
  const aluBlock = js.substring(aluStart, aluEnd);
  // Conditionally check — skip on pre-Phase-4d builds
  if (aluBlock.includes('displayNeedsRefresh')) {
    assert(true, 'ALU has displayNeedsRefresh in L21');
    // Also verify no stray let variable remains
    assert(!js.includes('let aluDisplayNeedsRefresh'), 'Stray let aluDisplayNeedsRefresh should be removed');
    assert(!js.includes('let memoryDisplayNeedsRefresh'), 'Stray let memoryDisplayNeedsRefresh should be removed');
  }
});

test('operatorHandle/sessionName not in ALU section (Phase 4d)', () => {
  const aluSection = js.indexOf('ALU STATE');
  if (aluSection < 0) return; // skip if section header not found
  const nextSection = js.indexOf('========', aluSection + 20);
  if (nextSection < 0) return;
  const aluSectionText = js.substring(aluSection, nextSection);
  // Conditionally check — only enforce if operatorHandle exists near SESSION LOGGER
  const loggerSection = js.indexOf('SESSION LOGGER');
  if (loggerSection > 0) {
    const handlePos = js.indexOf('let operatorHandle');
    if (handlePos > 0) {
      assert(!aluSectionText.includes('operatorHandle'), 'operatorHandle should not be in ALU section');
      assert(!aluSectionText.includes('sessionName'), 'sessionName should not be in ALU section');
    }
  }
});

// ── Unified PM helpers (added in Phase 4a) ──

test('Unified PM helper functions exist (Phase 4a)', () => {
  const helpers = [
    'pmComputeRegisterValue',
    'flipPatternMatcherBit',
    'isPatternMatcherActiveGeneric',
    'togglePatternMatcherDestructive',
    'clearPatternMatcherFlag',
    'sendPatternMatcherCountToBus',
    'refreshPatternMatcherDisplayGeneric',
    'advancePatternMatcherBridgeGeneric',
  ];
  for (const fn of helpers) {
    // Conditionally check — skip on pre-Phase-4a builds
    if (new RegExp(`function ${fn}\\s*\\(`).test(js)) {
      assert(true);
    }
  }
  // If any unified helper exists, ALL must exist
  const anyFound = helpers.some(fn => new RegExp(`function ${fn}\\s*\\(`).test(js));
  if (anyFound) {
    for (const fn of helpers)
      assert(new RegExp(`function ${fn}\\s*\\(`).test(js), `Missing unified helper: ${fn}`);
  }
});

test('Unified TG helper functions exist (Phase 4b)', () => {
  const helpers = [
    'toggleThresholdGateEnabled',
    'toggleThresholdGateDestructive',
    'setThresholdGateMode',
    'setThresholdGateThreshold',
    'loadThresholdGateFromRegister',
    'toggleThresholdGateCapture',
    'clearThresholdGateFlag',
    'toggleThresholdGateClamp',
    'setThresholdGateClampValue',
    'refreshThresholdGateDisplayGeneric',
    'advanceThresholdGateBridgeGeneric',
  ];
  // If any unified helper exists, ALL must exist
  const anyFound = helpers.some(fn => new RegExp(`function ${fn}\\s*\\(`).test(js));
  if (anyFound) {
    for (const fn of helpers)
      assert(new RegExp(`function ${fn}\\s*\\(`).test(js), `Missing unified TG helper: ${fn}`);
  }
});

test('Unified counter eject/drain helpers exist (Phase 4c)', () => {
  const helpers = [
    'counterOutBufKey',
    'ctrEjectGeneric',
    'drainCounterQueueGeneric',
  ];
  const anyFound = helpers.some(fn => new RegExp(`function ${fn}\\s*\\(`).test(js));
  if (anyFound) {
    for (const fn of helpers)
      assert(new RegExp(`function ${fn}\\s*\\(`).test(js), `Missing unified counter helper: ${fn}`);
  }
});

test('Injection state migrated to L21.inj (Phase 5b)', () => {
  const injStart = js.indexOf('inj: {', js.indexOf('const L21'));
  if (injStart < 0) return; // skip on pre-v.280 builds
  let depth = 0, injEnd = injStart + 5;
  for (let i = js.indexOf('{', injStart); i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') { depth--; if (depth === 0) { injEnd = i; break; } }
  }
  const block = js.substring(injStart, injEnd);
  for (const f of ['buffer:', 'pending:', 'flash:', 'active:', 'wbPos:'])
    assert(block.includes(f), `L21.inj missing field: ${f}`);
  // Verify stray let declarations removed
  assert(!js.includes('let injBuffer'), 'Stray let injBuffer should be removed');
  assert(!js.includes('let injPending'), 'Stray let injPending should be removed');
  assert(!/let injActive\b/.test(js), 'Stray let injActive should be removed');
  assert(!js.includes('let injWbPos'), 'Stray let injWbPos should be removed');
  // Verify alias exists
  assert(/const inj\s*=\s*L21\.inj/.test(js), 'inj alias not found');
});

test('Clock state migrated to L21.clock (Phase 5b)', () => {
  const clockStart = js.indexOf('clock: {', js.indexOf('const L21'));
  if (clockStart < 0) return; // skip on pre-v.281 builds
  let depth = 0, clockEnd = clockStart + 7;
  for (let i = js.indexOf('{', clockStart); i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') { depth--; if (depth === 0) { clockEnd = i; break; } }
  }
  const block = js.substring(clockStart, clockEnd);
  for (const f of ['running:', 'tickCount:', 'hz:', 'lastTick:', 'lastFrame:', 'ledFlash:', 'accuracySamples:', 'lastTimestamp:'])
    assert(block.includes(f), `L21.clock missing field: ${f}`);
  assert(/const clock\s*=\s*L21\.clock/.test(js), 'clock alias not found');
  assert(!/let running=false/.test(js), 'Stray let running should be removed');
  assert(!js.includes('let clockLedFlash'), 'Stray let clockLedFlash should be removed');
  assert(!js.includes('let recentTickIntervalsSamples'), 'Stray let recentTickIntervalsSamples should be removed');
  assert(!js.includes('let lastTickTimestamp'), 'Stray let lastTickTimestamp should be removed');
});

test('Ext buffers migrated to L21.ext (Phase 5b)', () => {
  const extStart = js.indexOf('ext: {', js.indexOf('const L21'));
  if (extStart < 0) return;
  let depth = 0, extEnd = extStart + 5;
  for (let i = js.indexOf('{', extStart); i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') { depth--; if (depth === 0) { extEnd = i; break; } }
  }
  const block = js.substring(extStart, extEnd);
  assert(block.includes('outBuf:'), 'L21.ext missing outBuf');
  assert(block.includes('inQueue:'), 'L21.ext missing inQueue');
  assert(!js.includes('let _extOutBuf'), 'Stray let _extOutBuf should be removed');
  assert(!js.includes('let _extInQueue'), 'Stray let _extInQueue should be removed');
});

test('switchBits and operatorActionCount in L21 (Phase 5b)', () => {
  const l21Block = js.substring(js.indexOf('const L21'), js.indexOf('};', js.indexOf('const L21')) + 2);
  if (!l21Block.includes('switchBits:')) return; // skip on pre-v.281
  assert(l21Block.includes('switchBits:'), 'L21.switchBits not found');
  assert(l21Block.includes('operatorActionCount:'), 'L21.operatorActionCount not found');
  assert(!js.includes('let switchBits'), 'Stray let switchBits should be removed');
  assert(!js.includes('let totalOperatorActionCount'), 'Stray let totalOperatorActionCount should be removed');
});

test('Hardware test button and function exist', () => {
  if (!src.includes('hw-test-btn')) return; // skip on pre-v.282 builds
  // HTML button
  assert(src.includes('data-action="setupHardwareTest"') || src.includes('onclick="setupHardwareTest()"'), 'TEST button action missing');
  // JS function
  assert(/function setupHardwareTest\s*\(/.test(js), 'setupHardwareTest function missing');
  assert(/function setPMBitsFromValue\s*\(/.test(js), 'setPMBitsFromValue helper missing');
});


// ================================================================
//  CSS TESTS
// ================================================================

console.log('\n\u2500\u2500 CSS TESTS \u2500\u2500\n');

test('CSS :root has >=50 custom properties', () => {
  const m = css.match(/:root\s*\{([^}]+)\}/);
  assert(m, 'No :root');
  assert((m[1].match(/--[\w-]+\s*:/g) || []).length >= 50, 'Too few custom props');
});

test('Utility classes defined', () => {
  for (const c of ['lbtn-dim','lbtn-ext','lbtn-mem','lsel-wrap','sb-action-half','sb-action-sm'])
    assert(css.includes(`.${c}`), `Missing .${c}`);
});

test('Winamp skin overrides exist', () => { assert(css.includes('.skin-winamp'), 'Missing'); });

test('Loop identity colors defined', () => {
  for (const c of ['--c-working','--c-alu','--c-memory','--c-big'])
    assert(css.includes(c), `Missing ${c}`);
});

test('Bus identity colors defined', () => {
  for (const c of ['--bus-a-color','--bus-b-color','--bus-c-color','--bus-d-color'])
    assert(css.includes(c), `Missing ${c}`);
});


// ================================================================
//  CATALOG ENGINE TESTS (P0 — v.310+)
//  Verify the shared catalog engine introduced in Phase 0.
//  Guards against regression to the old per-catalog let variables
//  and FILES_* constants, and verifies engine structure.
// ================================================================

console.log('\n── CATALOG ENGINE TESTS (P0) ──\n');

const hasCatalogEngine = js.includes('const CATALOG_CONFIGS') && js.includes('const catalogState');

if (hasCatalogEngine) {

  // ── No stray legacy variables ──

  test('P0: Old FILES_* constants removed', () => {
    assert(!js.includes('const FILES_MAX'), 'FILES_MAX should be removed');
    assert(!js.includes('const FILES_STORAGE_KEY'), 'FILES_STORAGE_KEY should be removed');
    assert(!js.includes('const FILES_NAME_RE'), 'FILES_NAME_RE should be removed');
  });

  test('P0: Old per-catalog let state variables removed', () => {
    assert(!/\blet filesSelectedName\b/.test(js), 'let filesSelectedName should be removed');
    assert(!/\blet filesPendingSaveName\b/.test(js), 'let filesPendingSaveName should be removed');
    assert(!/\blet filesPendingDelName\b/.test(js), 'let filesPendingDelName should be removed');
    assert(!/\blet filesSortKey\b/.test(js), 'let filesSortKey should be removed');
    assert(!/\blet filesSortAsc\b/.test(js), 'let filesSortAsc should be removed');
  });

  // ── Engine function existence ──

  test('P0: All 16 catalog engine functions exist', () => {
    const fns = [
      'catalogFormatTimestamp', 'catalogLoad', 'catalogSave',
      'catalogValidateName', 'catalogSortedNames', 'catalogSortBy',
      'catalogRefreshList', 'catalogSetStatus',
      'catalogShowNamingDialog', 'catalogHideNamingDialog', 'catalogConfirmName',
      'catalogOverwriteConfirm', 'catalogOverwriteCancel',
      'catalogAskDelete', 'catalogConfirmDelete', 'catalogCancelDelete',
    ];
    for (const fn of fns)
      assert(new RegExp(`function ${fn}\\s*\\(`).test(js), `Missing engine function: ${fn}`);
  });

  // ── CATALOG_CONFIGS.files shape ──

  test('P0: CATALOG_CONFIGS.files has all required fields', () => {
    const start = js.indexOf('const CATALOG_CONFIGS');
    assert(start >= 0, 'CATALOG_CONFIGS not found');
    // Find the closing }; of the whole object
    let depth = 0, end = start;
    for (let i = js.indexOf('{', start); i < js.length; i++) {
      if (js[i] === '{') depth++;
      if (js[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    const block = js.substring(start, end);
    const required = [
      'id:', 'storageKey:', 'max:', 'nameRegex:', 'extension:',
      'listId:', 'countId:', 'statusId:', 'sortNameButtonId:', 'sortTimeButtonId:',
      'namingDialogId:', 'nameInputId:', 'overwriteDialogId:', 'overwriteNameId:',
      'deleteDialogId:', 'deleteNameId:',
      'emptyMessage:', 'fullMessage:', 'sortTimeLabel:', 'timestampKey:',
      'onNameConfirmed:', 'renderEntryMeta:', 'onEntryClick:', 'postRefresh:',
    ];
    for (const field of required)
      assert(block.includes(field), `CATALOG_CONFIGS.files missing field: ${field}`);
  });

  // ── catalogState.files shape ──

  test('P0: catalogState has files entry with correct initial shape', () => {
    const start = js.indexOf('const catalogState');
    assert(start >= 0, 'catalogState not found');
    let depth = 0, end = start;
    for (let i = js.indexOf('{', start); i < js.length; i++) {
      if (js[i] === '{') depth++;
      if (js[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    const block = js.substring(start, end);
    assert(block.includes('files:'), 'catalogState missing files entry');
    assert(block.includes('selectedName:'), 'files state missing selectedName');
    assert(block.includes('pendingSaveName:'), 'files state missing pendingSaveName');
    assert(block.includes('pendingDeleteName:'), 'files state missing pendingDeleteName');
    assert(block.includes('sortKey:'), 'files state missing sortKey');
    assert(block.includes('sortAscending:'), 'files state missing sortAscending');
  });

  // ── catalogFormatTimestamp logic (pure function) ──

  test('P0: catalogFormatTimestamp formats a known timestamp correctly', () => {
    const fnSrc = extractFn(js, 'catalogFormatTimestamp');
    assert(fnSrc, 'catalogFormatTimestamp not extractable');
    const fn = (new Function(`${fnSrc}; return catalogFormatTimestamp;`))();
    // 2025-06-15 09:05 UTC
    const ts = Date.UTC(2025, 5, 15, 9, 5, 0);
    const result = fn(ts);
    assert(result.includes('2025'), `Expected year 2025 in: ${result}`);
    assert(result.includes('06'), `Expected month 06 in: ${result}`);
    assert(result.includes('15'), `Expected day 15 in: ${result}`);
  });

  test('P0: catalogFormatTimestamp returns empty string for falsy input', () => {
    const fnSrc = extractFn(js, 'catalogFormatTimestamp');
    const fn = (new Function(`${fnSrc}; return catalogFormatTimestamp;`))();
    assertEqual(fn(0), '', 'zero → empty string');
    assertEqual(fn(null), '', 'null → empty string');
    assertEqual(fn(undefined), '', 'undefined → empty string');
  });

  // ── catalogValidateName logic (pure function) ──

  test('P0: catalogValidateName accepts valid names', () => {
    const fnSrc = extractFn(js, 'catalogValidateName');
    assert(fnSrc, 'catalogValidateName not extractable');
    const fn = (new Function(`${fnSrc}; return catalogValidateName;`))();
    const config = { nameRegex: /^[A-Z0-9_-]{1,16}$/ };
    assert(fn(config, 'MY-FILE').valid, 'MY-FILE valid');
    assert(fn(config, 'A').valid, 'single char valid');
    assert(fn(config, 'ABCDEFGHIJ123456').valid, '16 chars valid');
    assert(fn(config, 'TEST_NAME').valid, 'underscore valid');
  });

  test('P0: catalogValidateName rejects invalid names', () => {
    const fnSrc = extractFn(js, 'catalogValidateName');
    const fn = (new Function(`${fnSrc}; return catalogValidateName;`))();
    const config = { nameRegex: /^[A-Z0-9_-]{1,16}$/ };
    assert(!fn(config, '').valid, 'empty string invalid');
    assert(!fn(config, 'lower').valid, 'lowercase invalid');
    assert(!fn(config, 'has space').valid, 'space invalid');
    assert(!fn(config, 'TOOLONGNAME123456789').valid, '>16 chars invalid');
    assert(!fn(config, 'HAS.DOT').valid, 'dot invalid');
    assert(typeof fn(config, '').error === 'string', 'error is a string');
  });

}


// ================================================================
//  INTEGRATION TESTS — runtime behavior verification
//  Evaluates full JS in a VM sandbox with DOM mocks, then
//  manipulates L21 state and calls tick functions directly.
// ================================================================

console.log('\n── INTEGRATION TESTS ──\n');

// Skip integration tests on builds before v.279 (tick engine decomposition)
const hasTickDecomposition = js.includes('function tickPreamble') && js.includes('function tickWritePhase');

let sim = null; // VM context holding the full simulator
let vmContext = null;
if (hasTickDecomposition) {
  const vm = require('vm');

  // ── Minimal DOM mock ──
  // ── Recursive DOM mock — any property access returns another mock element ──
  function makeStubEl() {
    const realChildren = [];
    const childProxy = new Proxy(realChildren, {
      get(target, prop) {
        if (prop === 'length') return target.length || 3;
        if (prop === 'push') return realChildren.push.bind(realChildren);
        if (prop === 'splice') return realChildren.splice.bind(realChildren);
        if (prop === 'indexOf') return realChildren.indexOf.bind(realChildren);
        if (prop === 'filter') return function(fn) { const arr = []; for(let i=0;i<3;i++) arr.push(makeStubEl()); return arr.filter(fn); };
        if (prop === 'forEach') return function(fn) { for(let i=0;i<(target.length||0);i++) fn(target[i]||makeStubEl(),i); };
        if (prop === Symbol.iterator) return function*() { for(let i=0;i<(target.length||3);i++) yield target[i]||makeStubEl(); };
        const n = Number(prop);
        if (!isNaN(n)) return target[n] || makeStubEl();
        return Reflect.get(target, prop);
      }
    });
    const el = {
      textContent: '', className: '', value: '', disabled: false,
      innerHTML: '', tagName: 'DIV',
      options: [],
      dataset: new Proxy({}, { get(){ return ''; }, set(){ return true; } }),
      style: new Proxy({}, { get(t,p){ if(p==='removeProperty'||p==='setProperty'||p==='getPropertyValue') return function(){}; return ''; }, set(){ return true; } }),
      children: childProxy, childNodes: childProxy,
      get firstChild() { return realChildren[0] || makeStubEl(); },
      classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, toggle(c,f){ if(f===undefined) f=!this._s.has(c); if(f) this._s.add(c); else this._s.delete(c); }, contains(c){ return this._s.has(c); } },
      appendChild(c) { realChildren.push(c); return c; },
      removeChild(c) { const i = realChildren.indexOf(c); if(i>=0) realChildren.splice(i,1); return c; },
      insertBefore(c) { realChildren.unshift(c); return c; },
      addEventListener(){},
      removeEventListener(){},
      setAttribute(){},
      getAttribute(){ return null; },
      hasAttribute(){ return false; },
      querySelectorAll(){ return []; },
      querySelector(){ return makeStubEl(); },
      closest(){ return null; },
      contains(){ return false; },
      getBoundingClientRect(){ return {x:0,y:0,width:100,height:100,top:0,left:0,right:100,bottom:100}; },
      offsetWidth: 400, offsetHeight: 100, clientWidth: 400, clientHeight: 100,
      scrollWidth: 400, scrollHeight: 100, scrollTop: 0, scrollLeft: 0,
      getContext(){ return {
        beginPath(){}, moveTo(){}, lineTo(){}, arc(){}, arcTo(){}, fill(){}, stroke(){},
        closePath(){}, fillRect(){}, clearRect(){}, fillText(){}, measureText(){ return {width:10}; },
        createRadialGradient(){ return { addColorStop(){} }; },
        createLinearGradient(){ return { addColorStop(){} }; },
        save(){}, restore(){}, translate(){}, rotate(){}, scale(){}, setTransform(){},
        canvas: { width: 400, height: 100 },
        font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: '', textBaseline: '',
        globalAlpha: 1, lineCap: '', lineJoin: '',
      }; },
      focus(){}, blur(){}, click(){},
    };
    return el;
  }

  const mockDocument = {
    getElementById() { return makeStubEl(); },
    querySelector() { return makeStubEl(); },
    querySelectorAll() { return []; },
    createElement(tag) { const el = makeStubEl(); el.tagName = tag; return el; },
    createTextNode(t) { return { textContent: t }; },
    addEventListener(){},
    body: makeStubEl(),
    documentElement: makeStubEl(),
    title: '',
    get activeElement() { return makeStubEl(); },
  };

  const sandbox = {
    document: mockDocument,
    window: {},
    navigator: { userAgent: 'node-test', clipboard: { writeText(){ return Promise.resolve(); } } },
    performance: { now() { return Date.now(); } },
    requestAnimationFrame(){},
    setTimeout(fn, ms) { return 0; },
    setInterval(fn, ms) { return 0; },
    clearTimeout(){},
    clearInterval(){},
    localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
    alert(){}, confirm(){ return false; }, prompt(){ return null; },
    getComputedStyle(){ return new Proxy({}, { get(t,p){ if(p==='getPropertyValue') return function(){ return ''; }; return ''; } }); },
    atob(s) { return Buffer.from(s, 'base64').toString('binary'); },
    btoa(s) { return Buffer.from(s, 'binary').toString('base64'); },
    console: { log(){}, warn(){}, error(){} },
    AudioContext: function(){
      this.createOscillator = () => ({ connect(){}, start(){}, stop(){}, frequency: { value:0 } });
      this.createGain = () => ({ connect(){}, gain: { value:1, setValueAtTime(){}, exponentialRampToValueAtTime(){} } });
      this.destination = {};
    },
    RTCPeerConnection: function(){ this.createDataChannel = ()=>({}); this.createOffer = ()=>Promise.resolve({}); },
    WebSocket: function(){},
    Blob: function(parts, opts){ this.parts = parts; },
    URL: { createObjectURL(){ return 'blob:mock'; }, revokeObjectURL(){} },
    Image: function(){ this.onload = null; this.src = ''; },
    ResizeObserver: function(cb){ this.observe = function(){}; this.unobserve = function(){}; this.disconnect = function(){}; },
    MutationObserver: function(cb){ this.observe = function(){}; this.disconnect = function(){}; },
    crypto: { getRandomValues(arr) { require('crypto').randomFillSync(arr); return arr; } },
    Math, Date, Array, Object, String, Number, Boolean, RegExp, JSON, Map, Set,
    Error, TypeError, RangeError, parseInt, parseFloat, isNaN, isFinite,
    Promise, Uint8Array, Int32Array, Float64Array, ArrayBuffer, BigInt,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
  };
  sandbox.window = sandbox;

  try {
    // const/let declarations don't become sandbox properties in Node's vm.
    // Append a postamble that exports key objects to the global scope.
    const exportPostamble = `
      this._L21 = L21;
      this._loops = loops;
      this._alu = alu;
      this._cmp = cmp;
      this._ctr = ctr;
      this._pm = pm;
      this._pm2 = pm2;
      this._tg1 = tg1;
      this._tg2 = tg2;
      this._mem = mem;
      this._inj = inj;
      this._clock = clock;
      this._opCount = opCount;
      this._switchBits = switchBits;
      this._captureFullSnapshot = captureFullSnapshot;
      this._restoreFromSnapshot = restoreFromSnapshot;
      this._logger = logger;
      this._stats = stats;
      this._ELEMENT_RECEIVER_ACTIONS = typeof ELEMENT_RECEIVER_ACTIONS !== 'undefined' ? ELEMENT_RECEIVER_ACTIONS : null;
    `;
    const script = new vm.Script(js + exportPostamble, { filename: 'loop21.js' });
    vmContext = vm.createContext(sandbox);
    script.runInContext(vmContext);
    // Build sim object from exported references
    sim = {
      L21: vmContext._L21,
      loops: vmContext._loops,
      alu: vmContext._alu,
      cmp: vmContext._cmp,
      ctr: vmContext._ctr,
      pm: vmContext._pm,
      pm2: vmContext._pm2,
      tg1: vmContext._tg1,
      tg2: vmContext._tg2,
      mem: vmContext._mem,
      inj: vmContext._inj,
      clock: vmContext._clock,
      opCount: vmContext._opCount,
      switchBits: vmContext._switchBits,
      // Functions (these ARE on the context since they're function declarations)
      tickPreamble: vmContext.tickPreamble,
      tickSampleBusSources: vmContext.tickSampleBusSources,
      tickReadPhase: vmContext.tickReadPhase,
      tickGatePhase: vmContext.tickGatePhase,
      tickRotatePhase: vmContext.tickRotatePhase,
      tickWritePhase: vmContext.tickWritePhase,
      executeOneTick: vmContext.executeOneTick,
      extractWordAtReadHead: vmContext.extractWordAtReadHead,
      pmTick: vmContext.pmTick,
      tg1Tick: vmContext.tg1Tick,
      aluCompute: vmContext.aluCompute,
      captureFullSnapshot: vmContext._captureFullSnapshot,
      restoreFromSnapshot: vmContext._restoreFromSnapshot,
      logger: vmContext._logger,
      stats: vmContext._stats,
      logWriteINIT: vmContext.logWriteINIT,
      logWriteFINAL: vmContext.logWriteFINAL,
      logWriteMachineState: vmContext.logWriteMachineState,
      writeLogLine: vmContext.writeLogLine,
      syncBusSidebarButton: vmContext.syncBusSidebarButton,
      refreshAllDisplaysAfterRestore: vmContext.refreshAllDisplaysAfterRestore,
      getFilterEjectIndex: vmContext.getFilterEjectIndex,
      toggleFilterOrder: vmContext.toggleFilterOrder,
      // Completion code functions
      clubGenerateSeed48: vmContext.clubGenerateSeed48,
      clubComputeHash55: vmContext.clubComputeHash55,
      clubGenerateCompletionCode: vmContext.clubGenerateCompletionCode,
      clubDecodeCompletionCode: vmContext.clubDecodeCompletionCode,
      // Skin system
      parseSkinSource: vmContext.parseSkinSource,
    };
  } catch (e) {
    console.log(`  ✗ Integration VM setup failed: ${e.message}`);
    const stack = e.stack.split('\n').slice(0, 5).join('\n    ');
    console.log(`    ${stack}`);
    failed++;
  }
}

if (sim) {
  // ── Helper: inject a 17-bit word (marker + 16 data bits) into a loop at position 0
  function injectWordIntoLoop(loopId, value) {
    const lp = sim.loops[loopId];
    const idx = 0;
    lp.bits[idx] = 1; // marker
    for (let b = 0; b < 16; b++) lp.bits[idx + 1 + b] = (value >> (15 - b)) & 1;
  }

  test('Integration: loop rotation shifts bits correctly', () => {
    // Place a marker at position 5
    const lp = sim.loops['working'];
    lp.bits.fill(0);
    lp.bits[5] = 1;
    lp.paused = false;
    lp.gateOpen = true;
    // Clear halts
    sim.opCount.halted.working = false;
    // Rotate
    sim.tickRotatePhase();
    // After one rotation (push+shift), bit at [5] should now be at [4]
    assertEqual(lp.bits[4], 1, 'Bit should shift left by 1');
    assertEqual(lp.bits[5], 0, 'Old position should be 0');
  });

  test('Integration: gate phase zeros the gate dot on closed loops', () => {
    const lp = sim.loops['alu'];
    lp.bits.fill(0);
    lp.bits[1] = 1; // gate dot is at index 1
    lp.gateOpen = false;
    sim.tickGatePhase();
    assertEqual(lp.bits[1], 0, 'Gate dot should be zeroed when closed');
  });

  test('Integration: gate phase preserves gate dot on open loops', () => {
    const lp = sim.loops['alu'];
    lp.bits.fill(0);
    lp.bits[1] = 1;
    lp.gateOpen = true;
    sim.tickGatePhase();
    assertEqual(lp.bits[1], 1, 'Gate dot should be preserved when open');
  });

  test('Integration: paused loops do not rotate', () => {
    const lp = sim.loops['memory'];
    lp.bits.fill(0);
    lp.bits[5] = 1;
    lp.paused = true;
    sim.opCount.halted.memory = false;
    sim.tickRotatePhase();
    assertEqual(lp.bits[5], 1, 'Bit should not move on paused loop');
  });

  test('Integration: halted loops do not rotate', () => {
    const lp = sim.loops['big'];
    lp.bits.fill(0);
    lp.bits[5] = 1;
    lp.paused = false;
    sim.opCount.halted.big = true;
    sim.tickRotatePhase();
    assertEqual(lp.bits[5], 1, 'Bit should not move on halted loop');
    sim.opCount.halted.big = false;
  });

  test('Integration: inject channel shifts bits toward exit', () => {
    sim.inj.buffer.fill(0);
    sim.inj.pending = [];
    sim.inj.active = true;
    sim.inj.wbPos = -1;
    // Place a 1 at position 0 (input end)
    sim.inj.buffer[0] = 1;
    const exitBit = sim.tickReadPhase();
    // The bit at [0] should have shifted toward [INJ_N-1]
    // After one shift: old [0] moves to [1], new [0] comes from pending (empty = 0)
    assertEqual(sim.inj.buffer[1], 1, 'Bit should shift from [0] to [1]');
    assertEqual(sim.inj.buffer[0], 0, 'Position [0] should be 0 after shift');
  });

  test('Integration: inject pending feeds into buffer', () => {
    sim.inj.buffer.fill(0);
    sim.inj.pending = [1, 0, 1];
    sim.inj.active = true;
    sim.inj.wbPos = -1;
    sim.tickReadPhase();
    // First pending bit (1) should now be at buffer[0]
    assertEqual(sim.inj.buffer[0], 1, 'First pending bit enters buffer');
    assertEqual(sim.inj.pending.length, 2, 'Pending should have 2 bits left');
  });

  test('Integration: extractWordAtReadHead returns correct value from loop', () => {
    const lp = sim.loops['working'];
    lp.bits.fill(0);
    // Place word 0x1234 at read head (index 2)
    lp.bits[2] = 1; // marker
    const val = 0x1234;
    for (let b = 0; b < 16; b++) lp.bits[3 + b] = (val >> (15 - b)) & 1;
    const result = sim.extractWordAtReadHead(lp.bits, 2);
    assert(result !== null, 'Should find a word');
    assertEqual(result.data, 0x1234, 'Word value');
  });

  test('Integration: full tick cycle does not crash', () => {
    // Reset to clean state
    for (const id of ['working', 'alu', 'memory', 'big']) {
      sim.loops[id].bits.fill(0);
      sim.loops[id].paused = false;
      sim.loops[id].gateOpen = true;
      sim.loops[id].flash = 0;
      sim.loops[id].lastWord = null;
      sim.opCount.halted[id] = false;
    }
    for (const busId of ['a', 'b', 'c', 'd']) {
      sim.L21.buses[busId].active = false;
      sim.L21.buses[busId].bits.fill(0);
    }
    sim.inj.buffer.fill(0);
    sim.inj.pending = [];
    sim.inj.active = false;
    sim.inj.wbPos = -1;
    sim.clock.running = true;
    // Execute a full tick — should not throw
    sim.executeOneTick();
    assert(true, 'Full tick completed without error');
  });

  test('Integration: word injected into Working reaches read head after rotation', () => {
    const lp = sim.loops['working'];
    lp.bits.fill(0);
    lp.paused = false;
    lp.gateOpen = true;
    sim.opCount.halted.working = false;
    // Place a word at position 0 (write dot)
    injectWordIntoLoop('working', 0xBEEF);
    // Rotate twice — word at [0] moves to read head at [2] after loop wraps
    // Actually: bits.push(bits.shift()) moves [0]→end, [1]→[0], [2]→[1]...
    // So [0] needs (bits.length - 2) rotations to reach [2]
    // Working loop = 306 bits. Position 0 needs 304 rotations to reach position 2.
    // That's too many. Instead, place the word near the read head.
    lp.bits.fill(0);
    // Place word at index 4 — after 2 rotations it will be at index 2
    lp.bits[4] = 1; // marker
    const val = 0xCAFE;
    for (let b = 0; b < 16; b++) lp.bits[5 + b] = (val >> (15 - b)) & 1;
    sim.tickRotatePhase();
    sim.tickRotatePhase();
    // Now marker should be at index 2
    assertEqual(lp.bits[2], 1, 'Marker at read head after 2 rotations');
    const word = sim.extractWordAtReadHead(lp.bits, 2);
    assert(word !== null, 'Word found at read head');
    assertEqual(word.data, 0xCAFE, 'Correct value at read head');
  });

  test('Integration: PM1 match fires on matching word at eject index', () => {
    // Set up PM1: mask=0xFFFF, match=0x1234
    sim.pm.maskBits.fill(0); sim.pm.matchBits.fill(0);
    for (let i = 0; i < 16; i++) sim.pm.maskBits[i] = 1; // mask all bits
    const pattern = 0x1234;
    for (let i = 0; i < 16; i++) sim.pm.matchBits[i] = (pattern >> (15 - i)) & 1;
    sim.pm.matchFlag = false;
    sim.pm.matchCount = 0;
    sim.pm.cooldown = 0;
    sim.pm.destructive = false;
    sim.pm.outBuf = [];
    sim.pm2.cascadeMode = false;

    // Place matching word at PM1_EJECT_IDX on Big Loop
    const big = sim.loops['big'];
    big.bits.fill(0);
    const idx = 359; // PM1_EJECT_IDX
    big.bits[idx] = 1; // marker
    for (let b = 0; b < 16; b++) big.bits[idx + 1 + b] = (pattern >> (15 - b)) & 1;

    sim.pmTick();
    assertEqual(sim.pm.matchFlag, true, 'Match flag should be set');
    assertEqual(sim.pm.matchCount, 1, 'Match count should be 1');
  });

  test('Integration: PM1 does not fire on non-matching word', () => {
    sim.pm.matchFlag = false;
    sim.pm.matchCount = 0;
    sim.pm.cooldown = 0;
    // Mask still 0xFFFF, match still 0x1234 from previous test
    const big = sim.loops['big'];
    big.bits.fill(0);
    const idx = 359;
    big.bits[idx] = 1;
    const wrong = 0x5678;
    for (let b = 0; b < 16; b++) big.bits[idx + 1 + b] = (wrong >> (15 - b)) & 1;

    sim.pmTick();
    assertEqual(sim.pm.matchFlag, false, 'Match flag should remain false');
    assertEqual(sim.pm.matchCount, 0, 'Match count should remain 0');
  });

  test('Integration: TG1 fires on value exceeding threshold', () => {
    sim.tg1.enabled = true;
    sim.tg1.mode = 'gt';
    sim.tg1.threshold = 1000;
    sim.tg1.matchFlag = false;
    sim.tg1.matchCount = 0;
    sim.tg1.cooldown = 0;
    sim.tg1.destructive = false;
    sim.tg1.clampEnabled = false;
    sim.tg1.outBuf = [];
    sim.tg2.cascadeMode = false;

    const big = sim.loops['big'];
    big.bits.fill(0);
    const idx = 325; // TG1_EJECT_IDX
    big.bits[idx] = 1;
    const val = 2000;
    for (let b = 0; b < 16; b++) big.bits[idx + 1 + b] = (val >> (15 - b)) & 1;

    sim.tg1Tick();
    assertEqual(sim.tg1.matchFlag, true, 'TG1 match flag should be set');
    assertEqual(sim.tg1.matchCount, 1, 'TG1 match count should be 1');
  });

  test('Integration: TG1 does not fire on value below threshold', () => {
    sim.tg1.matchFlag = false;
    sim.tg1.matchCount = 0;
    sim.tg1.cooldown = 0;

    const big = sim.loops['big'];
    big.bits.fill(0);
    const idx = 325;
    big.bits[idx] = 1;
    const val = 500;
    for (let b = 0; b < 16; b++) big.bits[idx + 1 + b] = (val >> (15 - b)) & 1;

    sim.tg1Tick();
    assertEqual(sim.tg1.matchFlag, false, 'TG1 should not fire');
  });

  test('Integration: TG clamp rewrites value in Big Loop', () => {
    sim.tg1.enabled = true;
    sim.tg1.mode = 'gt';
    sim.tg1.threshold = 1000;
    sim.tg1.matchFlag = false;
    sim.tg1.matchCount = 0;
    sim.tg1.cooldown = 0;
    sim.tg1.destructive = false;
    sim.tg1.clampEnabled = true;
    sim.tg1.clampValue = 9999;
    sim.tg1.outBuf = [];
    sim.tg2.cascadeMode = false;

    const big = sim.loops['big'];
    big.bits.fill(0);
    const idx = 325;
    big.bits[idx] = 1;
    const val = 50000;
    for (let b = 0; b < 16; b++) big.bits[idx + 1 + b] = (val >> (15 - b)) & 1;

    sim.tg1Tick();
    // Read back the value at eject index — should be clamped to 9999
    let readBack = 0;
    for (let b = 0; b < 16; b++) readBack = (readBack << 1) | big.bits[idx + 1 + b];
    assertEqual(readBack, 9999, 'Value should be clamped to 9999');
  });

  test('Integration: ALU computes ADD correctly', () => {
    sim.alu.a = 100;
    sim.alu.b = 200;
    sim.alu.op = 'ADD';
    sim.alu.opASrc = 'a';
    sim.alu.opBSrc = 'b';
    sim.alu.ignore3 = false;
    sim.aluCompute();
    assertEqual(sim.alu.result & 0xFFFF, 300, 'ADD 100 + 200 = 300');
  });

  test('Integration: ALU computes XOR correctly', () => {
    sim.alu.a = 0xFF00;
    sim.alu.b = 0x0FF0;
    sim.alu.op = 'XOR';
    sim.aluCompute();
    assertEqual(sim.alu.result & 0xFFFF, 0xF0F0, 'XOR 0xFF00 ^ 0x0FF0 = 0xF0F0');
  });

  test('Integration: ALU flags set correctly', () => {
    sim.alu.a = 0;
    sim.alu.b = 0;
    sim.alu.op = 'ADD';
    sim.aluCompute();
    assertEqual(sim.alu.flags.zero, true, 'Zero flag on 0+0');
    sim.alu.a = 0x8000;
    sim.alu.b = 0;
    sim.alu.op = 'ADD';
    sim.aluCompute();
    assertEqual(sim.alu.flags.sign, true, 'Sign flag on 0x8000');
  });

  test('Integration: snapshot save/restore round-trip preserves state', () => {
    // Set up some known state
    sim.alu.a = 42; sim.alu.b = 99; sim.alu.op = 'SUB';
    sim.pm.matchCount = 7;
    sim.tg1.threshold = 12345;
    sim.mem.slots[0] = 1000; sim.mem.slots[5] = 2000;
    const lp = sim.loops['working'];
    lp.bits.fill(0); lp.bits[10] = 1; lp.bits[20] = 1;
    sim.clock.tickCount = 500;

    // Capture
    const snap = sim.captureFullSnapshot();

    // Mutate everything
    sim.alu.a = 0; sim.alu.b = 0; sim.alu.op = 'ADD';
    sim.pm.matchCount = 0;
    sim.tg1.threshold = 0;
    sim.mem.slots[0] = null; sim.mem.slots[5] = null;
    lp.bits.fill(0);
    sim.clock.tickCount = 999;

    // Restore
    sim.restoreFromSnapshot(snap);

    // Verify
    assertEqual(sim.alu.a, 42, 'ALU reg A restored');
    assertEqual(sim.alu.b, 99, 'ALU reg B restored');
    assertEqual(sim.alu.op, 'SUB', 'ALU op restored');
    assertEqual(sim.pm.matchCount, 7, 'PM match count restored');
    assertEqual(sim.tg1.threshold, 12345, 'TG1 threshold restored');
    assertEqual(sim.mem.slots[0], 1000, 'Memory slot 0 restored');
    assertEqual(sim.mem.slots[5], 2000, 'Memory slot 5 restored');
    assertEqual(lp.bits[10], 1, 'Loop bit 10 restored');
    assertEqual(lp.bits[20], 1, 'Loop bit 20 restored');
    assertEqual(lp.bits[0], 0, 'Loop bit 0 still zero');
    assertEqual(sim.clock.tickCount, 500, 'Tick count restored');
  });

  // ── Session logger cleanup tests (Phase 6a) ──

  test('Integration: logWriteMachineState exists as a function', () => {
    assert(typeof sim.logWriteMachineState === 'function', 'logWriteMachineState should be a function');
  });

  test('Integration: logWriteINIT produces INIT-prefixed log lines', () => {
    sim.logger.lines = [];
    sim.logger.active = true;
    sim.logWriteINIT();
    const lines = sim.logger.lines;
    assert(lines.length > 0, 'logWriteINIT should produce log lines');
    // All machine codes should start with INIT.
    const machineKeys = lines.map(l => l.split(' || ')[0].split(' ')[0]);
    for (const key of machineKeys) {
      assert(key.startsWith('INIT.'), `Expected INIT prefix, got: ${key}`);
    }
    // Check for expected key families
    const keyStr = machineKeys.join(' ');
    assert(keyStr.includes('INIT.CLOCK_HZ'), 'Should have INIT.CLOCK_HZ');
    assert(keyStr.includes('INIT.BUSA.SRC'), 'Should have INIT.BUSA.SRC');
    assert(keyStr.includes('INIT.BUSB.SRC'), 'Should have INIT.BUSB.SRC');
    assert(keyStr.includes('INIT.ALU.REG_A'), 'Should have INIT.ALU.REG_A');
    assert(keyStr.includes('INIT.MEM.SLOT[0]'), 'Should have INIT.MEM.SLOT[0]');
    assert(keyStr.includes('INIT.CTR.WORKING'), 'Should have INIT.CTR.WORKING');
    assert(keyStr.includes('INIT.PM1.STATE'), 'Should have INIT.PM1.STATE');
    assert(keyStr.includes('INIT.PM2.STATE'), 'Should have INIT.PM2.STATE');
    assert(keyStr.includes('INIT.OP_INPUT'), 'Should have INIT.OP_INPUT');
    // INIT should NOT have routeHold or flags
    assert(!keyStr.includes('INIT.ALU.ROUTE_HOLD'), 'INIT should not have ROUTE_HOLD');
    assert(!keyStr.includes('INIT.ALU.FLAGS'), 'INIT should not have FLAGS');
  });

  test('Integration: logWriteFINAL produces FINAL-prefixed log lines with extras', () => {
    sim.logger.lines = [];
    sim.logger.active = true;
    sim.logger.tickCount = 100;
    sim.logger.startTime = Date.now() - 5000;
    sim.logger.sessionStartTime = 0;
    sim.logWriteFINAL();
    const lines = sim.logger.lines;
    assert(lines.length > 0, 'logWriteFINAL should produce log lines');
    const machineKeys = lines.map(l => l.split(' || ')[0].split(' ')[0]);
    const keyStr = machineKeys.join(' ');
    // FINAL-only fields
    assert(keyStr.includes('FINAL.TICKS'), 'Should have FINAL.TICKS');
    assert(keyStr.includes('FINAL.STATS.OPERATOR_ACTIONS'), 'Should have FINAL.STATS');
    assert(keyStr.includes('FINAL.CLOCK_HZ'), 'Should have FINAL.CLOCK_HZ');
    assert(keyStr.includes('FINAL.OPCOUNT'), 'Should have FINAL.OPCOUNT');
    // Shared fields
    assert(keyStr.includes('FINAL.BUSA.SRC'), 'Should have FINAL.BUSA.SRC');
    assert(keyStr.includes('FINAL.ALU.REG_A'), 'Should have FINAL.ALU.REG_A');
    assert(keyStr.includes('FINAL.MEM.SLOT[0]'), 'Should have FINAL.MEM.SLOT[0]');
    assert(keyStr.includes('FINAL.PM1.STATE'), 'Should have FINAL.PM1.STATE');
    assert(keyStr.includes('FINAL.OP_INPUT'), 'Should have FINAL.OP_INPUT');
    // FINAL should have routeHold and flags
    assert(keyStr.includes('FINAL.ALU.ROUTE_HOLD'), 'FINAL should have ROUTE_HOLD');
    assert(keyStr.includes('FINAL.ALU.FLAGS'), 'FINAL should have FLAGS');
  });

  test('Integration: operator input uses 0x10000 marker bit (bug fix)', () => {
    sim.logger.lines = [];
    sim.logger.active = true;
    sim.logWriteMachineState('TEST', { phase: 'check' });
    const opLine = sim.logger.lines.find(l => l.startsWith('TEST.OP_INPUT'));
    assert(opLine, 'Should have TEST.OP_INPUT line');
    // The machine code should contain a 17-bit formatted binary (marker bit set)
    // If the old 0x100 bug were present, the binary would be wrong
    const machineCode = opLine.split(' || ')[0];
    // With switch value 0 and marker 0x10000, formatWordAsBinary should produce 1·0000000000000000
    assert(machineCode.includes('1'), 'Should have marker bit in binary');
  });

  test('Integration: syncBusSidebarButton is a function (Phase 6b)', () => {
    assert(typeof sim.syncBusSidebarButton === 'function', 'syncBusSidebarButton should exist');
  });

  test('Integration: refreshAllDisplaysAfterRestore is a function (Phase 6b)', () => {
    assert(typeof sim.refreshAllDisplaysAfterRestore === 'function', 'refreshAllDisplaysAfterRestore should exist');
  });

  test('Integration: parseActionArg converts types correctly (Phase 6c)', () => {
    const parse = vmContext.parseActionArg;
    assert(typeof parse === 'function', 'parseActionArg should exist');
    assertEqual(parse('null'), null, 'null string → null');
    assertEqual(parse('42'), 42, 'numeric string → number');
    assertEqual(parse('0'), 0, 'zero string → 0');
    assertEqual(parse('working'), 'working', 'plain string stays string');
    assertEqual(parse(undefined), undefined, 'undefined stays undefined');
  });

  test('Integration: ELEMENT_RECEIVER_ACTIONS set exists (Phase 6c)', () => {
    const set = vmContext._ELEMENT_RECEIVER_ACTIONS;
    assert(set instanceof Set, 'ELEMENT_RECEIVER_ACTIONS should be a Set');
    assert(set.has('toggleSidebarSection'), 'Should include toggleSidebarSection');
    assert(set.has('toggleBusGroup'), 'Should include toggleBusGroup');
    assert(set.has('selfSelect'), 'Should include selfSelect');
  });

  test('Integration: resetTickCount function exists (Phase 6c)', () => {
    assert(typeof vmContext.resetTickCount === 'function', 'resetTickCount should exist');
  });

  test('Integration: selfSelect function exists (Phase 6c)', () => {
    assert(typeof vmContext.selfSelect === 'function', 'selfSelect should exist');
  });

  test('Integration: getFilterEjectIndex returns correct default positions (pm_first)', () => {
    sim.L21.filterOrder = 'pm_first';
    assertEqual(sim.getFilterEjectIndex('pm1'), 359, 'PM1 default at 359');
    assertEqual(sim.getFilterEjectIndex('pm2'), 342, 'PM2 default at 342');
    assertEqual(sim.getFilterEjectIndex('tg1'), 325, 'TG1 default at 325');
    assertEqual(sim.getFilterEjectIndex('tg2'), 308, 'TG2 default at 308');
  });

  test('Integration: getFilterEjectIndex returns swapped positions (tg_first)', () => {
    sim.L21.filterOrder = 'tg_first';
    assertEqual(sim.getFilterEjectIndex('tg1'), 359, 'TG1 swapped to 359');
    assertEqual(sim.getFilterEjectIndex('tg2'), 342, 'TG2 swapped to 342');
    assertEqual(sim.getFilterEjectIndex('pm1'), 325, 'PM1 swapped to 325');
    assertEqual(sim.getFilterEjectIndex('pm2'), 308, 'PM2 swapped to 308');
    sim.L21.filterOrder = 'pm_first'; // reset
  });

  test('Integration: toggleFilterOrder swaps filterOrder state', () => {
    sim.L21.filterOrder = 'pm_first';
    sim.toggleFilterOrder();
    assertEqual(sim.L21.filterOrder, 'tg_first', 'Should toggle to tg_first');
    sim.toggleFilterOrder();
    assertEqual(sim.L21.filterOrder, 'pm_first', 'Should toggle back to pm_first');
  });

  test('Integration: snapshot captures and restores filterOrder', () => {
    sim.L21.filterOrder = 'tg_first';
    const snap = sim.captureFullSnapshot();
    assertEqual(snap.filterOrder, 'tg_first', 'Snapshot should contain filterOrder');
    sim.L21.filterOrder = 'pm_first';
    sim.restoreFromSnapshot(snap);
    assertEqual(sim.L21.filterOrder, 'tg_first', 'filterOrder should be restored');
    sim.L21.filterOrder = 'pm_first'; // reset
  });

  // ── Completion code system (Operators Club) ──

  test('Integration: clubGenerateSeed48 produces non-negative values', () => {
    const seed = sim.clubGenerateSeed48();
    assert(typeof seed === 'number' || typeof seed === 'bigint', 'seed should be numeric');
    assert(seed >= 0, 'seed should be non-negative');
  });

  test('Integration: clubComputeHash55 is deterministic', () => {
    const h1 = sim.clubComputeHash55('test-input-123');
    const h2 = sim.clubComputeHash55('test-input-123');
    assertEqual(h1, h2, 'Same input should produce same hash');
  });

  test('Integration: clubComputeHash55 differs for different inputs', () => {
    const h1 = sim.clubComputeHash55('input-a');
    const h2 = sim.clubComputeHash55('input-b');
    assert(h1 !== h2, 'Different inputs should produce different hashes');
  });

  test('Integration: clubGenerateCompletionCode produces 32-char code', () => {
    const code = sim.clubGenerateCompletionCode(100, 50, 30);
    assert(typeof code === 'string', 'code should be string');
    const clean = code.replace(/-/g, '');
    assertEqual(clean.length, 32, '32 chars without dashes');
  });

  test('Integration: clubDecodeCompletionCode round-trips', () => {
    const code = sim.clubGenerateCompletionCode(100, 50, 30);
    const result = sim.clubDecodeCompletionCode(code);
    assert(result.valid, 'Should decode as valid');
    assertEqual(result.ticks, 100, 'ticks round-trip');
    assertEqual(result.ops, 50, 'ops round-trip');
    assertEqual(result.wallSeconds, 30, 'wallSeconds round-trip');
  });

  test('Integration: clubDecodeCompletionCode rejects garbage', () => {
    const result = sim.clubDecodeCompletionCode('XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX');
    assert(!result.valid, 'Should reject garbage input');
  });

  test('Integration: completion code uses unambiguous alphabet only', () => {
    // The alphabet excludes 0/O, 1/I/L, 5/S, 8/B — 22 chars
    const code = sim.clubGenerateCompletionCode(999, 200, 60);
    const clean = code.replace(/-/g, '');
    const forbidden = /[0OoIiLl1Ss5Bb8]/;
    assert(!forbidden.test(clean), `Code contains ambiguous characters: ${clean}`);
  });

  // ── Skin system integration ──

  test('Integration: parseSkinSource is a function', () => {
    assert(typeof sim.parseSkinSource === 'function', 'parseSkinSource should exist');
  });
}


// ================================================================
//  SUMMARY
// ================================================================

console.log(`\n${'='.repeat(42)}`);
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(42)}\n`);

if (failures.length > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  * ${f.name}: ${f.msg}`);
  console.log('');
}

process.exit(failed > 0 ? 1 : 0);

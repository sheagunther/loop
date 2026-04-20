'use strict';

const { execSync } = require('child_process');
const path = require('path');

const tiers = [
  'tier0.test.js',
  'tier1-vault-config.test.js',
  'tier1-all-vaults.test.js',
  'tier2-input-gates.test.js',
  'tier3-signal-loops.test.js',
  'tier4-compute.test.js',
  'tier5-workflow.test.js',
  'tier7-e2e.test.js'
];

let totalPassed = 0;
let totalFailed = 0;
let crashed = [];

for (const tier of tiers) {
  const filePath = path.join(__dirname, tier);
  try {
    const output = execSync(`node "${filePath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const match = output.match(/Results:\s+(\d+)\s+passed,\s+(\d+)\s+failed/);
    if (match) {
      const p = parseInt(match[1], 10);
      const f = parseInt(match[2], 10);
      totalPassed += p;
      totalFailed += f;
      const status = f > 0 ? '  FAIL' : '    OK';
      console.log(`${status}  ${tier}: ${p} passed, ${f} failed`);
    }
  } catch (err) {
    crashed.push(tier);
    const stderr = err.stderr || err.stdout || err.message;
    const errorLine = stderr.split('\n').find(l => l.includes('Error:')) || 'unknown error';
    console.log(` CRASH  ${tier}: ${errorLine.trim()}`);
  }
}

console.log(`\n${'═'.repeat(55)}`);
console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed, ${crashed.length} crashed`);
console.log(`${'═'.repeat(55)}`);

if (totalFailed > 0 || crashed.length > 0) process.exit(1);

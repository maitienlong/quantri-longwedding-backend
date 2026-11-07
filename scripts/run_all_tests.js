const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testDir = path.join(__dirname, '..', 'test');
const files = fs.readdirSync(testDir)
  .filter(f => f.startsWith('verify_') && f.endsWith('.js'))
  .sort();

console.log('===============================================================');
console.log(`🚀 [LONG WEDDING v2.0] RUNNING ALL TEST SUITES (${files.length} suites)`);
console.log('===============================================================\n');

let totalPassed = 0;
let totalFailed = 0;
const start = Date.now();

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const fullPath = path.join(testDir, file);
  console.log(`\n--- [${i + 1}/${files.length}] Running: ${file} ---`);
  try {
    const output = execSync(`node "${fullPath}"`, { encoding: 'utf8', stdio: 'inherit' });
    totalPassed++;
  } catch (err) {
    console.error(`❌ FAILED: ${file}`);
    totalFailed++;
    process.exit(1);
  }
}

const elapsed = ((Date.now() - start) / 1000).toFixed(2);
console.log('\n===============================================================');
console.log(`🎉 ALL ${files.length} TEST SUITES PASSED CLEANLY (${elapsed}s)`);
console.log('===============================================================');

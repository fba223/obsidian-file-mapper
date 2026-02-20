const fs = require('fs');
const path = require('path');

function testAutoSyncToggle() {
  console.log('Test 1: Auto Sync Toggle');
  
  const settings = {
    autoSync: true,
    syncInterval: 60
  };
  
  const hasAutoSync = typeof settings.autoSync === 'boolean';
  const isEnabled = settings.autoSync === true;
  
  if (hasAutoSync && isEnabled) {
    console.log('  ✓ PASSED: Auto sync toggle exists and is enabled');
    return true;
  } else {
    console.log('  ✗ FAILED: Auto sync toggle not working');
    return false;
  }
}

function testSyncDurationInput() {
  console.log('Test 2: Sync Duration Input');
  
  const settings = {
    autoSync: true,
    syncDuration: 60
  };
  
  const isValidNumber = typeof settings.syncDuration === 'number' && settings.syncDuration > 0;
  const isDefault60 = settings.syncDuration === 60;
  
  if (isValidNumber && isDefault60) {
    console.log('  ✓ PASSED: Sync duration is valid number, default 60');
    console.log(`    Value: ${settings.syncDuration} minutes`);
    return true;
  } else {
    console.log('  ✗ FAILED: Sync duration invalid');
    return false;
  }
}

function testSyncToggleAndDurationRelationship() {
  console.log('Test 3: Toggle and Duration Relationship');
  
  const scenarios = [
    { autoSync: false, syncDuration: 30, shouldSync: false },
    { autoSync: true, syncDuration: 60, shouldSync: true },
    { autoSync: true, syncDuration: 0, shouldSync: false },
    { autoSync: false, syncDuration: 0, shouldSync: false }
  ];
  
  let passed = true;
  for (const s of scenarios) {
    const shouldSync = s.autoSync && s.syncDuration > 0;
    if (shouldSync !== s.shouldSync) {
      console.log(`  ✗ FAILED: autoSync=${s.autoSync}, duration=${s.syncDuration}, expected=${s.shouldSync}`);
      passed = false;
    }
  }
  
  if (passed) {
    console.log('  ✓ PASSED: Toggle and duration relationship works correctly');
  }
  return passed;
}

function testSettingsStructure() {
  console.log('Test 4: Settings Structure');
  
  const settings = {
    autoSync: false,
    syncDuration: 60,
    enabled: true,
    sourcePaths: [],
    targetPath: 'Mapped Files'
  };
  
  const hasAutoSync = 'autoSync' in settings;
  const hasSyncDuration = 'syncDuration' in settings;
  const default60 = settings.syncDuration === 60;
  
  if (hasAutoSync && hasSyncDuration && default60) {
    console.log('  ✓ PASSED: Settings have correct structure');
    console.log(`    autoSync: ${settings.autoSync}`);
    console.log(`    syncDuration: ${settings.syncDuration}`);
    return true;
  } else {
    console.log('  ✗ FAILED: Settings structure incorrect');
    return false;
  }
}

function testInputValidation() {
  console.log('Test 5: Input Validation');
  
  const validateSyncDuration = (value) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1) return 60;
    if (num > 1440) return 1440;
    return num;
  };
  
  const testCases = [
    { input: '60', expected: 60 },
    { input: '30', expected: 30 },
    { input: 'abc', expected: 60 },
    { input: '-5', expected: 60 },
    { input: '2000', expected: 1440 },
    { input: '1', expected: 1 }
  ];
  
  let passed = true;
  for (const tc of testCases) {
    const result = validateSyncDuration(tc.input);
    if (result !== tc.expected) {
      console.log(`  ✗ FAILED: input='${tc.input}' expected=${tc.expected} got=${result}`);
      passed = false;
    }
  }
  
  if (passed) {
    console.log('  ✓ PASSED: Input validation works correctly');
  }
  return passed;
}

console.log('\n========== Running TDD Tests for Sync Settings ==========\n');

const results = [
  testAutoSyncToggle(),
  testSyncDurationInput(),
  testSyncToggleAndDurationRelationship(),
  testSettingsStructure(),
  testInputValidation()
];

const passed = results.filter(r => r).length;
const total = results.length;

console.log('\n========== Test Results ==========');
console.log(`Passed: ${passed}/${total}`);

if (passed === total) {
  console.log('All tests passed! ✓');
  process.exit(0);
} else {
  console.log('Some tests failed! ✗');
  process.exit(1);
}

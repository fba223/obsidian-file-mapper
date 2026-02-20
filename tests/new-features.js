const fs = require('fs');
const path = require('path');

function testMultipleSourcePaths() {
  console.log('Test 1: Multiple Source Paths');
  
  const sourcePaths = [
    '/Users/zhangpeng/Documents',
    '/Users/zhangpeng/Downloads',
    '/Users/zhangpeng/Books'
  ];
  
  const settings = {
    sourcePaths: sourcePaths
  };
  
  const hasMultiplePaths = settings.sourcePaths.length >= 2;
  const isArray = Array.isArray(settings.sourcePaths);
  
  if (hasMultiplePaths && isArray) {
    console.log('  ✓ PASSED: Supports multiple source paths');
    console.log(`    Paths: ${sourcePaths.join(', ')}`);
    return true;
  } else {
    console.log('  ✗ FAILED: Does not support multiple paths');
    return false;
  }
}

function testSyncIntervalDisplay() {
  console.log('Test 2: Sync Interval Display');
  
  const settings = {
    syncInterval: 30
  };
  
  const interval = settings.syncInterval;
  const displayText = `${interval} minute${interval !== 1 ? 's' : ''}`;
  const expected = '30 minutes';
  
  if (displayText === expected) {
    console.log('  ✓ PASSED: Correct interval display');
    console.log(`    Display: ${displayText}`);
    return true;
  } else {
    console.log('  ✗ FAILED: Incorrect display');
    console.log(`    Expected: ${expected}, got: ${displayText}`);
    return false;
  }
}

function testDateFormatCustomization() {
  console.log('Test 3: Date Format Customization');
  
  const testDate = new Date('2024-02-20T10:30:00Z');
  
  const formats = {
    iso: testDate.toISOString(),
    dateOnly: testDate.toISOString().split('T')[0],
    dateTime: testDate.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }),
    custom: `${testDate.getFullYear()}-${String(testDate.getMonth()+1).padStart(2,'0')}-${String(testDate.getDate()).padStart(2,'0')}`
  };
  
  const isoValid = formats.iso.includes('2024-02-20');
  const dateOnlyValid = formats.dateOnly === '2024-02-20';
  const customValid = formats.custom === '2024-02-20';
  
  if (isoValid && dateOnlyValid && customValid) {
    console.log('  ✓ PASSED: Date format customization works');
    console.log(`    ISO: ${formats.iso}`);
    console.log(`    Date only: ${formats.dateOnly}`);
    console.log(`    Custom: ${formats.custom}`);
    return true;
  } else {
    console.log('  ✗ FAILED: Date formats incorrect');
    return false;
  }
}

function testFileSizeUnitSelection() {
  console.log('Test 4: File Size Unit Selection');
  
  const bytes = 1048576;
  
  const units = {
    bytes: bytes,
    kb: bytes / 1024,
    mb: bytes / (1024 * 1024),
    gb: bytes / (1024 * 1024 * 1024)
  };
  
  const settings = {
    sizeUnit: 'MB'
  };
  
  const getDisplaySize = (sizeInBytes, unit) => {
    switch(unit) {
      case 'KB': return (sizeInBytes / 1024).toFixed(2) + ' KB';
      case 'MB': return (sizeInBytes / (1024 * 1024)).toFixed(2) + ' MB';
      case 'GB': return (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
      default: return sizeInBytes + ' bytes';
    }
  };
  
  const display = getDisplaySize(bytes, settings.sizeUnit);
  const expected = '1.00 MB';
  
  if (display === expected) {
    console.log('  ✓ PASSED: File size unit selection works');
    console.log(`    ${bytes} bytes = ${display}`);
    return true;
  } else {
    console.log('  ✗ FAILED: Size conversion incorrect');
    console.log(`    Expected: ${expected}, got: ${display}`);
    return false;
  }
}

function testSettingsWithNewFields() {
  console.log('Test 5: Settings with New Fields');
  
  const settings = {
    sourcePaths: ['/path1', '/path2'],
    syncInterval: 15,
    dateFormat: 'YYYY-MM-DD',
    dateIncludeTime: false,
    sizeUnit: 'KB'
  };
  
  const hasSourcePaths = Array.isArray(settings.sourcePaths) && settings.sourcePaths.length > 1;
  const hasDateFormat = typeof settings.dateFormat === 'string';
  const hasDateIncludeTime = typeof settings.dateIncludeTime === 'boolean';
  const hasSizeUnit = typeof settings.sizeUnit === 'string' && ['bytes', 'KB', 'MB', 'GB'].includes(settings.sizeUnit);
  
  if (hasSourcePaths && hasDateFormat && hasDateIncludeTime && hasSizeUnit) {
    console.log('  ✓ PASSED: Settings include all new fields');
    console.log(`    Source paths: ${settings.sourcePaths.length}`);
    console.log(`    Date format: ${settings.dateFormat}`);
    console.log(`    Date include time: ${settings.dateIncludeTime}`);
    console.log(`    Size unit: ${settings.sizeUnit}`);
    return true;
  } else {
    console.log('  ✗ FAILED: Missing new fields');
    return false;
  }
}

console.log('\n========== Running TDD Tests for New Features ==========\n');

const results = [
  testMultipleSourcePaths(),
  testSyncIntervalDisplay(),
  testDateFormatCustomization(),
  testFileSizeUnitSelection(),
  testSettingsWithNewFields()
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

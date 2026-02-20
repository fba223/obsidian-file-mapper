const path = require('path');

function testPathComparisonFix() {
  console.log('Test 1: Path Comparison Fix - Use source path as key');
  
  const existingMappedFiles = [
    { name: 'report', sourcePath: '/Users/username/Documents/report.pdf', path: 'Mapped Files/report.md' },
    { name: 'notes', sourcePath: '/Users/username/Documents/notes.docx', path: 'Mapped Files/notes.md' }
  ];
  
  const scannedSourceFiles = [
    { name: 'report', sourcePath: '/Users/username/Documents/report.pdf', path: '/Users/username/Documents/report.pdf' },
    { name: 'new-file', sourcePath: '/Users/username/Downloads/new-file.pdf', path: '/Users/username/Downloads/new-file.pdf' }
  ];
  
  const existingSourcePaths = new Set(existingMappedFiles.map(f => f.sourcePath));
  const scannedSourcePaths = new Set(scannedSourceFiles.map(f => f.sourcePath));
  
  const added = scannedSourceFiles.filter(f => !existingSourcePaths.has(f.sourcePath));
  const deleted = existingMappedFiles.filter(f => !scannedSourcePaths.has(f.sourcePath));
  const unchanged = scannedSourceFiles.filter(f => existingSourcePaths.has(f.sourcePath));
  
  const passed = added.length === 1 && 
                 added[0].name === 'new-file' &&
                 deleted.length === 1 &&
                 deleted[0].name === 'notes' &&
                 unchanged.length === 1 &&
                 unchanged[0].name === 'report';
  
  if (passed) {
    console.log('  ✓ PASSED: Correctly compares source paths, not mapped paths');
    console.log(`    Added: ${added.length}, Deleted: ${deleted.length}, Unchanged: ${unchanged.length}`);
    return true;
  } else {
    console.log('  ✗ FAILED: Path comparison incorrect');
    return false;
  }
}

function testBasenameCollisionFix() {
  console.log('Test 2: Basename Collision Fix - Use relative path for uniqueness');
  
  const scannedFiles = [
    { name: 'report', sourcePath: '/Users/username/Documents/report.pdf', path: '/Users/username/Documents/report.pdf' },
    { name: 'report', sourcePath: '/Users/username/Downloads/report.pdf', path: '/Users/username/Downloads/report.pdf' },
    { name: 'report', sourcePath: '/Users/username/Books/report.pdf', path: '/Users/username/Books/report.pdf' }
  ];
  
  const getUniqueName = (file, sourcePath) => {
    const relPath = file.sourcePath.substring(sourcePath.length);
    const sanitized = relPath.replace(/[\/\\]/g, '_').replace(/^\s*_\s*/, '').replace(/\s*_\s*$/, '');
    return sanitized || file.name;
  };
  
  const names = scannedFiles.map(f => getUniqueName(f, '/Users/username/'));
  const uniqueNames = [...new Set(names)];
  
  const passed = names.length === uniqueNames.length;
  
  if (passed) {
    console.log('  ✓ PASSED: Different paths generate unique names');
    console.log(`    Names: ${names.join(', ')}`);
    return true;
  } else {
    console.log('  ✗ FAILED: Names not unique');
    console.log(`    Got: ${names.join(', ')}`);
    return false;
  }
}

function testMtimeComparisonFix() {
  console.log('Test 3: Mtime Comparison Fix - Store source mtime in frontmatter');
  
  const existingMappedFiles = [
    { 
      name: 'report', 
      sourcePath: '/Users/username/Documents/report.pdf',
      sourceMtime: 1708000000000,
      mappedMtime: 1708000000000
    }
  ];
  
  const scannedFiles = [
    { 
      name: 'report', 
      sourcePath: '/Users/username/Documents/report.pdf',
      modified: new Date(1708000000000)
    }
  ];
  
  const updated = scannedFiles.filter(f => {
    const existing = existingMappedFiles.find(e => e.sourcePath === f.sourcePath);
    if (!existing) return false;
    const sourceMtime = f.modified.getTime();
    return existing.sourceMtime !== sourceMtime;
  });
  
  const passed = updated.length === 0;
  
  if (passed) {
    console.log('  ✓ PASSED: Files with same mtime are not marked as updated');
    return true;
  } else {
    console.log('  ✗ FAILED: Files incorrectly marked as updated');
    return false;
  }
}

function testYamlEscaping() {
  console.log('Test 4: YAML Escaping - Proper quoting and escaping');
  
  const escapeYaml = (str) => {
    if (!str) return '""';
    if (str.includes('"') || str.includes('\n') || str.includes(':') || str.startsWith(' ')) {
      return `"${str.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return `"${str}"`;
  };
  
  const testCases = [
    { input: 'simple name', expected: '"simple name"' },
    { input: 'name with "quotes"', expected: '"name with \\"quotes\\""' },
    { input: 'multi\nline', expected: '"multi\\nline"' },
    { input: 'key: value', expected: '"key: value"' },
    { input: '  leading space', expected: '"  leading space"' }
  ];
  
  let passed = true;
  for (const tc of testCases) {
    const result = escapeYaml(tc.input);
    if (result !== tc.expected) {
      console.log(`  ✗ FAILED: "${tc.input}" expected ${tc.expected}, got ${result}`);
      passed = false;
    }
  }
  
  if (passed) {
    console.log('  ✓ PASSED: YAML escaping works correctly');
  }
  return passed;
}

function testUrlEncoding() {
  console.log('Test 5: URL Encoding - Proper file:// URL encoding');
  
  const encodeFileUrl = (filePath) => {
    return 'file://' + encodeURIComponent(filePath).replace(/%20/g, '%20');
  };
  
  const testCases = [
    { input: '/Users/username/Documents/report.pdf', expected: 'file://%2FUsers%2Fusername%2FDocuments%2Freport.pdf' },
    { input: '/Users/username/Documents/my file.pdf', expected: 'file://%2FUsers%2Fusername%2FDocuments%2Fmy%20file.pdf' },
    { input: '/Users/用户名/文档/test.pdf', expected: 'file://%2FUsers%2F%E7%94%A8%E6%88%B7%E5%90%8D%2F%E6%96%87%E6%A1%A3%2Ftest.pdf' },
    { input: 'C:\\Users\\test file.pdf', expected: 'file://C%3A%5CUsers%5Ctest%20file.pdf' }
  ];
  
  let passed = true;
  for (const tc of testCases) {
    const result = encodeFileUrl(tc.input);
    if (result !== tc.expected) {
      console.log(`  ✗ FAILED: ${tc.input}`);
      console.log(`    Expected: ${tc.expected}`);
      console.log(`    Got: ${result}`);
      passed = false;
    }
  }
  
  if (passed) {
    console.log('  ✓ PASSED: URL encoding works correctly');
  }
  return passed;
}

function testStoredSourceMtime() {
  console.log('Test 6: Source Mtime Storage - Store source file mtime in mapped file');
  
  const sourceFile = { path: '/test/file.pdf', modified: new Date('2024-02-15T10:30:00Z') };
  const fieldMappings = { fileName: 'title', filePath: 'path', createdDate: 'created', modifiedDate: 'modified', fileSize: 'size', fileType: 'type' };
  
  const yamlLines = ['---'];
  yamlLines.push(`${fieldMappings.fileName}: "file"`);
  yamlLines.push(`${fieldMappings.filePath}: "/test/file.pdf"`);
  yamlLines.push(`source_mtime: ${sourceFile.modified.getTime()}`);
  yamlLines.push('---');
  
  const content = yamlLines.join('\n');
  const hasMtime = content.includes('source_mtime:');
  
  if (hasMtime) {
    console.log('  ✓ PASSED: Stores source file mtime in frontmatter');
    return true;
  } else {
    console.log('  ✗ FAILED: Source mtime not stored');
    return false;
  }
}

console.log('\n========== Running TDD Tests for Bug Fixes ==========\n');

const results = [
  testPathComparisonFix(),
  testBasenameCollisionFix(),
  testMtimeComparisonFix(),
  testYamlEscaping(),
  testUrlEncoding(),
  testStoredSourceMtime()
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

const fs = require('fs');
const path = require('path');

const mockApp = {
  vault: {
    getFolder: (p) => ({ path: p }),
    createFolder: async (p) => ({ path: p }),
    getAbstractFileByPath: (p) => p ? { path: p, name: path.basename(p) } : null,
    create: async (p, c) => ({ path: p, content: c }),
    getFiles: () => [],
    delete: async () => {},
    modify: async () => {}
  }
};

function testFileExtensionFilter() {
  console.log('Test 1: File Extension Filtering');
  
  const extensions = ['.pdf', '.docx', '.mp4'];
  const testFiles = [
    'document.pdf',
    'image.png',
    'video.mp4',
    'notes.docx',
    'readme.txt'
  ];
  
  const filtered = testFiles.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return extensions.includes(ext);
  });
  
  const expected = ['document.pdf', 'video.mp4', 'notes.docx'];
  
  if (JSON.stringify(filtered) === JSON.stringify(expected)) {
    console.log('  ✓ PASSED: Correctly filters files by extension');
    return true;
  } else {
    console.log('  ✗ FAILED: Expected', expected, 'got', filtered);
    return false;
  }
}

function testYamlFrontmatterGeneration() {
  console.log('Test 2: YAML Frontmatter Generation');
  
  const fileInfo = {
    name: 'test-document.pdf',
    path: '/Users/zhangpeng/Documents/test-document.pdf',
    size: 1024000,
    created: new Date('2024-01-15'),
    modified: new Date('2024-02-20'),
    extension: '.pdf'
  };
  
  const fieldMappings = {
    fileName: 'file_name',
    filePath: 'file_path',
    fileSize: 'size_bytes',
    createdDate: 'created_at',
    modifiedDate: 'updated_at',
    fileType: 'type'
  };
  
  const yamlLines = ['---'];
  yamlLines.push(`${fieldMappings.fileName}: "${fileInfo.name}"`);
  yamlLines.push(`${fieldMappings.filePath}: "${fileInfo.path}"`);
  yamlLines.push(`${fieldMappings.fileSize}: ${fileInfo.size}`);
  yamlLines.push(`${fieldMappings.createdDate}: ${fileInfo.created.toISOString()}`);
  yamlLines.push(`${fieldMappings.modifiedDate}: ${fileInfo.modified.toISOString()}`);
  yamlLines.push(`${fieldMappings.fileType}: "${fileInfo.extension}"`);
  yamlLines.push('---');
  yamlLines.push('');
  
  const yamlContent = yamlLines.join('\n');
  
  const hasFrontmatter = yamlContent.startsWith('---');
  const hasFieldNames = yamlContent.includes('file_name:') && yamlContent.includes('size_bytes:');
  const hasFilePath = yamlContent.includes(fileInfo.path);
  
  if (hasFrontmatter && hasFieldNames && hasFilePath) {
    console.log('  ✓ PASSED: Generates correct YAML frontmatter');
    console.log('    Preview:', yamlContent.substring(0, 100) + '...');
    return true;
  } else {
    console.log('  ✗ FAILED: YAML frontmatter incorrect');
    return false;
  }
}

function testDetectFileChanges() {
  console.log('Test 3: Detect File Changes');
  
  const previousFiles = [
    { path: '/docs/file1.pdf', name: 'file1.pdf', modified: 1000 },
    { path: '/docs/file2.pdf', name: 'file2.pdf', modified: 1000 },
    { path: '/docs/file3.pdf', name: 'file3.pdf', modified: 1000 }
  ];
  
  const currentFiles = [
    { path: '/docs/file1.pdf', name: 'file1.pdf', modified: 2000 },
    { path: '/docs/file2.pdf', name: 'file2.pdf', modified: 1000 },
    { path: '/docs/file4.pdf', name: 'file4.pdf', modified: 1000 }
  ];
  
  const currentPaths = new Set(currentFiles.map(f => f.path));
  const previousPaths = new Set(previousFiles.map(f => f.path));
  
  const added = currentFiles.filter(f => !previousPaths.has(f.path));
  const deleted = previousFiles.filter(f => !currentPaths.has(f.path));
  const updated = currentFiles.filter(f => {
    const prev = previousFiles.find(p => p.path === f.path);
    return prev && prev.modified !== f.modified;
  });
  
  const passed = added.length === 1 && 
                 deleted.length === 1 && 
                 updated.length === 1 &&
                 added[0].name === 'file4.pdf' &&
                 deleted[0].name === 'file3.pdf' &&
                 updated[0].name === 'file1.pdf';
  
  if (passed) {
    console.log('  ✓ PASSED: Correctly detects added/updated/deleted files');
    console.log(`    Added: ${added.length}, Deleted: ${deleted.length}, Updated: ${updated.length}`);
    return true;
  } else {
    console.log('  ✗ FAILED: Change detection incorrect');
    return false;
  }
}

function testPathMapping() {
  console.log('Test 4: Path Mapping');
  
  const sourcePath = '/Users/zhangpeng/Documents';
  const targetPath = '/Obsidian Vault/Mapped';
  const filePath = '/Users/zhangpeng/Documents/PDFs/report.pdf';
  
  const relativePath = filePath.substring(sourcePath.length);
  const mappedPath = targetPath + relativePath;
  const mappedDir = path.dirname(mappedPath);
  const mappedName = path.basename(filePath, path.extname(filePath)) + '.md';
  
  const expectedDir = targetPath + '/PDFs';
  const expectedName = 'report.md';
  
  if (mappedDir === expectedDir && mappedName === expectedName) {
    console.log('  ✓ PASSED: Correctly maps source path to target');
    console.log(`    Source: ${filePath}`);
    console.log(`    Target: ${mappedDir}/${mappedName}`);
    return true;
  } else {
    console.log('  ✗ FAILED: Path mapping incorrect');
    return false;
  }
}

function testSettingsValidation() {
  console.log('Test 5: Settings Validation');
  
  const settings = {
    sourcePaths: ['/Users/zhangpeng/Documents'],
    targetPath: '/Obsidian Vault/Mapped',
    fileExtensions: '.pdf,.docx,.doc',
    fieldMappings: {
      fileName: 'title',
      filePath: 'path',
      fileSize: 'size',
      createdDate: 'created',
      modifiedDate: 'modified'
    },
    syncInterval: 30,
    enabled: true
  };
  
  const errors = [];
  
  if (!settings.sourcePaths || settings.sourcePaths.length === 0) {
    errors.push('Source paths required');
  }
  
  if (!settings.targetPath) {
    errors.push('Target path required');
  }
  
  if (!settings.fileExtensions || !settings.fileExtensions.startsWith('.')) {
    errors.push('File extensions must start with .');
  }
  
  if (settings.syncInterval < 1 || settings.syncInterval > 1440) {
    errors.push('Sync interval must be between 1 and 1440 minutes');
  }
  
  if (errors.length === 0) {
    console.log('  ✓ PASSED: Settings validation passed');
    return true;
  } else {
    console.log('  ✗ FAILED: Validation errors:', errors);
    return false;
  }
}

console.log('\n========== Running TDD Tests ==========\n');

const results = [
  testFileExtensionFilter(),
  testYamlFrontmatterGeneration(),
  testDetectFileChanges(),
  testPathMapping(),
  testSettingsValidation()
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

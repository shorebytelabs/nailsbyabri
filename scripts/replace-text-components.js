#!/usr/bin/env node
/**
 * Script to help replace Text components with AppText
 * 
 * This script finds all Text imports and usages, but manual review is still needed
 * to determine the correct variant for each usage.
 * 
 * Usage: node scripts/replace-text-components.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(__dirname, '..', 'src');

function findFilesWithText(dir) {
  const files = [];
  
  function walkDir(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('<Text') || content.includes('from \'react-native\'')) {
          files.push(fullPath);
        }
      }
    }
  }
  
  walkDir(dir);
  return files;
}

console.log('Finding files with Text components...');
const files = findFilesWithText(SRC_DIR);
console.log(`Found ${files.length} files with Text components`);

// Count Text usages
let totalTextUsages = 0;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.match(/<Text[^>]*>/g);
  if (matches) {
    totalTextUsages += matches.length;
  }
});

console.log(`Total <Text> usages found: ${totalTextUsages}`);
console.log('\nFiles to update:');
files.forEach(file => {
  const relPath = path.relative(SRC_DIR, file);
  console.log(`  - ${relPath}`);
});

console.log('\nNote: This script only identifies files. Manual replacement is required.');
console.log('Guidelines:');
console.log('  - Body text: variant="body" (default)');
console.log('  - Buttons/titles/headers/nav: variant="ui"');
console.log('  - Badges/pills/tags: variant="small"');


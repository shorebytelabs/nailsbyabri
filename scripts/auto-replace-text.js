#!/usr/bin/env node
/**
 * Automated Text to AppText replacement script
 * 
 * This script performs intelligent replacements based on common patterns:
 * - Titles/headers -> variant="ui"
 * - Buttons -> variant="ui"
 * - Badges/small text -> variant="small"
 * - Everything else -> variant="body" (default)
 * 
 * Usage: node scripts/auto-replace-text.js [file-path]
 * 
 * WARNING: Review all changes before committing!
 */

const fs = require('fs');
const path = require('path');

function determineVariant(textContent, styleName, context) {
  const content = (textContent || '').toLowerCase();
  const style = (styleName || '').toLowerCase();
  
  // Small elements
  if (
    style.includes('badge') ||
    style.includes('pill') ||
    style.includes('tag') ||
    style.includes('timestamp') ||
    style.includes('small') ||
    style.includes('tiny') ||
    style.includes('helper') && style.includes('small')
  ) {
    return 'small';
  }
  
  // UI elements
  if (
    style.includes('title') ||
    style.includes('header') ||
    style.includes('button') ||
    style.includes('label') && !style.includes('helper') ||
    style.includes('nav') ||
    style.includes('tab') ||
    style.includes('link') ||
    style.includes('switch') ||
    style.includes('back') ||
    style.includes('error') && !style.includes('message')
  ) {
    return 'ui';
  }
  
  // Default to body
  return 'body';
}

function replaceTextInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Skip if already has AppText import
  if (content.includes("import AppText")) {
    return { content, modified: false, skipped: true };
  }
  
  // Check if file uses Text
  if (!content.includes('<Text') && !content.includes("Text") || !content.includes("from 'react-native'")) {
    return { content, modified: false, skipped: true };
  }
  
  // 1. Update react-native import
  const reactNativeImportRegex = /import\s+{([^}]+)}\s+from\s+['"]react-native['"]/;
  const match = content.match(reactNativeImportRegex);
  
  if (match) {
    const imports = match[1];
    const importList = imports.split(',').map(imp => imp.trim());
    
    if (importList.includes('Text')) {
      // Remove Text from imports
      const newImports = importList.filter(imp => imp !== 'Text').join(', ');
      content = content.replace(
        reactNativeImportRegex,
        `import {${newImports}} from 'react-native'`
      );
      modified = true;
      
      // Add AppText import
      const importLines = content.split('\n');
      let insertIndex = -1;
      for (let i = 0; i < importLines.length; i++) {
        if (importLines[i].includes("from 'react-native'") || importLines[i].includes('from "react-native"')) {
          insertIndex = i + 1;
          break;
        }
      }
      
      if (insertIndex > 0) {
        // Determine relative path
        const fileDir = path.dirname(filePath);
        const srcDir = path.join(__dirname, '..', 'src');
        const relativePath = path.relative(fileDir, path.join(srcDir, 'components', 'AppText'));
        const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
        const normalizedPath = importPath.replace(/\\/g, '/');
        
        importLines.splice(insertIndex, 0, `import AppText from '${normalizedPath}';`);
        content = importLines.join('\n');
        modified = true;
      }
    }
  }
  
  // 2. Replace <Text> with <AppText> (basic replacement, variants need manual review)
  // We'll do a simple replacement and add a comment for manual review
  const textTagRegex = /<Text(\s+[^>]*)?>/g;
  const textMatches = content.match(textTagRegex);
  
  if (textMatches) {
    // For now, just replace with AppText and default variant
    // Manual review will be needed for variant selection
    content = content.replace(/<Text(\s+[^>]*)?>/g, '<AppText$1>');
    content = content.replace(/<\/Text>/g, '</AppText>');
    modified = true;
  }
  
  return { content, modified, skipped: false };
}

// Main execution
const filePath = process.argv[2];

if (filePath) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }
  
  console.log(`Processing: ${fullPath}`);
  const result = replaceTextInFile(fullPath);
  
  if (result.skipped) {
    console.log('  ⏭️  Skipped (already has AppText or no Text components)');
  } else if (result.modified) {
    fs.writeFileSync(fullPath, result.content, 'utf8');
    console.log('  ✅ File updated');
    console.log('  ⚠️  Manual review needed: Check and add appropriate variant props');
  } else {
    console.log('  ℹ️  No changes made');
  }
} else {
  console.log('Usage: node scripts/auto-replace-text.js <file-path>');
  console.log('');
  console.log('This script performs basic Text -> AppText replacement.');
  console.log('Manual review is required to add appropriate variant props.');
  console.log('');
  console.log('See docs/font-scaling.md for variant guidelines.');
}


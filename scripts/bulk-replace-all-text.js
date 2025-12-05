#!/usr/bin/env node
/**
 * Bulk Text to AppText Replacement Script
 * 
 * This script automatically replaces all Text components with AppText
 * and intelligently determines variants based on style names and context.
 * 
 * Usage: 
 *   node scripts/bulk-replace-all-text.js [--dry-run] [--file=path]
 * 
 * Options:
 *   --dry-run: Show what would be changed without making changes
 *   --file=path: Process only a specific file
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');

function determineVariant(styleName, textContent, parentContext) {
  const style = (styleName || '').toLowerCase();
  const content = (textContent || '').toLowerCase();
  const context = (parentContext || '').toLowerCase();
  
  // Small elements - badges, pills, tags, timestamps
  if (
    style.includes('badge') ||
    style.includes('pill') ||
    style.includes('tag') ||
    style.includes('timestamp') ||
    style.includes('helper') && (style.includes('small') || style.includes('tiny')) ||
    style.includes('error') && style.includes('small') ||
    (style.includes('fontsize') || style.includes('font-size')) && parseInt(style.match(/\d+/)?.[0] || 0) < 12
  ) {
    return 'small';
  }
  
  // UI elements - buttons, titles, headers, nav, links
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
    style.includes('dismiss') ||
    style.includes('action') ||
    style.includes('banner') ||
    style.includes('overlay') ||
    context.includes('button') ||
    context.includes('pressable') ||
    context.includes('touchable')
  ) {
    return 'ui';
  }
  
  // Default to body
  return 'body';
}

function processFile(filePath, dryRun = false) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let changes = [];
  
  // Skip if already processed
  if (content.includes("import AppText")) {
    return { changed: false, skipped: true, changes: [] };
  }
  
  // Skip if no Text components
  if (!content.includes('<Text')) {
    return { changed: false, skipped: true, changes: [] };
  }
  
  // 1. Update react-native import
  const reactNativeImportRegex = /import\s+{([^}]+)}\s+from\s+['"]react-native['"]/;
  const match = content.match(reactNativeImportRegex);
  
  if (match) {
    const imports = match[1];
    const importList = imports.split(',').map(imp => imp.trim()).filter(Boolean);
    
    if (importList.includes('Text')) {
      const newImports = importList.filter(imp => imp !== 'Text').join(', ');
      content = content.replace(
        reactNativeImportRegex,
        `import {${newImports}} from 'react-native'`
      );
      changes.push('Removed Text from react-native import');
      
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
        // Calculate relative path to AppText
        const fileDir = path.dirname(filePath);
        const componentsDir = path.join(SRC_DIR, 'components');
        const relativePath = path.relative(fileDir, path.join(componentsDir, 'AppText'));
        let importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
        importPath = importPath.replace(/\\/g, '/');
        
        importLines.splice(insertIndex, 0, `import AppText from '${importPath}';`);
        content = importLines.join('\n');
        changes.push('Added AppText import');
      }
    }
  }
  
  // 2. Replace <Text> tags with <AppText> and determine variants
  // Match <Text> tags with their attributes
  const textTagRegex = /<Text(\s+[^>]*)?>/g;
  let textMatches = [];
  let textMatch;
  
  while ((textMatch = textTagRegex.exec(content)) !== null) {
    textMatches.push({
      fullMatch: textMatch[0],
      attributes: textMatch[1] || '',
      index: textMatch.index,
    });
  }
  
  // Process matches in reverse order to preserve indices
  for (let i = textMatches.length - 1; i >= 0; i--) {
    const textMatch = textMatches[i];
    const attributes = textMatch.attributes;
    
    // Extract style name from attributes
    const styleMatch = attributes.match(/style\s*=\s*\[?styles\.(\w+)/);
    const styleName = styleMatch ? styleMatch[1] : '';
    
    // Determine variant
    const variant = determineVariant(styleName, '', '');
    
    // Replace <Text> with <AppText variant="...">
    let newTag = '<AppText';
    if (variant !== 'body') {
      newTag += ` variant="${variant}"`;
    }
    if (attributes.trim()) {
      newTag += attributes;
    }
    newTag += '>';
    
    content = content.substring(0, textMatch.index) + newTag + content.substring(textMatch.index + textMatch.fullMatch.length);
    changes.push(`Replaced Text with AppText variant="${variant}" (style: ${styleName || 'none'})`);
  }
  
  // 3. Replace closing tags
  content = content.replace(/<\/Text>/g, '</AppText>');
  if (content !== originalContent && content.includes('</AppText>')) {
    changes.push('Replaced closing Text tags');
  }
  
  if (!dryRun && content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  
  return {
    changed: content !== originalContent,
    skipped: false,
    changes,
    content: dryRun ? content : null,
  };
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fileArg = args.find(arg => arg.startsWith('--file='));
const specificFile = fileArg ? fileArg.split('=')[1] : null;

if (specificFile) {
  const fullPath = path.resolve(specificFile);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }
  
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Processing: ${fullPath}`);
  const result = processFile(fullPath, dryRun);
  
  if (result.skipped) {
    console.log('  ⏭️  Skipped');
  } else if (result.changed) {
    console.log(`  ✅ ${dryRun ? 'Would update' : 'Updated'} (${result.changes.length} changes)`);
    result.changes.forEach(change => console.log(`     - ${change}`));
  } else {
    console.log('  ℹ️  No changes');
  }
} else {
  // Process all files
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Processing all files...`);
  console.log('');
  
  function findFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...findFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }
  
  const files = findFiles(SRC_DIR);
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  
  for (const file of files) {
    const result = processFile(file, dryRun);
    processed++;
    
    if (result.skipped) {
      skipped++;
    } else if (result.changed) {
      updated++;
      const relPath = path.relative(SRC_DIR, file);
      console.log(`✅ ${relPath} (${result.changes.length} changes)`);
    }
  }
  
  console.log('');
  console.log(`Summary: ${processed} files processed, ${updated} updated, ${skipped} skipped`);
  if (dryRun) {
    console.log('');
    console.log('This was a dry run. Remove --dry-run to apply changes.');
  }
}


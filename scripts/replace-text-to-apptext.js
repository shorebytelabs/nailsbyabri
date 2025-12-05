#!/usr/bin/env node
/**
 * Script to help replace Text components with AppText
 * 
 * This script performs basic replacements but requires manual review
 * to determine the correct variant for each usage.
 * 
 * Usage: node scripts/replace-text-to-apptext.js [file-path]
 * 
 * If no file path is provided, it will list all files that need updating.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');

function replaceTextInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if AppText is already imported
  const hasAppTextImport = content.includes("import AppText");
  const hasTextImport = content.includes("Text") && content.includes("from 'react-native'") || content.includes('from "react-native"');
  
  // Add AppText import if not present and Text is imported
  if (!hasAppTextImport && hasTextImport) {
    // Find the react-native import line
    const reactNativeImportRegex = /import\s+{([^}]+)}\s+from\s+['"]react-native['"]/;
    const match = content.match(reactNativeImportRegex);
    
    if (match) {
      const imports = match[1];
      // Remove Text from imports if present
      const newImports = imports
        .split(',')
        .map(imp => imp.trim())
        .filter(imp => imp !== 'Text')
        .join(', ');
      
      // Replace the import
      content = content.replace(
        reactNativeImportRegex,
        `import {${newImports}} from 'react-native'`
      );
      
      // Add AppText import after other imports (find a good spot)
      const importLines = content.split('\n');
      let insertIndex = -1;
      for (let i = 0; i < importLines.length; i++) {
        if (importLines[i].includes("from 'react-native'") || importLines[i].includes('from "react-native"')) {
          insertIndex = i + 1;
          break;
        }
      }
      
      if (insertIndex > 0) {
        importLines.splice(insertIndex, 0, "import AppText from '../components/AppText';");
        content = importLines.join('\n');
        modified = true;
      }
    }
  }
  
  // Replace <Text with <AppText (but keep variant determination manual)
  // We'll do a basic replacement but note that variants need manual review
  const textRegex = /<Text(\s+[^>]*)?>/g;
  const textMatches = content.match(textRegex);
  
  if (textMatches && textMatches.length > 0) {
    console.log(`  Found ${textMatches.length} Text components - manual review needed for variants`);
    // Don't auto-replace - manual review is needed for variants
  }
  
  return { content, modified };
}

// Main execution
const filePath = process.argv[2];

if (filePath) {
  // Process single file
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }
  
  console.log(`Processing: ${fullPath}`);
  const result = replaceTextInFile(fullPath);
  
  if (result.modified) {
    fs.writeFileSync(fullPath, result.content, 'utf8');
    console.log('  ✅ File updated');
  } else {
    console.log('  ℹ️  No changes needed or manual review required');
  }
} else {
  // List all files
  console.log('Files with Text components:');
  console.log('');
  
  function findFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...findFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('<Text')) {
          const count = (content.match(/<Text/g) || []).length;
          files.push({ path: fullPath, count });
        }
      }
    }
    
    return files;
  }
  
  const files = findFiles(SRC_DIR);
  files.forEach(({ path: filePath, count }) => {
    const relPath = path.relative(SRC_DIR, filePath);
    console.log(`  ${relPath} (${count} usages)`);
  });
  
  console.log('');
  console.log(`Total: ${files.length} files, ${files.reduce((sum, f) => sum + f.count, 0)} Text components`);
  console.log('');
  console.log('Note: Manual replacement is required to determine correct variants.');
  console.log('See docs/font-scaling.md for guidelines.');
}


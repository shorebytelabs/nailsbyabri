#!/bin/bash
# Helper script to bulk replace Text components with AppText
# This script helps identify files that need manual replacement
# 
# Usage: ./scripts/bulk-replace-text.sh

echo "=== Text Component Replacement Helper ==="
echo ""
echo "This script helps identify files that need Text -> AppText replacement."
echo "Manual review is required to determine the correct variant for each usage."
echo ""
echo "Files with Text components:"
echo ""

find src -name "*.js" -type f | while read file; do
  if grep -q "<Text" "$file" || grep -q "from 'react-native'" "$file" | grep -q "Text"; then
    count=$(grep -o "<Text" "$file" | wc -l | tr -d ' ')
    if [ "$count" -gt 0 ]; then
      echo "  $file ($count usages)"
    fi
  fi
done

echo ""
echo "Total files to review:"
find src -name "*.js" -type f -exec grep -l "<Text" {} \; | wc -l | tr -d ' '

echo ""
echo "Next steps:"
echo "1. Review each file"
echo "2. Replace 'Text' import with 'AppText' import"
echo "3. Replace <Text> with <AppText variant=\"...\">"
echo "4. Choose variant: 'body' (default), 'ui', or 'small'"
echo ""
echo "See docs/font-scaling.md for guidelines."


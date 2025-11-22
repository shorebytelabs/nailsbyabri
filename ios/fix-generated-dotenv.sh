#!/bin/bash

# Fix GeneratedDotEnv.m file to replace /$()/ with //
# This is needed because xcconfig files escape // to /$()/, but .m files shouldn't

GENERATED_FILE="${1:-node_modules/react-native-config/ios/ReactNativeConfig/GeneratedDotEnv.m}"

if [ -f "$GENERATED_FILE" ]; then
  echo "🔧 Fixing URL escaping in: $GENERATED_FILE"
  # Replace /$()/ with // in the file
  sed -i '' 's|/\$()/|//|g' "$GENERATED_FILE"
  echo "✅ Fixed URL escaping"
  echo "   First line:"
  head -1 "$GENERATED_FILE"
else
  echo "❌ File not found: $GENERATED_FILE"
fi


#!/bin/bash

# Clean all React Native Config generated files
# Use this when switching environments

echo "🧹 Cleaning all React Native Config files..."

# Remove build directory
rm -rf ios/build

# Remove local config files
rm -f ios/ReactNativeConfig/GeneratedDotEnv.m
rm -f ios/ReactNativeConfig/ReactNativeConfig.xcconfig

# Remove from node_modules
find node_modules/react-native-config -name "GeneratedDotEnv.m" -delete 2>/dev/null

# Remove from Pods
find ios/Pods -name "GeneratedDotEnv.m" -delete 2>/dev/null

# Remove temp override files (these can cause issues if they have old values)
rm -f /tmp/envfile
rm -f /tmp/envfile-override

echo "✅ All config files cleaned!"
echo ""
echo "Now rebuild with:"
echo "  npm run ios:dev      (for development)"
echo "  npm run ios:production (for production)"


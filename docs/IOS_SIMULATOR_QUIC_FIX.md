# iOS Simulator QUIC/HTTP3 Connection Issues

## Problem

The iOS simulator is experiencing QUIC (HTTP/3) connection failures when connecting to Supabase:

- Error: `quic_conn_change_current_path` - QUIC connection issues
- Error: `Socket is not connected` 
- Error: `The network connection was lost` (error code -1005)

## Root Cause

The iOS simulator's network stack has known issues with QUIC/HTTP/3 connections. Supabase uses QUIC by default, which can fail in the simulator.

## Solutions

### Solution 1: Retry Logic (Implemented)

The Supabase client now uses a custom fetch function with retry logic:
- Automatically retries failed requests up to 3 times
- Uses exponential backoff between retries
- Specifically handles QUIC connection errors

### Solution 2: Test on Physical Device

QUIC connections work much better on physical iOS devices:
1. Connect your iPhone/iPad to your Mac
2. Run: `npm run ios:dev` (should detect your device)
3. Or select your device in Xcode and run

### Solution 3: Disable QUIC at System Level (macOS)

If you're running macOS, you can temporarily disable QUIC for testing:

1. Open Terminal
2. Run: `sudo sysctl net.inet.udp.maxdgram=2048`
3. Or disable QUIC in System Preferences (Advanced Network settings)

**Note:** This affects your entire Mac, so only use for testing.

### Solution 4: Use Different Network

Sometimes the issue is specific to your network:
1. Try a different WiFi network
2. Try using a mobile hotspot
3. Check if you're behind a firewall/proxy

### Solution 5: Reset iOS Simulator

1. Close the simulator
2. Run: `xcrun simctl erase all` (erases all simulators)
3. Restart Xcode and run the app again

## What's Been Fixed

1. ✅ Custom fetch function with retry logic
2. ✅ Better error handling for QUIC errors
3. ✅ Exponential backoff between retries
4. ✅ Info.plist updated with Supabase domain exceptions

## Testing

After applying these fixes:

1. **Rebuild the app** (Product → Clean Build Folder, then rebuild)
2. **Try creating a profile** - it should retry automatically if QUIC fails
3. **Check logs** - you should see retry attempts if needed

## Next Steps

If retries don't work:
1. Try on a physical device (most reliable)
2. Check if Safari in simulator can load the Supabase URL
3. Verify your network connection
4. Consider using a different development environment temporarily

## References

- [iOS Simulator Network Issues](https://developer.apple.com/forums/tags/ios-simulator-network)
- [QUIC Protocol Issues](https://en.wikipedia.org/wiki/QUIC)
- [Supabase React Native Setup](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)


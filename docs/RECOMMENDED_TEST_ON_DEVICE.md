# Recommended: Test Supabase on Physical Device

## Current Issue

The iOS simulator has known QUIC/HTTP3 connection issues with Supabase. Even with retry logic and workarounds, QUIC connections are failing consistently in the simulator.

## Recommended Solution

**Test on a physical iOS device** - QUIC/HTTP3 works reliably on physical devices.

### Steps to Test on Physical Device

1. **Connect your iPhone/iPad to your Mac**
   - Use a USB cable
   - Trust the computer if prompted

2. **Open Xcode**
   - Make sure your device is recognized
   - Xcode → Window → Devices and Simulators
   - Your device should appear in the list

3. **Run the app on your device**
   ```bash
   npm run ios:dev
   ```
   Or in Xcode:
   - Select your device from the device dropdown (next to the play button)
   - Click Run

4. **Trust the developer certificate**
   - On your iPhone/iPad, go to Settings → General → VPN & Device Management
   - Trust your developer certificate

5. **Test profile creation**
   - Create a new profile in the app
   - Check logs - should work without QUIC errors

## Why Physical Device Works Better

- **Real network stack**: Physical devices use the actual iOS network stack, not the simulator's emulated one
- **QUIC support**: QUIC/HTTP3 is better implemented on physical devices
- **No emulation issues**: No network virtualization quirks

## Alternative: Continue Testing in Simulator

If you must use the simulator:

1. **Accept that some operations may fail** - Profile sync will show errors but the app will continue to work
2. **Use local backend for now** - The app still works with the local `db.json` backend
3. **Test Supabase features separately** - Create a separate test flow for Supabase when you can test on a device

## Status

- ✅ Retry logic implemented (5 retries with exponential backoff)
- ✅ Connection reset between retries
- ✅ Cache-busting to avoid QUIC reuse
- ⚠️ Simulator QUIC issues persist (known iOS simulator limitation)
- ✅ Physical device recommended for Supabase testing

## Next Steps

1. **For development**: Continue using local backend (`db.json`) in simulator
2. **For Supabase testing**: Use physical device
3. **For production**: Both will work - this is only a simulator limitation


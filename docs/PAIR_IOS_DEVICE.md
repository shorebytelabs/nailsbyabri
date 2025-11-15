# How to Pair Your iOS Device with Xcode

## Step-by-Step Instructions

### Step 1: Connect Your Device

1. **Connect your iPhone/iPad to your Mac** using a USB cable
   - Use the cable that came with your device
   - Make sure it's a data cable (not just charging)

2. **Unlock your device**
   - Enter your passcode if prompted
   - You may see a popup asking "Trust This Computer?" - tap **Trust**

### Step 2: Open Xcode

1. **Open Xcode** (if not already open)
2. **Go to Window → Devices and Simulators**
   - Or press `Cmd + Shift + 2`
   - This opens the Devices window

### Step 3: Pair Your Device

1. **In the Devices window**, you should see your device listed on the left
   - It might show as "iPhone" or "iPad" with a status

2. **If you see "Unpaired" or a pairing button:**
   - Click the device name
   - Click **"Use for Development"** or **"Pair"** button
   - You may be prompted to enter your device passcode

3. **Wait for pairing to complete**
   - Xcode will install development tools on your device
   - This may take a few minutes the first time

### Step 4: Trust Developer Certificate

1. **On your iPhone/iPad**, go to:
   - Settings → General → VPN & Device Management
   - (On older iOS: Settings → General → Device Management)

2. **Find your developer certificate**
   - It will show your Apple ID or developer name
   - Tap on it

3. **Tap "Trust [Your Name]"**
   - Confirm by tapping "Trust" again

### Step 5: Select Device in Xcode

1. **In Xcode**, look at the top toolbar
   - Next to the Play/Stop buttons, there's a device selector
   - It probably says "iPhone 16 Pro" or similar (simulator)

2. **Click the device selector dropdown**
   - You should now see your physical device listed
   - It will show your device name (e.g., "Arlene's iPhone")

3. **Select your physical device**

### Step 6: Run the App

1. **Click the Play button** (▶️) in Xcode
   - Or press `Cmd + R`

2. **First time only**: You may need to:
   - Enter your Apple ID password
   - Allow Xcode to sign the app
   - Wait for the app to install on your device

3. **The app should launch on your device!**

## Troubleshooting

### Device Not Showing Up?

1. **Check the USB cable**
   - Try a different cable
   - Make sure it's a data cable, not just charging

2. **Check USB port**
   - Try a different USB port on your Mac
   - Some ports may not support data transfer

3. **Restart both devices**
   - Restart your iPhone/iPad
   - Restart Xcode

4. **Check for updates**
   - Make sure Xcode is up to date
   - Make sure your iOS device is up to date

### "Untrusted Developer" Error?

1. **On your device**, go to:
   - Settings → General → VPN & Device Management
   - Find your developer certificate
   - Tap "Trust"

### "Could not launch" Error?

1. **Check your Apple ID**
   - Xcode → Preferences → Accounts
   - Make sure your Apple ID is signed in
   - You may need a free Apple Developer account

2. **Check signing**
   - In Xcode, select your project
   - Go to "Signing & Capabilities" tab
   - Make sure "Automatically manage signing" is checked
   - Select your Team (your Apple ID)

### Device Shows But Can't Run?

1. **Check iOS version compatibility**
   - Make sure your device iOS version is supported
   - Check the project's minimum iOS version in Xcode

2. **Clean build**
   - Product → Clean Build Folder (`Cmd + Shift + K`)
   - Then try running again

## Quick Command Line Method

If you prefer command line:

```bash
# List connected devices
xcrun xctrace list devices

# Run on your device (replace with your device name)
npm run ios:dev
```

The device should appear in the list when connected.

## What to Expect

- **First time**: Pairing and certificate setup takes 2-5 minutes
- **Subsequent runs**: Should be instant
- **App installation**: Takes 10-30 seconds depending on app size
- **Network**: Your device uses its own network (WiFi or cellular), not the simulator's

## Benefits of Physical Device

✅ QUIC/HTTP3 works properly  
✅ Real network conditions  
✅ Better performance testing  
✅ Actual device features (camera, GPS, etc.)  
✅ More accurate testing environment  

Once paired, you can use your device for all future testing!


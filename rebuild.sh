#!/bin/bash
set -e

echo "🧹 Step 1: Cleaning node_modules and lock files..."
cd "$(dirname "$0")"
rm -rf node_modules package-lock.json

echo "📦 Step 2: Reinstalling dependencies..."
npm install

echo "🧹 Step 3: Cleaning iOS build artifacts..."
rm -rf ios/build ios/DerivedData ios/Pods ios/Podfile.lock

echo "🔨 Step 4: Regenerating native iOS project..."
npx expo prebuild --platform ios --clean

echo "📦 Step 5: Installing CocoaPods..."
cd ios
pod install
cd ..

echo "🚀 Step 6: Building and running app..."
npx expo run:ios

echo "✅ Done! The app should now be running in the simulator."


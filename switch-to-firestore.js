/**
 * Helper script to switch from regular mode to Firestore mode
 * Run with: node switch-to-firestore.js
 */

import { readFileSync, writeFileSync } from "fs";

console.log("🔄 Switching to Firestore real-time mode...\n");

try {
  // Read current index.html
  let indexHtml = readFileSync("./public/index.html", "utf-8");

  // Check current mode
  if (indexHtml.includes('src="app-firestore.js"')) {
    console.log("✅ Already using Firestore mode!");
    console.log("\n📌 Next steps:");
    console.log("1. Make sure you've configured Firebase (see FIREBASE_SETUP.md)");
    console.log("2. Update Firebase config in public/app-firestore.js");
    console.log("3. Run: npm test (to test Firestore connection)");
    console.log("4. Run: npm start (to start the server)\n");
    process.exit(0);
  }

  if (indexHtml.includes('src="app.js"')) {
    // Replace app.js with app-firestore.js
    indexHtml = indexHtml.replace('src="app.js"', 'src="app-firestore.js"');

    // Write back to file
    writeFileSync("./public/index.html", indexHtml, "utf-8");

    console.log("✅ Successfully switched to Firestore mode!");
    console.log("\n📝 Changes made:");
    console.log("- Updated public/index.html to use app-firestore.js");

    console.log("\n📌 Next steps:");
    console.log("1. Update Firebase config in public/app-firestore.js");
    console.log("   - Get config from Firebase Console > Project Settings");
    console.log("2. Create Firestore index (see FIREBASE_SETUP.md)");
    console.log("3. Test connection: npm test");
    console.log("4. Start server: npm start");
    console.log("5. Open http://localhost:3001\n");

  } else {
    console.log("⚠️  Could not find app.js reference in index.html");
    console.log("Please manually update index.html to use app-firestore.js\n");
  }

} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}

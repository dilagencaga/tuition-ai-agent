/**
 * Simple test script to verify Firestore connection
 * Run with: node test-firestore.js
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import "dotenv/config";

console.log("🔍 Testing Firestore connection...\n");

try {
  // Initialize Firebase Admin
  const serviceAccount = JSON.parse(readFileSync("./firebase.json", "utf-8"));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL || "https://se4458-tuition-chat-default-rtdb.firebaseio.com"
  });

  console.log("✅ Firebase Admin initialized");

  const db = admin.firestore();
  const messagesRef = db.collection("messages");

  console.log("✅ Firestore connection established");

  // Test write
  console.log("\n📝 Testing write operation...");

  const testMessage = {
    sessionId: "test_session_" + Date.now(),
    message: "Test message from test script",
    role: "system",
    metadata: {
      test: true,
      timestamp: new Date().toISOString()
    },
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: new Date().toISOString()
  };

  const docRef = await messagesRef.add(testMessage);
  console.log("✅ Write successful! Document ID:", docRef.id);

  // Test read
  console.log("\n📖 Testing read operation...");
  const doc = await docRef.get();

  if (doc.exists) {
    console.log("✅ Read successful! Document data:");
    console.log(JSON.stringify(doc.data(), null, 2));
  } else {
    console.log("❌ Document not found");
  }

  // Test query
  console.log("\n🔎 Testing query operation...");
  const snapshot = await messagesRef
    .where("sessionId", "==", testMessage.sessionId)
    .limit(5)
    .get();

  console.log(`✅ Query successful! Found ${snapshot.size} document(s)`);

  // Cleanup test data
  console.log("\n🧹 Cleaning up test data...");
  await docRef.delete();
  console.log("✅ Cleanup successful");

  console.log("\n✨ All tests passed! Firestore is working correctly.\n");
  console.log("📌 Next steps:");
  console.log("1. Update Firebase web config in public/app-firestore.js");
  console.log("2. Create Firestore index (see FIREBASE_SETUP.md)");
  console.log("3. Update index.html to use app-firestore.js");
  console.log("4. Start the server with: npm start\n");

  process.exit(0);

} catch (error) {
  console.error("\n❌ Error:", error.message);
  console.error("\n🔧 Troubleshooting:");
  console.error("1. Make sure firebase.json exists in the project root");
  console.error("2. Verify FIREBASE_DB_URL in .env file");
  console.error("3. Check that Firestore is enabled in Firebase Console");
  console.error("4. Ensure firebase-admin package is installed: npm install\n");

  process.exit(1);
}

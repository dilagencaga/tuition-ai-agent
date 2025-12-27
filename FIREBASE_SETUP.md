# Firebase Setup Instructions

## Getting Your Firebase Configuration

To enable real-time messaging, you need to configure Firebase properly:

### 1. Get Firebase Web Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **se4458-tuition-chat**
3. Click on the gear icon ⚙️ next to "Project Overview"
4. Select "Project settings"
5. Scroll down to "Your apps" section
6. If you don't have a web app, click "Add app" and select the web icon (</>)
7. Copy the `firebaseConfig` object

### 2. Update Frontend Configuration

Edit `public/app-firestore.js` and replace the `firebaseConfig` object (around line 8) with your actual configuration:

```javascript
const firebaseConfig = {
  apiKey: "YOUR-ACTUAL-API-KEY",
  authDomain: "se4458-tuition-chat.firebaseapp.com",
  projectId: "se4458-tuition-chat",
  storageBucket: "se4458-tuition-chat.appspot.com",
  messagingSenderId: "YOUR-ACTUAL-SENDER-ID",
  appId: "YOUR-ACTUAL-APP-ID"
};
```

### 3. Enable Firestore

1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a Cloud Firestore location (e.g., us-central)
5. Click "Enable"

### 4. Set Firestore Security Rules (for development)

In Firestore Database > Rules, use these rules for development:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /messages/{messageId} {
      allow read, write: if true; // For development only
    }
  }
}
```

**IMPORTANT**: For production, implement proper security rules based on authentication.

### 5. Create Firestore Index

To enable the `orderBy` query on messages, you may need to create an index:

1. Go to Firestore Database > Indexes
2. Click "Add Index"
3. Collection ID: `messages`
4. Fields to index:
   - `sessionId` - Ascending
   - `createdAt` - Ascending
5. Query scope: Collection
6. Click "Create"

Alternatively, when you run the app for the first time, Firestore will show an error with a direct link to create the required index.

### 6. Using the Firestore Version

To use the real-time Firestore version instead of the regular version:

**Option A**: Replace the script in `public/index.html`:
```html
<!-- Change this: -->
<script src="app.js"></script>

<!-- To this: -->
<script src="app-firestore.js"></script>
```

**Option B**: Rename the files:
```bash
mv public/app.js public/app-original.js
mv public/app-firestore.js public/app.js
```

## Switching Between Modes

You now have TWO modes:

### 1. Regular Mode (app.js)
- Direct HTTP requests to `/chat` endpoint
- No real-time synchronization
- Works without Firebase frontend configuration
- Good for testing backend logic

### 2. Firestore Real-time Mode (app-firestore.js)
- Messages stored in Firestore
- Real-time synchronization across multiple clients
- Chat history persisted in database
- Full assignment requirement compliance

## Testing Real-time Functionality

1. Open two browser windows side by side
2. Use the same session ID (check localStorage)
3. Send messages from one window
4. See them appear in real-time in the other window

## Troubleshooting

### Error: "Firebase not defined"
- Make sure Firebase SDK scripts are loaded in `index.html` before `app-firestore.js`

### Error: "Missing or insufficient permissions"
- Check Firestore security rules
- Make sure you've enabled Firestore in Firebase Console

### Error: "The query requires an index"
- Click the link in the error message to create the index automatically
- Or manually create the index as described in step 5 above

### Messages not appearing in real-time
- Check browser console for errors
- Verify Firebase configuration is correct
- Ensure Firestore is enabled in Firebase Console

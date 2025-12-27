# Setup Checklist - Tuition AI Agent with Firestore

Use this checklist to ensure your project is fully configured and ready for submission.

## 📋 Pre-Deployment Checklist

### ✅ 1. Firebase Configuration

- [ ] **Get Firebase Web Config**
  1. Go to [Firebase Console](https://console.firebase.google.com/)
  2. Select project: `se4458-tuition-chat`
  3. Project Settings → Your apps → Web app
  4. Copy the `firebaseConfig` object

- [ ] **Update Frontend Config**
  - File: `public/app-firestore.js`
  - Line: ~8-15
  - Replace with your actual Firebase config:
    ```javascript
    const firebaseConfig = {
      apiKey: "YOUR-ACTUAL-API-KEY",
      authDomain: "se4458-tuition-chat.firebaseapp.com",
      projectId: "se4458-tuition-chat",
      // ... etc
    };
    ```

- [ ] **Enable Firestore**
  1. Firebase Console → Firestore Database
  2. Create database (test mode)
  3. Choose location (e.g., us-central)

- [ ] **Set Security Rules** (Development)
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /messages/{messageId} {
        allow read, write: if true;
      }
    }
  }
  ```

- [ ] **Create Firestore Index**
  - Collection: `messages`
  - Fields: `sessionId` (Ascending), `createdAt` (Ascending)
  - Or wait for error link on first run

### ✅ 2. Environment Variables

- [ ] **Check .env file exists**
  - File: `.env` in project root

- [ ] **Verify all variables are set**
  ```env
  OPENAI_API_KEY=sk-...
  TUITION_API_BASE_URL=https://localhost:7125
  ADMIN_USERNAME=admin
  ADMIN_PASSWORD=123456
  FIREBASE_DB_URL=https://se4458-tuition-chat-default-rtdb.firebaseio.com
  ```

- [ ] **Test API base URL**
  - Ensure midterm API is running
  - Test: `curl https://localhost:7125/api/v1/tuition/88 -k`

### ✅ 3. Dependencies

- [ ] **Install Node packages**
  ```bash
  npm install
  ```

- [ ] **Verify critical packages**
  - [x] express
  - [x] firebase-admin
  - [x] openai
  - [x] cors
  - [x] dotenv

### ✅ 4. Switch to Firestore Mode

- [ ] **Option A: Use helper script**
  ```bash
  node switch-to-firestore.js
  ```

- [ ] **Option B: Manual update**
  - Edit `public/index.html`
  - Change `<script src="app.js"></script>`
  - To `<script src="app-firestore.js"></script>`

### ✅ 5. Testing

- [ ] **Test Firestore connection**
  ```bash
  npm test
  ```
  Should show: ✅ All tests passed!

- [ ] **Start midterm API**
  ```bash
  cd UniversityTuitionApi/se4458-university-tuition-api
  dotnet run --project UniversityTuitionApi
  ```
  Should run on: https://localhost:7125

- [ ] **Start Node server**
  ```bash
  npm start
  ```
  Should run on: http://localhost:3001

- [ ] **Test in browser**
  - Open: http://localhost:3001
  - No console errors in DevTools
  - Can see welcome message

- [ ] **Test chat functionality**
  - Query tuition: "88 harç bilgimi göster"
  - Pay tuition: "harç öde 88"
  - Unpaid list: "ödenmemiş harçlar"

- [ ] **Test real-time sync**
  - Open two browser tabs
  - Send message in one tab
  - See it appear in other tab (if same session)

- [ ] **Test persistence**
  - Send a few messages
  - Refresh the page
  - History should load

## 📝 Documentation Checklist

### ✅ Required Documentation

- [x] **README.md**
  - Project overview
  - Installation instructions
  - API documentation
  - Technology stack

- [x] **FIREBASE_SETUP.md**
  - Firebase configuration guide
  - Troubleshooting steps

- [x] **IMPLEMENTATION_SUMMARY.md**
  - What was implemented
  - Architecture changes
  - Features added

- [ ] **Add your design decisions** (in README)
  - Why Firestore vs alternatives
  - State management approach
  - Security considerations

- [ ] **Document known issues** (in README)
  - Any bugs or limitations
  - Workarounds applied

## 🎥 Video Presentation Checklist

- [ ] **Record demo video**
  - Show running application
  - Demonstrate all features
  - Explain architecture

- [ ] **Demo scenarios to show**
  1. Query tuition for a student
  2. Pay tuition
  3. View unpaid tuitions
  4. Real-time messaging (two browser windows)
  5. Chat history persistence

- [ ] **Upload video**
  - YouTube (unlisted) or Google Drive
  - Add link to README.md

- [ ] **Video should include**
  - Code walkthrough
  - Firebase Firestore console
  - Real-time synchronization demo
  - API Gateway explanation

## 🚀 Deployment Checklist (Optional)

Since assignment allows local LLM, deployment is optional.

If deploying:

- [ ] **Backend options**
  - Heroku, Railway, Render
  - Azure App Service
  - Google Cloud Run

- [ ] **Frontend options**
  - Firebase Hosting
  - Netlify
  - Vercel

- [ ] **Environment variables**
  - Set on deployment platform
  - Don't commit .env to git

- [ ] **Update CORS**
  - Allow production domain

## 📤 Submission Checklist

- [ ] **GitHub repository**
  - Code pushed to GitHub
  - README.md updated
  - .gitignore includes .env, node_modules

- [ ] **README must include**
  - [x] Code link (GitHub URL)
  - [ ] Your design and assumptions
  - [ ] Issues encountered and solutions
  - [ ] Link to demo video
  - [ ] (Optional) Deployment link

- [ ] **Test from fresh clone**
  ```bash
  git clone <your-repo-url>
  cd <repo-name>
  npm install
  # Configure .env and Firebase
  npm start
  ```

- [ ] **Assignment deliverables**
  - GitHub repository URL
  - README with required sections
  - Demo video link
  - (Optional) Deployment URL

## ⚠️ Common Issues & Solutions

### Issue: "Firebase not defined"
**Solution**: Verify Firebase SDK scripts are in index.html before app-firestore.js

### Issue: "The query requires an index"
**Solution**:
1. Click the link in the error message, OR
2. Manually create index in Firebase Console
3. See FIREBASE_SETUP.md for details

### Issue: "Missing or insufficient permissions"
**Solution**:
1. Check Firestore security rules
2. Set to test mode for development
3. See FIREBASE_SETUP.md

### Issue: "fetch failed" when calling APIs
**Solution**:
1. Ensure midterm API is running
2. Check TUITION_API_BASE_URL in .env
3. Verify SSL certificate (NODE_TLS_REJECT_UNAUTHORIZED)

### Issue: Messages not appearing in real-time
**Solution**:
1. Check browser console for errors
2. Verify Firebase config in app-firestore.js
3. Ensure Firestore listener is set up
4. Check network tab for WebSocket connection

## 📊 Testing Matrix

| Feature | Regular Mode | Firestore Mode | Status |
|---------|-------------|----------------|--------|
| Query Tuition | ✅ | ✅ | |
| Pay Tuition | ✅ | ✅ | |
| Unpaid List | ✅ | ✅ | |
| Chat History | ❌ | ✅ | |
| Real-time Sync | ❌ | ✅ | |
| Multi-client | ❌ | ✅ | |
| Intent Parsing | ✅ | ✅ | |
| Error Handling | ✅ | ✅ | |

## 🎯 Final Pre-Submission Check

Run these commands and verify all pass:

```bash
# 1. Test Firestore
npm test
# Expected: ✅ All tests passed!

# 2. Start server
npm start
# Expected: ✅ Server running on http://localhost:3001

# 3. Check browser
# Open http://localhost:3001
# Expected: No console errors, chat works

# 4. Check files exist
ls README.md FIREBASE_SETUP.md IMPLEMENTATION_SUMMARY.md
# Expected: All files present

# 5. Check git status
git status
# Expected: .env not tracked (in .gitignore)
```

## ✅ Ready for Submission

When all items are checked:

1. **Commit and push final changes**
   ```bash
   git add .
   git commit -m "Final submission: Firestore real-time messaging implementation"
   git push origin main
   ```

2. **Update README with**
   - GitHub URL
   - Video link
   - Team members

3. **Submit to instructor**
   - GitHub repository URL
   - Verify all requirements met

---

**Good luck with your submission!** 🎉

If you encounter any issues, refer to:
- [README.md](README.md) - General documentation
- [FIREBASE_SETUP.md](FIREBASE_SETUP.md) - Firebase configuration
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - What was implemented

# ⚠️ SECURITY NOTICE

## IMPORTANT: Firebase Credentials

The file `firebase.json` in this project contains **sensitive Firebase service account credentials** including a private key.

### ⛔ DO NOT COMMIT THIS FILE TO PUBLIC REPOSITORIES

This file is now added to `.gitignore` to prevent accidental commits.

### What to do:

1. **For Git Repository:**
   ```bash
   # If you already committed firebase.json, remove it from git:
   git rm --cached firebase.json
   git commit -m "Remove sensitive firebase credentials"
   git push
   ```

2. **For Submission:**
   - Either use environment variables for Firebase config
   - Or provide setup instructions in README
   - Share credentials privately with instructor if needed

3. **Best Practice:**
   Create a template file `firebase.json.example`:
   ```json
   {
     "type": "service_account",
     "project_id": "your-project-id",
     "private_key_id": "your-private-key-id",
     "private_key": "REPLACE-WITH-YOUR-ACTUAL-KEY",
     "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
     ...
   }
   ```
   Commit the example file, not the real one.

## Other Sensitive Files

The following files are already in `.gitignore`:

- `.env` - Contains API keys and passwords
- `node_modules/` - Dependencies
- `secrets/` - Any secret files

## What's Safe to Commit

- ✅ Source code (JS, HTML, CSS)
- ✅ README and documentation
- ✅ package.json (no secrets)
- ✅ Public Firebase config (apiKey, authDomain - these are OK for client-side)
- ❌ firebase.json (service account credentials)
- ❌ .env file
- ❌ Private keys

## Firebase Web Config vs Service Account

### Firebase Web Config (SAFE for public repos)
This goes in your frontend JavaScript and is safe to expose:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",  // This is OK to be public
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-project",
  // These are designed to be public
};
```

### Service Account (NEVER commit publicly)
This is in `firebase.json` and contains a **private key** - NEVER expose:
```json
{
  "type": "service_account",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",  // SECRET!
  ...
}
```

## If Credentials Are Exposed

If you accidentally committed `firebase.json` to a public repository:

1. **Immediately revoke the service account**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Delete the exposed service account
   - Generate a new one

2. **Remove from Git history**
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch firebase.json" \
     --prune-empty --tag-name-filter cat -- --all
   ```

3. **Force push** (only if you're the only one using the repo)
   ```bash
   git push origin --force --all
   ```

## For This Assignment

Since this is an academic project:

1. The firebase.json is already in your project
2. It's now added to .gitignore
3. For submission:
   - Share the GitHub URL
   - Provide setup instructions in README
   - If instructor needs to run it, share firebase.json privately (email, LMS)

## Questions?

If you're unsure about what's safe to commit, ask yourself:
- "If someone else got this file, could they access my Firebase/OpenAI/etc.?"
- If YES → Don't commit it
- If NO → Safe to commit

---

**Stay safe! 🔒**

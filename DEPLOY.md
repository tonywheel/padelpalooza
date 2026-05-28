# Deploying + Enabling Live Sharing

## Step 1 — Create a Firebase project (free, ~3 min)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → give it any name → click through the wizard
3. Once created, click **Build → Realtime Database** in the left sidebar
4. Click **Create Database** → choose your region → start in **test mode**
   (test mode allows read/write without auth — fine for a day-of tournament)
5. Click the **gear icon → Project settings → Your apps → Add app → Web (</>)**
6. Register the app (no need for Firebase Hosting) → copy the `firebaseConfig` object shown

## Step 2 — Add your credentials locally

Create a file called `.env.local` in the project root:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=1:123...
```

Then rebuild:
```bash
npm run build
```

## Step 3 — Deploy to Vercel (free, ~2 min)

```bash
# Install the Vercel CLI (once)
npm install -g vercel

# Deploy from the project folder
cd /path/to/tennis-tournament
vercel

# Follow the prompts:
#  - Link to existing project? No → create new
#  - Project name: tennis-tournament (or anything)
#  - Build command: npm run build
#  - Output directory: dist
#  - Add env vars: paste all 5 VITE_FIREBASE_* values when prompted
```

Vercel gives you a URL like `https://tennis-tournament-abc.vercel.app`.

## Step 4 — Use it on tournament day

1. Open the app on your iPhone (Safari → Add to Home Screen for the best experience)
2. Create the bracket as normal
3. Tap **📡 Share Live** → enter a name like "Padel Palooza" → **Go Live**
4. Share the link `https://your-app.vercel.app/v/padelpalooza` with everyone
5. As you enter results on your phone, all viewers see updates in ~1 second

## Firebase security note

Test mode allows anyone to read AND write your tournament data.
For extra safety after the tournament, go to Firebase Console →
Realtime Database → Rules and change to:

```json
{
  "rules": {
    "tournaments": {
      "$slug": {
        ".read": true,
        ".write": false
      }
    }
  }
}
```

This makes everything read-only publicly (only you can write via the SDK key).

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * True when all required env vars are present.
 * The app works in fully-offline mode when false — Firebase features are hidden.
 */
export const isFirebaseConfigured: boolean =
  !!firebaseConfig.databaseURL && !!firebaseConfig.apiKey;

let _app: FirebaseApp | null = null;
let _db: Database | null = null;

if (isFirebaseConfigured) {
  _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  _db = getDatabase(_app);
}

export const firebaseApp = _app;
export const db = _db;

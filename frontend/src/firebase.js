import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Check if valid Firebase configuration is provided
const isValidConfig = firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your_api_key_here' && firebaseConfig.apiKey.length > 5;

let app;
let auth = null;
let db = null;

if (isValidConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("🎒 Firebase initialized successfully!");
  } catch (error) {
    console.error("❌ Failed to initialize Firebase:", error);
  }
} else {
  console.warn(
    "⚠️ Firebase Config is missing or incomplete! " +
    "Please update your frontend/.env file with real Firebase project details. " +
    "Mock services or fallback prompts will be used for standard operations."
  );
}

export { app, auth, db, isValidConfig };

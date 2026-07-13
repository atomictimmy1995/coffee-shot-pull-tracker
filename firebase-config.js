/*
 * Firebase web app configuration.
 *
 * Paste your project's config here: Firebase console → Project settings →
 * Your apps → Web app (</>) → SDK setup and configuration → Config.
 * These values are public identifiers (not secrets) and are safe to commit;
 * data access is protected by Firebase Auth and the Firestore security
 * rules in firestore.rules, not by hiding these keys.
 *
 * Until this is filled in, the app runs in guest-only mode.
 */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAHqvUnv8bqs5a0Jh14T_FdO_5WXz39cCw",
  authDomain: "coffee-shot-tracker.firebaseapp.com",
  projectId: "coffee-shot-tracker",
  storageBucket: "coffee-shot-tracker.firebasestorage.app",
  messagingSenderId: "808855624323",
  appId: "1:808855624323:web:ba848334206a702b2b59b6",
  measurementId: "G-L7MZE3JS8B",

  // App Check (bot protection): reCAPTCHA v3 SITE key, registered under
  // App Check in the Firebase console. Empty = App Check disabled.
  appCheckSiteKey: "6LcrxFEtAAAAAHD4-xk3Zceg4cK6922RAAGiYzzs"
};

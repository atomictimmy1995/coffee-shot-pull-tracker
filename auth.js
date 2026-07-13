/*
 * Authentication via Firebase Auth (email/password + Google).
 *
 * The Firebase web config lives in firebase-config.js; until it's filled
 * in, the app runs in guest-only mode with a notice on the sign-in card.
 * Guest mode never touches Firebase — it's a local session flag, and
 * guest shots stay in localStorage (see store.js).
 *
 * Apple sign-in is prepped but hidden: it requires a paid Apple Developer
 * membership regardless of auth provider. To enable it later, configure
 * Apple in the Firebase console and unhide the button in index.html.
 */
import { initializeApp } from "./vendor/firebase/firebase-app.js";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider
} from "./vendor/firebase/firebase-auth.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "./vendor/firebase/firebase-app-check.js";

const SESSION_KEY = "espresso-session";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const config = window.FIREBASE_CONFIG || {};
const configured = !!(config.apiKey && config.projectId &&
  config.apiKey.indexOf("PASTE_") === -1 && config.projectId.indexOf("PASTE_") === -1);

export const firebaseApp = configured ? initializeApp(config) : null;
export const firebaseConfigured = configured;

const auth = configured ? getAuth(firebaseApp) : null;
if (auth && config.useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}

/*
 * App Check: proves requests come from this app (not scripts abusing the
 * public API key). Inert until appCheckSiteKey is set in firebase-config.js
 * and the app is registered under App Check in the Firebase console.
 */
if (firebaseApp && config.appCheckSiteKey) {
  if (config.useEmulators || location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    // Local development: use a debug token instead of real reCAPTCHA.
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(config.appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}

/* ---------- guest session ---------- */
function isGuest() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    return !!(session && session.guest);
  } catch (e) {
    return false;
  }
}

function setGuest(on) {
  if (on) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ guest: true }));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

/* ---------- friendly error messages ---------- */
function friendlyError(err) {
  switch (err && err.code) {
    case "auth/email-already-in-use":
      return "An account with that email already exists.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 8 characters.";
    case "auth/user-not-found":
      return "No account found with that email.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts — try again in a few minutes.";
    case "auth/network-request-failed":
      return "Network error — check your connection and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return ""; // user dismissed the popup; not an error worth showing
    default:
      return (err && err.message) || "Something went wrong. Please try again.";
  }
}

function notConfiguredError() {
  return new Error("Cloud accounts aren't set up yet — add your Firebase config to firebase-config.js (see README). You can still continue as guest.");
}

/* ---------- auth API ---------- */
function currentUser() {
  if (isGuest()) return { guest: true };
  const u = auth && auth.currentUser;
  if (!u) return null;
  // Email/password accounts must verify before using the app (the
  // Firestore rules also enforce this server-side). Google accounts
  // arrive with emailVerified already true.
  if (!u.emailVerified) return { unverified: true, email: u.email };
  return { email: u.email, uid: u.uid };
}

function signUp(email, password) {
  if (!configured) return Promise.reject(notConfiguredError());
  email = email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return Promise.reject(new Error("Enter a valid email address."));
  }
  if (password.length < 8) {
    return Promise.reject(new Error("Password must be at least 8 characters."));
  }
  setGuest(false);
  return createUserWithEmailAndPassword(auth, email, password)
    .then(function (cred) {
      // Best-effort: the verify panel has a resend button if this fails.
      return sendEmailVerification(cred.user).catch(function () {});
    })
    .catch(rethrowFriendly);
}

function resendVerification() {
  if (!auth || !auth.currentUser) return Promise.reject(new Error("Not signed in."));
  return sendEmailVerification(auth.currentUser).catch(rethrowFriendly);
}

function refreshVerification() {
  if (!auth || !auth.currentUser) return Promise.resolve(false);
  return auth.currentUser.reload().then(function () {
    if (!auth.currentUser.emailVerified) {
      emitChange();
      return false;
    }
    // Force-refresh the ID token: the email_verified claim lives in the
    // token, and Firestore rules check the token — without this, writes
    // stay denied until the old token expires (up to an hour).
    return auth.currentUser.getIdToken(true).then(function () {
      emitChange();
      return true;
    });
  });
}

function signIn(email, password) {
  if (!configured) return Promise.reject(notConfiguredError());
  setGuest(false);
  return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password).catch(rethrowFriendly);
}

function oauthSignIn(provider) {
  if (!configured) return Promise.reject(notConfiguredError());
  setGuest(false);
  if (provider === "google") {
    return signInWithPopup(auth, new GoogleAuthProvider()).catch(rethrowFriendly);
  }
  if (provider === "apple") {
    // Requires an Apple Developer membership + Apple provider enabled in
    // the Firebase console before the button is unhidden in index.html.
    return signInWithPopup(auth, new OAuthProvider("apple.com")).catch(rethrowFriendly);
  }
  return Promise.reject(new Error("Unknown provider."));
}

function rethrowFriendly(err) {
  throw new Error(friendlyError(err));
}

function signInAsGuest() {
  const finish = () => emitChange();
  setGuest(true);
  if (auth && auth.currentUser) {
    firebaseSignOut(auth).then(finish);
  } else {
    finish();
  }
}

function signOut() {
  setGuest(false);
  if (auth) {
    firebaseSignOut(auth).then(() => emitChange());
  } else {
    emitChange();
  }
}

function emitChange() {
  document.dispatchEvent(new CustomEvent("authchange", { detail: currentUser() }));
}

window.Auth = {
  currentUser,
  signUp,
  signIn,
  signInAsGuest,
  signOut,
  oauthSignIn,
  resendVerification,
  refreshVerification
};

/* ---------- UI wiring ---------- */
const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const tabSignIn = document.getElementById("tabSignIn");
const tabSignUp = document.getElementById("tabSignUp");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const confirmField = document.getElementById("confirmField");
const authConfirm = document.getElementById("authConfirm");
const authSubmit = document.getElementById("authSubmit");
const authError = document.getElementById("authError");
const authConfigNote = document.getElementById("authConfigNote");
const userEmailEl = document.getElementById("userEmail");
const signOutBtn = document.getElementById("signOutBtn");
const guestLink = document.getElementById("guestLink");
const verifyView = document.getElementById("verifyView");
const verifyEmailEl = document.getElementById("verifyEmail");
const verifyRefresh = document.getElementById("verifyRefresh");
const verifyResend = document.getElementById("verifyResend");
const verifySignOut = document.getElementById("verifySignOut");
const verifyNote = document.getElementById("verifyNote");

let mode = "signin"; // or "signup"

function setMode(next) {
  mode = next;
  const signup = mode === "signup";
  tabSignIn.classList.toggle("active", !signup);
  tabSignUp.classList.toggle("active", signup);
  confirmField.hidden = !signup;
  authConfirm.required = signup;
  authSubmit.textContent = signup ? "Create Account" : "Sign In";
  authError.textContent = "";
}

tabSignIn.addEventListener("click", () => setMode("signin"));
tabSignUp.addEventListener("click", () => setMode("signup"));

if (!configured) {
  authConfigNote.hidden = false;
  authSubmit.disabled = true;
  authView.querySelectorAll("[data-oauth]").forEach((btn) => { btn.disabled = true; });
}

function render() {
  const user = currentUser();
  const unverified = !!(user && user.unverified);
  const active = !!(user && !user.unverified);
  authView.hidden = !!user;
  verifyView.hidden = !unverified;
  appView.hidden = !active;
  if (unverified) {
    verifyEmailEl.textContent = user.email;
  } else {
    verifyNote.textContent = "";
  }
  if (active) {
    userEmailEl.textContent = user.guest ? "Guest" : user.email;
  }
  if (!user) {
    authForm.reset();
    setMode("signin");
  }
}

authForm.addEventListener("submit", (e) => {
  e.preventDefault();
  authError.textContent = "";
  const email = authEmail.value;
  const password = authPassword.value;

  let action;
  if (mode === "signup") {
    if (password !== authConfirm.value) {
      authError.textContent = "Passwords do not match.";
      return;
    }
    action = signUp(email, password);
  } else {
    action = signIn(email, password);
  }
  authSubmit.disabled = true;
  action
    .catch((err) => {
      authError.textContent = err.message;
    })
    .then(() => {
      authSubmit.disabled = !configured;
    });
});

authView.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-oauth]");
  if (!btn) return;
  authError.textContent = "";
  oauthSignIn(btn.getAttribute("data-oauth")).catch((err) => {
    authError.textContent = err.message;
  });
});

guestLink.addEventListener("click", (e) => {
  e.preventDefault();
  signInAsGuest();
});

signOutBtn.addEventListener("click", signOut);

/* verify panel */
verifyRefresh.addEventListener("click", () => {
  verifyNote.textContent = "";
  refreshVerification().then((verified) => {
    if (!verified) {
      verifyNote.textContent = "Not verified yet — click the link in the email (check spam), then try again.";
    }
  });
});

verifyResend.addEventListener("click", () => {
  verifyNote.textContent = "";
  resendVerification()
    .then(() => { verifyNote.textContent = "Verification email sent."; })
    .catch((err) => { verifyNote.textContent = err.message; });
});

verifySignOut.addEventListener("click", signOut);

document.addEventListener("authchange", render);

if (auth) {
  // Fires once on load with the restored session (or null), then on every
  // sign-in/out. Firebase sessions and the guest flag are mutually
  // exclusive: signing in clears the flag, going guest signs out Firebase.
  onAuthStateChanged(auth, () => emitChange());
} else {
  emitChange();
}
render();

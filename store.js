/*
 * Shot storage. Signed-in users read/write users/{uid}/shots in
 * Firestore (access is restricted to the owner by firestore.rules);
 * guests keep using the original localStorage key, so the app works
 * fully offline and before Firebase is configured.
 */
import { firebaseApp } from "./auth.js";
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch
} from "./vendor/firebase/firebase-firestore.js";

const LOCAL_KEY = "espresso-shots";

let db = null;
if (firebaseApp) {
  db = getFirestore(firebaseApp);
  if ((window.FIREBASE_CONFIG || {}).useEmulators) {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
}

/* ---------- localStorage (guest) ---------- */
function localLoad() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function localSave(shots) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(shots));
}

/* ---------- Firestore (signed-in) ---------- */
function cloudUid() {
  const user = window.Auth && window.Auth.currentUser();
  return user && user.uid && db ? user.uid : null;
}

function shotDoc(uid, id) {
  return doc(db, "users", uid, "shots", String(id));
}

async function cloudList(uid) {
  const snap = await getDocs(collection(db, "users", uid, "shots"));
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* ---------- public API ---------- */
window.ShotStore = {
  list() {
    const uid = cloudUid();
    return uid ? cloudList(uid) : Promise.resolve(localLoad());
  },

  add(shot) {
    const uid = cloudUid();
    if (uid) return setDoc(shotDoc(uid, shot.id), shot);
    const shots = localLoad();
    shots.unshift(shot);
    localSave(shots);
    return Promise.resolve();
  },

  remove(id) {
    const uid = cloudUid();
    if (uid) return deleteDoc(shotDoc(uid, id));
    localSave(localLoad().filter((s) => String(s.id) !== String(id)));
    return Promise.resolve();
  },

  async clear() {
    const uid = cloudUid();
    if (!uid) {
      localSave([]);
      return;
    }
    const snap = await getDocs(collection(db, "users", uid, "shots"));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};

/*
 * A restored session can fire authchange before this module (and the
 * large Firestore bundle it imports) has loaded, making the app's
 * renderHistory a no-op. Announce readiness so the history re-renders.
 */
document.dispatchEvent(new CustomEvent("shotschange"));

/*
 * One-time import: when someone signs in on a device that has guest
 * shots, offer to move them into the account. Asked at most once per
 * account per device, whatever the answer.
 */
document.addEventListener("authchange", (e) => {
  const user = e.detail;
  if (!user || !user.uid || !db) return;
  const askedKey = "espresso-shots-import-asked:" + user.uid;
  if (localStorage.getItem(askedKey)) return;
  const local = localLoad();
  if (!local.length) return;
  localStorage.setItem(askedKey, "1");
  const move = confirm(
    "You have " + local.length + " shot" + (local.length === 1 ? "" : "s") +
    " saved on this device. Move " + (local.length === 1 ? "it" : "them") +
    " into your account?"
  );
  if (!move) return;
  const batch = writeBatch(db);
  local.forEach((s) => batch.set(shotDoc(user.uid, s.id), s));
  batch.commit().then(() => {
    localSave([]);
    document.dispatchEvent(new CustomEvent("shotschange"));
  });
});

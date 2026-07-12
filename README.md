# coffee-shot-pull-tracker

A web app for tracking espresso shot pulls — plain HTML/CSS/JS, no build step. Hosted free on GitHub Pages with free Firebase accounts and cross-device shot history.

## Features

- **Shot timer** — start/stop timer with tenth-of-a-second precision; stopping the timer automatically fills in the shot time field
- **Shot details** — record the coffee company, beans, grind size, coffee in weight (g), coffee out weight (g), and free-form comments (tasting notes, adjustments to try)
- **Brew ratio** — live ratio preview (e.g. `1:2.0`) calculated from the in/out weights
- **Accounts** — sign up with email/password or Google; your shot history is stored in Firestore and follows you across devices. On first sign-in, shots saved on the device can be imported into the account.
- **Guest mode** — no account needed; shots stay in the browser's `localStorage`
- **Shot history** — newest-first with all details, per-entry delete and clear-all
- Light and dark mode, following your system preference
- Apple sign-in is prepped but hidden — it requires a paid Apple Developer membership ($99/yr). To enable: configure the Apple provider in Firebase and remove `hidden` from the Apple button in `index.html`.

## Architecture (all free tier)

| Concern | Tech | Cost |
|---|---|---|
| Hosting | GitHub Pages | Free |
| Auth (email/password + Google) | Firebase Authentication (Spark plan) | Free |
| Shot storage | Cloud Firestore (Spark plan) | Free — 50k reads / 20k writes per day |
| Guest mode | `localStorage` | Free |

The Firebase SDK is vendored in `vendor/firebase/` (no CDN or npm install needed). `auth.js` handles sign-in and exposes `window.Auth`; `store.js` routes shot storage to Firestore for signed-in users and `localStorage` for guests via `window.ShotStore`; `app.js` is the tracker UI.

## Setup

### 1. Host it on GitHub Pages (~5 min)

Repo **Settings → Pages → Source: Deploy from a branch → `main` / root**. The app goes live at `https://<your-username>.github.io/coffee-shot-pull-tracker/`. Every push to `main` redeploys automatically.

Until Firebase is configured the app shows a notice on the sign-in card and works in guest mode.

### 2. Create the Firebase project (~10 min, free)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (any name, Analytics optional). Stay on the default **Spark (free)** plan — no credit card.
2. **Build → Authentication → Get started → Sign-in method**: enable **Email/Password** and **Google**.
3. **Build → Firestore Database → Create database** (production mode, any location).
4. **Firestore Database → Rules**: paste the contents of [`firestore.rules`](firestore.rules) and publish. This restricts every user to their own data.
5. **Authentication → Settings → Authorized domains**: add `<your-username>.github.io`.
6. **Project settings (gear) → Your apps → Web app (`</>`)**: register an app, copy the `firebaseConfig` values into [`firebase-config.js`](firebase-config.js), commit, and push.

These config values are public identifiers, not secrets — data access is enforced by Firebase Auth and the Firestore rules, not by hiding the keys.

### Run locally

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

(`localhost` is pre-authorized for Firebase sign-in; opening `index.html` directly via `file://` won't work because the app uses ES modules.)

### Test without a real Firebase project

The Firebase Emulator Suite (needs Java + Node) can stand in for the real services:

```sh
npx firebase-tools emulators:start --project demo-espresso --only auth,firestore
```

Then set `useEmulators: true` in `firebase-config.js` with `projectId: "demo-espresso"` and any `apiKey`.

## Free-tier limits

GitHub Pages allows 100 GB bandwidth/month; Firebase Spark allows 50k monthly active users, 1 GiB Firestore storage, 50k reads / 20k writes per day. A personal shot tracker uses a tiny fraction of all of these, and with no credit card on file Firebase cannot silently start charging.

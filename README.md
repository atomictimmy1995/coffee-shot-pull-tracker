# coffee-shot-pull-tracker

A simple web app for tracking espresso shot pulls — no build step, no dependencies. Just open `index.html` in a browser.

## Features

- **Shot timer** — start/stop timer with tenth-of-a-second precision; stopping the timer automatically fills in the shot time field
- **Shot details** — record the coffee company, beans, grind size, coffee in weight (g), coffee out weight (g), and free-form comments (tasting notes, adjustments to try)
- **Brew ratio** — live ratio preview (e.g. `1:2.0`) calculated from the in/out weights
- **Shot history** — saved shots are listed newest-first with all details, and persist in the browser via `localStorage`
- **Manage entries** — delete individual shots or clear the whole history
- **Accounts** — create an account with email and password, sign in/out, and keep a separate shot history per account; "Continue as guest" uses the shared local history
- Sign in with Google / Apple buttons, ready to be wired to an auth backend
- Light and dark mode, following your system preference

## Usage

Open `index.html` directly, or serve it locally:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Start the timer when the shot begins pulling, stop it when done, fill in the rest of the details, and hit **Save Shot**.

## Accounts and authentication

The app is prepped for user accounts, but currently everything runs client-side in `auth.js`:

- **Email + password** — accounts are stored in the browser's `localStorage` with PBKDF2-hashed (salted, 100k iterations) passwords. Each account gets its own shot history; guest mode uses the original shared history key.
- **Google / Apple sign-in** — the buttons are in place but disabled until OAuth is configured (they explain this when clicked).

> ⚠️ **This is demo-grade auth.** Accounts only exist in one browser, nothing syncs, and client-side password hashing is not real security. Before launching to real users, swap the functions in `auth.js` for a hosted auth provider.

### Path to production

`auth.js` exposes a small API (`Auth.signUp`, `Auth.signIn`, `Auth.signOut`, `Auth.oauthSignIn`, `Auth.currentUser`) — replace the internals of those functions with a real backend and the UI keeps working:

1. **Pick a provider** — [Firebase Authentication](https://firebase.google.com/docs/auth) and [Supabase Auth](https://supabase.com/docs/guides/auth) both support email/password, Google, and Apple out of the box on their free tiers.
2. **Google sign-in** — create an OAuth client ID in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and add it to your provider's config.
3. **Apple sign-in** — requires an [Apple Developer Program](https://developer.apple.com/programs/) membership ($99/yr); create a Services ID and key, then add them to your provider's config.
4. **Move shot storage server-side** — once users can sign in from multiple devices, shots should live in a database (e.g. Firestore/Supabase) keyed by user ID instead of `localStorage`.

# Firebase setup (one-time, console)

Sign-in + cross-device sync use Firebase project **`movietimeline-35751`**. The web config in `assets/auth.js` is public by design (Firebase web API keys are client identifiers, not secrets). Four things must be enabled in the [Firebase console](https://console.firebase.google.com/project/movietimeline-35751) before sign-in works:

## 1. Enable Google sign-in
Authentication → **Sign-in method** → add **Google** → enable → save.

## 2. Authorize the domains
Authentication → **Settings** → **Authorized domains** → add:
- `timelines.hackatoa.com`
- `hackatoan.github.io`
- `localhost` (already there — for local testing)

Without this you'll get `auth/unauthorized-domain` on sign-in.

## 3. Create Firestore
Build → **Firestore Database** → Create database → **Production mode** → pick a region.

## 4. Security rules
The rules live in [`firestore.rules`](firestore.rules) (each user can only read/write their own progress, and only in the shapes the app writes). Deploy with:

```bash
firebase deploy --only firestore:rules --project movietimeline-35751
```

Or paste the file into Firestore → **Rules** → Publish.

## How sync works
- Signed **out**: progress lives only in `localStorage` (per browser), exactly as before.
- Signed **in**: each franchise’s progress is a document at `users/{uid}/franchises/{franchiseId}` (`done`, `skip`, `filters`, `updatedAt`).
- Strategy is **last-write-wins per franchise**: on sign-in each franchise is compared by `updatedAt`; the newer side wins wholesale, and local changes push to the cloud (debounced). Signing in on a fresh device pulls your saved progress; signing in on a device that already has local progress merges it up on first sync.

## Data export / delete
A user’s data is entirely under `users/{their-uid}`. Deleting that document tree removes all their stored progress.

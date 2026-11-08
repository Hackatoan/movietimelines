/* MovieTimelines — Google sign-in + cross-device progress sync (Firebase).
   ES module. Progress stays in localStorage for signed-out/offline use; when signed in,
   each franchise doc syncs to Firestore with last-write-wins per franchise. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAnalytics, isSupported as analyticsSupported } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs }
  from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB6X6zrognYJ_6AZbWkCBEGu6mX0K1I2iw",
  authDomain: "movietimeline-35751.firebaseapp.com",
  projectId: "movietimeline-35751",
  storageBucket: "movietimeline-35751.firebasestorage.app",
  messagingSenderId: "649737119101",
  appId: "1:649737119101:web:fea06da196af8d17f85814",
  measurementId: "G-VD95HSYTT8"
};

const app = initializeApp(firebaseConfig);
analyticsSupported().then((ok) => { if (ok && location.hostname !== 'localhost') { try { getAnalytics(app); } catch (e) {} } });
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let user = null;
let pushTimers = {};

// ---- storage helpers (mirror core.js key scheme; core.js may not be loaded first in module timing) ----
const K = (id) => ({ done: `mt:${id}:done`, skip: `mt:${id}:skip`, filters: `mt:${id}:filters`, at: `mt:${id}:updatedAt` });
const readArr = (k) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : []; } catch (e) { return []; } };
const readObj = (k) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : {}; } catch (e) { return {}; } };
const readNum = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch (e) { return 0; } };
const writeRaw = (k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} };

async function franchiseIds() {
  try {
    // reuse the page's registry request when core.js is present (classic scripts run before modules)
    const j = (window.MT && MT.registry) ? await MT.registry()
      : await (await fetch('data/franchises.json', { cache: 'no-cache' })).json();
    return j.order || [];
  } catch (e) { return []; }
}

function localSnapshot(id) {
  const k = K(id);
  return { done: readArr(k.done), skip: readArr(k.skip), filters: readObj(k.filters), updatedAt: readNum(k.at) };
}
function writeLocal(id, snap) {
  const k = K(id);
  writeRaw(k.done, snap.done || []);
  writeRaw(k.skip, snap.skip || []);
  writeRaw(k.filters, snap.filters || {});
  writeRaw(k.at, String(snap.updatedAt || 0));
}

async function cloudRef(id) { return doc(db, 'users', user.uid, 'franchises', id); }
async function pullCloud(id) {
  try { const s = await getDoc(await cloudRef(id)); return s.exists() ? s.data() : null; }
  catch (e) { return null; }
}
// One collection query for every franchise doc the user has, instead of one getDoc per
// franchise id (~36 separate reads). Returns null on failure so callers fall back to pullCloud().
async function pullAllCloud() {
  try {
    const qs = await getDocs(collection(db, 'users', user.uid, 'franchises'));
    const m = new Map(); qs.forEach((d) => m.set(d.id, d.data())); return m;
  } catch (e) { return null; }
}
async function pushCloud(id, snap) {
  try { await setDoc(await cloudRef(id), { done: snap.done || [], skip: snap.skip || [], filters: snap.filters || {}, updatedAt: snap.updatedAt || Date.now() }); return true; }
  catch (e) { console.warn('sync push failed', id, e && e.code); return false; }
}

// last-write-wins per franchise; empty local + empty cloud => nothing
async function syncOne(id, cloudAll) {
  const local = localSnapshot(id);
  const cloud = cloudAll ? (cloudAll.get(id) || null) : await pullCloud(id);
  const localHas = local.done.length || local.skip.length || Object.keys(local.filters).length;
  if (!cloud) { if (localHas) await pushCloud(id, { ...local, updatedAt: local.updatedAt || Date.now() }); return false; }
  const cloudAt = Number(cloud.updatedAt) || 0;
  if (cloudAt > local.updatedAt) { writeLocal(id, { ...cloud, updatedAt: cloudAt }); return true; }   // adopt cloud
  if (local.updatedAt > cloudAt && localHas) { await pushCloud(id, local); }                          // push newer local
  return false;
}

// saved / watchlist (last-write-wins on a single meta doc)
const SAVED_KEY = 'mt:saved', SAVED_AT = 'mt:saved:updatedAt';
async function syncSaved() {
  const local = readArr(SAVED_KEY);
  const localAt = readNum(SAVED_AT);
  let cloud = null;
  try { const s = await getDoc(doc(db, 'users', user.uid, 'meta', 'saved')); cloud = s.exists() ? s.data() : null; } catch (e) {}
  if (!cloud) { if (local.length) { try { await setDoc(doc(db, 'users', user.uid, 'meta', 'saved'), { ids: local, updatedAt: localAt || Date.now() }); } catch (e) {} } return false; }
  const cloudAt = Number(cloud.updatedAt) || 0;
  if (cloudAt > localAt) {
    writeRaw(SAVED_KEY, cloud.ids || []); writeRaw(SAVED_AT, String(cloudAt));
    // core.js memoizes the saved set; drop it so every page (not just the hub's reload hook) re-reads the adopted list
    if (window.MT && typeof window.MT._invalidateSavedCache === 'function') window.MT._invalidateSavedCache();
    return true;
  }
  if (localAt > cloudAt && local.length) { try { await setDoc(doc(db, 'users', user.uid, 'meta', 'saved'), { ids: local, updatedAt: localAt }); } catch (e) {} }
  return false;
}
window.MTSyncSaved = function () {
  if (!user) return;
  clearTimeout(pushTimers.__saved);
  pushTimers.__saved = setTimeout(() => {
    try { setDoc(doc(db, 'users', user.uid, 'meta', 'saved'), { ids: readArr(SAVED_KEY), updatedAt: readNum(SAVED_AT) || Date.now() }); } catch (e) {}
  }, 700);
};

async function syncAll() {
  const [ids, cloudAll] = await Promise.all([franchiseIds(), pullAllCloud()]);
  // Each franchise syncs against its own Firestore doc + its own localStorage keys, so the
  // per-franchise round-trips are independent. Awaiting them one-by-one serialized ~37
  // getDoc calls (plus any pushes) on every sign-in/page load; run them concurrently instead.
  const results = await Promise.all([...ids.map((id) => syncOne(id, cloudAll)), syncSaved()]);
  const changed = results.some(Boolean);
  if (changed && typeof window.MTSyncReload === 'function') window.MTSyncReload();
  renderBox();
}

// called by engine after any local progress change
window.MTSyncPush = function (id) {
  const k = K(id);
  const snap = localSnapshot(id);
  snap.updatedAt = Date.now();
  writeRaw(k.at, String(snap.updatedAt));       // stamp locally so LWW works even signed out
  if (!user) return;
  clearTimeout(pushTimers[id]);
  pushTimers[id] = setTimeout(() => pushCloud(id, snap), 700);   // debounce bursts
};

// ---- auth UI ----
function box() { return document.getElementById('authbox'); }
function renderBox() {
  const el = box(); if (!el) return;
  if (user) {
    const name = user.displayName || user.email || 'Account';
    const photo = user.photoURL ? `<img class="avatar" src="${escapeHtml(user.photoURL)}" alt="" referrerpolicy="no-referrer">` : '<span class="avatar avatar-fallback">👤</span>';
    el.innerHTML = `<span class="authuser" title="Progress syncs to your Google account">${photo}<span class="authname">${escapeHtml(name.split(' ')[0])}</span><span class="synced">· synced</span></span><button class="authbtn ghost" id="signout" type="button">Sign out</button>`;
    el.querySelector('#signout').addEventListener('click', () => signOut(auth));
  } else {
    el.innerHTML = `<button class="authbtn" id="signin" type="button"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.9 2.9 14.7 2 12 2 6.98 2 2.9 6.06 2.9 11.1S6.98 20.2 12 20.2c5.78 0 9.6-4.06 9.6-9.78 0-.66-.07-1.16-.16-1.66H12z"/></svg> Sign in to sync</button>`;
    el.querySelector('#signin').addEventListener('click', doSignIn);
  }
}
async function doSignIn() {
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request')) {
      try { await signInWithRedirect(auth, provider); } catch (_) {}
    } else if (e && e.code === 'auth/unauthorized-domain') {
      alert('This domain isn’t authorized in Firebase Auth yet. Add it under Authentication → Settings → Authorized domains.');
    }
  }
}

onAuthStateChanged(auth, (u) => {
  user = u || null;
  renderBox();
  if (user) syncAll();
});

window.MTAuth = { get user() { return user; }, signIn: doSignIn, signOut: () => signOut(auth) };

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
renderBox();

/*
 * Client-side account layer.
 *
 * Accounts live entirely in this browser's localStorage: passwords are
 * salted and hashed with PBKDF2, but nothing ever leaves the device, so
 * this is demo-grade — swap signUp/signIn/signOut for calls to a real
 * auth backend (Firebase Auth, Supabase, your own API) before shipping.
 * See README.md for the production checklist.
 */
(function () {
  "use strict";

  var USERS_KEY = "espresso-users";
  var SESSION_KEY = "espresso-session";
  var PBKDF2_ITERATIONS = 100000;

  /*
   * OAuth providers. Fill in the client IDs from the Google Cloud
   * Console / Apple Developer portal to enable the buttons; the
   * redirect flow itself must be completed by your backend.
   */
  var OAUTH_PROVIDERS = {
    google: { label: "Google", clientId: "" },
    apple: { label: "Apple", clientId: "" }
  };

  /* ---------- storage helpers ---------- */
  function loadUsers() {
    try {
      var parsed = JSON.parse(localStorage.getItem(USERS_KEY));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch (e) {
      return null;
    }
  }

  function saveSession(session) {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  /* ---------- password hashing ---------- */
  function toBase64(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function fromBase64(b64) {
    var s = atob(b64);
    var bytes = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
  }

  function deriveHash(password, saltBytes) {
    return crypto.subtle
      .importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"])
      .then(function (key) {
        return crypto.subtle.deriveBits(
          { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
          key,
          256
        );
      })
      .then(function (bits) {
        return toBase64(new Uint8Array(bits));
      });
  }

  /* ---------- auth API ---------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function currentUser() {
    var session = loadSession();
    if (!session) return null;
    if (session.guest) return { guest: true };
    if (session.email) return { email: session.email };
    return null;
  }

  function signUp(email, password) {
    email = email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return Promise.reject(new Error("Enter a valid email address."));
    }
    if (password.length < 8) {
      return Promise.reject(new Error("Password must be at least 8 characters."));
    }
    var users = loadUsers();
    if (users[email]) {
      return Promise.reject(new Error("An account with that email already exists."));
    }
    var salt = crypto.getRandomValues(new Uint8Array(16));
    return deriveHash(password, salt).then(function (hash) {
      users[email] = { salt: toBase64(salt), hash: hash, createdAt: new Date().toISOString() };
      saveUsers(users);
      saveSession({ email: email });
      emitChange();
    });
  }

  function signIn(email, password) {
    email = email.trim().toLowerCase();
    var record = loadUsers()[email];
    if (!record) {
      return Promise.reject(new Error("No account found with that email."));
    }
    return deriveHash(password, fromBase64(record.salt)).then(function (hash) {
      if (hash !== record.hash) {
        throw new Error("Incorrect password.");
      }
      saveSession({ email: email });
      emitChange();
    });
  }

  function signInAsGuest() {
    saveSession({ guest: true });
    emitChange();
  }

  function signOut() {
    saveSession(null);
    emitChange();
  }

  function oauthSignIn(provider) {
    var cfg = OAUTH_PROVIDERS[provider];
    if (!cfg) return Promise.reject(new Error("Unknown provider."));
    if (!cfg.clientId) {
      return Promise.reject(new Error(
        cfg.label + " sign-in isn't configured yet. Add your " + cfg.label +
        " client ID in auth.js and connect it to your auth backend — see README.md."
      ));
    }
    // With a client ID configured, redirect to the provider's authorization
    // endpoint here; the callback must be handled by your auth backend.
    return Promise.reject(new Error(cfg.label + " sign-in requires an auth backend. See README.md."));
  }

  function emitChange() {
    document.dispatchEvent(new CustomEvent("authchange", { detail: currentUser() }));
  }

  window.Auth = {
    currentUser: currentUser,
    signUp: signUp,
    signIn: signIn,
    signInAsGuest: signInAsGuest,
    signOut: signOut,
    oauthSignIn: oauthSignIn
  };

  /* ---------- UI wiring ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    var authView = document.getElementById("authView");
    var appView = document.getElementById("appView");
    var tabSignIn = document.getElementById("tabSignIn");
    var tabSignUp = document.getElementById("tabSignUp");
    var authForm = document.getElementById("authForm");
    var authEmail = document.getElementById("authEmail");
    var authPassword = document.getElementById("authPassword");
    var confirmField = document.getElementById("confirmField");
    var authConfirm = document.getElementById("authConfirm");
    var authSubmit = document.getElementById("authSubmit");
    var authError = document.getElementById("authError");
    var userEmailEl = document.getElementById("userEmail");
    var signOutBtn = document.getElementById("signOutBtn");
    var guestLink = document.getElementById("guestLink");

    var mode = "signin"; // or "signup"

    function setMode(next) {
      mode = next;
      var signup = mode === "signup";
      tabSignIn.classList.toggle("active", !signup);
      tabSignUp.classList.toggle("active", signup);
      confirmField.hidden = !signup;
      authConfirm.required = signup;
      authSubmit.textContent = signup ? "Create Account" : "Sign In";
      authError.textContent = "";
    }

    tabSignIn.addEventListener("click", function () { setMode("signin"); });
    tabSignUp.addEventListener("click", function () { setMode("signup"); });

    function render() {
      var user = currentUser();
      authView.hidden = !!user;
      appView.hidden = !user;
      if (user) {
        userEmailEl.textContent = user.guest ? "Guest" : user.email;
      } else {
        authForm.reset();
        setMode("signin");
      }
    }

    authForm.addEventListener("submit", function (e) {
      e.preventDefault();
      authError.textContent = "";
      var email = authEmail.value;
      var password = authPassword.value;

      var action;
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
        .catch(function (err) {
          authError.textContent = err.message;
        })
        .then(function () {
          authSubmit.disabled = false;
        });
    });

    authView.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-oauth]");
      if (!btn) return;
      authError.textContent = "";
      oauthSignIn(btn.getAttribute("data-oauth")).catch(function (err) {
        authError.textContent = err.message;
      });
    });

    guestLink.addEventListener("click", function (e) {
      e.preventDefault();
      signInAsGuest();
    });

    signOutBtn.addEventListener("click", signOut);

    document.addEventListener("authchange", render);
    render();
  });
})();

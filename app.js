(function () {
  "use strict";

  // Storage lives in store.js (window.ShotStore): Firestore for
  // signed-in users, localStorage for guests.

  // Set text and replay the fade-in animation (used for inline errors).
  window.uiFlash = function (el, text) {
    el.textContent = text;
    el.classList.remove("flash");
    if (!text) return;
    void el.offsetWidth; // reflow so the animation restarts
    el.classList.add("flash");
  };

  /* ---------- Timer ---------- */
  var timerDisplay = document.getElementById("timerDisplay");
  var timerRing = document.getElementById("timerRing");
  var timerBtn = document.getElementById("timerBtn");
  var timerReset = document.getElementById("timerReset");
  var shotTimeInput = document.getElementById("shotTime");

  var running = false;
  var startedAt = 0;
  var elapsed = 0; // seconds
  var rafId = null;

  function renderTimer(seconds) {
    timerDisplay.innerHTML = seconds.toFixed(1) + "<small>s</small>";
  }

  function tick() {
    elapsed = (performance.now() - startedAt) / 1000;
    renderTimer(elapsed);
    rafId = requestAnimationFrame(tick);
  }

  timerBtn.addEventListener("click", function () {
    if (!running) {
      running = true;
      startedAt = performance.now() - elapsed * 1000;
      timerBtn.textContent = "Stop";
      timerBtn.classList.remove("btn-primary");
      timerBtn.classList.add("btn-stop");
      timerDisplay.classList.add("running");
      timerRing.classList.add("running");
      rafId = requestAnimationFrame(tick);
    } else {
      running = false;
      cancelAnimationFrame(rafId);
      elapsed = (performance.now() - startedAt) / 1000;
      renderTimer(elapsed);
      timerBtn.textContent = "Start";
      timerBtn.classList.remove("btn-stop");
      timerBtn.classList.add("btn-primary");
      timerDisplay.classList.remove("running");
      timerRing.classList.remove("running");
      shotTimeInput.value = elapsed.toFixed(1);
    }
  });

  timerReset.addEventListener("click", function () {
    running = false;
    cancelAnimationFrame(rafId);
    elapsed = 0;
    renderTimer(0);
    timerBtn.textContent = "Start";
    timerBtn.classList.remove("btn-stop");
    timerBtn.classList.add("btn-primary");
    timerDisplay.classList.remove("running");
    timerRing.classList.remove("running");
  });

  /* ---------- Ratio preview ---------- */
  var doseIn = document.getElementById("doseIn");
  var doseOut = document.getElementById("doseOut");
  var ratioNote = document.getElementById("ratioNote");

  function ratioText(inG, outG) {
    if (inG > 0 && outG > 0) {
      return "1:" + (outG / inG).toFixed(1);
    }
    return null;
  }

  var ratioShown = false;

  function updateRatio() {
    var r = ratioText(parseFloat(doseIn.value), parseFloat(doseOut.value));
    if (!r) {
      ratioNote.innerHTML = "";
      ratioShown = false;
    } else if (!ratioShown) {
      // Rebuild only when the note first appears so the fade-in plays
      // once, not on every keystroke.
      ratioNote.innerHTML = '<span class="flash">Brew ratio: <strong>' + r + "</strong></span>";
      ratioShown = true;
    } else {
      ratioNote.querySelector("strong").textContent = r;
    }
  }
  doseIn.addEventListener("input", updateRatio);
  doseOut.addEventListener("input", updateRatio);

  /* ---------- History rendering ---------- */
  var historyList = document.getElementById("historyList");
  var clearAllBtn = document.getElementById("clearAll");

  function esc(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  var renderToken = 0;

  function renderHistory() {
    if (!window.ShotStore) return; // store.js not loaded yet; it re-renders via authchange
    var token = ++renderToken;
    window.ShotStore.list().then(function (shots) {
      if (token !== renderToken) return; // a newer render superseded this one
      renderShots(shots);
    }).catch(function () {
      if (token !== renderToken) return;
      historyList.innerHTML = '<div class="empty">Couldn’t load your shots. Check your connection and reload.</div>';
    });
  }

  function renderShots(shots) {
    clearAllBtn.hidden = shots.length === 0;

    if (shots.length === 0) {
      historyList.innerHTML = '<div class="empty">No shots recorded yet. Pull one!</div>';
      return;
    }

    historyList.innerHTML = shots.map(function (shot, i) {
      var title = [shot.company, shot.beans].filter(Boolean).join(" — ") || "Unnamed shot";
      var metaParts = [];
      if (shot.grind) metaParts.push("Grind " + esc(shot.grind));
      if (shot.doseIn) metaParts.push(esc(String(shot.doseIn)) + "g in");
      if (shot.doseOut) metaParts.push(esc(String(shot.doseOut)) + "g out");
      var r = ratioText(shot.doseIn, shot.doseOut);
      var when = new Date(shot.date);

      return '<div class="shot" style="animation-delay:' + (i * 45) + 'ms">' +
        '<div class="shot-info">' +
          '<div class="shot-title">' + esc(title) + '</div>' +
          '<div class="shot-meta">' + metaParts.join(" · ") + '</div>' +
          (shot.comments ? '<div class="shot-comments">' + esc(shot.comments) + '</div>' : '') +
          '<div class="shot-date">' + when.toLocaleString() + '</div>' +
        '</div>' +
        '<div class="shot-stats">' +
          (shot.time != null ? '<div class="shot-time">' + esc(String(shot.time)) + 's</div>' : '') +
          (r ? '<div class="shot-ratio">' + r + '</div>' : '') +
          '<button class="shot-delete" data-id="' + shot.id + '" title="Delete shot" aria-label="Delete shot">✕</button>' +
        '</div>' +
      '</div>';
    }).join("");
  }

  historyList.addEventListener("click", function (e) {
    var btn = e.target.closest(".shot-delete");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    // Animate the row out (fade, slide right, collapse) before removing.
    var row = btn.closest(".shot");
    row.classList.add("removing");
    setTimeout(function () {
      window.ShotStore.remove(id).then(renderHistory);
    }, 320);
  });

  clearAllBtn.addEventListener("click", function () {
    if (confirm("Delete all recorded shots?")) {
      window.ShotStore.clear().then(renderHistory);
    }
  });

  /* ---------- Form ---------- */
  var form = document.getElementById("shotForm");
  var formError = document.getElementById("formError");
  var saveBtn = document.getElementById("saveShotBtn");
  var savedTimer = null;

  function showSaved() {
    saveBtn.classList.add("saved");
    saveBtn.textContent = "Saved ✓";
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () {
      saveBtn.classList.remove("saved");
      saveBtn.textContent = "Save Shot";
    }, 1400);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    formError.textContent = "";

    var company = document.getElementById("company").value.trim();
    var beans = document.getElementById("beans").value.trim();
    var grind = document.getElementById("grind").value.trim();
    var comments = document.getElementById("comments").value.trim();
    var inVal = parseFloat(doseIn.value);
    var outVal = parseFloat(doseOut.value);
    var timeVal = parseFloat(shotTimeInput.value);

    var hasAnything = company || beans || grind || comments ||
      !isNaN(inVal) || !isNaN(outVal) || !isNaN(timeVal);
    if (!hasAnything) {
      window.uiFlash(formError, "Add at least one detail before saving.");
      return;
    }

    window.ShotStore.add({
      id: Date.now(),
      company: company,
      beans: beans,
      grind: grind,
      comments: comments,
      doseIn: isNaN(inVal) ? null : inVal,
      doseOut: isNaN(outVal) ? null : outVal,
      time: isNaN(timeVal) ? null : timeVal,
      date: new Date().toISOString()
    }).then(function () {
      renderHistory();
      form.reset();
      updateRatio();
      timerReset.click();
      showSaved();
    }).catch(function () {
      window.uiFlash(formError, "Couldn’t save the shot. Check your connection and try again.");
    });
  });

  document.addEventListener("authchange", renderHistory);
  document.addEventListener("shotschange", renderHistory);

  renderHistory();
})();

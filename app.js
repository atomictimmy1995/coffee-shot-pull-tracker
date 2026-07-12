(function () {
  "use strict";

  var STORAGE_KEY = "espresso-shots";

  // Each account gets its own shot history; guests use the original
  // (pre-accounts) key so existing local data stays visible.
  function storageKey() {
    var user = window.Auth && window.Auth.currentUser();
    return user && user.email ? STORAGE_KEY + ":" + user.email : STORAGE_KEY;
  }

  /* ---------- Timer ---------- */
  var timerDisplay = document.getElementById("timerDisplay");
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

  function updateRatio() {
    var r = ratioText(parseFloat(doseIn.value), parseFloat(doseOut.value));
    ratioNote.innerHTML = r ? "Brew ratio: <strong>" + r + "</strong>" : "";
  }
  doseIn.addEventListener("input", updateRatio);
  doseOut.addEventListener("input", updateRatio);

  /* ---------- Storage ---------- */
  function loadShots() {
    try {
      var raw = localStorage.getItem(storageKey());
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveShots(shots) {
    localStorage.setItem(storageKey(), JSON.stringify(shots));
  }

  /* ---------- History rendering ---------- */
  var historyList = document.getElementById("historyList");
  var clearAllBtn = document.getElementById("clearAll");

  function esc(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function renderHistory() {
    var shots = loadShots();
    clearAllBtn.hidden = shots.length === 0;

    if (shots.length === 0) {
      historyList.innerHTML = '<div class="empty">No shots recorded yet. Pull one!</div>';
      return;
    }

    historyList.innerHTML = shots.map(function (shot) {
      var title = [shot.company, shot.beans].filter(Boolean).join(" — ") || "Unnamed shot";
      var metaParts = [];
      if (shot.grind) metaParts.push("Grind " + esc(shot.grind));
      if (shot.doseIn) metaParts.push(esc(String(shot.doseIn)) + "g in");
      if (shot.doseOut) metaParts.push(esc(String(shot.doseOut)) + "g out");
      var r = ratioText(shot.doseIn, shot.doseOut);
      var when = new Date(shot.date);

      return '<div class="shot">' +
        '<div class="shot-info">' +
          '<div class="shot-title">' + esc(title) + '</div>' +
          '<div class="shot-meta">' + metaParts.join(" · ") + '</div>' +
          (shot.comments ? '<div class="shot-comments">' + esc(shot.comments) + '</div>' : '') +
          '<div class="shot-date">' + when.toLocaleString() + '</div>' +
        '</div>' +
        '<div class="shot-stats">' +
          (shot.time != null ? '<div class="shot-time">' + esc(String(shot.time)) + 's</div>' : '') +
          (r ? '<div class="shot-ratio">' + r + '</div>' : '') +
        '</div>' +
        '<button class="shot-delete" data-id="' + shot.id + '" title="Delete shot" aria-label="Delete shot">✕</button>' +
      '</div>';
    }).join("");
  }

  historyList.addEventListener("click", function (e) {
    var btn = e.target.closest(".shot-delete");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    saveShots(loadShots().filter(function (s) { return String(s.id) !== id; }));
    renderHistory();
  });

  clearAllBtn.addEventListener("click", function () {
    if (confirm("Delete all recorded shots?")) {
      saveShots([]);
      renderHistory();
    }
  });

  /* ---------- Form ---------- */
  var form = document.getElementById("shotForm");
  var formError = document.getElementById("formError");

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
      formError.textContent = "Add at least one detail before saving.";
      return;
    }

    var shots = loadShots();
    shots.unshift({
      id: Date.now(),
      company: company,
      beans: beans,
      grind: grind,
      comments: comments,
      doseIn: isNaN(inVal) ? null : inVal,
      doseOut: isNaN(outVal) ? null : outVal,
      time: isNaN(timeVal) ? null : timeVal,
      date: new Date().toISOString()
    });
    saveShots(shots);
    renderHistory();

    form.reset();
    updateRatio();
    timerReset.click();
  });

  document.addEventListener("authchange", renderHistory);

  renderHistory();
})();

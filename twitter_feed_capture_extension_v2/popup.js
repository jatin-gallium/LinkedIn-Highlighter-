const els = {
  statusPill: document.getElementById("statusPill"),
  statusValue: document.getElementById("statusValue"),
  classifier: document.getElementById("classifierSelect"),
  speed: document.getElementById("speedSelect"),
  profileDeepScan: document.getElementById("profileDeepScan"),
  start: document.getElementById("startBtn"),
  pause: document.getElementById("pauseBtn"),
  resume: document.getElementById("resumeBtn"),
  stop: document.getElementById("stopBtn"),
  exportMd: document.getElementById("exportMdBtn"),
  exportJson: document.getElementById("exportJsonBtn"),
  countValue: document.getElementById("countValue"),
  tagChecks: () => Array.from(document.querySelectorAll(".tag-check"))
};

function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
  });
}

function sendToTab(tabId, payload) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, error: err.message });
        return;
      }
      resolve(response || { ok: false, error: "No response from content script." });
    });
  });
}

async function command(action, extras = {}) {
  const tab = await queryActiveTab();
  if (!tab?.id) {
    return { ok: false, error: "No active tab" };
  }
  return sendToTab(tab.id, {
    type: "TFC_V2_COMMAND",
    command: {
      action,
      ...extras
    }
  });
}

async function getState() {
  const tab = await queryActiveTab();
  if (!tab?.id) {
    return { ok: false, error: "No active tab" };
  }
  return sendToTab(tab.id, { type: "TFC_V2_GET_STATE" });
}

function selectedTags() {
  return els
    .tagChecks()
    .filter((input) => input.checked)
    .map((input) => input.value);
}

function setStatusPill(text, className) {
  els.statusPill.textContent = text;
  els.statusPill.className = `tfc-pill ${className}`;
}

async function applyControls() {
  await command("set-mode", { mode: els.speed.value });
  await command("set-classifier", { classifier: els.classifier.value });
  await command("set-profile-deep-scan", { value: els.profileDeepScan.checked });
  await command("set-tags", { includeTags: selectedTags(), excludeTags: [] });
}

async function exportMarkdown() {
  const res = await command("export-markdown");
  if (!res?.ok || !res.markdown) {
    setStatusPill("Export failed", "tfc-pill-error");
    return;
  }
  const blob = new Blob([res.markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `twitter-capture-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportJson() {
  const res = await command("export-json");
  if (!res?.ok || !res.payload) {
    setStatusPill("Export failed", "tfc-pill-error");
    return;
  }
  const blob = new Blob([JSON.stringify(res.payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `twitter-capture-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function refreshState() {
  const res = await getState();
  if (!res?.ok || !res.state) {
    setStatusPill("Open on X/Twitter", "tfc-pill-error");
    els.statusValue.textContent = "Not connected";
    return;
  }
  const s = res.state;
  const statusText = s.statusMessage || (s.running && !s.paused ? "Running" : "Paused");
  const stateClass = s.running && !s.paused ? "tfc-pill-running" : s.running ? "tfc-pill-paused" : "tfc-pill-idle";
  setStatusPill(statusText, stateClass);
  els.statusValue.textContent = `${statusText} | ${s.mode} | ${s.activeClassifier}`;
  els.countValue.textContent = String(s.capturedCount || 0);
  els.classifier.value = s.activeClassifier || els.classifier.value;
  els.speed.value = s.mode || els.speed.value;
  els.profileDeepScan.checked = Boolean(s.profileDeepScan);
}

function bindEvents() {
  els.start.addEventListener("click", async () => {
    await applyControls();
    await command("start");
    refreshState();
  });
  els.pause.addEventListener("click", async () => {
    await command("pause");
    refreshState();
  });
  els.resume.addEventListener("click", async () => {
    await command("resume");
    refreshState();
  });
  els.stop.addEventListener("click", async () => {
    await command("stop");
    refreshState();
  });
  els.exportMd.addEventListener("click", exportMarkdown);
  els.exportJson.addEventListener("click", exportJson);
  els.classifier.addEventListener("change", applyControls);
  els.speed.addEventListener("change", applyControls);
  els.profileDeepScan.addEventListener("change", applyControls);
  els.tagChecks().forEach((input) => {
    input.addEventListener("change", applyControls);
  });
}

function init() {
  bindEvents();
  refreshState();
  setInterval(refreshState, 1500);
}

init();

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function isTwitterUrl(url = "") {
  return url.includes("x.com") || url.includes("twitter.com");
}

async function sendToActiveTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) return { ok: false, error: "No active tab" };
  return chrome.tabs.sendMessage(tab.id, message);
}

async function refreshStatus() {
  const statusNode = document.getElementById("status");
  const countNode = document.getElementById("count");

  const stateRes = await chrome.runtime.sendMessage({ type: "get_state" });
  const postsRes = await chrome.runtime.sendMessage({ type: "get_posts" });

  const running = stateRes?.state?.running;
  const duration = stateRes?.state?.durationMinutes || 0;
  statusNode.textContent = running ? `Status: running (${duration} min)` : "Status: idle";
  countNode.textContent = `Captured posts: ${(postsRes?.posts || []).length}`;
}

async function startCapture() {
  const durationInput = document.getElementById("duration");
  const duration = Number(durationInput.value || 60);

  const tab = await getActiveTab();
  if (!tab?.url || !isTwitterUrl(tab.url)) {
    alert("Open x.com or twitter.com in the active tab first.");
    return;
  }

  await chrome.runtime.sendMessage({ type: "start_capture", durationMinutes: duration });
  await sendToActiveTab({ type: "run_start_on_tab" });
  await refreshStatus();
}

async function stopCapture() {
  await chrome.runtime.sendMessage({ type: "stop_capture" });
  await sendToActiveTab({ type: "run_stop_on_tab" });
  await refreshStatus();
}

function downloadJson(filename, content) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url,
    filename,
    saveAs: true,
  });
}

async function exportPosts() {
  const response = await chrome.runtime.sendMessage({ type: "get_posts" });
  const posts = response?.posts || [];
  const payload = JSON.stringify(posts, null, 2);
  downloadJson("captured_posts.json", payload);
  await refreshStatus();
}

document.getElementById("startBtn").addEventListener("click", startCapture);
document.getElementById("stopBtn").addEventListener("click", stopCapture);
document.getElementById("refreshBtn").addEventListener("click", refreshStatus);
document.getElementById("exportBtn").addEventListener("click", exportPosts);

document.addEventListener("DOMContentLoaded", refreshStatus);

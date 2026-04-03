let intervalHandle = null;
let heartbeatHandle = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseMetricNumber(value) {
  if (!value) return 0;
  const normalized = value.trim().toUpperCase();
  if (normalized.endsWith("K")) return Math.round(parseFloat(normalized) * 1000);
  if (normalized.endsWith("M")) return Math.round(parseFloat(normalized) * 1000000);
  const digits = normalized.replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function extractFromTweetCard(card) {
  const link = card.querySelector('a[href*="/status/"]');
  const textNode = card.querySelector('[data-testid="tweetText"]');

  if (!link || !textNode) return null;

  const url = new URL(link.getAttribute("href"), window.location.origin).toString();
  const parts = url.split("/");
  const statusIndex = parts.findIndex((p) => p === "status");
  const tweetId = statusIndex > -1 ? parts[statusIndex + 1] : "";

  const authorAnchor = card.querySelector('a[role="link"][href^="/"]');
  const author = authorAnchor ? authorAnchor.getAttribute("href")?.replace("/", "") : "unknown";

  const metricNodes = card.querySelectorAll('[role="group"] [dir="ltr"]');
  const metrics = Array.from(metricNodes).map((node) => parseMetricNumber(node.textContent || ""));

  return {
    tweet_id: tweetId || url,
    text: textNode.textContent?.trim() || "",
    author,
    url,
    timestamp: new Date().toISOString(),
    replies: metrics[0] || 0,
    reposts: metrics[1] || 0,
    likes: metrics[2] || 0,
  };
}

function collectVisibleTweets() {
  const cards = document.querySelectorAll('article[data-testid="tweet"]');
  const posts = [];
  cards.forEach((card) => {
    const parsed = extractFromTweetCard(card);
    if (parsed && parsed.text && parsed.url) posts.push(parsed);
  });
  return posts;
}

async function pushBatch() {
  const posts = collectVisibleTweets();
  if (posts.length > 0) {
    await chrome.runtime.sendMessage({ type: "push_posts", posts });
  }
}

async function runLoop() {
  await pushBatch();
  window.scrollBy({ top: randomBetween(700, 1300), behavior: "smooth" });
}

async function startCapture() {
  if (intervalHandle) return;

  intervalHandle = setInterval(async () => {
    try {
      await runLoop();
    } catch (err) {
      console.warn("Capture loop error", err);
    }
  }, randomBetween(6000, 10000));

  heartbeatHandle = setInterval(async () => {
    const response = await chrome.runtime.sendMessage({ type: "get_state" });
    const state = response?.state;
    if (!state?.running) {
      stopCapture();
      return;
    }

    if (state.startedAt && state.durationMinutes > 0) {
      const started = new Date(state.startedAt).getTime();
      const limit = started + state.durationMinutes * 60 * 1000;
      if (Date.now() >= limit) {
        await chrome.runtime.sendMessage({ type: "stop_capture" });
        stopCapture();
      }
    }
  }, 5000);
}

function stopCapture() {
  if (intervalHandle) clearInterval(intervalHandle);
  if (heartbeatHandle) clearInterval(heartbeatHandle);
  intervalHandle = null;
  heartbeatHandle = null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === "run_start_on_tab") {
      await delay(700);
      await startCapture();
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "run_stop_on_tab") {
      stopCapture();
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "unknown command" });
  })();

  return true;
});

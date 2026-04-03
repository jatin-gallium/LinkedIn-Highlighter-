const STATE_KEY = "captureState";
const POSTS_KEY = "capturedPosts";

async function getState() {
  const data = await chrome.storage.local.get([STATE_KEY]);
  return data[STATE_KEY] || { running: false, startedAt: null, durationMinutes: 0 };
}

async function setState(state) {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}

async function addPosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return;

  const data = await chrome.storage.local.get([POSTS_KEY]);
  const existing = data[POSTS_KEY] || [];
  const seen = new Set(existing.map((p) => p.tweet_id || p.url));

  for (const post of posts) {
    const key = post.tweet_id || post.url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    existing.push(post);
  }

  await chrome.storage.local.set({ [POSTS_KEY]: existing });
}

async function clearPosts() {
  await chrome.storage.local.set({ [POSTS_KEY]: [] });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "start_capture") {
      await clearPosts();
      const durationMinutes = Number(message.durationMinutes || 60);
      await setState({
        running: true,
        startedAt: new Date().toISOString(),
        durationMinutes,
      });
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "stop_capture") {
      await setState({ running: false, startedAt: null, durationMinutes: 0 });
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "get_state") {
      sendResponse({ ok: true, state: await getState() });
      return;
    }

    if (message?.type === "push_posts") {
      await addPosts(message.posts || []);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "get_posts") {
      const data = await chrome.storage.local.get([POSTS_KEY]);
      sendResponse({ ok: true, posts: data[POSTS_KEY] || [] });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message" });
  })();

  return true;
});

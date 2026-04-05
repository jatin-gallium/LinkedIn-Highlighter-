const DEFAULT_SETTINGS = {
  mode: "software_engineering",
  speedProfile: "safe",
  selectedTags: [
    "software_engineering",
    "general_take",
    "ai_use_case"
  ],
  maxProfileTweets: 1200,
  autoScrollEnabled: true,
  captureEnabled: true
};

chrome.runtime.onInstalled.addListener(async () => {
  const { scannerSettings } = await chrome.storage.local.get("scannerSettings");
  if (!scannerSettings) {
    await chrome.storage.local.set({ scannerSettings: DEFAULT_SETTINGS });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === "getDefaultSettings") {
    sendResponse({ ok: true, settings: DEFAULT_SETTINGS });
    return false;
  }
  return false;
});

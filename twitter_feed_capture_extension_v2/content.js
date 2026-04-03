/* eslint-disable no-console */
(() => {
  if (window.__TFC_V2_LOADED__) {
    return;
  }
  window.__TFC_V2_LOADED__ = true;

  const VERSION = "2.0.0";
  const STORAGE_KEY = "tfcV2State";
  const MAX_STORE_SIZE = 1600;
  const MAX_QUEUE_SIZE = 300;
  const VISIBLE_RENDER_LIMIT = 220;
  const CAPTURE_SELECTOR = "article[data-testid='tweet'], article";

  const MODE_PRESETS = {
    safe: {
      label: "Safe",
      scrollPx: 640,
      minDelayMs: 1300,
      maxDelayMs: 2000,
      burstSize: 1,
      cooldownAfterBursts: 9,
      cooldownMs: 4200
    },
    balanced: {
      label: "Balanced",
      scrollPx: 920,
      minDelayMs: 800,
      maxDelayMs: 1300,
      burstSize: 2,
      cooldownAfterBursts: 12,
      cooldownMs: 2400
    },
    fast: {
      label: "Fast",
      scrollPx: 1260,
      minDelayMs: 520,
      maxDelayMs: 980,
      burstSize: 3,
      cooldownAfterBursts: 16,
      cooldownMs: 1800
    }
  };

  const DEFAULT_STATE = {
    running: false,
    paused: true,
    profileDeepScan: false,
    mode: "safe",
    includeTags: [],
    excludeTags: [],
    confidenceThreshold: 40,
    activeClassifier: "software_engineering",
    queueOnlyVisible: true,
    capturedCount: 0,
    duplicateCount: 0,
    scanLoops: 0,
    avgLoopMs: 0,
    queueDepth: 0,
    lastCaptureAt: 0,
    statusMessage: "Paused",
    currentProfile: "",
    markdownExportReady: false
  };

  const state = {
    ...DEFAULT_STATE
  };

  const runtimeMetrics = {
    lastLoopStart: 0,
    loopDurations: [],
    bursts: 0,
    cooldownUntil: 0,
    lastNewCount: 0,
    lastQueueDrainMs: 0
  };

  const postStore = new Map();
  const queue = [];
  const nodeToId = new WeakMap();
  const idToNode = new Map();
  let deepScanCheckpoint = null;
  let pendingStorageWrite = false;
  let scanIntervalHandle = null;
  let renderScheduled = false;
  let observer = null;
  let intersectionObserver = null;
  let sidebar = null;
  let ui = null;

  const TAG_WEIGHTS = {
    software_engineering: [
      ["software engineer", 30],
      ["backend", 24],
      ["frontend", 22],
      ["api", 18],
      ["system design", 26],
      ["microservices", 20],
      ["database", 20],
      ["architecture", 18],
      ["typescript", 20],
      ["javascript", 16],
      ["python", 14],
      ["testing", 14],
      ["debug", 14],
      ["performance", 14],
      ["devops", 15],
      ["kubernetes", 16]
    ],
    meme: [
      ["meme", 28],
      ["lol", 18],
      ["lmao", 18],
      ["haha", 14],
      ["shitpost", 24],
      ["template", 10],
      ["reaction image", 14],
      ["viral joke", 14],
      ["funny", 15]
    ],
    general_take: [
      ["hot take", 24],
      ["my take", 16],
      ["unpopular opinion", 22],
      ["thoughts", 12],
      ["opinion", 14],
      ["i think", 10],
      ["in my view", 12]
    ],
    corporate: [
      ["leadership", 18],
      ["enterprise", 18],
      ["corporate", 22],
      ["stakeholder", 20],
      ["management", 18],
      ["qbr", 12],
      ["okr", 14],
      ["kpi", 14],
      ["b2b", 12]
    ],
    job_hunting: [
      ["hiring", 30],
      ["looking for", 18],
      ["job", 18],
      ["open role", 24],
      ["resume", 16],
      ["interview", 20],
      ["referral", 20],
      ["opentowork", 24]
    ],
    ai_use_case: [
      ["ai use case", 34],
      ["use case", 16],
      ["agent", 14],
      ["llm", 24],
      ["prompt", 12],
      ["genai", 22],
      ["automation", 16],
      ["copilot", 15],
      ["model", 10]
    ],
    startup: [
      ["startup", 22],
      ["founder", 18],
      ["mvp", 20],
      ["product market fit", 24],
      ["seed round", 22],
      ["growth", 16]
    ],
    ai_ml: [
      ["machine learning", 26],
      ["deep learning", 24],
      ["model training", 22],
      ["fine tuning", 20],
      ["neural network", 20],
      ["inference", 16],
      ["rag", 18],
      ["evaluation", 16]
    ],
    career_hiring: [
      ["career", 16],
      ["career growth", 18],
      ["promotion", 14],
      ["job opening", 24],
      ["hiring manager", 20],
      ["resume review", 18]
    ],
    product: [
      ["product", 14],
      ["roadmap", 18],
      ["user feedback", 16],
      ["feature launch", 20],
      ["product strategy", 22],
      ["pmf", 16]
    ],
    news_opinion: [
      ["breaking", 14],
      ["news", 12],
      ["opinion", 14],
      ["analysis", 12],
      ["policy", 10],
      ["thread", 10]
    ],
    tutorial_howto: [
      ["tutorial", 24],
      ["how to", 22],
      ["step by step", 22],
      ["guide", 18],
      ["walkthrough", 18],
      ["example code", 18]
    ],
    showcase_project: [
      ["i built", 24],
      ["side project", 24],
      ["demo", 16],
      ["open source", 20],
      ["github", 16],
      ["ship", 14]
    ],
    low_signal_spam: [
      ["dm me", 28],
      ["100x", 24],
      ["guaranteed", 24],
      ["buy now", 26],
      ["follow for follow", 26],
      ["giveaway", 18]
    ]
  };

  const TAG_LABELS = {
    software_engineering: "Software Engineering",
    meme: "Meme",
    general_take: "General Take",
    corporate: "Corporate",
    job_hunting: "Job Hunting",
    ai_use_case: "AI Use Case",
    startup: "Startup",
    ai_ml: "AI/ML",
    career_hiring: "Career Hiring",
    product: "Product",
    news_opinion: "News/Opinion",
    tutorial_howto: "Tutorial/How-To",
    showcase_project: "Showcase/Project",
    low_signal_spam: "Low Signal/Spam"
  };

  function now() {
    return Date.now();
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function textNorm(s) {
    return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function scheduleStorageWrite() {
    if (pendingStorageWrite) {
      return;
    }
    pendingStorageWrite = true;
    setTimeout(() => {
      pendingStorageWrite = false;
      persistState();
    }, 300);
  }

  function persistState() {
    const serializablePosts = [];
    let count = 0;
    for (const entry of postStore.values()) {
      if (count >= MAX_STORE_SIZE) {
        break;
      }
      serializablePosts.push({
        id: entry.id,
        url: entry.url,
        author: entry.author,
        text: entry.text,
        createdAt: entry.createdAt,
        capturedAt: entry.capturedAt,
        metrics: entry.metrics,
        tags: entry.tags,
        scores: entry.scores,
        activeDecision: entry.activeDecision,
        confidence: entry.confidence,
        reasons: entry.reasons,
        profileHandle: entry.profileHandle
      });
      count += 1;
    }
    chrome.storage.local.set({
      [STORAGE_KEY]: {
        state: {
          running: state.running,
          paused: state.paused,
          profileDeepScan: state.profileDeepScan,
          mode: state.mode,
          includeTags: state.includeTags,
          excludeTags: state.excludeTags,
          confidenceThreshold: state.confidenceThreshold,
          activeClassifier: state.activeClassifier,
          queueOnlyVisible: state.queueOnlyVisible,
          capturedCount: state.capturedCount,
          duplicateCount: state.duplicateCount,
          scanLoops: state.scanLoops,
          avgLoopMs: state.avgLoopMs,
          queueDepth: state.queueDepth,
          lastCaptureAt: state.lastCaptureAt,
          statusMessage: state.statusMessage,
          currentProfile: state.currentProfile,
          markdownExportReady: state.markdownExportReady
        },
        posts: serializablePosts,
        checkpoint: deepScanCheckpoint
      }
    });
  }

  async function loadState() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const saved = result[STORAGE_KEY];
    if (!saved) {
      return;
    }
    Object.assign(state, DEFAULT_STATE, saved.state || {});
    postStore.clear();
    (saved.posts || []).forEach((post) => {
      postStore.set(post.id, post);
    });
    deepScanCheckpoint = saved.checkpoint || null;
    state.capturedCount = postStore.size;
  }

  function safeGetModePreset(mode) {
    return MODE_PRESETS[mode] || MODE_PRESETS.safe;
  }

  function detectProfileHandle() {
    const path = window.location.pathname || "";
    const match = path.match(/^\/([^/]+)/);
    if (!match) {
      return "";
    }
    const handle = match[1].replace(/^@/, "");
    if (!handle || handle.toLowerCase() === "home" || handle.toLowerCase() === "explore") {
      return "";
    }
    return handle;
  }

  function computeDelayMs() {
    const preset = safeGetModePreset(state.mode);
    const queuePenalty = clamp(state.queueDepth / 50, 0, 0.9);
    const newPostBoost = runtimeMetrics.lastNewCount > 0 ? -120 : 160;
    const randomJitter = Math.floor(Math.random() * 90);
    const base = preset.minDelayMs + (preset.maxDelayMs - preset.minDelayMs) * queuePenalty;
    return clamp(base + newPostBoost + randomJitter, preset.minDelayMs, preset.maxDelayMs + 300);
  }

  function parseNumericToken(token) {
    if (!token) {
      return 0;
    }
    const t = token.toLowerCase().replace(/,/g, "").trim();
    const num = parseFloat(t);
    if (Number.isNaN(num)) {
      return 0;
    }
    if (t.endsWith("k")) {
      return Math.round(num * 1000);
    }
    if (t.endsWith("m")) {
      return Math.round(num * 1000000);
    }
    return Math.round(num);
  }

  function extractMetricsFromText(text) {
    const normalized = text || "";
    const metrics = {
      replies: 0,
      reposts: 0,
      likes: 0,
      views: 0
    };
    const patterns = [
      [/(\d[\d,.]*[km]?)\s*(repl(?:y|ies))/i, "replies"],
      [/(\d[\d,.]*[km]?)\s*(repost(?:s)?|retweet(?:s)?)/i, "reposts"],
      [/(\d[\d,.]*[km]?)\s*(like(?:s)?)/i, "likes"],
      [/(\d[\d,.]*[km]?)\s*(view(?:s)?)/i, "views"]
    ];
    for (const [regex, key] of patterns) {
      const m = normalized.match(regex);
      if (m) {
        metrics[key] = parseNumericToken(m[1]);
      }
    }
    return metrics;
  }

  function extractPostIdFromNode(node) {
    if (!node) {
      return null;
    }
    const permalink = node.querySelector("a[href*='/status/']");
    if (permalink) {
      try {
        const url = new URL(permalink.href, window.location.origin);
        const statusMatch = url.pathname.match(/status\/(\d+)/);
        if (statusMatch) {
          return statusMatch[1];
        }
      } catch (_err) {
        // ignore URL parse errors
      }
    }

    const time = node.querySelector("time");
    const author = node.querySelector("[data-testid='User-Name'] span");
    const text = node.querySelector("[data-testid='tweetText']");
    const basis = `${author?.textContent || ""}|${time?.getAttribute("datetime") || ""}|${text?.textContent?.slice(0, 140) || ""}`;
    if (basis.trim()) {
      return `synthetic_${hashString(basis)}`;
    }
    return null;
  }

  function hashString(value) {
    let h = 0;
    for (let i = 0; i < value.length; i += 1) {
      h = (h << 5) - h + value.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }

  function extractPostUrl(node) {
    const permalink = node.querySelector("a[href*='/status/']");
    if (!permalink) {
      return window.location.href;
    }
    try {
      return new URL(permalink.getAttribute("href"), window.location.origin).toString();
    } catch (_err) {
      return permalink.href || window.location.href;
    }
  }

  function extractText(node) {
    const t = node.querySelector("[data-testid='tweetText']");
    if (t && t.textContent) {
      return t.textContent.trim();
    }
    return node.textContent?.trim().slice(0, 600) || "";
  }

  function extractAuthor(node) {
    const a = node.querySelector("[data-testid='User-Name'] span");
    return a?.textContent?.trim() || "Unknown";
  }

  function extractTime(node) {
    const t = node.querySelector("time");
    if (t && t.getAttribute("datetime")) {
      return t.getAttribute("datetime");
    }
    return new Date().toISOString();
  }

  function classifyTags(post) {
    const haystack = textNorm(`${post.author} ${post.text}`);
    const scores = {};
    const reasons = {};

    Object.entries(TAG_WEIGHTS).forEach(([tag, weightedTerms]) => {
      let score = 0;
      const reasonList = [];
      weightedTerms.forEach(([term, weight]) => {
        if (haystack.includes(term)) {
          score += weight;
          reasonList.push(`contains "${term}"`);
        }
      });
      if (tag === "meme" && /😂|🤣|😭|💀/.test(post.text || "")) {
        score += 10;
        reasonList.push("contains meme-style emoji");
      }
      if (tag === "software_engineering" && /code|build|deploy|bug|repo|pr/i.test(post.text || "")) {
        score += 10;
        reasonList.push("contains software workflow terms");
      }
      if (tag === "ai_use_case" && /agent|workflow|automation|tool/i.test(post.text || "")) {
        score += 8;
        reasonList.push("contains practical AI workflow terms");
      }
      scores[tag] = clamp(score, 0, 100);
      reasons[tag] = reasonList;
    });

    const sorted = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .filter((entry) => entry[1] >= 20);
    const tags = sorted.map((entry) => entry[0]);

    const activeScore = scores[state.activeClassifier] || 0;
    let activeDecision = "no";
    if (activeScore >= 60) {
      activeDecision = "yes";
    } else if (activeScore >= 35) {
      activeDecision = "maybe";
    }

    const confidence = sorted.length ? clamp(sorted[0][1], 20, 100) : 15;
    const topTag = sorted[0]?.[0] || state.activeClassifier;
    const topReasons = reasons[topTag] || [];

    return {
      tags,
      scores,
      activeDecision,
      confidence,
      reasons: topReasons.slice(0, 4)
    };
  }

  function shouldIncludePost(post) {
    if (post.confidence < state.confidenceThreshold) {
      return false;
    }
    if (state.includeTags.length > 0) {
      const includeHit = state.includeTags.some((tag) => post.tags.includes(tag));
      if (!includeHit) {
        return false;
      }
    }
    if (state.excludeTags.length > 0) {
      const excludeHit = state.excludeTags.some((tag) => post.tags.includes(tag));
      if (excludeHit) {
        return false;
      }
    }
    return true;
  }

  function recordPostFromNode(node) {
    const id = extractPostIdFromNode(node);
    if (!id) {
      return { added: false, updated: false, id: null };
    }

    const existing = postStore.get(id);
    const text = extractText(node);
    const author = extractAuthor(node);
    const createdAt = extractTime(node);
    const url = extractPostUrl(node);
    const metrics = extractMetricsFromText(node.textContent || "");

    const base = {
      id,
      url,
      author,
      text,
      createdAt,
      capturedAt: now(),
      metrics,
      profileHandle: detectProfileHandle() || state.currentProfile || ""
    };
    const classification = classifyTags(base);
    const merged = {
      ...base,
      ...classification
    };

    if (!existing) {
      postStore.set(id, merged);
      trimStore();
      state.capturedCount = postStore.size;
      state.lastCaptureAt = merged.capturedAt;
      nodeToId.set(node, id);
      idToNode.set(id, node);
      decorateNode(node, merged);
      return { added: true, updated: false, id };
    }

    const contentChanged = existing.text !== merged.text || existing.metrics.likes !== merged.metrics.likes || existing.metrics.reposts !== merged.metrics.reposts || existing.metrics.replies !== merged.metrics.replies;
    if (contentChanged) {
      postStore.set(id, {
        ...existing,
        ...merged
      });
      nodeToId.set(node, id);
      idToNode.set(id, node);
      decorateNode(node, postStore.get(id));
      return { added: false, updated: true, id };
    }

    state.duplicateCount += 1;
    nodeToId.set(node, id);
    idToNode.set(id, node);
    decorateNode(node, existing);
    return { added: false, updated: false, id };
  }

  function trimStore() {
    if (postStore.size <= MAX_STORE_SIZE) {
      return;
    }
    const items = Array.from(postStore.values()).sort((a, b) => a.capturedAt - b.capturedAt);
    const toDrop = items.slice(0, postStore.size - MAX_STORE_SIZE);
    toDrop.forEach((entry) => {
      postStore.delete(entry.id);
      idToNode.delete(entry.id);
    });
    state.capturedCount = postStore.size;
  }

  function decorateNode(node, post) {
    if (!node || !post) {
      return;
    }
    node.classList.add("tfcv2-processed");
    const borderClass = post.activeDecision === "yes" ? "tfcv2-hit" : post.activeDecision === "maybe" ? "tfcv2-maybe" : "tfcv2-low";
    node.classList.remove("tfcv2-hit", "tfcv2-maybe", "tfcv2-low");
    node.classList.add(borderClass);

    let badge = node.querySelector(".tfcv2-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "tfcv2-badge";
      node.style.position = node.style.position || "relative";
      node.appendChild(badge);
    }

    const topTags = post.tags.slice(0, 2).map((tag) => TAG_LABELS[tag] || tag).join(", ") || "Unclassified";
    badge.textContent = `${state.activeClassifier.replace(/_/g, " ")}: ${post.activeDecision.toUpperCase()} (${post.confidence}%) • ${topTags}`;
  }

  function enqueueNode(node) {
    if (!node || queue.length >= MAX_QUEUE_SIZE) {
      return;
    }
    const existingId = nodeToId.get(node);
    if (existingId && postStore.has(existingId)) {
      return;
    }
    queue.push(node);
    state.queueDepth = queue.length;
  }

  function seedQueue() {
    const nodes = document.querySelectorAll(CAPTURE_SELECTOR);
    nodes.forEach((node) => {
      if (state.queueOnlyVisible && intersectionObserver) {
        intersectionObserver.observe(node);
      } else {
        enqueueNode(node);
      }
    });
    state.queueDepth = queue.length;
  }

  function drainQueue(maxItems = 18) {
    const started = performance.now();
    let processed = 0;
    let added = 0;
    while (queue.length > 0 && processed < maxItems) {
      const node = queue.shift();
      if (!node || !node.isConnected) {
        processed += 1;
        continue;
      }
      const outcome = recordPostFromNode(node);
      if (outcome.added) {
        added += 1;
      }
      processed += 1;
    }
    state.queueDepth = queue.length;
    runtimeMetrics.lastNewCount = added;
    runtimeMetrics.lastQueueDrainMs = performance.now() - started;
  }

  function shouldRunScrollStep() {
    if (!state.running || state.paused) {
      return false;
    }
    if (document.hidden) {
      state.statusMessage = "Paused (tab hidden)";
      return false;
    }
    if (runtimeMetrics.cooldownUntil > now()) {
      state.statusMessage = "Cooldown";
      return false;
    }
    return true;
  }

  function doScrollStep() {
    if (!shouldRunScrollStep()) {
      scheduleRender();
      return;
    }
    const preset = safeGetModePreset(state.mode);
    const toBottom = state.profileDeepScan ? 1.0 : 0.8;
    window.scrollBy({
      top: Math.floor(preset.scrollPx * toBottom),
      behavior: "smooth"
    });
    runtimeMetrics.bursts += 1;
    state.scanLoops += 1;
    state.statusMessage = `Running (${preset.label})`;
    if (runtimeMetrics.bursts % preset.cooldownAfterBursts === 0) {
      runtimeMetrics.cooldownUntil = now() + preset.cooldownMs;
      state.statusMessage = "Cooldown";
    }
    if (state.profileDeepScan) {
      maybeUpdateCheckpoint();
    }
    scheduleRender();
  }

  function maybeUpdateCheckpoint() {
    const latest = Array.from(postStore.values()).sort((a, b) => b.capturedAt - a.capturedAt)[0];
    if (!latest) {
      return;
    }
    deepScanCheckpoint = {
      id: latest.id,
      capturedAt: latest.capturedAt,
      profileHandle: latest.profileHandle || detectProfileHandle() || state.currentProfile || ""
    };
    state.currentProfile = deepScanCheckpoint.profileHandle || state.currentProfile;
    scheduleStorageWrite();
  }

  function computeAvgLoop(durationMs) {
    runtimeMetrics.loopDurations.push(durationMs);
    if (runtimeMetrics.loopDurations.length > 120) {
      runtimeMetrics.loopDurations.shift();
    }
    const total = runtimeMetrics.loopDurations.reduce((acc, v) => acc + v, 0);
    state.avgLoopMs = Math.round(total / runtimeMetrics.loopDurations.length);
  }

  function loopTick() {
    runtimeMetrics.lastLoopStart = performance.now();
    drainQueue(state.mode === "fast" ? 28 : state.mode === "balanced" ? 20 : 14);
    doScrollStep();
    const loopDuration = performance.now() - runtimeMetrics.lastLoopStart;
    computeAvgLoop(loopDuration);
    scheduleStorageWrite();
  }

  function clearLoop() {
    if (scanIntervalHandle) {
      clearInterval(scanIntervalHandle);
      scanIntervalHandle = null;
    }
  }

  function startLoop() {
    clearLoop();
    const delay = computeDelayMs();
    scanIntervalHandle = setInterval(() => {
      loopTick();
    }, delay);
  }

  function refreshLoopCadence() {
    if (!state.running) {
      clearLoop();
      return;
    }
    startLoop();
  }

  function setupObservers() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    observer = new MutationObserver((mutations) => {
      let added = 0;
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return;
          }
          if (node.matches?.(CAPTURE_SELECTOR)) {
            added += 1;
            if (state.queueOnlyVisible && intersectionObserver) {
              intersectionObserver.observe(node);
            } else {
              enqueueNode(node);
            }
            return;
          }
          const nested = node.querySelectorAll?.(CAPTURE_SELECTOR);
          if (nested && nested.length) {
            nested.forEach((postNode) => {
              added += 1;
              if (state.queueOnlyVisible && intersectionObserver) {
                intersectionObserver.observe(postNode);
              } else {
                enqueueNode(postNode);
              }
            });
          }
        });
      }
      if (added > 0) {
        state.statusMessage = `Captured ${added} new nodes`;
        scheduleRender();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }
    intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target instanceof HTMLElement) {
          enqueueNode(entry.target);
        }
      });
    }, { root: null, threshold: 0.2 });
  }

  function filteredPostsForUi() {
    const all = Array.from(postStore.values())
      .sort((a, b) => b.capturedAt - a.capturedAt);
    const filtered = all.filter((post) => shouldIncludePost(post));
    return filtered.slice(0, VISIBLE_RENDER_LIMIT);
  }

  function buildMarkdownReport() {
    const posts = Array.from(postStore.values()).filter((post) => shouldIncludePost(post));
    const byTag = {};
    posts.forEach((post) => {
      post.tags.forEach((tag) => {
        byTag[tag] = (byTag[tag] || 0) + 1;
      });
    });
    const sortedTags = Object.entries(byTag).sort((a, b) => b[1] - a[1]);

    const lines = [];
    lines.push(`# Twitter Feed Capture Report v${VERSION}`);
    lines.push("");
    lines.push(`- Generated: ${new Date().toISOString()}`);
    lines.push(`- Mode: ${state.mode}`);
    lines.push(`- Classifier: ${state.activeClassifier}`);
    lines.push(`- Profile Deep Scan: ${state.profileDeepScan ? "On" : "Off"}`);
    lines.push(`- Captured Posts: ${postStore.size}`);
    lines.push(`- Filtered Posts in Report: ${posts.length}`);
    lines.push("");
    lines.push("## Tag Distribution");
    if (!sortedTags.length) {
      lines.push("- No tags found in current filtered set.");
    } else {
      sortedTags.forEach(([tag, count]) => {
        lines.push(`- ${TAG_LABELS[tag] || tag}: ${count}`);
      });
    }
    lines.push("");
    lines.push("## Posts");
    posts.slice(0, 500).forEach((post, idx) => {
      lines.push("");
      lines.push(`### ${idx + 1}. ${post.author} — ${post.activeDecision.toUpperCase()} (${post.confidence}%)`);
      lines.push(`- URL: ${post.url}`);
      lines.push(`- Captured: ${new Date(post.capturedAt).toISOString()}`);
      lines.push(`- Tags: ${post.tags.map((tag) => TAG_LABELS[tag] || tag).join(", ") || "None"}`);
      lines.push(`- Metrics: Likes ${post.metrics.likes}, Reposts ${post.metrics.reposts}, Replies ${post.metrics.replies}, Views ${post.metrics.views}`);
      if (post.reasons && post.reasons.length) {
        lines.push(`- Reasons: ${post.reasons.join("; ")}`);
      }
      lines.push("");
      lines.push(post.text || "_No text extracted_");
    });
    return lines.join("\n");
  }

  function downloadFile(filename, content, type = "text/plain") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function buildUi() {
    sidebar = document.createElement("aside");
    sidebar.id = "tfcv2-sidebar";
    sidebar.innerHTML = `
      <div class="tfcv2-header">
        <div>
          <h2>Scanner v2</h2>
          <p>Fast tag-based relevance scanning</p>
        </div>
        <button id="tfcv2-close" aria-label="Close">×</button>
      </div>
      <div class="tfcv2-status-row">
        <span class="tfcv2-pill" id="tfcv2-status-pill">Paused</span>
        <span class="tfcv2-pill tfcv2-soft" id="tfcv2-mode-pill">Safe</span>
        <span class="tfcv2-pill tfcv2-soft" id="tfcv2-count-pill">0 posts</span>
      </div>
      <div class="tfcv2-controls">
        <button id="tfcv2-start">Start</button>
        <button id="tfcv2-pause">Pause</button>
        <button id="tfcv2-stop">Stop</button>
      </div>
      <div class="tfcv2-grid">
        <label>Speed Mode
          <select id="tfcv2-mode">
            <option value="safe">Safe</option>
            <option value="balanced">Balanced</option>
            <option value="fast">Fast</option>
          </select>
        </label>
        <label>Classifier
          <select id="tfcv2-classifier"></select>
        </label>
      </div>
      <div class="tfcv2-grid">
        <label>Include tags (comma)
          <input id="tfcv2-include" placeholder="software_engineering,ai_use_case" />
        </label>
        <label>Exclude tags (comma)
          <input id="tfcv2-exclude" placeholder="meme,general_take" />
        </label>
      </div>
      <div class="tfcv2-grid">
        <label>Confidence ≥ <span id="tfcv2-conf-val">40</span>
          <input id="tfcv2-confidence" type="range" min="0" max="100" value="40" />
        </label>
        <label class="tfcv2-checkline">
          <input id="tfcv2-deep-scan" type="checkbox" />
          Profile Deep Scan
        </label>
      </div>
      <div class="tfcv2-export">
        <button id="tfcv2-export-md">Export Markdown</button>
        <button id="tfcv2-export-json">Export JSON</button>
      </div>
      <div class="tfcv2-metrics" id="tfcv2-metrics"></div>
      <div class="tfcv2-list" id="tfcv2-list"></div>
    `;
    document.body.appendChild(sidebar);

    const toggle = document.createElement("button");
    toggle.id = "tfcv2-toggle";
    toggle.textContent = "Scanner";
    document.body.appendChild(toggle);

    ui = {
      toggle,
      close: sidebar.querySelector("#tfcv2-close"),
      start: sidebar.querySelector("#tfcv2-start"),
      pause: sidebar.querySelector("#tfcv2-pause"),
      stop: sidebar.querySelector("#tfcv2-stop"),
      mode: sidebar.querySelector("#tfcv2-mode"),
      classifier: sidebar.querySelector("#tfcv2-classifier"),
      include: sidebar.querySelector("#tfcv2-include"),
      exclude: sidebar.querySelector("#tfcv2-exclude"),
      confidence: sidebar.querySelector("#tfcv2-confidence"),
      confidenceVal: sidebar.querySelector("#tfcv2-conf-val"),
      deepScan: sidebar.querySelector("#tfcv2-deep-scan"),
      exportMd: sidebar.querySelector("#tfcv2-export-md"),
      exportJson: sidebar.querySelector("#tfcv2-export-json"),
      statusPill: sidebar.querySelector("#tfcv2-status-pill"),
      modePill: sidebar.querySelector("#tfcv2-mode-pill"),
      countPill: sidebar.querySelector("#tfcv2-count-pill"),
      metrics: sidebar.querySelector("#tfcv2-metrics"),
      list: sidebar.querySelector("#tfcv2-list")
    };

    Object.entries(TAG_LABELS).forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      ui.classifier.appendChild(option);
    });

    ui.toggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      scheduleRender();
    });
    ui.close.addEventListener("click", () => {
      sidebar.classList.remove("open");
    });
    ui.start.addEventListener("click", () => {
      state.running = true;
      state.paused = false;
      state.statusMessage = "Running";
      refreshLoopCadence();
      scheduleStorageWrite();
      scheduleRender();
    });
    ui.pause.addEventListener("click", () => {
      state.paused = !state.paused;
      state.statusMessage = state.paused ? "Paused" : "Running";
      refreshLoopCadence();
      scheduleStorageWrite();
      scheduleRender();
    });
    ui.stop.addEventListener("click", () => {
      state.running = false;
      state.paused = true;
      state.statusMessage = "Stopped";
      clearLoop();
      scheduleStorageWrite();
      scheduleRender();
    });
    ui.mode.addEventListener("change", () => {
      state.mode = ui.mode.value;
      refreshLoopCadence();
      scheduleStorageWrite();
      scheduleRender();
    });
    ui.classifier.addEventListener("change", () => {
      state.activeClassifier = ui.classifier.value;
      reclassifyAllPosts();
      scheduleStorageWrite();
      scheduleRender();
    });
    ui.include.addEventListener("change", () => {
      state.includeTags = parseTagInput(ui.include.value);
      scheduleStorageWrite();
      scheduleRender();
    });
    ui.exclude.addEventListener("change", () => {
      state.excludeTags = parseTagInput(ui.exclude.value);
      scheduleStorageWrite();
      scheduleRender();
    });
    ui.confidence.addEventListener("input", () => {
      state.confidenceThreshold = Number(ui.confidence.value);
      ui.confidenceVal.textContent = String(state.confidenceThreshold);
      scheduleRender();
    });
    ui.confidence.addEventListener("change", () => {
      scheduleStorageWrite();
    });
    ui.deepScan.addEventListener("change", () => {
      state.profileDeepScan = ui.deepScan.checked;
      if (state.profileDeepScan) {
        state.currentProfile = detectProfileHandle();
      }
      scheduleStorageWrite();
      scheduleRender();
    });
    ui.exportMd.addEventListener("click", () => {
      const markdown = buildMarkdownReport();
      const profilePart = state.currentProfile ? `-${state.currentProfile}` : "";
      const datePart = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      downloadFile(`twitter-capture${profilePart}-${datePart}.md`, markdown, "text/markdown");
    });
    ui.exportJson.addEventListener("click", () => {
      const payload = {
        generatedAt: new Date().toISOString(),
        mode: state.mode,
        classifier: state.activeClassifier,
        profileDeepScan: state.profileDeepScan,
        posts: Array.from(postStore.values())
      };
      const profilePart = state.currentProfile ? `-${state.currentProfile}` : "";
      const datePart = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      downloadFile(`twitter-capture${profilePart}-${datePart}.json`, JSON.stringify(payload, null, 2), "application/json");
    });
  }

  function parseTagInput(raw) {
    if (!raw) {
      return [];
    }
    return raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((tag) => Object.hasOwn(TAG_LABELS, tag));
  }

  function reclassifyAllPosts() {
    const entries = Array.from(postStore.values());
    entries.forEach((post) => {
      const c = classifyTags(post);
      post.tags = c.tags;
      post.scores = c.scores;
      post.activeDecision = c.activeDecision;
      post.confidence = c.confidence;
      post.reasons = c.reasons;
      postStore.set(post.id, post);
      const node = idToNode.get(post.id);
      if (node && node.isConnected) {
        decorateNode(node, post);
      }
    });
  }

  function renderList(posts) {
    const fragment = document.createDocumentFragment();
    posts.forEach((post) => {
      const row = document.createElement("article");
      row.className = "tfcv2-item";
      row.innerHTML = `
        <div class="tfcv2-item-top">
          <strong>${escapeHtml(post.author)}</strong>
          <span>${post.activeDecision.toUpperCase()} • ${post.confidence}%</span>
        </div>
        <div class="tfcv2-item-tags">${post.tags.slice(0, 4).map((tag) => `<span>${escapeHtml(TAG_LABELS[tag] || tag)}</span>`).join("")}</div>
        <p>${escapeHtml((post.text || "").slice(0, 220))}</p>
        <a href="${escapeAttr(post.url)}" target="_blank" rel="noreferrer">Open</a>
      `;
      fragment.appendChild(row);
    });
    ui.list.innerHTML = "";
    ui.list.appendChild(fragment);
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(text) {
    return escapeHtml(text);
  }

  function scheduleRender() {
    if (renderScheduled) {
      return;
    }
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      render();
    });
  }

  function render() {
    if (!ui) {
      return;
    }
    ui.mode.value = state.mode;
    ui.classifier.value = state.activeClassifier;
    ui.include.value = state.includeTags.join(",");
    ui.exclude.value = state.excludeTags.join(",");
    ui.confidence.value = String(state.confidenceThreshold);
    ui.confidenceVal.textContent = String(state.confidenceThreshold);
    ui.deepScan.checked = state.profileDeepScan;

    ui.statusPill.textContent = state.statusMessage || (state.paused ? "Paused" : "Running");
    ui.modePill.textContent = safeGetModePreset(state.mode).label;
    ui.countPill.textContent = `${state.capturedCount} posts`;
    ui.statusPill.className = `tfcv2-pill ${state.paused ? "tfcv2-warning" : "tfcv2-running"}`;

    const metricsLines = [
      `Queue: ${state.queueDepth}`,
      `Avg loop: ${state.avgLoopMs}ms`,
      `Loops: ${state.scanLoops}`,
      `Duplicates: ${state.duplicateCount}`,
      `Profile: ${state.currentProfile || "-"}`,
      deepScanCheckpoint ? `Checkpoint: ${deepScanCheckpoint.id}` : "Checkpoint: none"
    ];
    ui.metrics.textContent = metricsLines.join(" • ");

    const posts = filteredPostsForUi();
    renderList(posts);
  }

  function handleRuntimeMessage(message, sender, sendResponse) {
    if (!message || typeof message !== "object") {
      sendResponse({ ok: false, error: "Invalid message payload." });
      return;
    }

    if (message.type === "TFC_V2_GET_STATE") {
      sendResponse({
        ok: true,
        state: {
          ...state,
          profileHandleDetected: detectProfileHandle(),
          availableTags: Object.keys(TAG_LABELS)
        }
      });
      return;
    }

    if (message.type === "TFC_V2_COMMAND") {
      applyCommand(message.command || {}, sendResponse);
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type." });
  }

  function applyCommand(command, sendResponse) {
    const action = command.action;
    if (!action) {
      sendResponse({ ok: false, error: "Missing action." });
      return;
    }

    switch (action) {
      case "start":
        state.running = true;
        state.paused = false;
        state.statusMessage = "Running";
        refreshLoopCadence();
        break;
      case "pause":
        state.paused = true;
        state.statusMessage = "Paused";
        refreshLoopCadence();
        break;
      case "resume":
        state.running = true;
        state.paused = false;
        state.statusMessage = "Running";
        refreshLoopCadence();
        break;
      case "stop":
        state.running = false;
        state.paused = true;
        state.statusMessage = "Stopped";
        clearLoop();
        break;
      case "set-mode":
        if (command.mode && MODE_PRESETS[command.mode]) {
          state.mode = command.mode;
          refreshLoopCadence();
        }
        break;
      case "set-classifier":
        if (command.classifier && TAG_LABELS[command.classifier]) {
          state.activeClassifier = command.classifier;
          reclassifyAllPosts();
        }
        break;
      case "set-tags":
        state.includeTags = Array.isArray(command.includeTags) ? command.includeTags.filter((tag) => TAG_LABELS[tag]) : [];
        state.excludeTags = Array.isArray(command.excludeTags) ? command.excludeTags.filter((tag) => TAG_LABELS[tag]) : [];
        break;
      case "set-confidence":
        if (typeof command.value === "number") {
          state.confidenceThreshold = clamp(Math.round(command.value), 0, 100);
        }
        break;
      case "set-profile-deep-scan":
        state.profileDeepScan = Boolean(command.value);
        if (state.profileDeepScan) {
          state.currentProfile = detectProfileHandle();
        }
        break;
      case "export-markdown": {
        const markdown = buildMarkdownReport();
        sendResponse({
          ok: true,
          markdown
        });
        scheduleStorageWrite();
        scheduleRender();
        return;
      }
      case "export-json": {
        sendResponse({
          ok: true,
          payload: {
            generatedAt: new Date().toISOString(),
            mode: state.mode,
            classifier: state.activeClassifier,
            profileDeepScan: state.profileDeepScan,
            posts: Array.from(postStore.values())
          }
        });
        return;
      }
      default:
        sendResponse({ ok: false, error: `Unknown action: ${action}` });
        return;
    }

    scheduleStorageWrite();
    scheduleRender();
    sendResponse({ ok: true, state });
  }

  function bindVisibilityHandler() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state.running && !state.paused) {
        state.statusMessage = "Paused (tab hidden)";
        scheduleRender();
      }
    });
  }

  async function init() {
    await loadState();
    state.currentProfile = state.currentProfile || detectProfileHandle();
    buildUi();
    setupObservers();
    seedQueue();
    bindVisibilityHandler();
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    if (state.running && !state.paused) {
      refreshLoopCadence();
    }
    scheduleRender();
    console.info(`[TFC v${VERSION}] initialized`, { mode: state.mode, storedPosts: postStore.size });
  }

  init().catch((err) => {
    console.error("[TFC v2] failed to initialize", err);
  });
})();

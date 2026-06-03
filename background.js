const DEFAULT_SETTINGS = {
  workMin: 25,
  breakMin: 5,
  longBreakMin: 15,
  longBreakAfter: 4,
  autoStart: false,
  strictMode: false,
  soundType: "off",
  soundVolume: 0.4,
};

async function getSettings() {
  const data = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
}

async function getState() {
  const data = await chrome.storage.local.get([
    "phase", "endTime", "blacklist", "whitelist",
    "round", "focusToday", "lastDate", "currentTask", "focusHistory",
  ]);
  return {
    phase:        data.phase        ?? "idle",
    endTime:      data.endTime      ?? null,
    blacklist:    data.blacklist    ?? [],
    whitelist:    data.whitelist    ?? [],
    round:        data.round        ?? 0,
    focusToday:   data.focusToday   ?? 0,
    lastDate:     data.lastDate     ?? null,
    currentTask:  data.currentTask  ?? "",
    focusHistory: data.focusHistory ?? {},
  };
}

async function setState(updates) {
  await chrome.storage.local.set(updates);
}

async function updateBlockingRules(blacklist, whitelist, shouldBlock) {
  const existing    = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  if (!shouldBlock || blacklist.length === 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    return;
  }

  const blockRules = blacklist.map((domain, i) => ({
    id: i + 1,
    priority: 1,
    action: { type: "redirect", redirect: { extensionPath: "/blocked.html" } },
    condition: { urlFilter: `||${domain}`, resourceTypes: ["main_frame"] },
  }));

  const allowRules = (whitelist ?? []).map((domain, i) => ({
    id: 10000 + i + 1,
    priority: 2,
    action: { type: "allow" },
    condition: { urlFilter: `||${domain}`, resourceTypes: ["main_frame"] },
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: [...blockRules, ...allowRules],
  });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function updateFocusHistory(workMin) {
  const data  = await chrome.storage.local.get("focusHistory");
  const hist  = data.focusHistory ?? {};
  const today = todayKey();
  hist[today] = (hist[today] ?? 0) + workMin;

  // Prune data older than 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const d of Object.keys(hist)) {
    if (d < cutoffStr) delete hist[d];
  }
  await chrome.storage.local.set({ focusHistory: hist });
  return hist;
}

async function ensureOffscreenDoc() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL("offscreen.html")],
  });
  if (existing.length === 0) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("offscreen.html"),
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play 5-minute interval ping during focus sessions",
    });
  }
}

async function playPingSound() {
  try {
    await ensureOffscreenDoc();
    chrome.runtime.sendMessage({ target: "offscreen", type: "PLAY_PING", volume: 0.35 });
    // Close doc after sound finishes so it doesn't linger
    setTimeout(async () => {
      const ctxs = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
      if (ctxs.length > 0) await chrome.offscreen.closeDocument();
    }, 3000);
  } catch (e) {
    console.warn("Ping sound failed:", e);
  }
}

async function startWork() {
  const [state, settings] = await Promise.all([getState(), getSettings()]);
  const ms      = settings.workMin * 60 * 1000;
  const endTime = Date.now() + ms;
  const today   = todayKey();
  const focusToday = state.lastDate === today ? state.focusToday : 0;

  await setState({ phase: "work", endTime, lastDate: today, focusToday });
  await updateBlockingRules(state.blacklist, state.whitelist, true);
  await chrome.alarms.clearAll();
  await chrome.alarms.create("pomodoroTick", { periodInMinutes: 1 / 60 });
  await chrome.alarms.create("phaseEnd",     { delayInMinutes: settings.workMin });
  await chrome.alarms.create("minutePing",   { periodInMinutes: 5 });
  updateBadge("work", endTime);
}

async function startBreak(isLong = false) {
  const [state, settings] = await Promise.all([getState(), getSettings()]);
  const breakMin = isLong ? settings.longBreakMin : settings.breakMin;
  const endTime  = Date.now() + breakMin * 60 * 1000;
  const newRound = state.round + 1;
  const focusToday = (state.focusToday ?? 0) + settings.workMin;

  // Record to history
  const focusHistory = await updateFocusHistory(settings.workMin);

  await setState({ phase: isLong ? "longbreak" : "break", endTime, round: newRound, focusToday, focusHistory });
  await updateBlockingRules(state.blacklist, state.whitelist, false);
  await chrome.alarms.clearAll();
  await chrome.alarms.create("pomodoroTick", { periodInMinutes: 1 / 60 });
  await chrome.alarms.create("phaseEnd",     { delayInMinutes: breakMin });
  updateBadge(isLong ? "longbreak" : "break", endTime);

  const title = isLong ? "Long break — you earned it!" : "Break time!";
  const msg   = isLong
    ? `Great work — ${settings.longBreakMin} minutes to recharge.`
    : `Nice session! ${settings.breakMin} minutes to relax.`;

  chrome.notifications.create({
    type: "basic", iconUrl: "icons/icon48.png",
    title: `🍅 ${title}`, message: msg,
  });
}

async function stopTimer() {
  const state = await getState();
  await setState({ phase: "idle", endTime: null });
  await updateBlockingRules(state.blacklist, state.whitelist, false);
  await chrome.alarms.clearAll();
  chrome.action.setBadgeText({ text: "" });
}

function updateBadge(phase, endTime) {
  const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000 / 60));
  const color = phase === "work" ? "#e74c3c" : phase === "longbreak" ? "#9b59b6" : "#2ecc71";
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text: remaining > 0 ? `${remaining}m` : "" });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "pomodoroTick") {
    const state = await getState();
    if (state.endTime) updateBadge(state.phase, state.endTime);
  }

  if (alarm.name === "minutePing") {
    await playPingSound();
  }

  if (alarm.name === "phaseEnd") {
    const [state, settings] = await Promise.all([getState(), getSettings()]);

    if (state.phase === "work") {
      const completedRound = (state.round ?? 0) + 1;
      const isLong = completedRound % settings.longBreakAfter === 0;
      await startBreak(isLong);
    } else if (state.phase === "break" || state.phase === "longbreak") {
      chrome.notifications.create({
        type: "basic", iconUrl: "icons/icon48.png",
        title: "🍅 Break's over!",
        message: settings.autoStart ? "Starting your next session now." : "Ready for another session?",
      });
      if (settings.autoStart) {
        await startWork();
      } else {
        await stopTimer();
      }
    }
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case "START_WORK":
        await startWork();
        break;
      case "START_BREAK":
        await startBreak(false);
        break;
      case "STOP":
        await stopTimer();
        break;
      case "GET_STATE":
        sendResponse({ ...(await getState()), settings: await getSettings() });
        return;
      case "SET_TASK":
        await setState({ currentTask: msg.task });
        break;
      case "STOP_WITH_REASON": {
        // Log the abandoned session for accountability
        const state = await getState();
        const logData = await chrome.storage.local.get("abandonLog");
        const log = logData.abandonLog ?? [];
        log.unshift({
          date:   new Date().toISOString(),
          reason: msg.reason,
          task:   state.currentTask || "—",
        });
        if (log.length > 20) log.pop();
        await chrome.storage.local.set({ abandonLog: log });
        await stopTimer();
        break;
      }
      case "UPDATE_BLACKLIST": {
        const state = await getState();
        await setState({ blacklist: msg.blacklist });
        await updateBlockingRules(msg.blacklist, state.whitelist, state.phase === "work");
        break;
      }
      case "UPDATE_WHITELIST": {
        const state = await getState();
        await setState({ whitelist: msg.whitelist });
        await updateBlockingRules(state.blacklist, msg.whitelist, state.phase === "work");
        break;
      }
      case "UPDATE_SETTINGS":
        await setState({ settings: msg.settings });
        break;
    }
    sendResponse({ ok: true });
  })();
  return true;
});

async function restoreSession() {
  const state = await getState();
  if (state.phase !== "idle" && state.endTime) {
    if (Date.now() > state.endTime) {
      await stopTimer();
    } else {
      await updateBlockingRules(state.blacklist, state.whitelist, state.phase === "work");
      updateBadge(state.phase, state.endTime);
    }
  }
}

chrome.runtime.onStartup.addListener(restoreSession);
chrome.runtime.onInstalled.addListener(restoreSession);

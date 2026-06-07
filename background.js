const DEFAULT_SETTINGS = {
  workMin: 25,
  breakMin: 5,
  longBreakMin: 15,
  longBreakAfter: 4,
  autoStart: false,
  strictMode: false,
  soundType: "off",
  soundVolume: 0.4,
  blockMode: "blacklist", // "blacklist" | "allowlist"
};

async function getSettings() {
  const data = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
}

async function getState() {
  const data = await chrome.storage.local.get([
    "phase", "endTime", "blacklist", "whitelist", "blockedApps",
    "round", "focusToday", "lastDate", "currentTask", "focusHistory",
    "goalActive", "goalCycles", "goalCyclesLeft", "goalLastWorkMin",
    "presets", "activePresetId",
  ]);
  return {
    phase:           data.phase           ?? "idle",
    endTime:         data.endTime         ?? null,
    blacklist:       data.blacklist       ?? [],
    whitelist:       data.whitelist       ?? [],
    blockedApps:     data.blockedApps     ?? [],
    round:           data.round           ?? 0,
    focusToday:      data.focusToday      ?? 0,
    lastDate:        data.lastDate        ?? null,
    currentTask:     data.currentTask     ?? "",
    focusHistory:    data.focusHistory    ?? {},
    goalActive:      data.goalActive      ?? false,
    goalCycles:      data.goalCycles      ?? 0,
    goalCyclesLeft:  data.goalCyclesLeft  ?? 0,
    goalLastWorkMin: data.goalLastWorkMin ?? 0,
    presets:         data.presets         ?? [],
    activePresetId:  data.activePresetId  ?? null,
  };
}

function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./, ""); }
  catch { return ""; }
}

// Resolves the blocking config that should be in effect right now:
// the active preset's config if one is selected, otherwise the manual lists.
async function getActiveConfig() {
  const [state, settings] = await Promise.all([getState(), getSettings()]);
  const preset = (state.presets ?? []).find((p) => p.id === state.activePresetId);

  if (preset) {
    const allow = preset.blockMode === "allowlist";
    let sites = [...(preset.sites ?? [])];
    // In allow-only mode, make sure the auto-open URL's host is reachable
    if (allow && preset.autoOpenUrl) {
      const h = hostOf(preset.autoOpenUrl);
      if (h && !sites.includes(h)) sites.push(h);
    }
    return {
      blockMode:   preset.blockMode ?? "blacklist",
      blacklist:   allow ? [] : sites,
      whitelist:   allow ? sites : [],
      blockedApps: preset.apps ?? [],
      autoOpenUrl: preset.autoOpenUrl ?? "",
    };
  }

  return {
    blockMode:   settings.blockMode,
    blacklist:   state.blacklist ?? [],
    whitelist:   state.whitelist ?? [],
    blockedApps: state.blockedApps ?? [],
    autoOpenUrl: "",
  };
}

// ── Native messaging bridge (macOS app blocker) ───────────────────────────────

const NATIVE_HOST = "com.pomodoro.blocker";
let nativePort = null;

function connectNativeHost() {
  if (nativePort) return nativePort;
  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST);
    nativePort.onDisconnect.addListener(() => {
      // Host not installed, or it exited — log why, then clear so we retry
      const err = chrome.runtime.lastError;
      console.warn("[native] disconnected:", err ? err.message : "(no error)");
      nativePort = null;
    });
    nativePort.onMessage.addListener((msg) => {
      console.log("[native] host says:", msg);
    });
    console.log("[native] connected to", NATIVE_HOST);
  } catch (e) {
    console.warn("[native] connect failed:", e);
    nativePort = null;
  }
  return nativePort;
}

async function sendToNative(phase) {
  const cfg  = await getActiveConfig();
  const port = connectNativeHost();
  if (!port) return;
  try {
    port.postMessage({ type: "SESSION", phase, apps: cfg.blockedApps ?? [] });
  } catch (e) {
    nativePort = null;
  }
}

async function setState(updates) {
  await chrome.storage.local.set(updates);
}

async function updateBlockingRules(blacklist, whitelist, shouldBlock, blockMode = "blacklist") {
  const existing     = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  if (!shouldBlock) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    return;
  }

  let addRules = [];

  if (blockMode === "allowlist") {
    // Block everything (priority 1)
    addRules.push({
      id: 99999,
      priority: 1,
      action: { type: "redirect", redirect: { extensionPath: "/blocked.html" } },
      condition: { urlFilter: "|http", resourceTypes: ["main_frame"] },
    });
    // Allow only whitelisted domains (priority 2)
    (whitelist ?? []).forEach((domain, i) => {
      addRules.push({
        id: 10000 + i + 1,
        priority: 2,
        action: { type: "allow" },
        condition: { urlFilter: `||${domain}`, resourceTypes: ["main_frame"] },
      });
    });
  } else {
    // Blacklist mode: block listed, allow exceptions
    (blacklist ?? []).forEach((domain, i) => {
      addRules.push({
        id: i + 1,
        priority: 1,
        action: { type: "redirect", redirect: { extensionPath: "/blocked.html" } },
        condition: { urlFilter: `||${domain}`, resourceTypes: ["main_frame"] },
      });
    });
    (whitelist ?? []).forEach((domain, i) => {
      addRules.push({
        id: 10000 + i + 1,
        priority: 2,
        action: { type: "allow" },
        condition: { urlFilter: `||${domain}`, resourceTypes: ["main_frame"] },
      });
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function updateFocusHistory(workMin) {
  const data  = await chrome.storage.local.get("focusHistory");
  const hist  = data.focusHistory ?? {};
  const today = todayKey();
  hist[today] = (hist[today] ?? 0) + workMin;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const d of Object.keys(hist)) {
    if (d < cutoffStr) delete hist[d];
  }
  await chrome.storage.local.set({ focusHistory: hist });
  return hist;
}

async function reloadBlockedTabs(blacklist, whitelist, blockMode) {
  try {
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });

    for (const tab of tabs) {
      if (!tab.url) continue;
      let shouldReload = false;

      // .host includes the port (e.g. "localhost:4567"); also derive the
      // bare hostname so both "localhost" and "localhost:4567" match.
      const u    = new URL(tab.url);
      const host = u.host.replace(/^www\./, "");
      const bare = u.hostname.replace(/^www\./, "");
      const matches = (list) => (list ?? []).some(
        (d) => host === d || bare === d || bare.endsWith("." + d)
      );

      if (blockMode === "allowlist") {
        shouldReload = !matches(whitelist);
      } else {
        shouldReload = matches(blacklist) && !matches(whitelist);
      }

      if (shouldReload) chrome.tabs.reload(tab.id);
    }
  } catch (e) {
    console.warn("reloadBlockedTabs error:", e);
  }
}

async function startWork() {
  const [state, settings] = await Promise.all([getState(), getSettings()]);

  // Goal mode: use extended duration on last cycle
  let workMin = settings.workMin;
  if (state.goalActive && state.goalCyclesLeft > 0) {
    const isLastCycle = state.goalCyclesLeft === 1;
    if (isLastCycle && state.goalLastWorkMin > 0) {
      workMin = state.goalLastWorkMin;
    }
  }

  const endTime = Date.now() + workMin * 60 * 1000;
  const today   = todayKey();
  const focusToday = state.lastDate === today ? state.focusToday : 0;

  const cfg = await getActiveConfig();

  await setState({ phase: "work", endTime, lastDate: today, focusToday });
  await updateBlockingRules(cfg.blacklist, cfg.whitelist, true, cfg.blockMode);
  await reloadBlockedTabs(cfg.blacklist, cfg.whitelist, cfg.blockMode);
  await chrome.alarms.clearAll();
  await chrome.alarms.create("pomodoroTick", { periodInMinutes: 1 / 60 });
  await chrome.alarms.create("phaseEnd",     { delayInMinutes: workMin });
  await chrome.alarms.create("minutePing",   { periodInMinutes: 5 });
  updateBadge("work", endTime);
  sendToNative("work");

  // Auto-open the preset's URL (opened after rules apply so it isn't blocked)
  if (cfg.autoOpenUrl) {
    try { chrome.tabs.create({ url: cfg.autoOpenUrl }); } catch (e) {}
  }
}

async function startBreak(isLong = false) {
  const [state, settings] = await Promise.all([getState(), getSettings()]);
  const breakMin  = isLong ? settings.longBreakMin : settings.breakMin;
  const endTime   = Date.now() + breakMin * 60 * 1000;
  const newRound  = state.round + 1;
  const focusToday = (state.focusToday ?? 0) + settings.workMin;
  const focusHistory = await updateFocusHistory(settings.workMin);

  // Goal: decrement cycles left
  const newCyclesLeft = Math.max(0, (state.goalCyclesLeft ?? 0) - 1);
  const goalJustDone  = state.goalActive && newCyclesLeft === 0;

  // Always save stats first
  await setState({
    round: newRound, focusToday, focusHistory,
    goalCyclesLeft: newCyclesLeft,
    ...(goalJustDone ? { goalActive: false } : {}),
  });

  // Goal complete — stop immediately, no final break
  if (goalJustDone) {
    await setState({ phase: "idle", endTime: null });
    await updateBlockingRules(state.blacklist, state.whitelist, false, settings.blockMode);
    await chrome.alarms.clearAll();
    chrome.action.setBadgeText({ text: "" });
    chrome.notifications.create({
      type: "basic", iconUrl: "icons/icon48.png",
      title: "🍅 Goal complete — great work!",
      message: `All ${state.goalCycles} sessions done. You're free!`,
    });
    return;
  }

  // Regular break
  await setState({ phase: isLong ? "longbreak" : "break", endTime });
  await updateBlockingRules(state.blacklist, state.whitelist, false, settings.blockMode);
  await chrome.alarms.clearAll();
  await chrome.alarms.create("pomodoroTick", { periodInMinutes: 1 / 60 });
  await chrome.alarms.create("phaseEnd",     { delayInMinutes: breakMin });
  updateBadge(isLong ? "longbreak" : "break", endTime);
  sendToNative("break");
  playBreakChime();

  chrome.notifications.create({
    type: "basic", iconUrl: "icons/icon48.png",
    title: `🍅 ${isLong ? "Long break — you earned it!" : "Break time!"}`,
    message: isLong
      ? `Great work — ${settings.longBreakMin} minutes to recharge.`
      : `Nice session! ${settings.breakMin} minutes to relax.`,
  });
}

async function stopTimer() {
  const [state, settings] = await Promise.all([getState(), getSettings()]);
  await setState({ phase: "idle", endTime: null, goalActive: false, goalCyclesLeft: 0 });
  await updateBlockingRules(state.blacklist, state.whitelist, false, settings.blockMode);
  await chrome.alarms.clearAll();
  chrome.action.setBadgeText({ text: "" });
  sendToNative("idle");
}

function updateBadge(phase, endTime) {
  const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000 / 60));
  const color = phase === "work" ? "#e74c3c" : phase === "longbreak" ? "#9b59b6" : "#2ecc71";
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text: remaining > 0 ? `${remaining}m` : "" });
}

// ── Alarm handler ─────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "pomodoroTick") {
    const state = await getState();
    if (state.endTime) updateBadge(state.phase, state.endTime);
    // Keep native host alive & re-block apps that were reopened during work
    if (state.phase === "work") {
      const cfg = await getActiveConfig();
      if ((cfg.blockedApps ?? []).length > 0) sendToNative("work");
    }
  }

  if (alarm.name === "minutePing") {
    await playPingSound();
  }

  if (alarm.name === "phaseEnd") {
    const [state, settings] = await Promise.all([getState(), getSettings()]);

    if (state.phase === "work") {
      const completedRound = (state.round ?? 0) + 1;
      const isLong = !state.goalActive && completedRound % settings.longBreakAfter === 0;
      await startBreak(isLong);
    } else if (state.phase === "break" || state.phase === "longbreak") {
      // If goal just finished (goalActive was set false in startBreak), stop here
      if (!state.goalActive && state.goalCycles > 0 && state.goalCyclesLeft === 0) {
        await stopTimer();
        return;
      }
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

// ── Offscreen ping ────────────────────────────────────────────────────────────

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

async function playOffscreenSound(type, volume, closeAfterMs) {
  try {
    await ensureOffscreenDoc();
    chrome.runtime.sendMessage({ target: "offscreen", type, volume });
    setTimeout(async () => {
      const ctxs = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
      if (ctxs.length > 0) await chrome.offscreen.closeDocument();
    }, closeAfterMs);
  } catch (e) {
    console.warn(`${type} failed:`, e);
  }
}

async function playPingSound()  { return playOffscreenSound("PLAY_PING", 0.35, 3000); }
async function playBreakChime() { return playOffscreenSound("PLAY_DING", 0.4,  2000); }

// ── Message handler ───────────────────────────────────────────────────────────

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
      case "SET_GOAL": {
        if (!msg.active) {
          await setState({ goalActive: false, goalCycles: 0, goalCyclesLeft: 0, goalLastWorkMin: 0 });
        } else {
          const { totalMin, workMin, breakMin } = msg;
          // No break after the last session:
          // (cycles - 1) × (work + break) + lastWork = total
          const cycleTime   = workMin + breakMin;
          const cycles      = Math.max(1, Math.floor((totalMin - workMin) / cycleTime) + 1);
          const lastWorkMin = totalMin - (cycles - 1) * cycleTime;
          await setState({
            goalActive: true,
            goalCycles: cycles,
            goalCyclesLeft: cycles,
            goalLastWorkMin: lastWorkMin,
          });
        }
        break;
      }
      case "STOP_WITH_REASON": {
        const state = await getState();
        const logData = await chrome.storage.local.get("abandonLog");
        const log = logData.abandonLog ?? [];
        log.unshift({ date: new Date().toISOString(), reason: msg.reason, task: state.currentTask || "—" });
        if (log.length > 20) log.pop();
        await chrome.storage.local.set({ abandonLog: log });
        await stopTimer();
        break;
      }
      case "UPDATE_BLACKLIST": {
        const [state, settings] = await Promise.all([getState(), getSettings()]);
        await setState({ blacklist: msg.blacklist });
        await updateBlockingRules(msg.blacklist, state.whitelist, state.phase === "work", settings.blockMode);
        break;
      }
      case "UPDATE_WHITELIST": {
        const [state, settings] = await Promise.all([getState(), getSettings()]);
        await setState({ whitelist: msg.whitelist });
        await updateBlockingRules(state.blacklist, msg.whitelist, state.phase === "work", settings.blockMode);
        break;
      }
      case "UPDATE_BLOCKED_APPS": {
        const state = await getState();
        await setState({ blockedApps: msg.blockedApps });
        // If a work session is active, push the new list to the native host now
        if (state.phase === "work") sendToNative("work");
        break;
      }
      case "FINISH": {
        // Stop session, reset round counter and goal — clean slate
        const state = await getState();
        await setState({
          phase: "idle", endTime: null,
          round: 0, goalActive: false, goalCycles: 0,
          goalCyclesLeft: 0, goalLastWorkMin: 0, currentTask: "",
        });
        await updateBlockingRules(state.blacklist, state.whitelist, false, (await getSettings()).blockMode);
        await chrome.alarms.clearAll();
        chrome.action.setBadgeText({ text: "" });
        sendToNative("idle");
        break;
      }
      case "UPDATE_SETTINGS": {
        const state = await getState();
        await setState({ settings: msg.settings });
        // Re-apply rules if mode changed while session is active
        if (state.phase === "work") {
          const cfg = await getActiveConfig();
          await updateBlockingRules(cfg.blacklist, cfg.whitelist, true, cfg.blockMode);
        }
        break;
      }
      case "SAVE_PRESET": {
        const state = await getState();
        const presets = [...(state.presets ?? [])];
        const idx = presets.findIndex((p) => p.id === msg.preset.id);
        if (idx >= 0) presets[idx] = msg.preset;
        else presets.push(msg.preset);
        await setState({ presets });
        break;
      }
      case "DELETE_PRESET": {
        const state = await getState();
        const presets = (state.presets ?? []).filter((p) => p.id !== msg.id);
        const activePresetId = state.activePresetId === msg.id ? null : state.activePresetId;
        await setState({ presets, activePresetId });
        break;
      }
      case "SET_ACTIVE_PRESET": {
        await setState({ activePresetId: msg.id ?? null });
        break;
      }
    }
    sendResponse({ ok: true });
  })();
  return true;
});

// ── Session restore ───────────────────────────────────────────────────────────

async function restoreSession() {
  const state = await getState();
  if (state.phase !== "idle" && state.endTime) {
    if (Date.now() > state.endTime) {
      await stopTimer();
    } else {
      const cfg = await getActiveConfig();
      await updateBlockingRules(cfg.blacklist, cfg.whitelist, state.phase === "work", cfg.blockMode);
      updateBadge(state.phase, state.endTime);
    }
  }
}

chrome.runtime.onStartup.addListener(restoreSession);
chrome.runtime.onInstalled.addListener(restoreSession);

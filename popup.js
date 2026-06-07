const CIRCUMFERENCE = 2 * Math.PI * 60;

const BREAK_SUGGESTIONS = [
  { icon: "💪", text: "20 push-ups — go!" },
  { icon: "🦵", text: "30 squats — slow and controlled" },
  { icon: "🏋️", text: "Max pull-ups — hang until failure" },
  { icon: "🔥", text: "20 lunges — 10 each leg" },
  { icon: "⚡", text: "Burpees × 15 — full extension at the top" },
  { icon: "🪑", text: "Wall sit for 60 seconds" },
  { icon: "🤸", text: "Pike push-ups × 15" },
  { icon: "🦶", text: "Calf raises × 40 — balance on one foot if easy" },
  { icon: "💥", text: "Jump squats × 20 — land soft" },
  { icon: "🖐️", text: "Diamond push-ups × 15" },
  { icon: "🧘", text: "5 deep breaths + neck and shoulder rolls" },
  { icon: "👀", text: "Look out a window for 20 seconds — rest your eyes" },
  { icon: "💧", text: "Drink a full glass of water" },
  { icon: "📔", text: "Write down what you just accomplished" },
  { icon: "☕", text: "Make yourself a drink" },
];

const els = {
  timerDisplay:      document.getElementById("timerDisplay"),
  timerLabel:        document.getElementById("timerLabel"),
  phaseBadge:        document.getElementById("phaseBadge"),
  ringProgress:      document.getElementById("ringProgress"),
  btnStart:          document.getElementById("btnStart"),
  btnBreak:          document.getElementById("btnBreak"),
  btnStop:           document.getElementById("btnStop"),
  btnFinish:         document.getElementById("btnFinish"),
  controlsRow:       document.getElementById("controlsRow"),
  strictBadge:       document.getElementById("strictBadge"),
  taskInput:         document.getElementById("taskInput"),
  taskDisplay:       document.getElementById("taskDisplay"),
  taskText:          document.getElementById("taskText"),
  reasonForm:        document.getElementById("reasonForm"),
  reasonInput:       document.getElementById("reasonInput"),
  confirmAbandon:    document.getElementById("confirmAbandon"),
  cancelReason:      document.getElementById("cancelReason"),
  breakPanel:        document.getElementById("breakPanel"),
  breakIcon:         document.getElementById("breakIcon"),
  breakText:         document.getElementById("breakText"),
  breakNextBtn:      document.getElementById("breakNextBtn"),
  blacklist:         document.getElementById("blacklist"),
  siteInput:         document.getElementById("siteInput"),
  addSiteBtn:        document.getElementById("addSiteBtn"),
  whitelist:         document.getElementById("whitelist"),
  whiteInput:        document.getElementById("whiteInput"),
  addWhiteBtn:       document.getElementById("addWhiteBtn"),
  appslist:          document.getElementById("appslist"),
  appInput:          document.getElementById("appInput"),
  addAppBtn:         document.getElementById("addAppBtn"),
  // Presets
  presetSelect:      document.getElementById("presetSelect"),
  managePresetsBtn:  document.getElementById("managePresetsBtn"),
  presetHint:        document.getElementById("presetHint"),
  presetsToggle:     document.getElementById("presetsToggle"),
  presetsBody:       document.getElementById("presetsBody"),
  presetList:        document.getElementById("presetList"),
  newPresetBtn:      document.getElementById("newPresetBtn"),
  presetEditor:      document.getElementById("presetEditor"),
  pName:             document.getElementById("pName"),
  pMode:             document.getElementById("pMode"),
  pSites:            document.getElementById("pSites"),
  pSitesLabel:       document.getElementById("pSitesLabel"),
  pApps:             document.getElementById("pApps"),
  pUrl:              document.getElementById("pUrl"),
  pCancel:           document.getElementById("pCancel"),
  pSave:             document.getElementById("pSave"),
  sessionsCount:     document.getElementById("sessionsCount"),
  focusTime:         document.getElementById("focusTime"),
  blockedCount:      document.getElementById("blockedCount"),
  settingsToggle:    document.getElementById("settingsToggle"),
  settingsPanel:     document.getElementById("settingsPanel"),
  setWork:           document.getElementById("setWork"),
  setBreak:          document.getElementById("setBreak"),
  setLongBreak:      document.getElementById("setLongBreak"),
  setLongBreakAfter: document.getElementById("setLongBreakAfter"),
  setAutoStart:      document.getElementById("setAutoStart"),
  setStrictMode:     document.getElementById("setStrictMode"),
  setSoundType:      document.getElementById("setSoundType"),
  setSoundVolume:    document.getElementById("setSoundVolume"),
  volumeRow:         document.getElementById("volumeRow"),
  saveSettings:      document.getElementById("saveSettings"),
  savedMsg:          document.getElementById("savedMsg"),
  durationPill:      document.getElementById("durationPill"),
  hmapGrid:           document.getElementById("hmapGrid"),
  heatmapToggle:      document.getElementById("heatmapToggle"),
  heatmapBody:        document.getElementById("heatmapBody"),
  // Goal
  goalSection:        document.getElementById("goalSection"),
  goalEnabled:        document.getElementById("goalEnabled"),
  goalMinutes:        document.getElementById("goalMinutes"),
  goalPreview:        document.getElementById("goalPreview"),
  goalProgress:       document.getElementById("goalProgress"),
  goalProgressText:   document.getElementById("goalProgressText"),
  goalProgressMins:   document.getElementById("goalProgressMins"),
  goalBarFill:        document.getElementById("goalBarFill"),
  // Mode
  modeBlacklistBtn:   document.getElementById("modeBlacklistBtn"),
  modeAllowlistBtn:   document.getElementById("modeAllowlistBtn"),
  modeBlacklistDesc:  document.getElementById("modeBlacklistDesc"),
  modeAllowlistDesc:  document.getElementById("modeAllowlistDesc"),
  blacklistPanel:     document.getElementById("blacklistPanel"),
  whitelistTitle:     document.getElementById("whitelistTitle"),
  whitelistHint:      document.getElementById("whitelistHint"),
};

// ── State ───────────────────────────────────────────────────────────────────

let tickInterval  = null;
let strictClicks  = 0;
let currentSuggestionIdx = Math.floor(Math.random() * BREAK_SUGGESTIONS.length);

// ── Ambient audio ────────────────────────────────────────────────────────────

let audioCtx   = null;
let audioSrc   = null;
let audioGain  = null;

function makeWhiteBuffer(ctx) {
  const sr  = ctx.sampleRate;
  const buf = ctx.createBuffer(1, 2 * sr, sr);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  return src;
}

function makeBrownBuffer(ctx) {
  const sr  = ctx.sampleRate;
  const buf = ctx.createBuffer(1, 2 * sr, sr);
  const d   = buf.getChannelData(0);
  let last  = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    d[i] = last = (last + 0.02 * w) / 1.02;
    d[i] *= 3.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  return src;
}

// Pink noise via Paul Kellet's algorithm — much more natural for rain
function makePinkBuffer(ctx) {
  const sr  = ctx.sampleRate;
  const buf = ctx.createBuffer(1, 4 * sr, sr);
  const d   = buf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886*b0 + w*0.0555179;
    b1 = 0.99332*b1 + w*0.0750759;
    b2 = 0.96900*b2 + w*0.1538520;
    b3 = 0.86650*b3 + w*0.3104856;
    b4 = 0.55000*b4 + w*0.5329522;
    b5 = -0.7616*b5 - w*0.0168980;
    d[i] = (b0+b1+b2+b3+b4+b5+b6 + w*0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  return src;
}

async function startSound(type, volume) {
  stopSound();
  if (type === "off") return;

  audioCtx  = new AudioContext();
  audioGain = audioCtx.createGain();
  audioGain.gain.value = volume;
  audioGain.connect(audioCtx.destination);

  if (type === "rain") {
    try {
      const url      = chrome.runtime.getURL("rain_loop.mp3");
      const response = await fetch(url);
      const buffer   = await response.arrayBuffer();
      const decoded  = await audioCtx.decodeAudioData(buffer);
      audioSrc        = audioCtx.createBufferSource();
      audioSrc.buffer = decoded;
      audioSrc.loop   = true;
      audioSrc.connect(audioGain);
      audioSrc.start();
    } catch (err) {
      console.warn("rain.mp3 failed, falling back to generated rain", err);
      audioSrc = makePinkBuffer(audioCtx);
      audioSrc.connect(audioGain);
      audioSrc.start();
    }
  } else if (type === "brown") {
    audioSrc = makeBrownBuffer(audioCtx);
    audioSrc.connect(audioGain);
    audioSrc.start();
  } else {
    audioSrc = makeWhiteBuffer(audioCtx);
    audioSrc.connect(audioGain);
    audioSrc.start();
  }

  audioCtx.resume();
}

function stopSound() {
  if (audioSrc) { try { audioSrc.stop(); } catch (_) {} audioSrc = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
  audioGain = null;
}

function setVolume(v) {
  if (audioGain) audioGain.gain.value = v;
}

// Ambient should play ONLY during work — muted on break, resumed on next work.
let ambientOn = false;

function syncAmbient(state) {
  const s = state?.settings ?? {};
  const wants     = s.soundType && s.soundType !== "off";
  const shouldPlay = wants && state?.phase === "work";

  if (shouldPlay && !ambientOn) {
    startSound(s.soundType, s.soundVolume ?? 0.4);
    ambientOn = true;
  } else if (!shouldPlay && ambientOn) {
    stopSound();
    ambientOn = false;
  }
}

// ── Stop-button crunch sounds (strict mode) ───────────────────────────────────

function makeDistortionCurve(amount) {
  const n    = 512;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x  = (i * 2) / n - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function playStopSound(clickNum) {
  const ctx = new AudioContext();
  const now = ctx.currentTime;

  if (clickNum >= 10) {
    // ── "It broke" sound ─────────────────────────────────
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.7, now);
    master.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    master.connect(ctx.destination);

    const dist = ctx.createWaveShaper();
    dist.curve = makeDistortionCurve(500);
    dist.connect(master);

    // Descending screech
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.55);
    osc.connect(dist);
    osc.start(now); osc.stop(now + 0.55);

    // Noise burst
    const nbuf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const nd   = nbuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource();
    ns.buffer = nbuf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(1, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    ns.connect(ng); ng.connect(master);
    ns.start(now);

  } else {
    // ── Escalating click ──────────────────────────────────
    const vol  = 0.06 + clickNum * 0.07;   // gets louder
    const dur  = 0.06 + clickNum * 0.012;

    const master = ctx.createGain();
    master.gain.setValueAtTime(vol, now);
    master.gain.exponentialRampToValueAtTime(0.001, now + dur);
    master.connect(ctx.destination);

    const dist = ctx.createWaveShaper();
    dist.curve = makeDistortionCurve(clickNum * 25); // more crunch each time
    dist.connect(master);

    const osc = ctx.createOscillator();
    osc.type = clickNum < 4 ? "square" : "sawtooth";
    osc.frequency.setValueAtTime(280 + clickNum * 55, now);
    if (clickNum >= 6) {
      // Pitch wobble for extra unpleasantness
      osc.frequency.linearRampToValueAtTime(180 + clickNum * 20, now + dur);
    }
    osc.connect(dist);
    osc.start(now); osc.stop(now + dur);

    // Add crackle from click 5 onwards
    if (clickNum >= 5) {
      const cbuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const cd   = cbuf.getChannelData(0);
      for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1;
      const cs = ctx.createBufferSource();
      cs.buffer = cbuf;
      const cg  = ctx.createGain();
      cg.gain.value = 0.15 + (clickNum - 5) * 0.08;
      cs.connect(cg); cg.connect(master);
      cs.start(now);
    }
  }

  setTimeout(() => ctx.close(), 1200);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function phaseColor(phase) {
  if (phase === "work")      return "#e74c3c";
  if (phase === "longbreak") return "#9b59b6";
  if (phase === "break")     return "#2ecc71";
  return "#353560";
}

function totalSecondsForPhase(phase, settings) {
  if (phase === "work")      return settings.workMin * 60;
  if (phase === "longbreak") return settings.longBreakMin * 60;
  return settings.breakMin * 60;
}

function setRing(fraction, phase) {
  els.ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)));
  els.ringProgress.style.stroke           = phaseColor(phase);
}

function renderDots(state, s) {
  const container = document.getElementById("roundDots");
  let count, filled, longIndex = -1;

  if (state.goalActive && state.goalCycles > 0) {
    // Goal session: one dot per planned session
    count  = state.goalCycles;
    filled = state.goalCycles - state.goalCyclesLeft;
  } else if (state.phase === "idle" && els.goalEnabled.checked) {
    // Idle preview of a goal about to start
    const totalMin = parseInt(els.goalMinutes.value, 10) || 60;
    const workMin  = parseInt(els.setWork.value, 10)     || s.workMin  || 25;
    const breakMin = parseInt(els.setBreak.value, 10)    || s.breakMin || 5;
    count  = calculateGoal(totalMin, workMin, breakMin).cycles;
    filled = 0;
  } else {
    // Normal mode: dots count up to a long break
    count  = s.longBreakAfter ?? 4;
    const round = state.round ?? 0;
    filled = round % count;
    if (filled === 0 && round > 0) longIndex = count - 1;
  }

  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("div");
    dot.className = "dot";
    if (i < filled)        dot.classList.add("filled");
    if (i === longIndex)   dot.classList.add("long");
    container.appendChild(dot);
  }
}

function sendMsg(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function normalizeDomain(raw) {
  return raw.trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderState(state) {
  const { phase, endTime, round, focusToday, currentTask, settings } = state;
  const s          = settings ?? { workMin: 25, breakMin: 5, longBreakMin: 15, longBreakAfter: 4, strictMode: false };
  const now        = Date.now();
  const remainMs   = endTime ? Math.max(0, endTime - now) : 0;
  const remainSec  = Math.ceil(remainMs / 1000);
  const totalSec   = totalSecondsForPhase(phase, s);
  const fraction   = phase === "idle" ? 1 : remainSec / totalSec;

  els.timerDisplay.textContent = phase === "idle" ? formatTime(s.workMin * 60) : formatTime(remainSec);
  els.timerLabel.textContent   = { work: "focus", break: "break", longbreak: "long break", idle: "ready" }[phase] ?? "ready";

  const badgeMap = { work: "FOCUS", break: "BREAK", longbreak: "LONG BREAK", idle: "IDLE" };
  els.phaseBadge.textContent = badgeMap[phase] ?? "IDLE";
  els.phaseBadge.className   = `phase-badge phase-${phase}`;

  setRing(fraction, phase);
  renderDots(state, s);
  renderGoalProgress(state, s);

  // Focus time stat
  const fm = focusToday ?? 0;
  els.focusTime.textContent = fm >= 60 ? `${Math.floor(fm / 60)}h${fm % 60 ? (fm % 60) + "m" : ""}` : `${fm}m`;

  // Task display
  const isWorking = phase === "work" || phase === "break" || phase === "longbreak";
  els.taskInput.style.display   = isWorking ? "none" : "block";
  els.taskDisplay.style.display = isWorking && currentTask ? "block" : "none";
  if (currentTask) els.taskText.textContent = currentTask;

  // Strict mode badge
  els.strictBadge.classList.toggle("visible", !!s.strictMode && phase === "work");

  // Controls vs reason form
  const inReasonForm = els.reasonForm.classList.contains("visible");
  if (!inReasonForm) {
    els.btnStart.disabled = phase !== "idle";
    els.btnBreak.disabled = phase !== "work";

    if (s.strictMode && phase === "work") {
      const left = 10 - strictClicks;
      els.btnStop.disabled    = false;
      els.btnStop.textContent = strictClicks === 0 ? "■ Stop" : `■ Stop (${left} more)`;
      els.btnStop.classList.toggle("counting", strictClicks > 0);
    } else {
      els.btnStop.disabled    = phase === "idle";
      els.btnStop.textContent = "■ Stop";
      els.btnStop.classList.remove("counting");
    }
  }

  // Break suggestions
  els.breakPanel.classList.toggle("visible", phase === "break" || phase === "longbreak");

  // Blacklist/whitelist edit lockout during strict work
  const locked = s.strictMode && phase === "work";
  els.siteInput.disabled    = locked;
  els.addSiteBtn.disabled   = locked;
  els.whiteInput.disabled   = locked;
  els.addWhiteBtn.disabled  = locked;
  document.querySelectorAll(".remove, .remove-white").forEach(btn => {
    btn.disabled = locked;
  });
}

// ── Break suggestions ────────────────────────────────────────────────────────

function showSuggestion(idx) {
  const s = BREAK_SUGGESTIONS[idx % BREAK_SUGGESTIONS.length];
  els.breakIcon.textContent = s.icon;
  els.breakText.textContent = s.text;
}

// ── Strict mode ──────────────────────────────────────────────────────────────

function showReasonForm() {
  els.controlsRow.style.display = "none";
  els.reasonForm.classList.add("visible");
  els.reasonInput.focus();
}

function hideReasonForm() {
  els.controlsRow.style.display = "";
  els.reasonForm.classList.remove("visible");
  strictClicks = 0;
  els.btnStop.textContent = "■ Stop";
  els.btnStop.classList.remove("counting");
}

// ── Blacklist / whitelist ────────────────────────────────────────────────────

function renderBlacklist(list) {
  els.blacklist.innerHTML = "";
  list.forEach((domain) => {
    const item = document.createElement("div");
    item.className = "site-item";
    item.innerHTML = `<span class="domain">${domain}</span><button class="remove" data-domain="${domain}" title="Remove">×</button>`;
    els.blacklist.appendChild(item);
  });
  els.blockedCount.textContent = list.length;
}

function renderWhitelist(list) {
  els.whitelist.innerHTML = "";
  list.forEach((domain) => {
    const item = document.createElement("div");
    item.className = "site-item";
    item.style.background = "#0e2a1a";
    item.style.color = "#2ecc71";
    item.innerHTML = `<span class="domain">✓ ${domain}</span><button class="remove-white" data-domain="${domain}" title="Remove">×</button>`;
    els.whitelist.appendChild(item);
  });
}

async function addSite() {
  const domain = normalizeDomain(els.siteInput.value);
  if (!domain) return;
  const state   = await sendMsg({ type: "GET_STATE" });
  const list    = state.blacklist ?? [];
  if (list.includes(domain)) { els.siteInput.value = ""; return; }
  const updated = [...list, domain];
  await sendMsg({ type: "UPDATE_BLACKLIST", blacklist: updated });
  els.siteInput.value = "";
  renderBlacklist(updated);
}

async function removeSite(domain) {
  const state   = await sendMsg({ type: "GET_STATE" });
  const updated = (state.blacklist ?? []).filter((d) => d !== domain);
  await sendMsg({ type: "UPDATE_BLACKLIST", blacklist: updated });
  renderBlacklist(updated);
}

async function addWhiteSite() {
  const domain = normalizeDomain(els.whiteInput.value);
  if (!domain) return;
  const state   = await sendMsg({ type: "GET_STATE" });
  const list    = state.whitelist ?? [];
  if (list.includes(domain)) { els.whiteInput.value = ""; return; }
  const updated = [...list, domain];
  await sendMsg({ type: "UPDATE_WHITELIST", whitelist: updated });
  els.whiteInput.value = "";
  renderWhitelist(updated);
}

async function removeWhiteSite(domain) {
  const state   = await sendMsg({ type: "GET_STATE" });
  const updated = (state.whitelist ?? []).filter((d) => d !== domain);
  await sendMsg({ type: "UPDATE_WHITELIST", whitelist: updated });
  renderWhitelist(updated);
}

// ── Blocked apps (macOS) ──────────────────────────────────────────────────────

function renderApps(list) {
  els.appslist.innerHTML = "";
  list.forEach((app) => {
    const item = document.createElement("div");
    item.className = "site-item";
    item.style.background = "#2a1a3a";
    item.style.color = "#b080d0";
    item.innerHTML = `<span class="domain">🖥️ ${app}</span><button class="remove-app" data-app="${app}" title="Remove">×</button>`;
    els.appslist.appendChild(item);
  });
}

async function addApp() {
  const name = els.appInput.value.trim();
  if (!name) return;
  const state = await sendMsg({ type: "GET_STATE" });
  const list  = state.blockedApps ?? [];
  if (list.includes(name)) { els.appInput.value = ""; return; }
  const updated = [...list, name];
  await sendMsg({ type: "UPDATE_BLOCKED_APPS", blockedApps: updated });
  els.appInput.value = "";
  renderApps(updated);
}

async function removeApp(name) {
  const state   = await sendMsg({ type: "GET_STATE" });
  const updated = (state.blockedApps ?? []).filter((a) => a !== name);
  await sendMsg({ type: "UPDATE_BLOCKED_APPS", blockedApps: updated });
  renderApps(updated);
}

// ── Presets ───────────────────────────────────────────────────────────────────

let editingPresetId = null;

function splitList(raw) {
  return (raw ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function renderPresetSelect(presets, activeId) {
  els.presetSelect.innerHTML = '<option value="">No preset (manual)</option>';
  (presets ?? []).forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === activeId) opt.selected = true;
    els.presetSelect.appendChild(opt);
  });
  updatePresetHint(presets, activeId);
}

function updatePresetHint(presets, activeId) {
  const p = (presets ?? []).find((x) => x.id === activeId);
  if (!p) { els.presetHint.textContent = ""; return; }
  const bits = [];
  bits.push(p.blockMode === "allowlist" ? "allow-only" : "block-listed");
  if ((p.apps ?? []).length) bits.push(`closes ${p.apps.length} app${p.apps.length > 1 ? "s" : ""}`);
  if (p.autoOpenUrl) bits.push("auto-opens a page");
  els.presetHint.textContent = `“${p.name}” — ${bits.join(" · ")}`;
}

function renderPresetList(presets) {
  els.presetList.innerHTML = "";
  if (!(presets ?? []).length) {
    els.presetList.innerHTML = `<div style="font-size:12px;color:#444;padding:4px 0">No presets yet.</div>`;
    return;
  }
  presets.forEach((p) => {
    const item = document.createElement("div");
    item.className = "preset-list-item";
    const mode = p.blockMode === "allowlist" ? "Allow only" : "Block listed";
    const meta = [mode, `${(p.sites ?? []).length} sites`, `${(p.apps ?? []).length} apps`].join(" · ");
    item.innerHTML = `
      <div>
        <div class="pli-name">${p.name}</div>
        <div class="pli-meta">${meta}</div>
      </div>
      <div class="pli-actions">
        <button class="pli-btn pli-edit"   data-id="${p.id}" title="Edit">✏️</button>
        <button class="pli-btn pli-delete" data-id="${p.id}" title="Delete">🗑</button>
      </div>`;
    els.presetList.appendChild(item);
  });
}

function openPresetEditor(preset) {
  editingPresetId = preset?.id ?? null;
  els.pName.value = preset?.name ?? "";
  els.pMode.value = preset?.blockMode ?? "allowlist";
  els.pSites.value = (preset?.sites ?? []).join(", ");
  els.pApps.value  = (preset?.apps ?? []).join(", ");
  els.pUrl.value   = preset?.autoOpenUrl ?? "";
  updateSitesLabel();
  els.presetEditor.classList.add("open");
  els.pName.focus();
}

function closePresetEditor() {
  editingPresetId = null;
  els.presetEditor.classList.remove("open");
}

function updateSitesLabel() {
  els.pSitesLabel.textContent = els.pMode.value === "allowlist" ? "Allowed sites" : "Blocked sites";
}

async function savePreset() {
  const name = els.pName.value.trim();
  if (!name) { els.pName.focus(); return; }
  const preset = {
    id:          editingPresetId ?? `p_${Date.now()}`,
    name,
    blockMode:   els.pMode.value,
    sites:       splitList(els.pSites.value).map(normalizeDomain).filter(Boolean),
    apps:        splitList(els.pApps.value),
    autoOpenUrl: els.pUrl.value.trim(),
  };
  await sendMsg({ type: "SAVE_PRESET", preset });
  closePresetEditor();
  const state = await sendMsg({ type: "GET_STATE" });
  renderPresetList(state.presets ?? []);
  renderPresetSelect(state.presets ?? [], state.activePresetId);
}

async function deletePreset(id) {
  await sendMsg({ type: "DELETE_PRESET", id });
  const state = await sendMsg({ type: "GET_STATE" });
  renderPresetList(state.presets ?? []);
  renderPresetSelect(state.presets ?? [], state.activePresetId);
}

// ── Heatmap ──────────────────────────────────────────────────────────────────

function heatColor(minutes) {
  if (!minutes)     return "#1e1e35";
  if (minutes < 25) return "#4a1a2a";
  if (minutes < 50) return "#8a2535";
  if (minutes < 100) return "#c03040";
  return "#e74c3c";
}

function renderHeatmap(focusHistory) {
  const today       = new Date();
  const dow         = today.getDay(); // 0=Sun
  const fromMonday  = (dow + 6) % 7;   // days since last Monday
  const start       = new Date(today);
  start.setDate(today.getDate() - fromMonday - 28); // 4 full weeks back to Monday

  els.hmapGrid.innerHTML = "";
  for (let i = 0; i < 35; i++) {
    const d    = new Date(start);
    d.setDate(start.getDate() + i);
    const key  = d.toISOString().slice(0, 10);
    const mins = focusHistory?.[key] ?? 0;
    const cell = document.createElement("div");
    cell.className    = "hcell";
    cell.style.background = heatColor(mins);
    cell.title        = `${key}: ${mins} min focused`;
    els.hmapGrid.appendChild(cell);
  }
}

// ── Goal mode ─────────────────────────────────────────────────────────────────

function calculateGoal(totalMin, workMin, breakMin) {
  // No break after the last session, so:
  // (cycles - 1) × (work + break) + lastWork = total
  const cycleTime = workMin + breakMin;
  const cycles    = Math.max(1, Math.floor((totalMin - workMin) / cycleTime) + 1);
  const lastWork  = totalMin - (cycles - 1) * cycleTime;
  return { cycles, lastWork, cycleTime };
}

function updateGoalPreview() {
  if (!els.goalEnabled.checked) {
    els.goalPreview.classList.remove("visible");
    return;
  }
  const totalMin = parseInt(els.goalMinutes.value, 10) || 60;
  const workMin  = parseInt(els.setWork.value,     10) || 25;
  const breakMin = parseInt(els.setBreak.value,    10) || 5;
  const { cycles, lastWork } = calculateGoal(totalMin, workMin, breakMin);

  // No break after the final session
  const actualTotal = (cycles - 1) * (workMin + breakMin) + lastWork;
  let text;
  if (cycles === 1) {
    text = `1 session of ${lastWork}min (no break at end) = ${actualTotal} min`;
  } else if (lastWork !== workMin) {
    text = `${cycles - 1} × ${workMin}min + ${breakMin}min break, then ${lastWork}min = ${actualTotal} min`;
  } else {
    text = `${cycles - 1} × ${workMin}min + ${breakMin}min break, then ${lastWork}min = ${actualTotal} min`;
  }

  els.goalPreview.textContent = text;
  els.goalPreview.classList.add("visible");
}

function renderGoalProgress(state, settings) {
  const active = state.goalActive || (state.goalCycles > 0 && state.goalCyclesLeft > 0);
  const inSession = state.phase !== "idle";

  els.goalSection.style.display   = inSession ? "none" : "block";
  els.goalProgress.classList.toggle("visible", active && inSession);

  if (active && inSession) {
    const done  = (state.goalCycles ?? 0) - (state.goalCyclesLeft ?? 0);
    const total = state.goalCycles ?? 0;
    const pct   = total > 0 ? (done / total) * 100 : 0;
    els.goalProgressText.textContent = `Session ${done + 1} of ${total}`;
    els.goalProgressMins.textContent  = `${(settings?.workMin ?? 25) * total} min goal`;
    els.goalBarFill.style.width       = `${pct}%`;
  }
}

// ── Block mode ────────────────────────────────────────────────────────────────

let currentBlockMode = "blacklist";

function applyBlockMode(mode) {
  currentBlockMode = mode;
  const isAllow = mode === "allowlist";

  els.modeBlacklistBtn.classList.toggle("active", !isAllow);
  els.modeAllowlistBtn.classList.toggle("active",  isAllow);
  els.modeBlacklistDesc.classList.toggle("visible", !isAllow);
  els.modeAllowlistDesc.classList.toggle("visible",  isAllow);

  // In allowlist mode, hide the blacklist panel (it's unused)
  els.blacklistPanel.style.display = isAllow ? "none" : "block";

  // Rename "Always allowed" → "Allowed sites" in allowlist mode
  els.whitelistTitle.textContent = isAllow ? "Allowed sites" : "Always allowed";
  els.whitelistTitle.style.color = isAllow ? "#2ecc71" : "#2ecc71";
  els.whitelistHint.textContent  = isAllow
    ? "Only these sites are accessible during a session. Everything else is blocked."
    : "Exceptions — overrides blocked sites (e.g. music.youtube.com).";
}

// ── Settings ─────────────────────────────────────────────────────────────────

function updateDurationPill(settings) {
  const s = settings ?? {};
  const w = s.workMin  ?? 25;
  const b = s.breakMin ?? 5;
  els.durationPill.textContent = `${w} min · ${b} min break`;
}

function loadSettingsIntoForm(settings) {
  els.setWork.value           = settings.workMin        ?? 25;
  els.setBreak.value          = settings.breakMin       ?? 5;
  els.setLongBreak.value      = settings.longBreakMin   ?? 15;
  els.setLongBreakAfter.value = settings.longBreakAfter ?? 4;
  els.setAutoStart.checked    = settings.autoStart      ?? false;
  els.setStrictMode.checked   = settings.strictMode     ?? false;
  els.setSoundType.value      = settings.soundType      ?? "off";
  els.setSoundVolume.value    = settings.soundVolume    ?? 0.4;
  els.volumeRow.style.display = (settings.soundType && settings.soundType !== "off") ? "flex" : "none";
  applyBlockMode(settings.blockMode ?? "blacklist");
  updateDurationPill(settings);
}

function buildCurrentSettings() {
  return {
    workMin:        Math.max(1, parseInt(els.setWork.value, 10)           || 25),
    breakMin:       Math.max(1, parseInt(els.setBreak.value, 10)          || 5),
    longBreakMin:   Math.max(1, parseInt(els.setLongBreak.value, 10)      || 15),
    longBreakAfter: Math.max(2, parseInt(els.setLongBreakAfter.value, 10) || 4),
    autoStart:      els.setAutoStart.checked,
    strictMode:     els.setStrictMode.checked,
    soundType:      els.setSoundType.value,
    soundVolume:    parseFloat(els.setSoundVolume.value),
    blockMode:      currentBlockMode,
  };
}

// ── Today's session counter ───────────────────────────────────────────────────

async function loadTodaySessions() {
  const today = new Date().toISOString().slice(0, 10);
  const data  = await chrome.storage.local.get(["todaySessions", "sessionDate"]);
  if (data.sessionDate !== today) {
    await chrome.storage.local.set({ todaySessions: 0, sessionDate: today });
    els.sessionsCount.textContent = "0";
  } else {
    els.sessionsCount.textContent = data.todaySessions ?? 0;
  }
}

async function incrementTodaySessions() {
  const today = new Date().toISOString().slice(0, 10);
  const data  = await chrome.storage.local.get(["todaySessions", "sessionDate"]);
  const base  = data.sessionDate === today ? (data.todaySessions ?? 0) : 0;
  const next  = base + 1;
  await chrome.storage.local.set({ todaySessions: next, sessionDate: today });
  els.sessionsCount.textContent = next;
}

// ── Tick ─────────────────────────────────────────────────────────────────────

function startTick() {
  stopTick();
  tickInterval = setInterval(async () => {
    const state = await sendMsg({ type: "GET_STATE" });
    renderState(state);
    syncAmbient(state);
    if (state.phase === "idle") stopTick();
  }, 1000);
}

function stopTick() {
  if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
}

// ── Event listeners ───────────────────────────────────────────────────────────

els.btnStart.addEventListener("click", async () => {
  const task = els.taskInput.value.trim();
  if (task) await sendMsg({ type: "SET_TASK", task });

  // Configure goal before starting
  if (els.goalEnabled.checked) {
    const totalMin = parseInt(els.goalMinutes.value, 10) || 60;
    const workMin  = parseInt(els.setWork.value, 10)     || 25;
    const breakMin = parseInt(els.setBreak.value, 10)    || 5;
    await sendMsg({ type: "SET_GOAL", active: true, totalMin, workMin, breakMin });
  } else {
    await sendMsg({ type: "SET_GOAL", active: false });
  }

  await sendMsg({ type: "START_WORK" });
  await incrementTodaySessions();
  const state = await sendMsg({ type: "GET_STATE" });
  renderState(state);
  syncAmbient(state);
  startTick();
});

els.btnBreak.addEventListener("click", async () => {
  await sendMsg({ type: "START_BREAK" });
  const state = await sendMsg({ type: "GET_STATE" });
  renderState(state);
  syncAmbient(state); // mutes ambient now that we're on break
  currentSuggestionIdx = Math.floor(Math.random() * BREAK_SUGGESTIONS.length);
  showSuggestion(currentSuggestionIdx);
  startTick();
});

els.btnStop.addEventListener("click", async () => {
  const state    = await sendMsg({ type: "GET_STATE" });
  const settings = state.settings ?? {};

  if (settings.strictMode && state.phase === "work") {
    strictClicks++;
    playStopSound(strictClicks);
    const left = 10 - strictClicks;
    if (left > 0) {
      els.btnStop.textContent = `■ Stop (${left} more)`;
      els.btnStop.classList.add("counting");
      els.btnStop.classList.add("shake");
      setTimeout(() => els.btnStop.classList.remove("shake"), 260);
    } else {
      showReasonForm();
    }
    return;
  }

  stopSound(); ambientOn = false;
  await sendMsg({ type: "STOP" });
  stopTick();
  const fresh = await sendMsg({ type: "GET_STATE" });
  renderState({ ...fresh, phase: "idle", endTime: null });
});

els.confirmAbandon.addEventListener("click", async () => {
  const reason = els.reasonInput.value.trim() || "No reason given";
  stopSound(); ambientOn = false;
  await sendMsg({ type: "STOP_WITH_REASON", reason });
  hideReasonForm();
  stopTick();
  els.reasonInput.value = "";
  const state = await sendMsg({ type: "GET_STATE" });
  renderState({ ...state, phase: "idle", endTime: null });
});

els.cancelReason.addEventListener("click", () => {
  hideReasonForm();
  strictClicks = 0;
});

els.breakNextBtn.addEventListener("click", () => {
  currentSuggestionIdx = (currentSuggestionIdx + 1) % BREAK_SUGGESTIONS.length;
  showSuggestion(currentSuggestionIdx);
});

els.btnFinish.addEventListener("click", async () => {
  await sendMsg({ type: "FINISH" });
  stopSound(); ambientOn = false;
  stopTick();
  strictClicks = 0;
  hideReasonForm();
  els.reasonInput.value = "";
  els.taskInput.value   = "";
  els.goalEnabled.checked = false;
  updateGoalPreview();
  const state = await sendMsg({ type: "GET_STATE" });
  renderState({ ...state, phase: "idle", endTime: null, round: 0, goalActive: false });
});

els.addSiteBtn.addEventListener("click",  addSite);
els.siteInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addSite(); });
els.blacklist.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove");
  if (btn && !btn.disabled) removeSite(btn.dataset.domain);
});

els.addWhiteBtn.addEventListener("click",  addWhiteSite);
els.whiteInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addWhiteSite(); });
els.whitelist.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove-white");
  if (btn && !btn.disabled) removeWhiteSite(btn.dataset.domain);
});

els.addAppBtn.addEventListener("click",  addApp);
els.appInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addApp(); });
els.appslist.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove-app");
  if (btn) removeApp(btn.dataset.app);
});

els.settingsToggle.addEventListener("click", () => {
  els.settingsPanel.classList.toggle("open");
});

els.setSoundType.addEventListener("change", () => {
  els.volumeRow.style.display = els.setSoundType.value !== "off" ? "flex" : "none";
});

els.setSoundVolume.addEventListener("input", () => {
  setVolume(parseFloat(els.setSoundVolume.value));
});

els.saveSettings.addEventListener("click", async () => {
  const settings = {
    workMin:        Math.max(1, parseInt(els.setWork.value, 10)           || 25),
    breakMin:       Math.max(1, parseInt(els.setBreak.value, 10)          || 5),
    longBreakMin:   Math.max(1, parseInt(els.setLongBreak.value, 10)      || 15),
    longBreakAfter: Math.max(2, parseInt(els.setLongBreakAfter.value, 10) || 4),
    autoStart:      els.setAutoStart.checked,
    strictMode:     els.setStrictMode.checked,
    soundType:      els.setSoundType.value,
    soundVolume:    parseFloat(els.setSoundVolume.value),
    blockMode:      currentBlockMode,
  };
  await sendMsg({ type: "UPDATE_SETTINGS", settings });

  const state = await sendMsg({ type: "GET_STATE" });
  if (state.phase === "idle") els.timerDisplay.textContent = formatTime(settings.workMin * 60);

  updateDurationPill(settings);
  updateGoalPreview();
  els.savedMsg.textContent = "Saved ✓";
  setTimeout(() => { els.savedMsg.textContent = ""; }, 1800);
});

els.heatmapToggle.addEventListener("click", () => {
  els.heatmapToggle.classList.toggle("open");
  els.heatmapBody.classList.toggle("open");
});

// Preset listeners
els.presetSelect.addEventListener("change", async () => {
  const id = els.presetSelect.value || null;
  await sendMsg({ type: "SET_ACTIVE_PRESET", id });
  const state = await sendMsg({ type: "GET_STATE" });
  updatePresetHint(state.presets ?? [], state.activePresetId);
});

els.managePresetsBtn.addEventListener("click", () => {
  els.presetsToggle.classList.add("open");
  els.presetsBody.classList.add("open");
  els.presetsBody.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

els.presetsToggle.addEventListener("click", () => {
  els.presetsToggle.classList.toggle("open");
  els.presetsBody.classList.toggle("open");
});

els.newPresetBtn.addEventListener("click", () => openPresetEditor(null));
els.pCancel.addEventListener("click", closePresetEditor);
els.pSave.addEventListener("click", savePreset);
els.pMode.addEventListener("change", updateSitesLabel);

els.presetList.addEventListener("click", async (e) => {
  const editBtn = e.target.closest(".pli-edit");
  const delBtn  = e.target.closest(".pli-delete");
  if (editBtn) {
    const state  = await sendMsg({ type: "GET_STATE" });
    const preset = (state.presets ?? []).find((p) => p.id === editBtn.dataset.id);
    if (preset) openPresetEditor(preset);
  } else if (delBtn) {
    deletePreset(delBtn.dataset.id);
  }
});

// Goal listeners
async function refreshDots() {
  const state = await sendMsg({ type: "GET_STATE" });
  renderDots(state, state.settings ?? {});
}
function onGoalInput() { updateGoalPreview(); refreshDots(); }

els.goalEnabled.addEventListener("change", onGoalInput);
els.goalMinutes.addEventListener("input",  onGoalInput);
// Also update preview when work/break durations change in settings
els.setWork.addEventListener("input",  onGoalInput);
els.setBreak.addEventListener("input", onGoalInput);

// Mode pill listeners
els.modeBlacklistBtn.addEventListener("click", () => {
  applyBlockMode("blacklist");
  sendMsg({ type: "UPDATE_SETTINGS", settings: { ...buildCurrentSettings(), blockMode: "blacklist" } });
});
els.modeAllowlistBtn.addEventListener("click", () => {
  applyBlockMode("allowlist");
  sendMsg({ type: "UPDATE_SETTINGS", settings: { ...buildCurrentSettings(), blockMode: "allowlist" } });
});

// Click pill to open settings
document.getElementById("durationPill").addEventListener("click", () => {
  els.settingsPanel.classList.add("open");
});

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  const state = await sendMsg({ type: "GET_STATE" });
  renderState(state);
  renderBlacklist(state.blacklist  ?? []);
  renderWhitelist(state.whitelist  ?? []);
  renderApps(state.blockedApps     ?? []);
  renderPresetSelect(state.presets ?? [], state.activePresetId);
  renderPresetList(state.presets   ?? []);
  loadSettingsIntoForm(state.settings ?? {});
  renderHeatmap(state.focusHistory ?? {});
  showSuggestion(currentSuggestionIdx);
  await loadTodaySessions();

  // Restore task input value
  if (state.currentTask) els.taskInput.value = state.currentTask;

  // Restore goal toggle if a goal was active
  if (state.goalActive && state.goalCycles > 0) {
    els.goalEnabled.checked = true;
    updateGoalPreview();
    renderDots(state, state.settings ?? {});
  }

  // Resume ambient only if we're mid-work (muted during breaks)
  syncAmbient(state);

  if (state.phase !== "idle") startTick();

  // Stop sound when popup closes
  window.addEventListener("unload", stopSound);
})();

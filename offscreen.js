chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== "offscreen") return;
  if (msg.type === "PLAY_PING") playPing(msg.volume ?? 0.35);
  if (msg.type === "PLAY_DING") playDing(msg.volume ?? 0.4);
});

// Two-note "ding ding" — played when a break starts
function playDing(volume) {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);

  // Two ascending notes: C6 then E6
  const notes = [
    { freq: 1046.5, at: 0.0 },
    { freq: 1318.5, at: 0.18 },
  ];

  notes.forEach(({ freq, at }) => {
    const t = ctx.currentTime + at;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.6, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.5);
  });

  setTimeout(() => ctx.close(), 1200);
}

function playPing(volume) {
  const ctx  = new AudioContext();
  const now  = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);

  // Two harmonics for a soft bell tone
  [[880, 1.0], [1320, 0.4], [440, 0.25]].forEach(([freq, rel], i) => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(rel * 0.5, now + i * 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now + i * 0.01);
    osc.stop(now + 2.0);
  });

  setTimeout(() => ctx.close(), 2500);
}

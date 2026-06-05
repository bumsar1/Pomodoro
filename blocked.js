/* ── 1. QUOTES — runs synchronously ──────────────────────────────────────── */
const QUOTES = [
  { q: "The successful warrior is the average man, with laser-like focus.", a: "Bruce Lee" },
  { q: "Concentrate all your thoughts upon the work at hand.", a: "Alexander Graham Bell" },
  { q: "Deep work is the superpower of the 21st century.", a: "Cal Newport" },
  { q: "Lost time is never found again.", a: "Benjamin Franklin" },
  { q: "Until we can manage time, we can manage nothing else.", a: "Peter Drucker" },
  { q: "Whether you think you can or think you can't, you're right.", a: "Henry Ford" },
  { q: "Believe you can and you're halfway there.", a: "Theodore Roosevelt" },
  { q: "Doubt kills more dreams than failure ever will.", a: "Suzy Kassem" },
  { q: "The best way to get started is to quit talking and begin doing.", a: "Walt Disney" },
  { q: "You don't have to be great to start, but you have to start to be great.", a: "Zig Ziglar" },
  { q: "The bad news is time flies. The good news is you're the pilot.", a: "Michael Altshuler" },
  { q: "Don't count the days. Make the days count.", a: "Muhammad Ali" },
  { q: "Success is not final, failure is not fatal: it is the courage to continue that counts.", a: "Winston Churchill" },
  { q: "I have not failed. I've just found 10,000 ways that won't work.", a: "Thomas Edison" },
  { q: "The only way to do great work is to love what you do.", a: "Steve Jobs" },
  { q: "May your choices reflect your hopes, not your fears.", a: "Nelson Mandela" },
  { q: "Nothing great was ever achieved without enthusiasm.", a: "Ralph Waldo Emerson" },
  { q: "The happiness of your life depends on the quality of your thoughts.", a: "Marcus Aurelius" },
  { q: "Everything you've ever wanted is on the other side of fear.", a: "George Addair" },
  { q: "Do what you can with all you have, wherever you are.", a: "Theodore Roosevelt" },
  { q: "All our dreams can come true, if we have the courage to pursue them.", a: "Walt Disney" },
  { q: "Our greatest glory is not in never failing, but in rising every time we fall.", a: "Ralph Waldo Emerson" },
  { q: "Don't let yesterday take up too much of today.", a: "Will Rogers" },
];

const idx  = Math.floor(Date.now() / 30000) % QUOTES.length;
const pick = QUOTES[idx];
document.getElementById("quote").innerHTML =
  `"${pick.q}" <span class="attr">— ${pick.a}</span>`;

/* ── 2. Back button ───────────────────────────────────────────────────────── */
document.getElementById("backBtn").addEventListener("click", () => history.back());

/* ── 3. Timer + task label ────────────────────────────────────────────────── */
function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

async function tick() {
  try {
    const data = await chrome.storage.local.get(["phase", "endTime"]);
    const el   = document.getElementById("timer");
    const lbl  = document.getElementById("timerLabel");

    if (data.phase === "work" && data.endTime && data.endTime > Date.now()) {
      const left = data.endTime - Date.now();
      el.textContent  = fmt(left);
      el.className    = "timer" + (left < 60000 ? " ending" : "");
      lbl.textContent = "remaining in session";
    } else {
      el.textContent  = "–";
      el.className    = "timer";
      lbl.textContent = "no active session — open the extension to start";
    }
  } catch (e) {
    document.getElementById("timer").textContent = "–";
  }
}

async function loadTask() {
  try {
    const data = await chrome.storage.local.get("currentTask");
    if (data.currentTask) {
      const el = document.getElementById("currentTask");
      el.textContent = "📌 " + data.currentTask;
      el.style.display = "inline-block";
    }
  } catch (_) {}
}

tick();
loadTask();
setInterval(tick, 1000);

#!/usr/bin/env python3
"""
Pomodoro Blocker — native messaging host (macOS proof-of-concept).

Receives session state from the Chrome extension over stdin/stdout and
quits blocked applications while a focus session is active.

Protocol (Chrome Native Messaging):
  - Each message is a 4-byte little-endian length prefix + UTF-8 JSON.
  - Incoming:  {"type": "SESSION", "phase": "work"|"break"|"idle", "apps": ["Discord", ...]}
  - Outgoing:  {"ok": true, "killed": [...]}  (for debugging / round-trip proof)
"""

import sys
import json
import struct
import subprocess
import threading
import time

LOG_PATH = "/tmp/pomodoro_host.log"

# Shared session state, updated by the reader thread, read by the monitor thread.
state = {"phase": "idle", "apps": [], "open_apps": [], "last_phase": "idle"}
state_lock = threading.Lock()


def log(msg):
    try:
        with open(LOG_PATH, "a") as f:
            f.write(f"{time.strftime('%H:%M:%S')}  {msg}\n")
    except Exception:
        pass


# ── Native messaging I/O ──────────────────────────────────────────────────────

def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) < 4:
        return None  # stdin closed → Chrome disconnected
    length = struct.unpack("<I", raw_length)[0]
    data = sys.stdin.buffer.read(length).decode("utf-8")
    return json.loads(data)


write_lock = threading.Lock()

def send_message(obj):
    encoded = json.dumps(obj).encode("utf-8")
    with write_lock:
        sys.stdout.buffer.write(struct.pack("<I", len(encoded)))
        sys.stdout.buffer.write(encoded)
        sys.stdout.buffer.flush()


# ── External command file (Raycast etc.) ──────────────────────────────────────
# Anything that writes an action ("focus" / "break" / "stop" / "toggle") to this
# file triggers the extension. The host reads it, clears it, and forwards it.
CMD_PATH      = "/tmp/pomodoro_cmd"
PRESETS_PATH  = "/tmp/pomodoro_presets.json"

def read_command():
    """Returns (action, preset) or (None, None). Command format: 'focus' or 'focus:Preset Name'."""
    try:
        with open(CMD_PATH, "r") as f:
            raw = f.read().strip()
        if raw:
            open(CMD_PATH, "w").close()  # clear it
            if ":" in raw:
                action, preset = raw.split(":", 1)
                return action.strip().lower(), preset.strip()
            return raw.lower(), None
    except FileNotFoundError:
        pass
    except Exception as e:
        log(f"read_command error: {e}")
    return None, None


# ── App control ───────────────────────────────────────────────────────────────
#
# We use `pkill` rather than AppleScript/System Events because:
#   - it needs NO Automation permission (no macOS prompt, no timeouts)
#   - it never accidentally *launches* an app that isn't running
#   - it's fast and reliable

def is_running(name):
    """True if a process with this exact name is running."""
    try:
        r = subprocess.run(["pgrep", "-x", name], capture_output=True, timeout=3)
        return r.returncode == 0
    except Exception as e:
        log(f"pgrep {name} error: {e}")
        return False


# Alarm sound played when a blocked app is caught and quit.
ALARM_SOUND = "/System/Library/Sounds/Basso.aiff"


def play_alarm():
    """Play the macOS alarm sound (non-blocking)."""
    try:
        subprocess.Popen(["afplay", ALARM_SOUND])
    except Exception as e:
        log(f"alarm error: {e}")


def quit_app(name):
    """Force-quit an app by exact process name. Returns True if it was running."""
    try:
        r = subprocess.run(["pkill", "-x", name], capture_output=True, timeout=3)
        if r.returncode == 0:
            log(f"killed {name}")
            return True
        return False
    except Exception as e:
        log(f"kill {name} error: {e}")
        return False


def open_app(name):
    """Launch (or focus) an app by name. Works with the .app display name."""
    try:
        subprocess.run(["open", "-a", name], capture_output=True, timeout=5)
        log(f"opened {name}")
    except Exception as e:
        log(f"open {name} error: {e}")


def enforce():
    """Quit any blocked apps that are currently running. Returns names killed."""
    with state_lock:
        phase = state["phase"]
        apps  = list(state["apps"])
    if phase != "work" or not apps:
        return []
    killed = []
    for app in apps:
        if quit_app(app):
            killed.append(app)
    if killed:
        play_alarm()
    return killed


# ── Background monitor ─────────────────────────────────────────────────────────
# Runs every second:
#   - checks the command file and forwards any action to the extension
#   - every 3s, re-quits blocked apps that were reopened
#   - every 20s, sends a heartbeat to keep the extension's worker alive

def monitor_loop():
    tick = 0
    # Clear any stale command left over from a previous run
    try: open(CMD_PATH, "w").close()
    except Exception: pass

    while True:
        try:
            action, preset = read_command()
            if action:
                log(f"command → {action} preset={preset}")
                msg = {"type": "COMMAND", "action": action}
                if preset is not None:
                    msg["preset"] = preset
                send_message(msg)

            if tick % 3 == 0:
                enforce()

            if tick % 20 == 0:
                send_message({"type": "HEARTBEAT"})
        except Exception as e:
            log(f"monitor error: {e}")
        tick += 1
        time.sleep(1)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    log("host started")
    threading.Thread(target=monitor_loop, daemon=True).start()

    while True:
        try:
            msg = read_message()
        except Exception as e:
            log(f"read error: {e}")
            break
        if msg is None:
            log("stdin closed, exiting")
            break

        if msg.get("type") == "SESSION":
            new_phase = msg.get("phase", "idle")
            with state_lock:
                prev = state["last_phase"]
                state["phase"]     = new_phase
                state["apps"]      = msg.get("apps", [])
                state["open_apps"] = msg.get("openApps", [])
                state["last_phase"] = new_phase
                to_open = list(state["open_apps"])
            # Open apps only on the transition INTO work (not on every keep-alive tick)
            if new_phase == "work" and prev != "work":
                for app in to_open:
                    open_app(app)
            log(f"session → {new_phase} apps={msg.get('apps', [])} open={msg.get('openApps', [])}")
            killed = enforce()
            send_message({"ok": True, "phase": new_phase, "killed": killed})

        elif msg.get("type") == "PRESETS":
            # Persist the preset list so external tools (Raycast generator) can read it
            try:
                with open(PRESETS_PATH, "w") as f:
                    json.dump(msg.get("presets", []), f)
                log(f"presets saved ({len(msg.get('presets', []))})")
            except Exception as e:
                log(f"presets write error: {e}")


if __name__ == "__main__":
    main()

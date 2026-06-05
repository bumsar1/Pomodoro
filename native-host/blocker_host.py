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
state = {"phase": "idle", "apps": []}
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


def send_message(obj):
    encoded = json.dumps(obj).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


# ── App control ───────────────────────────────────────────────────────────────

def running_apps():
    """Return the list of visible (non-background) app names currently running."""
    try:
        out = subprocess.check_output(
            ["osascript", "-e",
             'tell application "System Events" to get name of '
             '(every process whose background only is false)'],
            text=True, stderr=subprocess.DEVNULL, timeout=5,
        )
        return [a.strip() for a in out.split(",")]
    except Exception as e:
        log(f"running_apps error: {e}")
        return []


def quit_app(name):
    """Gracefully tell an app to quit (only call for apps known to be running)."""
    try:
        subprocess.run(
            ["osascript", "-e", f'tell application "{name}" to quit'],
            capture_output=True, timeout=5,
        )
        log(f"quit {name}")
        return True
    except Exception as e:
        log(f"quit {name} error: {e}")
        return False


def enforce():
    """Quit any blocked apps that are currently running. Returns names killed."""
    with state_lock:
        phase = state["phase"]
        apps  = list(state["apps"])
    if phase != "work" or not apps:
        return []
    running = running_apps()
    killed = []
    for app in apps:
        if app in running and quit_app(app):
            killed.append(app)
    return killed


# ── Background monitor — re-quits apps that get reopened mid-session ───────────

def monitor_loop():
    while True:
        try:
            enforce()
        except Exception as e:
            log(f"monitor error: {e}")
        time.sleep(3)


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
            with state_lock:
                state["phase"] = msg.get("phase", "idle")
                state["apps"]  = msg.get("apps", [])
            log(f"session → {state['phase']} apps={state['apps']}")
            killed = enforce()
            send_message({"ok": True, "phase": state["phase"], "killed": killed})


if __name__ == "__main__":
    main()

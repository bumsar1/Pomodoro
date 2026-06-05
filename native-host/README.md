# Native host — macOS app blocking (proof-of-concept)

This lets the Chrome extension quit macOS apps (e.g. Discord, Steam) while a
focus session is running. It uses Chrome's **Native Messaging** API to bridge
the extension and a small Python helper.

```
Extension (background.js) ⇄ Native Messaging ⇄ blocker_host.py ⇄ osascript "quit app"
```

## Setup (one time)

1. **Load the extension** at `chrome://extensions` (Developer mode → Load unpacked).
2. **Copy your extension ID** — shown under the Pomodoro Blocker card.
3. **Run the installer** with that ID:

   ```bash
   cd native-host
   ./install.sh <EXTENSION_ID>
   ```

   This writes the native messaging manifest to
   `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` pointing
   at `blocker_host.py`.

4. **Fully quit and reopen Chrome** (⌘Q — not just the window).

## Usage

1. In the popup, under **Blocked apps (Mac)**, add an app by its exact name
   (e.g. `Discord`, `Spotify`, `Steam`).
2. Start a focus session.
3. The helper quits those apps immediately and re-quits them every ~3 seconds
   if you reopen them — until the session ends.

## Debugging

```bash
tail -f /tmp/pomodoro_host.log
```

You should see `host started`, then `session → work apps=[...]` and `quit Discord`
lines when a session begins.

## Notes / limitations (it's a POC)

- **Graceful quit**: apps with unsaved work may show a save prompt.
- Requires Python 3 (preinstalled path `/usr/bin/env python3`).
- The first time the helper runs, macOS may ask to allow it to control
  System Events / other apps (Automation permission) — click **OK**.
- Blocking is one-way (quit). It does not prevent launching at the OS level;
  it just keeps quitting blocked apps while you're in a focus session.

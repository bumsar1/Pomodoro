# Raycast integration

Trigger the Pomodoro timer from Raycast — start a focus session, take a break,
or stop, without touching the browser.

## How it works

```
Raycast script  →  writes /tmp/pomodoro_cmd  →  native host forwards it  →  extension acts
```

The native host (see [`../native-host/`](../native-host/)) polls the command
file once a second and pushes the action to the extension over the native
messaging port. The extension keeps that port open, which also keeps its
service worker awake so commands are picked up instantly.

## Setup

1. Make sure the **native host is installed** (`../native-host/install.sh`) and
   the extension is loaded — the same setup used for app blocking.
2. In Raycast: **Settings → Extensions → Script Commands → Add Directories**,
   and choose this `raycast/` folder.
3. The commands appear in Raycast:
   - **Pomodoro — Start Focus**
   - **Pomodoro — Take Break**
   - **Pomodoro — Stop**
4. (Optional) Assign each a hotkey or alias in Raycast for one-keystroke access.

## Notes

- The browser must be open (the extension does the website blocking).
- "Start Focus" uses your currently selected preset, just like pressing Focus
  in the popup.
- If a command doesn't register, check the host log: `tail -f /tmp/pomodoro_host.log`

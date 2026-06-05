#!/bin/bash
#
# Installs the Pomodoro Blocker native messaging host for Chrome on macOS.
#
# Usage:
#   ./install.sh <EXTENSION_ID>
#
# Find your extension ID at chrome://extensions  (with Developer mode on,
# it's shown under the Pomodoro Blocker card, e.g. "abcdefghijklmnop...").

set -e

if [ -z "$1" ]; then
  echo "❌  Missing extension ID."
  echo "    Usage: ./install.sh <EXTENSION_ID>"
  echo "    Get it from chrome://extensions (Developer mode → under Pomodoro Blocker)."
  exit 1
fi

EXT_ID="$1"
HOST_NAME="com.pomodoro.blocker"

# Absolute path to this script's directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_PATH="$DIR/blocker_host.py"

# Make the host executable
chmod +x "$HOST_PATH"

# Native messaging host directories for all Chromium-based browsers on macOS.
# We install to every one that exists so it works regardless of your browser.
SUPPORT="$HOME/Library/Application Support"
BROWSER_DIRS=(
  "$SUPPORT/Google/Chrome/NativeMessagingHosts"
  "$SUPPORT/Google/Chrome Beta/NativeMessagingHosts"
  "$SUPPORT/Google/Chrome Canary/NativeMessagingHosts"
  "$SUPPORT/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  "$SUPPORT/Chromium/NativeMessagingHosts"
  "$SUPPORT/Microsoft Edge/NativeMessagingHosts"
)

MANIFEST=$(cat <<EOF
{
  "name": "$HOST_NAME",
  "description": "Pomodoro Blocker native host — quits blocked apps during focus",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXT_ID/"
  ]
}
EOF
)

INSTALLED=0
for DIR in "${BROWSER_DIRS[@]}"; do
  # Only install to browsers that are actually present
  PARENT="$(dirname "$DIR")"
  if [ -d "$PARENT" ]; then
    mkdir -p "$DIR"
    echo "$MANIFEST" > "$DIR/$HOST_NAME.json"
    echo "  ✓ $DIR/$HOST_NAME.json"
    INSTALLED=$((INSTALLED + 1))
  fi
done

echo ""
if [ "$INSTALLED" -eq 0 ]; then
  echo "⚠️  No supported browser found. Manifest not installed anywhere."
  exit 1
fi
echo "✅  Installed native host to $INSTALLED browser(s)"
echo "    host     : $HOST_PATH"
echo "    extension: $EXT_ID"
echo ""
echo "Now FULLY quit and reopen your browser (Cmd+Q), then start a focus session."
echo "Debug log: tail -f /tmp/pomodoro_host.log"

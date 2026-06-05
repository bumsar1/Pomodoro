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

# Chrome's native messaging host directory on macOS
TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$TARGET_DIR"

# Write the manifest
cat > "$TARGET_DIR/$HOST_NAME.json" <<EOF
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

echo "✅  Installed native host:"
echo "    manifest : $TARGET_DIR/$HOST_NAME.json"
echo "    host     : $HOST_PATH"
echo "    extension: $EXT_ID"
echo ""
echo "Now fully quit and reopen Chrome, then start a focus session."
echo "Debug log: tail -f /tmp/pomodoro_host.log"

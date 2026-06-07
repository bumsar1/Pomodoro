#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Pomodoro — Focus with Preset
# @raycast.mode silent
# @raycast.packageName Pomodoro Blocker
# @raycast.icon 🍅
# @raycast.description Start focus with a named preset (leave blank to use the current one)
# @raycast.argument1 { "type": "text", "placeholder": "preset name", "optional": true }

if [ -z "$1" ]; then
  echo "focus" > /tmp/pomodoro_cmd
  echo "🍅 Focus started (current preset)"
else
  echo "focus:$1" > /tmp/pomodoro_cmd
  echo "🍅 Focus started — $1"
fi

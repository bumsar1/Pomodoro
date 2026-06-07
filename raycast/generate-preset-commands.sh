#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Pomodoro — Regenerate Preset Commands
# @raycast.mode fullOutput
# @raycast.packageName Pomodoro Blocker
# @raycast.icon 🔄
# @raycast.description Create one Raycast command per Pomodoro preset

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRESETS="/tmp/pomodoro_presets.json"

if [ ! -f "$PRESETS" ]; then
  echo "⚠️  No presets file found at $PRESETS"
  echo "    Open the extension once (with the native host installed) so it can export your presets, then run this again."
  exit 1
fi

python3 - "$DIR" "$PRESETS" <<'PY'
import json, sys, os, re

dir_path, presets_path = sys.argv[1], sys.argv[2]

with open(presets_path) as f:
    presets = json.load(f)

# Remove previously generated per-preset scripts
for fn in os.listdir(dir_path):
    if fn.startswith("pomodoro-preset-") and fn.endswith(".sh"):
        os.remove(os.path.join(dir_path, fn))

if not presets:
    print("No presets to generate. Create some in the extension first.")
    sys.exit(0)

count = 0
for p in presets:
    name = p["name"]
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "preset"
    path = os.path.join(dir_path, f"pomodoro-preset-{slug}.sh")
    script = f"""#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title Pomodoro — {name}
# @raycast.mode silent
# @raycast.packageName Pomodoro Blocker
# @raycast.icon 🍅
# @raycast.description Start a focus session with the "{name}" preset

echo "focus:{name}" > /tmp/pomodoro_cmd
echo "🍅 Focus started — {name}"
"""
    with open(path, "w") as f:
        f.write(script)
    os.chmod(path, 0o755)
    count += 1
    print(f"  ✓ Pomodoro — {name}")

print(f"\nGenerated {count} preset command(s).")
print("Raycast will pick them up automatically (they're in the same folder).")
PY

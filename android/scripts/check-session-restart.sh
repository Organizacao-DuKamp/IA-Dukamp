#!/usr/bin/env bash
set -euo pipefail
app=br.com.tpecia.fazenda
runner="$app.test/androidx.test.runner.AndroidJUnitRunner"
for phase in prepare recoverAfterProcessDeath logout stayLoggedOut replaceSessionAndExpire; do
  adb shell am force-stop "$app"
  result=$(adb shell am instrument -w -r -e class "$app.PanelSessionRestartTest#$phase" "$runner")
  printf '%s\n' "$result"
  # am instrument can return exit code zero even when JUnit fails.
  [[ "$result" == *"OK (1 test)"* ]] || exit 1
done

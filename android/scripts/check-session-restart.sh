#!/usr/bin/env bash
set -euo pipefail
app=br.com.tpecia.fazenda
runner="$app.test/androidx.test.runner.AndroidJUnitRunner"
adb shell dumpsys webviewupdate
sdk=$(adb shell getprop ro.build.version.sdk | tr -d '\r')
phases=(prepare recoverAfterProcessDeath logout stayLoggedOut replaceSessionAndExpire)
# Stock API 28 has a WebView older than the app's required message-listener API.
if [[ "$sdk" == "28" ]]; then phases=(unsupportedWebViewIsBlocked); fi
for phase in "${phases[@]}"; do
  adb shell am force-stop "$app"
  result=$(adb shell am instrument -w -r -e class "$app.PanelSessionRestartTest#$phase" "$runner")
  printf '%s\n' "$result"
  # am instrument can return exit code zero even when JUnit fails.
  [[ "$result" == *"OK (1 test)"* ]] || exit 1
done

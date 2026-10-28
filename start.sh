#!/usr/bin/env bash
# Open the offline application. Node.js is only needed to rebuild missing output.
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
app_file="$project_dir/dist/web-audit-kit.html"

build=false
browser=''
safe_graphics=false
while (( $# )); do
  case "$1" in
    --help|-h)
      printf 'Web Audit Kit\nRun: bash start.sh\nRebuild from source: bash start.sh --build\nLinux browser override: bash start.sh --browser firefox\nLinux graphics workaround: bash start.sh --safe-graphics\nUse --browser chromium (or google-chrome) with --safe-graphics to select a Chromium browser.\nQuit that browser first so new graphics flags take effect.\nLinux/macOS: Bash. Windows: WSL or Git Bash.\n'
      exit 0 ;;
    --build) build=true; shift ;;
    --safe-graphics) safe_graphics=true; shift ;;
    --browser)
      if (( $# < 2 )) || [[ -z "$2" || "$2" == -* ]]; then
        printf 'Provide one browser executable after --browser, for example: --browser firefox\n' >&2
        exit 2
      fi
      browser="$2"; shift 2 ;;
    *) printf 'Unknown option: %s\nUse bash start.sh --help\n' "$1" >&2; exit 2 ;;
  esac
done

if [[ "$build" == true || ! -s "$app_file" ]]; then
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    printf 'The built app is missing, or a rebuild was requested.\nAsk the project provider for the dist folder, or install a supported Node.js version from https://nodejs.org and retry.\nThe ready-built app does not need Node.js.\n' >&2
    exit 1
  fi
  if ! node -e 'const [major,minor,patch]=process.versions.node.split(".").map(Number); process.exit((major===22 && (minor>22 || minor===22 && patch>=2) || major===24 && minor>=15 || major>=26) ? 0 : 1)'; then
    printf 'Rebuilding requires Node 22.22.2+ (22.x), 24.15+ (24.x), or 26+.\n' >&2
    exit 1
  fi
  cd -- "$project_dir"
  if [[ ! -d node_modules ]]; then
    printf 'Installing project dependencies. This step needs internet access.\n'
    npm ci --no-audit --no-fund
  fi
  printf 'Building Web Audit Kit...\n'
  npm run build
fi
if [[ ! -s "$app_file" ]]; then
  printf 'Build did not produce %s\n' "$app_file" >&2
  exit 1
fi
printf 'Application file (you can also open this from your browser):\n%s\n' "$app_file"
platform="$(uname -s)"
if [[ -n "$browser" || "$safe_graphics" == true ]]; then
  if [[ "$platform" != Linux ]]; then
    printf '%s\n' '--browser and --safe-graphics are for Linux desktop browsers. Use bash start.sh on this platform.' >&2
    exit 2
  fi
  if [[ "$safe_graphics" == true && -z "$browser" ]]; then
    for candidate in chromium chromium-browser google-chrome google-chrome-stable brave-browser microsoft-edge microsoft-edge-stable; do
      if command -v "$candidate" >/dev/null 2>&1; then browser="$candidate"; break; fi
    done
    if [[ -z "$browser" ]]; then
      printf 'No supported Chromium browser found. Try bash start.sh --browser firefox if Firefox is installed.\n' >&2
      exit 1
    fi
  fi
  if ! command -v "$browser" >/dev/null 2>&1; then
    printf 'Browser executable not found: %s\nUse an installed browser, for example: bash start.sh --browser firefox\n' "$browser" >&2
    exit 1
  fi
  opener=("$browser")
  if [[ "$safe_graphics" == true ]]; then
    case "${browser##*/}" in
      chromium|chromium-browser|google-chrome|google-chrome-stable|brave-browser|microsoft-edge|microsoft-edge-stable) ;;
      *) printf '%s\n' '--safe-graphics requires a supported Chromium browser; omit it for Firefox.' >&2; exit 2 ;;
    esac
    opener+=(--disable-gpu)
    if [[ -n "${DISPLAY:-}" ]]; then opener+=(--ozone-platform=x11); fi
    printf 'Graphics workaround: GPU acceleration disabled; X11 used when DISPLAY is available.\nQuit existing instances of this browser first so these flags take effect.\n'
  fi
  opener+=("$app_file")
elif [[ "$platform" == Darwin ]]; then
  opener=(open "$app_file")
elif [[ "$platform" == MINGW* || "$platform" == MSYS* || "$platform" == CYGWIN* ]]; then
  opener=(cmd.exe /c start '' "$(cygpath -w "$app_file")")
elif command -v wslview >/dev/null 2>&1; then
  opener=(wslview "$app_file")
elif command -v wslpath >/dev/null 2>&1 && command -v cmd.exe >/dev/null 2>&1; then
  opener=(cmd.exe /c start '' "$(wslpath -w "$app_file")")
elif command -v xdg-open >/dev/null 2>&1; then
  opener=(xdg-open "$app_file")
else
  printf 'No desktop browser opener found. Open this file in your browser:\n%s\n' "$app_file" >&2
  exit 1
fi
if [[ "$platform" == Linux && "${opener[0]}" != wslview && "${opener[0]}" != cmd.exe ]]; then
  if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
    printf 'No graphical desktop detected. Run this script from a terminal on your desktop.\nFor SSH, copy the project folder to your computer and open dist/web-audit-kit.html there.\n' >&2
    exit 1
  fi
  printf 'If no window opens, try: bash start.sh --browser firefox\nFor Chromium graphics errors, quit the browser and try: bash start.sh --safe-graphics\n'
fi
printf 'Opening Web Audit Kit. Choose Create a report, or Explore the example.\n'
if MSYS_NO_PATHCONV=1 "${opener[@]}"; then
  printf 'Browser launch request completed; this does not confirm a window opened.\nKeep your editable project backup separate from the client PDF.\n'
else
  printf 'Could not open a browser. Use your browser Open File command and select:\n%s\n' "$app_file" >&2
  exit 1
fi

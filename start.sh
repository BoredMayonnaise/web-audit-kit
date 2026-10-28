#!/usr/bin/env bash
# Open the offline application. Node.js is only needed to rebuild missing output.
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
app_file="$project_dir/dist/web-audit-kit.html"

case "${1:-}" in
  --help|-h)
    printf 'Web Audit Kit\nRun: bash start.sh\nRebuild from source: bash start.sh --build\nLinux/macOS: Bash. Windows: WSL or Git Bash.\n'
    exit 0 ;;
  --build|'') ;;
  *) printf 'Unknown option: %s\nUse bash start.sh --help\n' "$1" >&2; exit 2 ;;
esac

if [[ "${1:-}" == --build || ! -s "$app_file" ]]; then
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
printf 'Opening Web Audit Kit. Choose Create a report, or Explore the example.\n'
platform="$(uname -s)"
if [[ "$platform" == Darwin ]]; then
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
if MSYS_NO_PATHCONV=1 "${opener[@]}"; then
  printf 'Keep your editable project backup separate from the client PDF.\n'
else
  printf 'Could not open a browser. Use your browser Open File command and select:\n%s\n' "$app_file" >&2
  exit 1
fi

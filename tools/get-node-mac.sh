#!/bin/bash
# Mac only: installs Node 22 LTS for this user into ~/.video-claude/node. No password, no sudo, no Homebrew, no .pkg.
#   bash tools/get-node-mac.sh
# Then put it first on PATH in every command:
#   export PATH="$HOME/.video-claude/node/bin:$PATH"
# Downloads the official tarball from nodejs.org (Apple Silicon or Intel, chosen automatically) and checks its SHA-256.
set -euo pipefail

DEST="$HOME/.video-claude/node"
BASE="https://nodejs.org/dist/latest-v22.x"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This script is for macOS. On Windows run in PowerShell:  winget install OpenJS.NodeJS.LTS"
  exit 1
fi

if [ -x "$DEST/bin/node" ] && "$DEST/bin/node" -v | grep -q '^v22\.'; then
  echo "Node $("$DEST/bin/node" -v) is already in $DEST/bin"
  echo 'Use it with:  export PATH="$HOME/.video-claude/node/bin:$PATH"'
  exit 0
fi

# Apple Silicon reports hw.optional.arm64 = 1 (also inside a Rosetta terminal); Intel Macs report 0 or nothing.
if [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = "1" ]; then ARCH=arm64; else ARCH=x64; fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$BASE/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
FILE="$(grep -oE "node-v22\.[0-9]+\.[0-9]+-darwin-$ARCH\.tar\.gz" "$TMP/SHASUMS256.txt" | head -n 1 || true)"
if [ -z "$FILE" ]; then
  echo "Could not find the Node 22 download for darwin-$ARCH on nodejs.org. Check the internet connection and try again."
  exit 1
fi

echo "Downloading $FILE (about 50 MB) ..."
curl -fL --progress-bar "$BASE/$FILE" -o "$TMP/$FILE"
( cd "$TMP" && grep " $FILE\$" SHASUMS256.txt | shasum -a 256 -c - >/dev/null ) || { echo "Download is damaged (checksum mismatch). Run the script again."; exit 1; }

mkdir -p "$TMP/node"
tar -xzf "$TMP/$FILE" -C "$TMP/node" --strip-components 1
rm -rf "$DEST"
mkdir -p "$(dirname "$DEST")"
mv "$TMP/node" "$DEST"

echo "Installed Node $("$DEST/bin/node" -v) and npm $(PATH="$DEST/bin:$PATH" "$DEST/bin/npm" -v) in $DEST/bin"
echo 'Use it with:  export PATH="$HOME/.video-claude/node/bin:$PATH"'

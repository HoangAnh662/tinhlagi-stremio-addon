#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  pkg update -y
  pkg install -y nodejs
fi
if [ ! -d node_modules ]; then
  npm install
fi
node index.js

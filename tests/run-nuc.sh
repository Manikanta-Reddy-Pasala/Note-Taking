#!/usr/bin/env bash
# Sync this worktree to the nuc and run the browser tests there.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="${FOLIA_NUC_DIR:-work/folia-rollover-fix-2026-11-13}"
rsync -a --delete --exclude .git --exclude node_modules "$here/" "nuc:$dest/app/"
ssh nuc "cd $dest && ln -sfn ../node_modules app/node_modules && CHROME=\$HOME/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome node app/tests/${1:-rollover.test.js}"

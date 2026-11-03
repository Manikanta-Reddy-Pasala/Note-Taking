#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required" >&2
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required and must be logged in: gh auth login" >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in to GitHub. Run: gh auth login" >&2
  exit 1
fi

if [[ ! -d .git ]]; then
  git init -b main
fi

if [[ -z "$(git config user.email || true)" ]]; then
  git config user.name "Manikanta Reddy P"
  git config user.email "manikantareddy.pasala@gmail.com"
fi

git add index.html Dockerfile docker-compose.yml .dockerignore .gitignore run.sh push.sh
if git diff --cached --quiet; then
  echo "Nothing new to commit."
else
  git commit -m "Add Folia notes app with Docker run script."
fi

if git remote get-url origin >/dev/null 2>&1; then
  git push -u origin HEAD
else
  if gh repo view Folia >/dev/null 2>&1; then
    gh repo create folia-notes --public --source=. --remote=origin --push
  else
    gh repo create Folia --public --source=. --remote=origin --push
  fi
fi

echo "Repo: $(git remote get-url origin)"
echo "Then start the app with: ./run.sh"

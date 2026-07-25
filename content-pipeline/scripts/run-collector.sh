#!/usr/bin/env bash
# Daily topic collector. Invokes Claude Code headlessly to research and
# append new topics to content-pipeline/backlog.json, then verifies the
# resulting commit only touched that file before pushing to main.
#
# Claude Code never sees TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID — this script
# owns all notifications, and only sends them after the safety check passes.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${BLOG_PIPELINE_ENV_FILE:-/opt/blog-pipeline/.env}"
BACKLOG="content-pipeline/backlog.json"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

notify() {
  local text="$1"
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d chat_id="${TELEGRAM_CHAT_ID}" \
      -d parse_mode="Markdown" \
      --data-urlencode "text=${text}" >/dev/null || echo "Telegram notify failed" >&2
  fi
}

cd "$REPO_ROOT"
git checkout main
git fetch origin
git reset --hard origin/main

BEFORE_HEAD="$(git rev-parse HEAD)"
BEFORE_COUNT="$(jq '.topics | length' "$BACKLOG")"

claude -p "$(cat content-pipeline/collector-prompt.md)" \
  --dangerously-skip-permissions \
  --max-budget-usd "${CLAUDE_MAX_BUDGET_USD:-2}"

AFTER_HEAD="$(git rev-parse HEAD)"

if [ "$BEFORE_HEAD" = "$AFTER_HEAD" ]; then
  echo "No new commit from collector run — nothing to add."
  exit 0
fi

CHANGED_FILES="$(git diff --name-only "$BEFORE_HEAD" "$AFTER_HEAD")"
if [ "$CHANGED_FILES" != "$BACKLOG" ]; then
  echo "SAFETY ABORT: collector run touched unexpected files:" >&2
  echo "$CHANGED_FILES" >&2
  git reset --hard "$BEFORE_HEAD"
  notify "⚠️ *Blog collector aborted*: touched unexpected files, commit reverted, nothing pushed. Check the VPS logs."
  exit 1
fi

AFTER_COUNT="$(jq '.topics | length' "$BACKLOG")"
ADDED="$((AFTER_COUNT - BEFORE_COUNT))"

if [ "$ADDED" -le 0 ]; then
  echo "Backlog commit present but topic count didn't increase — pushing anyway, but not notifying." >&2
  git push origin main
  exit 0
fi

git push origin main

NEW_TITLES="$(jq -r --argjson n "$BEFORE_COUNT" '.topics[$n:] | map("• " + .title + " (score " + (.score|tostring) + ")") | join("\n")' "$BACKLOG")"
notify "📚 *Blog topic backlog update*
${ADDED} new topic(s) added.

${NEW_TITLES}"

echo "Pushed collector update: ${ADDED} new topic(s)."

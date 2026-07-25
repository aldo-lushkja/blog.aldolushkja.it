#!/usr/bin/env bash
# Bi-monthly draft generator. Invokes Claude Code headlessly to turn the
# top backlog topic into a post skeleton on a new branch, verifies the
# resulting commit only touched the expected files, then pushes the branch
# and opens the PR itself (Claude never pushes or calls `gh pr create`).
#
# Claude Code never sees TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID — this script
# owns all notifications.
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

claude -p "$(cat content-pipeline/drafter-prompt.md)" \
  --dangerously-skip-permissions \
  --max-budget-usd "${CLAUDE_MAX_BUDGET_USD:-3}"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [ "$CURRENT_BRANCH" = "main" ]; then
  echo "Drafter made no branch — backlog was likely empty."
  notify "✍️ *Blog drafter run*: backlog is empty, nothing to draft this time."
  exit 0
fi

CHANGED_FILES="$(git diff --name-only main.."$CURRENT_BRANCH")"
EXPECTED_PATTERN='^(content-pipeline/backlog\.json|frontend/src/content/blog/[a-z0-9-]+\.md)$'

BAD_FILES="$(echo "$CHANGED_FILES" | grep -vE "$EXPECTED_PATTERN" || true)"
if [ -n "$BAD_FILES" ]; then
  echo "SAFETY ABORT: drafter branch touched unexpected files:" >&2
  echo "$BAD_FILES" >&2
  git checkout main
  git branch -D "$CURRENT_BRANCH"
  notify "⚠️ *Blog drafter aborted*: branch touched unexpected files, discarded, nothing pushed. Check the VPS logs."
  exit 1
fi

NEW_POST_FILE="$(echo "$CHANGED_FILES" | grep -E '^frontend/src/content/blog/' || true)"
if [ -z "$NEW_POST_FILE" ]; then
  echo "SAFETY ABORT: drafter branch has no new post file." >&2
  git checkout main
  git branch -D "$CURRENT_BRANCH"
  notify "⚠️ *Blog drafter aborted*: no post file was created. Check the VPS logs."
  exit 1
fi

TITLE="$(grep -m1 '^title:' "$NEW_POST_FILE" | sed -E 's/^title:\s*"?//; s/"?\s*$//')"
DESCRIPTION="$(grep -m1 '^description:' "$NEW_POST_FILE" | sed -E 's/^description:\s*"?//; s/"?\s*$//')"

git push origin "$CURRENT_BRANCH"

PR_URL="$(gh pr create \
  --title "Draft: ${TITLE}" \
  --body "Auto-generated skeleton for **${TITLE}**

${DESCRIPTION}

This PR is a **draft** — fill in the body, review the front-matter, then flip \`draft: false\` and merge." \
  --draft \
  --base main \
  --head "$CURRENT_BRANCH" \
  --json url -q .url 2>&1 || true)"

git checkout main

if [[ "$PR_URL" != http* ]]; then
  echo "gh pr create failed: $PR_URL" >&2
  notify "⚠️ *Blog drafter*: draft \"${TITLE}\" was pushed to branch \`${CURRENT_BRANCH}\` but opening the PR failed. Open it manually."
  exit 1
fi

notify "✍️ *New draft ready*
*${TITLE}*

${DESCRIPTION}

${PR_URL}"

echo "Opened draft PR: ${PR_URL}"

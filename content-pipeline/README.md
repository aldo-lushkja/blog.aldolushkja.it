# Content pipeline (runs on trustbuddy-vps, not AWS)

A daily collector and a bi-monthly drafter, both powered by Claude Code
running headlessly on `trustbuddy-vps` — not Lambda/Bedrock. This replaced
an earlier AWS-based design; see git history if you need to resurrect that.

**Auth note**: this uses the VPS owner's personal Claude subscription via
Claude Code's own login, invoked unattended via `--dangerously-skip-permissions`.
That's an accepted, deliberate risk to that account (Anthropic's consumer
plans are meant for interactive use, not unattended automation) — not
something to copy without re-reading that trade-off.

## How it works

- **Backlog lives in git**: `content-pipeline/backlog.json`, not DynamoDB.
- **Collector** (`scripts/run-collector.sh`, daily): runs Claude Code with
  `collector-prompt.md`. Claude searches the web, updates `backlog.json`,
  and commits *locally* — it never pushes. The wrapper script then verifies
  the commit touched only `backlog.json` before pushing to `main`. If the
  diff looks wrong, the commit is reverted and nothing is pushed.
- **Drafter** (`scripts/run-drafter.sh`, 1st & 15th of the month): runs
  Claude Code with `drafter-prompt.md`. Claude picks the top backlog topic,
  writes a skeleton post under `frontend/src/content/blog/`, marks the
  topic `drafted`, and commits to a new branch — it never pushes or opens
  the PR itself. The wrapper verifies the branch's diff is scoped to
  exactly the new post file (+ `backlog.json`), then pushes the branch and
  runs `gh pr create` itself.
- **Telegram notifications** are sent entirely by the wrapper scripts, not
  by Claude — Claude Code is never given `TELEGRAM_BOT_TOKEN`/
  `TELEGRAM_CHAT_ID`, so it structurally cannot send a notification for a
  run that later gets reverted.

## One-time VPS setup

Already done for `trustbuddy-vps`, documented here for reference / a future
box:

```bash
sudo dnf install -y gh jq
gh auth login --with-token < token.txt   # PAT with Contents:RW + Pull requests:RW on this repo
gh auth setup-git
git config --global user.name "Blog Content Bot"
git config --global user.email "bot@blog.aldolushkja.it"

sudo mkdir -p /opt/blog-pipeline && sudo chown deploy:deploy /opt/blog-pipeline
git clone https://github.com/aldo-lushkja/blog.aldolushkja.it.git /opt/blog-pipeline/repo

# /opt/blog-pipeline/.env (chmod 600, NOT committed to git):
#   TELEGRAM_BOT_TOKEN=...
#   TELEGRAM_CHAT_ID=...

sudo cp content-pipeline/systemd/*.service content-pipeline/systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now blog-collector.timer blog-drafter.timer
```

## Manually triggering a run

```bash
ssh trustbuddy-vps '/opt/blog-pipeline/repo/content-pipeline/scripts/run-collector.sh'
ssh trustbuddy-vps '/opt/blog-pipeline/repo/content-pipeline/scripts/run-drafter.sh'
```

## Checking on it

```bash
ssh trustbuddy-vps 'systemctl list-timers blog-collector.timer blog-drafter.timer'
ssh trustbuddy-vps 'journalctl -u blog-collector.service -n 100 --no-pager'
ssh trustbuddy-vps 'journalctl -u blog-drafter.service -n 100 --no-pager'
```

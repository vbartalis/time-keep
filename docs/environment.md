# Environment

One development environment: the **devcontainer**, run on a workstation under VS Code.

Definition: [`.devcontainer/`](../.devcontainer/) (devcontainer.json, compose,
Dockerfile) and [`scripts/devcontainer-setup.sh`](../scripts/devcontainer-setup.sh)
(idempotent bootstrap run on create).

## Image

Ubuntu devcontainers base, plus: tmux, jq, ripgrep, GitHub CLI, Node.js 24 (the app's
runtime, decision 1, and the agent tooling's hooks), Claude Code and CodeGraph.

## First start

After **Dev Containers: Reopen in Container** finishes (the build, then
`scripts/devcontainer-setup.sh`), in a VS Code terminal inside the container:

1. `claude` once and log in; `~/.claude` is a fresh volume. Exit.
2. `gh auth login -s project`.
3. If the setup script's plugin step ran before the login, rerun it:
   `bash scripts/devcontainer-setup.sh` (idempotent). It pins ECC to a release
   tag; to move the pin, edit the tag in the script and in `~/.claude/settings.json`.
4. `dev` to open the `main` tmux session; type `claude` in its `claude` window.

## State that survives a rebuild

| What | Where | Kept by |
|------|-------|---------|
| Working tree | `/workspaces/time-keep` | the container volume of "Clone Repository in Container Volume", or a host bind mount of the repo's parent when a local folder is reopened |
| Claude Code plugins, credentials | `~/.claude` | named volume `claude-home` |
| Session memory | `.claude/memory/` | the working tree; linked from `~/.claude/projects/…/memory` by the setup script |
| `gh` credential | `~/.config/gh` | nothing: container filesystem |

A rebuild (VS Code "Rebuild Container") replaces the image and the container
filesystem and keeps the volumes. `gh auth login -s project` is needed again after a
rebuild. tmux sessions survive disconnects, not restarts.

The compose file sets `init: true`, so `tini` is PID 1 and reaps orphaned processes
that `sleep infinity` would leave as zombies.

## Sessions that outlive an editor

`dev` (alias of `scripts/dev-session.sh`) creates or reattaches the `main` tmux
session: a `claude` window and a `misc` window at the repo root. Detach with
`Ctrl-b d`; run `dev` again to resume. tmux is not auto-launched on login; that
breaks VS Code's container terminals.

The container itself stays up independently of any editor: `shutdownAction: none`
in devcontainer.json and `restart: unless-stopped` in the compose file.

## Line endings

`.gitattributes` keeps every file LF. The repo is checked out on Windows and mounted
into a Linux container, where CRLF breaks shell scripts.

## Rules that bind here

Never run the Docker CLI, on the host or in a container. Lifecycle and logs are
VS Code actions. See
[`.claude/rules/never-use-the-docker-cli.md`](../.claude/rules/never-use-the-docker-cli.md).

# Never use the Docker CLI

**No `docker` or `docker compose` commands from a terminal. Ever.** Not `exec`, not
`compose up`, not `ps`, `logs`, `stop`, `restart`, `volume`, or `build`; the whole CLI,
on the host and inside any container alike.

Containers are managed by a platform, never by hand:

- **Server (devbox and production):** the Coolify UI. Start, stop, restart, redeploy
  and logs are Coolify actions.
- **Local devcontainer:** VS Code performs the container management.

**Why:** operating Docker directly puts real state out of sync with what Coolify
believes it owns (naming, networks, volumes, lifecycle). Operator, 2026-08-11: "no
docker command line utilities… never docker."

**How to apply:** diagnostics → Coolify's log view. Lifecycle → Coolify UI. A config
or code fix → edit the compose file or Dockerfile in the repo, commit, redeploy
through Coolify. Never write an ops instruction, doc or script step that tells anyone
to run a docker command.
